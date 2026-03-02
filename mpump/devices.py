# Device profiles for supported Roland AIRA and SP devices.
#
# Port naming on macOS CoreMIDI:
#   Sending TO a device uses the port named "{product} MIDI IN"
#
# S-1  — melodic pattern set at runtime via CLI (--genre/--pattern/--key)
# T-8  — drum + bass patterns set at runtime via CLI (--t8-genre/--t8-pattern)
#         drums on Ch 10, bass synth on Ch 2 (confirmed from Roland MIDI spec)
# J-6  — fixed chord stab pattern, Ch 1
# SP-404MK2 — fixed pad-trigger pattern, Ch 1

from .patterns import Step

# ---------------------------------------------------------------------------
# Fixed patterns for J-6 and SP-404MK2
# ---------------------------------------------------------------------------

# J-6: MIDI Ch1, root C2 (36) = chord button 1.
_J6_PATTERN: list[Step] = [
    (0, 1.0, False), None, None, None,
    (4, 1.0, False), None, None, None,
    (0, 1.0, False), None, None, None,
    (4, 1.0, False), None, None, None,
]

# SP-404MK2: MIDI Ch1, root=36 (Pad 1), offset 4 = Pad 5.
_SP404_PATTERN: list[Step] = [
    (0, 1.0, False), None, None, (0, 1.0, False),
    None, None, (4, 1.0, False), None,
    (0, 1.0, False), None, None, (0, 1.0, False),
    None, (4, 1.0, False), None, None,
]

# ---------------------------------------------------------------------------
# Device registry
# ---------------------------------------------------------------------------

DEVICES: dict[str, dict] = {
    "S-1": {
        "port_match":    "S-1 MIDI IN",
        "channel":       0,       # MIDI ch 1 (0-indexed)
        "root_note":     None,    # set at runtime from --key/--octave
        "base_velocity": 100,
        "note_fraction": 0.5,
        "pattern":       None,    # set at runtime from --genre/--pattern
        "type":          "synth",
    },
    "J-6": {
        "port_match":    "J-6 MIDI IN",
        "channel":       0,
        "root_note":     36,      # C2 — chord button 1
        "base_velocity": 100,
        "note_fraction": 0.8,
        "pattern":       _J6_PATTERN,
        "type":          "synth",
    },
    "T-8": {
        "port_match":    "T-8 MIDI IN",
        "drum_channel":  9,       # MIDI ch 10 (0-indexed) — drums
        "bass_channel":  1,       # MIDI ch  2 (0-indexed) — bass synth
        "bass_root":     None,    # set at runtime from --key/--octave
        "base_velocity": 100,
        "drum_pattern":  None,    # set at runtime from --t8-genre/--t8-pattern
        "bass_pattern":  None,    # set at runtime from --t8-genre
        "type":          "t8",
    },
    "SP-404MK2": {
        "port_match":    "SP-404MK2 MIDI IN",
        "channel":       0,
        "root_note":     36,      # Pad 1
        "base_velocity": 100,
        "note_fraction": 0.3,
        "pattern":       _SP404_PATTERN,
        "type":          "synth",
    },
}
