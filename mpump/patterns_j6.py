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

# ── DRUM-AND-BASS — chord set #15 "Minor" (dark minor voicings) ─────────────

J6_DNB = [
    ("Reese",         "Single minor root — maximum sub pressure",
     [st(C,A), N, N, N,  st(C), N, N, N,  st(C,A), N, N, N,  st(C), N, N, N]),
    ("Two-Step",      "i–v offbeat push — 2-step DnB feel",
     [st(C,A), N, N, st(G),  N, N, st(C,A), N,  N, st(G), N, N,  st(C,A), N, N, N]),
    ("Liquid",        "i–VI–III–VII — melodic liquid DnB",
     [st(C,A), N, N, N,  st(Ab,A), N, N, N,  st(Eb,A), N, N, N,  st(Bb,A), N, N, N]),
    ("Neuro Tension", "i–bII tritone crunch — neurofunk dissonance",
     [st(C,A), N, N, N,  st(Cs,A), N, N, N,  st(C,A), N, N, N,  st(G), N, N, N]),
    ("Jump Joy",      "i–III–VII–VI — jump-up uplift",
     [st(C,A), N, N, N,  st(Eb,A), N, N, N,  st(Bb,A), N, N, N,  st(Ab), N, N, N]),
    ("Darkstep Fall", "i–VII–VI–v — descending dark DnB",
     [st(C,A), N, N, N,  st(Bb), N, N, N,  st(Ab), N, N, N,  st(G), N, N, N]),
    ("Halftime Drone","Single sustained root — massive halftime space",
     [st(C,A), N, N, N,  N, N, N, N,  st(C), N, N, N,  N, N, N, N]),
    ("Technical",     "i–iv–v–i fast cycle — technical DnB movement",
     [st(C,A), N, st(F,A), N,  st(G,A), N, st(C,A), N,  st(C,A), N, st(F), N,  st(G), N, st(C), N]),
    ("Pressure",      "Rapid i–v alternation — jump-up floor pressure",
     [st(C,A), N, st(G), N,  st(C,A), N, st(G), N,  st(C,A), N, st(G), N,  st(C,A), N, N, N]),
    ("Rollers",       "i–VII–i–iv rolling cycle — DnB floor roller",
     [st(C,A), N, N, N,  st(Bb), N, N, N,  st(C,A), N, N, N,  st(F), N, N, N]),
]

# ── HOUSE — chord set #30 "Soul" (funky/soulful voicings) ───────────────────

J6_HOUSE = [
    ("Classic House", "I–IV–V–IV pump — four-on-the-floor house",
     [st(C,A), N, N, N,  st(F,A), N, N, N,  st(G,A), N, N, N,  st(F,A), N, N, N]),
    ("Deep Groove",   "i–iv–VII–i — deep house minor feel",
     [st(C,A), N, N, N,  st(F), N, N, N,  st(Bb,A), N, N, N,  st(C,A), N, N, N]),
    ("Chicago Jack",  "I–IV–ii–V jacking — classic Chicago house",
     [st(C,A), N, N, N,  st(F,A), N, N, N,  st(D), N, N, N,  st(G,A), N, N, N]),
    ("Soulful",       "I–vi–ii–V gospel — soulful house progression",
     [st(C,A), N, N, N,  st(A), N, N, N,  st(D,A), N, N, N,  st(G,A), N, N, N]),
    ("Tech Acid",     "i–bII–i–bVII — acid tech-house tension",
     [st(C,A), N, N, N,  st(Cs), N, N, N,  st(C,A), N, N, N,  st(Bb), N, N, N]),
    ("Gospel Lift",   "I–IV–I–V 8th bounce — uplifting gospel house",
     [st(C,A), N, st(C), N,  st(F,A), N, st(F), N,  st(C,A), N, st(C), N,  st(G,A), N, N, N]),
    ("Minor House",   "i–VII–VI–VII — dark underground minor house",
     [st(C,A), N, N, N,  st(Bb,A), N, N, N,  st(Ab,A), N, N, N,  st(Bb,A), N, N, N]),
    ("Funky Chords",  "Off-beat I–IV — syncopated funky house stabs",
     [N, st(C,A), N, N,  N, st(F,A), N, N,  N, st(C,A), N, st(F),  N, N, st(G,A), N]),
    ("Future House",  "I–V–VI–IV — future house bouncy anthem",
     [st(C,A), N, N, N,  st(G,A), N, N, N,  st(A,A), N, N, N,  st(F,A), N, N, N]),
    ("Afterhours",    "Slow sparse i–iv — deep late-night groove",
     [st(C,A), N, N, N,  N, N, N, N,  st(F), N, N, N,  N, N, N, N]),
]

# ── BREAKBEAT — chord set #20 "Hip Hop" (warm hip-hop voicings) ─────────────

J6_BREAKBEAT = [
    ("Big Beat",      "I–IV–I–V stomp — classic big beat energy",
     [st(C,A), N, N, N,  st(F,A), N, st(C,A), N,  N, N, st(G,A), N,  N, N, N, N]),
    ("Funky Break",   "I–IV–ii–V syncopated — James Brown inspired",
     [N, st(C,A), N, st(C),  N, st(F,A), N, N,  N, st(D), N, st(G,A),  N, N, N, N]),
    ("Boom Bap",      "i–v–i–VII — hip-hop underground chords",
     [st(C,A), N, N, N,  st(G), N, N, N,  st(C,A), N, N, N,  st(Bb), N, N, N]),
    ("Amen Chords",   "i–VII–v–i — Amen-break chord feel",
     [st(C,A), N, st(Bb), N,  st(G), N, st(C), N,  st(C,A), N, st(Bb), N,  st(G), N, N, N]),
    ("Chemical",      "i–bVII–bVI–v — Chemical Brothers dark drive",
     [st(C,A), N, N, N,  st(Bb,A), N, N, N,  st(Ab,A), N, N, N,  st(G), N, N, N]),
    ("Lo-Fi",         "I–vi–IV–V mellow — lo-fi hip-hop chords",
     [st(C,A), N, N, N,  st(A), N, N, N,  st(F,A), N, N, N,  st(G,A), N, N, N]),
    ("Prodigy",       "i–bVII fast stabs — aggressive breakbeat energy",
     [st(C,A), N, st(Bb,A), N,  st(C,A), N, st(Bb,A), N,  st(C,A), N, N, st(Bb),  N, N, st(C,A), N]),
    ("Trip Hop",      "i–VI–VII sparse — Massive Attack movement",
     [st(C,A), N, N, N,  N, N, N, N,  st(Ab), N, N, N,  st(Bb), N, N, N]),
    ("Nu-Skool",      "i–iv–v–VI — modern nu-skool breaks chord move",
     [st(C,A), N, N, N,  st(F,A), N, N, N,  st(G,A), N, N, N,  st(Ab), N, N, N]),
    ("Rolling Break", "I–V–IV–V rolling 8ths — floor-filling break",
     [st(C,A), N, st(G), N,  st(F,A), N, st(G), N,  st(C,A), N, st(G), N,  st(F,A), N, N, N]),
]

# ── JUNGLE — chord set #16 "Dark Min" (raw dark minor) ──────────────────────

J6_JUNGLE = [
    ("Pure Jungle",   "Rapid i–VII stabs — raw jungle energy",
     [st(C,A), N, st(Bb,A), N,  st(C,A), N, st(Bb), N,  st(C,A), N, N, st(Bb,A),  N, N, st(C,A), N]),
    ("Ragga Chord",   "i–IV–i–v dancehall — ragga jungle feel",
     [st(C,A), N, N, N,  st(F,A), N, N, N,  st(C,A), N, N, N,  st(G), N, N, N]),
    ("Oldskool",      "i–VII–VI–i — original '92 jungle vibe",
     [st(C,A), N, N, N,  st(Bb), N, N, N,  st(Ab), N, N, N,  st(C,A), N, N, N]),
    ("Darkside",      "i–v–bVI–bVII — dark menacing jungle",
     [st(C,A), N, N, N,  st(G), N, N, N,  st(Ab,A), N, N, N,  st(Bb), N, N, N]),
    ("Rollers",       "i–VII pulsing 8ths — constant jungle roller",
     [st(C,A), N, st(Bb), N,  st(C,A), N, st(Bb), N,  st(C,A), N, st(Ab), N,  st(Bb,A), N, N, N]),
    ("Warped",        "Chromatic cluster — warped atonal jungle",
     [st(C,A), N, N, st(Cs,A),  N, N, st(C,A), N,  st(Bb), N, N, st(B),  N, N, st(C,A), N]),
    ("Steppers",      "Sparse i–iv — jungle steppers locked feel",
     [st(C,A), N, N, N,  N, N, N, N,  st(F,A), N, N, N,  N, N, N, N]),
    ("Rave Jungle",   "i–VI–III–VII euphoric — early rave jungle",
     [st(C,A), N, N, N,  st(Ab,A), N, N, N,  st(Eb,A), N, N, N,  st(Bb,A), N, N, N]),
    ("Techno Jungle", "i–v rigid 8ths — techno-jungle hybrid",
     [st(C,A), N, st(C), N,  st(G,A), N, st(G), N,  st(C,A), N, st(C), N,  st(G,A), N, N, N]),
    ("Carnage",       "Dense staccato i–VII — total carnage",
     [st(C,A), st(C), st(Bb,A), st(C),  st(C,A), N, st(Bb,A), N,  st(C,A), st(C), N, N,  st(C,A), N, N, N]),
]

# ── GARAGE — chord set #35 "RnB" (smooth RnB voicings) ─────────────────────

J6_GARAGE = [
    ("2-Step",        "Syncopated i–v — UK garage 2-step chords",
     [st(C,A), N, N, st(G),  N, N, st(C,A), N,  N, N, st(G), N,  st(C,A), N, N, N]),
    ("Speed",         "i–VII rolling 8ths — speed garage chord flow",
     [st(C,A), N, st(C), N,  st(Bb,A), N, st(C), N,  st(C,A), N, st(Bb), N,  st(C,A), N, N, N]),
    ("Grime",         "Sparse i–bII — grime dark stark tension",
     [st(C,A), N, N, N,  N, N, N, N,  st(Cs), N, N, N,  st(C,A), N, N, N]),
    ("Vocal Chop",    "Rapid i stabs — vocal chop simulation",
     [st(C,A), N, st(C,A), N,  N, st(C,A), N, N,  st(C,A), N, N, N,  st(C,A), N, st(C,A), N]),
    ("Bassline House","I–IV–V–IV bouncy — bassline house rave",
     [st(C,A), N, N, N,  st(F,A), N, N, N,  st(G,A), N, N, N,  st(F), N, N, N]),
    ("RnB Chords",    "I–vi–ii–V soulful — RnB garage harmony",
     [st(C,A), N, N, N,  st(A), N, N, N,  st(D,A), N, N, N,  st(G,A), N, N, N]),
    ("Night Garage",  "i–bVII sparse menacing — late-night garage",
     [st(C,A), N, N, N,  N, N, N, N,  st(Bb,A), N, N, N,  N, N, N, N]),
    ("Rimshot Chords","Staccato i stabs — matches rimshot pattern",
     [st(C,A), N, N, st(C,A),  N, N, st(C,A), N,  N, st(C,A), N, N,  st(C,A), N, N, N]),
    ("Proto Dub",     "i halftime — pre-dubstep half-time chords",
     [st(C,A), N, N, N,  N, N, N, N,  N, N, N, N,  st(Bb), N, N, N]),
    ("Essex",         "I–V–IV–V skippy — Essex garage bounce",
     [st(C,A), N, N, st(G),  N, st(F,A), N, N,  st(G,A), N, st(C,A), N,  N, st(F), N, N]),
]

# ── AMBIENT — chord set #3 "Pad" (lush sustained pad voicings) ──────────────

J6_AMBIENT = [
    ("Long Drone",    "Single root chord — maximum space and reverb",
     [st(C), N, N, N,  N, N, N, N,  N, N, N, N,  N, N, N, N]),
    ("Slow Drift",    "i–VI ultra-slow — barely moving harmony",
     [st(C), N, N, N,  N, N, N, N,  st(Ab), N, N, N,  N, N, N, N]),
    ("Pad Wash",      "i–III–V sustained — ambient chord wash",
     [st(C), N, N, N,  N, N, st(Eb), N,  N, N, N, N,  st(G), N, N, N]),
    ("Celestial",     "I–V–IV drifting — bright ambient float",
     [st(C), N, N, N,  N, N, st(G), N,  N, N, N, N,  st(F), N, N, N]),
    ("Deep Space",    "Two root touches — vast emptiness",
     [st(C), N, N, N,  N, N, N, N,  N, N, N, N,  st(C), N, N, N]),
    ("Whisper Chord", "i then bVII ghost — barely there texture",
     [st(C), N, N, N,  N, N, N, N,  st(Bb), N, N, N,  N, N, N, N]),
    ("Motion",        "Slow chromatic drift — four chords per bar",
     [st(C), N, N, N,  st(Cs), N, N, N,  st(D), N, N, N,  st(Eb), N, N, N]),
    ("Ebb",           "i–V tidal — two chords drifting",
     [st(C), N, N, N,  N, N, N, st(G),  N, N, N, N,  N, N, N, N]),
    ("Undertow",      "i–bVII dark wave — deep ambient undertow",
     [st(C), N, N, N,  N, N, N, N,  st(Bb), N, N, N,  N, N, N, N]),
    ("Shimmer",       "E–D high register — upper harmonic shimmer",
     [st(E), N, N, N,  N, N, N, N,  N, N, N, N,  st(D), N, N, N]),
]

# ── GLITCH — chord set #7 "Dissonant" (cluster/dissonant voicings) ───────────

J6_GLITCH = [
    ("Corrupt Data",  "Erratic chord hits — corrupted data stream",
     [st(C,A), N, st(Fs,A), N,  N, st(C), N, st(Bb),  N, st(Cs,A), N, N,  st(D), N, st(C,A), N]),
    ("Micro Loop",    "Stuttering i stabs — micro loop corruption",
     [st(C,A), st(C), N, st(C,A),  st(C), N, st(C,A), N,  N, st(C), N, st(C,A),  N, N, N, N]),
    ("Bit Crush",     "Descending chromatic crash — bit crushing",
     [st(C,A), N, N, N,  st(B), N, N, N,  st(Bb), N, N, N,  st(A), N, N, N]),
    ("Stutter Edit",  "Irregular accent cluster — stutter edit feel",
     [st(C,A), N, st(C,A), N,  N, N, st(C,A), st(C),  N, st(C,A), N, N,  st(C), N, N, N]),
    ("Granular",      "Fragmented chord bursts — granular texture",
     [st(C), N, N, st(Eb),  N, st(C), N, N,  st(G), N, N, N,  st(C), N, st(Bb), N]),
    ("Delete Error",  "Silence then burst — missing beats",
     [N, N, N, N,  N, N, N, N,  st(C,A), st(C,A), st(C,A), N,  N, st(Fs,A), N, st(C)]),
    ("Drone Error",   "Long chord then chromatic glitch burst",
     [st(C), N, N, N,  N, N, N, N,  st(C), st(Cs), N, N,  st(C), N, N, N]),
    ("Typewriter",    "Rapid chromatic stabs — typewriter feel",
     [st(C,A), st(Cs,A), st(C,A), N,  st(Bb,A), st(C,A), N, N,  st(Cs,A), N, st(C,A), N,  N, N, N, N]),
    ("Stack Overflow","All 16 steps — dense noise wall",
     [st(C,A), st(Cs), st(D), st(Eb),  st(E), st(F), st(Fs), st(G),
      st(Ab), st(A), st(Bb), st(B),  st(C,A), st(B), st(Bb), st(A)]),
    ("Loop Corrupt",  "i–VII familiar then broken — loop corruption",
     [st(C,A), N, N, N,  st(Bb,A), N, N, N,  st(C,A), st(Bb), st(C,A), st(Bb),  st(Cs,A), N, N, N]),
]

# ── ELECTRO — chord set #40 "Funk" (tight funk voicings) ────────────────────

J6_ELECTRO = [
    ("Classic 808",   "i–v rigid — 808 electro foundation",
     [st(C,A), N, N, N,  st(C,A), N, N, N,  st(G,A), N, N, N,  st(C,A), N, N, N]),
    ("B-Boy",         "i–VII hip-hop feel — b-boy chord move",
     [st(C,A), N, N, N,  st(Bb,A), N, N, N,  st(C,A), N, N, N,  st(G), N, N, N]),
    ("Machine Funk",  "I–IV–V–IV robot — Roland 808 machine funk",
     [st(C,A), N, N, N,  st(F,A), N, N, N,  st(G,A), N, N, N,  st(F), N, N, N]),
    ("Afrika",        "I–V–IV–I motorik — Afrika Bambaataa style",
     [st(C,A), N, N, N,  st(G,A), N, N, N,  st(F,A), N, N, N,  st(C,A), N, N, N]),
    ("Vocoder",       "Rapid i stabs — vocoder chord precision",
     [st(C,A), N, st(C,A), N,  st(C,A), N, st(C,A), N,  st(G,A), N, st(G,A), N,  st(C,A), N, N, N]),
    ("Miami",         "I–IV–V–IV fast 8ths — Miami bass electro",
     [st(C,A), N, st(F,A), N,  st(G,A), N, st(F), N,  st(C,A), N, st(F,A), N,  st(G,A), N, N, N]),
    ("Zap Chord",     "Staccato i–bVII–V — zap gun electro",
     [st(C,A), N, N, st(Bb,A),  N, N, st(G,A), N,  st(C,A), N, N, st(Bb),  N, N, st(G), N]),
    ("Cyberpunk",     "i–bII–i industrial — cyberpunk electro",
     [st(C,A), N, N, N,  st(Cs,A), N, N, N,  st(C,A), N, N, st(Cs),  N, N, st(C,A), N]),
    ("NY Groove",     "I–vi–ii–V soulful — New York electro groove",
     [st(C,A), N, N, N,  st(A), N, N, N,  st(D,A), N, N, N,  st(G,A), N, N, N]),
    ("808 Rumble",    "Sparse i — massive 808 chord rumble",
     [st(C,A), N, N, N,  N, N, N, N,  st(C,A), N, N, N,  st(G), N, N, N]),
]

# ── DOWNTEMPO — chord set #11 "Dark Jazz" (dark jazz/trip-hop voicings) ─────

J6_DOWNTEMPO = [
    ("Trip Hop",      "i–VII slow sweep — classic trip-hop movement",
     [st(C,A), N, N, N,  N, N, N, N,  st(Bb), N, N, N,  N, N, N, N]),
    ("Massive",       "i–VI slow weight — Massive Attack movement",
     [st(C,A), N, N, N,  N, N, N, N,  st(Ab,A), N, N, N,  N, N, N, N]),
    ("Shadow",        "i–v–VII–i sampled — DJ Shadow feel",
     [st(C,A), N, N, N,  st(G), N, N, N,  st(Bb,A), N, N, N,  st(C,A), N, N, N]),
    ("Haunted",       "i–VI–VII slow — Portishead haunted chords",
     [st(C,A), N, N, N,  N, N, st(Ab), N,  N, N, N, N,  st(Bb), N, N, N]),
    ("Jazz Walk",     "ii–V–I–vi slow — jazz-influenced downtempo",
     [st(D), N, N, N,  st(G,A), N, N, N,  st(C,A), N, N, N,  st(A), N, N, N]),
    ("Swing Sub",     "i–VII swung — heavily swung slow groove",
     [st(C,A), N, N, st(C),  N, N, N, st(Bb),  N, N, st(C,A), N,  N, N, N, N]),
    ("Cinematic",     "i–VI–III slow — cinematic tension arc",
     [st(C,A), N, N, N,  N, N, N, N,  st(Ab,A), N, N, N,  st(Eb), N, N, N]),
    ("Lo-Fi Warmth",  "I–vi–IV–V warm — lo-fi chord loop",
     [st(C,A), N, N, N,  st(A), N, N, N,  st(F,A), N, N, N,  st(G,A), N, N, N]),
    ("Chill Pulse",   "i–VII slow pulse — chill wave chord pulse",
     [st(C,A), N, N, N,  st(Bb), N, N, N,  st(C,A), N, N, N,  st(Bb), N, N, N]),
    ("Gravity",       "Single root chord — maximum gravity weight",
     [st(C,A), N, N, N,  N, N, N, N,  N, N, N, N,  N, N, N, N]),
]

# ── Registry ──────────────────────────────────────────────────────────────────

J6_GENRES: dict[str, list] = {
    "techno":        J6_TECHNO,
    "acid-techno":   J6_ACID_TECHNO,
    "trance":        J6_TRANCE,
    "dub-techno":    J6_DUB_TECHNO,
    "idm":           J6_IDM,
    "edm":           J6_EDM,
    "drum-and-bass": J6_DNB,
    "house":         J6_HOUSE,
    "breakbeat":     J6_BREAKBEAT,
    "jungle":        J6_JUNGLE,
    "garage":        J6_GARAGE,
    "ambient":       J6_AMBIENT,
    "glitch":        J6_GLITCH,
    "electro":       J6_ELECTRO,
    "downtempo":     J6_DOWNTEMPO,
}

J6_GENRE_NAMES = list(J6_GENRES.keys())

# Recommended J-6 chord set per genre (1-indexed, matching Roland numbering)
# PC value sent to device = chord_set - 1
J6_CHORD_SETS: dict[str, int] = {
    "techno":        58,   # "Techno"      — dark Cm7 voicings
    "acid-techno":   12,   # "Jazz Min"    — edgy minor 9ths with tritones
    "trance":        48,   # "Trance"      — emotional minor/major mix
    "dub-techno":     8,   # "Trad Min"    — sparse natural minor
    "idm":            5,   # "Jazz"        — complex major 9th extensions
    "edm":           62,   # "EDM"         — bright Maj13 voicings
    "drum-and-bass": 15,   # "Minor"       — dark minor voicings
    "house":         30,   # "Soul"        — funky/soulful voicings
    "breakbeat":     20,   # "Hip Hop"     — warm hip-hop voicings
    "jungle":        16,   # "Dark Min"    — raw dark minor
    "garage":        35,   # "RnB"         — smooth RnB voicings
    "ambient":        3,   # "Pad"         — lush sustained pad voicings
    "glitch":         7,   # "Dissonant"   — cluster/dissonant voicings
    "electro":       40,   # "Funk"        — tight funk voicings
    "downtempo":     11,   # "Dark Jazz"   — dark jazz/trip-hop voicings
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
