/**
 * useJam — P2P live jam sessions via WebSocket relay.
 *
 * Peers connect to a lightweight WebSocket relay server and join a named room.
 * The relay broadcasts messages to all other peers in the same room.
 * Each peer runs its own audio engine — no audio is streamed, only control data (~50 bytes/msg).
 *
 * Production relay options:
 * - Cloudflare Durable Objects (WebSocket support, $5/mo Workers Paid)
 * - Any Node.js server running jam-relay.mjs
 * - Fly.io / Railway free tier
 */

import { useState, useRef, useCallback, useEffect } from "react";
import type { ClientMessage } from "../types";
import { trackEvent } from "../utils/metrics";

// Relay URL — in dev uses local server, in production point to hosted relay
const RELAY_URL = import.meta.env.DEV
  ? `ws://${location.hostname}:4444`
  : "wss://mpump-jam-relay.fly.dev";

// Commands worth broadcasting — excludes local-only operations (step edits, save, clipboard)
const BROADCAST_TYPES = new Set([
  // Sequencer
  "set_genre", "set_pattern", "set_key", "set_octave",
  "set_bpm", "set_pattern_length",
  // Mute — explicit set only. Toggles are converted to set_*_mute in Layout's command wrapper.
  "set_bass_mute", "set_drums_mute",
  // Volume / mix
  "set_volume", "set_device_volume",
  "set_channel_volume", "set_channel_pan", "set_channel_mono",
  // Sound design — individual voice/synth params NOT broadcast (preset IDs sent via jam_set_* instead)
  // "set_synth_params", "set_drum_voice",
  // Effects
  "set_effect", "set_effect_order",
  "set_sidechain_duck", "set_drive", "set_anti_clip",
  // Performance
  "set_swing", "set_mono", "set_metronome", "set_humanize",
  // Randomize — NOT broadcast (each peer would get different random results)
  // Instead, Layout broadcasts the resulting state after randomization via load_preset
  // "randomize_all", "randomize_device", "randomize_bass",
  // Presets
  "load_preset",
  // Jam-specific: sound preset IDs (receiver loads the full preset)
  "jam_set_drum_kit", "jam_set_synth", "jam_set_bass",
]);

const XY_THROTTLE_MS = 66; // ~15 Hz

export type JamStatus = "idle" | "connecting" | "connected";
export type RoomType = "jam" | "liveset";
export type JamRole = "peer" | "controller" | "listener";

/** A 16-point XY loop — one position per sequencer step */
export type XYLoop = ({ x: number; y: number } | null)[];

export interface PeerInfo {
  id: number;
  name: string | null;
}

export interface JamState {
  status: JamStatus;
  roomId: string | null;
  roomType: RoomType;
  role: JamRole;
  peerCount: number;
  peerList: PeerInfo[];
  myPeerId: number | null;
  quantize: boolean;
}

export function useJam() {
  const [state, setState] = useState<JamState>({
    status: "idle",
    roomId: null,
    roomType: "jam",
    role: "peer",
    peerCount: 0,
    peerList: [],
    myPeerId: null,
    quantize: true,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const remoteRef = useRef(false); // feedback loop prevention
  const commandHandlerRef = useRef<((msg: ClientMessage, sender?: PeerInfo) => void) | null>(null);
  const xyHandlerRef = useRef<((x: number, y: number, sender?: PeerInfo) => void) | null>(null);
  const playStateHandlerRef = useRef<((playing: boolean) => void) | null>(null);
  const soundChangeHandlerRef = useRef<((type: string, id: string, sender?: PeerInfo) => void) | null>(null);
  const reactionHandlerRef = useRef<((emoji: string) => void) | null>(null);
  const syncHandlerRef = useRef<((payload: string) => void) | null>(null);
  const getSharePayloadRef = useRef<(() => string | null) | null>(null);
  const lastXYSend = useRef(0);
  const isFirstPeerRef = useRef(false);

  /** Send JSON to relay */
  const send = useCallback((data: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }, []);

  const retryRef = useRef(0);
  const retryTimerRef = useRef(0);

  /** Connect to relay and join a room (with auto-retry for cold starts) */
  const roomTypeRef = useRef<RoomType>("jam");

  const nameRef = useRef<string | null>(null);

  const connect = useCallback((roomId: string, roomType: RoomType = "jam", name?: string) => {
    nameRef.current = name?.slice(0, 8).trim() || null;
    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    clearTimeout(retryTimerRef.current);
    roomTypeRef.current = roomType;

    setState(s => ({ ...s, status: "connecting", roomId, roomType, peerCount: 0 }));
    console.log("[jam] connecting to relay:", RELAY_URL, "room:", roomId, retryRef.current > 0 ? `(retry ${retryRef.current})` : "");

    // Pre-warm the Fly.io machine with an HTTP request (wakes it from auto-stop)
    if (retryRef.current === 0) {
      const httpUrl = RELAY_URL.replace("ws://", "http://").replace("wss://", "https://");
      fetch(`${httpUrl}/health`).catch(() => {});
    }

    const ws = new WebSocket(RELAY_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      // Guard: if we were told to leave while connecting, abort
      if (wsRef.current !== ws) { ws.close(); return; }
      console.log("[jam] relay connected, joining room:", roomId, "type:", roomTypeRef.current);
      retryRef.current = 0;
      ws.send(JSON.stringify({ type: "join", room: roomId, roomType: roomTypeRef.current, name: nameRef.current }));
      setState(s => ({ ...s, status: "connected" }));
    };

    ws.onmessage = (e) => {
      if (wsRef.current !== ws) return; // stale connection
      let msg: Record<string, unknown>;
      try { msg = JSON.parse(e.data as string); } catch { return; }

      if (msg.type === "peers") {
        const count = msg.count as number;
        const roomType = (msg.roomType as RoomType) || undefined;
        const peerList = (msg.peerList as PeerInfo[]) || [];
        setState(s => {
          if (count > s.peerCount) trackEvent("jam-peer-joined");
          return { ...s, peerCount: count, peerList, ...(roomType ? { roomType } : {}) };
        });
        return;
      }

      // Role assignment from relay
      if (msg.type === "role") {
        const role = msg.role as JamRole;
        const peerId = (msg.peerId as number) ?? null;
        console.log("[jam] role assigned:", role, "peerId:", peerId);
        setState(s => ({ ...s, role, myPeerId: peerId }));
        return;
      }

      // Room full error
      if (msg.type === "error") {
        console.warn("[jam] relay error:", msg.message);
        return;
      }

      // Relay asks host to send current state to new joiner
      if (msg.type === "sync_request") {
        console.log("[jam] sync requested, sending state...");
        const payload = getSharePayloadRef.current?.();
        if (payload) {
          ws.send(JSON.stringify({ type: "sync", payload }));
        }
        return;
      }

      // Reaction from a peer
      if (msg.type === "reaction") {
        if (reactionHandlerRef.current) {
          reactionHandlerRef.current(msg.emoji as string);
        }
        return;
      }

      // Full state sync from host
      if (msg.type === "sync" && msg.payload) {
        console.log("[jam] received sync payload");
        if (syncHandlerRef.current) {
          syncHandlerRef.current(msg.payload as string);
        }
        return;
      }

      const sender = msg.sender as PeerInfo | undefined;

      if (msg.type === "cmd" && msg.cmd) {
        const cmd = msg.cmd as Record<string, unknown>;
        console.log("[jam] recv cmd:", cmd.type, sender?.name || "");
        // Explicit play/stop from peer — apply to all devices
        if (cmd.type === "jam_set_playing" && playStateHandlerRef.current) {
          playStateHandlerRef.current((cmd.playing as boolean) ?? false);
          return;
        }
        // Sound preset changes — receiver loads the full preset by ID
        if ((cmd.type === "jam_set_drum_kit" || cmd.type === "jam_set_synth" || cmd.type === "jam_set_bass") && soundChangeHandlerRef.current) {
          soundChangeHandlerRef.current(cmd.type as string, cmd.id as string, sender);
          return;
        }
        if (commandHandlerRef.current) {
          remoteRef.current = true;
          commandHandlerRef.current(cmd as unknown as ClientMessage, sender);
          remoteRef.current = false;
        }
        return;
      }

      if (msg.type === "xy" && msg.x != null && msg.y != null) {
        if (xyHandlerRef.current) {
          xyHandlerRef.current(msg.x as number, msg.y as number, sender);
        }
      }

      // Quantized XY loop from peer
      if (msg.type === "xy_loop") {
        remoteXYLoopRef.current = msg.loop as XYLoop | null;
        xyLoopChangedRef.current?.(msg.loop as XYLoop | null);
      }
    };

    ws.onclose = () => {
      console.log("[jam] relay disconnected");
      // Auto-retry on unexpected close (up to 5 times, with backoff)
      if (retryRef.current < 5 && wsRef.current === ws) {
        const delay = Math.min(1000 * (retryRef.current + 1), 5000);
        console.log(`[jam] retrying in ${delay}ms...`);
        retryRef.current++;
        retryTimerRef.current = window.setTimeout(() => connect(roomId, roomTypeRef.current, nameRef.current ?? undefined), delay);
      } else {
        setState(s => s.status !== "idle" ? { ...s, status: "idle", peerCount: 0 } : s);
        retryRef.current = 0;
      }
    };

    ws.onerror = () => {
      console.error("[jam] relay error");
    };
  }, []);

  /** Generate a 6-char room ID */
  const generateRoomId = useCallback(() => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    return Array.from(bytes, b => chars[b % 36]).join("");
  }, []);

  /** Create a new room (you're the first peer / host) */
  const createRoom = useCallback(async (roomType: RoomType = "jam", name?: string) => {
    const roomId = generateRoomId();
    isFirstPeerRef.current = true;
    trackEvent(roomType === "liveset" ? "liveset-create" : "jam-create");
    connect(roomId, roomType, name);
    return roomId;
  }, [generateRoomId, connect]);

  /** Join an existing room */
  const joinRoom = useCallback(async (roomId: string, roomType: RoomType = "jam", name?: string) => {
    isFirstPeerRef.current = false;
    trackEvent(roomType === "liveset" ? "liveset-join" : "jam-join");
    connect(roomId, roomType, name);
  }, [connect]);

  /** Leave the current room */
  const leaveRoom = useCallback(() => {
    clearTimeout(retryTimerRef.current);
    retryRef.current = 99; // prevent auto-retry on intentional leave
    const ws = wsRef.current;
    wsRef.current = null; // null BEFORE close so onclose/retry guards fail
    if (ws) ws.close();
    retryRef.current = 0;
    setState(s => ({ ...s, status: "idle", roomId: null, peerCount: 0 }));
  }, []);

  /** Send a command to peers */
  const broadcastCommand = useCallback((msg: ClientMessage) => {
    if (remoteRef.current) return; // don't re-broadcast remote commands
    // Listeners in liveset mode can't send
    if (state.role === "listener") return;
    if (!BROADCAST_TYPES.has(msg.type)) return;
    send({ type: "cmd", cmd: msg });
  }, [send, state.role]);

  /** Send explicit play/stop state (called from Layout after toggle resolves) */
  const broadcastPlayState = useCallback((playing: boolean) => {
    if (remoteRef.current) return;
    send({ type: "cmd", cmd: { type: "jam_set_playing", playing } });
  }, [send]);

  /** Send XY position to peers (throttled) */
  const broadcastXY = useCallback((x: number, y: number) => {
    const now = Date.now();
    if (now - lastXYSend.current < XY_THROTTLE_MS) return;
    lastXYSend.current = now;
    send({ type: "xy", x, y });
  }, [send]);

  /** Send a reaction emoji to all peers */
  const sendReaction = useCallback((emoji: string) => {
    send({ type: "reaction", emoji });
  }, [send]);

  /** Register handler for incoming reactions */
  const onReaction = useCallback((handler: (emoji: string) => void) => {
    reactionHandlerRef.current = handler;
  }, []);

  /** Register handler for incoming remote commands */
  const onRemoteCommand = useCallback((handler: (msg: ClientMessage, sender?: PeerInfo) => void) => {
    commandHandlerRef.current = handler;
  }, []);

  /** Register handler for incoming remote XY */
  const onRemoteXY = useCallback((handler: (x: number, y: number, sender?: PeerInfo) => void) => {
    xyHandlerRef.current = handler;
  }, []);

  /** Register handler for incoming play/stop state */
  const onPlayState = useCallback((handler: (playing: boolean) => void) => {
    playStateHandlerRef.current = handler;
  }, []);

  /** Register handler for incoming sound preset changes */
  const onSoundChange = useCallback((handler: (type: string, id: string, sender?: PeerInfo) => void) => {
    soundChangeHandlerRef.current = handler;
  }, []);

  /** Register handler for incoming sync payload (joiner receives host state) */
  const onSync = useCallback((handler: (payload: string) => void) => {
    syncHandlerRef.current = handler;
  }, []);

  /** Register function that returns current share payload (host sends to joiners) */
  const setSharePayloadGetter = useCallback((getter: () => string | null) => {
    getSharePayloadRef.current = getter;
  }, []);

  /** Toggle quantize mode (bar-synced actions) */
  const toggleQuantize = useCallback(() => {
    setState(s => ({ ...s, quantize: !s.quantize }));
  }, []);

  // ── Quantized XY loop recording ──
  // Records XY positions into a 16-step array (one per sequencer step).
  // When a full bar is captured, broadcasts the loop. Both peers replay it.
  const xyLoopRef = useRef<XYLoop>(Array(16).fill(null));
  const xyLoopRecording = useRef(false);
  const remoteXYLoopRef = useRef<XYLoop | null>(null);
  const xyLoopChangedRef = useRef<((loop: XYLoop | null) => void) | null>(null);

  /** Start recording an XY loop (captures one bar = 16 steps) */
  const startXYLoopRec = useCallback(() => {
    xyLoopRef.current = Array(16).fill(null);
    xyLoopRecording.current = true;
  }, []);

  /** Stop recording and broadcast the loop */
  const stopXYLoopRec = useCallback(() => {
    xyLoopRecording.current = false;
    const loop = xyLoopRef.current;
    // Only broadcast if we have some data
    if (loop.some(p => p !== null)) {
      send({ type: "xy_loop", loop });
    }
  }, [send]);

  /** Clear the XY loop (local and remote) */
  const clearXYLoop = useCallback(() => {
    xyLoopRecording.current = false;
    xyLoopRef.current = Array(16).fill(null);
    remoteXYLoopRef.current = null;
    xyLoopChangedRef.current?.(null);
    send({ type: "xy_loop", loop: null });
  }, [send]);

  /** Record a position at the current step during XY loop recording */
  const recordXYStep = useCallback((x: number, y: number, step: number) => {
    if (xyLoopRecording.current && step >= 0 && step < 16) {
      xyLoopRef.current[step] = { x, y };
    }
  }, []);

  /** Register handler for remote XY loop changes */
  const onXYLoopChange = useCallback((handler: (loop: XYLoop | null) => void) => {
    xyLoopChangedRef.current = handler;
  }, []);

  /** Get the current remote XY loop */
  const getRemoteXYLoop = useCallback(() => remoteXYLoopRef.current, []);

  // ── Bar-synced action queue ──
  // When quantize is on, mutes/effects/play queue here until step 0
  const barQueueRef = useRef<ClientMessage[]>([]);
  const barQueueHandlerRef = useRef<((msgs: ClientMessage[]) => void) | null>(null);

  /** Queue a command to fire at next bar boundary (step 0) */
  const queueAtBar = useCallback((msg: ClientMessage) => {
    barQueueRef.current.push(msg);
  }, []);

  /** Called by Layout on every step — flushes bar queue at step 0 */
  const flushBarQueue = useCallback((step: number) => {
    if (step !== 0) return;
    const msgs = barQueueRef.current;
    if (msgs.length === 0) return;
    barQueueRef.current = [];
    barQueueHandlerRef.current?.(msgs);
  }, []);

  /** Register handler for flushed bar queue */
  const onBarFlush = useCallback((handler: (msgs: ClientMessage[]) => void) => {
    barQueueHandlerRef.current = handler;
  }, []);

  /** Check if a command originated from a remote peer */
  const isRemote = useCallback(() => remoteRef.current, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return {
    ...state,
    createRoom,
    joinRoom,
    leaveRoom,
    broadcastCommand,
    broadcastPlayState,
    broadcastXY,
    sendReaction,
    onReaction,
    onRemoteCommand,
    onRemoteXY,
    onPlayState,
    onSoundChange,
    onSync,
    setSharePayloadGetter,
    isRemote,
    toggleQuantize,
    startXYLoopRec,
    stopXYLoopRec,
    clearXYLoop,
    recordXYStep,
    onXYLoopChange,
    getRemoteXYLoop,
    queueAtBar,
    flushBarQueue,
    onBarFlush,
  };
}
