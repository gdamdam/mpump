/**
 * PresetManager — built-in + user-saved session presets.
 * Custom dropdown with inline rename/delete for user presets.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { EngineState } from "../types";
import { getItem, getJSON, setJSON } from "../utils/storage";
import { trackEvent } from "../utils/metrics";

interface SavedPreset {
  name: string;
  state: Pick<EngineState, "bpm"> & { genres: Record<string, { gi: number; pi: number; bgi: number; bpi: number }> };
  ts: number;
}

const STORAGE_KEY = "mpump-presets";

const g = (gi: number, pi = 0) => ({ gi, pi, bgi: 0, bpi: 0 });
const BUILT_IN: SavedPreset[] = [
  { name: "Techno", ts: 0, state: { bpm: 130, genres: { preview_drums: g(0), preview_bass: g(0), preview_synth: g(0) }}},
  { name: "Acid", ts: 0, state: { bpm: 138, genres: { preview_drums: g(1, 2), preview_bass: g(1, 1), preview_synth: g(1, 3) }}},
  { name: "House", ts: 0, state: { bpm: 124, genres: { preview_drums: g(7), preview_bass: g(7, 2), preview_synth: g(7, 1) }}},
  { name: "Trance", ts: 0, state: { bpm: 140, genres: { preview_drums: g(2, 1), preview_bass: g(2), preview_synth: g(2, 2) }}},
  { name: "Dub Techno", ts: 0, state: { bpm: 118, genres: { preview_drums: g(3), preview_bass: g(3, 1), preview_synth: g(3) }}},
  { name: "DnB", ts: 0, state: { bpm: 174, genres: { preview_drums: g(6, 3), preview_bass: g(6, 2), preview_synth: g(6, 1) }}},
  { name: "Electro", ts: 0, state: { bpm: 128, genres: { preview_drums: g(13, 1), preview_bass: g(13), preview_synth: g(13, 2) }}},
  { name: "Garage", ts: 0, state: { bpm: 132, genres: { preview_drums: g(10), preview_bass: g(10, 1), preview_synth: g(10) }}},
  { name: "Ambient", ts: 0, state: { bpm: 90, genres: { preview_drums: g(11, 2), preview_bass: g(11), preview_synth: g(11, 1) }}},
  { name: "Downtempo", ts: 0, state: { bpm: 95, genres: { preview_drums: g(14), preview_bass: g(14, 1), preview_synth: g(14, 2) }}},
  { name: "Dark Club", ts: 0, state: { bpm: 133, genres: { preview_drums: g(0, 4), preview_bass: g(1, 3), preview_synth: g(3, 2) }}},
  { name: "Rave Energy", ts: 0, state: { bpm: 145, genres: { preview_drums: g(1, 5), preview_bass: g(2, 1), preview_synth: g(5, 3) }}},
  { name: "Chill Vibes", ts: 0, state: { bpm: 95, genres: { preview_drums: g(14, 2), preview_bass: g(11, 3), preview_synth: g(3, 1) }}},
  { name: "Broken Beats", ts: 0, state: { bpm: 155, genres: { preview_drums: g(8, 3), preview_bass: g(6, 4), preview_synth: g(4, 2) }}},
  { name: "Midnight Acid", ts: 0, state: { bpm: 136, genres: { preview_drums: g(0, 2), preview_bass: g(1, 5), preview_synth: g(1, 7) }}},
  { name: "Dubstep", ts: 0, state: { bpm: 140, genres: { preview_drums: g(15, 0), preview_bass: g(15, 1), preview_synth: g(15, 0) }}},
  { name: "Lo-Fi Chill", ts: 0, state: { bpm: 80, genres: { preview_drums: g(16, 0), preview_bass: g(16, 0), preview_synth: g(16, 0) }}},
  { name: "Synthwave", ts: 0, state: { bpm: 118, genres: { preview_drums: g(17, 0), preview_bass: g(17, 0), preview_synth: g(17, 0) }}},
  { name: "Deep House", ts: 0, state: { bpm: 122, genres: { preview_drums: g(18, 0), preview_bass: g(18, 0), preview_synth: g(18, 0) }}},
  { name: "Psytrance", ts: 0, state: { bpm: 145, genres: { preview_drums: g(19, 0), preview_bass: g(19, 0), preview_synth: g(19, 0) }}},
];

function loadPresets(): SavedPreset[] {
  return getJSON<SavedPreset[]>(STORAGE_KEY, []);
}

function savePresets(presets: SavedPreset[]) {
  setJSON(STORAGE_KEY, presets);
}

interface Props {
  state: EngineState;
  onLoad: (preset: SavedPreset) => void;
  accent?: string;
  mixCount?: number;
}

export function PresetManager({ state, onLoad, accent, mixCount }: Props) {
  const [userPresets, setUserPresets] = useState<SavedPreset[]>(loadPresets);
  const [heartLit, setHeartLit] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeLabel, setActiveLabel] = useState("");
  const dropRef = useRef<HTMLDivElement>(null);

  // Reset label on MIX
  useEffect(() => { if (mixCount) setActiveLabel(""); }, [mixCount]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open]);

  const handleQuickSave = useCallback(() => {
    const currentTrack = getItem("mpump-track-name", "") || `Mix ${state.bpm}`;
    const defaultName = `${currentTrack} · ${state.bpm}`;
    const inputName = prompt("Name this preset:", defaultName);
    if (inputName === null) return;
    const finalName = inputName.trim() || defaultName;
    const genres: SavedPreset["state"]["genres"] = {};
    for (const [id, ds] of Object.entries(state.devices)) {
      if (ds.connected) {
        genres[id] = { gi: ds.genre_idx, pi: ds.pattern_idx, bgi: ds.bass_genre_idx, bpi: ds.bass_pattern_idx };
      }
    }
    const preset: SavedPreset = { name: finalName, state: { bpm: state.bpm, genres }, ts: Date.now() };
    const updated = [...userPresets, preset];
    setUserPresets(updated);
    savePresets(updated);
    trackEvent("preset-save");
    setHeartLit(true);
    setTimeout(() => setHeartLit(false), 1500);
  }, [state, userPresets]);

  const handleLoad = (preset: SavedPreset, label: string) => {
    onLoad(preset);
    setActiveLabel(label);
    setOpen(false);
  };

  const handleDelete = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${userPresets[idx]?.name}"?`)) return;
    const updated = userPresets.filter((_, i) => i !== idx);
    setUserPresets(updated);
    savePresets(updated);
    setActiveLabel("");
  };

  const handleRename = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const entry = userPresets[idx];
    if (!entry) return;
    const newName = prompt("Rename preset:", entry.name);
    if (!newName?.trim()) return;
    const updated = [...userPresets];
    updated[idx] = { ...entry, name: newName.trim() };
    setUserPresets(updated);
    savePresets(updated);
    if (activeLabel === entry.name) setActiveLabel(newName.trim());
  };

  return (
    <div className="preset-mgr" ref={dropRef}>
      <div className="preset-mgr-row">
        <button className="preset-toggle-btn" onClick={() => setOpen(!open)} style={accent ? { borderColor: accent } : undefined}>
          <span className="preset-toggle-label">{activeLabel}</span>
          <span className="preset-toggle-arrow">{open ? "▴" : "▾"}</span>
        </button>
        <button
          className={`preset-save-btn ${heartLit ? "heart-lit" : ""}`}
          title="Save preset" aria-label="Save preset"
          style={accent ? { borderColor: accent, color: accent } : undefined}
          onClick={handleQuickSave}
        >
          ↟
        </button>
      </div>
      {open && (
        <div className="preset-dropdown">
          <div className="preset-group-label">Built-in</div>
          {BUILT_IN.map((p, i) => (
            <div key={`b${i}`} className={`preset-item ${activeLabel === p.name ? "active" : ""}`} onClick={() => handleLoad(p, p.name)}>
              <span className="preset-item-name">{p.name}</span>
            </div>
          ))}
          {userPresets.length > 0 && (
            <>
              <div className="preset-group-label">My presets</div>
              {userPresets.map((p, i) => (
                <div key={`u${i}`} className={`preset-item ${activeLabel === p.name ? "active" : ""}`} onClick={() => handleLoad(p, p.name)}>
                  <span className="preset-item-name">{p.name}</span>
                  <span className="preset-item-actions">
                    <button className="preset-item-btn" title="Rename" onClick={(e) => handleRename(i, e)}>✎</button>
                    <button className="preset-item-btn preset-item-del" title="Delete" onClick={(e) => handleDelete(i, e)}>✕</button>
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export type { SavedPreset };
