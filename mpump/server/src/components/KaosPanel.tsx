/**
 * KaosPanel — Performance XY pad + effects rack + full device controls.
 */

import { useRef, useState, useCallback, useEffect } from "react";
import type { Catalog, ClientMessage, DeviceState, EffectParams, EffectName, XYTarget, PresetState } from "../types";
import { DEFAULT_EFFECTS } from "../types";
import { getItem, setItem, getBool, setBool, setJSON, getJSON } from "../utils/storage";
import { useGestureRecorder } from "../hooks/useGestureRecorder";
import { tapVibrate, pressVibrate } from "../utils/haptic";
import { ChainEditor } from "./ChainEditor";
import { KaosDropdown } from "./KaosDropdown";
import { startVideoRecording, saveVideo, type VideoRecorderHandle } from "../utils/videoRecorder";

const DEFAULT_EFFECT_ORDER: EffectName[] = ["compressor", "highpass", "distortion", "bitcrusher", "chorus", "phaser", "delay", "reverb"];

const XY_OPTIONS: { value: XYTarget; label: string }[] = [
  { value: "cutoff", label: "Cutoff" },
  { value: "resonance", label: "Resonance" },
  { value: "distortion", label: "Distortion" },
  { value: "highpass", label: "Highpass" },
  { value: "delay", label: "Delay" },
  { value: "reverb", label: "Reverb" },
  { value: "bpm", label: "BPM" },
  { value: "swing", label: "Swing" },
  { value: "volume", label: "Volume" },
];
import { getDeviceGenres, getDeviceBassGenres } from "../data/catalog";
import { EffectEditor } from "./EffectEditor";
import { SYNTH_PRESETS, BASS_PRESETS, DRUM_KIT_PRESETS, groupPresets } from "../data/soundPresets";
import { SAMPLE_PACKS } from "../data/samplePacks";
import { exportMelodicMidi, exportDrumMidi } from "../utils/midi";
import { SignalLed } from "./SignalLed";

interface Props {
  devices: DeviceState[];
  catalog: Catalog | null;
  command: (msg: ClientMessage) => void;
  bpm: number;
  volume: number;
  onVolumeChange: (v: number) => void;
  channelVolumes: Record<number, number>;
  onChannelVolumeChange: (ch: number, v: number) => void;
  presetState?: PresetState;
  getAnalyser?: () => AnalyserNode | null;
  getChannelAnalyser?: (ch: number) => AnalyserNode | null;
  onMix?: () => void;
  onExport?: () => void;
  trackName?: string;
  onTrackNameChange?: (name: string) => void;
  onJamXY?: (x: number, y: number) => void;
  jamApplyXYRef?: React.MutableRefObject<((x: number, y: number, sender?: import("../hooks/useJam").PeerInfo) => void) | null>;
  peerList?: import("../hooks/useJam").PeerInfo[];
  myPeerId?: number | null;
  jamFxRef?: React.MutableRefObject<{ setFx: React.Dispatch<React.SetStateAction<EffectParams>>; setEffectOrder: React.Dispatch<React.SetStateAction<EffectName[]>> } | null>;
  inJam?: boolean;
  isListener?: boolean;
  pendingMutes?: Record<string, Set<string>>;
  /** Current sequencer step (0-15) for quantized jam XY loops */
  currentStep?: number;
  /** Receive a 1-bar XY loop from a jam peer */
  jamXYLoopRef?: React.MutableRefObject<{ x: number; y: number }[] | null>;
}

interface TouchPoint { x: number; y: number; age: number; senderId?: number; senderName?: string | null }

const PEER_COLORS = ["#66ff99", "#ff6699", "#6699ff", "#ffcc66"];
// Grid shows these effects — DUCK replaces HPF
const GRID_EFFECTS: EffectName[] = ["delay", "distortion", "reverb", "compressor", "duck", "chorus", "phaser", "bitcrusher"];

const EFFECT_LABELS: Record<EffectName, string> = {
  delay: "DELAY",
  distortion: "DIST",
  reverb: "REVERB",
  compressor: "COMP",
  highpass: "HPF",
  chorus: "CHORUS",
  phaser: "PHASER",
  bitcrusher: "CRUSH",
  duck: "DUCK",
};

export function KaosPanel({ devices, catalog, command, bpm, volume, onVolumeChange, channelVolumes, onChannelVolumeChange, presetState, getAnalyser, getChannelAnalyser, onMix, onExport, trackName, onTrackNameChange, onJamXY, jamApplyXYRef, peerList, myPeerId, jamFxRef, inJam, isListener, pendingMutes, currentStep, jamXYLoopRef }: Props) {
  const drumsDevice = devices.find(d => d.id === "preview_drums");
  const bassDevice = devices.find(d => d.id === "preview_bass");
  const synthDevice = devices.find(d => d.id === "preview_synth");
  const allPausedRef = useRef(false);
  const allPaused = devices.length > 0 && devices.every(d => d.paused);
  allPausedRef.current = allPaused;

  const [soloChannel, setSoloChannel] = useState<"drums" | "bass" | "synth" | null>(null);
  const [duckOn, setDuckOn] = useState(() => getBool("mpump-sidechain"));
  const [duckDepth, setDuckDepth] = useState(() => parseFloat(getItem("mpump-duck-depth", "0.85")));
  const [duckRelease, setDuckRelease] = useState(() => parseFloat(getItem("mpump-duck-release", "0.04")));
  const toggleSolo = (channel: "drums" | "bass" | "synth") => {
    const unsolo = soloChannel === channel;
    command({ type: "set_drums_mute", device: "preview_drums", muted: unsolo ? false : channel !== "drums" });
    command({ type: "set_drums_mute", device: "preview_synth", muted: unsolo ? false : channel !== "synth" });
    command({ type: "set_drums_mute", device: "preview_bass", muted: unsolo ? false : channel !== "bass" });
    setSoloChannel(unsolo ? null : channel);
  };


  const padRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const posRef = useRef<{ x: number; y: number } | null>(null);
  const trailsRef = useRef<TouchPoint[]>([]);
  const [trails, setTrails] = useState<TouchPoint[]>([]);
  const [chaos, setChaos] = useState(false);
  const chaosRef = useRef(false);
  const trailTimer = useRef<number>(0);
  const [fx, setFx] = useState<EffectParams>(() => {
    return getJSON<EffectParams>("mpump-effects", JSON.parse(JSON.stringify(DEFAULT_EFFECTS)));
  });
  const [editingFx, setEditingFx] = useState<EffectName | null>(null);
  const [showChainEditor, setShowChainEditor] = useState(false);
  const [effectOrder, setEffectOrder] = useState<EffectName[]>(() => getJSON("mpump-effect-order", DEFAULT_EFFECT_ORDER));
  // Expose fx setters to parent for jam sync
  if (jamFxRef) jamFxRef.current = { setFx, setEffectOrder };
  const [xyX, setXyX] = useState<XYTarget>("cutoff");
  const [xyY, setXyY] = useState<XYTarget>("resonance");

  // Video recording
  const [videoRec, setVideoRec] = useState(false);
  const videoHandle = useRef<VideoRecorderHandle | null>(null);
  const videoRecRef = useRef(false);

  // Facecam
  const facecamVideoRef = useRef<HTMLVideoElement | null>(null);
  const facecamStreamRef = useRef<MediaStream | null>(null);

  const startFacecam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 320, facingMode: "user" } });
      facecamStreamRef.current = stream;
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      facecamVideoRef.current = video;
    } catch { /* camera denied — silently skip */ }
  };

  const stopFacecam = () => {
    facecamStreamRef.current?.getTracks().forEach(t => t.stop());
    facecamStreamRef.current = null;
    facecamVideoRef.current = null;
  };

  // volume is passed via props from Layout (shared across all views)
  const longPressTimer = useRef<number>(0);
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const waveRafRef = useRef<number>(0);

  // Waveform/visualizer background in KAOS pad
  useEffect(() => {
    const canvas = waveCanvasRef.current;
    if (!canvas || !getAnalyser) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    // Default to waveform glow on first visit
    if (!getItem("mpump-kaos-wave")) {
      setItem("mpump-kaos-wave", "wave-glow");
    }
    const rotateModes = ["bars-mirror", "wave-glow", "circular", "spectrum"];
    let rotateIdx = Math.floor(Math.random() * rotateModes.length);
    let rotateTimer = 0;
    const ROTATE_INTERVAL = 30_000; // 30s per mode
    const getMode = () => {
      const stored = getItem("mpump-kaos-wave", "wave-glow");
      if (stored === "rotate") {
        const now = Date.now();
        if (now - rotateTimer > ROTATE_INTERVAL) {
          rotateTimer = now;
          rotateIdx = (rotateIdx + 1) % rotateModes.length;
        }
        return rotateModes[rotateIdx];
      }
      return stored;
    };
    let accentCache = "#66ff99";
    let accentAge = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx2d.scale(dpr, dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      waveRafRef.current = requestAnimationFrame(draw);
      const mode = getMode();
      const rect = canvas.getBoundingClientRect();
      const w = rect.width, h = rect.height;
      ctx2d.clearRect(0, 0, w, h);
      if (mode === "off" || mode === "false") return;

      const analyser = getAnalyser();
      if (!analyser) return;

      // Cache accent color
      accentAge++;
      if (accentAge > 60) {
        accentAge = 0;
        accentCache = getComputedStyle(document.documentElement).getPropertyValue("--preview").trim() || "#66ff99";
      }
      const accent = accentCache;

      if (mode === "wave-glow") {
        // Option A: Mirrored waveform + glow
        const data = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(data);
        const sliceW = w / data.length;
        const mid = h / 2;
        // Glow layers
        for (let pass = 3; pass >= 0; pass--) {
          ctx2d.beginPath();
          ctx2d.strokeStyle = accent;
          ctx2d.lineWidth = 1 + pass * 2;
          ctx2d.globalAlpha = pass === 0 ? 0.3 : 0.04;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] / 128.0 - 1);
            const y = mid + v * mid * 0.8;
            if (i === 0) ctx2d.moveTo(0, y); else ctx2d.lineTo(i * sliceW, y);
          }
          ctx2d.stroke();
          // Mirror
          ctx2d.beginPath();
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] / 128.0 - 1);
            const y = mid - v * mid * 0.8;
            if (i === 0) ctx2d.moveTo(0, y); else ctx2d.lineTo(i * sliceW, y);
          }
          ctx2d.stroke();
        }
        ctx2d.globalAlpha = 1;

      } else if (mode === "circular") {
        // Option B: Circular oscilloscope
        const data = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(data);
        const cx = w / 2, cy = h / 2;
        const radius = Math.min(w, h) * 0.35;
        ctx2d.strokeStyle = accent;
        ctx2d.lineWidth = 2;
        ctx2d.globalAlpha = 0.25;
        ctx2d.beginPath();
        for (let i = 0; i < data.length; i++) {
          const v = data[i] / 128.0 - 1;
          const angle = (i / data.length) * Math.PI * 2 - Math.PI / 2;
          const r = radius + v * radius * 0.5;
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;
          if (i === 0) ctx2d.moveTo(x, y); else ctx2d.lineTo(x, y);
        }
        ctx2d.closePath();
        ctx2d.stroke();
        // Inner glow fill
        ctx2d.fillStyle = accent;
        ctx2d.globalAlpha = 0.03;
        ctx2d.fill();
        ctx2d.globalAlpha = 1;

      } else if (mode === "spectrum") {
        // Option C: Frequency bars
        const freqData = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(freqData);
        const bars = 32;
        const step = Math.floor(freqData.length / bars);
        const barW = w / bars - 1;
        ctx2d.fillStyle = accent;
        for (let i = 0; i < bars; i++) {
          let sum = 0;
          for (let j = 0; j < step; j++) sum += freqData[i * step + j];
          const val = sum / step / 255;
          const barH = val * h * 0.9;
          ctx2d.globalAlpha = 0.15 + val * 0.25;
          ctx2d.fillRect(i * (barW + 1), h - barH, barW, barH);
        }
        ctx2d.globalAlpha = 1;

      } else {
        // Option D (default): Mirrored frequency bars + glow
        const freqData = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(freqData);
        const bars = 32;
        const step = Math.floor(freqData.length / bars);
        const barW = w / bars - 1;
        const mid = h / 2;
        ctx2d.fillStyle = accent;
        for (let i = 0; i < bars; i++) {
          let sum = 0;
          for (let j = 0; j < step; j++) sum += freqData[i * step + j];
          const val = sum / step / 255;
          const barH = val * mid * 0.85;
          ctx2d.globalAlpha = 0.12 + val * 0.2;
          // Top half (grows down from center)
          ctx2d.fillRect(i * (barW + 1), mid - barH, barW, barH);
          // Bottom half (grows up from center)
          ctx2d.fillRect(i * (barW + 1), mid, barW, barH);
          // Glow at peaks
          if (val > 0.5) {
            ctx2d.globalAlpha = (val - 0.5) * 0.15;
            ctx2d.fillRect(i * (barW + 1) - 1, mid - barH - 2, barW + 2, barH * 2 + 4);
          }
        }
        ctx2d.globalAlpha = 1;
      }

      // Draw video overlay (border, info, grid, trails, cursor, crosshairs, watermark)
      if (videoRecRef.current) {
        // Border
        ctx2d.strokeStyle = accentCache;
        ctx2d.globalAlpha = 0.4;
        ctx2d.lineWidth = 2;
        ctx2d.strokeRect(1, 1, w - 2, h - 2);
        ctx2d.globalAlpha = 1;

        // Genre/pattern info at top
        const info = videoInfoRef.current;
        const infoFont = Math.max(10, Math.round(w * 0.025));
        ctx2d.font = `bold ${infoFont}px monospace`;
        ctx2d.globalAlpha = 0.6;
        ctx2d.textBaseline = "top";
        ctx2d.fillStyle = "#fff";
        ctx2d.textAlign = "left";
        ctx2d.fillText(`DRUMS: ${info.drums}`, 10, 10);
        ctx2d.fillText(`SYNTH: ${info.synth}`, 10, 10 + infoFont * 1.4);
        ctx2d.fillText(`BASS: ${info.bass}`, 10, 10 + infoFont * 2.8);
        ctx2d.globalAlpha = 1;

        // Grid lines
        ctx2d.strokeStyle = accentCache;
        ctx2d.globalAlpha = 0.06;
        ctx2d.lineWidth = 1;
        for (let i = 1; i < 4; i++) {
          ctx2d.beginPath(); ctx2d.moveTo(w * i / 4, 0); ctx2d.lineTo(w * i / 4, h); ctx2d.stroke();
          ctx2d.beginPath(); ctx2d.moveTo(0, h * i / 4); ctx2d.lineTo(w, h * i / 4); ctx2d.stroke();
        }

        // Trails
        const now = Date.now();
        for (const t of trailsRef.current) {
          const age = (now - t.age) / 800;
          if (age > 1) continue;
          ctx2d.beginPath();
          ctx2d.arc(t.x * w, t.y * h, 6 * (1 - age), 0, Math.PI * 2);
          ctx2d.fillStyle = accentCache;
          ctx2d.globalAlpha = (1 - age) * 0.6;
          ctx2d.fill();
        }

        // Cursor + crosshairs
        const p = posRef.current;
        if (p) {
          ctx2d.strokeStyle = accentCache;
          ctx2d.globalAlpha = 0.2;
          ctx2d.lineWidth = 1;
          ctx2d.beginPath(); ctx2d.moveTo(0, p.y * h); ctx2d.lineTo(w, p.y * h); ctx2d.stroke();
          ctx2d.beginPath(); ctx2d.moveTo(p.x * w, 0); ctx2d.lineTo(p.x * w, h); ctx2d.stroke();
          // Cursor dot
          ctx2d.beginPath();
          ctx2d.arc(p.x * w, p.y * h, 8, 0, Math.PI * 2);
          ctx2d.fillStyle = accentCache;
          ctx2d.globalAlpha = 0.8;
          ctx2d.fill();
        }
        ctx2d.globalAlpha = 1;
      }

      // Facecam bubble during video recording
      if (videoRecRef.current && facecamVideoRef.current) {
        const vid = facecamVideoRef.current;
        const radius = Math.round(Math.min(w, h) * 0.12);
        const cx = radius + 14;
        const cy = h - radius - 14;
        ctx2d.save();
        ctx2d.beginPath();
        ctx2d.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx2d.clip();
        // Draw mirrored camera
        ctx2d.translate(cx + radius, cy - radius);
        ctx2d.scale(-1, 1);
        const size = radius * 2;
        const vw = vid.videoWidth || size;
        const vh = vid.videoHeight || size;
        const scale = Math.max(size / vw, size / vh);
        const sw = vw * scale;
        const sh = vh * scale;
        ctx2d.drawImage(vid, (size - sw) / 2, (size - sh) / 2, sw, sh);
        ctx2d.restore();
        // Circle border
        ctx2d.beginPath();
        ctx2d.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx2d.strokeStyle = accentCache;
        ctx2d.lineWidth = 2;
        ctx2d.globalAlpha = 0.7;
        ctx2d.stroke();
        ctx2d.globalAlpha = 1;
      }

      // Watermark during video recording
      if (videoRecRef.current) {
        const fontSize = Math.max(14, Math.round(w * 0.035));
        ctx2d.font = `bold ${fontSize}px monospace`;
        ctx2d.fillStyle = "#ffffff";
        ctx2d.globalAlpha = 0.5;
        ctx2d.textAlign = "right";
        ctx2d.textBaseline = "bottom";
        ctx2d.fillText("mpump.live", w - 10, h - 10);
        ctx2d.globalAlpha = 1;
      }
    };

    draw();
    return () => { cancelAnimationFrame(waveRafRef.current); ro.disconnect(); };
  }, [getAnalyser]);

  // Genre/pattern info
  const drumsGenres = catalog && drumsDevice ? getDeviceGenres(catalog, drumsDevice.id, drumsDevice.mode) : [];
  const synthGenres = catalog && synthDevice ? getDeviceGenres(catalog, synthDevice.id, synthDevice.mode) : [];
  const bassGenres = catalog && bassDevice ? getDeviceGenres(catalog, bassDevice.id, bassDevice.mode) : [];

  const videoInfoRef = useRef({ drums: "", synth: "", bass: "" });
  const dGenre = drumsGenres[drumsDevice?.genre_idx ?? 0]?.name ?? "---";
  const dPat = drumsGenres[drumsDevice?.genre_idx ?? 0]?.patterns[drumsDevice?.pattern_idx ?? 0]?.name ?? "---";
  const sGenre = synthGenres[synthDevice?.genre_idx ?? 0]?.name ?? "---";
  const sPat = synthGenres[synthDevice?.genre_idx ?? 0]?.patterns[synthDevice?.pattern_idx ?? 0]?.name ?? "---";
  const bGenre = bassGenres[bassDevice?.genre_idx ?? 0]?.name ?? "---";
  const bPat = bassGenres[bassDevice?.genre_idx ?? 0]?.patterns[bassDevice?.pattern_idx ?? 0]?.name ?? "---";
  videoInfoRef.current = { drums: `${dGenre} · ${dPat}`, synth: `${sGenre} · ${sPat}`, bass: `${bGenre} · ${bPat}` };

  // Nav helpers
  const navGenre = (deviceId: string, genres: { name: string }[], currentIdx: number, delta: number) => {
    if (!genres.length) return;
    command({ type: "set_genre", device: deviceId, idx: (currentIdx + delta + genres.length) % genres.length });
  };
  const navPattern = (deviceId: string, patterns: unknown[], currentIdx: number, delta: number) => {
    if (!patterns.length) return;
    command({ type: "set_pattern", device: deviceId, idx: (currentIdx + delta + patterns.length) % patterns.length });
  };

  // XY pad — configurable target mapping
  const applyXYValue = useCallback((target: XYTarget, nv: number) => {
    switch (target) {
      case "cutoff": {
        const cutoff = 100 + nv * 7900;
        for (const d of devices) {
          if (d.mode === "synth") command({ type: "set_synth_params", device: d.id, params: { cutoff, filterOn: true, filterType: "lowpass" } });
          else if (d.mode === "bass") command({ type: "set_synth_params", device: d.id, params: { cutoff, filterOn: true, filterType: "lowpass" } });
        }
        break;
      }
      case "resonance": {
        const resonance = 0.5 + nv * 19.5;
        for (const d of devices) {
          if (d.mode === "synth") command({ type: "set_synth_params", device: d.id, params: { resonance, filterOn: true } });
          else if (d.mode === "bass") command({ type: "set_synth_params", device: d.id, params: { resonance, filterOn: true } });
        }
        break;
      }
      case "distortion": command({ type: "set_effect", name: "distortion", params: { on: true, drive: 1 + nv * 99 } }); break;
      case "highpass": command({ type: "set_effect", name: "highpass", params: { on: true, cutoff: 20 + nv * 2000 } }); break;
      case "delay": command({ type: "set_effect", name: "delay", params: { on: true, mix: nv, feedback: 0.2 + nv * 0.6 } }); break;
      case "reverb": command({ type: "set_effect", name: "reverb", params: { on: true, mix: nv, decay: 0.5 + nv * 4 } }); break;
      case "bpm": command({ type: "set_bpm", bpm: Math.round(60 + nv * 180) }); break;
      case "swing": command({ type: "set_swing", swing: 0.5 + nv * 0.3 }); break;
      case "volume": command({ type: "set_volume", volume: nv }); break;
    }
  }, [devices, command]);

  const applyXY = useCallback((nx: number, ny: number) => {
    applyXYValue(xyX, nx);
    applyXYValue(xyY, 1 - ny); // invert Y so top = high
  }, [applyXYValue, xyX, xyY]);
  const applyXYRef = useRef(applyXY);
  applyXYRef.current = applyXY;
  // Expose applyXY + visual update + trails to parent for receiving remote jam XY
  if (jamApplyXYRef) jamApplyXYRef.current = (x: number, y: number, sender?) => {
    applyXY(x, y);
    setPos({ x, y });
    posRef.current = { x, y };
    const newTrails = [...trailsRef.current.slice(-30), { x, y, age: Date.now(), senderId: sender?.id, senderName: sender?.name }];
    trailsRef.current = newTrails;
    setTrails(newTrails);
  };

  // Gesture recording/playback
  const { gestureRec, gestureLoop, gesturePoints, gestureStart, startGestureRec, stopGestureRec, startGestureLoop, stopGestureLoop, clearGesture } = useGestureRecorder({ allPaused, allPausedRef, applyXYRef, posRef, trailsRef, setPos, setTrails });

  const lastXYTime = useRef(0);
  const handlePadMove = useCallback((clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    setPos({ x: nx, y: ny });
    posRef.current = { x: nx, y: ny };
    const myName = myPeerId != null ? (peerList || []).find(p => p.id === myPeerId)?.name : undefined;
    const newTrails = [...trailsRef.current.slice(-30), { x: nx, y: ny, age: Date.now(), senderId: myPeerId ?? undefined, senderName: myName }];
    trailsRef.current = newTrails;
    setTrails(newTrails);
    // Capture gesture points while recording (start timer on first touch)
    if (gestureRec) {
      if (gestureStart.current === 0) gestureStart.current = performance.now();
      gesturePoints.current.push({ t: performance.now() - gestureStart.current, x: nx, y: ny });
    }
    // Throttle commands to every 30ms
    const now = performance.now();
    if (now - lastXYTime.current > 30) {
      lastXYTime.current = now;
      applyXY(nx, ny);
      onJamXY?.(nx, ny);
    }
  }, [applyXY, gestureRec, onJamXY]);

  const onMouseDown = (e: React.MouseEvent) => {
    handlePadMove(e.clientX, e.clientY);
    const onMove = (ev: MouseEvent) => handlePadMove(ev.clientX, ev.clientY);
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); setPos(null); posRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  const onTouchStart = (e: React.TouchEvent) => { e.preventDefault(); handlePadMove(e.touches[0].clientX, e.touches[0].clientY); };
  const onTouchMove = (e: React.TouchEvent) => { e.preventDefault(); handlePadMove(e.touches[0].clientX, e.touches[0].clientY); };
  const onTouchEnd = () => { setPos(null); posRef.current = null; };

  // Trail decay + longPress cleanup
  useEffect(() => {
    trailTimer.current = window.setInterval(() => setTrails(p => p.filter(t => Date.now() - t.age < 800)), 100);
    return () => {
      window.clearInterval(trailTimer.current);
      window.clearTimeout(longPressTimer.current);
    };
  }, []);

  // Chaos mode — auto-MIX every 16 bars
  useEffect(() => {
    chaosRef.current = chaos;
    if (!chaos) return;
    const barMs = (60000 / bpm) * 4; // 1 bar in ms
    const intervalMs = barMs * 16;   // 16 bars
    if (onMix) onMix(); // trigger MIX immediately on activation
    const id = window.setInterval(() => { if (chaosRef.current && onMix) onMix(); }, intervalMs);
    return () => window.clearInterval(id);
  }, [chaos, bpm, onMix]);

  // Double-tap cycles visualizer, triple-tap randomizes
  const tapTimes = useRef<number[]>([]);
  const tapTimer = useRef(0);
  const VIZ_MODES = ["bars-mirror", "wave-glow", "circular", "spectrum", "off"] as const;
  const handlePadTap = () => {
    const now = Date.now();
    tapTimes.current = tapTimes.current.filter(t => now - t < 400);
    tapTimes.current.push(now);
    clearTimeout(tapTimer.current);
    tapTimer.current = window.setTimeout(() => {
      const count = tapTimes.current.length;
      if (count >= 3) {
        // Triple-tap: cycle visualizer
        const current = getItem("mpump-kaos-wave", "bars-mirror");
        const idx = VIZ_MODES.indexOf(current as typeof VIZ_MODES[number]);
        const next = VIZ_MODES[(idx + 1) % VIZ_MODES.length];
        setItem("mpump-kaos-wave", next);
      }
      tapTimes.current = [];
    }, 420);
  };

  const saveFx = (updated: EffectParams) => {
    setFx(updated);
    setJSON("mpump-effects", updated);
  };

  // Toggle effect (tap)
  const toggleDuck = () => {
    tapVibrate();
    const next = !duckOn;
    setDuckOn(next);
    setBool("mpump-sidechain", next);
    command({ type: "set_sidechain_duck", on: next });
  };

  const toggleFx = (name: EffectName) => {
    tapVibrate();
    const turningOn = !fx[name].on;
    const updated = { ...fx, [name]: { ...fx[name], on: turningOn } };
    saveFx(updated);
    command({ type: "set_effect", name, params: { on: turningOn } });

    // Update chain order: append to end on activate, remove on deactivate
    let newOrder = [...effectOrder];
    if (turningOn) {
      // Move to end of chain (or add if not present)
      newOrder = newOrder.filter(e => e !== name);
      newOrder.push(name);
    }
    // Keep inactive effects in their last position (don't remove from order array)
    setEffectOrder(newOrder);
    setJSON("mpump-effect-order", newOrder);
    command({ type: "set_effect_order", order: newOrder });
  };

  // Long-press to edit effect params
  const fxPointerDown = (name: EffectName) => {
    longPressTimer.current = window.setTimeout(() => {
      setEditingFx(name);
    }, 500);
  };
  const fxPointerUp = () => {
    window.clearTimeout(longPressTimer.current);
  };
  const fxContextMenu = (e: React.MouseEvent, name: EffectName) => {
    e.preventDefault();
    setEditingFx(name);
  };

  const updateFxParam = (name: EffectName, params: Record<string, unknown>) => {
    if (name === "duck") {
      // Duck routes to sidechain commands, not effect chain
      if (params.on != null) {
        const on = params.on as boolean;
        setDuckOn(on);
        setBool("mpump-sidechain", on);
        command({ type: "set_sidechain_duck", on });
      }
      if (params.depth != null || params.release != null) {
        const d = (params.depth as number) ?? duckDepth;
        const r = (params.release as number) ?? duckRelease;
        setDuckDepth(d); setDuckRelease(r);
        setItem("mpump-duck-depth", String(d));
        setItem("mpump-duck-release", String(r));
        command({ type: "set_duck_params", depth: d, release: r });
      }
      return;
    }
    const updated = { ...fx, [name]: { ...fx[name], ...params } };
    saveFx(updated);
    command({ type: "set_effect", name, params });
  };

  const handleVolume = (v: number) => {
    onVolumeChange(v);
  };

  // Auto-enable effect when selected as XY target, turn off previous
  const EFFECT_TARGETS: XYTarget[] = ["distortion", "highpass", "delay", "reverb"];
  const autoEnableEffect = (newTarget: XYTarget, oldTarget: XYTarget) => {
    // Turn off old effect if it's an effect-type target and differs from new
    if (oldTarget !== newTarget && EFFECT_TARGETS.includes(oldTarget)) {
      const name = oldTarget as EffectName;
      const updated = { ...fx, [name]: { ...fx[name], on: false } };
      saveFx(updated);
      command({ type: "set_effect", name, params: { on: false } });
    }
    // Turn on new effect if it's an effect-type target and not already on
    if (EFFECT_TARGETS.includes(newTarget)) {
      const name = newTarget as EffectName;
      if (!fx[name].on) {
        const updated = { ...fx, [name]: { ...fx[name], on: true } };
        saveFx(updated);
        command({ type: "set_effect", name, params: { on: true } });
      }
    }
  };

  const step = drumsDevice?.step ?? synthDevice?.step ?? -1;

  return (
    <div className={`kaos-layout ${isListener ? "kaos-listener" : ""}`}>
      <div className="kaos-left">
      {/* Unified channel cards: sound + genre + pattern in one block */}
      <div className="kaos-selectors">
        {drumsDevice && (
          <div className="kaos-selector" data-jam="drums">
            <div className="kaos-sel-header">
              {getChannelAnalyser && <SignalLed getAnalyser={() => getChannelAnalyser(9)} />}
              <span className="kaos-sel-label">DRUMS</span>
            </div>
            <div className="kaos-sel-row"><span className="kaos-sel-row-label">SOUND</span>
              <KaosDropdown className="kaos-dropdown-sound" value={presetState?.activeDrumKit ?? "0"} onChange={(v: string) => presetState?.onDrumKitChange(v)} options={[
                { group: "Machines", items: SAMPLE_PACKS.map(p => ({ label: p.name, value: `pack:${p.id}` })) },
                { group: "Presets", items: DRUM_KIT_PRESETS.map((p, i) => ({ label: p.name, value: String(i) })) },
              ]} />
              <button className={`sound-lock-btn ${presetState?.soundLock.drums ? "locked" : ""}`} title={presetState?.soundLock.drums ? "Unlock drum kit for MIX" : "Lock drum kit from MIX"} onClick={() => presetState?.setSoundLock(prev => ({ ...prev, drums: !prev.drums }))}>{presetState?.soundLock.drums ? "\u{1F512}" : "\u{1F513}"}</button>
            </div>
            <label className="ch-vol-inline"><span className="ch-vol-label">VOL</span><input type="range" className="kaos-ch-vol" min={0} max={1} step={0.01} value={channelVolumes[9] ?? 1} title={`Drums: ${Math.round((channelVolumes[9] ?? 1) * 100)}%`} onChange={(e) => onChannelVolumeChange(9, parseFloat(e.target.value))} /></label>
            <div className="kaos-sel-divider" />
            <div className="kaos-sel-row"><span className="kaos-sel-row-label">GENRE</span>
              <div className="kaos-sel-nav">
                <button className="kaos-sel-btn" title="Previous" onClick={() => navGenre(drumsDevice.id, drumsGenres, drumsDevice.genre_idx, -1)}>◀</button>
                <KaosDropdown options={[...drumsGenres].map((g, oi) => ({ label: g.name, value: oi })).sort((a, b) => a.label.localeCompare(b.label))} value={drumsDevice.genre_idx} onChange={(idx) => command({ type: "set_genre", device: drumsDevice.id, idx })} />
                <button className="kaos-sel-btn" title="Next" onClick={() => navGenre(drumsDevice.id, drumsGenres, drumsDevice.genre_idx, 1)}>▶</button>
              </div>
              <button className={`sound-lock-btn ${presetState?.patternLock.drums ? "locked" : ""}`} title={presetState?.patternLock.drums ? "Unlock drums pattern" : "Lock drums pattern"} onClick={() => presetState?.setPatternLock(prev => ({ ...prev, drums: !prev.drums }))}>{presetState?.patternLock.drums ? "\u{1F512}" : "\u{1F513}"}</button>
            </div>
            <div className="kaos-sel-row"><span className="kaos-sel-row-label kaos-label-pat">PATTERN</span>
              <div className="kaos-sel-nav">
                <button className="kaos-sel-btn" title="Previous" onClick={() => navPattern(drumsDevice.id, drumsGenres[drumsDevice.genre_idx]?.patterns ?? [], drumsDevice.pattern_idx, -1)}>◀</button>
                <KaosDropdown className="kaos-dropdown-pat" options={(drumsGenres[drumsDevice.genre_idx]?.patterns ?? []).map((p, i) => ({ label: p.name, value: i })).sort((a, b) => a.label.localeCompare(b.label))} value={drumsDevice.pattern_idx} onChange={(idx) => command({ type: "set_pattern", device: drumsDevice.id, idx })} />
                <button className="kaos-sel-btn" title="Next" onClick={() => navPattern(drumsDevice.id, drumsGenres[drumsDevice.genre_idx]?.patterns ?? [], drumsDevice.pattern_idx, 1)}>▶</button>
              </div>
              {presetState?.patternLock.drums && <button className={`sound-lock-btn ${presetState?.stepPatternLock.drums ? "locked" : ""}`} title={presetState?.stepPatternLock.drums ? "Unlock drums pattern from MIX" : "Lock drums pattern from MIX"} onClick={() => presetState?.setStepPatternLock(prev => ({ ...prev, drums: !prev.drums }))}>{presetState?.stepPatternLock.drums ? "\u{1F512}" : "\u{1F513}"}</button>}
            </div>
            <div className="kaos-sel-actions">
              <button className={`kaos-action-btn ${drumsDevice.drumsMuted ? "muted" : ""} ${pendingMutes?.[drumsDevice.id]?.has("drums_mute") ? "pending" : ""}`} title={drumsDevice.drumsMuted ? "Unmute drums" : "Mute drums"} onClick={() => { setSoloChannel(null); command({ type: "toggle_drums_mute", device: drumsDevice.id }); }}>
                {drumsDevice.drumsMuted ? "MUTED" : "MUTE"}
              </button>
              <button className={`kaos-action-btn ${soloChannel === "drums" ? "solo-on" : ""}`} title={soloChannel === "drums" ? "Unsolo" : "Solo drums"} onClick={() => toggleSolo("drums")}>
                SOLO
              </button>
            </div>
          </div>
        )}
        {bassDevice && (
          <div className="kaos-selector" data-jam="bass">
            <div className="kaos-sel-header">
              {getChannelAnalyser && <SignalLed getAnalyser={() => getChannelAnalyser(1)} />}
              <span className="kaos-sel-label">BASS</span>
            </div>
            <div className="kaos-sel-row"><span className="kaos-sel-row-label">SOUND</span>
              <KaosDropdown className="kaos-dropdown-sound" value={presetState?.activeBass ?? "0"} onChange={(v: string) => presetState?.onBassChange(v)} options={groupPresets(BASS_PRESETS).map(([g, items]) => ({ group: g || "Presets", items: items.map(([i, p]) => ({ label: p.name, value: String(i) })) }))} />
              <button className={`sound-lock-btn ${presetState?.soundLock.bass ? "locked" : ""}`} title={presetState?.soundLock.bass ? "Unlock bass for MIX" : "Lock bass from MIX"} onClick={() => presetState?.setSoundLock(prev => ({ ...prev, bass: !prev.bass }))}>{presetState?.soundLock.bass ? "\u{1F512}" : "\u{1F513}"}</button>
            </div>
            <label className="ch-vol-inline"><span className="ch-vol-label">VOL</span><input type="range" className="kaos-ch-vol" min={0} max={1} step={0.01} value={channelVolumes[1] ?? 1} title={`Bass: ${Math.round((channelVolumes[1] ?? 1) * 100)}%`} onChange={(e) => onChannelVolumeChange(1, parseFloat(e.target.value))} /></label>
            <div className="kaos-sel-divider" />
            <div className="kaos-sel-row"><span className="kaos-sel-row-label">GENRE</span>
              <div className="kaos-sel-nav">
                <button className="kaos-sel-btn" title="Previous" onClick={() => navGenre(bassDevice.id, bassGenres, bassDevice.genre_idx, -1)}>◀</button>
                <KaosDropdown options={[...bassGenres].map((g, oi) => ({ label: g.name, value: oi })).sort((a, b) => a.label.localeCompare(b.label))} value={bassDevice.genre_idx} onChange={(idx) => command({ type: "set_genre", device: bassDevice.id, idx })} />
                <button className="kaos-sel-btn" title="Next" onClick={() => navGenre(bassDevice.id, bassGenres, bassDevice.genre_idx, 1)}>▶</button>
              </div>
              <button className={`sound-lock-btn ${presetState?.patternLock.bass ? "locked" : ""}`} title={presetState?.patternLock.bass ? "Unlock bass pattern" : "Lock bass pattern"} onClick={() => presetState?.setPatternLock(prev => ({ ...prev, bass: !prev.bass }))}>{presetState?.patternLock.bass ? "\u{1F512}" : "\u{1F513}"}</button>
            </div>
            <div className="kaos-sel-row"><span className="kaos-sel-row-label kaos-label-pat">PATTERN</span>
              <div className="kaos-sel-nav">
                <button className="kaos-sel-btn" title="Previous" onClick={() => navPattern(bassDevice.id, bassGenres[bassDevice.genre_idx]?.patterns ?? [], bassDevice.pattern_idx, -1)}>◀</button>
                <KaosDropdown className="kaos-dropdown-pat" options={(bassGenres[bassDevice.genre_idx]?.patterns ?? []).map((p, i) => ({ label: p.name, value: i })).sort((a, b) => a.label.localeCompare(b.label))} value={bassDevice.pattern_idx} onChange={(idx) => command({ type: "set_pattern", device: bassDevice.id, idx })} />
                <button className="kaos-sel-btn" title="Next" onClick={() => navPattern(bassDevice.id, bassGenres[bassDevice.genre_idx]?.patterns ?? [], bassDevice.pattern_idx, 1)}>▶</button>
              </div>
              {presetState?.patternLock.bass && <button className={`sound-lock-btn ${presetState?.stepPatternLock.bass ? "locked" : ""}`} title={presetState?.stepPatternLock.bass ? "Unlock bass pattern from MIX" : "Lock bass pattern from MIX"} onClick={() => presetState?.setStepPatternLock(prev => ({ ...prev, bass: !prev.bass }))}>{presetState?.stepPatternLock.bass ? "\u{1F512}" : "\u{1F513}"}</button>}
            </div>
            <div className="kaos-sel-actions">
              <button className={`kaos-action-btn ${bassDevice.drumsMuted ? "muted" : ""} ${pendingMutes?.[bassDevice.id]?.has("drums_mute") ? "pending" : ""}`} title={bassDevice.drumsMuted ? "Unmute bass" : "Mute bass"} onClick={() => { setSoloChannel(null); command({ type: "toggle_drums_mute", device: bassDevice.id }); }}>
                {bassDevice.drumsMuted ? "MUTED" : "MUTE"}
              </button>
              <button className={`kaos-action-btn ${soloChannel === "bass" ? "solo-on" : ""}`} title={soloChannel === "bass" ? "Unsolo" : "Solo bass"} onClick={() => toggleSolo("bass")}>
                SOLO
              </button>
            </div>
          </div>
        )}
        {synthDevice && (
          <div className="kaos-selector" data-jam="synth">
            <div className="kaos-sel-header">
              {getChannelAnalyser && <SignalLed getAnalyser={() => getChannelAnalyser(0)} />}
              <span className="kaos-sel-label">SYNTH</span>
            </div>
            <div className="kaos-sel-row"><span className="kaos-sel-row-label">SOUND</span>
              <KaosDropdown className="kaos-dropdown-sound" value={presetState?.activeSynth ?? "0"} onChange={(v: string) => presetState?.onSynthChange(v)} options={groupPresets(SYNTH_PRESETS).map(([g, items]) => ({ group: g || "Presets", items: items.map(([i, p]) => ({ label: p.name, value: String(i) })) }))} />
              <button className={`sound-lock-btn ${presetState?.soundLock.synth ? "locked" : ""}`} title={presetState?.soundLock.synth ? "Unlock synth for MIX" : "Lock synth from MIX"} onClick={() => presetState?.setSoundLock(prev => ({ ...prev, synth: !prev.synth }))}>{presetState?.soundLock.synth ? "\u{1F512}" : "\u{1F513}"}</button>
            </div>
            <label className="ch-vol-inline"><span className="ch-vol-label">VOL</span><input type="range" className="kaos-ch-vol" min={0} max={1} step={0.01} value={channelVolumes[0] ?? 1} title={`Synth: ${Math.round((channelVolumes[0] ?? 1) * 100)}%`} onChange={(e) => onChannelVolumeChange(0, parseFloat(e.target.value))} /></label>
            <div className="kaos-sel-divider" />
            <div className="kaos-sel-row"><span className="kaos-sel-row-label">GENRE</span>
              <div className="kaos-sel-nav">
                <button className="kaos-sel-btn" title="Previous" onClick={() => navGenre(synthDevice.id, synthGenres, synthDevice.genre_idx, -1)}>◀</button>
                <KaosDropdown options={[...synthGenres].map((g, oi) => ({ label: g.name, value: oi })).sort((a, b) => a.label.localeCompare(b.label))} value={synthDevice.genre_idx} onChange={(idx) => command({ type: "set_genre", device: synthDevice.id, idx })} />
                <button className="kaos-sel-btn" title="Next" onClick={() => navGenre(synthDevice.id, synthGenres, synthDevice.genre_idx, 1)}>▶</button>
              </div>
              <button className={`sound-lock-btn ${presetState?.patternLock.synth ? "locked" : ""}`} title={presetState?.patternLock.synth ? "Unlock synth pattern" : "Lock synth pattern"} onClick={() => presetState?.setPatternLock(prev => ({ ...prev, synth: !prev.synth }))}>{presetState?.patternLock.synth ? "\u{1F512}" : "\u{1F513}"}</button>
            </div>
            <div className="kaos-sel-row"><span className="kaos-sel-row-label kaos-label-pat">PATTERN</span>
              <div className="kaos-sel-nav">
                <button className="kaos-sel-btn" title="Previous" onClick={() => navPattern(synthDevice.id, synthGenres[synthDevice.genre_idx]?.patterns ?? [], synthDevice.pattern_idx, -1)}>◀</button>
                <KaosDropdown className="kaos-dropdown-pat" options={(synthGenres[synthDevice.genre_idx]?.patterns ?? []).map((p, i) => ({ label: p.name, value: i })).sort((a, b) => a.label.localeCompare(b.label))} value={synthDevice.pattern_idx} onChange={(idx) => command({ type: "set_pattern", device: synthDevice.id, idx })} />
                <button className="kaos-sel-btn" title="Next" onClick={() => navPattern(synthDevice.id, synthGenres[synthDevice.genre_idx]?.patterns ?? [], synthDevice.pattern_idx, 1)}>▶</button>
              </div>
              {presetState?.patternLock.synth && <button className={`sound-lock-btn ${presetState?.stepPatternLock.synth ? "locked" : ""}`} title={presetState?.stepPatternLock.synth ? "Unlock synth pattern from MIX" : "Lock synth pattern from MIX"} onClick={() => presetState?.setStepPatternLock(prev => ({ ...prev, synth: !prev.synth }))}>{presetState?.stepPatternLock.synth ? "\u{1F512}" : "\u{1F513}"}</button>}
            </div>
            <div className="kaos-sel-actions">
              <button className={`kaos-action-btn ${synthDevice.drumsMuted ? "muted" : ""} ${pendingMutes?.[synthDevice.id]?.has("drums_mute") ? "pending" : ""}`} title={synthDevice.drumsMuted ? "Unmute synth" : "Mute synth"} onClick={() => { setSoloChannel(null); command({ type: "toggle_drums_mute", device: synthDevice.id }); }}>
                {synthDevice.drumsMuted ? "MUTED" : "MUTE"}
              </button>
              <button className={`kaos-action-btn ${soloChannel === "synth" ? "solo-on" : ""}`} title={soloChannel === "synth" ? "Unsolo" : "Solo synth"} onClick={() => toggleSolo("synth")}>
                SOLO
              </button>
            </div>
          </div>
        )}
      </div>
      </div>{/* /kaos-left */}

      <div className="kaos-right">
      {/* XY Pad */}
      <div
        ref={padRef}
        className="kaos-pad"
        onMouseDown={isListener ? undefined : onMouseDown}
        onTouchStart={isListener ? undefined : onTouchStart}
        onTouchMove={isListener ? undefined : onTouchMove}
        onTouchEnd={isListener ? undefined : onTouchEnd}
        onClick={isListener ? undefined : handlePadTap}
        style={isListener ? { cursor: "default" } : undefined}
      >
        <canvas ref={waveCanvasRef} className="kaos-wave-bg" />
        <div className="kaos-grid" />
        {trails.map((t, i) => {
          const peerIdx = getBool("mpump-jam-identity", true) && t.senderId != null ? (peerList || []).findIndex(p => p.id === t.senderId) : -1;
          const color = peerIdx >= 0 ? PEER_COLORS[peerIdx % PEER_COLORS.length] : undefined;
          const opacity = Math.max(0, 1 - (Date.now() - t.age) / 800);
          return (
            <div key={i} className="kaos-trail" style={{ left: `${t.x * 100}%`, top: `${t.y * 100}%`, opacity, background: color }}>
              {getBool("mpump-jam-identity", true) && t.senderName && opacity > 0.2 && <span className="kaos-trail-name" style={{ color: color || "var(--preview)" }}>{t.senderName}</span>}
            </div>
          );
        })}
        {pos && (
          <>
            <div className="kaos-crosshair-h" style={{ top: `${pos.y * 100}%` }} />
            <div className="kaos-crosshair-v" style={{ left: `${pos.x * 100}%` }} />
            <div className="kaos-cursor" style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }} />
          </>
        )}
        <select className="kaos-xy-sel kaos-xy-x" value={xyX} onChange={(e) => { const t = e.target.value as XYTarget; autoEnableEffect(t, xyX); setXyX(t); }}>
          {XY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="kaos-xy-sel kaos-xy-y" value={xyY} onChange={(e) => { const t = e.target.value as XYTarget; autoEnableEffect(t, xyY); setXyY(t); }}>
          {XY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {step >= 0 && step % 4 === 0 && <div className="kaos-pulse" />}
        {/* Gesture REC / LOOP / CLEAR — inside pad, top-right (disabled during jam) */}
        {!inJam && <div className="kaos-gesture">
          <button
            className={`kaos-gesture-btn ${gestureRec ? "active" : ""}`}
            onClick={(e) => { e.stopPropagation(); gestureRec ? stopGestureRec() : startGestureRec(); }}
            title={gestureRec ? "Stop recording gesture" : "Record XY gesture"}
          >
            {gestureRec ? "⏹" : "⏺"}
          </button>
          <button
            className={`kaos-gesture-btn ${gestureLoop ? "active" : ""}`}
            onClick={(e) => { e.stopPropagation(); gestureLoop ? stopGestureLoop() : startGestureLoop(); }}
            disabled={gesturePoints.current.length < 2 && !gestureLoop}
            title={gestureLoop ? "Stop gesture loop" : "Loop recorded gesture"}
          >
            {gestureLoop ? "⏹" : "↻"}
          </button>
          <button
            className="kaos-gesture-btn"
            onClick={(e) => { e.stopPropagation(); clearGesture(); }}
            disabled={gesturePoints.current.length === 0 && !gestureLoop}
            title="Clear recorded gesture"
          >
            ✕
          </button>
        </div>}
      </div>

      {/* Step indicator ring */}
      <div className="kaos-steps">
        {Array.from({ length: 16 }, (_, i) => (
          <div
            key={i}
            className={`kaos-step-dot ${step === i ? "current" : ""} ${step >= 0 && i % 4 === 0 ? "beat" : ""}`}
          />
        ))}
      </div>
      </div>{/* /kaos-right */}

      {/* Effects rack */}
      <div className="kaos-fx">
        <div className="kaos-fx-label">EFFECTS <span className="kaos-fx-hint">tap on/off · hold or right-click to edit</span></div>
        <div className="kaos-fx-grid" data-jam="effects">
          {GRID_EFFECTS.map((n) => {
            const isOn = n === "duck" ? duckOn : fx[n].on;
            const chainIdx = n !== "duck" && fx[n].on ? effectOrder.filter(e => fx[e].on).indexOf(n) : -1;
            return (
              <button
                key={n}
                className={`kaos-fx-btn ${isOn ? "active" : ""}`}
                style={{ position: "relative" }}
                title={`${EFFECT_LABELS[n]}: ${isOn ? "on" : "off"} (hold or right-click to edit)`}
                onClick={() => n === "duck" ? toggleDuck() : toggleFx(n)}
                onContextMenu={(e) => fxContextMenu(e, n)}
                onPointerDown={() => fxPointerDown(n)}
                onPointerUp={fxPointerUp}
                onPointerLeave={fxPointerUp}
              >
                {EFFECT_LABELS[n]}
                {chainIdx >= 0 && <span className="kaos-fx-badge">{chainIdx + 1}</span>}
              </button>
            );
          })}
        </div>
        {/* Chain order — click to reorder */}
        <div className="kaos-fx-chain-row">
          <div className="kaos-fx-chain" onClick={() => setShowChainEditor(true)} title="Click to reorder effect chain">
            Chain: {effectOrder.filter(n => fx[n].on).map(n => EFFECT_LABELS[n]).join(" → ") || "none"}
          </div>
          <button className="kaos-fx-reset" title="Reset all effects to defaults" onClick={() => {
            saveFx({ ...DEFAULT_EFFECTS });
            for (const name of Object.keys(DEFAULT_EFFECTS) as EffectName[]) {
              if (name === "duck") {
                setDuckOn(false); setBool("mpump-sidechain", false);
                setDuckDepth(0.85); setDuckRelease(0.04);
                setItem("mpump-duck-depth", "0.85"); setItem("mpump-duck-release", "0.04");
                command({ type: "set_sidechain_duck", on: false });
                command({ type: "set_duck_params", depth: 0.85, release: 0.04 });
              } else {
                command({ type: "set_effect", name, params: DEFAULT_EFFECTS[name] });
              }
            }
          }}>reset</button>
        </div>
      </div>

      {showChainEditor && (
        <ChainEditor
          order={effectOrder}
          activeEffects={new Set(effectOrder.filter(n => fx[n].on))}
          onSave={(order) => {
            setEffectOrder(order);
            setJSON("mpump-effect-order", order);
            command({ type: "set_effect_order", order });
          }}
          onClose={() => setShowChainEditor(false)}
        />
      )}

      {/* Bottom bar */}
      <div className="kaos-bottom">
        <button className={`kaos-btn kaos-chaos ${chaos ? "active" : ""}`} title="Auto-MIX every 16 bars" onClick={() => { pressVibrate(); setChaos(!chaos); }}>
          {chaos ? "CHAOS ON" : "CHAOS"}
        </button>
        <button className="kaos-btn" title="Export MIDI file" onClick={() => {
          if (!confirm("Export current patterns as MIDI files?")) return;
          if (drumsDevice) exportDrumMidi(drumsDevice.drum_data, bpm, "mpump-drums.mid");
          if (bassDevice) exportMelodicMidi(bassDevice.pattern_data, 45, bpm, "mpump-bass.mid");
          if (synthDevice) exportMelodicMidi(synthDevice.pattern_data, 45, bpm, "mpump-synth.mid");
        }}>MIDI</button>
        <button
          className={`kaos-btn ${getBool("mpump-humanize") ? "active" : ""}`}
          title={getBool("mpump-humanize") ? "Humanize: ON" : "Humanize: OFF"}
          onClick={() => {
            const next = !getBool("mpump-humanize");
            setBool("mpump-humanize", next);
            command({ type: "set_humanize", on: next });
          }}
        >{getBool("mpump-humanize") ? "● HUM" : "HUM"}</button>
        {getBool("mpump-video-rec") && <button
          className={`kaos-btn ${videoRec ? "active" : ""}`}
          title={videoRec ? "Stop video recording" : "Record video (canvas + audio)"}
          onClick={() => {
            if (videoRec) {
              videoHandle.current?.stop();
              videoHandle.current = null;
              videoRecRef.current = false;
              setVideoRec(false);
              stopFacecam();
            } else {
              const canvas = waveCanvasRef.current;
              const analyser = getAnalyser?.();
              if (!canvas || !analyser) return;
              setVideoRec(true);
              videoRecRef.current = true;
              startFacecam();
              const handle = startVideoRecording(canvas, analyser, (blob, ext) => {
                saveVideo(blob, ext);
                onExport?.();
              });
              videoHandle.current = handle;
              if (!handle) { setVideoRec(false); videoRecRef.current = false; }
              // Auto-stop after N bars (synced to beat)
              const bars = parseInt(getItem("mpump-video-bars", "64"));
              if (bars > 0 && handle) {
                const barMs = (60000 / bpm) * 4 * bars;
                setTimeout(() => {
                  if (videoRecRef.current) {
                    videoHandle.current?.stop();
                    videoHandle.current = null;
                    videoRecRef.current = false;
                    setVideoRec(false);
                    stopFacecam();
                  }
                }, barMs);
              }
            }
          }}
        >{videoRec ? "🔴 REC" : "Video REC"} · <span
          onClick={(e) => {
            e.stopPropagation();
            if (videoRec) return;
            const opts = ["4", "8", "16", "64", "0"];
            const cur = getItem("mpump-video-bars", "64");
            const next = opts[(opts.indexOf(cur) + 1) % opts.length];
            setItem("mpump-video-bars", next);
          }}
          title="Click to cycle: 4/8/16/64/∞ bars"
          style={{ cursor: videoRec ? "default" : "pointer" }}
        >{(() => { const b = getItem("mpump-video-bars", "64"); return b === "0" ? "∞" : b; })()}</span></button>}
      </div>

      {/* Effect editor modal */}
      {editingFx && (
        <EffectEditor
          name={editingFx}
          params={editingFx === "duck" ? { on: duckOn, depth: duckDepth, release: duckRelease } : fx[editingFx]}
          onUpdate={(p) => updateFxParam(editingFx, p)}
          onClose={() => setEditingFx(null)}
        />
      )}

    </div>
  );
}
