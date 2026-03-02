#!/usr/bin/env python3
"""
mpump — Roland AIRA MIDI sequencer.

Watches for Roland AIRA devices (S-1, J-6, T-8) and SP-404MK2 over USB MIDI.
Plug or unplug devices at any time — loops start/stop automatically.

Usage:
    python3 mpump.py [options]
    python3 mpump.py --list
    python3 mpump.py --list-t8
"""

import argparse
import sys

from .keys import parse_key, valid_key_names, DEFAULT_KEY, DEFAULT_OCTAVE, OCTAVE_MIN, OCTAVE_MAX
from .patterns import get_pattern, list_patterns, GENRE_NAMES, GENRES
from .patterns_t8 import (
    get_t8_drum_pattern, get_t8_bass_pattern,
    list_t8_patterns, T8_GENRE_NAMES,
)
from .patterns_j6 import (
    get_j6_pattern, get_j6_chord_set, list_j6_patterns, J6_GENRE_NAMES, J6_GENRES,
)
from .scanner import DeviceScanner

DEFAULT_GENRE      = "techno"
DEFAULT_PATTERN    = 1
DEFAULT_BPM        = 120
DEFAULT_T8_GENRE   = "techno"
DEFAULT_T8_PATTERN = 1
DEFAULT_J6_GENRE   = "techno"
DEFAULT_J6_PATTERN = 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="mpump",
        description="Stream MIDI to Roland AIRA devices (hot-plug aware)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "S-1 genres:  " + ", ".join(GENRE_NAMES) + "\n"
            "T-8 genres:  " + ", ".join(T8_GENRE_NAMES) + "\n"
            "J-6 genres:  " + ", ".join(J6_GENRE_NAMES) + "\n"
            "Keys:        " + ", ".join(valid_key_names())
        ),
    )
    parser.add_argument(
        "--bpm", type=int, default=DEFAULT_BPM, metavar="BPM",
        help=f"Tempo in BPM (20–300, default {DEFAULT_BPM})",
    )

    # S-1 options
    s1 = parser.add_argument_group("S-1 (monosynth)")
    s1.add_argument(
        "--genre", default=DEFAULT_GENRE, choices=GENRE_NAMES, metavar="GENRE",
        help=f"Pattern genre: {', '.join(GENRE_NAMES)} (default: {DEFAULT_GENRE})",
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
        help=(
            f"Root octave ({OCTAVE_MIN}–{OCTAVE_MAX}, default {DEFAULT_OCTAVE}). "
            "A2=45, A3=57, A1=33"
        ),
    )

    # T-8 options
    t8 = parser.add_argument_group("T-8 (drum machine + bass)")
    t8.add_argument(
        "--t8-genre", default=DEFAULT_T8_GENRE, choices=T8_GENRE_NAMES,
        metavar="GENRE",
        help=f"T-8 drum genre: {', '.join(T8_GENRE_NAMES)} (default: {DEFAULT_T8_GENRE})",
    )
    t8.add_argument(
        "--t8-pattern", type=int, default=DEFAULT_T8_PATTERN, metavar="N",
        help=f"T-8 drum pattern 1–10 (default: {DEFAULT_T8_PATTERN}). Bass auto-follows genre.",
    )
    t8.add_argument(
        "--t8-key", default=DEFAULT_KEY, metavar="KEY",
        help=f"Root key for T-8 bass (default: {DEFAULT_KEY})",
    )
    t8.add_argument(
        "--t8-octave", type=int, default=DEFAULT_OCTAVE, metavar="N",
        help=f"Root octave for T-8 bass ({OCTAVE_MIN}–{OCTAVE_MAX}, default {DEFAULT_OCTAVE})",
    )

    # J-6 options
    j6 = parser.add_argument_group("J-6 (chord synthesizer)")
    j6.add_argument(
        "--j6-genre", default=DEFAULT_J6_GENRE, choices=J6_GENRE_NAMES, metavar="GENRE",
        help=f"J-6 chord genre: {', '.join(J6_GENRE_NAMES)} (default: {DEFAULT_J6_GENRE})",
    )
    j6.add_argument(
        "--j6-pattern", type=int, default=DEFAULT_J6_PATTERN, metavar="N",
        help=f"J-6 chord pattern 1–10 (default: {DEFAULT_J6_PATTERN})",
    )

    # Listing
    parser.add_argument("--list",    action="store_true", help="List all S-1 patterns and exit")
    parser.add_argument("--list-t8", action="store_true", help="List all T-8 drum patterns and exit")
    parser.add_argument("--list-j6", action="store_true", help="List all J-6 chord patterns and exit")

    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if args.list:
        print(list_patterns())
        return

    if args.list_t8:
        print(list_t8_patterns())
        return

    if args.list_j6:
        print(list_j6_patterns())
        return

    if not (20 <= args.bpm <= 300):
        print("Error: --bpm must be between 20 and 300", file=sys.stderr)
        sys.exit(1)

    # S-1 ----------------------------------------------------------------
    try:
        s1_root = parse_key(args.key, args.octave)
    except ValueError as e:
        print(f"Error (S-1 key): {e}", file=sys.stderr)
        sys.exit(1)

    try:
        s1_pattern = get_pattern(args.genre, args.pattern)
    except ValueError as e:
        print(f"Error (S-1 pattern): {e}", file=sys.stderr)
        sys.exit(1)

    # T-8 ----------------------------------------------------------------
    try:
        t8_bass_root = parse_key(args.t8_key, args.t8_octave)
    except ValueError as e:
        print(f"Error (T-8 key): {e}", file=sys.stderr)
        sys.exit(1)

    try:
        t8_drum = get_t8_drum_pattern(args.t8_genre, args.t8_pattern)
    except ValueError as e:
        print(f"Error (T-8 pattern): {e}", file=sys.stderr)
        sys.exit(1)

    t8_bass, t8_bass_desc = get_t8_bass_pattern(args.t8_genre)

    # J-6 ----------------------------------------------------------------
    try:
        j6_pattern = get_j6_pattern(args.j6_genre, args.j6_pattern)
    except ValueError as e:
        print(f"Error (J-6 pattern): {e}", file=sys.stderr)
        sys.exit(1)

    j6_chord_set = get_j6_chord_set(args.j6_genre)
    j6_pc        = j6_chord_set - 1   # PC value is 0-indexed

    # Header -------------------------------------------------------------
    s1_name, s1_desc, _ = GENRES[args.genre][args.pattern - 1]
    from .patterns_t8 import T8_DRUMS
    t8_name, t8_desc, _ = T8_DRUMS[args.t8_genre][args.t8_pattern - 1]
    j6_name, j6_desc, _ = J6_GENRES[args.j6_genre][args.j6_pattern - 1]

    print(f"mpump — {args.bpm} BPM  (Ctrl-C to quit)")
    print(f"S-1  key={args.key}{args.octave}  {args.genre}  #{args.pattern}: {s1_name}")
    print(f'     "{s1_desc}"')
    print(f"T-8  key={args.t8_key}{args.t8_octave}  {args.t8_genre}  #{args.t8_pattern}: {t8_name}")
    print(f'     drums: "{t8_desc}"')
    print(f'     bass:  "{t8_bass_desc}"')
    print(f"J-6  {args.j6_genre}  #{args.j6_pattern}: {j6_name}  (chord set #{j6_chord_set})")
    print(f'     "{j6_desc}"')
    print()

    scanner = DeviceScanner(
        bpm=args.bpm,
        s1_pattern=s1_pattern,
        s1_root=s1_root,
        t8_drum_pattern=t8_drum,
        t8_bass_pattern=t8_bass,
        t8_bass_root=t8_bass_root,
        j6_pattern=j6_pattern,
        j6_program_change=j6_pc,
    )
    scanner.run()


if __name__ == "__main__":
    main()
