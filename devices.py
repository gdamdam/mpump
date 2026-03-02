# Device profiles for supported Roland AIRA and SP devices.
#
# Port naming on macOS CoreMIDI:
#   Sending TO a device uses the port named "{product} MIDI IN"
#
# Each device has a fixed pattern stored here in Step format:
#   (semitone_offset_from_root, velocity_factor, slide) | None
#
# The S-1 does NOT have a pattern here — it receives its pattern
# dynamically from the CLI (genre + pattern index + key).

from patterns import Step

# ---------------------------------------------------------------------------
# Fixed patterns for non-S-1 devices
# ---------------------------------------------------------------------------

# J-6: MIDI Ch1, root C2 (36). Notes map to chord buttons.
# C2=button1, E2=button5. Simple alternating chord stab.
_J6_PATTERN: list[Step] = [
    (0, 1.0, False), None, None, None,
    (4, 1.0, False), None, None, None,
    (0, 1.0, False), None, None, None,
    (4, 1.0, False), None, None, None,
]

# T-8: MIDI Ch10 (drums). Root=36 (Bass Drum).
# offset 0 = BD (36), offset 2 = SD (38). Kick four-on-the-floor + snare.
_T8_PATTERN: list[Step] = [
    (0, 1.1, False), None, None, None,
    (2, 1.0, False), None, None, None,
    (0, 1.1, False), None, None, None,
    (2, 1.0, False), None, None, None,
]

# SP-404MK2: MIDI Ch1, root=36 (Pad 1). offset 4 = Pad 5.
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
        "root_note":     None,    # set at runtime from --key
        "base_velocity": 100,
        "note_fraction": 0.5,
        "pattern":       None,    # set at runtime from --genre/--pattern
    },
    "J-6": {
        "port_match":    "J-6 MIDI IN",
        "channel":       0,
        "root_note":     36,      # C2 — chord button 1
        "base_velocity": 100,
        "note_fraction": 0.8,
        "pattern":       _J6_PATTERN,
    },
    "T-8": {
        "port_match":    "T-8 MIDI IN",
        "channel":       9,       # MIDI ch 10 — GM drums
        "root_note":     36,      # Bass Drum
        "base_velocity": 110,
        "note_fraction": 0.2,
        "pattern":       _T8_PATTERN,
    },
    "SP-404MK2": {
        "port_match":    "SP-404MK2 MIDI IN",
        "channel":       0,
        "root_note":     36,      # Pad 1
        "base_velocity": 100,
        "note_fraction": 0.3,
        "pattern":       _SP404_PATTERN,
    },
}
