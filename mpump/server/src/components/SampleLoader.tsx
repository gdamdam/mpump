/**
 * SampleLoader — Load custom drum samples from local files.
 * Per-slot file assignment, drag-and-drop, IndexedDB persistence.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { DRUM_VOICES } from "../types";

interface Props {
  accent: string;
  onSamplesLoaded: (samples: Map<number, AudioBuffer>) => void;
}

const DB_NAME = "mpump-samples";
const STORE_NAME = "drum-samples";

// IndexedDB helpers
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveSampleToDB(note: number, arrayBuffer: ArrayBuffer, name: string) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put({ buffer: arrayBuffer, name }, note);
  db.close();
}

async function loadSamplesFromDB(): Promise<Map<number, { buffer: ArrayBuffer; name: string }>> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const result = new Map<number, { buffer: ArrayBuffer; name: string }>();
  return new Promise((resolve) => {
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        result.set(cursor.key as number, cursor.value);
        cursor.continue();
      } else {
        db.close();
        resolve(result);
      }
    };
    req.onerror = () => { db.close(); resolve(result); };
  });
}

async function deleteSampleFromDB(note: number) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).delete(note);
  db.close();
}

// Decode audio file to AudioBuffer
async function decodeFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const ctx = new AudioContext();
  const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  ctx.close();
  return buffer;
}

// Auto-map filename to drum voice
function guessNoteFromFilename(name: string): number | null {
  const lower = name.toLowerCase();
  if (/kick|bd|bass.?drum/i.test(lower)) return 36;
  if (/snare|sd/i.test(lower)) return 38;
  if (/closed.?h|ch|hihat|hh(?!o)/i.test(lower)) return 42;
  if (/open.?h|oh/i.test(lower)) return 46;
  if (/clap|cp|rim/i.test(lower)) return 50;
  if (/crash|cy|cymbal|ride/i.test(lower)) return 49;
  return null;
}

export function SampleLoader({ accent, onSamplesLoaded }: Props) {
  const [slotNames, setSlotNames] = useState<Record<number, string>>({});
  const [expanded, setExpanded] = useState(false);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const dropRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getCtx = () => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    return audioCtxRef.current;
  };

  // Load persisted samples on mount
  useEffect(() => {
    (async () => {
      const saved = await loadSamplesFromDB();
      if (saved.size === 0) return;
      const ctx = getCtx();
      const buffers = new Map<number, AudioBuffer>();
      const names: Record<number, string> = {};
      for (const [note, { buffer, name }] of saved) {
        try {
          const decoded = await ctx.decodeAudioData(buffer.slice(0));
          buffers.set(note, decoded);
          names[note] = name;
        } catch { /* skip corrupted */ }
      }
      setSlotNames(names);
      if (buffers.size > 0) onSamplesLoaded(buffers);
    })();
  }, []);

  const loadFile = useCallback(async (note: number, file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const ctx = getCtx();
      const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      await saveSampleToDB(note, arrayBuffer, file.name);
      setSlotNames(prev => ({ ...prev, [note]: file.name }));
      // Reload all samples
      const saved = await loadSamplesFromDB();
      const buffers = new Map<number, AudioBuffer>();
      for (const [n, { buffer: buf }] of saved) {
        try {
          buffers.set(n, await ctx.decodeAudioData(buf.slice(0)));
        } catch { /* skip */ }
      }
      onSamplesLoaded(buffers);
    } catch (e) {
      console.error("Failed to load sample:", e);
    }
  }, [onSamplesLoaded]);

  const clearSlot = useCallback(async (note: number) => {
    await deleteSampleFromDB(note);
    setSlotNames(prev => {
      const next = { ...prev };
      delete next[note];
      return next;
    });
    // Reload remaining
    const saved = await loadSamplesFromDB();
    const ctx = getCtx();
    const buffers = new Map<number, AudioBuffer>();
    for (const [n, { buffer }] of saved) {
      try { buffers.set(n, await ctx.decodeAudioData(buffer.slice(0))); } catch { /* */ }
    }
    onSamplesLoaded(buffers);
  }, [onSamplesLoaded]);

  // Drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("audio/"));
    for (const file of files) {
      const note = guessNoteFromFilename(file.name);
      if (note) loadFile(note, file);
    }
  }, [loadFile]);

  if (!expanded) {
    return (
      <div className="sample-loader">
        <div className="synth-editor-header">
          <div className="drum-kit-label" style={{ color: accent }}>samples</div>
          <button className="synth-osc-btn" title="Expand sample loader" style={{ fontSize: 9 }} onClick={() => setExpanded(true)}>
            {Object.keys(slotNames).length > 0 ? `${Object.keys(slotNames).length} loaded` : "load"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="sample-loader"
      ref={dropRef}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDrop={handleDrop}
    >
      <div className="synth-editor-header">
        <div className="drum-kit-label" style={{ color: accent }}>samples</div>
        <button className="synth-osc-btn" title="Collapse sample loader" style={{ fontSize: 9 }} onClick={() => setExpanded(false)}>▲</button>
      </div>
      <div className="sample-hint">Drop audio files or click to assign per slot</div>
      <div className="sample-grid">
        {DRUM_VOICES.map(({ note, name }) => (
          <div key={note} className="sample-row">
            <span className="sample-voice" style={{ color: accent }}>{name}</span>
            <span className="sample-name">{slotNames[note] || "—"}</span>
            <button
              className="synth-osc-btn"
              title={slotNames[note] ? `Replace ${name} sample` : `Load ${name} sample`}
              style={{ fontSize: 9 }}
              onClick={() => fileInputRefs.current[note]?.click()}
            >
              {slotNames[note] ? "replace" : "load"}
            </button>
            {slotNames[note] && (
              <button className="synth-osc-btn" title={`Clear ${name} sample`} style={{ fontSize: 9 }} onClick={() => clearSlot(note)}>✕</button>
            )}
            <input
              ref={(el) => { fileInputRefs.current[note] = el; }}
              type="file"
              accept="audio/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) loadFile(note, file);
                e.target.value = "";
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
