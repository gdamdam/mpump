/**
 * DrumKitEditor — Tune, Decay, Level, Tone per drum voice.
 * Shown on preview drums+bass devices in PUMP view.
 * Includes user kit library (save/load/rename/delete).
 */

import { useState, useCallback, useEffect, useRef } from "react";
import type { ClientMessage, DrumVoiceParams } from "../types";
import { DRUM_VOICES, DEFAULT_DRUM_VOICE } from "../types";
import { DRUM_KIT_PRESETS } from "../data/soundPresets";
import { SAMPLE_PACKS } from "../data/samplePacks";
import { getJSON, setJSON } from "../utils/storage";
import { tapVibrate } from "../utils/haptic";
import { Knob } from "./SynthEditor";
import { getBool } from "../utils/storage";

/** Tiny 16×14 SVG icon per drum voice for visual identity */
export function DrumIcon({ note, color }: { note: number; color: string }) {
  const w = 16, h = 14;
  const dim = `${color}66`; // 40% opacity version
  switch (note) {
    case 36: // BD — kick: rounded bump
      return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}><path d={`M1 ${h-1} Q${w/2} -2 ${w-1} ${h-1}`} fill="none" stroke={color} strokeWidth={1.5}/></svg>;
    case 37: // RS — rimshot: two sharp spikes
      return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}><polyline points={`2,${h-2} 5,2 8,${h-2} 11,3 14,${h-2}`} fill="none" stroke={color} strokeWidth={1.2}/></svg>;
    case 38: // SD — snare: jagged noise burst
      return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}><polyline points={`1,7 3,3 5,10 7,2 9,11 11,4 13,9 15,7`} fill="none" stroke={color} strokeWidth={1.2}/></svg>;
    case 42: // CH — closed hat: tight lines
      return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>{[0,1,2,3,4].map(i=><line key={i} x1={2+i*3} y1={3} x2={2+i*3} y2={h-3} stroke={color} strokeWidth={1.2}/>)}</svg>;
    case 46: // OH — open hat: lines with decay
      return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>{[0,1,2,3,4].map(i=><line key={i} x1={2+i*3} y1={3+i*0.5} x2={2+i*3} y2={h-3-i*0.3} stroke={i<3?color:dim} strokeWidth={1.2}/>)}</svg>;
    case 47: // CB — cowbell: bell curve
      return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}><path d={`M2 ${h-2} L5 3 Q8 1 11 3 L14 ${h-2}`} fill="none" stroke={color} strokeWidth={1.2}/></svg>;
    case 49: // CY — cymbal: wide splash
      return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}><path d={`M1 4 Q3 2 5 3 Q8 1 11 3 Q13 2 15 5`} fill="none" stroke={color} strokeWidth={1.2}/><path d={`M5 3 Q8 8 15 10`} fill="none" stroke={dim} strokeWidth={1}/></svg>;
    case 50: // CP — clap: double burst
      return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}><polyline points={`2,7 4,3 6,8`} fill="none" stroke={color} strokeWidth={1.2}/><polyline points={`8,7 10,2 12,9 14,5`} fill="none" stroke={color} strokeWidth={1.2}/></svg>;
    case 51: // RD — ride: wide ring
      return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}><ellipse cx={w/2} cy={h/2} rx={6} ry={4} fill="none" stroke={color} strokeWidth={1.2}/><circle cx={w/2} cy={h/2} r={1.5} fill={color}/></svg>;
    case 56: // tambourine-ish
      return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>{[0,1,2].map(i=><circle key={i} cx={3+i*5} cy={h/2} r={2} fill="none" stroke={color} strokeWidth={1}/>)}</svg>;
    default:
      return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}><circle cx={w/2} cy={h/2} r={3} fill="none" stroke={color} strokeWidth={1}/></svg>;
  }
}

/** Tiny horizontal level bar, 20×6 */
function LevelBar({ value, accent }: { value: number; accent: string }) {
  const w = 20, h = 6;
  const fill = Math.max(0, Math.min(1, value)) * (w - 2);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ flexShrink: 0 }}>
      <rect x={0} y={0} width={w} height={h} rx={2} fill="rgba(255,255,255,0.06)" />
      <rect x={1} y={1} width={fill} height={h - 2} rx={1} fill={accent} opacity={0.8} />
    </svg>
  );
}

const KITS_STORAGE_KEY = "mpump-kits-drums";

interface KitEntry {
  name: string;
  voices: Record<number, DrumVoiceParams>;
}

function getKits(): KitEntry[] {
  return getJSON<KitEntry[]>(KITS_STORAGE_KEY, []);
}

function persistKits(list: KitEntry[]): void {
  setJSON(KITS_STORAGE_KEY, list);
}

/** Default stereo pan per drum voice (matches AudioPort DRUM_PAN). */
function defaultPan(note: number): number {
  const map: Record<number, number> = { 36: 0, 37: 0.2, 38: 0, 42: 0.3, 46: -0.3, 47: 0.25, 49: 0.2, 50: -0.15, 51: 0.35, 56: -0.25 };
  return map[note] ?? 0;
}

/** Get the TONE param name and defaults for each voice */
function toneParam(note: number): { key: keyof DrumVoiceParams; label: string; min: number; max: number; def: number } {
  if (note === 36) return { key: "click", label: "CLICK", min: 0, max: 1, def: 0.15 };
  if (note === 37) return { key: "noiseMix", label: "NOISE", min: 0, max: 1, def: 0.5 };
  if (note === 38) return { key: "noiseMix", label: "NOISE", min: 0, max: 1, def: 0.55 };
  if (note === 42 || note === 46 || note === 47 || note === 49 || note === 51) return { key: "color", label: "COLOR", min: -1, max: 1, def: 0 };
  return { key: "click", label: "TONE", min: 0, max: 1, def: 0 };
}

/** Resolve voices from an activeDrumKit string (preset index or "pack:id") */
function resolveVoices(activeDrumKit: string): Record<number, DrumVoiceParams> {
  if (activeDrumKit.startsWith("pack:")) {
    const pack = SAMPLE_PACKS.find(p => p.id === activeDrumKit.slice(5));
    if (pack) return pack.voices;
  } else {
    const preset = DRUM_KIT_PRESETS[parseInt(activeDrumKit)];
    if (preset) return preset.voices;
  }
  return Object.fromEntries(DRUM_VOICES.map(v => [v.note, { ...DEFAULT_DRUM_VOICE }]));
}

interface Props {
  accent: string;
  command: (msg: ClientMessage) => void;
  activeDrumKit?: string;
  defaultOpen?: boolean;
}

export function DrumKitEditor({ accent, command, activeDrumKit, defaultOpen = false }: Props) {
  const [voices, setVoices] = useState<Record<number, DrumVoiceParams>>(
    () => resolveVoices(activeDrumKit ?? "0")
  );
  const prevKit = useRef(activeDrumKit);

  // Sync voices when activeDrumKit changes externally
  useEffect(() => {
    if (activeDrumKit !== undefined && activeDrumKit !== prevKit.current) {
      prevKit.current = activeDrumKit;
      setVoices(resolveVoices(activeDrumKit));
    }
  }, [activeDrumKit]);

  const update = (note: number, params: Partial<DrumVoiceParams>) => {
    const updated = { ...voices[note], ...params };
    setVoices(prev => ({ ...prev, [note]: updated }));
    command({ type: "set_drum_voice", note, params });
  };

  const applyVoices = (v: Record<number, DrumVoiceParams>) => {
    setVoices(v);
    for (const [note, params] of Object.entries(v)) {
      command({ type: "set_drum_voice", note: Number(note), params });
    }
  };

  const [open, setOpen] = useState(defaultOpen);
  const [expanded, setExpanded] = useState(false);
  const [muted, setMuted] = useState<Record<number, boolean>>({});

  // ── User kit library ──────────────────────────────────────────────────
  const [kits, setKits] = useState<KitEntry[]>(() => getKits());
  const [kitsOpen, setKitsOpen] = useState(false);

  const refreshKits = useCallback(() => {
    setKits(getKits());
  }, []);

  const handleSaveKit = useCallback(() => {
    const name = prompt("Save drum kit as:");
    if (!name?.trim()) return;
    const list = getKits();
    const snapshot: Record<number, DrumVoiceParams> = {};
    for (const [note, params] of Object.entries(voices)) {
      snapshot[Number(note)] = { ...params };
    }
    list.push({ name: name.trim(), voices: snapshot });
    persistKits(list);
    refreshKits();
    tapVibrate();
  }, [voices, refreshKits]);

  const handleLoadKit = useCallback((idx: number) => {
    const entry = kits[idx];
    if (!entry) return;
    applyVoices(entry.voices);
    setKitsOpen(false);
    tapVibrate();
  }, [kits]);

  const handleRenameKit = useCallback((idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const entry = kits[idx];
    if (!entry) return;
    const name = prompt("Rename kit:", entry.name);
    if (!name?.trim()) return;
    const list = getKits();
    list[idx] = { ...list[idx], name: name.trim() };
    persistKits(list);
    refreshKits();
  }, [kits, refreshKits]);

  const handleDeleteKit = useCallback((idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const entry = kits[idx];
    if (!entry) return;
    if (!confirm(`Delete "${entry.name}"?`)) return;
    const list = getKits();
    list.splice(idx, 1);
    persistKits(list);
    refreshKits();
  }, [kits, refreshKits]);

  const MODAL_COLS = ["LEVEL", "PAN", "TUNE", "DECAY", "TONE"] as const;

  return (
    <div className={defaultOpen ? "" : "drum-kit-editor"}>
      {!defaultOpen && (
        <button className="collapsible-header" onClick={() => setOpen(!open)}>
          <span className="drum-kit-label" style={{ color: accent }}>
            <svg width="14" height="14" viewBox="0 0 14 14" style={{ verticalAlign: "-2px", marginRight: 4 }}>
              <ellipse cx="7" cy="8" rx="6" ry="4" fill="none" stroke={accent} strokeWidth={1} />
              <line x1="1" y1="8" x2="1" y2="5" stroke={accent} strokeWidth={1} />
              <line x1="13" y1="8" x2="13" y2="5" stroke={accent} strokeWidth={1} />
              <ellipse cx="7" cy="5" rx="6" ry="4" fill="none" stroke={accent} strokeWidth={1} />
            </svg>
            drum kit
          </span>
          <span className="collapsible-arrow">{open ? "▼" : "▶"}</span>
        </button>
      )}
      {open && <div className="drum-kit-knobs">
        <div className="drum-kit-toolbar">
          <button
            className="synth-osc-btn"
            title="Open full drum kit editor"
            onClick={() => setExpanded(true)}
            style={{ fontSize: 9 }}
          >EXPAND</button>
        </div>
        {!defaultOpen && getBool("mpump-synth-hints", true) && <div className="synth-section-hint">Per-voice sound shaping: level, stereo pan, tuning, decay, and tone character. Expand for full controls</div>}
        {DRUM_VOICES.map(({ note, name }) => {
          const v = voices[note] ?? { ...DEFAULT_DRUM_VOICE };
          const isMuted = muted[note] ?? false;

          return (
            <div key={note} className={`drum-kit-voice-row ${isMuted ? "drum-kit-muted" : ""}`}>
              <button
                className={`drum-kit-mute ${isMuted ? "on" : ""}`}
                title={isMuted ? `Unmute ${name}` : `Mute ${name}`}
                style={isMuted ? { background: accent, color: "#000" } : undefined}
                onClick={() => {
                  const next = !isMuted;
                  setMuted(prev => ({ ...prev, [note]: next }));
                  update(note, { level: next ? 0 : (voices[note].level || 1) });
                }}
              >M</button>
              <DrumIcon note={note} color={accent} />
              <div className="drum-kit-name" style={{ color: accent }}>{name}</div>
              <Knob label="LEVEL" value={v.level} min={0} max={1} step={0.01} accent={accent} onChange={(val) => update(note, { level: val })} />
              <Knob label="PAN" value={v.pan ?? defaultPan(note)} min={-1} max={1} step={0.05} accent={accent} onChange={(val) => update(note, { pan: val })} />
              <LevelBar value={v.level} accent={accent} />
            </div>
          );
        })}
      </div>}

      {open && (
        <div className="upatterns">
          <button
            className="upatterns-btn"
            title="Save drum kit"
            onClick={handleSaveKit}
            style={{ borderColor: accent }}
          >
            +Save Kit
          </button>
          <div className="upatterns-load-wrap">
            <button
              className={`upatterns-btn ${kitsOpen ? "active" : ""}`}
              title="Load drum kit"
              onClick={() => { refreshKits(); setKitsOpen(!kitsOpen); }}
              style={kitsOpen ? { borderColor: accent, color: accent } : { borderColor: accent }}
            >
              Kits{kits.length > 0 ? ` (${kits.length})` : ""} &#x25BE;
            </button>
            {kitsOpen && (
              <div className="upatterns-dropdown">
                {kits.length === 0 ? (
                  <div className="upatterns-empty">No saved kits</div>
                ) : (
                  kits.map((entry, i) => (
                    <div key={i} className="upatterns-item" onClick={() => handleLoadKit(i)}>
                      <span className="upatterns-name" style={{ color: accent }}>{entry.name}</span>
                      <span className="upatterns-actions">
                        <button className="upatterns-action" title="Rename" onClick={(e) => handleRenameKit(i, e)}>
                          &#x270E;
                        </button>
                        <button className="upatterns-action del" title="Delete" onClick={(e) => handleDeleteKit(i, e)}>
                          &times;
                        </button>
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Expanded modal ── */}
      {expanded && (
        <div className="lib-overlay" onClick={() => setExpanded(false)}>
          <div className="dkm-panel" onClick={e => e.stopPropagation()}>
            <div className="lib-header">
              <span className="lib-title" style={{ color: accent }}>DRUM KIT</span>
              <button className="synth-osc-btn" onClick={() => setExpanded(false)} style={{ fontSize: 9, flex: "none", padding: "4px 10px" }}>CLOSE</button>
            </div>
            <div className="synth-section-hint">Per-voice sound shaping: level, stereo pan, tuning, decay, and tone character</div>
            {/* Grid */}
            <div className="dkm-grid">
              {/* Header row */}
              <div className="dkm-hdr-label" />
              {MODAL_COLS.map(c => <div key={c} className="dkm-hdr-label">{c}</div>)}

              {/* Voice rows */}
              {DRUM_VOICES.map(({ note, name }) => {
                const v = voices[note] ?? { ...DEFAULT_DRUM_VOICE };
                const isMuted = muted[note] ?? false;
                const tone = toneParam(note);
                const toneVal = (v[tone.key] as number | undefined) ?? tone.def;
                return [
                  <div key={`n${note}`} className={`dkm-voice ${isMuted ? "drum-kit-muted" : ""}`}>
                    <button
                      className={`drum-kit-mute ${isMuted ? "on" : ""}`}
                      title={isMuted ? `Unmute ${name}` : `Mute ${name}`}
                      style={isMuted ? { background: accent, color: "#000" } : undefined}
                      onClick={() => {
                        const next = !isMuted;
                        setMuted(prev => ({ ...prev, [note]: next }));
                        update(note, { level: next ? 0 : (voices[note].level || 1) });
                      }}
                    >M</button>
                    <DrumIcon note={note} color={accent} />
                    <span className="drum-kit-name" style={{ color: accent }}>{name}</span>
                  </div>,
                  <div key={`l${note}`} className={`dkm-cell ${isMuted ? "drum-kit-muted" : ""}`}>
                    <input type="range" className="drum-kit-slider" min={0} max={1} step={0.01} value={v.level}
                      style={{ "--knob-accent": accent } as React.CSSProperties}
                      title={`Level: ${v.level.toFixed(2)}`}
                      onChange={e => update(note, { level: parseFloat(e.target.value) })} />
                    <span className="dkm-val">{v.level.toFixed(2)}</span>
                  </div>,
                  <div key={`p${note}`} className={`dkm-cell ${isMuted ? "drum-kit-muted" : ""}`}>
                    <input type="range" className="drum-kit-slider" min={-1} max={1} step={0.05} value={v.pan ?? defaultPan(note)}
                      title={`Pan: ${(v.pan ?? defaultPan(note)).toFixed(2)}`}
                      onChange={e => update(note, { pan: parseFloat(e.target.value) })} />
                    <span className="dkm-val">{(v.pan ?? defaultPan(note)).toFixed(2)}</span>
                  </div>,
                  <div key={`t${note}`} className={`dkm-cell ${isMuted ? "drum-kit-muted" : ""}`}>
                    <input type="range" className="drum-kit-slider" min={-12} max={12} step={1} value={v.tune}
                      title={`Tune: ${v.tune}`}
                      onChange={e => update(note, { tune: parseInt(e.target.value) })} />
                    <span className="dkm-val">{v.tune}</span>
                  </div>,
                  <div key={`d${note}`} className={`dkm-cell ${isMuted ? "drum-kit-muted" : ""}`}>
                    <input type="range" className="drum-kit-slider" min={0.1} max={2} step={0.1} value={v.decay}
                      title={`Decay: ${v.decay.toFixed(1)}`}
                      onChange={e => update(note, { decay: parseFloat(e.target.value) })} />
                    <span className="dkm-val">{v.decay.toFixed(1)}</span>
                  </div>,
                  <div key={`o${note}`} className={`dkm-cell ${isMuted ? "drum-kit-muted" : ""}`}>
                    <input type="range" className="drum-kit-slider" min={tone.min} max={tone.max} step={0.01} value={toneVal}
                      title={`${tone.label}: ${toneVal.toFixed(2)}`}
                      onChange={e => update(note, { [tone.key]: parseFloat(e.target.value) })} />
                    <span className="dkm-val">{toneVal.toFixed(2)}</span>
                  </div>,
                ];
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
