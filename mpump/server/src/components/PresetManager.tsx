/**
 * PresetManager — built-in + user-saved grooves (BPM + genre + pattern combos).
 * Custom dropdown with inline rename/delete for user grooves.
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
    const inputName = prompt("Name this groove:", defaultName);
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
    const newName = prompt("Rename:", entry.name);
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
          title="Save groove" aria-label="Save groove"
          style={accent ? { borderColor: accent, color: accent } : undefined}
          onClick={handleQuickSave}
        >
          Save groove
        </button>
      </div>
      {open && (
        <div className="preset-dropdown">
          {userPresets.length === 0 ? (
            <div className="preset-group-label" style={{ padding: "8px 10px", opacity: 0.5 }}>No saved grooves yet</div>
          ) : (
            userPresets.map((p, i) => (
              <div key={`u${i}`} className={`preset-item ${activeLabel === p.name ? "active" : ""}`} onClick={() => handleLoad(p, p.name)}>
                <span className="preset-item-name">{p.name}</span>
                <span className="preset-item-actions">
                  <button className="preset-item-btn" title="Rename" onClick={(e) => handleRename(i, e)}>✎</button>
                  <button className="preset-item-btn preset-item-del" title="Delete" onClick={(e) => handleDelete(i, e)}>✕</button>
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export type { SavedPreset };
