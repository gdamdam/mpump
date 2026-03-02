"""J-6 chord progression patterns.

Each step: (semitone_offset, velocity_factor, slide) | None
Root note is always 60 (C4).  Offsets 0–11 select which chord position
(C through B) plays from the currently loaded chord set on the J-6.

mpump auto-sends a Program Change when the J-6 connects to select the
recommended chord set (PC value = chord_set_number − 1, range 0–63).
Chord sets 65–100 require manual selection on the device.

Semitone-to-note reference:
  C=0  C#=1  D=2  Eb=3  E=4  F=5  F#=6  G=7  Ab=8  A=9  Bb=10  B=11
"""

from .patterns import Step

# ── Helpers ───────────────────────────────────────────────────────────────────

R = 1.0    # normal velocity
A = 1.25   # accent
S = True   # slide (legato)
_ = False  # no slide


def st(offset: int, vel: float = R, slide: bool = _) -> Step:
    return (offset, vel, slide)


N = None   # rest

# Semitone shortcuts
C  = 0;  Cs = 1;  D  = 2;  Eb = 3
E  = 4;  F  = 5;  Fs = 6;  G  = 7
Ab = 8;  A  = 9;  Bb = 10; B  = 11

# ── TECHNO — chord set #58 "Techno" (Cm7 dark voicings) ─────────────────────

J6_TECHNO = [
    ("Iron Root",    "Minimal Cm7 root pulse",
     [st(C,A), N, N, N,  st(C), N, N, N,  st(C,A), N, N, N,  st(C), N, N, N]),
    ("Dark Drift",   "i → VII slow drift",
     [st(C,A), N, N, N,  st(C), N, N, N,  st(Bb,A), N, N, N,  st(Bb), N, N, N]),
    ("Mechanic",     "i–iv alternating push",
     [st(C,A), N, st(C), N,  st(F,A), N, st(F), N,  st(C,A), N, st(C), N,  st(G,A), N, st(G), N]),
    ("Warehouse",    "i–VI–III–VII dark cycle",
     [st(C,A), N, N, N,  st(Ab), N, N, N,  st(Eb), N, N, N,  st(Bb), N, N, N]),
    ("Bass Loop",    "Chromatic i–bII tension",
     [st(C,A), N, N, N,  st(Cs), N, N, N,  st(C,A), N, N, N,  st(Bb), N, N, N]),
    ("Minimal",      "Root with upper touch — i–III",
     [st(C,A), N, N, st(Eb),  N, N, N, st(C),  st(C,A), N, N, st(Eb),  N, N, st(Bb), N]),
    ("Ritual",       "i–VI–VII–i march",
     [st(C,A), N, N, N,  st(Ab,A), N, N, N,  st(Bb,A), N, N, N,  st(C,A), N, N, N]),
    ("Steel Grid",   "8th-note i–VII alternation",
     [st(C,A), N, st(Bb), N,  st(C), N, st(Bb), N,  st(C,A), N, st(Ab), N,  st(C), N, st(Bb), N]),
    ("Cold Wave",    "Legato i–VII–VI–VII sweep",
     [st(C,A,S), N, N, N,  st(Bb,A,S), N, N, N,  st(Ab,A,S), N, N, N,  st(Bb,A,S), N, N, N]),
    ("Rave Dark",    "Syncopated i–VII–i–VI club feel",
     [st(C,A), N, st(C), st(Bb),  N, N, st(C,A), N,  N, st(C), N, st(Ab),  N, N, st(Bb,A), N]),
]

# ── ACID-TECHNO — chord set #12 "Jazz Min" (edgy minor 9ths) ────────────────

J6_ACID_TECHNO = [
    ("Acid Root",    "Cm9 stutter with accent push",
     [st(C,A), N, st(C), N,  st(C,A), N, st(C), N,  st(C,A), N, st(C), N,  st(C,A), N, N, N]),
    ("Tritone Sub",  "i → #IV max tension substitution",
     [st(C,A), N, N, N,  st(Fs,A), N, N, N,  st(C,A), N, N, N,  st(G), N, N, N]),
    ("Acid Walk",    "Chromatic descent i–VII–bVII–VI",
     [st(C,A), N, N, N,  st(B), N, N, N,  st(Bb), N, N, N,  st(A), N, N, N]),
    ("Razor",        "Stabbing minor 8ths",
     [st(C,A), N, st(C,A), N,  st(Eb,A), N, st(Eb,A), N,  st(C,A), N, st(C,A), N,  st(G,A), N, N, N]),
    ("Dark Matter",  "i–#IV–i–v tritone pump",
     [st(C,A), N, N, st(Fs),  N, N, st(Fs,A), N,  N, N, st(C,A), N,  st(G), N, N, N]),
    ("Neurofunk",    "Rapid i–bII pulse",
     [st(C,A), st(C), st(Cs,A), st(C),  st(C,A), st(C), st(Cs,A), N,  st(C,A), N, st(Cs), N,  st(C,A), N, N, N]),
    ("Jazz Acid",    "ii–V–i–#IV jazz-acid cycle",
     [st(D), N, N, N,  st(G,A), N, N, N,  st(C,A), N, N, N,  st(Fs), N, N, N]),
    ("Squelch",      "Syncopated minor 3rd stabs",
     [st(C,A), N, st(Eb), N,  st(C,A), N, st(D), N,  st(Eb,A), N, st(C), N,  st(G,A), N, N, N]),
    ("Vortex",       "Descending minor sequence",
     [st(C,A), N, N, N,  st(Bb), N, N, N,  st(Ab,A), N, N, N,  st(G), N, N, N]),
    ("Terminal",     "Chromatic cluster resolution",
     [st(C,A), N, N, st(Cs,A),  N, N, st(C,A), N,  st(Eb), N, N, st(D),  N, N, st(C,A), N]),
]

# ── TRANCE — chord set #48 "Trance" (emotional minor lifts) ─────────────────

J6_TRANCE = [
    ("Lift Off",     "Classic i–VI–III–VII trance anthem",
     [st(C,A), N, N, N,  st(Ab,A), N, N, N,  st(Eb,A), N, N, N,  st(Bb,A), N, N, N]),
    ("Euphoria",     "i–VII–VI–VII emotional sweep",
     [st(C,A), N, N, N,  st(Bb,A), N, N, N,  st(Ab,A), N, N, N,  st(Bb,A), N, N, N]),
    ("Breakdown",    "Sparse i–VI with space",
     [st(C,A), N, N, N,  N, N, N, N,  st(Ab,A), N, N, N,  N, N, N, N]),
    ("Build",        "Rising i–II–III–IV tension",
     [st(C), N, N, N,  st(D), N, N, N,  st(Eb,A), N, N, N,  st(F,A), N, N, N]),
    ("Drop",         "Power i–v–VI–VII drop",
     [st(C,A), N, st(C), N,  st(G), N, st(G), N,  st(Ab,A), N, st(Ab), N,  st(Bb,A), N, st(Bb), N]),
    ("Sunrise",      "Major lift — I–V–VI–IV",
     [st(C,A), N, N, N,  st(G,A), N, N, N,  st(A), N, N, N,  st(F,A), N, N, N]),
    ("Pluck",        "Staccato 8th-note i–VI dance",
     [st(C,A), N, st(C), N,  st(Ab,A), N, st(Ab), N,  st(C,A), N, st(C), N,  st(Bb,A), N, st(Bb), N]),
    ("Cascade",      "i–III–VI–VII cascading",
     [st(C,A), N, N, N,  st(Eb,A), N, N, N,  st(Ab,A), N, N, N,  st(Bb,A), N, N, N]),
    ("Climax",       "Repeated i with VII accent hits",
     [st(C,A), N, N, st(Bb,A),  N, N, st(C,A), N,  st(C,A), N, st(Bb,A), N,  st(Ab,A), N, st(Bb,A), N]),
    ("Orbital",      "Long-form i–VI–III–VII 8th feel",
     [st(C,A), N, st(C), N,  st(Ab), N, st(Ab), N,  st(Eb,A), N, st(Eb), N,  st(Bb,A), N, st(Bb), N]),
]

# ── DUB-TECHNO — chord set #8 "Trad Min" (sparse reverb minor) ──────────────

J6_DUB_TECHNO = [
    ("Echo One",     "Single root chord, maximum space",
     [st(C,A), N, N, N,  N, N, N, N,  N, N, N, N,  N, N, N, N]),
    ("Dub Pulse",    "Root with slow VI return",
     [st(C,A), N, N, N,  N, N, N, N,  st(Ab), N, N, N,  N, N, N, N]),
    ("Deep Space",   "i–VI echo feel",
     [st(C,A), N, N, N,  N, N, N, st(C),  st(Ab,A), N, N, N,  N, N, N, st(Ab)]),
    ("Pressure",     "Subtle i–v push",
     [st(C,A), N, N, N,  N, N, st(G), N,  st(C,A), N, N, N,  N, N, st(G), N]),
    ("Murk",         "i–VII minimal dub",
     [st(C,A), N, N, N,  N, N, N, N,  st(Bb,A), N, N, N,  st(C), N, N, N]),
    ("Undertow",     "i–VI–VII slow wave",
     [st(C,A), N, N, N,  N, N, N, N,  st(Ab), N, N, N,  st(Bb), N, N, N]),
    ("Reverb Chord", "Legato slide i–III–i–VII",
     [st(C,A,S), N, N, N,  st(Eb,R,S), N, N, N,  st(C,R,S), N, N, N,  st(Bb,R,S), N, N, N]),
    ("Dub Groove",   "Sparse syncopated minor",
     [st(C,A), N, N, st(C),  N, N, st(Ab), N,  N, st(Ab), N, N,  st(Bb,A), N, N, N]),
    ("Tape Loop",    "i–VII–i with echo tail",
     [st(C,A), N, N, N,  st(Bb), N, st(C), N,  N, N, st(Bb), N,  st(C,A), N, N, N]),
    ("Subsonic",     "Ultra-sparse i–VI four-bar",
     [st(C,A), N, N, N,  N, N, N, N,  N, N, st(Ab), N,  N, N, N, N]),
]

# ── IDM — chord set #5 "Jazz" (all major 9ths, complex motion) ──────────────

J6_IDM = [
    ("Glitch I",     "Irregular major 9th offset accents",
     [st(C,A), N, st(D), N,  st(C), st(F), N, N,  st(E,A), N, N, st(C),  N, st(D), N, N]),
    ("Polyrhythm",   "3-against-4 I–II–IV feel",
     [st(C,A), N, N, st(D),  N, N, st(F,A), N,  N, st(C,A), N, N,  st(D), N, N, st(F)]),
    ("Algorithm",    "Chromatic walk I–#I–II–bIII",
     [st(C,A), N, N, N,  st(Cs), N, N, N,  st(D,A), N, N, N,  st(Eb), N, N, N]),
    ("Neural",       "IV–II–V–I jazz-IDM resolution",
     [st(F,A), N, N, N,  st(D), N, N, N,  st(G,A), N, N, N,  st(C,A), N, N, N]),
    ("Fragmented",   "Stutter i–V fast stabs",
     [st(C,A), N, st(G,A), N,  st(C), N, st(G), N,  st(C,A), st(G,A), N, N,  st(C,A), N, N, N]),
    ("Folded",       "I–VI–II–V extended cycle",
     [st(C,A), N, N, N,  st(A), N, N, N,  st(D,A), N, N, N,  st(G,A), N, N, N]),
    ("Bit Crush",    "Descending major 9th steps",
     [st(C,A), N, N, N,  st(B), N, N, N,  st(A,A), N, N, N,  st(G), N, N, N]),
    ("Recursive",    "I–III–V–IV recursive loop",
     [st(C,A), N, N, st(E),  N, N, st(G,A), N,  N, N, st(F,A), N,  N, st(E), N, N]),
    ("Modular",      "III–I–VI–IV modular feel",
     [st(E,A), N, N, N,  st(C,A), N, N, N,  st(A), N, N, N,  st(F,A), N, N, N]),
    ("Render",       "I–VII–I–V with space",
     [st(C,A), N, N, N,  st(B), N, N, N,  st(C,A), N, N, N,  st(G,A), N, N, N]),
]

# ── EDM — chord set #62 "EDM" (bright Maj13 voicings) ───────────────────────

J6_EDM = [
    ("Festival",     "Classic I–V–VI–IV pop-EDM",
     [st(C,A), N, N, N,  st(G,A), N, N, N,  st(A,A), N, N, N,  st(F,A), N, N, N]),
    ("Drop",         "Power I–IV–V–IV drop sequence",
     [st(C,A), N, st(C), N,  st(F,A), N, st(F), N,  st(G,A), N, st(G), N,  st(F,A), N, N, N]),
    ("Sunrise",      "I–II–IV–V building anthem",
     [st(C,A), N, N, N,  st(D,A), N, N, N,  st(F,A), N, N, N,  st(G,A), N, N, N]),
    ("Rave Chord",   "I–VI–IV–V classic rave",
     [st(C,A), N, N, N,  st(A), N, N, N,  st(F,A), N, N, N,  st(G,A), N, N, N]),
    ("Energy",       "Tight 8th major stabs",
     [st(C,A), N, st(C), N,  st(C,A), N, st(C), N,  st(F,A), N, st(F), N,  st(G,A), N, N, N]),
    ("Bounce",       "I–V repeated 8th bounce",
     [st(C,A), N, st(G,A), N,  st(C,A), N, st(G,A), N,  st(F,A), N, st(C), N,  st(G,A), N, N, N]),
    ("Stadium",      "I–IV–I–V stadium anthem",
     [st(C,A), N, N, N,  st(F,A), N, N, N,  st(C,A), N, N, N,  st(G,A), N, N, N]),
    ("Euphoric",     "I–III–IV–V soaring",
     [st(C,A), N, N, N,  st(E,A), N, N, N,  st(F,A), N, N, N,  st(G,A), N, N, N]),
    ("Mainroom",     "VI–IV–I–V mainroom classic",
     [st(A), N, N, N,  st(F,A), N, N, N,  st(C,A), N, N, N,  st(G,A), N, N, N]),
    ("Big Room",     "I–I–IV–V big room repeat",
     [st(C,A), N, N, N,  st(C,A), N, N, N,  st(F,A), N, N, N,  st(G,A), N, N, N]),
]

# ── Registry ──────────────────────────────────────────────────────────────────

J6_GENRES: dict[str, list] = {
    "techno":      J6_TECHNO,
    "acid-techno": J6_ACID_TECHNO,
    "trance":      J6_TRANCE,
    "dub-techno":  J6_DUB_TECHNO,
    "idm":         J6_IDM,
    "edm":         J6_EDM,
}

J6_GENRE_NAMES = list(J6_GENRES.keys())

# Recommended J-6 chord set per genre (1-indexed, matching Roland numbering)
# PC value sent to device = chord_set - 1
J6_CHORD_SETS: dict[str, int] = {
    "techno":      58,   # "Techno"      — dark Cm7 voicings
    "acid-techno": 12,   # "Jazz Min"    — edgy minor 9ths with tritones
    "trance":      48,   # "Trance"      — emotional minor/major mix
    "dub-techno":   8,   # "Trad Min"    — sparse natural minor
    "idm":          5,   # "Jazz"        — complex major 9th extensions
    "edm":         62,   # "EDM"         — bright Maj13 voicings
}


def get_j6_pattern(genre: str, index: int) -> list[Step]:
    """Return pattern list for genre (1-indexed)."""
    if genre not in J6_GENRES:
        raise ValueError(f"Unknown J-6 genre: {genre!r}. Choose from {J6_GENRE_NAMES}")
    patterns = J6_GENRES[genre]
    if not (1 <= index <= len(patterns)):
        raise ValueError(f"Pattern index must be 1–{len(patterns)}, got {index}")
    return patterns[index - 1][2]


def get_j6_chord_set(genre: str) -> int:
    """Return the recommended Roland chord set number (1-indexed) for genre."""
    return J6_CHORD_SETS[genre]


def list_j6_patterns() -> str:
    lines = []
    for genre, pats in J6_GENRES.items():
        cs = J6_CHORD_SETS[genre]
        lines.append(f"\n{genre.upper()}  (J-6 chord set #{cs})")
        for i, (name, desc, _) in enumerate(pats, 1):
            lines.append(f"  {i:2d}. {name:<18} {desc}")
    return "\n".join(lines)
