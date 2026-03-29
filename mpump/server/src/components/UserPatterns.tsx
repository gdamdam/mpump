/**
 * UserPatterns — Save/load/rename/delete user patterns per instrument.
 * Stores patterns in localStorage keyed by instrument type.
 */

import { useState, useCallback } from "react";
import type { StepData, DrumHit } from "../types";
import { getJSON, setJSON } from "../utils/storage";
import { tapVibrate } from "../utils/haptic";

type InstrumentType = "drums" | "bass" | "synth";

interface MelodicEntry { name: string; data: (StepData | null)[]; }
interface DrumEntry { name: string; data: DrumHit[][]; }
type PatternEntry = MelodicEntry | DrumEntry;

function storageKey(instrument: InstrumentType): string {
  return `mpump-patterns-${instrument}`;
}

function getPatterns(instrument: InstrumentType): PatternEntry[] {
  return getJSON<PatternEntry[]>(storageKey(instrument), []);
}

function persistPatterns(instrument: InstrumentType, list: PatternEntry[]): void {
  setJSON(storageKey(instrument), list);
}

interface Props {
  instrument: InstrumentType;
  accent: string;
  /** Return current pattern data for saving */
  getCurrentData: () => (StepData | null)[] | DrumHit[][];
  /** Load saved pattern data into the sequencer */
  onLoad: (data: (StepData | null)[] | DrumHit[][]) => void;
}

export function UserPatterns({ instrument, accent, getCurrentData, onLoad }: Props) {
  const [patterns, setPatterns] = useState<PatternEntry[]>(() => getPatterns(instrument));
  const [open, setOpen] = useState(false);

  const refresh = useCallback(() => {
    setPatterns(getPatterns(instrument));
  }, [instrument]);

  const handleSave = useCallback(() => {
    const name = prompt(`Save ${instrument} pattern as:`);
    if (!name?.trim()) return;
    const data = getCurrentData();
    const list = getPatterns(instrument);
    list.push({ name: name.trim(), data: data as any });
    persistPatterns(instrument, list);
    refresh();
    tapVibrate();
  }, [instrument, getCurrentData, refresh]);

  const handleLoad = useCallback((idx: number) => {
    const entry = patterns[idx];
    if (!entry) return;
    onLoad(entry.data as any);
    setOpen(false);
    tapVibrate();
  }, [patterns, onLoad]);

  const handleRename = useCallback((idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const entry = patterns[idx];
    if (!entry) return;
    const name = prompt("Rename pattern:", entry.name);
    if (!name?.trim()) return;
    const list = getPatterns(instrument);
    list[idx] = { ...list[idx], name: name.trim() };
    persistPatterns(instrument, list);
    refresh();
  }, [patterns, instrument, refresh]);

  const handleDelete = useCallback((idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const entry = patterns[idx];
    if (!entry) return;
    if (!confirm(`Delete "${entry.name}"?`)) return;
    const list = getPatterns(instrument);
    list.splice(idx, 1);
    persistPatterns(instrument, list);
    refresh();
  }, [patterns, instrument, refresh]);

  return (
    <div className="upatterns">
      <button
        className="upatterns-btn"
        title={`Save ${instrument} pattern`}
        onClick={handleSave}
        style={{ borderColor: accent }}
      >
        +Save
      </button>
      <div className="upatterns-load-wrap">
        <button
          className={`upatterns-btn ${open ? "active" : ""}`}
          title={`Load ${instrument} pattern`}
          onClick={() => { refresh(); setOpen(!open); }}
          style={open ? { borderColor: accent, color: accent } : { borderColor: accent }}
        >
          Patterns{patterns.length > 0 ? ` (${patterns.length})` : ""} &#x25BE;
        </button>
        {open && (
          <div className="upatterns-dropdown">
            {patterns.length === 0 ? (
              <div className="upatterns-empty">No saved patterns</div>
            ) : (
              patterns.map((entry, i) => (
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
