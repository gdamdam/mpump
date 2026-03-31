import { useRef, useEffect, useState, useCallback } from "react";
import type { ClientMessage, DeviceState, EffectParams, EffectName } from "../types";
import { DEFAULT_EFFECTS } from "../types";
import { tapVibrate } from "../utils/haptic";
import { getJSON, setJSON } from "../utils/storage";
import { EffectEditor } from "./EffectEditor";

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

// ── Needle VU Meter (master) ─────────────────────────────────────────────

const ARC_START = (220 * Math.PI) / 180;
const ARC_END = (320 * Math.PI) / 180;
const ARC_SPAN = ARC_END - ARC_START;

const DB_TICKS = [
  { db: -40, label: "-40" },
  { db: -20, label: "-20" },
  { db: -10, label: "-10" },
  { db: -5, label: "-5" },
  { db: 0, label: "0" },
  { db: 3, label: "+3" },
];

function dbToAngle(db: number): number {
  const t = (db - DB_FLOOR) / DB_RANGE;
  return ARC_START + t * ARC_SPAN;
}

function renderNeedle(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  needleAngle: number,
  accent: string,
) {
  const cx = w / 2;
  const cy = h - 12;
  const radius = Math.min(w / 2 - 16, h - 24);
  if (radius <= 0 || w <= 0 || h <= 0) return;
  const zeroAngle = dbToAngle(0);
  const minus5Angle = dbToAngle(-5);

  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(cx, cy, radius, ARC_START, minus5Angle);
  ctx.strokeStyle = accent; ctx.globalAlpha = 0.25; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, radius, minus5Angle, zeroAngle);
  ctx.strokeStyle = "#ffaa00"; ctx.globalAlpha = 0.3; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, radius, zeroAngle, ARC_END);
  ctx.strokeStyle = "#ff4444"; ctx.globalAlpha = 0.4; ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `${Math.max(9, w * 0.045)}px monospace`;
  for (const tick of DB_TICKS) {
    const angle = dbToAngle(tick.db);
    const cos = Math.cos(angle), sin = Math.sin(angle);
    ctx.beginPath();
    ctx.moveTo(cx + cos * (radius - 8), cy + sin * (radius - 8));
    ctx.lineTo(cx + cos * (radius + 2), cy + sin * (radius + 2));
    ctx.strokeStyle = tick.db >= 0 ? "#ff4444" : "#7d8590";
    ctx.globalAlpha = tick.db >= 0 ? 0.8 : 0.5; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle; ctx.globalAlpha = tick.db >= 0 ? 0.9 : 0.6;
    ctx.fillText(tick.label, cx + cos * (radius + 14), cy + sin * (radius + 14));
  }
  ctx.globalAlpha = 0.25; ctx.lineWidth = 1;
  for (const db of [-30, -15, -7, -3]) {
    const a = dbToAngle(db), c = Math.cos(a), s = Math.sin(a);
    ctx.beginPath(); ctx.moveTo(cx + c * (radius - 5), cy + s * (radius - 5));
    ctx.lineTo(cx + c * (radius + 1), cy + s * (radius + 1));
    ctx.strokeStyle = "#7d8590"; ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const cos = Math.cos(needleAngle), sin = Math.sin(needleAngle);
  ctx.beginPath(); ctx.moveTo(cx, cy);
  ctx.lineTo(cx + cos * (radius - 4), cy + sin * (radius - 4));
  ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 3; ctx.stroke();

  ctx.beginPath(); ctx.moveTo(cx, cy);
  ctx.lineTo(cx + cos * (radius - 4), cy + sin * (radius - 4));
  const t = (needleAngle - ARC_START) / ARC_SPAN;
  ctx.strokeStyle = t > 0.93 ? "#ff4444" : t > 0.81 ? "#ffaa00" : accent;
  ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.stroke();

  ctx.beginPath(); ctx.arc(cx + cos * (radius - 6), cy + sin * (radius - 6), 3, 0, Math.PI * 2);
  ctx.fillStyle = ctx.strokeStyle; ctx.globalAlpha = 0.6; ctx.fill();

  ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fillStyle = "#555"; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fillStyle = "#888"; ctx.fill();

  ctx.font = `bold ${Math.max(10, w * 0.055)}px monospace`;
  ctx.fillStyle = accent; ctx.globalAlpha = 0.4; ctx.textAlign = "center";
  ctx.fillText("VU", cx, cy - radius * 0.6 * 0.35); ctx.globalAlpha = 1;
}

function NeedleMeter({ getAnalyser }: { getAnalyser: () => AnalyserNode | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const dbRef = useRef<HTMLSpanElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  const ms = useRef({
    smoothedRms: 0,
    needleAngle: ARC_START,
    buf: null as Uint8Array | null,
    accent: "#b388ff",
    accentFrame: 0,
    clipTime: 0,
  });

  const resetClip = useCallback(() => { ms.current.clipTime = 0; }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const analyser = getAnalyser();
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);
      const s = ms.current;

      if (analyser) {
        const size = analyser.fftSize;
        if (!s.buf || s.buf.length !== size) s.buf = new Uint8Array(size);
        analyser.getByteTimeDomainData(s.buf);
        let sumSq = 0;
        for (let i = 0; i < size; i++) {
          const sample = (s.buf[i] - 128) / 128;
          sumSq += sample * sample;
        }
        const rms = Math.sqrt(sumSq / size);
        if (rms > s.smoothedRms) {
          s.smoothedRms = ATTACK_COEFF * s.smoothedRms + (1 - ATTACK_COEFF) * rms;
        } else {
          s.smoothedRms = RELEASE_COEFF * s.smoothedRms + (1 - RELEASE_COEFF) * rms;
        }
      } else {
        s.smoothedRms *= 0.95;
      }

      s.accentFrame++;
      if (s.accentFrame > 60) {
        s.accentFrame = 0;
        s.accent = getComputedStyle(document.documentElement).getPropertyValue("--preview").trim() || "#b388ff";
      }

      const db = toDB(s.smoothedRms);
      const targetAngle = dbToAngle(db);
      s.needleAngle += (targetAngle - s.needleAngle) * 0.18;

      const now = performance.now();
      if (db >= -0.5) s.clipTime = now;
      const clipping = now - s.clipTime < CLIP_HOLD_MS && s.clipTime > 0;

      if (dbRef.current) {
        dbRef.current.textContent = db > DB_FLOOR ? `${db.toFixed(1)} dB` : "-\u221E dB";
      }
      if (clipRef.current) {
        clipRef.current.classList.toggle("active", clipping);
      }

      renderNeedle(ctx, w, h, s.needleAngle, s.accent);
    };

    draw();
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, [getAnalyser]);

  return (
    <div className="mx-needle-wrap">
      <canvas ref={canvasRef} className="mx-needle-canvas" />
      <div className="mx-needle-footer">
        <span ref={dbRef} className="mx-db-readout">{"-\u221E dB"}</span>
        <div ref={clipRef} className="mx-clip" title="Click to reset" onClick={resetClip}>CLIP</div>
      </div>
    </div>
  );
}

// ── Channel VU Bar ──────────────────────────────────────────────────────

function VuBar({ getAnalyser }: { getAnalyser: () => AnalyserNode | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const smoothed = useRef(0);
  const bufRef = useRef<Uint8Array | null>(null);
  const accentRef = useRef("#b388ff");
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const analyser = getAnalyser();
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);

      if (analyser) {
        const size = analyser.fftSize;
        if (!bufRef.current || bufRef.current.length !== size) bufRef.current = new Uint8Array(size);
        analyser.getByteTimeDomainData(bufRef.current);
        let sumSq = 0;
        for (let i = 0; i < size; i++) {
          const sample = (bufRef.current[i] - 128) / 128;
          sumSq += sample * sample;
        }
        const rms = Math.sqrt(sumSq / size);
        if (rms > smoothed.current) {
          smoothed.current = ATTACK_COEFF * smoothed.current + (1 - ATTACK_COEFF) * rms;
        } else {
          smoothed.current = RELEASE_COEFF * smoothed.current + (1 - RELEASE_COEFF) * rms;
        }
      } else {
        smoothed.current *= 0.95;
      }

      frameRef.current++;
      if (frameRef.current > 60) {
        frameRef.current = 0;
        accentRef.current = getComputedStyle(document.documentElement).getPropertyValue("--preview").trim() || "#b388ff";
      }

      const db = toDB(smoothed.current);
      // Map dB to 0..1 for bar height
      const level = Math.max(0, Math.min(1, (db - DB_FLOOR) / DB_RANGE));
      const barH = level * h;

      // Draw segmented bar from bottom
      const segH = Math.max(2, h / 24);
      const gap = 1;
      const barW = Math.min(w - 4, 14);
      const x = (w - barW) / 2;

      for (let y = h; y > h - barH; y -= segH + gap) {
        const segLevel = 1 - (y / h);
        let color: string;
        if (segLevel > 0.88) color = "#ff4444"; // red zone (> -5dB)
        else if (segLevel > 0.7) color = "#ffaa00"; // yellow zone (-12 to -5dB)
        else color = accentRef.current; // green zone

        ctx.fillStyle = color;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(x, y - segH, barW, segH);
      }

      // Draw dim background segments
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = "#fff";
      for (let y = h; y > 0; y -= segH + gap) {
        ctx.fillRect(x, y - segH, barW, segH);
      }
      ctx.globalAlpha = 1;
    };

    draw();
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, [getAnalyser]);

  return <canvas ref={canvasRef} className="mx-vu-bar" />;
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
};

const DEFAULT_EFFECT_ORDER: EffectName[] = ["compressor", "highpass", "distortion", "bitcrusher", "chorus", "phaser", "delay", "reverb"];

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

  useEffect(() => {
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      const analyser = getAnalyser();
      if (analyser) {
        const size = analyser.fftSize;
        const buf = new Uint8Array(size);
        analyser.getByteTimeDomainData(buf);
        let sumSq = 0;
        for (let i = 0; i < size; i++) { const s = (buf[i] - 128) / 128; sumSq += s * s; }
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
            <button className="fx-editor-close" onClick={onClose}>✕</button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Mixer Panel ─────────────────────────────────────────────────────────

export function MixerPanel({
  volume, onVolumeChange, channelVolumes, onChannelVolumeChange,
  devices, command, antiClipMode, getAnalyser, getChannelAnalyser, pendingMutes,
}: Props) {

  const getDevice = (id: string) => devices.find(d => d.id === id);
  const isMuted = (def: ChannelDef) => {
    const dev = getDevice(def.muteDevice);
    return dev ? dev[def.muteField] : false;
  };

  // Solo
  const [soloChannel, setSoloChannel] = useState<"drums" | "bass" | "synth" | null>(null);
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
  const [drive, setDrive] = useState(0);
  const [eqLow, setEqLow] = useState(3); // match AudioPort default
  const [eqMid, setEqMid] = useState(0);
  const [eqHigh, setEqHigh] = useState(0);
  const [showEqModal, setShowEqModal] = useState(false);
  const [showDrvModal, setShowDrvModal] = useState(false);

  // Anti-clip
  const toggleAntiClip = () => {
    tapVibrate();
    const next = antiClipMode === "off" ? "limiter" : "off";
    command({ type: "set_anti_clip", mode: next });
  };

  // Effects
  const [fx, setFx] = useState<EffectParams>(() =>
    getJSON<EffectParams>("mpump-effects", JSON.parse(JSON.stringify(DEFAULT_EFFECTS)))
  );
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
              <VuBar getAnalyser={() => getChannelAnalyser?.(def.ch) ?? null} />
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
              {def.ch !== 1 && (
                <button
                  className={`mx-btn mx-btn-mono ${mono ? "active" : ""}`}
                  title={`Mono ${def.label.toLowerCase()}`}
                  onClick={() => { tapVibrate(); toggleChMono(def.ch); }}
                >Mo</button>
              )}
            </div>
          );
        })}

        {/* Divider */}
        <div className="mx-divider" />

        {/* Master strip */}
        <div className="mx-strip mx-strip-master">
          <div className="mx-strip-label mx-label-master">MASTER</div>
          <div className="mx-master-vu">
            <NeedleMeter getAnalyser={() => getAnalyser?.() ?? null} />
          </div>
          <div className="mx-master-led">
            <VuBar getAnalyser={() => getAnalyser?.() ?? null} />
          </div>
          <input
            type="range" min={0} max={1} step={0.01}
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="mx-fader"
            title={`Master volume: ${volToDb(volume)} dB`}
          />
          <div className="mx-db-label">{volToDb(volume)} dB</div>
          <div className="mx-btn-row">
            <button
              className={`mx-btn mx-btn-limit ${antiClipMode !== "off" ? "active" : ""}`}
              onClick={toggleAntiClip}
              title={`Anti-clip: ${antiClipMode}`}
            >{antiClipMode === "off" ? "LIMIT" : "LIMIT"}</button>
          </div>
          <div className="mx-btn-row" style={{ marginTop: 4 }}>
            <button
              className={`mx-btn ${drive !== 0 ? "active" : ""}`}
              onClick={() => setShowDrvModal(true)}
              title={`Drive: ${drive > 0 ? "+" : ""}${drive.toFixed(1)} dB`}
            >DRV</button>
            <button
              className={`mx-btn ${(eqLow !== 3 || eqMid !== 0 || eqHigh !== 0) ? "active" : ""}`}
              onClick={() => setShowEqModal(true)}
              title={`EQ: L${eqLow > 0 ? "+" : ""}${eqLow} M${eqMid > 0 ? "+" : ""}${eqMid} H${eqHigh > 0 ? "+" : ""}${eqHigh}`}
            >EQ</button>
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
          {[
            { label: "LOW", value: eqLow, onChange: (v: number) => { setEqLow(v); command({ type: "set_eq", low: v, mid: eqMid, high: eqHigh } as ClientMessage); }, min: -12, max: 12, step: 1 },
            { label: "MID", value: eqMid, onChange: (v: number) => { setEqMid(v); command({ type: "set_eq", low: eqLow, mid: v, high: eqHigh } as ClientMessage); }, min: -12, max: 12, step: 1 },
            { label: "HIGH", value: eqHigh, onChange: (v: number) => { setEqHigh(v); command({ type: "set_eq", low: eqLow, mid: eqMid, high: v } as ClientMessage); }, min: -12, max: 12, step: 1 },
          ].map(({ label, value, onChange, min, max, step }) => (
            <div className="fx-editor-row" key={label}>
              <span className="fx-editor-label">{label}</span>
              <input type="range" min={min} max={max} step={step} value={value} className="fx-editor-slider"
                onChange={(e) => onChange(parseFloat(e.target.value))} />
              <span className="fx-editor-value">{value > 0 ? "+" : ""}{value} dB</span>
            </div>
          ))}
          <button className="mx-modal-reset" onClick={() => {
            setEqLow(3); setEqMid(0); setEqHigh(0);
            command({ type: "set_eq", low: 3, mid: 0, high: 0 } as ClientMessage);
          }}>RST</button>
        </MasterModal>
      )}

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
              onChange={(e) => { const v = parseFloat(e.target.value); setDrive(v); command({ type: "set_drive", db: v }); }} />
            <span className="fx-editor-value">{drive > 0 ? "+" : ""}{drive.toFixed(1)} dB</span>
          </div>
          <button className="mx-modal-reset" onClick={() => {
            setDrive(0); command({ type: "set_drive", db: 0 });
          }}>RST</button>
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
