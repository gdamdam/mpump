/** Root MIDI note for each key name at octave 2. */
const ROOT_NOTES: Record<string, number> = {
  "C": 36,
  "C#": 37, "Db": 37,
  "D": 38,
  "D#": 39, "Eb": 39,
  "E": 40,
  "F": 41,
  "F#": 42, "Gb": 42,
  "G": 43,
  "G#": 44, "Ab": 44,
  "A": 45,
  "A#": 46, "Bb": 46,
  "B": 47,
};

export const DEFAULT_KEY = "A";
export const DEFAULT_OCTAVE = 2;
export const OCTAVE_MIN = 0;
export const OCTAVE_MAX = 6;

/** Return the root MIDI note for a key name at the given octave. */
const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

/** Return the note name (e.g. "A2", "F#3") for a MIDI note number. */
export function midiToNoteName(midi: number): string {
  const note = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 2;
  return `${note}${octave}`;
}

// ── Scale definitions (semitone intervals within one octave) ─────────────

export const SCALES: Record<string, number[]> = {
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
};

export const SCALE_NAMES = Object.keys(SCALES);

/** Find the next valid semitone offset in a scale, wrapping across octaves. */
export function nextInScale(semi: number, direction: 1 | -1, scaleName: string): number {
  const intervals = SCALES[scaleName];
  if (!intervals || scaleName === "chromatic") return semi + direction;

  const target = semi + direction;
  // Search up to 12 semitones in the given direction
  for (let i = 0; i < 12; i++) {
    const candidate = target + i * direction;
    // Normalize to 0–11 (handles negatives)
    const mod = ((candidate % 12) + 12) % 12;
    if (intervals.includes(mod)) return candidate;
  }
  return target;
}

/** Snap a semitone offset to the nearest note in a scale. */
export function snapToScale(semi: number, scaleName: string): number {
  const intervals = SCALES[scaleName];
  if (!intervals || scaleName === "chromatic") return semi;
  const mod = ((semi % 12) + 12) % 12;
  const octaveBase = semi - mod;
  // Find the closest interval
  let closest = intervals[0];
  let minDist = 12;
  for (const iv of intervals) {
    const dist = Math.abs(mod - iv);
    const wrapDist = Math.min(dist, 12 - dist);
    if (wrapDist < minDist) { minDist = wrapDist; closest = iv; }
  }
  return octaveBase + closest;
}

export function parseKey(name: string, octave: number = DEFAULT_OCTAVE): number {
  let normalised = name.trim();
  // Capitalize first, preserve # or b
  if (normalised.length >= 1) {
    normalised = normalised[0].toUpperCase() + normalised.slice(1);
  }
  const base = ROOT_NOTES[normalised];
  if (base === undefined) return 45; // fallback A2
  const root = base + (octave - DEFAULT_OCTAVE) * 12;
  return Math.max(0, Math.min(127, root));
}
