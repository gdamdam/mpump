#!/usr/bin/env python3
"""
Roland AIRA device sequencer.

Watches for Roland AIRA devices (S-1, J-6, T-8) and SP-404MK2 over USB MIDI.
Plug or unplug devices at any time — loops start/stop automatically.

The S-1 plays genre-based bass/synth patterns from a 40-pattern library.
Other devices use their fixed default pattern.

Usage:
    python3 main.py [options]
    python3 main.py --list

Options:
    --bpm BPM          Tempo (20–300, default 120)
    --genre GENRE      Pattern genre for S-1 (default: techno)
    --pattern N        Pattern number 1–10 within genre (default: 1)
    --key KEY          Root key for S-1, e.g. A, F#, Bb (default: A)
    --list             Print all available patterns and exit
"""

import argparse
import sys

from keys import parse_key, valid_key_names, DEFAULT_KEY
from patterns import get_pattern, list_patterns, GENRE_NAMES
from scanner import DeviceScanner

DEFAULT_GENRE   = "techno"
DEFAULT_PATTERN = 1
DEFAULT_BPM     = 120


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Stream MIDI to Roland AIRA devices (hot-plug aware)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Genres: " + ", ".join(GENRE_NAMES) + "\n"
            "Keys:   " + ", ".join(valid_key_names())
        ),
    )
    parser.add_argument(
        "--bpm", type=int, default=DEFAULT_BPM,
        metavar="BPM",
        help=f"Tempo in BPM (20–300, default {DEFAULT_BPM})",
    )
    parser.add_argument(
        "--genre", default=DEFAULT_GENRE,
        choices=GENRE_NAMES,
        metavar="GENRE",
        help=f"S-1 pattern genre: {', '.join(GENRE_NAMES)} (default: {DEFAULT_GENRE})",
    )
    parser.add_argument(
        "--pattern", type=int, default=DEFAULT_PATTERN,
        metavar="N",
        help=f"Pattern number 1–10 within the genre (default: {DEFAULT_PATTERN})",
    )
    parser.add_argument(
        "--key", default=DEFAULT_KEY,
        metavar="KEY",
        help=f"Root key for S-1, e.g. A, F#, Bb (default: {DEFAULT_KEY})",
    )
    parser.add_argument(
        "--list", action="store_true",
        help="Print all available patterns and exit",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if args.list:
        print(list_patterns())
        return

    # Validate BPM
    if not (20 <= args.bpm <= 300):
        print("Error: --bpm must be between 20 and 300", file=sys.stderr)
        sys.exit(1)

    # Validate and resolve key → root MIDI note
    try:
        root_note = parse_key(args.key)
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    # Validate and load pattern
    try:
        pattern = get_pattern(args.genre, args.pattern)
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    # Pretty header
    from patterns import GENRES
    pat_name, pat_desc, _ = GENRES[args.genre][args.pattern - 1]
    print(f"Roland AIRA sequencer — {args.bpm} BPM  (Ctrl-C to quit)")
    print(f"S-1  key={args.key}  genre={args.genre}  pattern={args.pattern}: {pat_name}")
    print(f'     "{pat_desc}"')
    print()

    scanner = DeviceScanner(
        bpm=args.bpm,
        s1_pattern=pattern,
        s1_root=root_note,
    )
    scanner.run()


if __name__ == "__main__":
    main()
