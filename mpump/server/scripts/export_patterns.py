#!/usr/bin/env python3
"""Export mpump pattern data to JSON for the browser-based sequencer."""

import json
import os
import sys

# Ensure the project root is on the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from mpump.patterns import GENRES, GENRE_NAMES
from mpump.patterns_t8 import T8_DRUMS, T8_BASS, T8_GENRE_NAMES
from mpump.patterns_j6 import J6_GENRES, J6_GENRE_NAMES, J6_CHORD_SETS
from mpump.keys import valid_key_names, OCTAVE_MIN, OCTAVE_MAX

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "data")


def ser_step(step):
    """Serialize a melodic/bass step to JSON-friendly dict."""
    if step is None:
        return None
    semi, vel, slide = step
    return {"semi": semi, "vel": vel, "slide": slide}


def ser_drum_step(hits):
    """Serialize a drum step (list of (note, vel)) to JSON-friendly list."""
    return [{"note": n, "vel": v} for n, v in hits]


def export_s1():
    """Export S-1 patterns keyed by genre name."""
    out = {}
    for genre in GENRE_NAMES:
        patterns = GENRES[genre]
        out[genre] = [[ser_step(s) for s in pat[2]] for pat in patterns]
    return out


def export_t8_drums():
    """Export T-8 drum patterns keyed by genre name."""
    out = {}
    for genre in T8_GENRE_NAMES:
        patterns = T8_DRUMS[genre]
        out[genre] = [[ser_drum_step(s) for s in pat[2]] for pat in patterns]
    return out


def export_t8_bass():
    """Export T-8 bass patterns keyed by genre name."""
    out = {}
    for genre in T8_GENRE_NAMES:
        patterns = T8_BASS[genre]
        out[genre] = [[ser_step(s) for s in pat[2]] for pat in patterns]
    return out


def export_j6():
    """Export J-6 chord patterns keyed by genre name."""
    out = {}
    for genre in J6_GENRE_NAMES:
        patterns = J6_GENRES[genre]
        out[genre] = [[ser_step(s) for s in pat[2]] for pat in patterns]
    return out


def export_catalog():
    """Export catalog: genre/pattern metadata, keys, octave bounds, chord sets."""
    s1_genres = []
    for genre in GENRE_NAMES:
        patterns = [{"name": p[0], "desc": p[1]} for p in GENRES[genre]]
        s1_genres.append({"name": genre, "patterns": patterns})

    t8_drum_genres = []
    for genre in T8_GENRE_NAMES:
        patterns = [{"name": p[0], "desc": p[1]} for p in T8_DRUMS[genre]]
        t8_drum_genres.append({"name": genre, "patterns": patterns})

    t8_bass_genres = []
    for genre in T8_GENRE_NAMES:
        patterns = [{"name": p[0], "desc": p[1]} for p in T8_BASS[genre]]
        t8_bass_genres.append({"name": genre, "patterns": patterns})

    j6_genres = []
    for genre in J6_GENRE_NAMES:
        patterns = [{"name": p[0], "desc": p[1]} for p in J6_GENRES[genre]]
        j6_genres.append({"name": genre, "patterns": patterns})

    return {
        "s1": {"genres": s1_genres},
        "t8": {"drum_genres": t8_drum_genres, "bass_genres": t8_bass_genres},
        "j6": {"genres": j6_genres, "chord_sets": J6_CHORD_SETS},
        "keys": valid_key_names(),
        "octave_min": OCTAVE_MIN,
        "octave_max": OCTAVE_MAX,
    }


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    files = {
        "catalog.json": export_catalog(),
        "patterns-s1.json": export_s1(),
        "patterns-t8-drums.json": export_t8_drums(),
        "patterns-t8-bass.json": export_t8_bass(),
        "patterns-j6.json": export_j6(),
    }

    for name, data in files.items():
        path = os.path.join(OUT_DIR, name)
        with open(path, "w") as f:
            json.dump(data, f, separators=(",", ":"))
        size = os.path.getsize(path)
        print(f"  {name}: {size:,} bytes")

    print("done")


if __name__ == "__main__":
    main()
