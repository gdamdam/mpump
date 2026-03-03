"""Persistence layer for user-created patterns stored in ~/.mpump/extras.json.

On import, loads saved patterns and injects an "extras" genre into the
shared genre dicts (GENRES, T8_DRUMS, T8_BASS, J6_GENRES) so all
interfaces (web, TUI, CLI) see them automatically.

Keys are mode-based: "synth", "drums", "bass", "chords".
Old device-specific keys ("s1", "t8_drums", "t8_bass", "j6") are
migrated automatically on load.
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

# Old key → new key migration map
_MIGRATE = {"s1": "synth", "t8_drums": "drums", "t8_bass": "bass", "j6": "chords"}

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
            data = json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}
    # Migrate old keys if present
    migrated = False
    for old_key, new_key in _MIGRATE.items():
        if old_key in data and new_key not in data:
            data[new_key] = data.pop(old_key)
            migrated = True
        elif old_key in data and new_key in data:
            # Merge old into new, then remove old
            data[new_key].extend(data.pop(old_key))
            migrated = True
    if migrated:
        _save_raw(data)
    return data


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

    GENRES[GENRE_KEY] = _to_melodic_tuples(data.get("synth", []))
    T8_DRUMS[GENRE_KEY] = _to_drum_tuples(data.get("drums", []))
    T8_BASS[GENRE_KEY] = _to_melodic_tuples(data.get("bass", []))
    J6_GENRES[GENRE_KEY] = _to_melodic_tuples(data.get("chords", []))

    for names in (GENRE_NAMES, T8_GENRE_NAMES, J6_GENRE_NAMES):
        if GENRE_KEY not in names:
            names.append(GENRE_KEY)

    J6_CHORD_SETS.setdefault(GENRE_KEY, 1)


# ── Public API ────────────────────────────────────────────────────────────

# Mode-based key map for public API (accepts both old and new names)
_KEY_MAP = {
    "s1": "synth", "synth": "synth",
    "t8": "drums", "drums": "drums",
    "t8_bass": "bass", "bass": "bass",
    "j6": "chords", "chords": "chords",
}

_DRUM_KEYS = {"drums", "t8"}


def save_pattern(device: str, name: str, desc: str, steps: list) -> bool:
    """Persist a pattern to extras.  *device* is synth|drums|bass|chords (or legacy s1|t8|t8_bass|j6)."""
    key = _KEY_MAP.get(device)
    if not key:
        return False

    data = _load_raw()

    if device in _DRUM_KEYS or key == "drums":
        serialized = [_ser_drum_step(s) for s in steps]
    else:
        serialized = [_ser_step(s) for s in steps]

    data.setdefault(key, []).append({"name": name, "desc": desc, "steps": serialized})
    _save_raw(data)
    reload()
    return True


def delete_pattern(device: str, idx: int) -> bool:
    """Delete pattern at 0-based *idx* from the extras genre."""
    key = _KEY_MAP.get(device)
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
