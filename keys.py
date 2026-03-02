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

DEFAULT_KEY = "A"


def parse_key(name: str) -> int:
    """Return the root MIDI note (octave 2) for a key name like 'A', 'F#', 'Bb'.

    Raises ValueError if the name is not recognised.
    """
    normalised = name.strip().capitalize()
    # Handle e.g. "f#" → "F#", "bb" → "Bb"
    if len(normalised) == 2 and normalised[1] in ("#", "b"):
        normalised = normalised[0].upper() + normalised[1]
    if normalised not in _ROOT_NOTES:
        valid = ", ".join(sorted({k for k in _ROOT_NOTES if "/" not in k}))
        raise ValueError(
            f"Unknown key '{name}'. Valid keys: {valid}"
        )
    return _ROOT_NOTES[normalised]


def valid_key_names() -> list[str]:
    """Return a sorted list of accepted key name strings."""
    return sorted(_ROOT_NOTES.keys())
