# T-8 pattern library — drums (Ch 10) and bass synth (Ch 2).
#
# DrumStep = list[tuple[int, int]]
#   Each tuple: (midi_note, velocity). Empty list = rest.
#   All notes in a step fire simultaneously on Ch 10.
#   T-8 accepts 2 velocity values per instrument cycle; we use
#   three levels: ghost (60), normal (100), accent (120).
#
# Bass patterns use the same Step format as S-1 (patterns.py):
#   (semitone_offset_from_root, velocity_factor, slide) | None
#   Bass plays on Ch 2. Root defaults to A2 (MIDI 45).
#
# Official T-8 MIDI note map (Roland MIDI Implementation v1.02):
#   BD=36  RS=37  SD=38  CH=42  OH=46  TOM=47  CY=49  CP=50  RD=51  CB=56

from .patterns import Step, st, N, R, A, S, _   # reuse melodic step helpers

# ---------------------------------------------------------------------------
# T-8 drum note constants
# ---------------------------------------------------------------------------
BD  = 36   # Bass Drum
RS  = 37   # Rim Shot
SD  = 38   # Snare Drum
CH  = 42   # Closed Hi-Hat
OH  = 46   # Open Hi-Hat
TOM = 47   # Tom (single unified tom on T-8)
CY  = 49   # Crash Cymbal
CP  = 50   # Hand Clap
RD  = 51   # Ride Cymbal
CB  = 56   # Cowbell

# Velocity shorthands
GH = 60    # ghost
NM = 100   # normal
AC = 120   # accent

DrumStep = list[tuple[int, int]]  # [(midi_note, velocity), ...]  empty = rest


def d(*hits: tuple[int, int]) -> DrumStep:
    """Build a DrumStep from (note, velocity) pairs."""
    return list(hits)


def b(note: int, vel: int = NM) -> tuple[int, int]:
    """Single drum hit shorthand."""
    return (note, vel)


REST: DrumStep = []

# ---------------------------------------------------------------------------
# TECHNO DRUMS — 4/4, mechanical, driving
# ---------------------------------------------------------------------------

T8_TECHNO_DRUMS: list[tuple[str, str, list[DrumStep]]] = [
    (
        "Four on Floor",
        "Classic 4/4 kick, snare on 2&4, 8th closed hats",
        [
            d(b(BD,AC), b(CH)),  d(b(CH)),          d(b(CH)),          d(b(CH)),
            d(b(BD),    b(SD),   b(CH)), d(b(CH)),   d(b(CH)),          d(b(CH)),
            d(b(BD,AC), b(CH)),  d(b(CH)),          d(b(CH)),          d(b(CH)),
            d(b(BD),    b(SD),   b(CH)), d(b(CH)),   d(b(CH)),          d(b(CH)),
        ],
    ),
    (
        "Minimalist",
        "Kick and snare only, maximum space",
        [
            d(b(BD,AC)), REST, REST, REST,
            d(b(SD)),    REST, REST, REST,
            d(b(BD,AC)), REST, REST, REST,
            d(b(SD)),    REST, REST, REST,
        ],
    ),
    (
        "Hi-Hat Roll",
        "16th closed hats over 4-on-floor — relentless forward motion",
        [
            d(b(BD,AC), b(CH)), d(b(CH,GH)), d(b(CH)), d(b(CH,GH)),
            d(b(SD),    b(CH)), d(b(CH,GH)), d(b(CH)), d(b(CH,GH)),
            d(b(BD,AC), b(CH)), d(b(CH,GH)), d(b(CH)), d(b(CH,GH)),
            d(b(SD),    b(CH)), d(b(CH,GH)), d(b(CH)), d(b(OH)),
        ],
    ),
    (
        "Berlin Shuffle",
        "Open hat on offbeats — Berghain floor standard",
        [
            d(b(BD,AC)), d(b(OH)), REST,        d(b(OH)),
            d(b(BD), b(SD,AC)), d(b(OH)), REST, d(b(OH)),
            d(b(BD,AC)), d(b(OH)), REST,        d(b(OH)),
            d(b(BD), b(SD,AC)), d(b(OH)), REST, d(b(OH)),
        ],
    ),
    (
        "Kick Drive",
        "Double kicks with snare — propulsive industrial groove",
        [
            d(b(BD,AC), b(CH)), d(b(CH)), d(b(BD), b(CH)), d(b(CH)),
            d(b(BD), b(SD,AC), b(CH)), d(b(BD)), d(b(CH)), d(b(CH)),
            d(b(BD,AC), b(CH)), d(b(CH)), d(b(BD), b(CH)), d(b(CH)),
            d(b(BD), b(SD,AC), b(CH)), d(b(BD)), d(b(CH)), d(b(OH)),
        ],
    ),
    (
        "Syncopated",
        "Kick displaced off the 1 — hypnotic push-pull tension",
        [
            d(b(BD,AC)), REST, REST, d(b(BD)),
            REST,        d(b(BD), b(SD)), REST, REST,
            d(b(BD,AC)), REST, REST, d(b(BD)),
            REST,        d(b(SD,AC)), REST, REST,
        ],
    ),
    (
        "Tom Break",
        "Tom fills over kick/snare — live-feel percussive break",
        [
            d(b(BD,AC)), REST,     d(b(SD)), REST,
            d(b(BD), b(TOM)), REST, d(b(SD)), REST,
            d(b(BD,AC)), REST,     d(b(SD)), d(b(TOM)),
            d(b(BD,TOM)), d(b(TOM)), d(b(SD,CY)), REST,
        ],
    ),
    (
        "Cowbell Techno",
        "808-style cowbell accents — electro-tinged groove",
        [
            d(b(BD,AC), b(CB)), REST, d(b(CB)), REST,
            d(b(SD), b(CB)),    REST, d(b(CB)), REST,
            d(b(BD,AC), b(CB)), REST, d(b(CB)), REST,
            d(b(SD), b(CB)),    REST, d(b(CB)), d(b(OH)),
        ],
    ),
    (
        "Half-Time",
        "Slow snare feel over driving kick — half-time heaviness",
        [
            d(b(BD,AC)), REST, REST, REST,
            REST,        REST, d(b(SD,AC)), REST,
            d(b(BD)),    d(b(BD,GH)), REST, REST,
            d(b(SD)),    REST, REST, REST,
        ],
    ),
    (
        "Rim Drive",
        "Rim shot on every 16th — industrial rim pulse",
        [
            d(b(BD,AC), b(RS)), d(b(RS)), d(b(BD), b(RS)), d(b(RS)),
            d(b(SD,AC), b(RS)), d(b(RS)), d(b(BD), b(RS)), d(b(RS)),
            d(b(BD,AC), b(RS)), d(b(RS)), d(b(BD), b(RS)), d(b(RS)),
            d(b(SD,AC), b(RS)), d(b(RS)), d(b(BD), b(RS)), d(b(RS)),
        ],
    ),
]

# ---------------------------------------------------------------------------
# ACID TECHNO DRUMS — hard, raw, aggressive, heavy accents
# ---------------------------------------------------------------------------

T8_ACID_DRUMS: list[tuple[str, str, list[DrumStep]]] = [
    (
        "Acid Four-Four",
        "Accented 4/4 with crashing OH on last 16th — maximum pressure",
        [
            d(b(BD,AC), b(CH)), d(b(CH)), d(b(CH)), d(b(CH)),
            d(b(SD,AC), b(CH)), d(b(CH)), d(b(CH)), d(b(CH)),
            d(b(BD,AC), b(CH)), d(b(CH)), d(b(CH)), d(b(CH)),
            d(b(SD,AC), b(CH)), d(b(CH)), d(b(CH)), d(b(OH,AC)),
        ],
    ),
    (
        "Kick Shuffle",
        "Double kick syncopation with open hats — raw acid floor",
        [
            d(b(BD,AC), b(CH)), REST,    d(b(BD), b(CH)), d(b(CH)),
            d(b(SD), b(CH)),    d(b(CH)), d(b(BD)), REST,
            d(b(BD,AC), b(BD,GH), b(CH)), d(b(CH)), REST, d(b(CH)),
            d(b(SD,AC), b(CH)), d(b(CH)), REST, d(b(CH)),
        ],
    ),
    (
        "Clap Attack",
        "Clap bursts over kick grid — raw warehouse energy",
        [
            d(b(BD,AC), b(CP)), REST, d(b(CP)), REST,
            d(b(BD), b(CP)),    d(b(CP)), d(b(BD)), REST,
            d(b(BD,AC), b(CP)), REST, d(b(CP)), REST,
            d(b(BD), b(CP)),    d(b(CP)), d(b(BD)), d(b(CP,AC)),
        ],
    ),
    (
        "Open Hat Acid",
        "Open hi-hat on every 8th — maximum resonance filter workout",
        [
            d(b(BD,AC), b(OH)), REST, d(b(OH)), REST,
            d(b(SD,AC), b(OH)), REST, d(b(OH)), REST,
            d(b(BD,AC), b(OH)), REST, d(b(OH)), REST,
            d(b(SD,AC), b(OH)), REST, d(b(OH)), REST,
        ],
    ),
    (
        "808 Raw",
        "Unquantised-feeling double kicks with sparse hats",
        [
            d(b(BD,AC)), d(b(BD,GH)), REST, REST,
            d(b(SD)),    d(b(BD)),    REST, d(b(CH)),
            d(b(BD,AC)), d(b(BD,GH)), REST, REST,
            d(b(SD)),    REST,        d(b(BD)), d(b(CH)),
        ],
    ),
    (
        "Acid Clap Stomp",
        "Layered clap+hat bursts — stomping club feel",
        [
            d(b(BD,AC)), REST,   d(b(CH)), d(b(CP)),
            d(b(BD), b(CH)), d(b(SD,AC), b(CH)), REST, d(b(CH)),
            d(b(BD,AC)), REST,   d(b(CH)), REST,
            d(b(BD), b(CH)), d(b(SD,AC), b(CP), b(CH)), REST, d(b(CH)),
        ],
    ),
    (
        "Rim Rush",
        "Rim shot on every step — industrial full-density assault",
        [
            d(b(BD,AC), b(RS)), d(b(RS)), d(b(RS)), d(b(RS)),
            d(b(SD,AC), b(RS)), d(b(RS)), d(b(RS)), d(b(RS)),
            d(b(BD,AC), b(RS)), d(b(RS)), d(b(RS)), d(b(RS)),
            d(b(SD,AC), b(RS)), d(b(RS)), d(b(RS)), d(b(RS,AC)),
        ],
    ),
    (
        "Triplet Ghost",
        "3-against-4 hi-hat feel — metric tension in 16 steps",
        [
            d(b(BD,AC)), REST,   d(b(CH)), REST,
            d(b(CH)),    d(b(SD,AC)), REST, d(b(CH)),
            d(b(BD)),    d(b(CH)), REST, d(b(SD,GH)),
            REST,        d(b(CH)), d(b(BD)), REST,
        ],
    ),
    (
        "Cowbell Acid",
        "Cowbell on offbeats with CB+SD layers — 808 signature",
        [
            d(b(BD,AC), b(CB)), d(b(CB)), d(b(CH)), REST,
            d(b(SD,AC), b(CB)), d(b(CH)), d(b(BD)),  REST,
            d(b(BD,AC), b(CB)), d(b(CB)), d(b(CH)), REST,
            d(b(SD,AC), b(CB)), REST, d(b(BD), b(CB)), d(b(CH)),
        ],
    ),
    (
        "Industrial Smash",
        "Dense double-kick with heavy snare — maximum aggression",
        [
            d(b(BD,AC)), d(b(BD,AC)), REST, d(b(SD,AC)),
            d(b(BD,AC)), REST,        d(b(SD,AC)), d(b(CH)),
            d(b(BD,AC)), d(b(BD,AC)), REST, d(b(SD,AC)),
            d(b(BD,AC)), REST,        d(b(CH)), d(b(SD,AC)),
        ],
    ),
]

# ---------------------------------------------------------------------------
# TRANCE DRUMS — 16th hats, clean snare on 2&4, crash accents
# ---------------------------------------------------------------------------

T8_TRANCE_DRUMS: list[tuple[str, str, list[DrumStep]]] = [
    (
        "Trance Classic",
        "4/4 kick, 16th hats, snare 2&4, crash on bar 4 — genre staple",
        [
            d(b(BD,AC), b(CH)), d(b(CH)), d(b(CH)), d(b(CH)),
            d(b(SD,AC), b(CH)), d(b(CH)), d(b(CH)), d(b(CH)),
            d(b(BD,AC), b(CH)), d(b(CH)), d(b(CH)), d(b(CH)),
            d(b(SD,AC), b(CY), b(CH)), d(b(CH)), d(b(CH)), d(b(OH)),
        ],
    ),
    (
        "Euro Trance",
        "Open hat on 4th 16th of each beat — euphoric lift",
        [
            d(b(BD,AC), b(CH)), d(b(CH)), d(b(CH)), d(b(CH), b(OH)),
            d(b(SD,AC), b(CH)), d(b(CH)), d(b(CH)), d(b(CH), b(OH)),
            d(b(BD,AC), b(CH)), d(b(CH)), d(b(CH)), d(b(CH), b(OH)),
            d(b(SD,AC), b(CH)), d(b(CH)), d(b(CH)), d(b(CH), b(OH)),
        ],
    ),
    (
        "Anthem Build",
        "Double kick bursts before snare — peak-time anthem feel",
        [
            d(b(BD,AC), b(CH)), d(b(BD), b(CH)), d(b(CH)), d(b(CH)),
            d(b(SD,AC), b(CH)), d(b(BD), b(CH)), d(b(CH)), d(b(CH)),
            d(b(BD,AC), b(CH)), d(b(BD), b(CH)), d(b(CH)), d(b(CH)),
            d(b(SD,AC), b(CY), b(CH)), d(b(CH)), d(b(CH)), d(b(OH,AC)),
        ],
    ),
    (
        "Trance Roll",
        "Crash on bar 3, open hat pickup — energy injection",
        [
            d(b(BD,AC), b(CH)), d(b(CH)), d(b(CH)), d(b(CH)),
            d(b(SD,AC), b(CH)), d(b(CH)), d(b(CH)), d(b(CH)),
            d(b(BD,AC), b(CY), b(CH)), d(b(CH)), d(b(CH)), d(b(CH)),
            d(b(SD,AC), b(CH)), d(b(CH)), d(b(CH), b(OH)), d(b(CH)),
        ],
    ),
    (
        "Progressive",
        "Varied hat density — subtle groove inside strict 4/4",
        [
            d(b(BD,AC), b(CH)), REST,   d(b(CH)), d(b(CH)),
            d(b(SD,AC), b(CH)), d(b(CH)), REST,   d(b(CH)),
            d(b(BD,AC), b(CH)), d(b(CH)), d(b(CH)), REST,
            d(b(SD,AC), b(CH)), d(b(CH)), d(b(CH)), d(b(CH)),
        ],
    ),
    (
        "Pumping Trance",
        "Syncopated double kick — floor-filling pump",
        [
            d(b(BD,AC), b(CH)), d(b(CH)), REST, d(b(CH)),
            d(b(BD), b(SD,AC), b(CH)), d(b(CH)), d(b(CH)), d(b(CH)),
            d(b(BD,AC), b(CH)), d(b(CH)), REST, d(b(CH)),
            d(b(BD), b(SD,AC), b(CH)), d(b(CH)), d(b(CH)), d(b(CH)),
        ],
    ),
    (
        "Break Trance",
        "Tom fill into crash — breakdown-to-drop transition",
        [
            d(b(BD,AC)), REST, REST, d(b(CH)),
            d(b(SD,AC), b(CH)), d(b(CH)), REST, d(b(CH)),
            d(b(BD,AC)), REST, d(b(TOM)), REST,
            d(b(SD,AC), b(TOM)), d(b(TOM), b(CY)), REST, d(b(CH)),
        ],
    ),
    (
        "16th Kick",
        "Kick on every 16th — relentless trance blitz",
        [
            d(b(BD,AC), b(CH)), d(b(BD), b(CH)), d(b(CH)), d(b(BD), b(CH)),
            d(b(SD,AC), b(BD), b(CH)), d(b(BD), b(CH)), d(b(CH)), d(b(BD), b(CH)),
            d(b(BD,AC), b(CH)), d(b(CH)), d(b(BD), b(CH)), d(b(CH)),
            d(b(SD,AC), b(CH)), d(b(BD), b(CH)), d(b(CH)), d(b(BD), b(CH)),
        ],
    ),
    (
        "Trance Gate",
        "Gated 8th feel — breakdown spacious groove",
        [
            d(b(BD,AC)), REST, d(b(CH)), REST,
            d(b(SD,AC)), REST, d(b(CH)), REST,
            d(b(BD,AC)), REST, d(b(CH)), REST,
            d(b(SD,AC), b(CY)), REST, d(b(CH)), REST,
        ],
    ),
    (
        "Peak Time",
        "All elements at once — final drop maximum energy",
        [
            d(b(BD,AC), b(CH)), d(b(CH)), d(b(CH)), d(b(CH)),
            d(b(SD,AC), b(CP), b(CH)), d(b(CH)), d(b(CH)), d(b(CH)),
            d(b(BD,AC), b(CH)), d(b(CH)), d(b(CH)), d(b(CH)),
            d(b(SD,AC), b(CP), b(CY), b(CH)), d(b(CH)), d(b(OH)), d(b(CH)),
        ],
    ),
]

# ---------------------------------------------------------------------------
# DUB TECHNO DRUMS — sparse, deep, spacious, reverb-implied
# ---------------------------------------------------------------------------

T8_DUB_DRUMS: list[tuple[str, str, list[DrumStep]]] = [
    (
        "Deep Dub",
        "Kick every 8 steps, single sparse snare — pure space",
        [
            d(b(BD,AC)), REST, REST, REST,
            REST,        REST, d(b(SD)), REST,
            REST,        REST, REST, REST,
            d(b(BD)),    REST, REST, REST,
        ],
    ),
    (
        "Dub Half-Time",
        "Half-time snare feel — deep and slow",
        [
            d(b(BD,AC)), REST, REST, REST,
            d(b(SD)),    REST, REST, REST,
            d(b(BD)),    REST, REST, REST,
            d(b(SD)),    REST, REST, REST,
        ],
    ),
    (
        "Minimal Pulse",
        "Two kick hits per bar — essential pulse only",
        [
            d(b(BD,AC)), REST, REST, REST,
            REST,        REST, REST, REST,
            d(b(BD)),    REST, d(b(SD,GH)), REST,
            REST,        REST, REST, REST,
        ],
    ),
    (
        "Dub Hi-Hat",
        "Kick + sparse closed hat + snare — reggae-dub skeleton",
        [
            d(b(BD,AC)), REST, d(b(CH)), REST,
            REST,        REST, d(b(CH)), REST,
            d(b(BD)),    REST, d(b(CH)), REST,
            d(b(SD)),    REST, d(b(CH)), REST,
        ],
    ),
    (
        "Ghost Kick",
        "Ghost kick echo — delayed double-hit illusion",
        [
            d(b(BD,AC)), REST, REST, d(b(BD,GH)),
            REST,        REST, d(b(SD)), REST,
            d(b(BD,AC)), REST, REST, REST,
            REST,        d(b(SD,GH)), REST, REST,
        ],
    ),
    (
        "Ride Dub",
        "Ride cymbal on 8ths — hypnotic metallic shimmer",
        [
            d(b(BD,AC)), REST, d(b(RD)), REST,
            d(b(SD)),    REST, d(b(RD)), REST,
            d(b(BD)),    REST, d(b(RD)), REST,
            d(b(SD)),    REST, d(b(RD)), REST,
        ],
    ),
    (
        "Open Space",
        "Open hat on offbeats only — wide reverb pockets",
        [
            d(b(BD,AC)), REST, REST, REST,
            REST,        d(b(OH)), REST, REST,
            d(b(BD)),    REST, REST, REST,
            d(b(SD)),    REST, d(b(OH)), REST,
        ],
    ),
    (
        "Rim Dub",
        "Rim shot punctuation — reggae-dub shot",
        [
            d(b(BD,AC)), REST, d(b(RS)), REST,
            REST,        REST, d(b(RS), b(SD)), REST,
            d(b(BD)),    REST, d(b(RS)), REST,
            REST,        d(b(RS)), REST, REST,
        ],
    ),
    (
        "Berlin Deep",
        "Slow shifting kick pattern — analogue club depth",
        [
            d(b(BD,AC)), REST, REST, REST,
            d(b(BD)),    REST, d(b(SD)), REST,
            REST,        REST, d(b(BD)), REST,
            REST,        d(b(SD,GH)), REST, d(b(BD,GH)),
        ],
    ),
    (
        "Pure Minimal",
        "Kick on 1&3, single snare on 3 — absolute minimum",
        [
            d(b(BD,AC)), REST, REST, REST,
            REST,        REST, d(b(SD)), REST,
            d(b(BD)),    REST, REST, REST,
            REST,        REST, REST, REST,
        ],
    ),
]

# ---------------------------------------------------------------------------
# IDM DRUMS — complex, polyrhythmic, glitchy, ghost-heavy
# ---------------------------------------------------------------------------

T8_IDM_DRUMS: list[tuple[str, str, list[DrumStep]]] = [
    (
        "Aphex Drill",
        "Displaced kick with ghost snare and hat flams — drill energy",
        [
            d(b(BD,AC), b(CH)), d(b(CH,GH)), d(b(SD)), d(b(CH)),
            d(b(BD)),   d(b(CH), b(SD,GH)), REST, d(b(CH)),
            d(b(BD,AC), b(CH)), d(b(CH,GH)), d(b(TOM)), d(b(SD)),
            d(b(BD), b(CH)), REST, d(b(CP,GH)), d(b(CH,GH)),
        ],
    ),
    (
        "Autechre Machine",
        "Mechanical irregular grid — off-kilter precision",
        [
            d(b(BD,AC)), d(b(BD,GH)), d(b(CH)), d(b(SD,GH)),
            d(b(CH)),    d(b(BD)),    d(b(CH)), d(b(SD,GH)),
            d(b(BD,AC)), d(b(CH)),    REST,     d(b(SD)),
            d(b(BD,GH)), REST, d(b(CP), b(CH)), REST,
        ],
    ),
    (
        "Drill'n'Bass",
        "Full 16th density with ghost layers — maximum complexity",
        [
            d(b(BD,AC), b(CH)), d(b(BD,GH), b(CH)), d(b(CH)), d(b(SD), b(CH)),
            d(b(CH)),           d(b(BD), b(CH)),     d(b(CH)), d(b(SD,GH), b(CH)),
            d(b(BD,AC), b(CH)), d(b(CH)),            d(b(BD,GH), b(CH)), REST,
            d(b(SD), b(CH)),    d(b(BD), b(CH)),     d(b(CH)), d(b(CP)),
        ],
    ),
    (
        "Broken Beat",
        "Kick on unexpected steps — broken groove",
        [
            REST,        d(b(BD,AC)), REST, REST,
            d(b(SD)),    REST,        d(b(BD)), d(b(CH,GH)),
            REST,        REST,        d(b(BD)), REST,
            d(b(TOM), b(SD)), REST, REST, d(b(BD), b(CH)),
        ],
    ),
    (
        "Polyrhythm 5",
        "5-step kick cell against 4/4 snare — metric illusion",
        [
            d(b(BD,AC)), REST, REST, REST,
            REST,        d(b(SD)), REST, REST,
            REST,        REST,    d(b(BD,AC)), REST,
            REST,        REST,    REST, d(b(SD,AC)),
        ],
    ),
    (
        "Glitch Groove",
        "Hat stutter with displaced snare — glitch aesthetic",
        [
            d(b(BD,AC)), d(b(CH)), d(b(CH,GH)), REST,
            d(b(SD), b(CH)), d(b(CH,GH)), d(b(BD,GH)), d(b(CH)),
            d(b(BD,AC)), REST, d(b(CH)), d(b(TOM)),
            d(b(SD)), d(b(CH,GH)), d(b(BD), b(CH)), REST,
        ],
    ),
    (
        "Clock Division",
        "Simultaneous 3+4+5 feel — complex polyrhythm",
        [
            d(b(BD,AC), b(CH)), d(b(CH)), d(b(CH)), d(b(CH,GH)),
            d(b(BD,GH), b(CH)), d(b(CH)), d(b(SD,AC), b(CH)), d(b(CH,GH)),
            d(b(BD,AC)), d(b(CH,GH)), d(b(CH)), d(b(SD,GH)),
            REST, d(b(BD), b(CH)), d(b(CH)), d(b(CP,GH)),
        ],
    ),
    (
        "Micro Pattern",
        "Ghost-heavy fast grid — Squarepusher energy",
        [
            d(b(BD,AC), b(CH)), d(b(CH,GH)), d(b(SD)), d(b(CH)),
            d(b(CH,GH)),        d(b(BD,GH)), d(b(CH)), d(b(SD,GH)),
            d(b(BD,AC), b(CH)), d(b(CH,GH)), d(b(TOM)), d(b(CH)),
            d(b(SD)),           d(b(CH,GH)), d(b(BD)), d(b(CP)),
        ],
    ),
    (
        "14/16 Ghost",
        "Pattern that feels like 7/4 in 4/4 — IDM metric trick",
        [
            d(b(BD,AC)), REST, REST, d(b(CH)),
            REST,        REST, d(b(SD)), d(b(CH,GH)),
            REST,        REST, d(b(BD)), d(b(CH)),
            REST,        REST, d(b(SD), b(CP)), REST,
        ],
    ),
    (
        "Warp Grid",
        "Shifting accent pattern — Autechre Confield era",
        [
            d(b(BD,AC), b(CH)), REST,        d(b(SD,GH)), d(b(CH)),
            d(b(BD)),           d(b(SD)),    REST,         d(b(CH,GH)),
            REST,               d(b(BD), b(CH)), REST, d(b(SD)),
            d(b(BD,GH)),        REST, d(b(CP), b(CH)), REST,
        ],
    ),
]

# ---------------------------------------------------------------------------
# EDM DRUMS — big room, festival, 4/4 with claps and crashes
# ---------------------------------------------------------------------------

T8_EDM_DRUMS: list[tuple[str, str, list[DrumStep]]] = [
    (
        "Big Room",
        "Festival 4/4 with clap+snare layer and crash — main stage",
        [
            d(b(BD,AC), b(CH)),         d(b(CH)), d(b(CH)), d(b(CH)),
            d(b(SD,AC), b(CP), b(CH)),  d(b(CH)), d(b(CH)), d(b(CH)),
            d(b(BD,AC), b(CH)),         d(b(CH)), d(b(CH)), d(b(CH)),
            d(b(SD,AC), b(CP), b(CY), b(CH)), d(b(CH)), d(b(CH)), d(b(OH,AC)),
        ],
    ),
    (
        "Festival Four",
        "Double kick on bar 2 and 4 — festival crowd bounce",
        [
            d(b(BD,AC), b(CH)), d(b(CH)), d(b(BD), b(CH)), d(b(CH)),
            d(b(SD,AC), b(CH)), d(b(CH)), d(b(BD), b(CH)), d(b(CH)),
            d(b(BD,AC), b(CH)), d(b(CH)), d(b(BD), b(CH)), d(b(CH)),
            d(b(SD,AC), b(CP), b(CH)), d(b(CH)), d(b(CH)), d(b(OH,AC), b(CH)),
        ],
    ),
    (
        "Build Up",
        "Kick drops out on bar 1&2, crash on 4 — tension + release",
        [
            d(b(BD,AC)), d(b(CH)), d(b(CH)), d(b(CH)),
            d(b(SD,AC), b(CH)), d(b(CH)), d(b(CH)), d(b(CH)),
            d(b(BD,AC)), d(b(CH)), d(b(CH)), d(b(CH)),
            d(b(SD,AC), b(CP), b(CH)), d(b(CH), b(OH)), d(b(CH)), d(b(CY,AC), b(OH)),
        ],
    ),
    (
        "Drop",
        "Full kick grid on drop — maximum floor energy",
        [
            d(b(BD,AC), b(CH)), d(b(CH)), d(b(CH)), d(b(CH)),
            d(b(SD,AC), b(CH)), d(b(CH)), d(b(BD), b(CH)), d(b(CH)),
            d(b(BD,AC), b(CH)), d(b(CH)), d(b(CH)), d(b(CH)),
            d(b(SD,AC), b(CP), b(CH)), d(b(BD), b(CH)), d(b(CH)), d(b(OH)),
        ],
    ),
    (
        "Electro House",
        "Kick on 1&2, clap on 2&4 — electro-house drive",
        [
            d(b(BD,AC)), d(b(CH)), REST,  d(b(CH)),
            d(b(SD,AC), b(CP)), d(b(CH)), REST, d(b(CH)),
            d(b(BD,AC)), d(b(CH)), d(b(BD)), d(b(CH)),
            d(b(SD,AC), b(CP)), d(b(CH)), REST, d(b(OH), b(CH)),
        ],
    ),
    (
        "Progressive House",
        "Consistent 4/4 with 16th hats — progressive floor groove",
        [
            d(b(BD,AC), b(CH)), d(b(CH)), d(b(CH)), d(b(CH)),
            d(b(SD,AC), b(CH)), d(b(CH)), d(b(CH)), d(b(CH)),
            d(b(BD,AC), b(CH)), d(b(CH)), d(b(BD), b(CH)), d(b(CH)),
            d(b(SD,AC), b(CH)), d(b(CH)), d(b(CH)), d(b(CH)),
        ],
    ),
    (
        "Pluck Beat",
        "Gated kick feel — syncopated EDM pop groove",
        [
            d(b(BD,AC), b(CH)), REST, d(b(CH)), REST,
            d(b(SD,AC), b(CP), b(CH)), REST, d(b(CH)), REST,
            d(b(BD,AC), b(CH)), REST, d(b(CH)), REST,
            d(b(SD,AC), b(CP), b(CH)), d(b(BD), b(CH)), d(b(OH)), REST,
        ],
    ),
    (
        "Tomorrowland",
        "Crash on beat 1, full clap layers — festival closing anthem",
        [
            d(b(BD,AC), b(CH), b(CY)), d(b(CH)), d(b(CH)), d(b(CH)),
            d(b(SD,AC), b(CP), b(CH)), d(b(CH)), d(b(CH)), d(b(CH)),
            d(b(BD,AC), b(CH)),        d(b(CH)), d(b(CH)), d(b(CH)),
            d(b(SD,AC), b(CP), b(CY), b(CH)), d(b(CH)), d(b(OH)), d(b(CH)),
        ],
    ),
    (
        "Underground EDM",
        "Less commercial, more floor — edgier hat work",
        [
            d(b(BD,AC), b(CH)), d(b(CH)), d(b(BD), b(CH)), d(b(CH)),
            d(b(SD,AC), b(CH)), d(b(CH)), d(b(CH)), d(b(OH)),
            d(b(BD,AC), b(CH)), d(b(CH)), d(b(BD), b(CH)), d(b(CH)),
            d(b(SD,AC), b(CP), b(CH)), d(b(CH)), d(b(OH)), d(b(CH)),
        ],
    ),
    (
        "Afterhours",
        "Late-night groove — slightly broken, deeply hypnotic",
        [
            d(b(BD,AC)), d(b(CH)), REST, d(b(BD), b(CH)),
            d(b(SD,AC), b(CH)), d(b(CH)), d(b(BD)), d(b(CH)),
            d(b(BD,AC)), d(b(CH)), REST, d(b(CH)),
            d(b(SD,AC), b(CP), b(CH)), d(b(CH)), d(b(BD), b(OH)), d(b(CH)),
        ],
    ),
]

# ---------------------------------------------------------------------------
# T-8 BASS PATTERNS (Ch 2)  —  one per genre, Step format
# Root defaults to A2 (MIDI 45). Semitone offsets same as S-1.
# ---------------------------------------------------------------------------

T8_TECHNO_BASS = (
    "Techno Root Drive",
    "8th-note root pulse with b7 resolution",
    [st(0), N, st(0), N, st(0), N, st(0), N,
     st(0), N, st(0), N, st(0), N, st(10), N],
)

T8_ACID_BASS = (
    "Acid 303 Line",
    "Sliding root–octave–b7 with accents — classic acid bass",
    [st(0, R, S), st(12), st(-2), N,
     st(0, A),   st(3),  N,      st(0, R, S),
     st(12),     N,      st(-2), st(-5),
     st(3, A),   N,      st(0),  N],
)

T8_TRANCE_BASS = (
    "Trance Fifth Arp",
    "Root–5th–octave movement — driving trance sub",
    [st(0), N, st(7), N, st(0), N, st(12), N,
     st(0), N, st(7), N, st(5), N, st(7),  N],
)

T8_DUB_BASS = (
    "Dub Sub Walk",
    "Sub-octave with slow ascent — deep pressure bass",
    [st(-12), N, N, N, N, N, st(-12), N,
     N, N, N, st(-5), N, N, N, N],
)

T8_IDM_BASS = (
    "IDM Stutter Bass",
    "Irregular 303-style with chromatic dips — glitchy sub",
    [st(0), st(0, R, S), st(3), N,
     st(7, R, S), st(5), N, st(0),
     N, st(-2, R, S), st(0), N,
     st(3), N, st(7), N],
)

T8_EDM_BASS = (
    "EDM Pump Bass",
    "Sidechain-feel octave pump — big room sub",
    [st(0), N, N, N, st(0), N, N, N,
     st(0), N, st(12), N, st(0), N, N, N],
)

# ---------------------------------------------------------------------------
# T-8 Genre registries
# ---------------------------------------------------------------------------

T8_DRUMS: dict[str, list[tuple]] = {
    "techno":       T8_TECHNO_DRUMS,
    "acid-techno":  T8_ACID_DRUMS,
    "trance":       T8_TRANCE_DRUMS,
    "dub-techno":   T8_DUB_DRUMS,
    "idm":          T8_IDM_DRUMS,
    "edm":          T8_EDM_DRUMS,
}

T8_BASS: dict[str, tuple] = {
    "techno":       T8_TECHNO_BASS,
    "acid-techno":  T8_ACID_BASS,
    "trance":       T8_TRANCE_BASS,
    "dub-techno":   T8_DUB_BASS,
    "idm":          T8_IDM_BASS,
    "edm":          T8_EDM_BASS,
}

T8_GENRE_NAMES = list(T8_DRUMS.keys())


def get_t8_drum_pattern(genre: str, index: int) -> list[DrumStep]:
    """Return drum pattern steps for genre and 1-based index."""
    if genre not in T8_DRUMS:
        raise ValueError(f"Unknown genre '{genre}'. Choose: {', '.join(T8_GENRE_NAMES)}")
    patterns = T8_DRUMS[genre]
    if not (1 <= index <= len(patterns)):
        raise ValueError(f"Pattern index must be 1–{len(patterns)}, got {index}")
    return patterns[index - 1][2]


def get_t8_bass_pattern(genre: str) -> tuple[list[Step], str]:
    """Return (bass_steps, description) for the genre's auto bass line."""
    if genre not in T8_BASS:
        raise ValueError(f"Unknown genre '{genre}'.")
    entry = T8_BASS[genre]
    return entry[2], entry[1]


def list_t8_patterns() -> str:
    """Return a formatted listing of all T-8 drum patterns."""
    lines = []
    for genre, entries in T8_DRUMS.items():
        bass_name = T8_BASS[genre][0]
        lines.append(f"\n  {genre.upper()} (bass: {bass_name})")
        lines.append(f"  {'─' * 64}")
        for i, (name, desc, _) in enumerate(entries, 1):
            lines.append(f"  {i:2d}. {name:<24s}  {desc}")
    return "\n".join(lines)
