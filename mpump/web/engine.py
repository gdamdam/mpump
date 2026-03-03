"""WebEngine — state manager wrapping DeviceScanner for the web UI."""

from __future__ import annotations

import asyncio

from ..keys import (
    DEFAULT_KEY,
    DEFAULT_OCTAVE,
    OCTAVE_MAX,
    OCTAVE_MIN,
    parse_key,
    valid_key_names,
)
from ..patterns import GENRE_NAMES, GENRES, get_pattern
from ..patterns_j6 import (
    J6_CHORD_SETS,
    J6_GENRE_NAMES,
    J6_GENRES,
    get_j6_chord_set,
    get_j6_pattern,
)
from ..patterns_t8 import (
    T8_BASS,
    T8_DRUMS,
    T8_GENRE_NAMES,
    get_t8_bass_pattern,
    get_t8_drum_pattern,
)
from ..scanner import DeviceScanner
from .. import extras as _extras  # noqa: F401 — injects "extras" genre

KEY_NAMES = valid_key_names()


class WebEngine:
    """Manages all sequencer state and wraps DeviceScanner for async web use.

    Step callbacks from sequencer threads are bridged to an asyncio.Queue
    so the server can broadcast them over WebSocket.
    """

    def __init__(self, bpm: int = 120, loop: asyncio.AbstractEventLoop | None = None):
        self._loop = loop or asyncio.get_running_loop()
        self._queue: asyncio.Queue = asyncio.Queue()

        self.bpm = bpm

        # S-1 state
        self.s1_genre_idx = 0
        self.s1_pattern_idx = 0
        self.s1_key_idx = KEY_NAMES.index(DEFAULT_KEY)
        self.s1_octave = DEFAULT_OCTAVE
        self.s1_step = -1
        self.s1_connected = False
        self.s1_paused = False

        # T-8 state
        self.t8_drum_genre_idx = 0
        self.t8_bass_genre_idx = 0
        self.t8_pattern_idx = 0
        self.t8_bass_pattern_idx = 0
        self.t8_key_idx = KEY_NAMES.index(DEFAULT_KEY)
        self.t8_octave = DEFAULT_OCTAVE
        self.t8_step = -1
        self.t8_connected = False
        self.t8_paused = False

        # J-6 state
        self.j6_genre_idx = 0
        self.j6_pattern_idx = 0
        self.j6_step = -1
        self.j6_connected = False
        self.j6_paused = False

        # Editing: mutable working copies (None = not editing, list = live edit)
        self._s1_edit: list | None = None
        self._t8_drum_edit: list | None = None
        self._t8_bass_edit: list | None = None
        self._j6_edit: list | None = None

        # Scanner
        self._scanner = DeviceScanner(
            bpm=self.bpm,
            s1_pattern=self._s1_pattern(),
            s1_root=self._s1_root(),
            t8_drum_pattern=self._t8_drum(),
            t8_bass_pattern=self._t8_bass(),
            t8_bass_root=self._t8_root(),
            j6_pattern=self._j6_pattern(),
            j6_program_change=self._j6_pc(),
            s1_step_callback=lambda i: self._enqueue("step", "s1", i),
            t8_step_callback=lambda i: self._enqueue("step", "t8", i),
            j6_step_callback=lambda i: self._enqueue("step", "j6", i),
            connected_callback=lambda n, s: self._enqueue("connected", n, s),
        )

    # ── Thread→async bridge ───────────────────────────────────────────────

    def _enqueue(self, *args):
        """Thread-safe push to the async event queue."""
        self._loop.call_soon_threadsafe(self._queue.put_nowait, args)

    # ── Pattern / root helpers (mirrors ui.py) ────────────────────────────

    def _s1_pattern(self):
        if self._s1_edit is not None:
            return self._s1_edit
        return get_pattern(GENRE_NAMES[self.s1_genre_idx], self.s1_pattern_idx + 1)

    def _s1_root(self) -> int:
        return parse_key(KEY_NAMES[self.s1_key_idx], self.s1_octave)

    def _t8_drum(self):
        if self._t8_drum_edit is not None:
            return self._t8_drum_edit
        return get_t8_drum_pattern(
            T8_GENRE_NAMES[self.t8_drum_genre_idx], self.t8_pattern_idx + 1
        )

    def _t8_bass(self):
        if self._t8_bass_edit is not None:
            return self._t8_bass_edit
        bass, _ = get_t8_bass_pattern(
            T8_GENRE_NAMES[self.t8_bass_genre_idx], self.t8_bass_pattern_idx + 1
        )
        return bass

    def _t8_root(self) -> int:
        return parse_key(KEY_NAMES[self.t8_key_idx], self.t8_octave)

    def _j6_pattern(self):
        if self._j6_edit is not None:
            return self._j6_edit
        return get_j6_pattern(
            J6_GENRE_NAMES[self.j6_genre_idx], self.j6_pattern_idx + 1
        )

    def _j6_pc(self) -> int:
        return get_j6_chord_set(J6_GENRE_NAMES[self.j6_genre_idx]) - 1

    # ── Scanner lifecycle ─────────────────────────────────────────────────

    def tick(self):
        self._scanner.tick()

    def shutdown(self):
        self._scanner.shutdown()

    # ── Serialisation ─────────────────────────────────────────────────────

    @staticmethod
    def _ser_pattern(pattern: list) -> list:
        out = []
        for step in pattern:
            if step is None:
                out.append(None)
            else:
                semi, vel, slide = step
                out.append({"semi": semi, "vel": vel, "slide": slide})
        return out

    @staticmethod
    def _ser_drums(pattern: list) -> list:
        out = []
        for step in pattern:
            if not step:
                out.append([])
            else:
                out.append([{"note": n, "vel": v} for n, v in step])
        return out

    # ── State snapshot ────────────────────────────────────────────────────

    def get_state(self) -> dict:
        return {
            "bpm": self.bpm,
            "s1": {
                "genre_idx": self.s1_genre_idx,
                "pattern_idx": self.s1_pattern_idx,
                "key_idx": self.s1_key_idx,
                "octave": self.s1_octave,
                "step": self.s1_step,
                "connected": self.s1_connected,
                "paused": self.s1_paused,
                "editing": self._s1_edit is not None,
                "pattern_data": self._ser_pattern(self._s1_pattern()),
            },
            "t8": {
                "drum_genre_idx": self.t8_drum_genre_idx,
                "bass_genre_idx": self.t8_bass_genre_idx,
                "pattern_idx": self.t8_pattern_idx,
                "bass_pattern_idx": self.t8_bass_pattern_idx,
                "key_idx": self.t8_key_idx,
                "octave": self.t8_octave,
                "step": self.t8_step,
                "connected": self.t8_connected,
                "paused": self.t8_paused,
                "editing": self._t8_drum_edit is not None or self._t8_bass_edit is not None,
                "drum_data": self._ser_drums(self._t8_drum()),
                "bass_data": self._ser_pattern(self._t8_bass()),
            },
            "j6": {
                "genre_idx": self.j6_genre_idx,
                "pattern_idx": self.j6_pattern_idx,
                "step": self.j6_step,
                "connected": self.j6_connected,
                "paused": self.j6_paused,
                "editing": self._j6_edit is not None,
                "pattern_data": self._ser_pattern(self._j6_pattern()),
            },
        }

    def get_catalog(self) -> dict:
        cat: dict = {
            "s1": {"genres": []},
            "t8": {"drum_genres": [], "bass_genres": []},
            "j6": {"genres": []},
            "keys": KEY_NAMES,
            "octave_min": OCTAVE_MIN,
            "octave_max": OCTAVE_MAX,
        }
        for g in GENRE_NAMES:
            cat["s1"]["genres"].append(
                {"name": g, "patterns": [{"name": n, "desc": d} for n, d, _ in GENRES[g]]}
            )
        for g in T8_GENRE_NAMES:
            cat["t8"]["drum_genres"].append(
                {"name": g, "patterns": [{"name": n, "desc": d} for n, d, _ in T8_DRUMS[g]]}
            )
            cat["t8"]["bass_genres"].append(
                {"name": g, "patterns": [{"name": n, "desc": d} for n, d, _ in T8_BASS[g]]}
            )
        for g in J6_GENRE_NAMES:
            cat["j6"]["genres"].append(
                {"name": g, "patterns": [{"name": n, "desc": d} for n, d, _ in J6_GENRES[g]]}
            )
        return cat

    # ── Commands (called from WebSocket handler) ──────────────────────────

    def set_genre(self, device: str, idx: int) -> bool:
        if device == "s1":
            idx %= len(GENRE_NAMES)
            if idx == self.s1_genre_idx:
                return False
            self.s1_genre_idx = idx
            self.s1_pattern_idx = 0
            self._s1_edit = None
            self._scanner.update_s1(self._s1_pattern(), self._s1_root())
        elif device == "t8":
            idx %= len(T8_GENRE_NAMES)
            if idx == self.t8_drum_genre_idx:
                return False
            self.t8_drum_genre_idx = idx
            self.t8_pattern_idx = 0
            self._t8_drum_edit = None
            self._scanner.update_t8(self._t8_drum(), self._t8_bass(), self._t8_root())
        elif device == "t8_bass":
            idx %= len(T8_GENRE_NAMES)
            if idx == self.t8_bass_genre_idx:
                return False
            self.t8_bass_genre_idx = idx
            self.t8_bass_pattern_idx = 0
            self._t8_bass_edit = None
            self._scanner.update_t8(self._t8_drum(), self._t8_bass(), self._t8_root())
        elif device == "j6":
            idx %= len(J6_GENRE_NAMES)
            if idx == self.j6_genre_idx:
                return False
            self.j6_genre_idx = idx
            self.j6_pattern_idx = 0
            self._j6_edit = None
            self._scanner.update_j6(self._j6_pattern(), self._j6_pc())
        else:
            return False
        return True

    def set_pattern(self, device: str, idx: int) -> bool:
        if device == "s1":
            g = GENRE_NAMES[self.s1_genre_idx]
            idx %= len(GENRES[g])
            if idx == self.s1_pattern_idx:
                return False
            self.s1_pattern_idx = idx
            self._s1_edit = None
            self._scanner.update_s1(self._s1_pattern(), self._s1_root())
        elif device == "t8":
            g = T8_GENRE_NAMES[self.t8_drum_genre_idx]
            idx %= len(T8_DRUMS[g])
            if idx == self.t8_pattern_idx:
                return False
            self.t8_pattern_idx = idx
            self._t8_drum_edit = None
            self._scanner.update_t8(self._t8_drum(), self._t8_bass(), self._t8_root())
        elif device == "t8_bass":
            g = T8_GENRE_NAMES[self.t8_bass_genre_idx]
            idx %= len(T8_BASS[g])
            if idx == self.t8_bass_pattern_idx:
                return False
            self.t8_bass_pattern_idx = idx
            self._t8_bass_edit = None
            self._scanner.update_t8(self._t8_drum(), self._t8_bass(), self._t8_root())
        elif device == "j6":
            g = J6_GENRE_NAMES[self.j6_genre_idx]
            idx %= len(J6_GENRES[g])
            if idx == self.j6_pattern_idx:
                return False
            self.j6_pattern_idx = idx
            self._j6_edit = None
            self._scanner.update_j6(self._j6_pattern(), self._j6_pc())
        else:
            return False
        return True

    def set_key(self, device: str, idx: int) -> bool:
        idx %= len(KEY_NAMES)
        if device == "s1":
            if idx == self.s1_key_idx:
                return False
            self.s1_key_idx = idx
            self._scanner.update_s1(self._s1_pattern(), self._s1_root())
        elif device == "t8":
            if idx == self.t8_key_idx:
                return False
            self.t8_key_idx = idx
            self._scanner.update_t8(self._t8_drum(), self._t8_bass(), self._t8_root())
        else:
            return False
        return True

    def set_octave(self, device: str, octave: int) -> bool:
        octave = max(OCTAVE_MIN, min(OCTAVE_MAX, octave))
        if device == "s1":
            if octave == self.s1_octave:
                return False
            self.s1_octave = octave
            self._scanner.update_s1(self._s1_pattern(), self._s1_root())
        elif device == "t8":
            if octave == self.t8_octave:
                return False
            self.t8_octave = octave
            self._scanner.update_t8(self._t8_drum(), self._t8_bass(), self._t8_root())
        else:
            return False
        return True

    def set_bpm(self, bpm: int) -> bool:
        bpm = max(20, min(300, bpm))
        if bpm == self.bpm:
            return False
        self.bpm = bpm
        self._scanner.update_bpm(bpm)
        return True

    def toggle_pause(self, device: str) -> bool:
        name_map = {"s1": "S-1", "t8": "T-8", "j6": "J-6"}
        name = name_map.get(device)
        if not name:
            return False
        now_playing = self._scanner.toggle_device(name)
        if device == "s1":
            self.s1_paused = not now_playing
            if self.s1_paused:
                self.s1_step = -1
        elif device == "t8":
            self.t8_paused = not now_playing
            if self.t8_paused:
                self.t8_step = -1
        elif device == "j6":
            self.j6_paused = not now_playing
            if self.j6_paused:
                self.j6_step = -1
        return True

    # ── Live pattern editing ──────────────────────────────────────────────

    def edit_step(self, device: str, step_idx: int, step_data) -> bool:
        """Edit a single step.  *step_data* is None (rest) or (semi, vel, slide)."""
        if not (0 <= step_idx < 16):
            return False

        if device == "s1":
            if self._s1_edit is None:
                self._s1_edit = list(self._s1_pattern())
            self._s1_edit[step_idx] = step_data
            self._scanner.update_s1(self._s1_edit, self._s1_root())
        elif device == "t8_bass":
            if self._t8_bass_edit is None:
                self._t8_bass_edit = list(self._t8_bass())
            self._t8_bass_edit[step_idx] = step_data
            self._scanner.update_t8(self._t8_drum(), self._t8_bass_edit, self._t8_root())
        elif device == "j6":
            if self._j6_edit is None:
                self._j6_edit = list(self._j6_pattern())
            self._j6_edit[step_idx] = step_data
            self._scanner.update_j6(self._j6_edit, self._j6_pc())
        else:
            return False
        return True

    def edit_drum_step(self, step_idx: int, hits: list) -> bool:
        """Edit a single drum step.  *hits* is a list of (note, vel) tuples."""
        if not (0 <= step_idx < 16):
            return False
        if self._t8_drum_edit is None:
            self._t8_drum_edit = list(self._t8_drum())
        self._t8_drum_edit[step_idx] = hits
        self._scanner.update_t8(self._t8_drum_edit, self._t8_bass(), self._t8_root())
        return True

    def discard_edit(self, device: str) -> bool:
        """Discard edits and revert to the genre/pattern source."""
        if device == "s1":
            self._s1_edit = None
            self._scanner.update_s1(self._s1_pattern(), self._s1_root())
        elif device == "t8":
            self._t8_drum_edit = None
            self._t8_bass_edit = None
            self._scanner.update_t8(self._t8_drum(), self._t8_bass(), self._t8_root())
        elif device == "j6":
            self._j6_edit = None
            self._scanner.update_j6(self._j6_pattern(), self._j6_pc())
        else:
            return False
        return True

    def save_to_extras(self, device: str, name: str, desc: str) -> bool:
        """Persist the current (possibly edited) pattern to the extras genre."""
        from ..extras import reload as _reload, save_pattern as _save

        if device == "s1":
            ok = _save("s1", name, desc, list(self._s1_pattern()))
            self._s1_edit = None
        elif device == "t8":
            _save("t8", name, desc, list(self._t8_drum()))
            ok = _save("t8_bass", name, desc, list(self._t8_bass()))
            self._t8_drum_edit = None
            self._t8_bass_edit = None
        elif device == "t8_bass":
            ok = _save("t8_bass", name, desc, list(self._t8_bass()))
            self._t8_bass_edit = None
        elif device == "j6":
            ok = _save("j6", name, desc, list(self._j6_pattern()))
            self._j6_edit = None
        else:
            return False
        return ok

    def delete_extra(self, device: str, idx: int) -> bool:
        from ..extras import delete_pattern as _delete
        return _delete(device, idx)
