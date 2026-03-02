"""mpump TUI — Textual-based terminal interface."""

from __future__ import annotations

from rich.text import Text
from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical
from textual.reactive import reactive
from textual.widget import Widget
from textual.widgets import Footer, Static

from .devices import DEVICES
from .keys import DEFAULT_KEY, DEFAULT_OCTAVE, OCTAVE_MAX, OCTAVE_MIN, parse_key, valid_key_names
from .patterns import GENRE_NAMES, GENRES, get_pattern
from .patterns_t8 import T8_DRUMS, T8_GENRE_NAMES, get_t8_bass_pattern, get_t8_drum_pattern
from .scanner import DeviceScanner

KEY_NAMES = valid_key_names()
DRUM_ROWS = [(36, "BD"), (38, "SD"), (42, "CH"), (46, "OH"), (50, "CP"), (49, "CY")]

_NOTE   = "#3fb950"   # green   — normal note / drum hit
_ACCENT = "#e6a817"   # amber   — accent / high velocity
_SLIDE  = "#58a6ff"   # blue    — slide / bass note
_REST   = "#2d333b"   # dim     — empty step
_CURSOR = "#1d4e89"   # navy    — step cursor bg
_DIM    = "#7d8590"   # grey    — labels


# ─────────────────────────────────────────────────────────────────────────────
# Step grid widgets
# ─────────────────────────────────────────────────────────────────────────────

class StepGrid(Static):
    """16-step melodic grid for S-1."""

    current_step: reactive[int] = reactive(-1)

    def __init__(self, **kw):
        super().__init__(**kw)
        self._pattern: list = []

    def set_pattern(self, pat: list) -> None:
        self._pattern = pat
        self.refresh()

    def render(self) -> Text:
        t = Text()
        cur = self.current_step
        for i, step in enumerate(self._pattern):
            if i > 0 and i % 4 == 0:
                t.append("  ")
            active = i == cur
            if step is None:
                t.append("·", style=f"bold white on {_CURSOR}" if active else _REST)
            else:
                _semi, vel, slide = step
                ch = "/" if slide else "■"
                if active:
                    t.append(ch, style=f"bold bright_white on {_CURSOR}")
                elif vel > 1.0:
                    t.append(ch, style=f"bold {_ACCENT}")
                else:
                    t.append(ch, style=_NOTE)
            if i < len(self._pattern) - 1 and (i + 1) % 4 != 0:
                t.append(" ")
        return t

    def watch_current_step(self, _: int) -> None:
        self.refresh()


class DrumGrid(Static):
    """Drum rows + bass row for T-8."""

    current_step: reactive[int] = reactive(-1)

    def __init__(self, **kw):
        super().__init__(**kw)
        self._drum: list = [[] for _ in range(16)]
        self._bass: list = [None] * 16

    def set_patterns(self, drum: list, bass: list) -> None:
        self._drum = drum
        self._bass = bass
        self.refresh()

    def _step_span(self, i: int) -> str:
        """Separator before group of 4."""
        return "  " if (i > 0 and i % 4 == 0) else ""

    def render(self) -> Text:
        t = Text()
        cur = self.current_step

        for note, label in DRUM_ROWS:
            t.append(f"{label} ", style=f"bold {_DIM}")
            for i, dstep in enumerate(self._drum):
                t.append(self._step_span(i))
                active = i == cur
                hit = any(n == note for n, _ in dstep)
                if hit:
                    vel = next((v for n, v in dstep if n == note), 100)
                    if active:
                        t.append("●", style=f"bold bright_yellow on {_CURSOR}")
                    elif vel >= 110:
                        t.append("●", style=f"bold {_ACCENT}")
                    elif vel <= 70:
                        t.append("·", style=_NOTE)
                    else:
                        t.append("●", style=_NOTE)
                else:
                    t.append("○", style=f"bold {_CURSOR}" if active else _REST)
                if i < 15 and (i + 1) % 4 != 0:
                    t.append(" ")
            t.append("\n")

        # Bass row
        t.append("bs ", style=f"bold {_DIM}")
        for i, bstep in enumerate(self._bass):
            t.append(self._step_span(i))
            active = i == cur
            if bstep is None:
                t.append("─", style=f"bold white on {_CURSOR}" if active else _REST)
            else:
                _semi, vel, slide = bstep
                ch = "/" if slide else "■"
                if active:
                    t.append(ch, style=f"bold bright_cyan on {_CURSOR}")
                elif vel > 1.0:
                    t.append(ch, style=f"bold {_ACCENT}")
                else:
                    t.append(ch, style=_SLIDE)
            if i < 15 and (i + 1) % 4 != 0:
                t.append(" ")
        return t

    def watch_current_step(self, _: int) -> None:
        self.refresh()


# ─────────────────────────────────────────────────────────────────────────────
# Device panels
# ─────────────────────────────────────────────────────────────────────────────

class DevicePanel(Widget):
    """Abstract base — do not instantiate directly."""

    COMPONENT_CLASSES = {"panel--focused"}
    focused_panel: reactive[bool] = reactive(False)

    def watch_focused_panel(self, val: bool) -> None:
        self.set_class(val, "focused")


class S1Panel(DevicePanel):
    """Left panel: S-1 melodic sequencer."""

    def compose(self) -> ComposeResult:
        yield Static("", id="s1-header")
        yield Static("", id="s1-info")
        yield StepGrid(id="s1-grid")


class T8Panel(DevicePanel):
    """Right panel: T-8 drum + bass sequencer."""

    def compose(self) -> ComposeResult:
        yield Static("", id="t8-header")
        yield Static("", id="t8-info")
        yield DrumGrid(id="t8-grid")


# ─────────────────────────────────────────────────────────────────────────────
# Main app
# ─────────────────────────────────────────────────────────────────────────────

class MpumpApp(App):

    CSS = """
    Screen {
        background: #0d1117;
    }

    #body {
        height: 1fr;
    }

    S1Panel, T8Panel {
        border: solid #21262d;
        padding: 1 2;
        width: 1fr;
    }

    S1Panel.focused, T8Panel.focused {
        border: solid #58a6ff;
    }

    #s1-header, #t8-header {
        text-style: bold;
        margin-bottom: 1;
    }

    #s1-info, #t8-info {
        color: #8b949e;
        margin-bottom: 1;
    }

    StepGrid {
        height: 1;
        margin-top: 1;
    }

    DrumGrid {
        height: 7;
        margin-top: 1;
    }

    Footer {
        background: #161b22;
        color: #58a6ff;
    }
    """

    BINDINGS = [
        Binding("q",      "quit",        "Quit"),
        Binding("tab",    "next_panel",  "Switch", show=False),
        Binding("left",   "prev_genre",  "← genre"),
        Binding("right",  "next_genre",  "→ genre"),
        Binding("up",     "next_pattern","↑ pattern"),
        Binding("down",   "prev_pattern","↓ pattern"),
        Binding("k",      "prev_key",    "k key ↓"),
        Binding("K",      "next_key",    "K key ↑"),
        Binding("o",      "prev_octave", "o oct ↓"),
        Binding("O",      "next_octave", "O oct ↑"),
        Binding("equal",  "bpm_up",      "+ BPM"),
        Binding("minus",  "bpm_down",    "- BPM"),
        Binding("enter",  "commit",      "↵ apply"),
    ]

    # ── Reactive state ──────────────────────────────────────────────────────
    focused_panel: reactive[int] = reactive(0)   # 0 = S-1, 1 = T-8
    bpm:           reactive[int] = reactive(120)

    s1_genre_idx:   reactive[int] = reactive(0)
    s1_pattern_idx: reactive[int] = reactive(0)
    s1_key_idx:     reactive[int] = reactive(KEY_NAMES.index(DEFAULT_KEY))
    s1_octave:      reactive[int] = reactive(DEFAULT_OCTAVE)
    s1_step:        reactive[int] = reactive(-1)
    s1_connected:   reactive[bool] = reactive(False)

    t8_genre_idx:   reactive[int] = reactive(0)
    t8_pattern_idx: reactive[int] = reactive(0)
    t8_key_idx:     reactive[int] = reactive(KEY_NAMES.index(DEFAULT_KEY))
    t8_octave:      reactive[int] = reactive(DEFAULT_OCTAVE)
    t8_step:        reactive[int] = reactive(-1)
    t8_connected:   reactive[bool] = reactive(False)

    def __init__(self, bpm: int = 120,
                 s1_genre: str = "techno",   s1_pattern: int = 1,
                 s1_key: str = DEFAULT_KEY,  s1_octave: int = DEFAULT_OCTAVE,
                 t8_genre: str = "techno",   t8_pattern: int = 1,
                 t8_key: str = DEFAULT_KEY,  t8_octave: int = DEFAULT_OCTAVE):
        super().__init__()
        self.bpm          = bpm
        self.s1_genre_idx   = GENRE_NAMES.index(s1_genre) if s1_genre in GENRE_NAMES else 0
        self.s1_pattern_idx = s1_pattern - 1
        self.s1_key_idx     = KEY_NAMES.index(s1_key) if s1_key in KEY_NAMES else KEY_NAMES.index(DEFAULT_KEY)
        self.s1_octave      = s1_octave
        self.t8_genre_idx   = T8_GENRE_NAMES.index(t8_genre) if t8_genre in T8_GENRE_NAMES else 0
        self.t8_pattern_idx = t8_pattern - 1
        self.t8_key_idx     = KEY_NAMES.index(t8_key) if t8_key in KEY_NAMES else KEY_NAMES.index(DEFAULT_KEY)
        self.t8_octave      = t8_octave
        self._scanner: DeviceScanner | None = None
        # Tracks what is actually playing (committed to scanner)
        self._s1_committed = dict(genre=self.s1_genre_idx, pattern=self.s1_pattern_idx,
                                  key=self.s1_key_idx, octave=self.s1_octave)
        self._t8_committed = dict(genre=self.t8_genre_idx, pattern=self.t8_pattern_idx,
                                  key=self.t8_key_idx, octave=self.t8_octave)

    # ── Helpers ─────────────────────────────────────────────────────────────

    def _s1_genre(self) -> str:
        return GENRE_NAMES[self.s1_genre_idx]

    def _t8_genre(self) -> str:
        return T8_GENRE_NAMES[self.t8_genre_idx]

    def _s1_root(self) -> int:
        return parse_key(KEY_NAMES[self.s1_key_idx], self.s1_octave)

    def _t8_root(self) -> int:
        return parse_key(KEY_NAMES[self.t8_key_idx], self.t8_octave)

    def _s1_pattern(self):
        return get_pattern(self._s1_genre(), self.s1_pattern_idx + 1)

    def _t8_drum(self):
        return get_t8_drum_pattern(self._t8_genre(), self.t8_pattern_idx + 1)

    def _t8_bass(self):
        bass, _desc = get_t8_bass_pattern(self._t8_genre())
        return bass

    # ── Lifecycle ────────────────────────────────────────────────────────────

    def compose(self) -> ComposeResult:
        with Horizontal(id="body"):
            yield S1Panel(id="s1-panel")
            yield T8Panel(id="t8-panel")
        yield Footer()

    def on_mount(self) -> None:
        self._scanner = DeviceScanner(
            bpm=self.bpm,
            s1_pattern=self._s1_pattern(),
            s1_root=self._s1_root(),
            t8_drum_pattern=self._t8_drum(),
            t8_bass_pattern=self._t8_bass(),
            t8_bass_root=self._t8_root(),
            s1_step_callback=lambda i: self.call_from_thread(self._on_s1_step, i),
            t8_step_callback=lambda i: self.call_from_thread(self._on_t8_step, i),
            connected_callback=self._on_connected,
        )
        self._refresh_s1_ui()
        self._refresh_t8_ui()
        self._refresh_panel_focus()
        self.set_interval(0.5, self._poll)

    def _poll(self) -> None:
        if self._scanner:
            self._scanner.tick()

    def _on_s1_step(self, idx: int) -> None:
        self.s1_step = idx

    def _on_t8_step(self, idx: int) -> None:
        self.t8_step = idx

    def _on_connected(self, name: str, state: bool) -> None:
        if name == "S-1":
            self.s1_connected = state
            if not state:
                self.s1_step = -1
        elif name == "T-8":
            self.t8_connected = state
            if not state:
                self.t8_step = -1
        self._refresh_s1_ui()
        self._refresh_t8_ui()

    async def on_unmount(self) -> None:
        if self._scanner:
            self._scanner.shutdown()

    # ── UI refresh ───────────────────────────────────────────────────────────

    def _status_text(self, connected: bool, label: str) -> Text:
        t = Text()
        t.append(f"{label}  ", style="bold white")
        if connected:
            t.append("● CONNECTED", style="bold #3fb950")
        else:
            t.append("○ not connected", style=_DIM)
        return t

    def _refresh_s1_ui(self) -> None:
        genre   = self._s1_genre()
        pat_idx = self.s1_pattern_idx
        name, desc, _ = GENRES[genre][pat_idx]
        key_str = f"{KEY_NAMES[self.s1_key_idx]}{self.s1_octave}"

        self.query_one("#s1-header", Static).update(
            self._status_text(self.s1_connected, "S-1  synth")
        )
        info = Text()
        info.append(f"genre    ", style=_DIM)
        info.append(f"{genre}\n", style="white")
        info.append(f"pattern  ", style=_DIM)
        info.append(f"#{pat_idx + 1}  ", style="white")
        info.append(f"{name}\n", style="#58a6ff")
        info.append(f'         "{desc}"\n', style=_DIM)
        info.append(f"key      ", style=_DIM)
        info.append(key_str, style="white")
        if self._s1_pending():
            info.append("   ↵ apply", style=f"bold {_ACCENT}")
        self.query_one("#s1-info", Static).update(info)

        grid = self.query_one("#s1-grid", StepGrid)
        grid.set_pattern(self._s1_pattern())

    def _refresh_t8_ui(self) -> None:
        genre   = self._t8_genre()
        pat_idx = self.t8_pattern_idx
        d_name, d_desc, _ = T8_DRUMS[genre][pat_idx]
        _bass, b_desc = get_t8_bass_pattern(genre)
        key_str = f"{KEY_NAMES[self.t8_key_idx]}{self.t8_octave}"

        self.query_one("#t8-header", Static).update(
            self._status_text(self.t8_connected, "T-8  drums+bass")
        )
        info = Text()
        info.append(f"genre    ", style=_DIM)
        info.append(f"{genre}\n", style="white")
        info.append(f"drums    ", style=_DIM)
        info.append(f"#{pat_idx + 1}  ", style="white")
        info.append(f"{d_name}\n", style="#58a6ff")
        info.append(f'         "{d_desc}"\n', style=_DIM)
        info.append(f"bass     ", style=_DIM)
        info.append(f'"{b_desc}"\n', style=_DIM)
        info.append(f"key      ", style=_DIM)
        info.append(key_str, style="white")
        if self._t8_pending():
            info.append("   ↵ apply", style=f"bold {_ACCENT}")
        self.query_one("#t8-info", Static).update(info)

        grid = self.query_one("#t8-grid", DrumGrid)
        grid.set_patterns(self._t8_drum(), self._t8_bass())

    def _refresh_panel_focus(self) -> None:
        self.query_one("#s1-panel", S1Panel).focused_panel = (self.focused_panel == 0)
        self.query_one("#t8-panel", T8Panel).focused_panel = (self.focused_panel == 1)

    # ── Reactive watchers ────────────────────────────────────────────────────

    def watch_s1_step(self, val: int) -> None:
        self.query_one("#s1-grid", StepGrid).current_step = val

    def watch_t8_step(self, val: int) -> None:
        self.query_one("#t8-grid", DrumGrid).current_step = val

    def watch_focused_panel(self, _: int) -> None:
        self._refresh_panel_focus()

    # ── Scanner update helpers ───────────────────────────────────────────────

    def _s1_pending(self) -> bool:
        c = self._s1_committed
        return (c["genre"] != self.s1_genre_idx or c["pattern"] != self.s1_pattern_idx
                or c["key"] != self.s1_key_idx or c["octave"] != self.s1_octave)

    def _t8_pending(self) -> bool:
        c = self._t8_committed
        return (c["genre"] != self.t8_genre_idx or c["pattern"] != self.t8_pattern_idx
                or c["key"] != self.t8_key_idx or c["octave"] != self.t8_octave)

    def _push_s1(self) -> None:
        self._s1_committed = dict(genre=self.s1_genre_idx, pattern=self.s1_pattern_idx,
                                  key=self.s1_key_idx, octave=self.s1_octave)
        self._refresh_s1_ui()
        if self._scanner:
            self._scanner.update_s1(self._s1_pattern(), self._s1_root())

    def _push_t8(self) -> None:
        self._t8_committed = dict(genre=self.t8_genre_idx, pattern=self.t8_pattern_idx,
                                  key=self.t8_key_idx, octave=self.t8_octave)
        self._refresh_t8_ui()
        if self._scanner:
            self._scanner.update_t8(self._t8_drum(), self._t8_bass(), self._t8_root())

    # ── Actions ──────────────────────────────────────────────────────────────

    def action_next_panel(self) -> None:
        self.focused_panel = 1 - self.focused_panel

    def action_prev_genre(self) -> None:
        if self.focused_panel == 0:
            self.s1_genre_idx = (self.s1_genre_idx - 1) % len(GENRE_NAMES)
            self._refresh_s1_ui()
        else:
            self.t8_genre_idx = (self.t8_genre_idx - 1) % len(T8_GENRE_NAMES)
            self._refresh_t8_ui()

    def action_next_genre(self) -> None:
        if self.focused_panel == 0:
            self.s1_genre_idx = (self.s1_genre_idx + 1) % len(GENRE_NAMES)
            self._refresh_s1_ui()
        else:
            self.t8_genre_idx = (self.t8_genre_idx + 1) % len(T8_GENRE_NAMES)
            self._refresh_t8_ui()

    def action_prev_pattern(self) -> None:
        if self.focused_panel == 0:
            self.s1_pattern_idx = (self.s1_pattern_idx - 1) % 10
            self._refresh_s1_ui()
        else:
            self.t8_pattern_idx = (self.t8_pattern_idx - 1) % 10
            self._refresh_t8_ui()

    def action_next_pattern(self) -> None:
        if self.focused_panel == 0:
            self.s1_pattern_idx = (self.s1_pattern_idx + 1) % 10
            self._refresh_s1_ui()
        else:
            self.t8_pattern_idx = (self.t8_pattern_idx + 1) % 10
            self._refresh_t8_ui()

    def action_prev_key(self) -> None:
        if self.focused_panel == 0:
            self.s1_key_idx = (self.s1_key_idx - 1) % len(KEY_NAMES)
            self._refresh_s1_ui()
        else:
            self.t8_key_idx = (self.t8_key_idx - 1) % len(KEY_NAMES)
            self._refresh_t8_ui()

    def action_next_key(self) -> None:
        if self.focused_panel == 0:
            self.s1_key_idx = (self.s1_key_idx + 1) % len(KEY_NAMES)
            self._refresh_s1_ui()
        else:
            self.t8_key_idx = (self.t8_key_idx + 1) % len(KEY_NAMES)
            self._refresh_t8_ui()

    def action_prev_octave(self) -> None:
        if self.focused_panel == 0:
            self.s1_octave = max(OCTAVE_MIN, self.s1_octave - 1)
            self._refresh_s1_ui()
        else:
            self.t8_octave = max(OCTAVE_MIN, self.t8_octave - 1)
            self._refresh_t8_ui()

    def action_next_octave(self) -> None:
        if self.focused_panel == 0:
            self.s1_octave = min(OCTAVE_MAX, self.s1_octave + 1)
            self._refresh_s1_ui()
        else:
            self.t8_octave = min(OCTAVE_MAX, self.t8_octave + 1)
            self._refresh_t8_ui()

    def action_commit(self) -> None:
        if self.focused_panel == 0:
            self._push_s1()
        else:
            self._push_t8()

    def action_bpm_up(self) -> None:
        new = min(300, self.bpm + 5)
        if new != self.bpm:
            self.bpm = new
            if self._scanner:
                self._scanner.update_bpm(new)
            self.sub_title = f"{self.bpm} BPM"

    def action_bpm_down(self) -> None:
        new = max(20, self.bpm - 5)
        if new != self.bpm:
            self.bpm = new
            if self._scanner:
                self._scanner.update_bpm(new)
            self.sub_title = f"{self.bpm} BPM"


def run_ui(bpm=120, s1_genre="techno", s1_pattern=1, s1_key=DEFAULT_KEY, s1_octave=DEFAULT_OCTAVE,
           t8_genre="techno", t8_pattern=1, t8_key=DEFAULT_KEY, t8_octave=DEFAULT_OCTAVE) -> None:
    app = MpumpApp(
        bpm=bpm,
        s1_genre=s1_genre, s1_pattern=s1_pattern, s1_key=s1_key, s1_octave=s1_octave,
        t8_genre=t8_genre, t8_pattern=t8_pattern, t8_key=t8_key, t8_octave=t8_octave,
    )
    app.title = "mpump"
    app.sub_title = f"{bpm} BPM"
    app.run()
