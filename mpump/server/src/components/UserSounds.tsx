/**
 * UserSounds — Save/load/rename/delete user sound presets.
 * Works for synth and bass instruments (SynthParams).
 * Stores presets in localStorage keyed by storageKey prop.
 */

import { useState, useCallback } from "react";
import type { SynthParams } from "../types";
import { getJSON, setJSON } from "../utils/storage";
import { tapVibrate } from "../utils/haptic";

interface SoundEntry {
  name: string;
  params: SynthParams;
}

interface Props {
  storageKey: string;
  label: string;           // e.g. "synth" or "bass"
  accent: string;
  getParams: () => SynthParams;
  onLoad: (params: SynthParams) => void;
}

function getSounds(key: string): SoundEntry[] {
  return getJSON<SoundEntry[]>(key, []);
}

function persistSounds(key: string, list: SoundEntry[]): void {
  setJSON(key, list);
}

export function UserSounds({ storageKey, label, accent, getParams, onLoad }: Props) {
  const [sounds, setSounds] = useState<SoundEntry[]>(() => getSounds(storageKey));
  const [open, setOpen] = useState(false);

  const refresh = useCallback(() => {
    setSounds(getSounds(storageKey));
  }, [storageKey]);

  const handleSave = useCallback(() => {
    const name = prompt(`Save ${label} sound as:`);
    if (!name?.trim()) return;
    const params = getParams();
    const list = getSounds(storageKey);
    list.push({ name: name.trim(), params });
    persistSounds(storageKey, list);
    refresh();
    tapVibrate();
  }, [storageKey, label, getParams, refresh]);

  const handleLoad = useCallback((idx: number) => {
    const entry = sounds[idx];
    if (!entry) return;
    onLoad(entry.params);
    setOpen(false);
    tapVibrate();
  }, [sounds, onLoad]);

  const handleRename = useCallback((idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const entry = sounds[idx];
    if (!entry) return;
    const name = prompt("Rename sound:", entry.name);
    if (!name?.trim()) return;
    const list = getSounds(storageKey);
    list[idx] = { ...list[idx], name: name.trim() };
    persistSounds(storageKey, list);
    refresh();
  }, [sounds, storageKey, refresh]);

  const handleDelete = useCallback((idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const entry = sounds[idx];
    if (!entry) return;
    if (!confirm(`Delete "${entry.name}"?`)) return;
    const list = getSounds(storageKey);
    list.splice(idx, 1);
    persistSounds(storageKey, list);
    refresh();
  }, [sounds, storageKey, refresh]);

  return (
    <div className="upatterns">
      <button
        className="upatterns-btn"
        title={`Save ${label} sound`}
        onClick={handleSave}
        style={{ borderColor: accent }}
      >
        +Save Sound
      </button>
      <div className="upatterns-load-wrap">
        <button
          className={`upatterns-btn ${open ? "active" : ""}`}
          title={`Load ${label} sound`}
          onClick={() => { refresh(); setOpen(!open); }}
          style={open ? { borderColor: accent, color: accent } : { borderColor: accent }}
        >
          Sounds{sounds.length > 0 ? ` (${sounds.length})` : ""} &#x25BE;
        </button>
        {open && (
          <div className="upatterns-dropdown">
            {sounds.length === 0 ? (
              <div className="upatterns-empty">No saved sounds</div>
            ) : (
              sounds.map((entry, i) => (
                <div key={i} className="upatterns-item" onClick={() => handleLoad(i)}>
                  <span className="upatterns-name" style={{ color: accent }}>{entry.name}</span>
                  <span className="upatterns-actions">
                    <button className="upatterns-action" title="Rename" onClick={(e) => handleRename(i, e)}>
                      &#x270E;
                    </button>
                    <button className="upatterns-action del" title="Delete" onClick={(e) => handleDelete(i, e)}>
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
  );
}
