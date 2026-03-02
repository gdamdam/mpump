# Device profiles for supported Roland AIRA and SP devices.
#
# Port naming on macOS CoreMIDI:
#   Sending TO a device uses the port named "{product} MIDI IN"
#   e.g. S-1 → "S-1 MIDI IN", T-8 → "T-8 MIDI IN"
#
# Note maps use MIDI note numbers (middle C = C4 = 60).
# "note_a" plays on steps 1-4 and 9-12, "note_b" on steps 5-8 and 13-16.

DEVICES = {
    "S-1": {
        "port_match": "S-1 MIDI IN",
        "channel": 0,           # MIDI channel 1 (0-indexed)
        "note_a": 60,           # C4
        "note_b": 64,           # E4
        "velocity": 100,
        "note_fraction": 0.5,   # note held for this fraction of one step
    },
    "J-6": {
        "port_match": "J-6 MIDI IN",
        "channel": 0,           # MIDI channel 1
        "note_a": 36,           # C2 — maps to J-6 chord button 1
        "note_b": 40,           # E2 — maps to J-6 chord button 5
        "velocity": 100,
        "note_fraction": 0.8,   # chord synth sounds better with longer gates
    },
    "T-8": {
        "port_match": "T-8 MIDI IN",
        "channel": 9,           # MIDI channel 10 (0-indexed) — GM drums
        "note_a": 36,           # C2 = Bass Drum
        "note_b": 38,           # D2 = Snare
        "velocity": 110,
        "note_fraction": 0.2,   # drums are short percussive hits
    },
    "SP-404MK2": {
        "port_match": "SP-404MK2 MIDI IN",
        "channel": 0,           # MIDI channel 1
        "note_a": 36,           # C1 = Pad 1
        "note_b": 40,           # E1 = Pad 5
        "velocity": 100,
        "note_fraction": 0.3,
    },
}

# 16-step pattern index: 0 = note_a, 1 = note_b
# CCCCEEEECC CCEEEE  (C groups, E groups, alternating every 4 steps)
PATTERN = [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1]
