#!/usr/bin/env python3
"""mpump TUI launcher — same flags as mpump.py, opens the terminal interface."""

import argparse
import sys

from mpump.keys import DEFAULT_KEY, DEFAULT_OCTAVE, OCTAVE_MIN, OCTAVE_MAX, valid_key_names
from mpump.patterns import GENRE_NAMES
from mpump.patterns_t8 import T8_GENRE_NAMES
from mpump.patterns_j6 import J6_GENRE_NAMES
from mpump.ui import run_ui

DEFAULT_BPM        = 120
DEFAULT_GENRE      = "techno"
DEFAULT_PATTERN    = 1
DEFAULT_T8_GENRE        = "techno"
DEFAULT_T8_PATTERN      = 1
DEFAULT_T8_BASS_PATTERN = 1
DEFAULT_J6_GENRE   = "techno"
DEFAULT_J6_PATTERN = 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="mpump_ui",
        description="mpump — Roland AIRA MIDI sequencer (terminal UI)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "S-1 genres:  " + ", ".join(GENRE_NAMES) + "\n"
            "T-8 genres:  " + ", ".join(T8_GENRE_NAMES) + "\n"
            "J-6 genres:  " + ", ".join(J6_GENRE_NAMES) + "\n"
            "Keys:        " + ", ".join(valid_key_names()) + "\n\n"
            "Key bindings in the UI:\n"
            "  Tab          Switch focus between S-1, T-8 and J-6 panels\n"
            "  ← / →        Previous / next genre\n"
            "  ↑ / ↓        Previous / next drum pattern (T-8: drums)\n"
            "  ⇧↑ / ⇧↓      Previous / next bass pattern (T-8 only)\n"
            "  k / K        Key down / up\n"
            "  o / O        Octave down / up\n"
            "  l            Lock / unlock key across all devices\n"
            "  = / -        BPM +5 / -5\n"
            "  q            Quit\n"
        ),
    )
    parser.add_argument(
        "--bpm", type=int, default=DEFAULT_BPM, metavar="BPM",
        help=f"Tempo in BPM (20–300, default {DEFAULT_BPM})",
    )

    s1 = parser.add_argument_group("S-1 (monosynth)")
    s1.add_argument(
        "--genre", default=DEFAULT_GENRE, choices=GENRE_NAMES, metavar="GENRE",
        help=f"Pattern genre (default: {DEFAULT_GENRE})",
    )
    s1.add_argument(
        "--pattern", type=int, default=DEFAULT_PATTERN, metavar="N",
        help=f"Pattern 1–10 within genre (default: {DEFAULT_PATTERN})",
    )
    s1.add_argument(
        "--key", default=DEFAULT_KEY, metavar="KEY",
        help=f"Root key, e.g. A, F#, Bb (default: {DEFAULT_KEY})",
    )
    s1.add_argument(
        "--octave", type=int, default=DEFAULT_OCTAVE, metavar="N",
        help=f"Root octave ({OCTAVE_MIN}–{OCTAVE_MAX}, default {DEFAULT_OCTAVE})",
    )

    t8 = parser.add_argument_group("T-8 (drum machine + bass)")
    t8.add_argument(
        "--t8-genre", default=DEFAULT_T8_GENRE, choices=T8_GENRE_NAMES, metavar="GENRE",
        help=f"T-8 drum genre (default: {DEFAULT_T8_GENRE})",
    )
    t8.add_argument(
        "--t8-pattern", type=int, default=DEFAULT_T8_PATTERN, metavar="N",
        help=f"T-8 drum pattern 1–10 (default: {DEFAULT_T8_PATTERN})",
    )
    t8.add_argument(
        "--t8-bass-pattern", type=int, default=DEFAULT_T8_BASS_PATTERN, metavar="N",
        help=f"T-8 bass pattern 1–10, independent of drums (default: {DEFAULT_T8_BASS_PATTERN})",
    )
    t8.add_argument(
        "--t8-key", default=DEFAULT_KEY, metavar="KEY",
        help=f"Root key for T-8 bass (default: {DEFAULT_KEY})",
    )
    t8.add_argument(
        "--t8-octave", type=int, default=DEFAULT_OCTAVE, metavar="N",
        help=f"Root octave for T-8 bass ({OCTAVE_MIN}–{OCTAVE_MAX}, default {DEFAULT_OCTAVE})",
    )

    j6 = parser.add_argument_group("J-6 (chord synthesizer)")
    j6.add_argument(
        "--j6-genre", default=DEFAULT_J6_GENRE, choices=J6_GENRE_NAMES, metavar="GENRE",
        help=f"J-6 chord genre (default: {DEFAULT_J6_GENRE})",
    )
    j6.add_argument(
        "--j6-pattern", type=int, default=DEFAULT_J6_PATTERN, metavar="N",
        help=f"J-6 chord pattern 1–10 (default: {DEFAULT_J6_PATTERN})",
    )

    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if not (20 <= args.bpm <= 300):
        print("Error: --bpm must be between 20 and 300", file=sys.stderr)
        sys.exit(1)

    run_ui(
        bpm=args.bpm,
        s1_genre=args.genre,      s1_pattern=args.pattern,
        s1_key=args.key,          s1_octave=args.octave,
        t8_genre=args.t8_genre,   t8_pattern=args.t8_pattern,  t8_bass_pattern=args.t8_bass_pattern,
        t8_key=args.t8_key,       t8_octave=args.t8_octave,
        j6_genre=args.j6_genre,   j6_pattern=args.j6_pattern,
    )


if __name__ == "__main__":
    main()
