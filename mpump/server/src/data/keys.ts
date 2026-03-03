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
