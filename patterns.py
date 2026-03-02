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
        "Hyper Acid",
        "Full 16th density, wide intervals — chaotic energy",
        [st(0),  st(7),  st(0),  st(3),
         st(-2), st(0),  st(7, A), st(0),
         st(0),  st(5),  st(0),  st(3),
         st(-2, R, S), st(0), st(-2, A), st(0)],
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
# Genre registry
# ---------------------------------------------------------------------------

GENRES: dict[str, list[tuple]] = {
    "techno":       TECHNO,
    "acid-techno":  ACID_TECHNO,
    "trance":       TRANCE,
    "dub-techno":   DUB_TECHNO,
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
