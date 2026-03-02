#!/usr/bin/env python3
"""
Roland AIRA device sequencer.

Watches for Roland AIRA devices (S-1, J-6, T-8) and SP-404MK2 over USB MIDI.
When a device is detected, starts a 16-step C/E alternating loop on it.
Plug or unplug devices at any time — the loop starts/stops automatically.

Usage:
    python3 main.py [--bpm BPM]
"""

import argparse
import sys

from scanner import DeviceScanner


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Stream MIDI to Roland AIRA devices (hot-plug aware)"
    )
    parser.add_argument(
        "--bpm", type=int, default=120,
        help="Tempo in BPM for the 16-step sequencer (default: 120)"
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if not (20 <= args.bpm <= 300):
        print("Error: --bpm must be between 20 and 300", file=sys.stderr)
        sys.exit(1)

    print(f"Roland AIRA sequencer — {args.bpm} BPM  (Ctrl-C to quit)")
    print("Pattern: C C C C E E E E C C C C E E E E")
    print()

    scanner = DeviceScanner(bpm=args.bpm)
    scanner.run()


if __name__ == "__main__":
    main()
