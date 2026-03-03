"""Persistence layer for user-created patterns stored in ~/.mpump/extras.json.

On import, loads saved patterns and injects an "extras" genre into the
shared genre dicts (GENRES, T8_DRUMS, T8_BASS, J6_GENRES) so all
interfaces (web, TUI, CLI) see them automatically.
"""

from __future__ import annotations

import json
from pathlib import Path

from .patterns import GENRES, GENRE_NAMES
from .patterns_j6 import J6_CHORD_SETS, J6_GENRE_NAMES, J6_GENRES
from .patterns_t8 import T8_BASS, T8_DRUMS, T8_GENRE_NAMES

EXTRAS_DIR = Path.home() / ".mpump"
EXTRAS_FILE = EXTRAS_DIR / "extras.json"

GENRE_KEY = "extras"

# ── Serialisation helpers ─────────────────────────────────────────────────

def _ser_step(s):
    if s is None:
        return None
    return {"semi": s[0], "vel": s[1], "slide": s[2]}


def _deser_step(s):
    if s is None:
        return None
    return (s["semi"], s["vel"], s["slide"])


def _ser_drum_step(s):
    return [{"note": n, "vel": v} for n, v in s]


def _deser_drum_step(s):
    return [(h["note"], h["vel"]) for h in s]


# ── Disk I/O ──────────────────────────────────────────────────────────────

def _load_raw() -> dict:
    if not EXTRAS_FILE.exists():
        return {}
    try:
        with open(EXTRAS_FILE) as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}


def _save_raw(data: dict):
    EXTRAS_DIR.mkdir(parents=True, exist_ok=True)
    with open(EXTRAS_FILE, "w") as f:
        json.dump(data, f, indent=2)


# ── Convert JSON → tuple format expected by genre dicts ───────────────────

def _to_melodic_tuples(patterns: list) -> list[tuple]:
    return [
        (p["name"], p["desc"], [_deser_step(s) for s in p["steps"]])
        for p in patterns
    ]


def _to_drum_tuples(patterns: list) -> list[tuple]:
    return [
        (p["name"], p["desc"], [_deser_drum_step(s) for s in p["steps"]])
        for p in patterns
    ]


# ── Inject / reload ──────────────────────────────────────────────────────

def reload():
    """(Re)load extras from disk and update the shared genre dicts in place."""
    data = _load_raw()

    GENRES[GENRE_KEY] = _to_melodic_tuples(data.get("s1", []))
    T8_DRUMS[GENRE_KEY] = _to_drum_tuples(data.get("t8_drums", []))
    T8_BASS[GENRE_KEY] = _to_melodic_tuples(data.get("t8_bass", []))
    J6_GENRES[GENRE_KEY] = _to_melodic_tuples(data.get("j6", []))

    for names in (GENRE_NAMES, T8_GENRE_NAMES, J6_GENRE_NAMES):
        if GENRE_KEY not in names:
            names.append(GENRE_KEY)

    J6_CHORD_SETS.setdefault(GENRE_KEY, 1)


# ── Public API ────────────────────────────────────────────────────────────

def save_pattern(device: str, name: str, desc: str, steps: list) -> bool:
    """Persist a pattern to extras.  *device* is s1 | t8 | t8_bass | j6."""
    key_map = {"s1": "s1", "t8": "t8_drums", "t8_bass": "t8_bass", "j6": "j6"}
    key = key_map.get(device)
    if not key:
        return False

    data = _load_raw()

    if device in ("s1", "t8_bass", "j6"):
        serialized = [_ser_step(s) for s in steps]
    else:
        serialized = [_ser_drum_step(s) for s in steps]

    data.setdefault(key, []).append({"name": name, "desc": desc, "steps": serialized})
    _save_raw(data)
    reload()
    return True


def delete_pattern(device: str, idx: int) -> bool:
    """Delete pattern at 0-based *idx* from the extras genre."""
    key_map = {"s1": "s1", "t8": "t8_drums", "t8_bass": "t8_bass", "j6": "j6"}
    key = key_map.get(device)
    if not key:
        return False

    data = _load_raw()
    patterns = data.get(key, [])
    if not (0 <= idx < len(patterns)):
        return False

    patterns.pop(idx)
    _save_raw(data)
    reload()
    return True


# Run on first import — all interfaces that ``import extras`` get the genre.
reload()
