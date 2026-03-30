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
}

export function DrumKitEditor({ accent, command, activeDrumKit }: Props) {
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

  const [open, setOpen] = useState(false);
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

  return (
    <div className="drum-kit-editor">
      <button className="collapsible-header" onClick={() => setOpen(!open)}>
        <span className="drum-kit-label" style={{ color: accent }}>drum kit</span>
        <span className="collapsible-arrow">{open ? "▼" : "▶"}</span>
      </button>
      {open && <div className="drum-kit-knobs">
        <div className="drum-kit-toolbar">
          <button
            className="synth-osc-btn"
            title={expanded ? "Show fewer controls" : "Show all controls"}
            onClick={() => setExpanded(!expanded)}
            style={{ fontSize: 9 }}
          >{expanded ? "COMPACT" : "EXPAND"}</button>
        </div>
        {DRUM_VOICES.map(({ note, name }) => {
          const v = voices[note];
          const isMuted = muted[note] ?? false;
          const tone = toneParam(note);
          const toneVal = (v[tone.key] as number | undefined) ?? tone.def;

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
              <div className="drum-kit-name" style={{ color: accent }}>{name}</div>
              <Knob label="LEVEL" value={v.level} min={0} max={1} step={0.01} accent={accent} onChange={(val) => update(note, { level: val })} />
              <Knob label="PAN" value={v.pan ?? defaultPan(note)} min={-1} max={1} step={0.05} accent={accent} onChange={(val) => update(note, { pan: val })} />
              {expanded && <>
                <Knob label="TUNE" value={v.tune} min={-12} max={12} step={1} accent={accent} onChange={(val) => update(note, { tune: val })} />
                <Knob label="DECAY" value={v.decay} min={0.2} max={3} step={0.1} accent={accent} onChange={(val) => update(note, { decay: val })} />
                <Knob label={tone.label} value={toneVal} min={tone.min} max={tone.max} step={0.01} accent={accent} onChange={(val) => update(note, { [tone.key]: val })} />
              </>}
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
    </div>
  );
}
