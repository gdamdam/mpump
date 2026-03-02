# MIDI root note resolution for all 12 chromatic keys.
#
# Root notes are anchored at octave 2 (MIDI 36–47).
# All pattern semitone offsets are relative to this root, so transposition
# is free: just change the root and every pattern interval stays intact.

from typing import Optional

# Root MIDI note for each key name at octave 2
_ROOT_NOTES: dict[str, int] = {
    "C":  36,
    "C#": 37, "Db": 37,
    "D":  38,
    "D#": 39, "Eb": 39,
    "E":  40,
    "F":  41,
    "F#": 42, "Gb": 42,
    "G":  43,
    "G#": 44, "Ab": 44,
    "A":  45,
    "A#": 46, "Bb": 46,
    "B":  47,
}

DEFAULT_KEY    = "A"
DEFAULT_OCTAVE = 2
OCTAVE_MIN     = 0
OCTAVE_MAX     = 6


def parse_key(name: str, octave: int = DEFAULT_OCTAVE) -> int:
    """Return the root MIDI note for a key name at the given octave.

    octave=2 is the default bass register (A2 = MIDI 45).
    octave=3 gives A3 = MIDI 57, useful for higher melodic lines.

    Raises ValueError if the name or octave is not recognised.
    """
    normalised = name.strip().capitalize()
    # Handle e.g. "f#" → "F#", "bb" → "Bb"
    if len(normalised) == 2 and normalised[1] in ("#", "b"):
        normalised = normalised[0].upper() + normalised[1]
    if normalised not in _ROOT_NOTES:
        valid = ", ".join(sorted({k for k in _ROOT_NOTES}))
        raise ValueError(f"Unknown key '{name}'. Valid keys: {valid}")
    if not (OCTAVE_MIN <= octave <= OCTAVE_MAX):
        raise ValueError(
            f"Octave {octave} out of range ({OCTAVE_MIN}–{OCTAVE_MAX})"
        )
    base = _ROOT_NOTES[normalised]              # octave-2 anchor
    root = base + (octave - DEFAULT_OCTAVE) * 12
    return max(0, min(127, root))


def valid_key_names() -> list[str]:
    """Return a sorted list of accepted key name strings."""
    return sorted(_ROOT_NOTES.keys())
