/**
 * MIDI file export/import for mpump patterns.
 *
 * Generates standard MIDI format 0 files (single track) and parses
 * them back into mpump step data. No external dependencies.
 */

import type { StepData, DrumHit } from "../types";

const PPQN = 96; // ticks per quarter note
const TICKS_PER_STEP = PPQN / 4; // 16th note = 24 ticks

// ── Binary helpers ──────────────────────────────────────────────────────

function writeU16(arr: number[], v: number) {
  arr.push((v >> 8) & 0xff, v & 0xff);
}

function writeU32(arr: number[], v: number) {
  arr.push((v >> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff);
}

function writeVarLen(arr: number[], v: number) {
  if (v < 0x80) {
    arr.push(v);
  } else if (v < 0x4000) {
    arr.push(0x80 | ((v >> 7) & 0x7f), v & 0x7f);
  } else {
    arr.push(0x80 | ((v >> 14) & 0x7f), 0x80 | ((v >> 7) & 0x7f), v & 0x7f);
  }
}

function readVarLen(data: Uint8Array, offset: number): [number, number] {
  let value = 0;
  let i = offset;
  while (i < data.length) {
    const b = data[i++];
    value = (value << 7) | (b & 0x7f);
    if (!(b & 0x80)) break;
  }
  return [value, i];
}

// ── Export: melodic pattern → MIDI file ─────────────────────────────────

export async function exportMelodicMidi(
  steps: (StepData | null)[],
  rootNote: number,
  bpm: number,
  filename: string,
): Promise<void> {
  const track = buildMelodicTrack(steps, rootNote, bpm, 0);
  await saveMidi(track, filename);
}

// ── Export: drum pattern → MIDI file ────────────────────────────────────

export async function exportDrumMidi(
  drumData: DrumHit[][],
  bpm: number,
  filename: string,
): Promise<void> {
  const track = buildDrumTrack(drumData, bpm, 9);
  await saveMidi(track, filename);
}

// ── Export: drums+bass → MIDI file ──────────────────────────────────────

export async function exportDrumBassMidi(
  drumData: DrumHit[][],
  bassSteps: (StepData | null)[],
  bassRoot: number,
  bpm: number,
  filename: string,
): Promise<void> {
  // Merge drum and bass events into one track
  const events: MidiEvent[] = [];
  const gate = Math.floor(TICKS_PER_STEP * 0.1); // drum gate
  const bassGate = Math.floor(TICKS_PER_STEP * 0.5);

  for (let i = 0; i < drumData.length; i++) {
    const t = i * TICKS_PER_STEP;
    for (const hit of drumData[i]) {
      events.push({ t, ch: 9, note: hit.note, vel: hit.vel, on: true });
      events.push({ t: t + gate, ch: 9, note: hit.note, vel: 0, on: false });
    }
    const bs = i < bassSteps.length ? bassSteps[i] : null;
    if (bs) {
      const note = Math.max(0, Math.min(127, bassRoot + bs.semi));
      const vel = Math.min(127, Math.round(100 * bs.vel));
      events.push({ t, ch: 1, note, vel, on: true });
      events.push({ t: t + bassGate, ch: 1, note, vel: 0, on: false });
    }
  }

  events.sort((a, b) => a.t - b.t || (a.on ? 0 : 1) - (b.on ? 0 : 1));

  const trackBytes = buildTrackFromEvents(events, bpm);
  await saveMidi(trackBytes, filename);
}

// ── Import: MIDI file → melodic pattern ─────────────────────────────────

export async function importMelodicMidi(file: File): Promise<(StepData | null)[]> {
  const buf = await file.arrayBuffer();
  const data = new Uint8Array(buf);
  const notes = parseMidiNotes(data);

  // Find root (lowest note) and quantize to 16-step grid
  if (notes.length === 0) {
    return Array.from({ length: 16 }, () => null);
  }

  const rootNote = Math.min(...notes.map((n) => n.note));
  const maxTick = Math.max(...notes.map((n) => n.startTick));
  const numSteps = Math.max(16, Math.ceil((maxTick + 1) / TICKS_PER_STEP));
  const steps: (StepData | null)[] = Array.from({ length: Math.min(numSteps, 32) }, () => null);

  for (const n of notes) {
    const stepIdx = Math.round(n.startTick / TICKS_PER_STEP);
    if (stepIdx >= steps.length) continue;
    steps[stepIdx] = {
      semi: n.note - rootNote,
      vel: n.vel / 100,
      slide: false,
    };
  }

  // Trim or pad to 16
  while (steps.length < 16) steps.push(null);
  return steps.slice(0, 32);
}

// ── Import: MIDI file → drum pattern ────────────────────────────────────

export async function importDrumMidi(file: File): Promise<DrumHit[][]> {
  const buf = await file.arrayBuffer();
  const data = new Uint8Array(buf);
  const notes = parseMidiNotes(data);

  const numSteps = 16;
  const drumData: DrumHit[][] = Array.from({ length: numSteps }, () => []);

  for (const n of notes) {
    const stepIdx = Math.round(n.startTick / TICKS_PER_STEP);
    if (stepIdx >= numSteps) continue;
    drumData[stepIdx].push({ note: n.note, vel: n.vel });
  }

  return drumData;
}

// ── Internal types ──────────────────────────────────────────────────────

interface MidiEvent {
  t: number; // absolute tick
  ch: number;
  note: number;
  vel: number;
  on: boolean;
}

interface ParsedNote {
  note: number;
  vel: number;
  startTick: number;
  ch: number;
}

// ── Track builders ──────────────────────────────────────────────────────

function buildMelodicTrack(
  steps: (StepData | null)[],
  rootNote: number,
  bpm: number,
  channel: number,
): number[] {
  const events: MidiEvent[] = [];
  const gate = Math.floor(TICKS_PER_STEP * 0.5);

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step) continue;
    const t = i * TICKS_PER_STEP;
    const note = Math.max(0, Math.min(127, rootNote + step.semi));
    const vel = Math.min(127, Math.round(100 * step.vel));
    events.push({ t, ch: channel, note, vel, on: true });
    events.push({ t: t + gate, ch: channel, note, vel: 0, on: false });
  }

  events.sort((a, b) => a.t - b.t || (a.on ? 0 : 1) - (b.on ? 0 : 1));
  return buildTrackFromEvents(events, bpm);
}

function buildDrumTrack(
  drumData: DrumHit[][],
  bpm: number,
  channel: number,
): number[] {
  const events: MidiEvent[] = [];
  const gate = Math.floor(TICKS_PER_STEP * 0.1);

  for (let i = 0; i < drumData.length; i++) {
    const t = i * TICKS_PER_STEP;
    for (const hit of drumData[i]) {
      events.push({ t, ch: channel, note: hit.note, vel: hit.vel, on: true });
      events.push({ t: t + gate, ch: channel, note: hit.note, vel: 0, on: false });
    }
  }

  events.sort((a, b) => a.t - b.t || (a.on ? 0 : 1) - (b.on ? 0 : 1));
  return buildTrackFromEvents(events, bpm);
}

function buildTrackFromEvents(events: MidiEvent[], bpm: number): number[] {
  const trackData: number[] = [];

  // Tempo meta event: FF 51 03 <microseconds per quarter>
  const uspqn = Math.round(60_000_000 / bpm);
  writeVarLen(trackData, 0); // delta = 0
  trackData.push(0xff, 0x51, 0x03);
  trackData.push((uspqn >> 16) & 0xff, (uspqn >> 8) & 0xff, uspqn & 0xff);

  // Note events
  let prevTick = 0;
  for (const ev of events) {
    const delta = ev.t - prevTick;
    writeVarLen(trackData, delta);
    trackData.push(ev.on ? (0x90 | ev.ch) : (0x80 | ev.ch), ev.note, ev.vel);
    prevTick = ev.t;
  }

  // End of track
  writeVarLen(trackData, 0);
  trackData.push(0xff, 0x2f, 0x00);

  return trackData;
}

function buildMidiBlob(trackData: number[]): Blob {
  const header: number[] = [];

  // "MThd"
  header.push(0x4d, 0x54, 0x68, 0x64);
  writeU32(header, 6); // chunk length
  writeU16(header, 0); // format 0
  writeU16(header, 1); // 1 track
  writeU16(header, PPQN);

  // "MTrk"
  const track: number[] = [];
  track.push(0x4d, 0x54, 0x72, 0x6b);
  writeU32(track, trackData.length);

  const bytes = new Uint8Array([...header, ...track, ...trackData]);
  return new Blob([bytes], { type: "audio/midi" });
}

async function saveMidi(trackData: number[], filename: string): Promise<void> {
  const name = filename.endsWith(".mid") ? filename : `${filename}.mid`;
  const blob = buildMidiBlob(trackData);

  // Try native save picker (Chrome/Edge)
  if (typeof window.showSaveFilePicker === "function") {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: name,
        types: [{
          description: "MIDI file",
          accept: { "audio/midi": [".mid"] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      // Fall through to anchor download
    }
  }

  // Fallback: anchor download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// ── MIDI parser ─────────────────────────────────────────────────────────

function parseMidiNotes(data: Uint8Array): ParsedNote[] {
  if (data.length < 14) return [];

  // Validate header
  const headerTag = String.fromCharCode(data[0], data[1], data[2], data[3]);
  if (headerTag !== "MThd") return [];

  const headerLen = (data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7];
  const division = (data[12] << 8) | data[13];
  const tickScale = division > 0 ? PPQN / division : 1;

  let offset = 8 + headerLen;
  const notes: ParsedNote[] = [];

  // Parse all tracks
  while (offset < data.length - 8) {
    const tag = String.fromCharCode(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
    const trackLen = (data[offset + 4] << 24) | (data[offset + 5] << 16) | (data[offset + 6] << 8) | data[offset + 7];
    offset += 8;

    if (tag !== "MTrk") {
      offset += trackLen;
      continue;
    }

    const trackEnd = offset + trackLen;
    let tick = 0;
    let runningStatus = 0;

    while (offset < trackEnd) {
      let delta: number;
      [delta, offset] = readVarLen(data, offset);
      tick += delta;

      let status = data[offset];
      if (status < 0x80) {
        // Running status
        status = runningStatus;
      } else {
        offset++;
        if (status < 0xf0) runningStatus = status;
      }

      const type = status & 0xf0;
      const ch = status & 0x0f;

      if (type === 0x90 || type === 0x80) {
        const note = data[offset++];
        const vel = data[offset++];
        if (type === 0x90 && vel > 0) {
          notes.push({ note, vel, startTick: Math.round(tick * tickScale), ch });
        }
      } else if (type === 0xa0 || type === 0xb0 || type === 0xe0) {
        offset += 2;
      } else if (type === 0xc0 || type === 0xd0) {
        offset += 1;
      } else if (status === 0xff) {
        // Meta event
        const metaType = data[offset++];
        let metaLen: number;
        [metaLen, offset] = readVarLen(data, offset);
        offset += metaLen;
        if (metaType === 0x2f) break; // end of track
      } else if (status === 0xf0 || status === 0xf7) {
        // SysEx
        let sysLen: number;
        [sysLen, offset] = readVarLen(data, offset);
        offset += sysLen;
      }
    }

    offset = trackEnd;
  }

  return notes;
}
