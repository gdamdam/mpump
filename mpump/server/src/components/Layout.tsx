import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { enableLinkBridge, onLinkState, autoDetectLinkBridge, sendLinkTempo, sendLinkPlaying } from "../utils/linkBridge";
import type { Catalog, ClientMessage, EngineState, PreviewMode, EffectName, EffectParams } from "../types";
import { DEFAULT_EFFECTS } from "../types";
import { Settings, getSongModeEnabled, getBottomTransportEnabled, PALETTES, applyPalette } from "./Settings";
import { DrumKitEditor } from "./DrumKitEditor";
import { snapToScale } from "../data/keys";
import { getItem, setItem, getBool, setBool, getJSON, setJSON } from "../utils/storage";
import { DevicePanel } from "./DevicePanel";

import { KaosPanel } from "./KaosPanel";
import { BpmControl } from "./BpmControl";
import { TapTempo } from "./TapTempo";
import { Recorder } from "./Recorder";
import { PresetManager, type SavedPreset } from "./PresetManager";
import { SessionLibrary } from "./SessionLibrary";
import { useKeyboard } from "../hooks/useKeyboard";
import { Tutorial, useTutorial } from "./Tutorial";
import { ThemePicker } from "./ThemePicker";
import { ShareModal } from "./ShareModal";
import { JamModal } from "./JamModal";
import { JamReactions, useJamReactions } from "./JamReactions";
import { useJam } from "../hooks/useJam";
import { encodeSteps, decodeSteps, encodeDrumSteps, decodeDrumSteps, validateSharePayload, encodeGesture, decodeGesture, gestureUrlFit, encodeEffectParams, encodeSynthParamsCompact, decodeSynthParamsCompact } from "../utils/patternCodec";
import { useSupportPrompt, SupportPromptUI } from "./SupportPrompt";
import { AboutModal } from "./AboutModal";
import { MegaKaos } from "./MegaKaos";
import { HelpModal } from "./HelpModal";
import { PatternLibrary } from "./PatternLibrary";
import { PrivacyModal } from "./PrivacyModal";
import { MixerPanel } from "./MixerPanel";
import { SongStrip } from "./SongStrip";
import { SessionModal } from "./SessionModal";
import { exportSession, downloadSession, readSessionFile, saveLastSession, getRecentSessions, saveSession, type SessionData } from "../utils/session";
import { trackEvent } from "../utils/metrics";
import { pressVibrate, heavyVibrate } from "../utils/haptic";
import { getDeviceGenres, getDeviceBassGenres } from "../data/catalog";
import { SYNTH_PRESETS, BASS_PRESETS, DRUM_KIT_PRESETS } from "../data/soundPresets";
import { SAMPLE_PACKS } from "../data/samplePacks";
import { GENRE_MIX_PROFILES } from "../data/genreMixProfiles";
import { checkRelayHealth, shortenBeat, getParentId, shortUrl } from "../utils/shareRelay";

interface Props {
  state: EngineState;
  catalog: Catalog | null;
  command: (msg: ClientMessage) => void;
  isPreview?: boolean;
  getAnalyser?: () => AnalyserNode | null;
  getChannelAnalyser?: (ch: number) => AnalyserNode | null;
  onConnectMidi?: () => void;
  onStartPreview?: () => void;
  onLoadSamples?: (samples: Map<number, AudioBuffer>) => void;
  getMutedDrumNotes?: () => Set<number>;
  playNote?: (ch: number, note: number, vel?: number) => void;
  stopNote?: (ch: number, note: number) => void;
  getMixerState?: () => { drive: number; eq: { low: number; mid: number; high: number }; width: number; lowCut: number; mbOn: boolean; mbExcludeDrums: boolean };
  getCpuLoad?: () => number;
  songState?: import("../types").SongState | null;
}

const MODE_LABELS: Record<PreviewMode, string> = {
  kaos: "KAOS",
  synth: "SYNTH",
  mixer: "MIXER",
};

/** Modes shown in the header switcher (SIMPLE is in Settings). */
const HEADER_MODES: PreviewMode[] = ["kaos", "synth", "mixer"];

const EFFECT_ORDER: EffectName[] = ["delay", "distortion", "reverb", "compressor", "highpass", "chorus", "phaser", "bitcrusher", "flanger", "tremolo"];

import { encodeSharePayload, decodeSharePayload, buildShareUrl } from "../utils/shareCodec";

const toUrlSafeB64 = (obj: object) => encodeSharePayload(obj);

/** Tiny CPU load indicator — polls every 2s, green/yellow/red dot. */
function CpuDot({ getCpuLoad }: { getCpuLoad?: () => number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!getCpuLoad) return;
    const id = setInterval(() => {
      const load = getCpuLoad();
      if (!ref.current) return;
      const hot = load > 0.5;
      ref.current.style.color = hot ? "#ff4444" : "var(--border)";
      ref.current.style.opacity = hot ? "1" : "0.4";
      ref.current.style.animation = hot ? "cpu-blink 0.6s ease-in-out infinite" : "none";
      ref.current.title = `Audio CPU: ${Math.round(load * 100)}%`;
    }, 2000);
    return () => clearInterval(id);
  }, [getCpuLoad]);
  return <span ref={ref} style={{ fontSize: 7, fontWeight: 700, marginLeft: 4, verticalAlign: "top", color: "var(--border)", opacity: 0.4, letterSpacing: 0.5 }}>CPU</span>;
}

export function Layout({ state, catalog, command: rawCommand, isPreview, getAnalyser, getChannelAnalyser, onConnectMidi, onStartPreview, onLoadSamples, getMutedDrumNotes, playNote, stopNote, getMixerState, getCpuLoad, songState }: Props) {
  // Ref to access current state inside Link callback (avoids stale closure)
  const stateRef = useRef(state);
  stateRef.current = state;

  // Refs for auto-save (avoid stale closures in beforeunload / setInterval)
  const volumeRef = useRef(0.7);
  const channelVolumesRef = useRef<Record<number, number>>({ 9: 0.56, 0: 0.56, 1: 0.56 });
  const activeDrumKitRef = useRef("0");
  const activeSynthRef = useRef("0");
  const activeBassRef = useRef("0");
  const antiClipModeRef = useRef<"off" | "limiter" | "hybrid">("limiter");
  const connectedDevices = Object.values(state.devices).filter(d => d.connected);
  const anyConnected = connectedDevices.length > 0;
  const [previewMode, setPreviewMode] = useState<PreviewMode>("kaos");

  // Track title — BPM-aware name generator
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const TRACK_TIERS = {
    chill: {
      adj: ["Ambient", "Floating", "Liquid", "Hazy", "Mellow", "Foggy", "Drifting", "Submerged", "Twilight", "Lunar", "Velvet", "Soft", "Glacial", "Faded", "Hollow", "Still", "Warm", "Dim", "Pale", "Slow"],
      noun: ["Lagoon", "Current", "Horizon", "Echo", "Cloud", "Reef", "Haze", "Tide", "Mist", "Dusk", "Shore", "Depths", "Vapor", "Bloom", "Ether", "Drift", "Pool", "Shade", "Murmur", "Glow"],
      solo: ["Solace", "Liminal", "Ether", "Lumen", "Abyss", "Zenith", "Horizon", "Stillness"],
    },
    groove: {
      adj: ["Neon", "Chrome", "Analog", "Cosmic", "Electric", "Midnight", "Sonic", "Binary", "Lucid", "Urban", "Crystal", "Phantom", "Solar", "Deep", "Iron", "Bright", "Shadow", "Golden", "Pulse", "Silent"],
      noun: ["Circuit", "Groove", "Signal", "Flux", "Orbit", "Grid", "Loop", "Wave", "Synapse", "Sector", "Void", "Prism", "Drone", "Tape", "Dial", "Spark", "Field", "Zone", "Phase", "Core"],
      solo: ["Apex", "Nova", "Enigma", "Helix", "Cipher", "Matrix", "Strobe", "Nexus", "Praxis", "Vertigo"],
    },
    energy: {
      adj: ["Hyper", "Atomic", "Blazing", "Rapid", "Savage", "Volatile", "Turbo", "Razor", "Fierce", "Brutal", "Harsh", "Burning", "Charged", "Wired", "Frantic", "Shattered", "Overdriven", "Raging", "Searing", "Lethal"],
      noun: ["Storm", "Blast", "Rush", "Strike", "Surge", "Inferno", "Shockwave", "Rift", "Havoc", "Crush", "Riot", "Fury", "Tremor", "Impact", "Ignition", "Rampage", "Assault", "Voltage", "Reactor", "Meltdown"],
      solo: ["Havoc", "Frenzy", "Blitz", "Onslaught", "Rampage", "Inferno", "Overload", "Reactor", "Shatter", "Quasar"],
    },
  };
  const TRACK_MOD = ["MK2", "II", "Redux", "Zero", "Prime", "X", "One", "Dub", "Raw", "Mix", "Live", "Rework", "Edit", "Session", "Take"];
  const TRACK_NUM = [0, 1, 7, 9, 19, 42, 76, 99, 101, 202, 303, 404, 606, 707, 808, 909, 999, 1984, 2049, 2077, 3000];
  const generateTrackName = (bpm = 120) => {
    const tier = bpm < 100 ? TRACK_TIERS.chill : bpm <= 140 ? TRACK_TIERS.groove : TRACK_TIERS.energy;
    const r = Math.random();
    if (r < 0.40) return `${pick(tier.adj)} ${pick(tier.noun)}`;
    if (r < 0.67) return `${pick(tier.adj)} ${pick(tier.noun)} ${pick(TRACK_NUM)}`;
    if (r < 0.95) return `${pick(tier.adj)} ${pick(tier.noun)} ${pick(TRACK_MOD)}`;
    return pick(tier.solo);
  };
  const [trackName, setTrackName] = useState(() => getItem("mpump-track-name", "") || generateTrackName());
  useEffect(() => { setItem("mpump-track-name", trackName); }, [trackName]);

  const [showSettings, setShowSettings] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showScenePicker, setShowScenePicker] = useState(false);
  useEffect(() => {
    if (!showScenePicker) return;
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest(".scene-picker-wrap")) setShowScenePicker(false); };
    setTimeout(() => document.addEventListener("click", close), 0);
    return () => document.removeEventListener("click", close);
  }, [showScenePicker]);
  const [activeScene, setActiveScene] = useState<string | null>("Punchy");
  const activeSceneRef = useRef(activeScene);
  useEffect(() => { activeSceneRef.current = activeScene; }, [activeScene]);
  const HEADER_SCENES = [
    { name: "Neutral", desc: "flat, no coloring", eq: { low: 0, mid: 0, high: 0 }, drive: 1, width: 0.5, lowCut: 0, mbOn: true, mbAmount: 0.25 },
    { name: "Airy", desc: "wide, bright, open", eq: { low: 1, mid: -1, high: 2 }, drive: 1, width: 0.7, lowCut: 25, mbOn: true, mbAmount: 0.35, genres: ["trance", "idm"] },
    { name: "Punchy", desc: "tight kick, clear mids", eq: { low: 2, mid: -2, high: 1 }, drive: 1, width: 0.6, lowCut: 35, mbOn: true, mbAmount: 0.3, genres: ["techno", "acid-techno", "house", "edm"] },
    { name: "Warm", desc: "smooth, round, groovy", eq: { low: 2, mid: -1, high: 0 }, drive: 1, width: 0.65, lowCut: 25, mbOn: true, mbAmount: 0.3, genres: ["house", "deep-house", "garage", "synthwave"] },
    { name: "Tight", desc: "controlled, fast, clean", eq: { low: 1, mid: -2, high: 1 }, drive: 1, width: 0.55, lowCut: 35, mbOn: true, mbAmount: 0.35, genres: ["drum-and-bass", "jungle", "breakbeat"] },
    { name: "Heavy", desc: "deep sub, weight", eq: { low: 3, mid: -1, high: 1 }, drive: 2, width: 0.5, lowCut: 20, mbOn: true, mbAmount: 0.35, genres: ["dubstep"] },
    { name: "Mellow", desc: "dark, soft, relaxed", eq: { low: 1, mid: -1, high: -1 }, drive: 0, width: 0.65, lowCut: 0, mbOn: true, mbAmount: 0.15, genres: ["downtempo", "lo-fi"] },
    { name: "Spacious", desc: "very wide, minimal", eq: { low: 1, mid: -1, high: 1 }, drive: 0, width: 0.8, lowCut: 20, mbOn: true, mbAmount: 0.1, genres: ["ambient", "dub-techno"] },
    { name: "Crisp", desc: "bright, defined, present", eq: { low: 1, mid: -1, high: 2 }, drive: 2, width: 0.55, lowCut: 30, mbOn: true, mbAmount: 0.3, genres: ["trance", "psytrance", "electro"] },
    { name: "Loud", desc: "full, compressed, big", eq: { low: 2, mid: -1, high: 1 }, drive: 2, width: 0.65, lowCut: 25, mbOn: true, mbAmount: 0.4, genres: ["edm"] },
  ];
  const loadHeaderScene = (s: { eq: { low: number; mid: number; high: number }; drive: number; width: number; lowCut: number; mbOn: boolean; mbAmount: number }, sceneName?: string) => {
    setActiveScene(sceneName ?? (s as typeof HEADER_SCENES[0]).name ?? null);
    command({ type: "set_eq", ...s.eq } as ClientMessage);
    command({ type: "set_drive", db: s.drive } as ClientMessage);
    command({ type: "set_width", width: s.width } as ClientMessage);
    command({ type: "set_low_cut", freq: s.lowCut } as ClientMessage);
    command({ type: "set_multiband", on: s.mbOn } as ClientMessage);
    command({ type: "set_multiband_amount", amount: s.mbAmount } as ClientMessage);
    setShowScenePicker(false);
  };
  const getCurrentDrumsGenre = (): string | undefined => {
    if (!catalog) return undefined;
    const drumGenres = catalog.t8?.drum_genres ?? [];
    const drumsD = Object.values(state.devices).find(d => d.id === "preview_drums");
    return drumsD ? drumGenres[drumsD.genre_idx]?.name : undefined;
  };
  const applyAutoScene = () => {
    const genre = getCurrentDrumsGenre();
    const profile = genre ? GENRE_MIX_PROFILES[genre] : undefined;
    if (profile) {
      loadHeaderScene(profile, "Auto");
    } else {
      // fallback to Punchy
      loadHeaderScene(HEADER_SCENES.find(s => s.name === "Punchy")!, "Auto");
    }
  };
  useEffect(() => {
    if (!showMoreMenu) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".header-more-wrap")) setShowMoreMenu(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [showMoreMenu]);
  const [bottomTransport, setBottomTransport] = useState(getBottomTransportEnabled);
  const [volume, setVolume] = useState(0.7);
  const support = useSupportPrompt();
  const [scaleLock, setScaleLock] = useState(() => getItem("mpump-scale-lock", "chromatic"));
  const [soloChannel, setSoloChannel] = useState<"drums" | "bass" | "synth" | null>(null);
  const [kbdFocusDevice, setKbdFocusDevice] = useState<string | null>(null);
  const [showBpmModal, setShowBpmModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showDrumKitFromMixer, setShowDrumKitFromMixer] = useState(false);
  const [keyLocked, setKeyLocked] = useState(false);
  const [channelVolumes, setChannelVolumes] = useState<Record<number, number>>({ 9: 0.56, 0: 0.56, 1: 0.56 });
  const [antiClipMode, setAntiClipMode] = useState<"off" | "limiter" | "hybrid">("limiter");

  // Keep auto-save refs in sync (volume, channelVolumes, antiClipMode)
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { channelVolumesRef.current = channelVolumes; }, [channelVolumes]);
  useEffect(() => { antiClipModeRef.current = antiClipMode; }, [antiClipMode]);

  const [updateAvailable, setUpdateAvailable] = useState(false);
  const { showTutorial, dismissTutorial } = useTutorial();
  const [showHelp, setShowHelp] = useState(false);
  const [showSessionLib, setShowSessionLib] = useState(false);
  const [showJam, setShowJam] = useState(false);
  const jam = useJam();
  const jamReactions = useJamReactions();
  const jamEnabled = true;
  const pendingSyncSounds = useRef<{ dk?: string; sp?: string; bp?: string } | null>(null);
  const prevMuteState = useRef<string>("");
  const jamSyncedRef = useRef(false); // joiner: don't broadcast until sync received
  const pendingSyncPayload = useRef<string | null>(null);
  const jamApplyXYRef = useRef<((x: number, y: number, sender?: import("../hooks/useJam").PeerInfo) => void) | null>(null);
  const jamFxRef = useRef<{ setFx: React.Dispatch<React.SetStateAction<import("../types").EffectParams>>; setEffectOrder: React.Dispatch<React.SetStateAction<import("../types").EffectName[]>> } | null>(null);
  const [pendingMutes, setPendingMutes] = useState<Record<string, Set<string>>>({});
  const [genreLink, setGenreLink] = useState(false);
  const [showGenrePicker, setShowGenrePicker] = useState(false);

  // Genre-to-keyword map for matching sounds to genres
  const GENRE_KEYWORDS: Record<string, string[]> = {
    ambient: ["ambient", "chillout", "downtempo"],
    downtempo: ["downtempo", "lo-fi", "chillout", "chillhop"],
    "dub-techno": ["dub techno", "dub", "deep house", "minimal"],
    house: ["house", "deep house", "tech house"],
    garage: ["garage", "2-step", "uk garage"],
    electro: ["electro", "miami bass", "breakdance", "ebm", "synth-pop"],
    breakbeat: ["breakbeat", "old school", "hip-hop"],
    techno: ["techno", "tech house", "minimal", "industrial"],
    "acid-techno": ["acid techno", "acid house", "acid"],
    trance: ["trance", "psytrance", "progressive"],
    idm: ["idm", "experimental", "glitch"],
    glitch: ["glitch", "idm", "experimental"],
    edm: ["edm", "future bass", "progressive"],
    "drum-and-bass": ["dnb", "neurofunk", "liquid", "jungle"],
    jungle: ["jungle", "dnb", "breakbeat"],
  };
  const matchPreset = (presets: { name: string; genres?: string }[], genreName: string): number | null => {
    const kws = GENRE_KEYWORDS[genreName] || [genreName];
    const matches = presets.map((p, idx) => ({ p, idx })).filter(({ p }) => {
      const tags = (p.genres || "").toLowerCase();
      return kws.some(kw => tags.includes(kw.toLowerCase()));
    });
    return matches.length > 0 ? matches[Math.floor(Math.random() * matches.length)].idx : null;
  };

  /** Combined drum kit list: sample packs first, then presets. Returns value string for handleDrumKitChange. */
  const allDrumKits: { name: string; genres?: string; value: string }[] = [
    ...SAMPLE_PACKS.map(p => ({ name: p.name, genres: p.genres, value: `pack:${p.id}` })),
    ...DRUM_KIT_PRESETS.map((p, i) => ({ name: p.name, genres: p.genres, value: String(i) })),
  ];
  const matchDrumKit = (genreName: string): string | null => {
    const kws = GENRE_KEYWORDS[genreName] || [genreName];
    const matches = allDrumKits.filter(k => {
      const tags = (k.genres || "").toLowerCase();
      return kws.some(kw => tags.includes(kw.toLowerCase()));
    });
    return matches.length > 0 ? matches[Math.floor(Math.random() * matches.length)].value : null;
  };

  // Action bubbles: show who did what in jam mode
  interface ActionBubble { id: number; name: string; action: string; color: string; ts: number; x: number; y: number }
  const [actionBubbles, setActionBubbles] = useState<ActionBubble[]>([]);
  const nextBubbleId = useRef(0);
  const PEER_COLORS = ["#c8ffd9", "#ff6699", "#6699ff", "#ffcc66"];

  const peerListRef = useRef(jam.peerList);
  peerListRef.current = jam.peerList;

  /** Resolve which device section a command targets: drums/bass/synth/effects */
  const deviceToJam = (cmd: Record<string, unknown>): string | null => {
    const t = cmd.type as string;
    // Sound preset commands
    if (t === "jam_set_drum_kit") return "drums";
    if (t === "jam_set_bass") return "bass";
    if (t === "jam_set_synth") return "synth";
    // Effect commands
    if (t === "set_effect" || t === "set_effect_order") return "effects";
    // Device field
    const dev = cmd.device as string;
    if (dev?.includes("drums")) return "drums";
    if (dev?.includes("bass")) return "bass";
    if (dev?.includes("synth")) return "synth";
    // Channel-based commands: 9=drums, 1=bass, 0=synth
    const ch = cmd.channel as number;
    if (ch === 9) return "drums";
    if (ch === 1) return "bass";
    if (ch === 0) return "synth";
    return null;
  };

  const addActionBubble = useCallback((sender: import("../hooks/useJam").PeerInfo, action: string, cmd: Record<string, unknown>) => {
    const pl = peerListRef.current;
    const peerIdx = pl.findIndex(p => p.id === sender.id);
    const color = PEER_COLORS[peerIdx >= 0 ? peerIdx % PEER_COLORS.length : 0];
    const displayName = sender.name || `Peer ${peerIdx >= 0 ? peerIdx + 1 : "?"}`;
    const id = nextBubbleId.current++;

    // Find position — use device section, place bubble below it
    const jamTarget = deviceToJam(cmd);
    const cmdType = cmd.type as string;
    let el: Element | null = null;
    if (jamTarget) {
      el = document.querySelector(`[data-jam='${jamTarget}']`);
    }
    if (!el && cmdType === "set_bpm") {
      el = document.querySelector(".bpm-display");
    }
    if (!el) el = document.querySelector(".kaos-pad");

    const rect = el?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.bottom + 4 : 48;

    setActionBubbles(prev => [...prev.slice(-4), { id, name: displayName, action, color, ts: Date.now(), x, y }]);
    setTimeout(() => setActionBubbles(prev => prev.filter(b => b.id !== id)), 1500);
  }, []);
  const addActionBubbleRef = useRef(addActionBubble);
  addActionBubbleRef.current = addActionBubble;

  // Commands that should be bar-synced when quantize is on
  const BAR_SYNC_TYPES = new Set([
    "toggle_drums_mute", "toggle_bass_mute",
    "set_drums_mute", "set_bass_mute",
    "set_effect",
  ]);

  // Wrap command to broadcast to jam peers — all existing command() calls go through this
  const REMIX_DIRTY_TYPES = new Set(["set_bpm", "set_genre", "set_pattern", "set_synth_params", "set_bass_synth_params", "load_preset", "set_step", "set_drum_step", "set_effect", "set_effect_order", "set_swing", "toggle_drums_mute", "toggle_bass_mute", "set_drums_mute", "set_bass_mute"]);
  const command = useCallback((msg: ClientMessage) => {
    if (parentId && remixReadyRef.current && !remixDirty && REMIX_DIRTY_TYPES.has(msg.type)) setRemixDirty(true);
    // Don't broadcast until joiner has received sync from host
    if (jam.status === "connected" && !jamSyncedRef.current) {
      rawCommand(msg); // apply locally only
      return;
    }
    // When quantize is on and in a jam, queue mutes/effects to bar boundary
    if (jam.status === "connected" && jam.quantize && BAR_SYNC_TYPES.has(msg.type)) {
      jam.queueAtBar(msg);
      // Track pending state for immediate visual feedback
      if (msg.type === "toggle_drums_mute" || msg.type === "set_drums_mute") {
        const dev = (msg as { device: string }).device;
        setPendingMutes(prev => {
          const s = new Set(prev[dev] || []);
          s.add("drums_mute");
          return { ...prev, [dev]: s };
        });
      } else if (msg.type === "toggle_bass_mute" || msg.type === "set_bass_mute") {
        const dev = (msg as { device: string }).device;
        setPendingMutes(prev => {
          const s = new Set(prev[dev] || []);
          s.add("bass_mute");
          return { ...prev, [dev]: s };
        });
      }
      return; // don't apply yet — flushBarQueue will apply + broadcast at step 0
    }

    rawCommand(msg);
    // Convert toggle mutes to explicit set mutes for jam (toggles desync between peers)
    if (msg.type === "toggle_drums_mute" || msg.type === "toggle_bass_mute") {
      const dev = (msg as { device: string }).device;
      const ds = state.devices[dev];
      if (ds) {
        if (msg.type === "toggle_drums_mute") {
          jam.broadcastCommand({ type: "set_drums_mute", device: dev, muted: !ds.drumsMuted } as ClientMessage);
        } else {
          jam.broadcastCommand({ type: "set_bass_mute", device: dev, muted: !ds.bassMuted } as ClientMessage);
        }
      }
      return;
    }
    jam.broadcastCommand(msg);
  }, [rawCommand, jam.broadcastCommand, jam.status, jam.quantize, jam.queueAtBar, state.devices]);

  // Apply remote commands from jam peers
  useEffect(() => {
    jam.onRemoteCommand((msg: ClientMessage, sender?) => {
      rawCommand(msg); // apply directly, skip broadcast (prevents feedback loop)
      // Show action bubble for named peers
      if (sender) {
        const m2 = msg as Record<string, unknown>;
        const ACTION_LABELS: Record<string, string> = {
          set_genre: "genre", set_pattern: "pattern", set_bpm: "BPM", set_effect: "FX",
          set_drums_mute: "mute", set_bass_mute: "mute", set_swing: "swing",
          load_preset: "MIX", jam_set_drum_kit: "kit", jam_set_synth: "synth", jam_set_bass: "bass",
          set_effect_order: "FX chain", set_key: "key", set_octave: "octave",
          set_channel_volume: "vol", set_device_volume: "vol", set_volume: "vol",
          set_channel_pan: "pan", set_sidechain_duck: "duck", set_drive: "drive",
        };
        const label = ACTION_LABELS[m2.type as string];
        if (label) addActionBubbleRef.current(sender, label, m2);
      }
      // Also sync React state that the engine doesn't manage
      const m = msg as Record<string, unknown>;
      if (m.type === "set_channel_volume") {
        setChannelVolumes(prev => ({ ...prev, [m.channel as number]: m.volume as number }));
      } else if (m.type === "set_volume") {
        setVolume(m.volume as number);
      } else if (m.type === "set_effect" && jamFxRef.current) {
        const name = m.name as import("../types").EffectName;
        const params = m.params as Record<string, unknown>;
        jamFxRef.current.setFx(prev => ({ ...prev, [name]: { ...prev[name], ...params } }));
      } else if (m.type === "set_effect_order" && jamFxRef.current) {
        jamFxRef.current.setEffectOrder(m.order as import("../types").EffectName[]);
      }
    });
  }, [rawCommand, jam.onRemoteCommand]);

  // Apply remote play/stop state from jam peers
  useEffect(() => {
    jam.onPlayState((playing: boolean) => {
      for (const d of Object.values(stateRef.current.devices)) {
        const isPaused = d.paused;
        if (playing && isPaused) rawCommand({ type: "toggle_pause", device: d.id } as ClientMessage);
        else if (!playing && !isPaused) rawCommand({ type: "toggle_pause", device: d.id } as ClientMessage);
      }
    });
  }, [rawCommand, jam.onPlayState]);

  // Jam sync: host sends share payload to new joiners, joiner applies it
  useEffect(() => {
    // Host: register a function that builds the current share payload
    jam.setSharePayloadGetter(() => {
      try {
        const g: Record<string, { gi: number; pi: number; bgi?: number; bpi?: number }> = {};
        const mutes: Record<string, { drums: boolean; bass: boolean }> = {};
        const volumes: Record<string, number> = {};
        for (const d of Object.values(state.devices)) {
          g[d.id] = { gi: d.genre_idx, pi: d.pattern_idx, bgi: d.bass_genre_idx, bpi: d.bass_pattern_idx };
          mutes[d.id] = { drums: d.drumsMuted, bass: d.bassMuted };
          volumes[d.id] = d.deviceVolume;
        }
        return btoa(JSON.stringify({
          bpm: state.bpm, sw: state.swing, g, mutes, volumes,
          dk: activeDrumKitRef.current, sp: activeSynthRef.current, bp: activeBassRef.current,
        }));
      } catch { return null; }
    });

    // Joiner: apply received share payload (or store if devices not ready yet)
    jam.onSync((payload: string) => {
      const devices = Object.values(stateRef.current.devices).filter(d => d.connected);
      if (devices.length === 0) {
        console.log("[jam] sync received but no devices yet — deferring");
        pendingSyncPayload.current = payload;
        return;
      }
      applySyncPayload(payload);
      jamSyncedRef.current = true;
    });
  }, [jam, rawCommand, state]);

  // Bar-sync: flush queued actions at step 0 and apply + broadcast them
  useEffect(() => {
    jam.onBarFlush((msgs: ClientMessage[]) => {
      for (const msg of msgs) {
        rawCommand(msg);
        // Convert toggles to explicit for broadcast
        if (msg.type === "toggle_drums_mute" || msg.type === "toggle_bass_mute") {
          const dev = (msg as { device: string }).device;
          const ds = stateRef.current.devices[dev];
          if (ds) {
            if (msg.type === "toggle_drums_mute") {
              jam.broadcastCommand({ type: "set_drums_mute", device: dev, muted: !ds.drumsMuted } as ClientMessage);
            } else {
              jam.broadcastCommand({ type: "set_bass_mute", device: dev, muted: !ds.bassMuted } as ClientMessage);
            }
          }
        } else {
          jam.broadcastCommand(msg);
        }
      }
      setPendingMutes({}); // clear pending visual state after flush
    });
  }, [rawCommand, jam]);

  // Tick the bar queue on each step (drumsStep resolved later, use ref)
  const drumsStepRef = useRef(-1);

  // Apply remote XY pad movements from jam peers
  useEffect(() => {
    jam.onRemoteXY((x: number, y: number, sender) => {
      jamApplyXYRef.current?.(x, y, sender);
    });
  }, [jam.onRemoteXY]);

  // Receive reactions from jam peers
  useEffect(() => {
    jam.onReaction(jamReactions.handleRemoteReaction);
  }, [jam.onReaction, jamReactions.handleRemoteReaction]);

  // Force KAOS mode when jam/liveset connects (SYNTH disabled during jam)
  useEffect(() => {
    if (jam.status === "connected" && (previewMode === "synth" || (jam.role === "listener" && previewMode === "mixer"))) {
      setPreviewMode("kaos");
    }
  }, [jam.status, jam.role, previewMode]);

  // Apply a sync payload — extracted so it can be called immediately or deferred
  const applySyncPayload = useCallback((payload: string) => {
    try {
      const data = decodeSharePayload(payload) as any;
      if (data.bpm) rawCommand({ type: "set_bpm", bpm: data.bpm } as ClientMessage);
      if (data.sw != null) rawCommand({ type: "set_swing", swing: data.sw } as ClientMessage);
      if (data.g) {
        const genres: Record<string, { gi: number; pi: number; bgi?: number; bpi?: number }> = data.g;
        rawCommand({ type: "load_preset", bpm: data.bpm, genres } as unknown as ClientMessage);
      }
      if (data.mutes) {
        for (const [dev, m] of Object.entries(data.mutes as Record<string, { drums: boolean; bass: boolean }>)) {
          rawCommand({ type: "set_drums_mute", device: dev, muted: m.drums } as ClientMessage);
          rawCommand({ type: "set_bass_mute", device: dev, muted: m.bass } as ClientMessage);
        }
      }
      if (data.volumes) {
        for (const [dev, vol] of Object.entries(data.volumes as Record<string, number>)) {
          rawCommand({ type: "set_device_volume", device: dev, volume: vol } as ClientMessage);
        }
      }
      if (data.dk != null || data.sp != null || data.bp != null) {
        pendingSyncSounds.current = { dk: data.dk, sp: data.sp, bp: data.bp };
      }
      console.log("[jam] sync applied: bpm=" + data.bpm);
    } catch (e) { console.error("[jam] sync error:", e); }
  }, [rawCommand]);

  // Apply deferred sync once devices are connected — poll until devices exist
  useEffect(() => {
    if (!pendingSyncPayload.current) return;
    if (!anyConnected) return;
    const payload = pendingSyncPayload.current;
    pendingSyncPayload.current = null;
    let attempt = 0;
    const tryApply = () => {
      const devices = Object.values(stateRef.current.devices).filter(d => d.connected);
      if (devices.length > 0) {
        console.log("[jam] deferred sync applying (attempt " + attempt + ")");
        applySyncPayload(payload);
        // Delay enabling broadcast so React re-renders from sync don't trigger outbound commands
        setTimeout(() => { jamSyncedRef.current = true; }, 500);
        // Auto-play all paused devices
        for (const d of devices) {
          if (d.paused) rawCommand({ type: "toggle_pause", device: d.id } as ClientMessage);
        }
      } else if (attempt < 30) {
        attempt++;
        setTimeout(tryApply, 200);
      }
    };
    setTimeout(tryApply, 200);
  }, [anyConnected, applySyncPayload, rawCommand]);

  // Auto-join/create jam room from URL param + open modal
  const jamJoiningRef = useRef(false);
  const pendingJamRoomRef = useRef<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const jamRoom = params.get("jam");
    if (!jamRoom) return;
    if (jamRoom === "new") {
      setShowJam(true);
      return;
    } else {
      if (getBool("mpump-jam-identity", true)) {
        // Show modal so user can enter name before joining
        pendingJamRoomRef.current = jamRoom;
        setShowJam(true);
      } else {
        jamJoiningRef.current = true;
        jam.joinRoom(jamRoom);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear joining flag once connected
  useEffect(() => {
    if (jam.status === "connected") jamJoiningRef.current = false;
  }, [jam.status]);

  const [showTutorialManual, setShowTutorialManual] = useState(false);
  const logoClicksRef = useRef({ count: 0, timer: 0 });
  const [logoFlash, setLogoFlash] = useState(0);
  const [logoPulseMode, setLogoPulseMode] = useState(() => getItem("mpump-logo-pulse", "kick"));
  const logoGlowRef = useRef(0);
  const logoTransientRef = useRef(false);
  const logoRafRef = useRef(0);
  const logoPrevLevel = useRef(0);
  const [logoKick, setLogoKick] = useState(false);
  const handleLogoClick = () => {
    const lc = logoClicksRef.current;
    lc.count++;
    setLogoFlash(f => f + 1);
    window.clearTimeout(lc.timer);
    lc.timer = window.setTimeout(() => {
      if (lc.count >= 5) {
        setShowMegaKaos(true);
      } else if (lc.count === 4) {
        setShowAbout(true);
      } else if (lc.count === 3) {
        // Random theme
        const p = PALETTES[Math.floor(Math.random() * PALETTES.length)];
        setItem("mpump-palette", p.id);
        const root = document.documentElement;
        root.style.setProperty("--bg", p.bg);
        root.style.setProperty("--bg-panel", p.panel);
        root.style.setProperty("--bg-cell", p.cell);
        root.style.setProperty("--border", p.border);
        root.style.setProperty("--text", p.text);
        root.style.setProperty("--text-dim", p.dim);
        root.style.setProperty("--preview", p.preview);
        root.style.setProperty("--fg", p.text);
        root.style.setProperty("--fg-dim", p.dim);
        document.body.style.background = p.bg;
        document.body.style.color = p.text;
      } else if (lc.count === 2) {
        // Cycle logo pulse mode
        const modes = ["audio", "kick", "off"];
        const next = modes[(modes.indexOf(logoPulseMode) + 1) % modes.length];
        setLogoPulseMode(next);
        setItem("mpump-logo-pulse", next);
      }
      // 1 click = just the flash animation (already triggered)
      lc.count = 0;
    }, 500);
  };
  const [cvEnabled, setCvEnabled] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareQrUrl, setShareQrUrl] = useState<string | null>(null);
  const [shareGestureNote, setShareGestureNote] = useState(false);
  const [parentId, setParentId] = useState<string | null>(() => getParentId());

  // Contextual hints — shown once per view for first 3 sessions
  const HINT_TEXTS: Record<PreviewMode, string> = {
    kaos: "XY pad shapes the sound · effects below, hold to edit",
    synth: "Tap grid to edit · browse genres and patterns · sounds in the dropdowns",
    mixer: "Per-channel volume, EQ, pan · 🎛 for mix scenes",
  };
  const hintSessionCount = parseInt(getItem("mpump-hint-sessions", "0"));
  const [hintDismissed, setHintDismissed] = useState<Set<string>>(() => new Set(getJSON("mpump-hints-seen", [])));
  const showHint = isPreview && hintSessionCount < 3 && !hintDismissed.has(previewMode);
  useEffect(() => {
    const count = parseInt(getItem("mpump-hint-sessions", "0"));
    setItem("mpump-hint-sessions", String(count + 1));
  }, []);
  const dismissHint = () => {
    const updated = new Set(hintDismissed);
    updated.add(previewMode);
    setHintDismissed(updated);
    setJSON("mpump-hints-seen", [...updated]);
  };
  const [remixCopied, setRemixCopied] = useState(false);
  const [remixDirty, setRemixDirty] = useState(false);
  const remixReadyRef = useRef(false);
  useEffect(() => { if (parentId) { const t = setTimeout(() => { remixReadyRef.current = true; }, 3000); return () => clearTimeout(t); } }, [parentId]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showMegaKaos, setShowMegaKaos] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showSessionExport, setShowSessionExport] = useState(false);
  const [mixFx, setMixFx] = useState<"shake" | "flash" | "both" | "">("");
  const [activeDrumKit, setActiveDrumKit] = useState("0");
  const [activeSynth, setActiveSynth] = useState("0");
  const [activeBass, setActiveBass] = useState("0");
  useEffect(() => { activeDrumKitRef.current = activeDrumKit; }, [activeDrumKit]);
  useEffect(() => { activeSynthRef.current = activeSynth; }, [activeSynth]);
  useEffect(() => { activeBassRef.current = activeBass; }, [activeBass]);
  const [soundLock, setSoundLock] = useState<{ drums: boolean; synth: boolean; bass: boolean }>({ drums: false, synth: false, bass: false });
  const [patternLock, setPatternLock] = useState<{ drums: boolean; synth: boolean; bass: boolean }>({ drums: false, synth: false, bass: false });
  const [stepPatternLock, setStepPatternLock] = useState<{ drums: boolean; synth: boolean; bass: boolean }>({ drums: false, synth: false, bass: false });
  const [songModeOn, setSongModeOn] = useState(getSongModeEnabled);

  // Ableton Link Bridge — runs at Layout level so it works even when Settings is closed
  const [linkConnected, setLinkConnected] = useState(false);
  useEffect(() => {
    // Link Bridge off by default — users enable via Settings
    enableLinkBridge(getBool("mpump-link-bridge", false));
    let prevLinkBpm = 0;
    let prevLinkPlaying: boolean | null = null;
    const unsub = onLinkState((s) => {
      setLinkConnected(s.connected);
      if (s.connected && s.tempo >= 20 && s.tempo <= 300) {
        const rounded = Math.round(s.tempo);
        if (rounded !== prevLinkBpm) {
          prevLinkBpm = rounded;
          command({ type: "set_bpm", bpm: rounded });
        }
        // Sync play/stop — only react to changes
        if (prevLinkPlaying !== null && s.playing !== prevLinkPlaying) {
          const devices = Object.values(stateRef.current.devices).filter(d => d.connected);
          for (const d of devices) {
            if (s.playing && d.paused) command({ type: "toggle_pause", device: d.id });
            else if (!s.playing && !d.paused) command({ type: "toggle_pause", device: d.id });
          }
        }
        prevLinkPlaying = s.playing;
      }
    });
    return unsub;
  }, [command]);
  // Push local BPM changes to Link so peers stay in sync
  const prevLocalBpm = useRef(0);
  useEffect(() => {
    if (linkConnected && state.bpm !== prevLocalBpm.current) {
      prevLocalBpm.current = state.bpm;
      sendLinkTempo(state.bpm);
    }
  }, [state.bpm, linkConnected]);
  const mixHistoryRef = useRef<Array<{ bpm: number; genres: Record<string, { gi: number; pi: number; bgi: number; bpi: number }>; dk: string; sp: string; bp: string }>>([]);
  const mixCountRef = useRef(1);
  const [mixCount, setMixCount] = useState(0);
  const mixBpmCountRef = useRef(0);
  const GENRE_LIST = ["techno","acid-techno","trance","dub-techno","idm","edm","drum-and-bass","house","breakbeat","jungle","garage","ambient","glitch","electro","downtempo"];
  const [genreLock, setGenreLock] = useState<string | null>(null);
  const genreLockName = genreLock ?? GENRE_LIST[0];
  const sessionStartRef = useRef(Date.now());
  const [sessionMin, setSessionMin] = useState(0);

  // Listen for logo pulse setting changes
  useEffect(() => {
    const handler = () => setLogoPulseMode(getItem("mpump-logo-pulse", "kick"));
    window.addEventListener("mpump-settings-changed", handler);
    return () => window.removeEventListener("mpump-settings-changed", handler);
  }, []);

  // Logo audio pulse — bass glow + transient flash
  const logoRef = useRef<HTMLPreElement>(null);
  // Logo audio pulse removed — kick mode is zero-cost and syncs better with the beat

  // Logo kick pulse — flash on actual kick hits (note 36)
  const drumsDevice2 = connectedDevices.find(d => d.id === "preview_drums");
  const drumsStep = drumsDevice2?.step ?? -1;
  drumsStepRef.current = drumsStep;
  const drumsMuted = drumsDevice2?.drumsMuted ?? false;
  const drumData = drumsDevice2?.drum_data;
  const prevStepRef = useRef(-1);
  useEffect(() => {
    if (logoPulseMode !== "kick") { setLogoKick(false); return; }
    if (drumsMuted || drumsStep < 0 || !drumData) { setLogoKick(false); return; }
    if (drumsStep !== prevStepRef.current) {
      prevStepRef.current = drumsStep;
      const hasKick = drumData[drumsStep]?.some(h => h.note === 36);
      if (hasKick) {
        setLogoKick(true);
        const t = setTimeout(() => setLogoKick(false), 100);
        return () => clearTimeout(t);
      } else {
        setLogoKick(false);
      }
    }
  }, [logoPulseMode, drumsStep, drumsMuted, drumData]);

  // Jam bar-sync: flush queued actions at step 0
  const prevBarStepRef = useRef(-1);
  useEffect(() => {
    if (jam.status === "connected" && jam.quantize && drumsStep === 0 && prevBarStepRef.current !== 0) {
      jam.flushBarQueue(0);
    }
    prevBarStepRef.current = drumsStep;
  }, [drumsStep, jam]);

  // Keyboard shortcuts (preview mode only)
  const toggleAllPauseRef = useRef<() => void>(() => {});
  const isListener = jam.status === "connected" && jam.role === "listener";
  const presetNav = useMemo(() => ({
    cycleSynth: (dir: number) => { const n = Math.max(0, Math.min(SYNTH_PRESETS.length - 1, parseInt(activeSynth) + dir)); handleSynthChange(String(n)); },
    cycleBass: (dir: number) => { const n = Math.max(0, Math.min(BASS_PRESETS.length - 1, parseInt(activeBass) + dir)); handleBassChange(String(n)); },
    cycleDrumKit: (dir: number) => { const all = [...SAMPLE_PACKS.map(p => `pack:${p.id}`), ...DRUM_KIT_PRESETS.map((_, i) => String(i))]; const idx = all.indexOf(activeDrumKit); const next = (idx + dir + all.length) % all.length; handleDrumKitChange(all[next]); },
  }), [activeSynth, activeBass, activeDrumKit]); // eslint-disable-line react-hooks/exhaustive-deps
  const keyActionsRef = useRef<{ toggleLock: (deviceId: string) => void; doMix: () => void; toggleSolo: (ch: "drums" | "bass" | "synth") => void; openBpm: () => void }>({ toggleLock: () => {}, doMix: () => {}, toggleSolo: () => {}, openBpm: () => {} });
  const keyActions = useMemo(() => ({
    toggleLock: (deviceId: string) => keyActionsRef.current.toggleLock(deviceId),
    doMix: () => keyActionsRef.current.doMix(),
    toggleSolo: (ch: "drums" | "bass" | "synth") => keyActionsRef.current.toggleSolo(ch),
    openBpm: () => keyActionsRef.current.openBpm(),
  }), []);
  const keyboardCapture = !!kbdFocusDevice && /:(play|rec)$/.test(kbdFocusDevice);
  useKeyboard(state, command, !!isPreview && !isListener, isListener ? undefined : () => toggleAllPauseRef.current(), keyboardCapture, kbdFocusDevice, presetNav, setKbdFocusDevice, keyActions);

  // Session timer — update every minute
  useEffect(() => {
    const id = setInterval(() => setSessionMin(Math.floor((Date.now() - sessionStartRef.current) / 60000)), 60000);
    return () => clearInterval(id);
  }, []);

  // Number keys switch preview mode
  useEffect(() => {
    if (!isPreview) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      if (keyboardCapture && !e.metaKey && !e.ctrlKey) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveToLibrary();
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        setPreviewMode(prev => {
          const modes: PreviewMode[] = ["kaos", "synth", "mixer"];
          return modes[(modes.indexOf(prev) + (e.shiftKey ? -1 + modes.length : 1)) % modes.length];
        });
        return;
      }
      switch (e.key) {
        case "1": setPreviewMode("kaos"); break;
        case "2": setPreviewMode("synth"); break;
        case "3": setPreviewMode("mixer"); break;
        case "?": setShowHelp(true); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isPreview, keyboardCapture]);

  // Load state from URL query (?b=) or legacy hash (#) on mount
  useEffect(() => {
    if (!isPreview || !anyConnected) return;
    const params = new URLSearchParams(window.location.search);
    // URLSearchParams decodes + as space; restore for base64
    const hash = (params.get("z") || params.get("b") || "").replace(/ /g, "+") || window.location.hash.slice(1);
    if (!hash) return;
    let tid: number;
    try {
      const raw = decodeSharePayload(hash) as any;
      const data = validateSharePayload(raw);
      if (!data) {
        console.warn("[mpump] Invalid share link payload — ignoring", raw);
        alert("This share link appears to be invalid or corrupted.");
        window.history.replaceState(null, "", window.location.pathname);
        return;
      }
      tid = window.setTimeout(() => {
        const genres: Record<string, { gi: number; pi: number; bgi: number; bpi: number }> = {};
        for (const [k, v] of Object.entries(data.g)) genres[k] = { gi: v.gi, pi: v.pi, bgi: v.bgi ?? 0, bpi: v.bpi ?? 0 };
        command({ type: "load_preset", bpm: data.bpm, genres });
        if (data.sw != null) command({ type: "set_swing", swing: data.sw });
        if (data.dk != null) handleDrumKitChange(data.dk);
        if (data.sp != null) handleSynthChange(data.sp);
        if (data.bp != null) handleBassChange(data.bp);
        // Restore key and octave from share link
        if (data.ki != null) { command({ type: "set_key", device: "preview_synth", idx: data.ki }); command({ type: "set_key", device: "preview_bass", idx: data.ki }); }
        if (data.oc != null) { command({ type: "set_octave", device: "preview_synth", octave: data.oc }); command({ type: "set_octave", device: "preview_bass", octave: data.oc }); }
        if (data.fx) {
          for (let i = 0; i < EFFECT_ORDER.length && i < data.fx.length; i++) {
            if (data.fx[i] === "1") {
              command({ type: "set_effect", name: EFFECT_ORDER[i], params: { on: true } });
            }
          }
        }
        if (data.eo) {
          setJSON("mpump-effect-order", data.eo);
          command({ type: "set_effect_order", order: data.eo });
        }
        // Restore full effect params
        if (data.fp) {
          for (const [name, params] of Object.entries(data.fp)) {
            command({ type: "set_effect", name: name as EffectName, params: params as Record<string, unknown> });
          }
          setJSON("mpump-effects", { ...getJSON("mpump-effects", {}), ...Object.fromEntries(Object.entries(data.fp).map(([n, p]) => [n, { ...p, on: data.fx ? data.fx[EFFECT_ORDER.indexOf(n as EffectName)] === "1" : false }])) });
        }
        // Also write on/off states for effects without full params
        if (data.fx && !data.fp) {
          const saved = getJSON<Record<string, Record<string, unknown>>>("mpump-effects", {});
          for (let i = 0; i < EFFECT_ORDER.length && i < data.fx.length; i++) {
            const n = EFFECT_ORDER[i];
            saved[n] = { ...(saved[n] ?? {}), on: data.fx[i] === "1" };
          }
          setJSON("mpump-effects", saved);
        }
        // Notify KaosPanel to re-read effects from localStorage
        window.dispatchEvent(new Event("mpump-effects-restored"));
        // Restore synth params (decode compact short keys back to full names)
        if (data.spp) command({ type: "set_synth_params", device: "preview_synth", params: decodeSynthParamsCompact(data.spp) });
        if (data.bpp) command({ type: "set_synth_params", device: "preview_bass", params: decodeSynthParamsCompact(data.bpp) });
        // Restore gesture
        if (data.gs) {
          const points = decodeGesture(data.gs);
          if (points.length > 0) setJSON("mpump-gesture", points);
        }
        if (data.me) {
          decodeSteps(data.me).forEach((s, i) => command({ type: "edit_step", device: "preview_synth", step: i, data: s }));
        }
        if (data.de) {
          decodeDrumSteps(data.de).forEach((hits, i) => command({ type: "edit_drum_step", device: "preview_drums", step: i, hits }));
        }
        if (data.be) {
          decodeSteps(data.be).forEach((s, i) => command({ type: "edit_step", device: "preview_bass", step: i, data: s }));
        }
        // Restore channel volumes
        if (data.cv) {
          const [dv, bv, sv] = data.cv.split(",").map(Number);
          if (Number.isFinite(dv)) { command({ type: "set_channel_volume", channel: 9, volume: dv / 100 }); setChannelVolumes(prev => ({ ...prev, 9: dv / 100 })); }
          if (Number.isFinite(bv)) { command({ type: "set_channel_volume", channel: 1, volume: bv / 100 }); setChannelVolumes(prev => ({ ...prev, 1: bv / 100 })); }
          if (Number.isFinite(sv)) { command({ type: "set_channel_volume", channel: 0, volume: sv / 100 }); setChannelVolumes(prev => ({ ...prev, 0: sv / 100 })); }
        }
        // Restore mixer settings (master EQ, drive, width, lowCut, multiband)
        if (data.meq) {
          const [l, m, h] = data.meq.split(",").map(Number);
          if (Number.isFinite(l)) command({ type: "set_eq", low: l, mid: m ?? 0, high: h ?? 0 } as ClientMessage);
        }
        if (data.drv != null) command({ type: "set_drive", db: data.drv } as ClientMessage);
        if (data.wid != null) command({ type: "set_width", width: data.wid / 100 } as ClientMessage);
        if (data.lc != null) command({ type: "set_low_cut", freq: data.lc } as ClientMessage);
        if (data.mb === 0) command({ type: "set_multiband", on: false } as ClientMessage);
        if (data.mba != null) command({ type: "set_multiband_amount", amount: data.mba / 100 } as ClientMessage);
        // Restore mute states
        if (data.mu && data.mu.length === 3) {
          if (data.mu[0] === "1") command({ type: "set_drums_mute", device: "preview_drums", muted: true });
          if (data.mu[1] === "1") command({ type: "set_bass_mute", device: "preview_bass", muted: true });
          if (data.mu[2] === "1") command({ type: "set_drums_mute", device: "preview_synth", muted: true });
        }
        // Ensure music is playing after share link loads
        for (const d of connectedDevices) {
          if (d.paused) command({ type: "toggle_pause", device: d.id });
        }
      }, 300);
      window.location.hash = "";
    } catch { /* invalid hash */ }
    return () => window.clearTimeout(tid);
  }, [isPreview, anyConnected]);


  // Match initial engine params to preset indices when devices connect
  useEffect(() => {
    const synth = connectedDevices.find(d => d.id === "preview_synth");
    const drums = connectedDevices.find(d => d.id === "preview_drums");
    if (synth?.synthParams) {
      const idx = SYNTH_PRESETS.findIndex(p => p.params.oscType === synth.synthParams?.oscType && Math.abs(p.params.cutoff - (synth.synthParams?.cutoff ?? 0)) < 1);
      if (idx >= 0) setActiveSynth(String(idx));
    }
    if (drums?.bassSynthParams) {
      const idx = BASS_PRESETS.findIndex(p => p.params.oscType === drums.bassSynthParams?.oscType && Math.abs(p.params.cutoff - (drums.bassSynthParams?.cutoff ?? 0)) < 1);
      if (idx >= 0) setActiveBass(String(idx));
    }
  }, [connectedDevices.length]); // only on connect, not every render

  // Listen for song mode / visual fx settings changes
  useEffect(() => {
    const handler = () => setSongModeOn(getSongModeEnabled());
    window.addEventListener("mpump-settings-changed", handler);
    return () => window.removeEventListener("mpump-settings-changed", handler);
  }, []);

  // Listen for bottom transport setting changes
  useEffect(() => {
    const handler = () => setBottomTransport(getBottomTransportEnabled());
    window.addEventListener("mpump-settings-changed", handler);
    return () => window.removeEventListener("mpump-settings-changed", handler);
  }, []);

  // Send initial settings to engine when devices connect
  useEffect(() => {
    if (!anyConnected || !isPreview) return;
    command({ type: "set_volume", volume });
    for (const [ch, v] of Object.entries(channelVolumes)) {
      command({ type: "set_channel_volume", channel: Number(ch), volume: v });
    }
    // Sync humanize/sidechain with localStorage (humanize on by default)
    const humanize = getItem("mpump-humanize") === "" ? true : getBool("mpump-humanize");
    const sidechain = getBool("mpump-sidechain");
    const mono = getBool("mpump-mono");
    command({ type: "set_humanize", on: humanize });
    command({ type: "set_sidechain_duck", on: sidechain });
    if (mono) command({ type: "set_mono", on: true });
    // Set localStorage if first visit so UI matches
    if (getItem("mpump-humanize") === "") setBool("mpump-humanize", true);
    if (getItem("mpump-wave-tap") === "") setBool("mpump-wave-tap", true);
    // Restore effect chain order
    const savedOrder = getJSON<import("../types").EffectName[] | null>("mpump-effect-order", null);
    if (savedOrder) command({ type: "set_effect_order", order: savedOrder });
    // Apply default "Punchy" scene
    const punchy = HEADER_SCENES.find(s => s.name === "Punchy");
    if (punchy) {
      command({ type: "set_low_cut", freq: punchy.lowCut } as ClientMessage);
      command({ type: "set_multiband_amount", amount: punchy.mbAmount } as ClientMessage);
    }
  }, [anyConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check for app updates every 5 minutes
  useEffect(() => {
    const check = () => {
      fetch("version.json", { cache: "no-store" })
        .then(r => r.json())
        .then(data => { if (data.v && data.v !== __APP_VERSION__) setUpdateAvailable(true); })
        .catch(() => {});
    };
    check();
    const id = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const drumsDevice = connectedDevices.find(d => d.id === "preview_drums");

  // Preset handler functions
  // Apply a drum kit locally without broadcasting (used by both local change and remote receive)
  const applyDrumKit = useCallback((val: string) => {
    setActiveDrumKit(val);
    if (val.startsWith("pack:")) {
      const pack = SAMPLE_PACKS.find(p => p.id === val.slice(5));
      if (pack) for (const [n, p] of Object.entries(pack.voices)) rawCommand({ type: "set_drum_voice", note: Number(n), params: p });
    } else {
      const preset = DRUM_KIT_PRESETS[parseInt(val)];
      if (preset) for (const [n, p] of Object.entries(preset.voices)) rawCommand({ type: "set_drum_voice", note: Number(n), params: p });
    }
  }, [rawCommand]);

  const applySynth = useCallback((val: string) => {
    setActiveSynth(val);
    const p = SYNTH_PRESETS[parseInt(val)];
    if (p) rawCommand({ type: "set_synth_params", device: "preview_synth", params: { ...p.params, unison: p.params.unison ?? 1, unisonSpread: p.params.unisonSpread ?? 0, filterEnvDepth: p.params.filterEnvDepth ?? 0 } } as ClientMessage);
  }, [rawCommand]);

  const applyBass = useCallback((val: string) => {
    setActiveBass(val);
    const p = BASS_PRESETS[parseInt(val)];
    if (p) rawCommand({ type: "set_synth_params", device: "preview_bass", params: { ...p.params, unison: p.params.unison ?? 1, unisonSpread: p.params.unisonSpread ?? 0, filterEnvDepth: p.params.filterEnvDepth ?? 0 } } as ClientMessage);
  }, [rawCommand]);

  // User-facing handlers: apply locally + broadcast preset ID to peers
  const handleDrumKitChange = (val: string) => {
    applyDrumKit(val);
    jam.broadcastCommand({ type: "jam_set_drum_kit", id: val } as unknown as ClientMessage);
  };
  const handleSynthChange = (val: string) => {
    applySynth(val);
    jam.broadcastCommand({ type: "jam_set_synth", id: val } as unknown as ClientMessage);
  };
  const handleBassChange = (val: string) => {
    applyBass(val);
    jam.broadcastCommand({ type: "jam_set_bass", id: val } as unknown as ClientMessage);
  };

  // Handle remote sound preset changes — apply locally only (no re-broadcast)
  useEffect(() => {
    jam.onSoundChange((type: string, id: string, sender?) => {
      console.log("[jam] remote sound change:", type, id);
      if (type === "jam_set_drum_kit") applyDrumKit(id);
      else if (type === "jam_set_synth") applySynth(id);
      else if (type === "jam_set_bass") applyBass(id);
      if (sender) {
        const labels: Record<string, string> = { jam_set_drum_kit: "kit", jam_set_synth: "synth", jam_set_bass: "bass" };
        addActionBubbleRef.current(sender, labels[type] || "sound", { type } as Record<string, unknown>);
      }
    });
  }, [jam, applyDrumKit, applySynth, applyBass]);

  // Apply pending sound presets from jam sync (deferred until apply functions are available)
  useEffect(() => {
    const p = pendingSyncSounds.current;
    if (!p) return;
    pendingSyncSounds.current = null;
    if (p.dk != null) applyDrumKit(p.dk);
    if (p.sp != null) applySynth(p.sp);
    if (p.bp != null) applyBass(p.bp);
  }, [applyDrumKit, applySynth, applyBass]);

  const presetState = { activeDrumKit, activeSynth, activeBass, onDrumKitChange: handleDrumKitChange, onSynthChange: handleSynthChange, onBassChange: handleBassChange, soundLock, setSoundLock, patternLock, setPatternLock, stepPatternLock, setStepPatternLock };

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    command({ type: "set_volume", volume: v });
  };

  const handleChannelVolumeChange = (ch: number, v: number) => {
    setChannelVolumes(prev => ({ ...prev, [ch]: v }));
    command({ type: "set_channel_volume", channel: ch, volume: v });
  };


  // Wrap command to intercept anti-clip mode changes for local state sync
  const wrappedCommand = (msg: Parameters<typeof command>[0]) => {
    if (msg.type === "set_anti_clip") setAntiClipMode(msg.mode);
    command(msg);
  };

  const handleExportSession = () => {
    heavyVibrate();
    setShowSessionExport(true);
  };

  const doExportSession = (filename: string) => {
    const session = exportSession(state, volume, channelVolumes, { activeDrumKit, activeSynth, activeBass }, antiClipMode);
    // Override the default name in downloadSession by setting it on the session object
    downloadSession(session, filename.endsWith(".json") ? filename : `${filename}.json`);
  };

  const applySession = useCallback((session: SessionData) => {
    // Restore BPM and swing
    command({ type: "set_bpm", bpm: session.bpm });
    if (session.swing) command({ type: "set_swing", swing: session.swing });
    // Restore volumes
    setVolume(session.masterVolume ?? 0.5);
    command({ type: "set_volume", volume: session.masterVolume ?? 0.5 });
    if (session.channelVolumes) {
      setChannelVolumes(session.channelVolumes);
      for (const [ch, v] of Object.entries(session.channelVolumes)) {
        command({ type: "set_channel_volume", channel: Number(ch), volume: v });
      }
    }
    // Restore genres/patterns
    const genres: Record<string, { gi: number; pi: number; bgi: number; bpi: number }> = {};
    for (const [id, d] of Object.entries(session.devices)) {
      genres[id] = { gi: d.genre_idx, pi: d.pattern_idx, bgi: d.bass_genre_idx, bpi: d.bass_pattern_idx };
    }
    command({ type: "load_preset", bpm: session.bpm, genres });
    // Restore edited pattern data (overrides catalog patterns with saved edits)
    for (const [id, d] of Object.entries(session.devices)) {
      if (d.pattern_data || d.drum_data || d.bass_data) {
        try {
          command({ type: "bulk_set_pattern", device: id, pattern_data: d.pattern_data as any, drum_data: d.drum_data as any, bass_data: d.bass_data as any });
        } catch (e) { console.warn("Failed to restore pattern for", id, e); }
      }
    }
    // Restore sound presets (index first, then override with saved params if tweaked)
    if (session.activeDrumKit) handleDrumKitChange(session.activeDrumKit);
    if (session.activeSynth) handleSynthChange(session.activeSynth);
    if (session.activeBass) handleBassChange(session.activeBass);
    // Restore per-device synth params (captures knob tweaks beyond preset defaults)
    for (const [id, d] of Object.entries(session.devices)) {
      try {
        if (d.synthParams) command({ type: "set_synth_params", device: id, params: d.synthParams as Record<string, unknown> });
      } catch (e) { console.warn("Failed to restore synth params for", id, e); }
    }
    // Restore effects
    if (session.effects) {
      setJSON("mpump-effects", session.effects);
      for (const [name, params] of Object.entries(session.effects)) {
        command({ type: "set_effect", name: name as import("../types").EffectName, params: params as Record<string, unknown> });
      }
    }
    // Restore settings
    if (session.antiClipMode) {
      setAntiClipMode(session.antiClipMode as typeof antiClipMode);
      command({ type: "set_anti_clip", mode: session.antiClipMode as typeof antiClipMode });
    }
    if (session.effectOrder) { setJSON("mpump-effect-order", session.effectOrder); command({ type: "set_effect_order", order: session.effectOrder as import("../types").EffectName[] }); }
    if (session.scaleLock) { setItem("mpump-scale-lock", session.scaleLock); setScaleLock(session.scaleLock); }
    if (session.humanize) { setBool("mpump-humanize", true); command({ type: "set_humanize", on: true }); }
    if (session.sidechainDuck) { setBool("mpump-sidechain", true); command({ type: "set_sidechain_duck", on: true }); }
    if (session.metronome) { setBool("mpump-metronome", true); command({ type: "set_metronome", on: true }); }
    if (session.arpMode && session.arpMode !== "off") {
      setItem("mpump-arp-mode", session.arpMode);
      setItem("mpump-arp-rate", session.arpRate ?? "1/8");
      command({ type: "set_arp", enabled: true, mode: session.arpMode as import("../types").ArpMode, rate: (session.arpRate ?? "1/8") as import("../types").ArpRate });
    }
    if (session.gesture?.length) setJSON("mpump-gesture", session.gesture);
    if (session.palette) {
      setItem("mpump-palette", session.palette);
      const p = PALETTES.find(p => p.id === session.palette);
      if (p) applyPalette(p);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command]);

  const handleImportSession = async (file: File) => {
    try {
      const session = await readSessionFile(file);
      applySession(session);
      trackEvent("session-import");
    } catch (e) {
      console.error("Failed to import session:", e);
    }
  };

  // Save current state to the session library
  const saveBtnRef = useRef<HTMLButtonElement>(null);
  const saveToLibrary = useCallback(() => {
    const session = exportSession(
      stateRef.current,
      volumeRef.current,
      channelVolumesRef.current,
      { activeDrumKit: activeDrumKitRef.current, activeSynth: activeSynthRef.current, activeBass: activeBassRef.current },
      antiClipModeRef.current,
    );
    const name = getItem("mpump-track-name", "") || "Untitled";
    saveSession(`${name} · ${stateRef.current.bpm} BPM`, session);
    // Also update autosave + last-session so Continue works immediately after save
    setJSON("mpump-autosave", session);
    saveLastSession(session, name);
    // Blink all save buttons
    document.querySelectorAll(".header-save-btn, .header-save-mobile").forEach(el => {
      el.classList.remove("blink");
      void (el as HTMLElement).offsetWidth;
      el.classList.add("blink");
    });
  }, []);

  // Build the current share payload object
  const buildSharePayload = useCallback(() => {
    const g: Record<string, { gi: number; pi: number; bgi?: number; bpi?: number }> = {};
    const cd = Object.values(stateRef.current.devices).filter(d => d.connected);
    for (const d of cd) g[d.id] = { gi: d.genre_idx, pi: d.pattern_idx, bgi: d.bass_genre_idx, bpi: d.bass_pattern_idx };
    const synthDev2 = cd.find(d => d.id === "preview_synth");
    const base: Record<string, unknown> = {
      bpm: stateRef.current.bpm, sw: stateRef.current.swing, dk: activeDrumKitRef.current, sp: activeSynthRef.current, bp: activeBassRef.current, g,
      tn: getItem("mpump-track-name", "mix"),
      ki: synthDev2?.key_idx ?? 0, oc: synthDev2?.octave ?? 2,
    };
    const synthDev = cd.find(d => d.id === "preview_synth");
    const bassDev = cd.find(d => d.id === "preview_bass");
    if (synthDev?.synthParams) base.spp = encodeSynthParamsCompact(synthDev.synthParams as unknown as Record<string, unknown>);
    if (bassDev?.synthParams) base.bpp = encodeSynthParamsCompact(bassDev.synthParams as unknown as Record<string, unknown>);
    const drumsDev = cd.find(d => d.id === "preview_drums");
    const muBits = `${drumsDev?.drumsMuted ? "1" : "0"}${bassDev?.drumsMuted ? "1" : "0"}${synthDev?.drumsMuted ? "1" : "0"}`;
    if (muBits !== "000") base.mu = muBits;
    const cv = `${Math.round((channelVolumesRef.current[9] ?? 0.7) * 100)},${Math.round((channelVolumesRef.current[1] ?? 0.7) * 100)},${Math.round((channelVolumesRef.current[0] ?? 0.7) * 100)}`;
    if (cv !== "70,70,70") base.cv = cv;
    if (getMixerState) {
      const mx = getMixerState();
      const meq = `${mx.eq.low},${mx.eq.mid},${mx.eq.high}`;
      if (meq !== "1,0,0") base.meq = meq;
      if (mx.drive !== 0) base.drv = mx.drive;
      if (mx.width !== 0.5) base.wid = Math.round(mx.width * 100);
      if (mx.lowCut > 0) base.lc = mx.lowCut;
      if (!mx.mbOn) base.mb = 0;
    }
    const fx = { ...JSON.parse(JSON.stringify(DEFAULT_EFFECTS)), ...getJSON<Partial<EffectParams>>("mpump-effects", {}) } as EffectParams;
    const fxBits = EFFECT_ORDER.map(n => (fx as unknown as Record<string, { on: boolean }>)[n]?.on ? "1" : "0").join("");
    if (fxBits !== "0000000000") base.fx = fxBits;
    const fxOn: Record<string, Record<string, unknown>> = {};
    for (const n of EFFECT_ORDER) {
      const ep = (fx as unknown as Record<string, Record<string, unknown>>)[n];
      if (ep?.on) { const { on: _, ...params } = ep; fxOn[n] = params; }
    }
    if (Object.keys(fxOn).length > 0) base.fp = fxOn;
    const eo = getJSON<EffectName[]>("mpump-effect-order", EFFECT_ORDER);
    if (JSON.stringify(eo) !== JSON.stringify(EFFECT_ORDER)) base.eo = eo;
    for (const d of cd) {
      if (!d.editing) continue;
      if (d.mode === "synth") base.me = encodeSteps(d.pattern_data);
      if (d.mode === "drums" || d.mode === "drums+bass") base.de = encodeDrumSteps(d.drum_data);
      if (d.mode === "bass") base.be = encodeSteps(d.pattern_data);
      if (d.mode === "drums+bass") base.be = encodeSteps(d.bass_data);
    }
    if (parentId) base.p = parentId;
    return base;
  }, [parentId, getMixerState]);

  // Quick-share remix: build link, shorten, copy to clipboard in one tap
  const quickShareRemix = useCallback(async () => {
    const base = buildSharePayload();
    const shareLink = buildShareUrl(base);
    let url = shareLink;
    try {
      const up = await checkRelayHealth();
      if (up) {
        const result = await shortenBeat(shareLink, parentId ?? undefined);
        if (result) url = result.short;
      }
    } catch { /* use long URL */ }
    try { await navigator.clipboard.writeText(url); } catch { /* fallback: open share modal */ setShareQrUrl(shareLink); setShareUrl(url); return; }
    setRemixCopied(true);
    setTimeout(() => setRemixCopied(false), 2000);
    trackEvent("remix-share");
  }, [buildSharePayload, parentId]);

  // Auto-save: persist session to localStorage every 3s and on tab close/hide
  const doAutoSave = useCallback(() => {
    // Skip if no devices connected yet (prevents writing defaults before restore)
    if (!stateRef.current || Object.values(stateRef.current.devices).filter(d => d.connected).length === 0) return;
    const session = exportSession(
      stateRef.current,
      volumeRef.current,
      channelVolumesRef.current,
      { activeDrumKit: activeDrumKitRef.current, activeSynth: activeSynthRef.current, activeBass: activeBassRef.current },
      antiClipModeRef.current,
    );
    setJSON("mpump-autosave", session);
    // Also save as last session for "Continue" on landing page
    saveLastSession(session, getItem("mpump-track-name", "mix"));
  }, []);

  useEffect(() => {
    // Save frequently (3s) so autosave is always fresh — don't save on
    // beforeunload as it can overwrite with teardown state on Cmd+R.
    // Use requestIdleCallback when available to avoid blocking audio thread.
    const ric = typeof requestIdleCallback === "function";
    const id = setInterval(() => {
      if (ric) requestIdleCallback(() => doAutoSave(), { timeout: 2000 });
      else doAutoSave();
    }, 3_000);
    // Save when tab becomes hidden (switching tabs, closing)
    const onHide = () => { if (document.visibilityState === "hidden") doAutoSave(); };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onHide);
      // Save on unmount (cleanup runs before React tears down state)
      doAutoSave();
    };
  }, [doAutoSave]);

  // Auto-restore: reload last auto-saved session once devices are connected and catalog loaded
  const autoRestored = useRef(false);
  useEffect(() => {
    if (autoRestored.current || connectedDevices.length === 0 || !catalog) return;
    autoRestored.current = true;
    const saved = getJSON<SessionData | null>("mpump-autosave", null);
    if (!saved) return;
    const { palette, ...rest } = saved;
    // Delay to ensure engine has finished initial setup
    setTimeout(() => {
      applySession({ ...rest, palette: "" });
    }, 200);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedDevices, catalog]);

  // Decode shared song from ?song= param
  useEffect(() => {
    const songParam = new URLSearchParams(window.location.search).get("song");
    if (!songParam || connectedDevices.length === 0) return;
    try {
      const b64 = songParam.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(songParam.length / 4) * 4, "=");
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const ds = new DecompressionStream("deflate");
      const writer = ds.writable.getWriter();
      writer.write(bytes);
      writer.close();
      const reader = ds.readable.getReader();
      const chunks: Uint8Array[] = [];
      (async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const total = chunks.reduce((n, c) => n + c.length, 0);
        const result = new Uint8Array(total);
        let off = 0;
        for (const c of chunks) { result.set(c, off); off += c.length; }
        const json = JSON.parse(new TextDecoder().decode(result));
        if (json.s && json.a) {
          command({ type: "song_load", scenes: json.s, arrangement: json.a });
          setSongModeOn(true);
          setItem("mpump-song-mode", "1");
        }
      })();
    } catch { /* invalid song param — ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedDevices]);

  // Start with a specific genre (from landing page pill)
  useEffect(() => {
    const genre = getItem("mpump-start-genre", "");
    if (!genre || !catalog) return;
    setItem("mpump-start-genre", "");
    // Genre → BPM mapping (matches Engine.CURATED_STARTS)
    const GENRE_BPM: Record<string, number> = {
      "techno": 130, "acid-techno": 138, "trance": 140, "dub-techno": 118,
      "idm": 135, "edm": 128, "drum-and-bass": 174, "house": 124,
      "breakbeat": 140, "jungle": 170, "garage": 132, "ambient": 90,
      "glitch": 130, "electro": 128, "downtempo": 95,
      "dubstep": 140, "lo-fi": 80, "synthwave": 115, "deep-house": 122, "psytrance": 145,
    };
    const bpm = GENRE_BPM[genre];
    if (bpm) command({ type: "set_bpm", bpm });
    // Find genre index and set on all devices
    for (const d of connectedDevices) {
      const genres = getDeviceGenres(catalog, d.id, d.mode);
      const idx = genres.findIndex(g => g.name === genre);
      if (idx >= 0) command({ type: "set_genre", device: d.id, idx });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog]);

  const allPaused = isPreview && connectedDevices.every(d => d.paused);
  const isListenerMode = jam.status === "connected" && jam.role === "listener";

  const toggleAllPause = () => {
    pressVibrate();
    // Determine target: if any device is playing, pause all; otherwise play all
    const shouldPause = !allPaused;
    for (const d of connectedDevices) {
      if (shouldPause && !d.paused) {
        rawCommand({ type: "toggle_pause", device: d.id }); // local only, no broadcast
      } else if (!shouldPause && d.paused) {
        rawCommand({ type: "toggle_pause", device: d.id });
      }
    }
    // Broadcast explicit play/stop state to jam peers
    jam.broadcastPlayState(!shouldPause);
    // Push play/stop to Link so mloop follows
    if (linkConnected) sendLinkPlaying(!shouldPause);
  };

  toggleAllPauseRef.current = toggleAllPause;

  const loadPreset = (preset: SavedPreset) => {
    command({ type: "load_preset", bpm: preset.state.bpm, genres: preset.state.genres });
  };

  const doMix = () => {
    pressVibrate();
    const mixFxPref = getItem("mpump-mix-fx", "both");
    if (mixFxPref === "both") {
      setMixFx("both");
      setTimeout(() => setMixFx(""), 300);
    } else if (mixFxPref !== "off") {
      setMixFx(mixFxPref as "shake" | "flash");
      setTimeout(() => setMixFx(""), 300);
    }
    if (isPreview) {
      const snap: Record<string, { gi: number; pi: number; bgi: number; bpi: number }> = {};
      for (const d of connectedDevices) {
        snap[d.id] = { gi: d.genre_idx, pi: d.pattern_idx, bgi: d.bass_genre_idx, bpi: d.bass_pattern_idx };
      }
      const history = mixHistoryRef.current;
      history.push({ bpm: state.bpm, genres: snap, dk: activeDrumKit, sp: activeSynth, bp: activeBass });
      if (history.length > 3) history.shift();
    }
    mixCountRef.current++;
    setMixCount(c => c + 1);
    // MIX creates a fresh beat — no longer a remix
    if (parentId) { setParentId(null); setRemixDirty(false); }
    // Reset key/octave/scale to defaults unless locked
    if (!keyLocked) {
      command({ type: "set_key", device: "preview_synth", idx: 0 });
      command({ type: "set_key", device: "preview_bass", idx: 0 });
      command({ type: "set_octave", device: "preview_synth", octave: 2 });
      command({ type: "set_octave", device: "preview_bass", octave: 2 });
      setScaleLock("chromatic");
      setItem("mpump-scale-lock", "chromatic");
    }
    const anyLock = !!genreLock || patternLock.drums || patternLock.synth || patternLock.bass || soundLock.drums || soundLock.synth || soundLock.bass;
    if (!anyLock) {
      setTrackName(generateTrackName(state.bpm));
      mixBpmCountRef.current++;
      if (mixBpmCountRef.current >= 3) {
        mixBpmCountRef.current = 0;
        const randomBpm = 80 + Math.floor(Math.random() * 100); // 80–179
        command({ type: "set_bpm", bpm: randomBpm });
      }
    }
    if (allPaused) {
      for (const d of connectedDevices) {
        if (d.paused) command({ type: "toggle_pause", device: d.id });
      }
    }
    if (genreLock && catalog) {
      for (const d of connectedDevices) {
        const pLocked = (d.mode === "drums" && patternLock.drums) || (d.mode === "bass" && patternLock.bass) || (d.mode === "synth" && patternLock.synth);
        if (pLocked) continue;
        const deviceGenres = d.mode === "bass"
          ? getDeviceBassGenres(catalog)
          : getDeviceGenres(catalog, d.id, d.mode);
        const gi = deviceGenres.findIndex(g => g.name === genreLock);
        if (gi >= 0) {
          command({ type: "set_genre", device: d.id, idx: gi });
          const pi = Math.floor(Math.random() * (deviceGenres[gi]?.patterns.length ?? 1));
          command({ type: "set_pattern", device: d.id, idx: pi });
        }
      }
    } else if (patternLock.drums || patternLock.synth || patternLock.bass) {
      // Selective: locked instruments keep genre but randomize pattern; unlocked fully randomize
      for (const d of connectedDevices) {
        const gLocked = (d.mode === "drums" && patternLock.drums) || (d.mode === "bass" && patternLock.bass) || (d.mode === "synth" && patternLock.synth);
        if (gLocked) {
          // Keep genre, randomize pattern within it (unless pattern is also locked)
          const pLocked = (d.mode === "drums" && stepPatternLock.drums) || (d.mode === "bass" && stepPatternLock.bass) || (d.mode === "synth" && stepPatternLock.synth);
          if (!pLocked) {
            const deviceGenres = d.mode === "drums" ? (catalog?.t8?.drum_genres ?? []) : (catalog?.s1?.genres ?? []);
            const patCount = deviceGenres[d.genre_idx]?.patterns?.length ?? 1;
            command({ type: "set_pattern", device: d.id, idx: Math.floor(Math.random() * patCount) });
          }
          // Also randomize bass pattern if drums+bass (unless bass pattern locked)
          if (d.mode === "drums" && !stepPatternLock.bass) {
            const bassGenres = catalog?.t8?.bass_genres ?? [];
            const bpi = d.bass_genre_idx ?? d.genre_idx;
            const bPatCount = bassGenres[bpi]?.patterns?.length ?? 1;
            command({ type: "set_pattern", device: d.id + "_bass", idx: Math.floor(Math.random() * bPatCount) });
          }
        } else {
          command({ type: "randomize_device", device: d.id });
        }
      }
    } else if (stepPatternLock.drums || stepPatternLock.bass || stepPatternLock.synth) {
      // Some patterns locked — randomize genre+sound but keep locked patterns
      for (const d of connectedDevices) {
        const spLocked = (d.mode === "drums" && stepPatternLock.drums) || (d.mode === "bass" && stepPatternLock.bass) || (d.mode === "synth" && stepPatternLock.synth);
        if (spLocked) {
          // Only randomize genre, keep pattern
          const deviceGenres = d.mode === "drums" ? (catalog?.t8?.drum_genres ?? []) : (catalog?.s1?.genres ?? []);
          const gi = Math.floor(Math.random() * deviceGenres.length);
          command({ type: "set_genre", device: d.id, idx: gi });
        } else {
          command({ type: "randomize_device", device: d.id });
        }
      }
    } else {
      command({ type: "randomize_all", linkGenre: genreLink } as ClientMessage);
    }
    if (isPreview) {
      const ri = (len: number) => String(Math.random() < 0.15 ? 0 : 1 + Math.floor(Math.random() * (len - 1)));
      setTimeout(() => {
        // Get current genre names for genre-aware sound matching
        const devs = stateRef.current.devices;
        const cat = catalog;
        const drumGenres = cat?.t8?.drum_genres ?? [];
        const bassGenresArr = cat?.t8?.bass_genres ?? [];
        const synthGenresArr = cat?.s1?.genres ?? [];
        const drumsD = Object.values(devs).find(d => d.id === "preview_drums");
        const synthD = Object.values(devs).find(d => d.id === "preview_synth");
        const drumsGenreName = drumsD ? drumGenres[drumsD.genre_idx]?.name : undefined;
        const bassGenreName = drumsD ? bassGenresArr[drumsD.bass_genre_idx ?? drumsD.genre_idx]?.name : undefined;
        const synthGenreName = synthD ? synthGenresArr[synthD.genre_idx]?.name : undefined;

        if (!soundLock.drums) {
          const gv = patternLock.drums && drumsGenreName ? matchDrumKit(drumsGenreName) : null;
          handleDrumKitChange(gv ?? allDrumKits[Math.random() < 0.15 ? 0 : 1 + Math.floor(Math.random() * (allDrumKits.length - 1))].value);
        }
        if (!soundLock.synth) {
          const gi = patternLock.synth && synthGenreName ? matchPreset(SYNTH_PRESETS as unknown as { name: string; genres?: string }[], synthGenreName) : null;
          handleSynthChange(gi != null ? String(gi) : ri(SYNTH_PRESETS.length));
        }
        if (!soundLock.bass) {
          const gi = patternLock.bass && bassGenreName ? matchPreset(BASS_PRESETS as unknown as { name: string; genres?: string }[], bassGenreName) : null;
          handleBassChange(gi != null ? String(gi) : ri(BASS_PRESETS.length));
        }
        // Re-apply genre mix profile when Auto scene is active
        if (activeSceneRef.current === "Auto" && drumsGenreName) {
          const profile = GENRE_MIX_PROFILES[drumsGenreName];
          if (profile) {
            loadHeaderScene(profile, "Auto");
          }
        }
      }, 100);
      // Snap synth/bass pattern steps to locked scale (if not chromatic)
      const sl = getItem("mpump-scale-lock", "chromatic");
      if (sl !== "chromatic") {
        setTimeout(() => {
          for (const d of Object.values(stateRef.current.devices)) {
            if (!d.connected) continue;
            // Snap synth/melodic pattern
            if (d.pattern_data) {
              for (let i = 0; i < d.pattern_data.length; i++) {
                const step = d.pattern_data[i];
                if (step) {
                  const snapped = snapToScale(step.semi, sl);
                  if (snapped !== step.semi) {
                    command({ type: "edit_step", device: d.id, step: i, data: { ...step, semi: snapped } });
                  }
                }
              }
            }
            // Snap bass pattern (uses device_bass suffix)
            if (d.bass_data) {
              for (let i = 0; i < d.bass_data.length; i++) {
                const step = d.bass_data[i];
                if (step) {
                  const snapped = snapToScale(step.semi, sl);
                  if (snapped !== step.semi) {
                    command({ type: "edit_step", device: `${d.id}_bass`, step: i, data: { ...step, semi: snapped } });
                  }
                }
              }
            }
          }
        }, 250); // wait for patterns to load
      }
      // After MIX settles, broadcast resulting state to jam peers
      if (jam.status === "connected") {
        setTimeout(() => {
          const s = stateRef.current;
          const g: Record<string, { gi: number; pi: number; bgi?: number; bpi?: number }> = {};
          for (const d of Object.values(s.devices)) {
            if (!d.connected) continue;
            g[d.id] = { gi: d.genre_idx, pi: d.pattern_idx, bgi: d.bass_genre_idx, bpi: d.bass_pattern_idx };
          }
          jam.broadcastCommand({ type: "load_preset", bpm: s.bpm, genres: g } as unknown as ClientMessage);
        }, 300);
      }
    }
  };

  // Wire up keyboard action refs (doMix defined above, soundLock in scope)
  keyActionsRef.current = {
    toggleLock: (deviceId: string) => {
      const ch = deviceId === "preview_drums" ? "drums" : deviceId === "preview_bass" ? "bass" : "synth";
      setSoundLock(prev => ({ ...prev, [ch]: !prev[ch as keyof typeof prev] }));
    },
    doMix,
    toggleSolo: (ch: "drums" | "bass" | "synth") => {
      const unsolo = soloChannel === ch;
      command({ type: "set_drums_mute", device: "preview_drums", muted: unsolo ? false : ch !== "drums" });
      command({ type: "set_drums_mute", device: "preview_synth", muted: unsolo ? false : ch !== "synth" });
      command({ type: "set_drums_mute", device: "preview_bass", muted: unsolo ? false : ch !== "bass" });
      setSoloChannel(unsolo ? null : ch);
    },
    openBpm: () => setShowBpmModal(true),
  };

  return (
    <div
      className={`layout ${isPreview ? `mode-${previewMode}` : ""} ${mixFx ? `mix-fx-${mixFx}` : ""} ${bottomTransport ? "bottom-transport-active" : ""}`}
    >
      <header className="header">
        <div className="title">
          <pre ref={logoRef} className={`title-art ${logoFlash ? "logo-flash" : ""} ${logoKick ? "logo-kick" : ""}`} key={logoFlash} title="1× pulse · 2× beat sync · 3× theme · 4× credits" onClick={handleLogoClick}>{"█▀▄▀█ █▀█ █ █ █▀▄▀█ █▀█\n█ ▀ █ █▀▀ ▀▄▀ █ ▀ █ █▀▀"}</pre>
          <span className="beta-badge" title={"⚡ Sound engine tuning in progress\nThings may change 🚧"}>BETA</span>
          {(() => { const p = new URLSearchParams(window.location.search); const pm = p.get("eco") === "true" ? "eco" : p.get("lite") === "true" ? "lite" : localStorage.getItem("mpump-perf-mode"); return pm === "eco" || pm === "lite" ? <span className="beta-badge" style={{ background: pm === "eco" ? "#ff8c00" : "#ffcc00", color: pm === "eco" ? "#000" : "#000", marginLeft: 3, cursor: "pointer" }} title="Tap to switch back to Normal" onClick={() => { if (confirm(`Switch from ${pm === "eco" ? "Eco" : "Lite"} to Normal mode?\n\nThis restores full animations and audio quality.`)) { localStorage.setItem("mpump-perf-mode", "normal"); window.location.reload(); } }}>{pm === "eco" ? "ECO" : "LITE"}</span> : null; })()}
          <CpuDot getCpuLoad={getCpuLoad} />
          {linkConnected && <span style={{ color: "#66ff99", fontSize: 10, marginLeft: 2, verticalAlign: "top" }} title="Ableton Link connected">●</span>}
        </div>
        {/* Track title: between logo and VU */}
        {isPreview && (
          <div className="track-title-row track-title-header track-style-a" title="Session info" style={{ cursor: "pointer" }}
            onClick={() => setShowSessionModal(true)}>
            <div className="track-title-marquee">
              <span key={trackName} className="track-title-text" style={{ animationDuration: `${Math.max(4, 240 / state.bpm)}s`, animationPlayState: allPaused ? "paused" : "running" }}>
                {trackName} <span className="track-sep" style={{ animationDuration: `${60 / state.bpm}s`, animationPlayState: allPaused ? "paused" : "running" }}>●</span> {trackName} <span className="track-sep" style={{ animationDuration: `${60 / state.bpm}s`, animationPlayState: allPaused ? "paused" : "running" }}>●</span> {trackName} <span className="track-sep" style={{ animationDuration: `${60 / state.bpm}s`, animationPlayState: allPaused ? "paused" : "running" }}>●</span>
              </span>
            </div>
          </div>
        )}
        {isPreview && drumsStep >= 0 && (() => {
          const step = drumsStep % 16;
          const drums = connectedDevices.find(d => d.id === "preview_drums");
          const bass = connectedDevices.find(d => d.id === "preview_bass");
          const synth = connectedDevices.find(d => d.id === "preview_synth");
          const dd = drums?.drum_data;
          const bd = bass?.pattern_data;
          const sd = synth?.pattern_data;
          return <div className="header-step-bar">
            <div style={{ display: "flex", flexDirection: "column", gap: 1, flex: 1 }}>
              {[{ data: dd, type: "drum" }, { data: bd, type: "mel" }, { data: sd, type: "mel" }].map((row, r) => (
                <div key={r} style={{ display: "flex", gap: 1 }}>
                  {Array.from({ length: 16 }, (_, i) => {
                    const has = row.type === "drum" ? (row.data as typeof dd)?.[i]?.length : (row.data as typeof bd)?.[i] != null;
                    return <div key={i} className={`mg-seq-step${i === step ? " on" : has ? " dim-on" : ""}`} style={{ height: 5 }} />;
                  })}
                </div>
              ))}
            </div>
          </div>;
        })()}
        <div className="header-controls">
          {/* Row 1: BPM, mode switcher, MIX, undo, play, rec */}
          <div className="header-row header-row-transport">
            {isPreview && catalog && (
              <button className="lib-open-btn" title="Browse all patterns" onClick={() => setShowLibrary(true)}>
                &#x266B;<span className="lib-open-text"> Library</span>
              </button>
            )}
            {isPreview && (
              <div className="genre-link-wrap">
                <button className={`lib-open-btn genre-link-btn ${genreLink ? "active" : ""}`} title={genreLink ? "All genres linked — click to unlink" : "Set all genres"} onClick={() => {
                  if (genreLink) {
                    // Unlink: unlock all genre locks
                    presetState?.setPatternLock(prev => ({ ...prev, drums: false, bass: false, synth: false }));
                    setGenreLink(false);
                  } else {
                    setShowGenrePicker(s => { if (!s) setShowScenePicker(false); return !s; });
                  }
                }}>
                  🔗
                </button>
                {showGenrePicker && (() => {
                  const genres = catalog?.s1?.genres ?? catalog?.t8?.drum_genres ?? [];
                  const GENRE_BPM: Record<string, [number, number]> = {
                    "lo-fi": [70, 90], ambient: [70, 90], downtempo: [85, 105],
                    "dub-techno": [110, 122], synthwave: [110, 125],
                    house: [120, 128], "deep-house": [120, 125], garage: [128, 135],
                    electro: [120, 135], edm: [126, 140],
                    breakbeat: [125, 140], techno: [128, 140],
                    "acid-techno": [132, 145], trance: [136, 145],
                    dubstep: [135, 145], psytrance: [140, 150],
                    idm: [110, 150], glitch: [110, 150],
                    "drum-and-bass": [165, 178], jungle: [160, 175],
                  };
                  // Sort alphabetically
                  const tagged = genres.map((g: { name: string }, i: number) => {
                    const bpm = GENRE_BPM[g.name];
                    return { g, i, mid: 0, bpmLabel: bpm ? `${bpm[0]}–${bpm[1]}` : "" };
                  }).sort((a, b) => a.g.name.localeCompare(b.g.name));
                  return (
                    <div className="genre-link-dropdown">
                      <div style={{ fontSize: 8, opacity: 0.4, letterSpacing: 1, padding: "2px 8px", textTransform: "uppercase" }}>Set All Genres</div>
                      {tagged.map(({ g, i, bpmLabel }) => (
                        <button key={i} className="genre-link-option" onClick={() => {
                          // Set genre on all 3 instruments
                          for (const d of Object.values(state.devices)) {
                            if (d.connected) {
                              command({ type: "set_genre", device: d.id, idx: i });
                              if (d.id === "preview_drums") command({ type: "set_genre", device: "preview_bass", idx: i });
                            }
                          }
                          // Set BPM to genre range
                          const bpmRange = GENRE_BPM[g.name];
                          if (bpmRange) {
                            const bpm = bpmRange[0] + Math.floor(Math.random() * (bpmRange[1] - bpmRange[0] + 1));
                            command({ type: "set_bpm", bpm } as ClientMessage);
                          }
                          // Match sounds to genre
                          if (presetState) {
                            const si = matchPreset(SYNTH_PRESETS as unknown as { name: string; genres?: string }[], g.name);
                            if (si != null) presetState.onSynthChange(String(si));
                            const bi = matchPreset(BASS_PRESETS as unknown as { name: string; genres?: string }[], g.name);
                            if (bi != null) presetState.onBassChange(String(bi));
                            const di = matchPreset(DRUM_KIT_PRESETS as unknown as { name: string; genres?: string }[], g.name);
                            if (di != null) presetState.onDrumKitChange(String(di));
                          }
                          // Lock all genre locks
                          presetState?.setPatternLock(prev => ({ ...prev, drums: true, bass: true, synth: true }));
                          setGenreLink(true);
                          setShowGenrePicker(false);
                        }}>{g.name} <span style={{ opacity: 0.8, fontSize: 8 }}>{bpmLabel}</span></button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
            {isPreview && (
              <div className="genre-link-wrap scene-picker-wrap">
                <button
                  className={`sound-lock-btn ${activeScene ? "locked" : ""}`}
                  title={activeScene ? `Scene: ${activeScene}` : "Mix scene"}
                  onClick={() => setShowScenePicker(v => { if (!v) setShowGenrePicker(false); return !v; })}
                  style={{ fontSize: 14, border: activeScene ? "1px solid var(--preview)" : undefined, borderRadius: activeScene ? 4 : undefined, padding: activeScene ? "1px 4px" : undefined, position: "relative" }}
                >🎛{(() => {
                  if (activeScene === "Auto") return null;
                  const g = getCurrentDrumsGenre();
                  const hasSuggestion = g && (GENRE_MIX_PROFILES[g] || HEADER_SCENES.some(s => s.genres?.includes(g)));
                  const isSuggested = g && activeScene && HEADER_SCENES.find(s => s.name === activeScene)?.genres?.includes(g);
                  if (hasSuggestion && !isSuggested) return <span style={{ position: "absolute", top: -1, right: -1, width: 5, height: 5, borderRadius: "50%", background: "var(--preview)", display: "block" }} />;
                  return null;
                })()}</button>
                {showScenePicker && (() => {
                  const curGenre = getCurrentDrumsGenre();
                  const suggested = curGenre ? HEADER_SCENES.filter(s => s.genres?.includes(curGenre)) : [];
                  const suggestedNames = new Set(suggested.map(s => s.name));
                  const sorted = [...suggested, ...HEADER_SCENES.filter(s => !suggestedNames.has(s.name))];
                  const autoGenreLabel = curGenre ? GENRE_MIX_PROFILES[curGenre]?.name ?? curGenre : undefined;
                  return (
                    <div className="genre-link-dropdown" style={{ minWidth: 120 }}>
                      <div style={{ fontSize: 8, opacity: 0.4, letterSpacing: 1, padding: "2px 8px", textTransform: "uppercase" }}>Mix Scene</div>
                      <button
                        className={`genre-link-option ${activeScene === "Auto" ? "active" : ""}`}
                        style={activeScene === "Auto" ? { background: "#66ff99", color: "#000" } : undefined}
                        onClick={applyAutoScene}
                      >Auto {autoGenreLabel ? <span style={{ opacity: 0.8, fontSize: 8 }}>fit to {autoGenreLabel}</span> : null}</button>
                      <div style={{ borderTop: "1px solid rgba(102,255,153,0.15)", margin: "2px 8px" }} />
                      {sorted.map(s => (
                        <button
                          key={s.name}
                          className={`genre-link-option ${activeScene === s.name ? "active" : ""}`}
                          style={activeScene === s.name ? { background: "#66ff99", color: "#000" } : undefined}
                          onClick={() => loadHeaderScene(s)}
                        >{suggestedNames.has(s.name) ? "★ " : ""}{s.name} <span style={{ opacity: 0.8, fontSize: 8 }}>{s.desc}</span></button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
            {isPreview && (
              <div className="mode-switcher" role="tablist" aria-label="Interface mode">
                {HEADER_MODES.map((m) => {
                  const isListenerMode = jam.status === "connected" && jam.role === "listener";
                  const disabled = (jam.status === "connected" && m === "synth") || (isListenerMode && m !== "kaos");
                  return (
                    <button
                      key={m}
                      role="tab"
                      aria-selected={previewMode === m}
                      className={`mode-btn ${previewMode === m ? "active" : ""} ${disabled ? "mode-btn-disabled" : ""}`}
                      title={disabled ? "SYNTH editing disabled during jam" : `Switch to ${MODE_LABELS[m]} mode`}
                      onClick={() => { if (!disabled) { setPreviewMode(m); trackEvent(`mode-${m}`); } }}
                      style={disabled ? { opacity: 0.3, cursor: "not-allowed" } : undefined}
                    >
                      {MODE_LABELS[m]}
                    </button>
                  );
                })}
              </div>
            )}
            <span style={isListenerMode ? { opacity: 0.6, pointerEvents: "none" } : undefined}><BpmControl bpm={state.bpm} command={command} showModal={showBpmModal} onModalClose={() => setShowBpmModal(false)} /></span>
          </div>
          {/* Row 2: transport, share, settings */}
          <div className="header-row header-row-tools">
            <div className="header-transport-group">
              <button
                className={`shuffle-btn ${isPreview ? "shuffle-btn-preview" : ""}`}
                title={`MIX — ${mixCountRef.current} mix${mixCountRef.current !== 1 ? "es" : ""} in ${sessionMin < 1 ? "<1 min" : sessionMin < 60 ? `${sessionMin} min` : `${Math.floor(sessionMin / 60)}h ${sessionMin % 60 > 0 ? `${sessionMin % 60}m` : ""}`} session`}
                onClick={doMix}
                disabled={isListenerMode}
                style={isListenerMode ? { opacity: 0.3, pointerEvents: "none" } : undefined}
              >
                &#x2684; MIX
              </button>
              {isPreview && (
                <button
                  className={`shuffle-btn shuffle-btn-undo ${mixHistoryRef.current.length === 0 ? "shuffle-btn-disabled" : ""}`}
                  title={mixHistoryRef.current.length > 0 ? `Undo MIX (${mixHistoryRef.current.length} saved)` : "No MIX history"}
                  disabled={mixHistoryRef.current.length === 0}
                  onClick={() => {
                    pressVibrate();
                    const mixFxPref = getItem("mpump-mix-fx", "both");
                    if (mixFxPref === "both") { setMixFx("both"); setTimeout(() => setMixFx(""), 300); }
                    else if (mixFxPref !== "off") { setMixFx(mixFxPref as "shake" | "flash"); setTimeout(() => setMixFx(""), 300); }
                    const prev = mixHistoryRef.current.pop();
                    if (!prev) return;
                    command({ type: "load_preset", bpm: prev.bpm, genres: prev.genres });
                    setTimeout(() => {
                      handleDrumKitChange(prev.dk);
                      handleSynthChange(prev.sp);
                      handleBassChange(prev.bp);
                    }, 100);
                  }}
                >
                  &#x21A9;
                </button>
              )}
              {isPreview && (
                <button
                  className={`header-play-btn ${allPaused ? "" : "playing"}`}
                  onClick={isListenerMode ? undefined : toggleAllPause}
                  title={allPaused ? "Play all (Space)" : "Stop all (Space)"}
                  style={isListenerMode ? { opacity: 0.3, pointerEvents: "none" } : undefined}
                >
                  {allPaused ? "▶" : "⏹"}
                </button>
              )}
              {isPreview && getAnalyser && <Recorder getAnalyser={getAnalyser} onExport={support.onExport} />}
              {isPreview && (
                <button className="header-settings-btn header-share-btn" title="Share setup" aria-label="Share setup" onClick={() => {
                  const base = buildSharePayload();
                  const shareLink = buildShareUrl(base);
                  setShareQrUrl(shareLink);
                  setShareGestureNote(false);
                  support.onShare();
                  checkRelayHealth().then(async (up) => {
                    if (up) {
                      const result = await shortenBeat(shareLink, parentId ?? undefined);
                      if (result) { setShareUrl(result.short); return; }
                    }
                    setShareUrl(shareLink);
                  });
                }}>
                  ⤴ Share
                </button>
              )}
              {isPreview && jamEnabled && (
                <button
                  className={`header-settings-btn jam-header-btn ${jam.status === "connected" ? "jam-active" : ""}`}
                  title="Live jam"
                  aria-label="Live jam"
                  onClick={() => setShowJam(true)}
                >
                  {jam.status === "connected" ? (<>
                    <span className={`jam-dot ${logoKick ? "kick" : ""}`} />
                    {jam.roomType === "liveset"
                      ? ` LIVE SET ${jam.peerCount}`
                      : ` JAM ${jam.peerCount}/4`}
                  </>) : (<><span className="jam-label-full">Jam/Set</span><span className="jam-label-short">Jam</span></>)}
                </button>
              )}
            </div>
            {/* Right-aligned group: pins, heart, more, settings */}
            <div className="header-right-group">
              {isPreview && <PresetManager state={state} onLoad={loadPreset} mixCount={mixCount} />}
              {isPreview && <button className="header-settings-btn header-save-btn" title="Save session (Cmd+S)" aria-label="Save session" onClick={saveToLibrary}>💾</button>}
              {isPreview && <button className="header-settings-btn header-sessions-btn" title="Sessions" aria-label="Sessions" onClick={() => setShowSessionLib(true)}>📂</button>}
              {isPreview && (
                <button className="header-settings-btn header-save-mobile" onClick={saveToLibrary} title="Save session" aria-label="Save session">
                  💾
                </button>
              )}
              {isPreview && (
                <div className="header-more-wrap">
                  <button className="header-settings-btn" title="More actions" aria-label="More actions" onClick={() => setShowMoreMenu(v => !v)}>
                    ⋯
                  </button>
                  {showMoreMenu && (
                    <div className="header-more-menu" onClick={(e) => { if (!(e.target as HTMLElement).closest(".tap-tempo-btn") && !(e.target as HTMLElement).closest(".preset-mgr")) setShowMoreMenu(false); }}>
                      <button onClick={() => { setShowMoreMenu(false); setShowHelp(true); }}>? Help</button>
                      <button className="more-menu-sessions" onClick={() => { setShowMoreMenu(false); setShowSessionLib(true); }}>📂 Sessions</button>
                      <div className="more-menu-presets"><PresetManager state={state} onLoad={loadPreset} mixCount={mixCount} /></div>
                      <button className="more-menu-fullscreen" onClick={() => {
                        if (document.fullscreenElement) document.exitFullscreen();
                        else document.documentElement.requestFullscreen().catch(() => {});
                      }}>⛶ Fullscreen</button>
                      <TapTempo command={command} />
                      <button onClick={handleExportSession}>↓ Export session</button>
                      <button onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file"; input.accept = ".json";
                        input.onchange = () => { if (input.files?.[0]) handleImportSession(input.files[0]); };
                        input.click();
                      }}>↑ Import session</button>
                      <button onClick={() => { setSongModeOn(v => { const next = !v; setItem("mpump-song-mode", next ? "1" : ""); return next; }); }}>{songModeOn ? "✓" : " "} Song Mode</button>
                      {onConnectMidi && <button onClick={onConnectMidi}>🎹 Connect MIDI</button>}
                      <button className="more-menu-help" onClick={() => { setShowMoreMenu(false); setShowHelp(true); }}>? Help</button>
                      <button onClick={() => { setShowMoreMenu(false); setShowSettings(true); }}>⚙ Settings</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>{/* /header-row-tools */}
        </div>
      </header>

      {/* Remix banner */}
      {parentId && (
        <div className="remix-banner">
          <span>🔀 Based on <a href={`https://s.mpump.live/${parentId}`} target="_blank" rel="noopener noreferrer">s.mpump.live/{parentId}</a></span>
          {remixDirty && (
            <button onClick={quickShareRemix}>{remixCopied ? "✓ Copied!" : "Share remix ⤴"}</button>
          )}
          <button className="remix-banner-close" onClick={() => setParentId(null)}>✕</button>
        </div>
      )}

      {/* Contextual hint */}
      {showHint && (
        <div className="hint-banner" onClick={dismissHint} style={{ cursor: "pointer" }}>
          <span>{HINT_TEXTS[previewMode]}</span>
          <button className="hint-banner-close">✕</button>
        </div>
      )}

      {/* Song strip — right below header, centered */}
      {isPreview && songModeOn && (
        <div style={{ padding: "4px 8px" }}>
          <SongStrip accent={connectedDevices[0]?.accent ?? "#66ff99"} songState={songState ?? { scenes: [], arrangement: [], loop: true, playback: { playing: false, currentIndex: 0, barInScene: 0, totalBars: 0 } }} command={command} />
        </div>
      )}

      {/* Update banner */}
      {updateAvailable && (
        <div className="update-banner">
          <span onClick={() => location.reload()}>New version available — tap to update</span>
          <button className="update-banner-close" onClick={(e) => { e.stopPropagation(); setUpdateAvailable(false); }}>✕</button>
        </div>
      )}



      <main className="panels">
        {!anyConnected && !isPreview && (
          <div className="no-devices">
            <div className="no-devices-icon">no instruments detected</div>
            <div className="no-devices-hint">
              connect a MIDI device via USB
            </div>
            <div className="no-devices-hint">
              devices are detected automatically when plugged in
            </div>
            {!isPreview && onStartPreview && (
              <button className="midi-gate-btn midi-gate-btn-preview" style={{ marginTop: 16 }} onClick={() => onStartPreview!()}>
                Play with built-in sounds
              </button>
            )}
          </div>
        )}

        {isPreview && previewMode === "kaos" ? (
          <>
          <KaosPanel
            devices={connectedDevices}
            catalog={catalog}
            command={command}
            bpm={state.bpm}
            volume={volume}
            onVolumeChange={handleVolumeChange}
            channelVolumes={channelVolumes}
            onChannelVolumeChange={handleChannelVolumeChange}
            presetState={presetState}
            getAnalyser={getAnalyser}
            getChannelAnalyser={getChannelAnalyser}
            onMix={doMix}
            onExport={support.onExport}
            trackName={trackName}
            onTrackNameChange={setTrackName}
            onJamXY={jam.status === "connected" ? (x: number, y: number) => {
              jam.broadcastXY(x, y);
              if (jam.quantize) jam.recordXYStep(x, y, drumsStep);
            } : undefined}
            jamApplyXYRef={jamApplyXYRef}
            peerList={jam.peerList}
            myPeerId={jam.myPeerId}
            jamFxRef={jamFxRef}
            inJam={jam.status === "connected"}
            isListener={jam.status === "connected" && jam.role === "listener"}
            currentStep={drumsStep}
            pendingMutes={pendingMutes}
            onKbdFocusChange={setKbdFocusDevice}
            kbdFocusDevice={kbdFocusDevice}
            soloChannel={soloChannel}
            onSoloChange={setSoloChannel}
          />
          </>
        ) : isPreview && previewMode === "mixer" ? (
          <MixerPanel
            volume={volume}
            onVolumeChange={handleVolumeChange}
            channelVolumes={channelVolumes}
            onChannelVolumeChange={handleChannelVolumeChange}
            devices={connectedDevices}
            command={wrappedCommand}
            antiClipMode={antiClipMode}
            getAnalyser={getAnalyser}
            getChannelAnalyser={getChannelAnalyser}
            pendingMutes={pendingMutes}
            onShowDrumKit={() => setShowDrumKitFromMixer(true)}
            soloChannel={soloChannel}
            onSoloChange={setSoloChannel}
            getMixerState={getMixerState}
          />
        ) : (
          connectedDevices.map(ds =>
              <DevicePanel
                key={ds.id}
                state={ds}
                catalog={catalog}
                command={command}
                onLoadSamples={onLoadSamples}
                bpm={state.bpm}
                presetState={presetState}
                allDevices={connectedDevices}
                scaleLock={scaleLock}
                channelVolumes={channelVolumes}
                onChannelVolumeChange={handleChannelVolumeChange}
                onScaleLockChange={(v) => { setScaleLock(v); setItem("mpump-scale-lock", v); }}
                soloChannel={soloChannel}
                onSoloChange={setSoloChannel}
                getChannelAnalyser={getChannelAnalyser}
                getMutedDrumNotes={getMutedDrumNotes}
                playNote={playNote}
                stopNote={stopNote}
                kbdFocusDevice={kbdFocusDevice}
                onKbdFocusChange={setKbdFocusDevice}
                keyLocked={keyLocked}
                onKeyLockedChange={setKeyLocked}
              />
          )
        )}
      </main>

      {showSessionModal && (() => {
        const sessionDur = sessionMin < 1 ? "<1 min" : sessionMin < 60 ? `${sessionMin} min` : `${Math.floor(sessionMin / 60)}h ${sessionMin % 60 > 0 ? `${sessionMin % 60}m` : ""}`;
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", justifyContent: "center", paddingTop: 60 }} onClick={() => setShowSessionModal(false)}>
            <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, maxWidth: 340, width: "90%", padding: 20, height: "fit-content" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: 1 }}>SESSION INFO</span>
                <button className="mx-btn" onClick={() => setShowSessionModal(false)} style={{ fontSize: 12 }}>✕</button>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, opacity: 0.6, display: "block", marginBottom: 2 }}>TRACK PLAYING NOW</label>
                <input type="text" defaultValue={trackName} style={{
                  width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)",
                  color: "var(--text)", padding: "6px 8px", borderRadius: 4, fontSize: 14, fontFamily: "var(--mono)",
                  boxSizing: "border-box",
                }} onBlur={(e) => { const t = e.target.value.trim(); if (t) setTrackName(t); }}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12, opacity: 0.8, marginTop: 8 }}>
                <div><span style={{ opacity: 0.5 }}>Session duration</span><br />{sessionDur}</div>
                <div><span style={{ opacity: 0.5 }}>MIX count</span><br />{mixCountRef.current}</div>
              </div>
            </div>
          </div>
        );
      })()}

      {showSettings && (
        <Settings
          volume={volume}
          onVolumeChange={handleVolumeChange}
          onClose={() => setShowSettings(false)}
          swing={state.swing}
          onSwingChange={(sw) => command({ type: "set_swing", swing: sw })}
          previewMode={previewMode}
          onPreviewModeChange={setPreviewMode}
          shareData={(() => {
            const g: Record<string, { gi: number; pi: number; bgi?: number; bpi?: number }> = {};
            for (const d of connectedDevices) {
              g[d.id] = { gi: d.genre_idx, pi: d.pattern_idx, bgi: d.bass_genre_idx, bpi: d.bass_pattern_idx };
            }
            const sd: Record<string, unknown> = { bpm: state.bpm, sw: state.swing, dk: activeDrumKit, sp: activeSynth, bp: activeBass, g };
            const synthDev2 = connectedDevices.find(d => d.id === "preview_synth");
            const bassDev2 = connectedDevices.find(d => d.id === "preview_bass");
            if (synthDev2?.synthParams) sd.spp = encodeSynthParamsCompact(synthDev2.synthParams as unknown as Record<string, unknown>);
            if (bassDev2?.synthParams) sd.bpp = encodeSynthParamsCompact(bassDev2.synthParams as unknown as Record<string, unknown>);
            const drumsDev2 = connectedDevices.find(d => d.id === "preview_drums");
            const muBits2 = `${drumsDev2?.drumsMuted ? "1" : "0"}${bassDev2?.drumsMuted ? "1" : "0"}${synthDev2?.drumsMuted ? "1" : "0"}`;
            if (muBits2 !== "000") sd.mu = muBits2;
            const cv2 = `${Math.round((channelVolumes[9] ?? 0.7) * 100)},${Math.round((channelVolumes[1] ?? 0.7) * 100)},${Math.round((channelVolumes[0] ?? 0.7) * 100)}`;
            if (cv2 !== "70,70,70") sd.cv = cv2;
            for (const d of connectedDevices) {
              if (!d.editing) continue;
              if (d.mode === "synth") sd.me = encodeSteps(d.pattern_data);
              if (d.mode === "drums" || d.mode === "drums+bass") sd.de = encodeDrumSteps(d.drum_data);
              if (d.mode === "bass") sd.be = encodeSteps(d.pattern_data);
              if (d.mode === "drums+bass") sd.be = encodeSteps(d.bass_data);
            }
            return toUrlSafeB64(sd);
          })()}
          cvEnabled={cvEnabled}
          onCVChange={isPreview ? (on) => { setCvEnabled(on); command({ type: "set_cv_enabled", on }); } : undefined}
          antiClipMode={antiClipMode}
          onAntiClipChange={isPreview ? (mode) => { setAntiClipMode(mode); command({ type: "set_anti_clip", mode }); } : undefined}
          command={command}
          onAbout={() => setShowAbout(true)}
          onHelp={() => setShowHelp(true)}
          onTutorial={() => setShowTutorialManual(true)}
          onExportSession={isPreview ? handleExportSession : undefined}
          onImportSession={isPreview ? handleImportSession : undefined}
        />
      )}

      {shareUrl && (
        <ShareModal url={shareUrl} longUrl={shareQrUrl} parentId={parentId} qrUrl={shareQrUrl} gestureNote={shareGestureNote} getAnalyser={getAnalyser ?? undefined} currentStep={drumsStep} onOpen={() => { if (allPaused) toggleAllPause(); }} onClose={() => { setShareUrl(null); setShareQrUrl(null); setShareGestureNote(false); }} />
      )}

      {showJam && (
        <JamModal
          status={jam.status}
          roomId={jam.roomId}
          roomType={jam.roomType}
          role={jam.role}
          peerCount={jam.peerCount}
          peerList={jam.peerList}
          myPeerId={jam.myPeerId}
          quantize={jam.quantize}
          onToggleQuantize={jam.toggleQuantize}
          onCreateRoom={async (type, name) => { jamSyncedRef.current = true; return jam.createRoom(type, name); }}
          onJoinRoom={(id, type, name) => { pendingJamRoomRef.current = null; jam.joinRoom(id, type, name); }}
          pendingJamRoom={pendingJamRoomRef.current}
          onLeave={() => { jamSyncedRef.current = false; jam.leaveRoom(); setShowJam(false); }}
          onDisconnect={() => { jamSyncedRef.current = false; jam.leaveRoom(); }}
          onClose={() => setShowJam(false)}
          isJoining={jamJoiningRef.current}
        />
      )}

      {showLibrary && catalog && (
        <PatternLibrary catalog={catalog} command={command} onClose={() => setShowLibrary(false)} />
      )}

      {isPreview && showHelp && (
        <HelpModal onClose={() => setShowHelp(false)} onShowTutorial={() => { setShowHelp(false); setShowTutorialManual(true); }} onShowCredits={() => { setShowHelp(false); setShowAbout(true); }} />
      )}

      {showDrumKitFromMixer && (
        <div className="settings-overlay" onClick={() => setShowDrumKitFromMixer(false)}>
          <div className="settings-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <DrumKitEditor accent="#66ff99" command={command} activeDrumKit={activeDrumKit} defaultOpen />
            <button className="settings-done-btn" style={{ marginTop: 8 }} onClick={() => setShowDrumKitFromMixer(false)}>Done</button>
          </div>
        </div>
      )}

      {isPreview && showSessionLib && (
        <SessionLibrary onClose={() => setShowSessionLib(false)} onLoad={(data, name) => {
          setShowSessionLib(false);
          setTimeout(() => { try { applySession(data); setTrackName(name.replace(/ · \d+ BPM$/, "")); } catch(e) { console.error("Failed to load session:", e); } }, 50);
        }} />
      )}

      {isPreview && (showTutorial || showTutorialManual) && (
        <Tutorial onDismiss={() => { dismissTutorial(); setShowTutorialManual(false); }} />
      )}

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} getAnalyser={getAnalyser} />}
      {showMegaKaos && <MegaKaos devices={connectedDevices} command={command} getAnalyser={getAnalyser} onClose={() => setShowMegaKaos(false)} />}
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}

      {showSessionExport && (
        <SessionModal
          defaultName={`mpump-session-${new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-")}`}
          onSave={doExportSession}
          onClose={() => setShowSessionExport(false)}
        />
      )}

      {/* Bottom transport bar (mobile setting) */}
      {bottomTransport && isPreview && (
        <div className="bottom-transport-bar">
          <button
            className={`shuffle-btn ${isPreview ? "shuffle-btn-preview" : ""}`}
            title="MIX"
            onClick={doMix}
            disabled={isListenerMode}
            style={isListenerMode ? { opacity: 0.3, pointerEvents: "none" } : undefined}
          >
            &#x2684; MIX
          </button>
          <button
            className={`shuffle-btn shuffle-btn-undo ${mixHistoryRef.current.length === 0 ? "shuffle-btn-disabled" : ""}`}
            title="Undo MIX"
            disabled={mixHistoryRef.current.length === 0 || isListenerMode}
            style={isListenerMode ? { opacity: 0.3, pointerEvents: "none" } : undefined}
            onClick={() => {
              pressVibrate();
              const prev = mixHistoryRef.current.pop();
              if (!prev) return;
              command({ type: "load_preset", bpm: prev.bpm, genres: prev.genres });
              setTimeout(() => { handleDrumKitChange(prev.dk); handleSynthChange(prev.sp); handleBassChange(prev.bp); }, 100);
            }}
          >
            &#x21A9;
          </button>
          <button
            className={`header-play-btn ${allPaused ? "" : "playing"}`}
            onClick={isListenerMode ? undefined : toggleAllPause}
            title={allPaused ? "Play all" : "Stop all"}
            style={isListenerMode ? { opacity: 0.3, pointerEvents: "none" } : undefined}
          >
            {allPaused ? "▶" : "⏹"}
          </button>
          {getAnalyser && <Recorder getAnalyser={getAnalyser} />}
        </div>
      )}

      <SupportPromptUI showModal={support.showModal} setShowModal={support.setShowModal} showToast={support.showToast} setShowToast={support.setShowToast} />

      {jam.status === "connected" && (
        <JamReactions
          onSend={jam.sendReaction}
          onRegisterAddFloat={jamReactions.registerAddFloat}
          previewColor={getComputedStyle(document.documentElement).getPropertyValue("--preview").trim()}
          myName={jam.peerList.find(p => p.id === jam.myPeerId)?.name || null}
          myColor={PEER_COLORS[Math.max(0, jam.peerList.findIndex(p => p.id === jam.myPeerId)) % PEER_COLORS.length]}
          onNameChange={(n) => { /* name is read-only after join for now */ }}
        />
      )}

      {/* Action bubbles from jam peers */}
      {actionBubbles.map(b => (
        <div key={b.id} className="jam-action-bubble" style={{ left: b.x, top: b.y, borderColor: b.color, color: b.color }}>
          <span className="jam-action-bubble-name">{b.name}</span> {b.action}
        </div>
      ))}

      {/* Global footer */}
      <footer className="app-footer" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 6px" }}>
        <span><span className="app-footer-link" onClick={() => setShowAbout(true)}>v{__APP_VERSION__}</span> · © 2026 · <a href="https://github.com/gdamdam/mpump" target="_blank" rel="noopener noreferrer">github.com/gdamdam/mpump</a></span>
        <span><a className="app-footer-link" href="https://ko-fi.com/gdamdam" target="_blank" rel="noopener noreferrer" style={{ color: "#ff0000", fontWeight: 700, filter: "brightness(2)" }} onClick={() => trackEvent("kofi-footer")}>Support ♥</a> · <a className="app-footer-link" href="https://github.com/gdamdam/mpump/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">AGPL-3.0</a> · Built with Claude Code · <span className="app-footer-link" onClick={() => setShowPrivacy(true)}>No cookies · No personal data</span></span>
      </footer>
    </div>
  );
}
