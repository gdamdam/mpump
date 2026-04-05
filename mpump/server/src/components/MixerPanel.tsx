import { useRef, useEffect, useState, useCallback } from "react";
import type { ClientMessage, DeviceState, EffectParams, EffectName } from "../types";
import { DEFAULT_EFFECTS } from "../types";
import { tapVibrate } from "../utils/haptic";
import { getJSON, setJSON, getBool } from "../utils/storage";
import { EffectEditor } from "./EffectEditor";
import { ClipIndicator } from "./VuMeter";

type AntiClipMode = "off" | "limiter" | "hybrid";

// ── Channel definitions ─────────────────────────────────────────────────

interface ChannelDef {
  label: string;
  ch: number;
  muteDevice: "preview_drums" | "preview_bass" | "preview_synth";
  muteType: "toggle_drums_mute" | "toggle_bass_mute";
  muteField: "drumsMuted";
  soloKey: "drums" | "bass" | "synth";
}

const INSTRUMENT_CHANNELS: ChannelDef[] = [
  { label: "DRUMS", ch: 9, muteDevice: "preview_drums", muteType: "toggle_drums_mute", muteField: "drumsMuted" as const, soloKey: "drums" },
  { label: "BASS", ch: 1, muteDevice: "preview_bass", muteType: "toggle_bass_mute", muteField: "drumsMuted" as const, soloKey: "bass" },
  { label: "SYNTH", ch: 0, muteDevice: "preview_synth", muteType: "toggle_drums_mute", muteField: "drumsMuted", soloKey: "synth" },
];

interface Props {
  volume: number;
  onVolumeChange: (v: number) => void;
  channelVolumes: Record<number, number>;
  onChannelVolumeChange: (ch: number, v: number) => void;
  devices: DeviceState[];
  command: (msg: ClientMessage) => void;
  antiClipMode: AntiClipMode;
  getAnalyser?: () => AnalyserNode | null;
  getChannelAnalyser?: (ch: number) => AnalyserNode | null;
  pendingMutes?: Record<string, Set<string>>;
  onShowDrumKit?: () => void;
  soloChannel?: "drums" | "bass" | "synth" | null;
  onSoloChange?: (ch: "drums" | "bass" | "synth" | null) => void;
  getMixerState?: () => { drive: number; eq: { low: number; mid: number; high: number }; width: number; lowCut: number; mbOn: boolean; mbExcludeDrums: boolean };
}

// ── Helpers ──────────────────────────────────────────────────────────────

const DB_FLOOR = -40;
const DB_MAX = 3;
const DB_RANGE = DB_MAX - DB_FLOOR;
const ATTACK_COEFF = 0.12;
const RELEASE_COEFF = 0.96;
const CLIP_HOLD_MS = 2000;

function toDB(linear: number): number {
  if (linear < 1e-6) return DB_FLOOR;
  return Math.max(DB_FLOOR, Math.min(DB_MAX, 20 * Math.log10(linear)));
}

function volToDb(v: number): string {
  if (v < 0.001) return "-\u221E";
  const db = 20 * Math.log10(v);
  return `${db > 0 ? "+" : ""}${db.toFixed(1)}`;
}

function panLabel(v: number): string {
  if (Math.abs(v) < 0.03) return "C";
  const pct = Math.round(Math.abs(v) * 50);
  return v < 0 ? `L${pct}` : `R${pct}`;
}

// ── Effects bar constants ───────────────────────────────────────────────

const EFFECT_LABELS: Record<EffectName, string> = {
  delay: "DLY",
  distortion: "DIST",
  reverb: "REV",
  compressor: "CMP",
  highpass: "HPF",
  chorus: "CHR",
  phaser: "PHS",
  bitcrusher: "CRUSH",
  duck: "DUCK",
  flanger: "FLNG",
  tremolo: "TREM",
};

const DEFAULT_EFFECT_ORDER: EffectName[] = ["compressor", "highpass", "distortion", "bitcrusher", "chorus", "phaser", "flanger", "delay", "reverb", "tremolo"];

// ── Master Modal (EQ / Drive) ────────────────────────────────────────────

function MasterModal({ title, onClose, getAnalyser, children }: {
  title: string;
  onClose: () => void;
  getAnalyser: () => AnalyserNode | null;
  children: React.ReactNode;
}) {
  const dbRef = useRef<HTMLSpanElement>(null);
  const clipRef = useRef<HTMLSpanElement>(null);
  const rafRef = useRef(0);
  const smoothed = useRef(0);
  const clipTime = useRef(0);
  const mmBuf = useRef<Uint8Array | null>(null);

  useEffect(() => {
    let frameSkip3 = 0;
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      if (++frameSkip3 % 6 !== 0) return; // ~10fps — reduce analyser pressure
      const analyser = getAnalyser();
      if (analyser) {
        const size = analyser.fftSize;
        if (!mmBuf.current || mmBuf.current.length !== size) mmBuf.current = new Uint8Array(size);
        analyser.getByteTimeDomainData(mmBuf.current);
        let sumSq = 0;
        for (let i = 0; i < size; i++) { const s = (mmBuf.current[i] - 128) / 128; sumSq += s * s; }
        const rms = Math.sqrt(sumSq / size);
        smoothed.current = rms > smoothed.current ? 0.3 * smoothed.current + 0.7 * rms : 0.92 * smoothed.current + 0.08 * rms;
      } else {
        smoothed.current *= 0.95;
      }
      const db = toDB(smoothed.current);
      const now = performance.now();
      if (db >= -0.5) clipTime.current = now;
      const clipping = now - clipTime.current < CLIP_HOLD_MS && clipTime.current > 0;
      if (dbRef.current) dbRef.current.textContent = db > DB_FLOOR ? `${db.toFixed(1)} dB` : "-\u221E dB";
      if (clipRef.current) {
        clipRef.current.style.opacity = clipping ? "1" : "0.4";
        clipRef.current.style.color = clipping ? "#ff4444" : "var(--preview)";
      }
    };
    tick();
    return () => cancelAnimationFrame(rafRef.current);
  }, [getAnalyser]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fx-editor-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fx-editor">
        <div className="fx-editor-header">
          <span className="fx-editor-title">{title}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span ref={dbRef} style={{ fontSize: 10, fontFamily: "monospace", color: "var(--preview)", opacity: 0.7 }}>{"-\u221E dB"}</span>
            <span ref={clipRef} style={{ fontSize: 9, fontWeight: 700, opacity: 0.4, color: "var(--preview)", transition: "opacity 0.15s" }}>CLIP</span>
          </div>
        </div>
        {children}
        <button className="mx-modal-close" onClick={onClose}>CLOSE</button>
      </div>
    </div>
  );
}

// ── Mixer Panel ─────────────────────────────────────────────────────────

export function MixerPanel({
  volume, onVolumeChange, channelVolumes, onChannelVolumeChange,
  devices, command, antiClipMode, getAnalyser, getChannelAnalyser, pendingMutes, onShowDrumKit,
  soloChannel: soloProp, onSoloChange, getMixerState,
}: Props) {

  // Pro controls visibility (LIMIT, MB, MS, DRV)
  const [showPro, setShowPro] = useState(() => getBool("mpump-mixer-advanced", true));
  useEffect(() => {
    const h = () => setShowPro(getBool("mpump-mixer-advanced", true));
    window.addEventListener("mpump-settings-changed", h);
    return () => window.removeEventListener("mpump-settings-changed", h);
  }, []);

  // Throttled command for continuous controls (sliders) — prevents audio thread overload
  const pendingCmd = useRef<ClientMessage | null>(null);
  const cmdTimer = useRef(0);
  const throttledCmd = useCallback((msg: ClientMessage) => {
    pendingCmd.current = msg;
    if (cmdTimer.current) return; // already scheduled
    command(msg); // send first one immediately
    cmdTimer.current = window.setTimeout(() => {
      cmdTimer.current = 0;
      if (pendingCmd.current) command(pendingCmd.current);
    }, 60);
  }, [command]);

  const getDevice = (id: string) => devices.find(d => d.id === id);
  const isMuted = (def: ChannelDef) => {
    const dev = getDevice(def.muteDevice);
    return dev ? dev[def.muteField] : false;
  };

  // Solo — use prop from Layout if available, otherwise local state
  const [localSolo, setLocalSolo] = useState<"drums" | "bass" | "synth" | null>(null);
  const soloChannel = soloProp !== undefined ? soloProp : localSolo;
  const setSoloChannel = (v: "drums" | "bass" | "synth" | null) => { setLocalSolo(v); onSoloChange?.(v); };
  const toggleSolo = (key: "drums" | "bass" | "synth") => {
    const unsolo = soloChannel === key;
    command({ type: "set_drums_mute", device: "preview_drums", muted: unsolo ? false : key !== "drums" });
    command({ type: "set_drums_mute", device: "preview_synth", muted: unsolo ? false : key !== "synth" });
    command({ type: "set_drums_mute", device: "preview_bass", muted: unsolo ? false : key !== "bass" });
    setSoloChannel(unsolo ? null : key);
  };

  // Pan
  const [pans, setPans] = useState<Record<number, number>>({ 9: 0, 1: 0, 0: 0 });
  const setPan = (ch: number, val: number) => {
    setPans(prev => ({ ...prev, [ch]: val }));
    command({ type: "set_channel_pan" as never, channel: ch, pan: val } as never);
  };

  // Mono
  const [chMono, setChMono] = useState<Record<number, boolean>>({});
  const toggleChMono = (ch: number) => {
    const next = !chMono[ch];
    setChMono(prev => ({ ...prev, [ch]: next }));
    command({ type: "set_channel_mono", channel: ch, on: next });
  };

  // Drive
  const [drive, setDrive] = useState(() => getMixerState?.().drive ?? 0);
  const [eqLow, setEqLow] = useState(1); // match AudioPort default
  const [eqMid, setEqMid] = useState(0); // flat — mud cut on bass channel only
  const [eqHigh, setEqHigh] = useState(0); // neutral
  const [mbOn, setMbOn] = useState(() => getMixerState?.().mbOn ?? false);
  const [mbAmount, setMbAmount] = useState(0.25);
  const [mbExcludeDrums, setMbExcludeDrums] = useState(() => getMixerState?.().mbExcludeDrums ?? true);
  const [showMbModal, setShowMbModal] = useState(false);
  const [width, setWidth] = useState(0.5);
  const [lowCut, setLowCut] = useState(0);

  // Mixer undo — snapshot-based, Cmd+Z restores previous state
  type MixerSnapshot = { drive: number; eqLow: number; eqMid: number; eqHigh: number; mbOn: boolean; mbAmount: number; width: number; lowCut: number; chEQ: typeof chEQ };
  const mixerUndoStack = useRef<MixerSnapshot[]>([]);
  const pushMixerUndo = () => {
    mixerUndoStack.current.push({ drive, eqLow, eqMid, eqHigh, mbOn, mbAmount, width, lowCut, chEQ });
    if (mixerUndoStack.current.length > 20) mixerUndoStack.current.shift(); // cap at 20
  };
  const popMixerUndo = () => {
    const s = mixerUndoStack.current.pop();
    if (!s) return;
    setDrive(s.drive); command({ type: "set_drive", db: s.drive });
    setEqLow(s.eqLow); setEqMid(s.eqMid); setEqHigh(s.eqHigh);
    command({ type: "set_eq", low: s.eqLow, mid: s.eqMid, high: s.eqHigh } as ClientMessage);
    setMbOn(s.mbOn); command({ type: "set_multiband", on: s.mbOn } as ClientMessage);
    setMbAmount(s.mbAmount); command({ type: "set_multiband_amount", amount: s.mbAmount } as ClientMessage);
    setWidth(s.width); command({ type: "set_width", width: s.width } as ClientMessage);
    setLowCut(s.lowCut); command({ type: "set_low_cut", freq: s.lowCut } as ClientMessage);
    setChEQ(s.chEQ);
    for (const [ch, eq] of Object.entries(s.chEQ)) {
      command({ type: "set_channel_eq", channel: Number(ch), ...eq } as ClientMessage);
    }
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && mixerUndoStack.current.length > 0) {
        e.preventDefault();
        popMixerUndo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  // Per-channel EQ
  const [chEQ, setChEQ] = useState<Record<number, { low: number; mid: number; high: number }>>({});
  const [chHPF, setChHPF] = useState<Record<number, number>>({ 1: 50, 0: 40 });
  const [showChEQ, setShowChEQ] = useState<number | null>(null);
  const getChEQ = (ch: number) => chEQ[ch] ?? { low: 0, mid: 0, high: 0 };
  const chEQUndoTimer = useRef(0);
  const updateChEQ = (ch: number, band: "low" | "mid" | "high", v: number) => {
    // Debounce undo: only push once per drag gesture (300ms gap)
    if (!chEQUndoTimer.current) pushMixerUndo();
    clearTimeout(chEQUndoTimer.current);
    chEQUndoTimer.current = window.setTimeout(() => { chEQUndoTimer.current = 0; }, 300);
    const eq = { ...getChEQ(ch), [band]: v };
    setChEQ(prev => ({ ...prev, [ch]: eq }));
    throttledCmd({ type: "set_channel_eq", channel: ch, low: eq.low, mid: eq.mid, high: eq.high } as ClientMessage);
    setActiveScene(null);
  };
  const [showEqModal, setShowEqModal] = useState(false);
  const [showDrvModal, setShowDrvModal] = useState(false);
  // Per-channel gate
  const [gateState, setGateState] = useState<Record<number, { on: boolean; rate: string; depth: number; shape: string; mode: string; pattern: number[] }>>({});
  const [showGateModal, setShowGateModal] = useState<number | null>(null);
  const defaultPattern = [1,0,0,0, 1,0,0,0, 1,0,1,0, 1,1,1,1]; // buildup
  const getGate = (ch: number) => gateState[ch] ?? { on: false, rate: "1/8", depth: 0.8, shape: "square", mode: "lfo", pattern: defaultPattern };
  const updateGate = (ch: number, params: Partial<{ on: boolean; rate: string; depth: number; shape: string; mode: string; pattern: number[] }>) => {
    const g = { ...getGate(ch), ...params };
    setGateState(prev => ({ ...prev, [ch]: g }));
    command({ type: "set_channel_gate", channel: ch, ...g } as ClientMessage);
  };
  // Stutter pattern presets
  const STUTTER_PRESETS: { name: string; pattern: number[] }[] = [
    { name: "Buildup", pattern: [1,0,0,0, 1,0,0,0, 1,0,1,0, 1,1,1,1] },
    { name: "Triplet", pattern: [1,1,0, 1,1,0, 1,1,0, 1,1,0, 1,0,0,0] },
    { name: "Stutter", pattern: [1,1,1,0, 0,0,0,0, 1,1,1,1, 0,0,0,0] },
    { name: "Breakbeat", pattern: [1,0,1,0, 0,0,1,0, 1,0,0,1, 0,1,0,0] },
    { name: "Glitch", pattern: [1,0,1,1, 0,1,0,0, 1,1,0,1, 0,0,1,0] },
  ];

  // ── Mix profiles (save/load) ──────────────────────────────────────
  interface MixProfile {
    name: string;
    volumes: Record<number, number>;
    pans: Record<number, number>;
    chMono: Record<number, boolean>;
    chEQ: Record<number, { low: number; mid: number; high: number }>;
    masterEQ: { low: number; mid: number; high: number };
    drive: number;
    width: number;
    lowCut: number;
    mbOn: boolean;
    mbAmount: number;
  }
  // Built-in mixer scenes — same 10 as header, with per-channel defaults
  const defaultVols = { 9: 0.7, 1: 0.7, 0: 0.7 };
  const defaultPans = { 9: 0, 1: 0, 0: 0 };
  const noMono = {};
  const defaultChEQ = { 9: { low: 4, mid: 0, high: -1 }, 1: { low: 0, mid: -4, high: -1 }, 0: { low: 0, mid: -1.5, high: 0 } };
  const BUILTIN_SCENES: MixProfile[] = [
    { name: "Neutral", volumes: defaultVols, pans: defaultPans, chMono: noMono, chEQ: defaultChEQ,
      masterEQ: { low: 0, mid: 0, high: 0 }, drive: 0, width: 0.5, lowCut: 0, mbOn: true, mbAmount: 0.25 },
    { name: "Punchy", volumes: defaultVols, pans: defaultPans, chMono: noMono, chEQ: defaultChEQ,
      masterEQ: { low: 2, mid: -2, high: 2 }, drive: 0, width: 0.6, lowCut: 35, mbOn: true, mbAmount: 0.3 },
    { name: "Warm", volumes: defaultVols, pans: defaultPans, chMono: noMono, chEQ: defaultChEQ,
      masterEQ: { low: 2, mid: -1, high: 1 }, drive: 0, width: 0.65, lowCut: 25, mbOn: true, mbAmount: 0.3 },
    { name: "Airy", volumes: defaultVols, pans: defaultPans, chMono: noMono, chEQ: defaultChEQ,
      masterEQ: { low: 1, mid: -1, high: 3 }, drive: 0, width: 0.7, lowCut: 25, mbOn: true, mbAmount: 0.35 },
    { name: "Tight", volumes: defaultVols, pans: defaultPans, chMono: noMono, chEQ: defaultChEQ,
      masterEQ: { low: 1, mid: -2, high: 2 }, drive: 0, width: 0.55, lowCut: 35, mbOn: true, mbAmount: 0.35 },
    { name: "Heavy", volumes: defaultVols, pans: defaultPans, chMono: noMono, chEQ: defaultChEQ,
      masterEQ: { low: 3, mid: -1, high: 2 }, drive: 1, width: 0.5, lowCut: 20, mbOn: true, mbAmount: 0.35 },
    { name: "Mellow", volumes: defaultVols, pans: defaultPans, chMono: noMono, chEQ: defaultChEQ,
      masterEQ: { low: 1, mid: -1, high: -1 }, drive: 0, width: 0.65, lowCut: 0, mbOn: true, mbAmount: 0.15 },
    { name: "Spacious", volumes: defaultVols, pans: defaultPans, chMono: noMono, chEQ: defaultChEQ,
      masterEQ: { low: 1, mid: -1, high: 2 }, drive: -1, width: 0.8, lowCut: 20, mbOn: true, mbAmount: 0.1 },
    { name: "Crisp", volumes: defaultVols, pans: defaultPans, chMono: noMono, chEQ: defaultChEQ,
      masterEQ: { low: 1, mid: -1, high: 3 }, drive: 1, width: 0.55, lowCut: 30, mbOn: true, mbAmount: 0.3 },
    { name: "Loud", volumes: defaultVols, pans: defaultPans, chMono: noMono, chEQ: defaultChEQ,
      masterEQ: { low: 2, mid: -1, high: 2 }, drive: 1, width: 0.65, lowCut: 25, mbOn: true, mbAmount: 0.4 },
  ];

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [activeScene, setActiveScene] = useState<string | null>(null);
  const [savedProfiles, setSavedProfiles] = useState<MixProfile[]>(() => getJSON("mpump-mix-profiles", []));

  const getCurrentProfile = (): Omit<MixProfile, "name"> => ({
    volumes: channelVolumes,
    pans,
    chMono,
    chEQ,
    masterEQ: { low: eqLow, mid: eqMid, high: eqHigh },
    drive, width, lowCut, mbOn, mbAmount,
  });

  const saveProfile = () => {
    const name = profileName.trim();
    if (!name) return;
    const profile: MixProfile = { name, ...getCurrentProfile() };
    const updated = [...savedProfiles.filter(p => p.name !== name), profile];
    setSavedProfiles(updated);
    setJSON("mpump-mix-profiles", updated);
    setProfileName("");
  };

  const loadProfile = (p: MixProfile) => {
    setActiveScene(p.name);
    // Update React state
    for (const [ch, v] of Object.entries(p.volumes)) onChannelVolumeChange(Number(ch), v);
    for (const [ch, v] of Object.entries(p.pans)) setPan(Number(ch), v);
    for (const [ch, v] of Object.entries(p.chMono)) {
      const n = Number(ch);
      if ((chMono[n] ?? false) !== v) toggleChMono(n);
    }
    setChEQ(p.chEQ);
    setEqLow(p.masterEQ.low); setEqMid(p.masterEQ.mid); setEqHigh(p.masterEQ.high);
    setDrive(p.drive); setWidth(p.width); setLowCut(p.lowCut);
    setMbOn(p.mbOn); setMbAmount(p.mbAmount);
    // Single engine command — applies all audio mutations atomically,
    // defers MB graph rebuild internally
    command({ type: "load_scene", ...p } as ClientMessage);
  };

  const deleteProfile = (name: string) => {
    const updated = savedProfiles.filter(p => p.name !== name);
    setSavedProfiles(updated);
    setJSON("mpump-mix-profiles", updated);
  };

  // Anti-clip
  const toggleAntiClip = () => {
    tapVibrate();
    const next = antiClipMode === "off" ? "limiter" : "off";
    command({ type: "set_anti_clip", mode: next });
  };

  // Effects
  const [fx, setFx] = useState<EffectParams>(() => {
    const saved = getJSON<Partial<EffectParams>>("mpump-effects", {});
    return { ...JSON.parse(JSON.stringify(DEFAULT_EFFECTS)), ...saved } as EffectParams;
  });
  const [editingFx, setEditingFx] = useState<EffectName | null>(null);
  const [effectOrder, setEffectOrder] = useState<EffectName[]>(() => getJSON("mpump-effect-order", DEFAULT_EFFECT_ORDER));
  const longPressTimer = useRef(0);

  const saveFx = (updated: EffectParams) => {
    setFx(updated);
    setJSON("mpump-effects", updated);
  };

  const toggleFx = (name: EffectName) => {
    tapVibrate();
    const turningOn = !fx[name].on;
    const updated = { ...fx, [name]: { ...fx[name], on: turningOn } };
    saveFx(updated);
    command({ type: "set_effect", name, params: { on: turningOn } });
    let newOrder = [...effectOrder];
    if (turningOn) {
      newOrder = newOrder.filter(e => e !== name);
      newOrder.push(name);
    }
    setEffectOrder(newOrder);
    setJSON("mpump-effect-order", newOrder);
    command({ type: "set_effect_order", order: newOrder });
  };

  const fxPointerDown = (name: EffectName) => {
    longPressTimer.current = window.setTimeout(() => setEditingFx(name), 500);
  };
  const fxPointerUp = () => window.clearTimeout(longPressTimer.current);
  const fxContextMenu = (e: React.MouseEvent, name: EffectName) => {
    e.preventDefault();
    setEditingFx(name);
  };
  const updateFxParam = (name: EffectName, params: Record<string, unknown>) => {
    const updated = { ...fx, [name]: { ...fx[name], ...params } };
    saveFx(updated);
    command({ type: "set_effect", name, params });
  };

  // Effects collapsed state
  const [fxCollapsed, setFxCollapsed] = useState(false);

  return (
    <div className="mx-panel">
      {/* ── Console ── */}
      <div className="mx-console">
        {/* Channel strips */}
        {INSTRUMENT_CHANNELS.map((def) => {
          const muted = isMuted(def);
          const soloed = soloChannel === def.soloKey;
          const dimmed = soloChannel !== null && !soloed;
          const mono = chMono[def.ch] ?? false;
          const vol = channelVolumes[def.ch] ?? 0.7;
          const pan = pans[def.ch] ?? 0;

          return (
            <div key={def.label} className={`mx-strip ${muted ? "mx-muted" : ""} ${dimmed ? "mx-dimmed" : ""} ${soloed ? "mx-soloed" : ""}`}>
              <div className="mx-strip-label">{def.label}</div>
              <input
                type="range" min={0} max={1} step={0.01}
                value={vol}
                onChange={(e) => onChannelVolumeChange(def.ch, parseFloat(e.target.value))}
                className="mx-fader"
                title={`${def.label} volume: ${volToDb(vol)} dB`}
              />
              <div className="mx-db-label">{volToDb(vol)} dB</div>
              <div className="mx-btn-row">
                <button
                  className={`mx-btn mx-btn-mute ${muted ? "active" : ""} ${pendingMutes?.[def.muteDevice]?.has(def.muteType.includes("bass") ? "bass_mute" : "drums_mute") ? "pending" : ""}`}
                  title={`Mute ${def.label.toLowerCase()}`}
                  onClick={() => { tapVibrate(); setSoloChannel(null); command({ type: def.muteType, device: def.muteDevice }); }}
                >M</button>
                <button
                  className={`mx-btn mx-btn-solo ${soloed ? "active" : ""}`}
                  title={`Solo ${def.label.toLowerCase()}`}
                  onClick={() => { tapVibrate(); toggleSolo(def.soloKey); }}
                >S</button>
              </div>
              <div className="mx-pan-section">
                <div className="mx-pan-label">{panLabel(pan)}</div>
                <div className="mx-pan-row">
                  <span className="mx-pan-lr">L</span>
                  <input
                    type="range" min={-1} max={1} step={0.05}
                    value={pan}
                    onChange={(e) => setPan(def.ch, parseFloat(e.target.value))}
                    className="mx-pan-slider"
                    title={`${def.label} pan: ${panLabel(pan)}`}
                  />
                  <span className="mx-pan-lr">R</span>
                </div>
              </div>
              <div className="mx-btn-row" style={{ marginTop: 2 }}>
                {def.ch !== 1 && (
                  <button
                    className={`mx-btn mx-btn-mono ${mono ? "active" : ""}`}
                    title={`Mono ${def.label.toLowerCase()}`}
                    onClick={() => { tapVibrate(); toggleChMono(def.ch); }}
                  >Mo</button>
                )}
                <button
                  className={`mx-btn ${(getChEQ(def.ch).low !== 0 || getChEQ(def.ch).mid !== 0 || getChEQ(def.ch).high !== 0) ? "active" : ""}`}
                  title={`EQ ${def.label.toLowerCase()}`}
                  onClick={() => setShowChEQ(def.ch)}
                >EQ</button>
                {def.ch === 9 && onShowDrumKit && (
                  <button className="mx-btn" title="Drum kit tuning"
                    onClick={onShowDrumKit}
                  >KIT</button>
                )}
                {def.ch !== 9 && (
                  <button
                    className={`mx-btn ${getGate(def.ch).on ? "active" : ""}`}
                    title={`Trance gate ${def.label.toLowerCase()}`}
                    onClick={() => setShowGateModal(def.ch)}
                  >GATE</button>
                )}
              </div>
              <span className="mx-modal-reset" onClick={() => {
                const defVol = def.ch === 9 ? 0.7 : def.ch === 1 ? 0.53 : 0.45;
                onChannelVolumeChange(def.ch, defVol);
                setPan(def.ch, 0);
                setChEQ(prev => ({ ...prev, [def.ch]: { low: 0, mid: 0, high: 0 } }));
                command({ type: "set_channel_eq", channel: def.ch, low: 0, mid: 0, high: 0 } as ClientMessage);
                if (chMono[def.ch]) toggleChMono(def.ch);
              }}>RST</span>
            </div>
          );
        })}

        {/* Divider */}
        <div className="mx-divider" />

        {/* Master strip */}
        <div className="mx-strip mx-strip-master">
          <div className="mx-strip-label mx-label-master">MASTER</div>
          <ClipIndicator getAnalyser={() => getAnalyser?.() ?? null} />
          <input
            type="range" min={0} max={1} step={0.01}
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="mx-fader"
            title={`Master volume: ${volToDb(volume)} dB`}
          />
          <div className="mx-db-label">{volToDb(volume)} dB</div>
          {showPro && <div className="mx-btn-row">
            <button
              className={`mx-btn mx-btn-limit ${antiClipMode !== "off" ? "active" : ""}`}
              onClick={toggleAntiClip}
              title={`Anti-clip: ${antiClipMode}`}
            >LIMIT</button>
            <button
              className={`mx-btn ${mbOn ? "active" : ""}`}
              onClick={() => setShowMbModal(true)}
              title={`Multiband compression: ${mbOn ? "on" : "off"}`}
            >MB</button>
          </div>}
          <div className="mx-btn-row" style={{ marginTop: 4 }}>
            {showPro && <button
              className={`mx-btn ${drive !== 0 ? "active" : ""}`}
              onClick={() => setShowDrvModal(true)}
              title={`Drive: ${drive > 0 ? "+" : ""}${drive.toFixed(1)} dB`}
            >DRV</button>}
            <button
              className={`mx-btn ${(eqLow !== 1 || eqMid !== 0 || eqHigh !== 0) ? "active" : ""}`}
              onClick={() => setShowEqModal(true)}
              title={`EQ: L${eqLow > 0 ? "+" : ""}${eqLow} M${eqMid > 0 ? "+" : ""}${eqMid} H${eqHigh > 0 ? "+" : ""}${eqHigh}`}
            >EQ</button>
            <button
              className={`mx-btn ${activeScene ? "active" : ""}`}
              onClick={() => setShowProfileModal(true)}
              title={activeScene ? `Scene: ${activeScene}` : "Mix scenes"}
              style={{ fontSize: 9, maxWidth: 44, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >{activeScene ? activeScene.slice(0, 4).toUpperCase() : "SCN"}</button>
          </div>
        </div>
      </div>


      {/* EQ modal */}
      {showEqModal && (
        <MasterModal
          title="MASTER EQ"
          onClose={() => setShowEqModal(false)}
          getAnalyser={() => getAnalyser?.() ?? null}
        >
          {window.innerWidth >= 700 && (() => {
            const w = 200, h = 50, col = "#66ff99", dim = "rgba(102,255,153,0.15)";
            // 3-band EQ + low cut frequency response visualization
            const pts = Array.from({ length: 80 }, (_, i) => {
              const f = 20 * Math.pow(1000, i / 79); // 20 Hz to 20 kHz log scale
              let db = 0;
              // Low shelf at 150 Hz
              const lowN = f / 150;
              db += eqLow / (1 + Math.pow(lowN, 2));
              // Mid peak at 1 kHz
              const midN = (f - 1000) / 700;
              db += eqMid * Math.exp(-midN * midN);
              // High shelf at 5 kHz
              const highN = 5000 / f;
              db += eqHigh / (1 + Math.pow(highN, 2));
              // Low cut
              if (lowCut > 20) {
                const hpN = lowCut / f;
                db -= 24 * Math.log10(1 + hpN * hpN) / 2;
              }
              const y = h / 2 - (db / 24) * h * 0.8;
              return `${4 + (i / 79) * (w - 8)},${Math.max(2, Math.min(h - 2, y))}`;
            }).join(" ");
            return <svg className="fx-vis" viewBox={`0 0 ${w} ${h}`} style={{ marginBottom: 4 }}>
              <rect x={0} y={0} width={w} height={h} fill="rgba(0,0,0,0.3)" rx={3} />
              <line x1={4} y1={h/2} x2={w-4} y2={h/2} stroke={dim} strokeWidth={0.5} />
              <polyline points={pts} fill="none" stroke={col} strokeWidth={1.5} />
            </svg>;
          })()}
          {[
            { label: "LOW", value: eqLow, onChange: (v: number) => { setEqLow(v); throttledCmd({ type: "set_eq", low: v, mid: eqMid, high: eqHigh } as ClientMessage); }, min: -12, max: 12, step: 1 },
            { label: "MID", value: eqMid, onChange: (v: number) => { setEqMid(v); throttledCmd({ type: "set_eq", low: eqLow, mid: v, high: eqHigh } as ClientMessage); }, min: -12, max: 12, step: 1 },
            { label: "HIGH", value: eqHigh, onChange: (v: number) => { setEqHigh(v); throttledCmd({ type: "set_eq", low: eqLow, mid: eqMid, high: v } as ClientMessage); }, min: -12, max: 12, step: 1 },
          ].map(({ label, value, onChange, min, max, step }) => (
            <div className="fx-editor-row" key={label}>
              <span className="fx-editor-label">{label}</span>
              <input type="range" min={min} max={max} step={step} value={value} className="fx-editor-slider"
                onChange={(e) => onChange(parseFloat(e.target.value))} />
              <span className="fx-editor-value">{value > 0 ? "+" : ""}{value} dB</span>
            </div>
          ))}
          <div className="fx-editor-row">
            <span className="fx-editor-label">WIDTH</span>
            <input type="range" min={0} max={1} step={0.05} value={width} className="fx-editor-slider"
              onChange={(e) => { const v = parseFloat(e.target.value); setWidth(v); throttledCmd({ type: "set_width", width: v } as ClientMessage); }} />
            <span className="fx-editor-value">{Math.round(width * 100)}%</span>
          </div>
          <div className="fx-editor-row">
            <span className="fx-editor-label">LO CUT</span>
            <input type="range" min={0} max={200} step={5} value={lowCut} className="fx-editor-slider"
              onChange={(e) => { const v = parseFloat(e.target.value); setLowCut(v); throttledCmd({ type: "set_low_cut", freq: v } as ClientMessage); }} />
            <span className="fx-editor-value">{lowCut === 0 ? "OFF" : `${lowCut} Hz`}</span>
          </div>
          <span className="mx-modal-reset" onClick={() => {
            setEqLow(1); setEqMid(0); setEqHigh(0); setWidth(0.5); setLowCut(0);
            command({ type: "set_eq", low: 1, mid: 0, high: 0 } as ClientMessage);
            command({ type: "set_width", width: 0.5 } as ClientMessage);
            command({ type: "set_low_cut", freq: 0 } as ClientMessage);
          }}>RST</span>
        </MasterModal>
      )}

      {/* Channel EQ modal */}
      {showChEQ !== null && (() => {
        const ch = showChEQ;
        const eq = getChEQ(ch);
        const chLabel = INSTRUMENT_CHANNELS.find(d => d.ch === ch)?.label ?? "CH";
        return (
          <MasterModal
            title={`${chLabel} EQ`}
            onClose={() => setShowChEQ(null)}
            getAnalyser={() => getChannelAnalyser?.(ch) ?? null}
          >
            {window.innerWidth >= 700 && (() => {
              const w = 200, h = 50, col = "#66ff99", dim = "rgba(102,255,153,0.15)";
              const pts = Array.from({ length: 80 }, (_, i) => {
                const f = 20 * Math.pow(1000, i / 79);
                let db = 0;
                const lowN = f / 200;
                db += eq.low / (1 + Math.pow(lowN, 2));
                const midN = (f - 1000) / 700;
                db += eq.mid * Math.exp(-midN * midN);
                const highN = 5000 / f;
                db += eq.high / (1 + Math.pow(highN, 2));
                const y = h / 2 - (db / 24) * h * 0.8;
                return `${4 + (i / 79) * (w - 8)},${Math.max(2, Math.min(h - 2, y))}`;
              }).join(" ");
              return <svg className="fx-vis" viewBox={`0 0 ${w} ${h}`} style={{ marginBottom: 4 }}>
                <rect x={0} y={0} width={w} height={h} fill="rgba(0,0,0,0.3)" rx={3} />
                <line x1={4} y1={h/2} x2={w-4} y2={h/2} stroke={dim} strokeWidth={0.5} />
                <polyline points={pts} fill="none" stroke={col} strokeWidth={1.5} />
              </svg>;
            })()}
            {[
              { label: "LOW", value: eq.low, band: "low" as const, min: -12, max: 12 },
              { label: "CUT", value: eq.mid, band: "mid" as const, min: -8, max: 0 },
              { label: "HIGH", value: eq.high, band: "high" as const, min: -12, max: 12 },
            ].map(({ label, value, band, min, max }) => (
              <div className="fx-editor-row" key={label}>
                <span className="fx-editor-label">{label}</span>
                <input type="range" min={min} max={max} step={1} value={value} className="fx-editor-slider"
                  onChange={(e) => updateChEQ(ch, band, parseFloat(e.target.value))} />
                <span className="fx-editor-value">{value > 0 ? "+" : ""}{value} dB</span>
              </div>
            ))}
            {(ch === 1 || ch === 0) && <div className="fx-editor-row">
              <span className="fx-editor-label">Low Cut</span>
              <input type="range" min={20} max={200} step={5} value={chHPF[ch] ?? 0} className="fx-editor-slider"
                onChange={(e) => { const f = parseFloat(e.target.value); setChHPF(prev => ({ ...prev, [ch]: f })); throttledCmd({ type: "set_channel_hpf", channel: ch, freq: f } as ClientMessage); }} />
              <span className="fx-editor-value">{chHPF[ch] ?? 0} Hz</span>
            </div>}
            <span className="mx-modal-reset" onClick={() => {
              setChEQ(prev => ({ ...prev, [ch]: { low: 0, mid: 0, high: 0 } }));
              command({ type: "set_channel_eq", channel: ch, low: 0, mid: 0, high: 0 } as ClientMessage);
              const defHPF = ch === 1 ? 50 : ch === 0 ? 40 : 0;
              setChHPF(prev => ({ ...prev, [ch]: defHPF }));
              command({ type: "set_channel_hpf", channel: ch, freq: defHPF } as ClientMessage);
            }}>RST</span>
          </MasterModal>
        );
      })()}

      {/* Gate modal */}
      {showGateModal !== null && (() => {
        const ch = showGateModal;
        const g = getGate(ch);
        const chLabel = INSTRUMENT_CHANNELS.find(d => d.ch === ch)?.label ?? "CH";
        return (
          <MasterModal
            title={`${chLabel} GATE`}
            onClose={() => setShowGateModal(null)}
            getAnalyser={() => getChannelAnalyser?.(ch) ?? null}
          >
            <div className="fx-editor-row" style={{ justifyContent: "center", marginBottom: 8 }}>
              <button
                className={`synth-osc-btn ${g.on ? "active" : ""}`}
                onClick={() => updateGate(ch, { on: !g.on })}
              >{g.on ? "ON" : "OFF"}</button>
            </div>
            {/* Stutter pattern mode hidden for now — coming in next release */}
            {window.innerWidth >= 700 && (() => {
              const size = 80, cx = size / 2, cy = size / 2;
              const rMax = size / 2 - 4, rMin = rMax * 0.3;
              const col = g.on ? "#66ff99" : "rgba(102,255,153,0.3)";
              const dim = "rgba(102,255,153,0.1)";
              const rateMap: Record<string, number> = { "1/2": 1, "1/4": 2, "1/8": 4, "1/8d": 3, "1/16": 8, "1/32": 16 };
              const cycles = rateMap[g.rate] ?? 4;
              const steps = 128;
              const pts = Array.from({ length: steps + 1 }, (_, i) => {
                const t = i / steps;
                const angle = t * Math.PI * 2 - Math.PI / 2; // start at top
                const phase = (t * cycles) % 1;
                let env;
                if (g.shape === "square") {
                  env = phase < 0.5 ? 1 : 1 - g.depth;
                } else {
                  const tri = phase < 0.5 ? phase * 2 : 2 - phase * 2;
                  env = 1 - g.depth * (1 - tri);
                }
                const r = rMin + (rMax - rMin) * env;
                return `${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`;
              }).join(" ");
              return <svg className="fx-vis" viewBox={`0 0 ${size} ${size}`} style={{ marginBottom: 4, width: 100, height: 100 }}>
                <circle cx={cx} cy={cy} r={rMax} fill="none" stroke={dim} strokeWidth={0.5} />
                <circle cx={cx} cy={cy} r={rMin} fill="none" stroke={dim} strokeWidth={0.5} />
                <polygon points={pts} fill="rgba(102,255,153,0.08)" stroke={col} strokeWidth={1.5} />
                <circle cx={cx} cy={cy - rMax + 2} r={2} fill={col} />
              </svg>;
            })()}
            <div className="fx-editor-row" style={{ gap: 4, marginBottom: 8 }}>
              {(["1/2", "1/4", "1/8", "1/8d", "1/16", "1/32"] as const).map(r => (
                <button
                  key={r}
                  className={`synth-osc-btn ${g.rate === r ? "active" : ""}`}
                  style={g.rate === r ? { background: "#66ff99", color: "#000" } : undefined}
                  onClick={() => updateGate(ch, { rate: r })}
                >{r === "1/8d" ? "1/8." : r}</button>
              ))}
            </div>
            <div className="fx-editor-row" style={{ gap: 4, marginBottom: 8 }}>
              {(["square", "triangle"] as const).map(s => (
                <button
                  key={s}
                  className={`synth-osc-btn ${g.shape === s ? "active" : ""}`}
                  style={g.shape === s ? { background: "#66ff99", color: "#000" } : undefined}
                  onClick={() => updateGate(ch, { shape: s })}
                >{s === "square" ? "HARD" : "SOFT"}</button>
              ))}
            </div>
            <div className="fx-editor-row">
              <span className="fx-editor-label">DEPTH</span>
              <input type="range" min={0} max={1} step={0.05} value={g.depth} className="fx-editor-slider"
                onChange={(e) => updateGate(ch, { depth: parseFloat(e.target.value) })} />
              <span className="fx-editor-value">{Math.round(g.depth * 100)}%</span>
            </div>
          </MasterModal>
        );
      })()}

      {/* Drive modal */}
      {showDrvModal && (
        <MasterModal
          title="DRIVE"
          onClose={() => setShowDrvModal(false)}
          getAnalyser={() => getAnalyser?.() ?? null}
        >
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
            <svg viewBox="0 0 80 24" width={120} height={36}>
              {(() => {
                const gain = Math.pow(10, drive / 20);
                const pts = Array.from({ length: 40 }, (_, i) => {
                  const t = i / 39;
                  const x = 2 + t * 36;
                  const y = 12 - Math.sin(t * Math.PI * 2) * 8;
                  return `${x},${y}`;
                }).join(" ");
                const ptsD = Array.from({ length: 40 }, (_, i) => {
                  const t = i / 39;
                  const x = 42 + t * 36;
                  const raw = Math.sin(t * Math.PI * 2) * gain;
                  const clipped = Math.max(-1, Math.min(1, raw));
                  const y = 12 - clipped * 8;
                  return `${x},${y}`;
                }).join(" ");
                return <>
                  <line x1={40} y1={2} x2={40} y2={22} stroke="rgba(102,255,153,0.15)" strokeWidth={0.5} />
                  <polyline points={pts} fill="none" stroke="rgba(102,255,153,0.3)" strokeWidth={1} />
                  <polyline points={ptsD} fill="none" stroke="#66ff99" strokeWidth={1.5} />
                </>;
              })()}
            </svg>
          </div>
          <div className="fx-editor-row">
            <span className="fx-editor-label">DRIVE</span>
            <input type="range" min={-6} max={12} step={0.5} value={drive} className="fx-editor-slider"
              onChange={(e) => { const v = parseFloat(e.target.value); setDrive(v); throttledCmd({ type: "set_drive", db: v }); }} />
            <span className="fx-editor-value">{drive > 0 ? "+" : ""}{drive.toFixed(1)} dB</span>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 4 }}>
            <button className={`mx-btn ${drive !== 0 ? "active" : ""}`}
              onClick={() => { if (drive !== 0) { setDrive(0); command({ type: "set_drive", db: 0 }); } else { setDrive(1); command({ type: "set_drive", db: 1 }); } }}>
              {drive !== 0 ? "ON" : "OFF"}
            </button>
            <span className="mx-modal-reset" onClick={() => {
              setDrive(0); command({ type: "set_drive", db: 0 });
            }}>RST</span>
          </div>
        </MasterModal>
      )}

      {/* Multiband modal */}
      {showMbModal && (
        <MasterModal
          title="MULTIBAND"
          onClose={() => setShowMbModal(false)}
          getAnalyser={() => getAnalyser?.() ?? null}
        >
          {window.innerWidth >= 700 && (() => {
            const w = 200, h = 50, col = "#66ff99", dim = "rgba(102,255,153,0.15)";
            const a = mbAmount;
            // Visualize 3-band compression: threshold lines + gain reduction curves
            // Band boundaries: 200 Hz, 3000 Hz (log positions)
            const x200 = 4 + (Math.log10(200/20) / Math.log10(1000)) * (w - 8);
            const x3k = 4 + (Math.log10(3000/20) / Math.log10(1000)) * (w - 8);
            // Threshold lines (higher = less compression)
            const tLow = h * 0.5 - (-6 - a * 12) / 48 * h * 0.8;
            const tMid = h * 0.5 - (-12 - a * 12) / 48 * h * 0.8;
            const tHigh = h * 0.5 - (-12 - a * 12) / 48 * h * 0.8;
            return <svg className="fx-vis" viewBox={`0 0 ${w} ${h}`} style={{ marginBottom: 4 }}>
              <rect x={0} y={0} width={w} height={h} fill="rgba(0,0,0,0.3)" rx={3} />
              {/* Band separators */}
              <line x1={x200} y1={2} x2={x200} y2={h-2} stroke={dim} strokeWidth={0.5} strokeDasharray="2,2" />
              <line x1={x3k} y1={2} x2={x3k} y2={h-2} stroke={dim} strokeWidth={0.5} strokeDasharray="2,2" />
              {/* Threshold lines per band */}
              <line x1={4} y1={tLow} x2={x200} y2={tLow} stroke={mbOn ? col : dim} strokeWidth={1.5} />
              <line x1={x200} y1={tMid} x2={x3k} y2={tMid} stroke={mbOn ? col : dim} strokeWidth={1.5} />
              <line x1={x3k} y1={tHigh} x2={w-4} y2={tHigh} stroke={mbOn ? col : dim} strokeWidth={1.5} />
              {/* Band labels */}
              <text x={(4+x200)/2} y={h-3} fill={dim} fontSize={6} textAnchor="middle">LOW</text>
              <text x={(x200+x3k)/2} y={h-3} fill={dim} fontSize={6} textAnchor="middle">MID</text>
              <text x={(x3k+w-4)/2} y={h-3} fill={dim} fontSize={6} textAnchor="middle">HIGH</text>
            </svg>;
          })()}
          <div className="fx-editor-row">
            <span className="fx-editor-label">AMOUNT</span>
            <input type="range" min={0} max={1} step={0.05} value={mbAmount} className="fx-editor-slider" title="Multiband compression amount"
              onChange={(e) => { const v = parseFloat(e.target.value); setMbAmount(v); throttledCmd({ type: "set_multiband_amount", amount: v } as ClientMessage); }} />
            <span className="fx-editor-value">{Math.round(mbAmount * 100)}%</span>
          </div>
          <div className="fx-editor-row" style={{ justifyContent: "center", gap: 6, marginTop: 8 }}>
            <button
              className={`mx-btn ${mbOn ? "active" : ""}`}
              title="Toggle multiband compression on/off"
              onClick={() => { const next = !mbOn; setMbOn(next); command({ type: "set_multiband", on: next } as ClientMessage); }}
            >{mbOn ? "ON" : "OFF"}</button>
            <button
              className={`mx-btn ${mbExcludeDrums ? "active" : ""}`}
              style={{ fontSize: 9, padding: "3px 10px", whiteSpace: "nowrap", width: "auto" }}
              title="Exclude drums from multiband compression"
              onClick={() => { const next = !mbExcludeDrums; setMbExcludeDrums(next); command({ type: "set_mb_exclude", channel: "drums", exclude: next } as ClientMessage); }}
            >EXCL.&nbsp;DRUMS</button>
          </div>
          <span className="mx-modal-reset" onClick={() => {
            setMbOn(true); setMbAmount(0.25);
            setMbExcludeDrums(false);
            command({ type: "set_multiband", on: true } as ClientMessage);
            command({ type: "set_multiband_amount", amount: 0.25 } as ClientMessage);
            command({ type: "set_mb_exclude", channel: "drums", exclude: false } as ClientMessage);
          }}>RST</span>
        </MasterModal>
      )}

      {/* Mix profile modal */}
      {showProfileModal && (
        <MasterModal
          title="SCENES"
          onClose={() => setShowProfileModal(false)}
          getAnalyser={() => getAnalyser?.() ?? null}
        >
          {/* Built-in genre scenes */}
          <div style={{ marginBottom: 6, opacity: 0.5, fontSize: 9, letterSpacing: 1 }}>GENRE PROFILES</div>
          <div style={{ maxHeight: 140, overflowY: "auto", marginBottom: 8 }}>
            {BUILTIN_SCENES.map((p) => (
              <button
                key={p.name}
                className={`mx-btn ${activeScene === p.name ? "active" : ""}`}
                style={{ display: "block", width: "100%", textAlign: "left", fontSize: 11, marginBottom: 2,
                  ...(activeScene === p.name ? { background: "#66ff99", color: "#000" } : {}) }}
                onClick={() => { loadProfile(p); setShowProfileModal(false); }}
              >{activeScene === p.name ? "▸ " + p.name : p.name}</button>
            ))}
          </div>
          {/* User scenes */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8, marginBottom: 6 }}>
            <div style={{ opacity: 0.5, fontSize: 9, letterSpacing: 1, marginBottom: 6 }}>MY SCENES</div>
            <div className="fx-editor-row" style={{ gap: 4 }}>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveProfile(); }}
                placeholder="Scene name..."
                style={{ flex: 1, background: "var(--bg)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4, padding: "4px 8px", fontSize: 12, fontFamily: "monospace" }}
              />
              <button className="mx-btn" onClick={saveProfile} style={{ minWidth: 40 }}>SAVE</button>
            </div>
            {savedProfiles.length > 0 && (
              <div style={{ marginTop: 6, maxHeight: 120, overflowY: "auto" }}>
                {savedProfiles.map((p) => (
                  <div key={p.name} className="fx-editor-row" style={{ gap: 4, marginBottom: 2 }}>
                    <button
                      className={`mx-btn ${activeScene === p.name ? "active" : ""}`}
                      style={{ flex: 1, textAlign: "left", fontSize: 11,
                        ...(activeScene === p.name ? { background: "#66ff99", color: "#000" } : {}) }}
                      onClick={() => { loadProfile(p); setShowProfileModal(false); }}
                    >{activeScene === p.name ? "▸ " + p.name : p.name}</button>
                    <button
                      className="mx-btn"
                      style={{ minWidth: 24, fontSize: 10, opacity: 0.6 }}
                      onClick={() => deleteProfile(p.name)}
                      title="Delete"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </MasterModal>
      )}

      {/* Effect editor modal */}
      {editingFx && (
        <EffectEditor
          name={editingFx}
          params={fx[editingFx]}
          onUpdate={(p) => updateFxParam(editingFx, p)}
          onClose={() => setEditingFx(null)}
        />
      )}
    </div>
  );
}
