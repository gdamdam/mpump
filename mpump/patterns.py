# Pattern library for the S-1 sequencer.
#
# Step type: None  →  rest
#            (semitone_offset: int, velocity_factor: float, slide: bool)
#
# semitone_offset is relative to the key root note (octave 2).
#   0  = root (e.g. A2 when key=A)
#  12  = one octave up
# -12  = one octave down
#   7  = perfect 5th above root
# Natural-minor intervals from root: 0,2,3,5,7,8,10
# Chromatic passing tones are allowed (used in acid patterns).
#
# velocity_factor: 1.0 = normal, 1.3 = accent
# slide: True  →  legato into next note (monosynth glide)

Step = tuple[int, float, bool] | None  # (semitones, vel_factor, slide) | rest

N = None          # rest shorthand
R = 1.0           # normal velocity
A = 1.3           # accent velocity
_ = False         # no slide
S = True          # slide


def st(semitones: int, vel: float = R, slide: bool = _) -> Step:
    """Convenience constructor for a step."""
    return (semitones, vel, slide)


# ---------------------------------------------------------------------------
# TECHNO  (4/4 driving, mechanical, no slides)
# Root at octave 2.  Natural minor scale: 0,2,3,5,7,8,10
# ---------------------------------------------------------------------------

TECHNO: list[tuple[str, list[Step]]] = [
    (
        "Iron Grid",
        "8th-note root pulse — hypnotic and relentless",
        [st(0), N, st(0), N, st(0), N, st(0), N,
         st(0), N, st(0), N, st(0), N, st(0), N],
    ),
    (
        "Pump",
        "Syncopated root hits — classic industrial groove",
        [st(0), N, N, st(0), N, st(0), N, N,
         st(0), N, N, st(0), N, st(0), N, N],
    ),
    (
        "Fifth Power",
        "Root and perfect 5th alternating — wide and powerful",
        [st(0), N, st(7), N, st(0), N, st(7), N,
         st(0), N, st(7), N, st(0), N, st(7), N],
    ),
    (
        "Octave Driver",
        "Root octave-jump on every 16th — propulsive energy",
        [st(0), st(12), st(0), st(12), st(0), st(12), st(0), st(12),
         st(0), st(12), st(0), st(12), st(0), st(12), st(0), st(12)],
    ),
    (
        "Detroit Classic",
        "Minor pentatonic groove — motor-city soul",
        [st(0), N, st(3), N, st(0), N, N, st(-2),
         st(0), N, st(3), N, st(7), N, N, N],
    ),
    (
        "Minor Walk",
        "Stepwise minor motion — tense and forward-moving",
        [st(0), st(3), st(0), st(3), st(5), st(3), st(0), N,
         st(0), st(3), st(0), st(3), st(7), st(5), st(3), st(0)],
    ),
    (
        "Sub Pulse",
        "One octave down, very sparse — sub-bass weight",
        [st(-12), N, N, N, st(-12), N, N, st(-12),
         N, N, N, st(-12), N, N, st(-12), N],
    ),
    (
        "Three-Note Groove",
        "Root–b3–5 repeating cell — minimal and locked",
        [st(0), N, st(3), st(7), st(0), N, st(3), st(7),
         st(0), N, st(3), st(7), st(0), N, st(3), st(7)],
    ),
    (
        "Dark Descent",
        "Falling minor scale from octave — cinematic sweep",
        [st(12), st(10), st(7), st(5), st(3), st(2), st(0), st(-2),
         st(12), st(10), st(7), st(5), st(3), st(2), st(0), N],
    ),
    (
        "Industrial Pulse",
        "Irregular accent cluster — raw mechanical energy",
        [st(0), st(0), N, st(0), st(0), N, st(0), N,
         st(0), st(0), N, st(0), N, st(0), st(0), N],
    ),
]

# ---------------------------------------------------------------------------
# ACID TECHNO  (TB-303 style: slides, accents, chromatic passing tones)
# Chromatic intervals freely used.  Slides create monosynth glide.
# ---------------------------------------------------------------------------

ACID_TECHNO: list[tuple[str, list[Step]]] = [
    (
        "Classic 303",
        "Root–octave–b7 with slides and accents — the definitive acid line",
        [st(0, R, S), st(12), st(-2), N,
         st(0, A),    st(3),  N,      st(0, R, S),
         st(12),      N,      st(-2), st(-5),
         st(3, A),    N,      st(0),  N],
    ),
    (
        "Squelch Pump",
        "Accent root into octave leaps — maximum resonance workout",
        [st(0, A),    N,       st(0, R, S), st(12),
         st(-2, R, S), st(0),  N,           st(3, A),
         st(0, R, S),  st(12), N,           st(15),
         st(12),       N,      st(0, A, S), st(0)],
    ),
    (
        "Chromatic Crawl",
        "Semitone passing tones into root — slithering chromatic acid",
        [st(0, R, S), st(1),  st(2, R, S), st(3),
         N,           st(0, A, S), st(12), N,
         st(-1, R, S), st(0), N,           st(3, R, S),
         st(5),        N,     st(0, A),    N],
    ),
    (
        "Resonant Bounce",
        "Root accents with falling 5th–4th–b3 fill — filter workout",
        [st(0, A),    N, st(0, R, S), st(7),
         st(0, A),    N, st(0, R, S), st(5),
         st(0, A),    N, st(0, R, S), st(3),
         st(0, A, S), st(-2), st(0),  N],
    ),
    (
        "Acid Roll",
        "Busy 16th-note flow — non-stop squelch",
        [st(0),  st(7),  st(0),  st(3),
         st(-2), st(0),  st(7, A), st(0),
         st(0),  st(5),  st(0),  st(3),
         st(-2, R, S), st(0), st(-2, A), st(0)],
    ),
    (
        "Dark Acid",
        "Sub-octave register with rare octave stabs — deep and menacing",
        [st(-12),       N,  N,  st(-12, R, S),
         st(0, A),      N,  N,  st(-12, R, S),
         st(-14, R, S), st(-12), N, N,
         st(-9, A),     N,  N,  st(-12)],
    ),
    (
        "303 Minor",
        "Sliding minor triad arpeggio — melodic acid tension",
        [st(0, R, S), st(3, R, S), st(7),  N,
         st(0, R, S), st(5, R, S), st(7),  N,
         st(0, R, S), st(3),       N,      st(-2, A, S),
         st(0, R, S), N,           st(12), N],
    ),
    (
        "Hardfloor Spiral",
        "Octave squeals + chromatic returns — relentless spiral motion",
        [st(0, A),    st(12),       st(10, R, S), st(12),
         st(7),       N,            st(8,  R, S), st(7),
         st(0, R, S), st(-1),       st(0,  A),    st(3, R, S),
         st(7),       st(12, A),    N,            st(10, R, S)],
    ),
    (
        "303 Bounce",
        "Accent–rest–slide pattern — rubbery 303 bounce",
        [st(0, A),    N, st(-2, R, S), st(0),
         N,           st(12, A), N,    st(-2, R, S),
         st(0),       N, st(7, A),     N,
         st(0, R, S), st(-2), st(0, A), N],
    ),
    (
        "Acid Ostinato",
        "Sliding root ostinato with upper note fills — hypnotic acid lock",
        [st(0, R, S), st(0), st(7, R, S), st(-2),
         st(0, A),    st(0, R, S), st(12), N,
         st(0, R, S), st(0), st(7, R, S), st(3),
         st(5, A),    N,     st(0, R, S), N],
    ),
    (
        "Acid Tracks-ish",
        "Root/b7 bounce with a mid-bar squeal — OG Chicago flavor",
        [st(0, A),    N,            st(-2, R, S), st(0),
         st(3),       N,            st(0,  A, S), st(12),
         N,           st(10, R, S), st(12),       N,
         st(7, A),    N,            st(3,  R, S), st(0)],
    ),
    (
        "Higher State Lift",
        "Upward stabs + slide pulls — peak-time tension",
        [st(0, A),    st(3),        N,            st(7, R, S),
         st(12, A),   N,            st(10),       st(12, R, S),
         st(7),       N,            st(8,  R, S), st(7),
         st(5, A),    st(3),        N,            st(0, R, S)],
    ),
    (
        "707 Jacks",
        "Jacking syncopation: accent–rest–slide loop (rubbery)",
        [st(0, A),    N,            st(-2, R, S), st(0),
         N,           st(3,  A),    N,            st(0, R, S),
         st(7),       N,            st(5,  R, S), st(3),
         N,           st(0,  A, S), st(-2),       st(0)],
    ),
    (
        "Confusion Runner",
        "Minor-ish run with chromatic approaches — nervous drive",
        [st(0, R, S), st(2),        st(3, R, S),  st(5),
         st(7),       st(8, A),     N,            st(7, R, S),
         st(5),       st(3),        st(2, R, S),  st(0),
         st(-1),      st(0, A, S),  st(12),       N],
    ),
    (
        "Acid Thunder",
        "Aggro accents + low dips — punchy, percussive acid",
        [st(0, A),    st(0),        N,            st(-5, R, S),
         st(-2, A),   N,            st(0, R, S),  st(3),
         st(0, A),    N,            st(7, R, S),  st(5),
         st(3, A),    N,            st(0, R, S),  N],
    ),
    (
        "Octave Scream",
        "Repeated octave yelps then fall back into groove",
        [st(0, A, S), st(12),       N,            st(12, A),
         st(10, R, S),st(12),       N,            st(7,  R, S),
         st(0, A),    st(0),        st(3, R, S),  N,
         st(7, A),    N,            st(5, R, S),  st(3)],
    ),
    (
        "Tritone Tease",
        "b5 passing hits as chromatic tension — classic acid nastiness",
        [st(0, R, S), st(6),        st(5, R, S),  st(7),
         N,           st(0, A, S),  st(12),       st(6),
         st(7, R, S), N,            st(5),        st(3, R, S),
         st(0, A),    N,            st(-1, R, S), st(0)],
    ),
    (
        "Rubber Band",
        "Slide chains across small intervals — ultra-liquid 303",
        [st(0, R, S), st(1, R, S),  st(0, R, S),  st(-1, R, S),
         st(0, A, S), N,            st(3, R, S),  st(2, R, S),
         st(3, A, S), st(5, R, S),  N,            st(3, R, S),
         st(0, A, S), st(-2, R, S), st(0, R, S),  N],
    ),
    (
        "12-Step Illusion",
        "Feels like a shorter cycle inside 16 — great for phasing vs drums",
        [st(0, A),    N,            st(3, R, S),  N,
         st(7),       N,            st(10, R, S), N,
         st(12, A),   N,            st(10, R, S), st(7),
         N,           N,            st(3, R, S),  st(0)],
    ),
    (
        "Warehouse Razor",
        "Dense but with air pockets — accented hooks, chromatic bites",
        [st(0, A),    st(7),        N,            st(8,  R, S),
         st(7),       st(5),        N,            st(3,  A),
         st(0, R, S), st(-2),       st(-1, R, S), st(0),
         st(3, A, S), st(7),        st(12, A),    N],
    ),
]

# ---------------------------------------------------------------------------
# TRANCE  (melodic, arpeggiated, higher register)
# Root at octave 2 but patterns reach up 2+ octaves.
# Natural minor: 0,2,3,5,7,8,10  (+12 = octave)
# ---------------------------------------------------------------------------

TRANCE: list[tuple[str, list[Step]]] = [
    (
        "Arp Up",
        "Full two-octave ascending then descending — anthemic opener",
        [st(0), st(3), st(7), st(12), st(15), st(19), st(24), st(19),
         st(15), st(12), st(7), st(3), st(0), st(-5), st(3), st(7)],
    ),
    (
        "Power Arp",
        "Root–5th–octave–5th repeating with one bar twist — driving trance",
        [st(0), st(7), st(12), st(7), st(0), st(7), st(12), st(10),
         st(0), st(7), st(12), st(7), st(0), st(7), st(5),  st(7)],
    ),
    (
        "Trance Gate",
        "Gated 8th-note chords descending i–VII–V — classic breakdown feel",
        [st(12), N, st(12), N, st(12), N, st(12), N,
         st(10), N, st(10), N, st(7),  N, st(7),  N],
    ),
    (
        "Melodic Run",
        "Full natural-minor scale up and back — smooth melodic flow",
        [st(0), st(2), st(3), st(5), st(7), st(8), st(10), st(12),
         st(10), st(8), st(7), st(5), st(3), st(2), st(0), N],
    ),
    (
        "Anthem",
        "i–V–iv–III–i repeating — peak-time anthem progression",
        [st(12), st(12), st(7), st(7), st(5), st(5), st(3), st(3),
         st(0),  st(0),  st(7), st(7), st(8), st(8), st(7), N],
    ),
    (
        "Minor Uplift",
        "i–III–V–VII arch into iv–VI–i — emotional trance lift",
        [st(0), st(3), st(7), st(10), st(12), st(10), st(7), st(3),
         st(5), st(8), st(12), st(15), st(12), st(10), st(7), st(0)],
    ),
    (
        "Stab Sequence",
        "Alternating low root with upper-note stabs — punchy stab line",
        [st(0), N, st(7),  N, st(3),  N, st(7),  N,
         st(0), N, st(10), N, st(7),  N, st(12), N],
    ),
    (
        "Trance Bass",
        "Root 16th-note drive with 5th pickup — floor-filling bass",
        [st(0), st(0), st(0), st(0), st(0), st(0), st(0), st(7),
         st(0), st(0), st(0), st(0), st(-2), st(-2), st(0), st(0)],
    ),
    (
        "Suspended Build",
        "i–iv–III–VII modal shift — tension that demands release",
        [st(0), st(7), st(12), st(7), st(5),  st(12), st(17), st(12),
         st(3), st(10), st(15), st(10), st(7), st(14), st(19), st(14)],
    ),
    (
        "Trance Climax",
        "Wide arpeggiated sweep with chromatic passing — big-room moment",
        [st(0), st(3), st(7),  st(12), st(15), st(12), st(10), st(7),
         st(5), st(8), st(12), st(17), st(15), st(12), st(7),  st(0)],
    ),
]

# ---------------------------------------------------------------------------
# DUB TECHNO  (sparse, deep, dark, lower register, lots of space)
# Root at octave 2.  Sub-octave via offset -12 (A1).
# ---------------------------------------------------------------------------

DUB_TECHNO: list[tuple[str, list[Step]]] = [
    (
        "Deep Pulse",
        "Single root note every 8 steps — pure space and weight",
        [st(0), N, N, N, N, N, N, N,
         st(0), N, N, N, N, N, N, N],
    ),
    (
        "Dub Groove",
        "Root with occasional 5th dip — minimal dub foundation",
        [st(0), N, N, N, st(0), N, N, st(-5),
         N, N, N, st(0), N, N, N, N],
    ),
    (
        "Underwater",
        "Sub-octave with rare high-root breath — deep pressure",
        [st(-12), N, N, N, N, N, N, st(-12),
         N, N, N, st(-5), N, N, N, N],
    ),
    (
        "Minimal Dub",
        "Sparse dotted hits — air and patience",
        [st(0), N, N, st(0), N, N, N, N,
         st(0), N, N, N, N, st(0), N, N],
    ),
    (
        "Dark Root",
        "Sub-octave with rare jump to root — massive low-end",
        [st(-12), N, N, N, st(-12), N, N, st(-12),
         N, N, st(0), N, N, N, N, N],
    ),
    (
        "Dub Minor",
        "Slow descending i–VII–VI–V — melancholic dub chord walk",
        [st(0), N, N, N, st(-2), N, N, N,
         st(-4), N, N, N, st(-5), N, N, N],
    ),
    (
        "Echospace",
        "Paired hits separated by long gaps — echo-delay suggestion",
        [st(0), st(0), N, N, N, N, st(0), st(0),
         N, N, st(0), st(0), N, N, N, N],
    ),
    (
        "Sub Walk",
        "Very slow ascending i–III–V–VII from sub — long harmonic journey",
        [st(-12), N, N, N, st(-9), N, N, N,
         st(-5),  N, N, N, st(-2), N, N, N],
    ),
    (
        "Berlin Dub",
        "Root with 5th and b7 ornaments — stripped Berlin warehouse feel",
        [st(0), N, N, st(-5), N, N, N, N,
         st(0), N, N, N, st(-2), N, N, N],
    ),
    (
        "Deep Resolve",
        "Sub to root to b7 resolution — slow harmonic breathe",
        [st(-12), N, N, N, N, N, st(0), N,
         N, N, st(-2), N, N, N, st(0), N],
    ),
]

# ---------------------------------------------------------------------------
# IDM  (complex rhythms, chromatic/dissonant movement, slide-heavy)
# Characteristic: irregular step density, polytonal passing tones,
# micro-repetitions, 3+3+3+7 metric ambiguity within 16 steps.
# ---------------------------------------------------------------------------

IDM: list[tuple[str, list[Step]]] = [
    (
        "Aphex Low",
        "Sub-octave sparse beauty — slow, dissonant, haunting",
        [st(-12), N, N, N, st(-11), N, N, N,
         st(-12), N, N, N, st(-9), N, N, N],
    ),
    (
        "Drill Cell",
        "Rapid irregular 16ths — glitchy machine energy",
        [st(0), st(0), N, st(3), st(0), N, st(7), N,
         st(0), st(0), N, st(5), st(3), N, st(0), N],
    ),
    (
        "Autechre Pulse",
        "Mechanical offbeat displacement — feels like 5/4 inside 4/4",
        [N, st(0), N, N, st(3), N, st(0), N,
         N, st(5), N, st(0), N, N, st(3), N],
    ),
    (
        "Glide Cluster",
        "Chromatic slides with semi-random direction — slithering dissonance",
        [st(0, R, S), st(1), st(3, R, S), st(2), st(0), N, st(5, R, S), st(7),
         st(5), N, st(3, R, S), st(2), st(0), N, st(-1), N],
    ),
    (
        "Broken Arp",
        "Displaced minor arpeggio — familiar intervals, wrong order",
        [st(7), N, st(0), N, st(12), N, st(3), N,
         st(5), N, N, st(7), st(0), N, st(10), N],
    ),
    (
        "Polymetric 3",
        "3+3+3+3+4 grouping across 16 steps — metric illusion",
        [st(0), N, N, st(3), N, N, st(7), N,
         N, st(0), N, N, st(5), N, N, N],
    ),
    (
        "Micro Stutter",
        "Repeating 2-note cells with rhythmic displacement",
        [st(0), st(0), N, st(3), st(3), N, st(0), N,
         st(0), st(0), N, N, st(5), st(5), st(0), N],
    ),
    (
        "5-Note Ghost",
        "Five-note modal cell cycling across 16 — phasing effect",
        [st(0), N, st(3), N, st(5), N, N, st(0),
         N, st(3), N, N, st(7), N, st(5), N],
    ),
    (
        "Cluster Bomb",
        "Chromatic cluster with octave escape — dense and volatile",
        [st(0), st(1), st(2), N, st(3), N, st(2), st(1),
         st(0), N, st(-1), N, st(0), st(1), st(3), N],
    ),
    (
        "Warp Sequence",
        "Wide interval jumps — Warp Records early-90s catalogue energy",
        [st(0), N, st(12), N, N, st(3), N, st(19),
         N, st(0), N, st(7), N, N, st(10), N],
    ),
]

# ---------------------------------------------------------------------------
# EDM  (commercial dance music: big room, progressive house, festival)
# Characteristic: 4-on-the-floor feel in bass, anthemic hooks,
# sidechain-pump simulation, octave jumps, build/drop contrast.
# ---------------------------------------------------------------------------

EDM: list[tuple[str, list[Step]]] = [
    (
        "Main Stage",
        "Simple powerful hook — instantly memorable, stadium-ready",
        [st(0), N, N, st(0), N, st(0), st(3), N,
         st(5), N, N, st(5), N, st(3), st(0), N],
    ),
    (
        "Bounce",
        "8th-note groove with melodic peak — upbeat festival energy",
        [st(0), N, st(0), N, st(3), N, st(5), N,
         st(7), N, st(5), N, st(3), N, st(0), N],
    ),
    (
        "Festival Arp",
        "16th-note climb and fall — peak-time crowd lift",
        [st(0), st(3), st(7), st(10), st(12), st(10), st(7), st(5),
         st(3), st(5), st(7), st(10), st(7), st(5), st(3), st(0)],
    ),
    (
        "Pluck Burst",
        "Staccato synth pluck with rhythmic gaps — sidechain feel",
        [st(0), st(0), st(0), N, st(3), st(3), N, st(5),
         N, st(7), N, st(5), st(3), N, st(0), N],
    ),
    (
        "Pumping Octave",
        "Root + octave alternating — simulates sidechain compression",
        [st(0), N, st(12), N, st(0), N, st(12), N,
         st(0), N, st(12), N, st(0), N, st(12), N],
    ),
    (
        "Build Stab",
        "Rising single-note tension — classic EDM pre-drop build",
        [st(0), N, st(0), N, st(0), N, st(0), N,
         st(3), N, st(3), N, st(5), N, st(7), N],
    ),
    (
        "Chord Pluck",
        "Arpeggiated chord tones — progressive house movement",
        [st(0), st(7), st(3), st(7), st(0), st(7), st(5), st(3),
         st(0), st(7), st(3), st(5), st(0), st(7), st(3), st(0)],
    ),
    (
        "Breakdown Pad",
        "Long sustained scale tones — emotional breakdown moment",
        [st(0), N, N, N, st(3), N, N, N,
         st(5), N, N, N, st(7), N, N, N],
    ),
    (
        "Drop Fill",
        "Quick ascending fill into sustained drop — energy burst",
        [st(0), st(0), st(3), st(3), st(5), st(5), st(7), st(7),
         st(10), st(7), st(5), st(3), st(0), st(0), st(0), st(0)],
    ),
    (
        "Big Room",
        "Energetic 16th root drive with upper hook — anthem closer",
        [st(0), st(3), st(0), st(3), st(5), st(3), st(0), st(3),
         st(7), st(5), st(3), st(0), st(3), st(5), st(7), st(10)],
    ),
]

# ---------------------------------------------------------------------------
# DRUM AND BASS  (syncopated, rolling sub, fast energy)
# ---------------------------------------------------------------------------

DRUM_AND_BASS: list[tuple[str, list[Step]]] = [
    (
        "Reese Roll",
        "Deep sliding Reese sub roll — classic DnB foundation",
        [st(0, R, S), st(0), N, st(0, R, S), st(-2), N, st(0, R, S), st(0),
         N, st(0, R, S), st(0), N, st(-2, R, S), st(0), N, N],
    ),
    (
        "Amen Bass",
        "Syncopated root/5th groove — locks to Amen break",
        [st(0, A), N, N, st(0), N, st(7), N, st(0),
         N, st(0, A), N, N, st(7), N, st(0), N],
    ),
    (
        "Liquid Line",
        "Smooth minor melodic run — liquid DnB feel",
        [st(0), N, st(3), N, st(5), N, st(7), N,
         st(5), N, st(3), N, st(0), N, N, N],
    ),
    (
        "Neuro Stab",
        "Chromatic stab pattern — neurofunk sub pressure",
        [st(0, A), N, st(0), N, st(-1, A), N, st(0), N,
         st(0, A), N, N, st(-2), N, st(0, A), N, N],
    ),
    (
        "Jump Up",
        "Syncopated root accents — jump-up DnB energy",
        [st(0, A), N, N, st(0), N, st(0, A), N, N,
         st(0), N, st(0, A), N, N, N, st(0), N],
    ),
    (
        "Roller",
        "Constant rolling sub with accent — relentless DnB floor",
        [st(0), st(0), N, st(0), st(0), N, st(0, A), N,
         st(0), st(0), N, st(0), N, st(0, A), N, N],
    ),
    (
        "Steppers",
        "Sparse locked-step bass — minimal and precise",
        [st(0, A), N, N, N, st(0), N, N, N,
         st(0, A), N, N, st(-2), N, N, N, N],
    ),
    (
        "Darkstep",
        "Descending minor fall — menacing darkstep DnB",
        [st(0, A), N, N, st(0), N, st(-2), N, st(-5),
         N, st(-7), N, N, st(-5), N, N, N],
    ),
    (
        "Halfstep",
        "Halftime feel — massive drops every two bars",
        [st(0, A), N, N, N, N, N, N, st(-2),
         N, N, N, N, st(0, A), N, N, N],
    ),
    (
        "Technical Run",
        "Fast chromatic DnB run — precision bass playing",
        [st(0), st(1), st(2), st(3), st(2), st(0), N, st(0),
         st(7), st(5), st(3), st(0), N, st(-2), st(0), N],
    ),
]

# ---------------------------------------------------------------------------
# HOUSE  (4/4 groove, funky, soulful bass lines)
# ---------------------------------------------------------------------------

HOUSE: list[tuple[str, list[Step]]] = [
    (
        "Classic Pump",
        "8th-note root pump with 5th accent — house foundation",
        [st(0), N, st(0), N, st(0), N, st(0), N,
         st(0), N, st(0), N, st(5), N, st(0), N],
    ),
    (
        "Deep Walk",
        "Slow walking bass — deep house soul",
        [st(0), N, N, N, st(3), N, N, st(5),
         N, N, st(7), N, N, N, st(5), N],
    ),
    (
        "Chicago Jack",
        "Jacking syncopation — classic Chicago house",
        [st(0, A), N, st(0), N, N, st(0, A), N, st(0),
         N, st(0, A), N, N, st(5, A), N, st(0), N],
    ),
    (
        "Funk Line",
        "Funky off-beat groove — soulful house",
        [st(0, A), N, N, st(0), N, st(3), N, N,
         st(5, A), N, N, st(3), N, st(0), N, N],
    ),
    (
        "Tech Stab",
        "Short staccato stabs — tech house punch",
        [st(0, A), N, st(0, A), N, N, st(0, A), N, N,
         st(0, A), N, st(0, A), N, N, st(5, A), N, N],
    ),
    (
        "Soulful Walk",
        "R&B-influenced walking bass — gospel house feel",
        [st(0), N, st(3), N, st(5), N, st(7), st(5),
         st(3), N, st(0), N, st(-2), N, st(0), N],
    ),
    (
        "303 House",
        "Acid house 303-style sliding line — squelchy floor filler",
        [st(0, R, S), st(0), st(7, R, S), st(-2),
         st(0, A), N, st(0, R, S), st(12),
         N, st(0, R, S), st(5), N,
         st(3, A), N, st(0, R, S), N],
    ),
    (
        "Bounce",
        "Syncopated bouncing groove — upbeat house feel",
        [st(0, A), N, N, st(0), N, N, st(3), N,
         st(5, A), N, N, st(3), N, st(0), N, N],
    ),
    (
        "Future Bass",
        "Root + octave alternating pump — modern house sub",
        [st(0), N, st(12), N, st(0), N, st(12), N,
         st(0), N, st(7), N, st(0), N, st(5), N],
    ),
    (
        "Minimal House",
        "Very sparse root hits — deep minimal house",
        [st(0, A), N, N, N, N, N, N, N,
         st(5), N, N, N, N, N, st(0), N],
    ),
]

# ---------------------------------------------------------------------------
# BREAKBEAT  (syncopated, swing feel, big beat, hip-hop influenced)
# ---------------------------------------------------------------------------

BREAKBEAT: list[tuple[str, list[Step]]] = [
    (
        "Big Beat",
        "Heavy root drive — Chemical Brothers / Prodigy era",
        [st(0, A), N, N, st(0), N, N, st(0, A), N,
         N, st(0), N, st(0, A), N, N, st(0), N],
    ),
    (
        "Funky Break",
        "James Brown-inspired syncopation — classic breakbeat groove",
        [st(0, A), N, N, st(0), N, st(3), st(0), N,
         st(5, A), N, st(3), N, st(0), N, st(-2), N],
    ),
    (
        "Boom Bap",
        "Hip-hop underground bass — classic boom bap",
        [st(0, A), N, N, N, st(0), N, N, st(-2),
         st(0, A), N, N, N, st(7), N, N, N],
    ),
    (
        "Amen Groove",
        "Rolling Amen-style bass — live break feel",
        [st(0, A), N, st(0), N, st(0, A), N, N, st(0),
         N, st(0, A), st(0), N, st(0, A), N, st(7), N],
    ),
    (
        "Chemical",
        "Distorted aggressive stabs — big synth bass energy",
        [st(0, A), N, st(0, A), N, N, st(0, A), N, st(0, A),
         N, N, st(0, A), N, st(5, A), N, N, N],
    ),
    (
        "Lo-Fi Hop",
        "Warm sparse groove — lo-fi hip-hop bass",
        [st(0), N, N, N, st(3), N, N, N,
         st(0), N, st(-2), N, st(0), N, N, N],
    ),
    (
        "Prodigy",
        "Fast aggressive 16ths — maximum break energy",
        [st(0, A), st(0), N, st(0, A), st(0), N, st(0, A), st(0),
         N, st(5, A), N, st(0, A), N, N, st(0, A), N],
    ),
    (
        "Trip Hop Line",
        "Sparse moody bass — Massive Attack / Portishead feel",
        [st(0), N, N, N, N, N, st(-2), N,
         st(0), N, N, N, st(3), N, N, N],
    ),
    (
        "Nu-Skool",
        "Tight modern break groove — nu-skool precision",
        [st(0, A), N, N, st(0), st(0, A), N, N, st(3),
         N, st(5, A), N, N, st(3), N, st(0, A), N],
    ),
    (
        "Rolling Break",
        "Constant 8th break groove — rolling break foundation",
        [st(0), N, st(0), N, st(3), N, st(0), N,
         st(7), N, st(5), N, st(3), N, st(0), N],
    ),
]

# ---------------------------------------------------------------------------
# JUNGLE  (heavy sub, rolling, Amen-influenced, fast and sparse mix)
# ---------------------------------------------------------------------------

JUNGLE: list[tuple[str, list[Step]]] = [
    (
        "Jungle Wobble",
        "Classic jungle bass wobble — raw sub pressure",
        [st(0, R, S), st(0), st(0, R, S), st(-2), N, st(0, R, S), st(0), N,
         st(0, R, S), st(-5), N, st(0, R, S), st(0), N, N, N],
    ),
    (
        "Ragga Sub",
        "Deep dancehall-influenced sub — roots jungle bass",
        [st(-12, A), N, N, N, st(-12), N, N, st(-12),
         N, N, N, st(-12, A), N, N, N, N],
    ),
    (
        "Oldskool Roll",
        "Original '92 rolling bass — pure jungle foundation",
        [st(0), N, st(0), N, st(0, A), st(0), N, st(0),
         st(-2, A), N, st(0), N, st(0, A), N, st(0), N],
    ),
    (
        "Darkside",
        "Descending dark line — menacing darkside jungle",
        [st(0, A), N, N, st(-2), N, N, st(-5), N,
         N, st(-7), N, N, st(-5), N, N, N],
    ),
    (
        "Rolling Sub",
        "Constant 8th sub with shift — relentless jungle floor",
        [st(0), N, st(0), N, st(0), N, st(0), N,
         st(-2), N, st(-2), N, st(0), N, st(0), N],
    ),
    (
        "Warp Bass",
        "Atonal interval leaps — abstract pitched jungle",
        [st(0), N, st(6), N, N, st(-1), N, st(0),
         N, N, st(11), N, N, st(0), N, N],
    ),
    (
        "Steppers Sub",
        "Sparse locked-step sub — minimal jungle steppers",
        [st(0, A), N, N, N, N, N, N, N,
         st(0, A), N, N, st(-2), N, N, N, N],
    ),
    (
        "Rave Run",
        "Euphoric ascending run — early rave jungle lift",
        [st(0), st(3), st(5), st(7), st(10), st(12), st(10), st(7),
         st(5), st(3), st(0), N, N, st(-2), st(0), N],
    ),
    (
        "Techno Jungle",
        "Rigid 8th sub — techno-influenced jungle hybrid",
        [st(0, A), N, st(0), N, st(0, A), N, st(0), N,
         st(0, A), N, st(-2), N, st(0, A), N, N, N],
    ),
    (
        "Carnage Sub",
        "Maximum density root hits — total carnage sub",
        [st(0, A), st(0), st(0, A), st(0), N, st(0, A), st(0), N,
         st(0, A), st(0), N, N, st(0, A), N, N, N],
    ),
]

# ---------------------------------------------------------------------------
# GARAGE  (UK 2-step, syncopated, RnB and grime influenced)
# ---------------------------------------------------------------------------

GARAGE: list[tuple[str, list[Step]]] = [
    (
        "2-Step Sub",
        "Classic UK garage 2-step sub — syncopated low end",
        [st(0, A), N, N, st(0), N, N, st(0, A), N,
         N, N, st(0), N, st(0, A), N, N, st(0)],
    ),
    (
        "Speed Roll",
        "Speed garage rolling root — constant motion",
        [st(0), N, st(0), N, st(0, A), st(0), N, st(0),
         N, st(0, A), N, st(0), N, N, st(0, A), N],
    ),
    (
        "Grime Dark",
        "Sparse long grime note — stark and menacing",
        [st(0, A), N, N, N, N, N, N, N,
         st(-2), N, N, N, N, N, st(0), N],
    ),
    (
        "Vocal Stab",
        "Short punchy stabs — mimics vocal chop rhythm",
        [st(0, A), N, N, st(0, A), N, N, st(0, A), N,
         N, N, st(0, A), N, N, st(0, A), N, N],
    ),
    (
        "Bassline Bounce",
        "Bouncing bassline house — Leeds garage rave",
        [st(0, A), N, st(3), N, st(0, A), N, st(5), N,
         st(7, A), N, st(5), N, st(3, A), N, st(0), N],
    ),
    (
        "RnB Walk",
        "Soulful R&B-influenced walk — smooth garage feel",
        [st(0), N, st(3), N, st(5), st(3), N, st(0),
         N, st(3), N, st(5), N, st(7), st(5), N],
    ),
    (
        "Night Bass",
        "Atmospheric sparse — late-night garage vibes",
        [st(0), N, N, N, N, N, st(0), N,
         N, N, N, N, st(-2), N, N, N],
    ),
    (
        "Punchy Staccato",
        "Staccato root pattern — matches rimshot density",
        [st(0, A), N, st(0, A), N, N, st(0, A), N, st(0, A),
         N, st(0, A), N, N, st(0, A), N, N, N],
    ),
    (
        "Proto Dub",
        "Pre-dubstep half-time — massive slow drops",
        [st(0, A), N, N, N, N, N, N, N,
         N, N, N, N, st(0, A), N, N, N],
    ),
    (
        "Essex Skip",
        "Skippy syncopated garage — cheeky Essex bounce",
        [st(0, A), N, N, st(0), st(3), N, st(0, A), N,
         N, st(0), N, st(3, A), N, N, st(5), N],
    ),
]

# ---------------------------------------------------------------------------
# AMBIENT  (ultra-sparse, sustained, meditative)
# ---------------------------------------------------------------------------

AMBIENT: list[tuple[str, list[Step]]] = [
    (
        "Long Tone",
        "Single root hit per bar — pure space and weight",
        [st(0), N, N, N, N, N, N, N,
         N, N, N, N, N, N, N, N],
    ),
    (
        "Slow Breath",
        "Root and 5th separated by silence — slow harmonic breath",
        [st(0), N, N, N, N, N, N, N,
         st(7), N, N, N, N, N, N, N],
    ),
    (
        "Tonic Fifth",
        "Root then 5th sparse — minimal tonal grounding",
        [st(0), N, N, N, N, N, N, st(7),
         N, N, N, N, N, N, N, N],
    ),
    (
        "Pedal Tone",
        "Unchanging root four times — hypnotic drone pulse",
        [st(0), N, N, N, st(0), N, N, N,
         N, N, st(0), N, N, N, N, N],
    ),
    (
        "Fade",
        "Ultra-sparse single hit — almost nothing",
        [st(0), N, N, N, N, N, N, N,
         N, N, N, N, N, st(0), N, N],
    ),
    (
        "Whisper",
        "Sub-octave ghost note — barely audible presence",
        [st(-12), N, N, N, N, N, N, N,
         N, N, N, st(-12), N, N, N, N],
    ),
    (
        "Motion",
        "Slow chromatic drift — four notes across the bar",
        [st(0), N, N, N, st(1), N, N, N,
         st(2), N, N, N, st(3), N, N, N],
    ),
    (
        "Ebb",
        "Root then b7 — two notes drifting apart",
        [st(0), N, N, N, N, N, N, st(-2),
         N, N, N, N, N, N, N, N],
    ),
    (
        "Undertow",
        "Root and flat seventh — dark ambient weight",
        [st(0), N, N, N, N, N, N, N,
         st(-2), N, N, N, N, N, N, N],
    ),
    (
        "Shimmer",
        "Upper octave ghost — high harmonic shimmer",
        [st(12), N, N, N, N, N, N, N,
         N, N, N, N, st(10), N, N, N],
    ),
]

# ---------------------------------------------------------------------------
# GLITCH  (stuttering, corrupted, erratic, chromatic)
# ---------------------------------------------------------------------------

GLITCH: list[tuple[str, list[Step]]] = [
    (
        "Stutter",
        "Rapid repeated notes with gaps — stutter edit feel",
        [st(0), st(0), st(0), N, N, st(0), st(0), N,
         N, st(0), N, st(0), st(0), N, N, N],
    ),
    (
        "Bit Error",
        "Chromatic noise bursts — bit-crushed corruption",
        [st(0), st(1), N, st(-1), st(0), N, st(2), N,
         st(0), N, st(-2), N, st(1), N, st(0), N],
    ),
    (
        "Micro Stab",
        "Irregular accent cluster — off-grid micro stabs",
        [st(0, A), N, N, st(0, A), N, st(0, A), N, N,
         N, st(0, A), N, N, st(0, A), N, st(0, A), N],
    ),
    (
        "Drone Glitch",
        "Long note interrupted by burst — drone error",
        [st(0), N, N, N, N, N, N, N,
         st(0), st(0), st(0), N, N, N, st(0), N],
    ),
    (
        "Fragmented",
        "Broken melodic phrase — fragmented data stream",
        [st(0), N, st(3), N, N, st(7), N, N,
         st(3), N, N, N, st(5), N, N, st(0)],
    ),
    (
        "Noise Gate",
        "Gating-style rhythm — pumping noise gate simulation",
        [st(0, A), N, st(0, A), st(0, A), N, st(0, A), N, N,
         st(0, A), N, N, st(0, A), st(0, A), N, N, N],
    ),
    (
        "Glitch Run",
        "Ascending chromatic chaos — Autechre-style disorder",
        [st(0), st(1), st(2), st(3), N, st(4), st(5), N,
         st(6), N, st(7), N, N, st(0), N, N],
    ),
    (
        "Data Corrupt",
        "Wrong notes and corrupted sequence — system error",
        [st(0), N, st(6), N, st(1), N, N, st(-1),
         st(0), N, st(11), N, N, st(2), N, st(0)],
    ),
    (
        "Feedback Loop",
        "Self-referential repeating motif — feedback oscillation",
        [st(0), st(3), N, st(0), st(3), N, st(0), st(3),
         N, st(0), st(3), N, st(0), st(3), N, N],
    ),
    (
        "System Crash",
        "Silence then dense burst — catastrophic reset",
        [N, N, N, N, N, N, N, N,
         st(0, A), st(0, A), st(0, A), st(0, A), st(0, A), st(0, A), st(0, A), st(0, A)],
    ),
]

# ---------------------------------------------------------------------------
# ELECTRO  (classic 808, hip-hop influenced, robotic precision)
# ---------------------------------------------------------------------------

ELECTRO: list[tuple[str, list[Step]]] = [
    (
        "Classic Electro",
        "Root on every beat — 808 electro foundation",
        [st(0, A), N, N, N, st(0, A), N, N, N,
         st(0, A), N, N, N, st(0, A), N, N, N],
    ),
    (
        "B-Boy Sub",
        "Boom bap root and 5th — hip-hop b-boy foundation",
        [st(0, A), N, N, N, st(0), N, N, N,
         st(0, A), N, N, st(7), N, st(0), N, N],
    ),
    (
        "Machine Riff",
        "Short sharp machine funk riff — Roland 808 electro",
        [st(0, A), N, st(0), st(3), N, st(5), N, st(0, A),
         N, st(3), N, N, st(5), N, st(0, A), N],
    ),
    (
        "Afrika Line",
        "Motorik funk bass — Afrika Bambaataa style",
        [st(0), N, st(0), N, st(3), N, st(0), N,
         st(5), N, st(0), N, st(7), N, st(5), st(3)],
    ),
    (
        "Vocobass",
        "Square wave stab pattern — vocoder-era precision",
        [st(0, A), N, N, st(0, A), N, N, st(5, A), N,
         N, st(0, A), N, N, st(5, A), N, st(0, A), N],
    ),
    (
        "Miami Sub",
        "Dominant root pump — Miami bass electro",
        [st(0, A), N, st(0, A), N, st(0, A), N, st(0, A), N,
         st(0, A), N, st(5, A), N, st(0, A), N, N, N],
    ),
    (
        "Zap Riff",
        "Synth lead-style zap phrase — electro zap gun",
        [st(0), N, st(7), N, st(5), N, st(3), N,
         st(0), N, N, st(7), st(5), N, st(0), N],
    ),
    (
        "Cyberpunk",
        "Harsh chromatic industrial bass — cyberpunk electro",
        [st(0, A), st(0, A), N, N, st(-1, A), st(-1, A), N, N,
         st(0, A), N, st(0, A), N, N, st(-1, A), N, N],
    ),
    (
        "NY Groove",
        "Soulful electro groove — New York boogie bass",
        [st(0, A), N, st(3), N, st(0), N, N, st(5),
         st(7, A), N, st(5), N, st(3), N, st(0), N],
    ),
    (
        "808 Rumble",
        "Massive sub hits — sub-octave 808 rumble",
        [st(-12, A), N, N, N, st(-12, A), N, N, N,
         st(-12, A), N, N, st(-14), N, N, st(-12, A), N],
    ),
]

# ---------------------------------------------------------------------------
# DOWNTEMPO  (slow, heavy, trip-hop, cinematic, Massive Attack / Portishead)
# ---------------------------------------------------------------------------

DOWNTEMPO: list[tuple[str, list[Step]]] = [
    (
        "Trip Hop",
        "Heavy slow groove — Massive Attack / Portishead bass",
        [st(0, A), N, N, N, st(0), N, N, st(-2),
         N, N, st(0, A), N, N, N, st(3), N],
    ),
    (
        "Massive Sub",
        "Earth-shaking sparse sub — Massive Attack weight",
        [st(-12, A), N, N, N, N, N, N, N,
         st(-12), N, N, N, N, N, N, N],
    ),
    (
        "Shadow Line",
        "Sample-style bass feel — DJ Shadow layback groove",
        [st(0), N, N, st(3), N, N, st(0), N,
         st(-2), N, N, N, st(0), N, N, N],
    ),
    (
        "Haunted",
        "Dark winding descent — Portishead haunted bass",
        [st(0), N, N, N, st(-2), N, N, N,
         st(-4), N, N, N, st(-5), N, st(-2), N],
    ),
    (
        "Jazz Walk",
        "Slow jazz-influenced walking bass — brushed kit feel",
        [st(0), N, N, N, st(3), N, N, N,
         st(7), N, N, N, st(5), N, st(3), N],
    ),
    (
        "Swing Sub",
        "Heavily swung slow sub — narcotic layback",
        [st(0, A), N, N, st(0), N, N, N, st(-2),
         st(0, A), N, N, st(0), N, N, N, N],
    ),
    (
        "Cinematic",
        "Long cinematic sub notes — film score tension",
        [st(0), N, N, N, N, N, N, N,
         st(3), N, N, N, N, N, N, N],
    ),
    (
        "Lo-Fi Warmth",
        "Warm analog tape feel — lo-fi hip-hop bass",
        [st(0), N, N, N, st(0), N, N, N,
         st(5), N, N, N, st(3), N, st(0), N],
    ),
    (
        "Chill Pulse",
        "Single note per beat — slow minimal pulse",
        [st(0), N, N, N, st(0), N, N, N,
         st(0), N, N, N, st(0), N, N, N],
    ),
    (
        "Gravity",
        "Maximum gravity sub — slow sub-octave anchor",
        [st(-12, A), N, N, N, N, N, N, N,
         N, N, N, N, st(-12, A), N, N, N],
    ),
]

# ---------------------------------------------------------------------------
# Genre registry
# ---------------------------------------------------------------------------

GENRES: dict[str, list[tuple]] = {
    "techno":          TECHNO,
    "acid-techno":     ACID_TECHNO,
    "trance":          TRANCE,
    "dub-techno":      DUB_TECHNO,
    "idm":             IDM,
    "edm":             EDM,
    "drum-and-bass":   DRUM_AND_BASS,
    "house":           HOUSE,
    "breakbeat":       BREAKBEAT,
    "jungle":          JUNGLE,
    "garage":          GARAGE,
    "ambient":         AMBIENT,
    "glitch":          GLITCH,
    "electro":         ELECTRO,
    "downtempo":       DOWNTEMPO,
}

GENRE_NAMES = list(GENRES.keys())


def get_pattern(genre: str, index: int) -> list[Step]:
    """Return the pattern steps for genre (name) and 1-based index."""
    if genre not in GENRES:
        raise ValueError(f"Unknown genre '{genre}'. Choose from: {', '.join(GENRE_NAMES)}")
    patterns = GENRES[genre]
    if not (1 <= index <= len(patterns)):
        raise ValueError(f"Pattern index must be 1–{len(patterns)}, got {index}")
    return patterns[index - 1][2]


def list_patterns() -> str:
    """Return a formatted string listing all genres and patterns."""
    lines = []
    for genre, entries in GENRES.items():
        lines.append(f"\n  {genre.upper()}")
        lines.append(f"  {'─' * 60}")
        for i, (name, desc, _) in enumerate(entries, 1):
            lines.append(f"  {i:2d}. {name:<22s}  {desc}")
    return "\n".join(lines)
