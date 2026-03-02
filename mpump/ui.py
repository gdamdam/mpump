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
from .patterns_t8 import T8_BASS, T8_DRUMS, T8_GENRE_NAMES, get_t8_bass_pattern, get_t8_drum_pattern
from .patterns_j6 import J6_CHORD_SETS, J6_GENRE_NAMES, J6_GENRES, get_j6_chord_set, get_j6_pattern
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


class BeatWidget(Widget):
    """4-beat dot + 16-step waveform bar showing playback position."""

    current_step: reactive[int] = reactive(-1)

    _WAVE = "▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂"   # 16 chars, one per step

    def render(self) -> Text:
        step = self.current_step
        beat = step // 4 if step >= 0 else -1
        t = Text()

        # ── 4 quarter-beat dots ─────────────────────────────────────
        for i in range(4):
            if i > 0:
                t.append("  ")
            if i == beat:
                t.append("●", style="bold #58a6ff")
            else:
                t.append("○", style="#4a5060")

        # ── 16-step waveform bar ────────────────────────────────────
        t.append("    ")
        if step < 0:
            t.append(self._WAVE, style="#2a2f38")
            t.append("  ─ not playing", style="#4a5060")
        else:
            for i, ch in enumerate(self._WAVE):
                if i == step:
                    t.append(ch, style="bold #58a6ff")
                elif i < step:
                    t.append(ch, style="#2a4a6a")
                else:
                    t.append(ch, style="#2a2f38")

        return t

    def watch_current_step(self, _: int) -> None:
        self.refresh()


class S1Panel(DevicePanel):
    """Left panel: S-1 melodic sequencer."""

    def compose(self) -> ComposeResult:
        yield Static("", id="s1-header")
        yield Static("", id="s1-now")
        yield BeatWidget(id="s1-beat")
        yield Static("", id="s1-info")
        yield StepGrid(id="s1-grid")


class T8Panel(DevicePanel):
    """Right panel: T-8 drum + bass sequencer."""

    def compose(self) -> ComposeResult:
        yield Static("", id="t8-header")
        yield Static("", id="t8-now")
        yield BeatWidget(id="t8-beat")
        yield Static("", id="t8-info")
        yield DrumGrid(id="t8-grid")


class J6Panel(DevicePanel):
    """Third panel: J-6 chord synthesizer."""

    def compose(self) -> ComposeResult:
        yield Static("", id="j6-header")
        yield Static("", id="j6-now")
        yield BeatWidget(id="j6-beat")
        yield Static("", id="j6-info")
        yield StepGrid(id="j6-grid")


# ─────────────────────────────────────────────────────────────────────────────
# Main app
# ─────────────────────────────────────────────────────────────────────────────

class MpumpApp(App):

    ENABLE_COMMAND_PALETTE = False

    CSS = """
    Screen {
        background: #0d1117;
    }

    #topbar {
        height: 3;
        background: #161b22;
        border-bottom: solid #21262d;
        layout: horizontal;
    }

    #topbar-title {
        width: 1fr;
        padding: 1 2;
    }

    #topbar-bpm {
        width: auto;
        padding: 1 2;
        text-align: right;
    }

    #s1-now, #t8-now, #j6-now {
        margin-bottom: 0;
        padding: 0 0 0 0;
    }

    BeatWidget {
        height: 1;
        margin-top: 1;
        margin-bottom: 1;
    }

    #body {
        height: 1fr;
    }

    S1Panel, T8Panel, J6Panel {
        border: solid #21262d;
        padding: 1 2;
        width: 1fr;
    }

    S1Panel.focused, T8Panel.focused, J6Panel.focused {
        border: solid #58a6ff;
    }

    #s1-header, #t8-header, #j6-header {
        text-style: bold;
        margin-bottom: 1;
    }

    #s1-info, #t8-info, #j6-info {
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
        Binding("q",      "quit",         "Quit"),
        Binding("tab",    "next_panel",   "Tab ⇄ switch",  priority=True),
        Binding("left",   "prev_genre",   "← genre",       priority=True),
        Binding("right",  "next_genre",   "→ genre",        priority=True),
        Binding("up",     "next_pattern", "↑ pattern",      priority=True),
        Binding("down",   "prev_pattern", "↓ pattern",      priority=True),
        Binding("space",  "toggle_device", "Space ▶/■",      priority=True),
        Binding("k",      "prev_key",     "k key ↓"),
        Binding("K",      "next_key",     "K key ↑"),
        Binding("o",      "prev_octave",  "o oct ↓"),
        Binding("O",      "next_octave",  "O oct ↑"),
        Binding("equal",  "bpm_up",       "+ BPM"),
        Binding("minus",  "bpm_down",     "- BPM"),
        Binding("enter",  "commit",       "↵ apply",        priority=True),
    ]

    # ── Reactive state ──────────────────────────────────────────────────────
    focused_panel: reactive[int] = reactive(0)   # 0 = S-1, 1 = T-8, 2 = J-6
    bpm:           reactive[int] = reactive(120)

    s1_genre_idx:   reactive[int]  = reactive(0)
    s1_pattern_idx: reactive[int]  = reactive(0)
    s1_key_idx:     reactive[int]  = reactive(KEY_NAMES.index(DEFAULT_KEY))
    s1_octave:      reactive[int]  = reactive(DEFAULT_OCTAVE)
    s1_step:        reactive[int]  = reactive(-1)
    s1_connected:   reactive[bool] = reactive(False)
    s1_paused:      reactive[bool] = reactive(False)

    t8_genre_idx:        reactive[int]  = reactive(0)
    t8_pattern_idx:      reactive[int]  = reactive(0)
    t8_bass_pattern_idx: reactive[int]  = reactive(0)
    t8_key_idx:          reactive[int]  = reactive(KEY_NAMES.index(DEFAULT_KEY))
    t8_octave:           reactive[int]  = reactive(DEFAULT_OCTAVE)
    t8_step:             reactive[int]  = reactive(-1)
    t8_connected:        reactive[bool] = reactive(False)
    t8_paused:           reactive[bool] = reactive(False)

    j6_genre_idx:   reactive[int]  = reactive(0)
    j6_pattern_idx: reactive[int]  = reactive(0)
    j6_step:        reactive[int]  = reactive(-1)
    j6_connected:   reactive[bool] = reactive(False)
    j6_paused:      reactive[bool] = reactive(False)

    def __init__(self, bpm: int = 120,
                 s1_genre: str = "techno",   s1_pattern: int = 1,
                 s1_key: str = DEFAULT_KEY,  s1_octave: int = DEFAULT_OCTAVE,
                 t8_genre: str = "techno",   t8_pattern: int = 1,  t8_bass_pattern: int = 1,
                 t8_key: str = DEFAULT_KEY,  t8_octave: int = DEFAULT_OCTAVE,
                 j6_genre: str = "techno",   j6_pattern: int = 1):
        super().__init__()
        self.bpm                 = bpm
        self.s1_genre_idx        = GENRE_NAMES.index(s1_genre) if s1_genre in GENRE_NAMES else 0
        self.s1_pattern_idx      = s1_pattern - 1
        self.s1_key_idx          = KEY_NAMES.index(s1_key) if s1_key in KEY_NAMES else KEY_NAMES.index(DEFAULT_KEY)
        self.s1_octave           = s1_octave
        self.t8_genre_idx        = T8_GENRE_NAMES.index(t8_genre) if t8_genre in T8_GENRE_NAMES else 0
        self.t8_pattern_idx      = t8_pattern - 1
        self.t8_bass_pattern_idx = t8_bass_pattern - 1
        self.t8_key_idx          = KEY_NAMES.index(t8_key) if t8_key in KEY_NAMES else KEY_NAMES.index(DEFAULT_KEY)
        self.t8_octave           = t8_octave
        self.j6_genre_idx        = J6_GENRE_NAMES.index(j6_genre) if j6_genre in J6_GENRE_NAMES else 0
        self.j6_pattern_idx      = j6_pattern - 1
        self._scanner: DeviceScanner | None = None
        # Tracks what is actually playing (committed to scanner)
        self._s1_committed = dict(genre=self.s1_genre_idx, pattern=self.s1_pattern_idx,
                                  key=self.s1_key_idx, octave=self.s1_octave)
        self._t8_committed = dict(genre=self.t8_genre_idx, drum_pattern=self.t8_pattern_idx,
                                  bass_pattern=self.t8_bass_pattern_idx,
                                  key=self.t8_key_idx, octave=self.t8_octave)
        self._j6_committed = dict(genre=self.j6_genre_idx, pattern=self.j6_pattern_idx)

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
        bass, _desc = get_t8_bass_pattern(self._t8_genre(), self.t8_bass_pattern_idx + 1)
        return bass

    def _j6_genre(self) -> str:
        return J6_GENRE_NAMES[self.j6_genre_idx]

    def _j6_pattern(self):
        return get_j6_pattern(self._j6_genre(), self.j6_pattern_idx + 1)

    def _j6_pc(self) -> int:
        return get_j6_chord_set(self._j6_genre()) - 1

    # ── Lifecycle ────────────────────────────────────────────────────────────

    def compose(self) -> ComposeResult:
        with Horizontal(id="topbar"):
            yield Static("mpump", id="topbar-title")
            yield Static("", id="topbar-bpm")
        with Horizontal(id="body"):
            yield S1Panel(id="s1-panel")
            yield T8Panel(id="t8-panel")
            yield J6Panel(id="j6-panel")
        yield Footer()

    def _refresh_topbar(self) -> None:
        t = Text()
        t.append("♩ ", style=_DIM)
        t.append(f"{self.bpm}", style="bold #58a6ff")
        t.append(" BPM", style=_DIM)
        self.query_one("#topbar-bpm", Static).update(t)

    def on_mount(self) -> None:
        self._scanner = DeviceScanner(
            bpm=self.bpm,
            s1_pattern=self._s1_pattern(),
            s1_root=self._s1_root(),
            t8_drum_pattern=self._t8_drum(),
            t8_bass_pattern=self._t8_bass(),
            t8_bass_root=self._t8_root(),
            j6_pattern=self._j6_pattern(),
            j6_program_change=self._j6_pc(),
            s1_step_callback=lambda i: self.call_from_thread(self._on_s1_step, i),
            t8_step_callback=lambda i: self.call_from_thread(self._on_t8_step, i),
            j6_step_callback=lambda i: self.call_from_thread(self._on_j6_step, i),
            connected_callback=self._on_connected,
        )
        self.call_after_refresh(self._refresh_topbar)
        self.call_after_refresh(self._refresh_s1_ui)
        self.call_after_refresh(self._refresh_t8_ui)
        self.call_after_refresh(self._refresh_j6_ui)
        self.call_after_refresh(self._refresh_panel_focus)
        self.set_interval(0.5, self._poll)

    def _poll(self) -> None:
        if self._scanner:
            self._scanner.tick()

    def _on_s1_step(self, idx: int) -> None:
        self.s1_step = idx

    def _on_t8_step(self, idx: int) -> None:
        self.t8_step = idx

    def _on_j6_step(self, idx: int) -> None:
        self.j6_step = idx

    def _on_connected(self, name: str, state: bool) -> None:
        if name == "S-1":
            self.s1_connected = state
            if not state:
                self.s1_step = -1
                self.s1_paused = False
        elif name == "T-8":
            self.t8_connected = state
            if not state:
                self.t8_step = -1
                self.t8_paused = False
        elif name == "J-6":
            self.j6_connected = state
            if not state:
                self.j6_step = -1
                self.j6_paused = False
        self._refresh_s1_ui()
        self._refresh_t8_ui()
        self._refresh_j6_ui()

    async def on_unmount(self) -> None:
        if self._scanner:
            self._scanner.shutdown()

    # ── UI refresh ───────────────────────────────────────────────────────────

    def _status_text(self, connected: bool, label: str, paused: bool = False) -> Text:
        t = Text()
        t.append(f"{label}  ", style="bold white")
        if paused:
            t.append("■ paused", style=f"bold {_ACCENT}")
        elif connected:
            t.append("● CONNECTED", style="bold #3fb950")
        else:
            t.append("○ not connected", style=_DIM)
        return t

    def _refresh_s1_ui(self) -> None:
        # Committed (now playing)
        c = self._s1_committed
        c_genre   = GENRE_NAMES[c["genre"]]
        c_name, _c_desc, _ = GENRES[c_genre][c["pattern"]]
        c_key = f"{KEY_NAMES[c['key']]}{c['octave']}"
        now = Text()
        now.append("■ " if self.s1_paused else "▶ ", style=f"bold {_ACCENT if self.s1_paused else _NOTE}")
        now.append(f"{c_genre}  ", style="white")
        now.append(f"#{c['pattern'] + 1}  ", style=_DIM)
        now.append(f"{c_name}  ", style="bold white")
        now.append(f"·  {c_key}", style=_DIM)
        self.query_one("#s1-header", Static).update(
            self._status_text(self.s1_connected, "S-1  synth", paused=self.s1_paused)
        )
        self.query_one("#s1-now", Static).update(now)

        # Selection (browsing)
        genre   = self._s1_genre()
        pat_idx = self.s1_pattern_idx
        name, desc, _ = GENRES[genre][pat_idx]
        key_str = f"{KEY_NAMES[self.s1_key_idx]}{self.s1_octave}"
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
        # Committed (now playing)
        c = self._t8_committed
        c_genre  = T8_GENRE_NAMES[c["genre"]]
        c_dname, _c_ddesc, _ = T8_DRUMS[c_genre][c["drum_pattern"]]
        c_bname  = T8_BASS[c_genre][c["bass_pattern"]][0]
        c_key    = f"{KEY_NAMES[c['key']]}{c['octave']}"
        now = Text()
        now.append("■ " if self.t8_paused else "▶ ", style=f"bold {_ACCENT if self.t8_paused else _NOTE}")
        now.append(f"{c_genre}  ", style="white")
        now.append(f"drums #{c['drum_pattern'] + 1} {c_dname}  ", style="bold white")
        now.append(f"·  bass #{c['bass_pattern'] + 1} {c_bname}  ", style="bold white")
        now.append(f"·  {c_key}", style=_DIM)
        self.query_one("#t8-header", Static).update(
            self._status_text(self.t8_connected, "T-8  drums+bass", paused=self.t8_paused)
        )
        self.query_one("#t8-now", Static).update(now)

        # Selection (browsing)
        genre       = self._t8_genre()
        d_idx       = self.t8_pattern_idx
        b_idx       = self.t8_bass_pattern_idx
        d_name, d_desc, _ = T8_DRUMS[genre][d_idx]
        b_name, b_desc, _ = T8_BASS[genre][b_idx]
        key_str     = f"{KEY_NAMES[self.t8_key_idx]}{self.t8_octave}"
        info = Text()
        info.append(f"genre    ", style=_DIM)
        info.append(f"{genre}\n", style="white")
        info.append(f"drums ↑↓ ", style=_DIM)
        info.append(f"#{d_idx + 1}  ", style="white")
        info.append(f"{d_name}\n", style="#58a6ff")
        info.append(f'         "{d_desc}"\n', style=_DIM)
        info.append(f"bass  ⇧↑↓", style=_DIM)
        info.append(f" #{b_idx + 1}  ", style="white")
        info.append(f"{b_name}\n", style="#58a6ff")
        info.append(f'         "{b_desc}"\n', style=_DIM)
        info.append(f"key      ", style=_DIM)
        info.append(key_str, style="white")
        if self._t8_pending():
            info.append("   ↵ apply", style=f"bold {_ACCENT}")
        self.query_one("#t8-info", Static).update(info)

        grid = self.query_one("#t8-grid", DrumGrid)
        grid.set_patterns(self._t8_drum(), self._t8_bass())

    def _refresh_j6_ui(self) -> None:
        # Committed (now playing)
        c = self._j6_committed
        c_genre  = J6_GENRE_NAMES[c["genre"]]
        c_name, _c_desc, _ = J6_GENRES[c_genre][c["pattern"]]
        c_cs = J6_CHORD_SETS[c_genre]
        now = Text()
        now.append("■ " if self.j6_paused else "▶ ", style=f"bold {_ACCENT if self.j6_paused else _NOTE}")
        now.append(f"{c_genre}  ", style="white")
        now.append(f"#{c['pattern'] + 1}  ", style=_DIM)
        now.append(f"{c_name}  ", style="bold white")
        now.append(f"·  set #{c_cs}", style=_DIM)
        self.query_one("#j6-header", Static).update(
            self._status_text(self.j6_connected, "J-6  chords", paused=self.j6_paused)
        )
        self.query_one("#j6-now", Static).update(now)

        # Selection (browsing)
        genre   = self._j6_genre()
        pat_idx = self.j6_pattern_idx
        name, desc, pattern = J6_GENRES[genre][pat_idx]
        cs = J6_CHORD_SETS[genre]
        info = Text()
        info.append(f"genre    ", style=_DIM)
        info.append(f"{genre}\n", style="white")
        info.append(f"pattern  ", style=_DIM)
        info.append(f"#{pat_idx + 1}  ", style="white")
        info.append(f"{name}\n", style="#58a6ff")
        info.append(f'         "{desc}"\n', style=_DIM)
        info.append(f"set      ", style=_DIM)
        info.append(f"#{cs}", style="white")
        if self._j6_pending():
            info.append("   ↵ apply", style=f"bold {_ACCENT}")
        self.query_one("#j6-info", Static).update(info)

        self.query_one("#j6-grid", StepGrid).set_pattern(pattern)

    def _refresh_panel_focus(self) -> None:
        self.query_one("#s1-panel", S1Panel).focused_panel = (self.focused_panel == 0)
        self.query_one("#t8-panel", T8Panel).focused_panel = (self.focused_panel == 1)
        self.query_one("#j6-panel", J6Panel).focused_panel = (self.focused_panel == 2)

    # ── Reactive watchers ────────────────────────────────────────────────────

    def watch_s1_step(self, val: int) -> None:
        self.query_one("#s1-grid", StepGrid).current_step = val
        self.query_one("#s1-beat", BeatWidget).current_step = val

    def watch_t8_step(self, val: int) -> None:
        self.query_one("#t8-grid", DrumGrid).current_step = val
        self.query_one("#t8-beat", BeatWidget).current_step = val

    def watch_j6_step(self, val: int) -> None:
        self.query_one("#j6-grid", StepGrid).current_step = val
        self.query_one("#j6-beat", BeatWidget).current_step = val

    def watch_focused_panel(self, _: int) -> None:
        self._refresh_panel_focus()

    # ── Scanner update helpers ───────────────────────────────────────────────

    def _s1_pending(self) -> bool:
        c = self._s1_committed
        return c["pattern"] != self.s1_pattern_idx or c["genre"] != self.s1_genre_idx

    def _t8_pending(self) -> bool:
        c = self._t8_committed
        return (c["drum_pattern"] != self.t8_pattern_idx
                or c["bass_pattern"] != self.t8_bass_pattern_idx
                or c["genre"] != self.t8_genre_idx)

    def _j6_pending(self) -> bool:
        c = self._j6_committed
        return c["pattern"] != self.j6_pattern_idx or c["genre"] != self.j6_genre_idx

    def _push_s1(self) -> None:
        self._s1_committed = dict(genre=self.s1_genre_idx, pattern=self.s1_pattern_idx,
                                  key=self.s1_key_idx, octave=self.s1_octave)
        self._refresh_topbar()
        self._refresh_s1_ui()
        if self._scanner:
            self._scanner.update_s1(self._s1_pattern(), self._s1_root())

    def _push_t8(self) -> None:
        self._t8_committed = dict(genre=self.t8_genre_idx, drum_pattern=self.t8_pattern_idx,
                                  bass_pattern=self.t8_bass_pattern_idx,
                                  key=self.t8_key_idx, octave=self.t8_octave)
        self._refresh_topbar()
        self._refresh_t8_ui()
        if self._scanner:
            self._scanner.update_t8(self._t8_drum(), self._t8_bass(), self._t8_root())

    def _push_j6(self) -> None:
        self._j6_committed = dict(genre=self.j6_genre_idx, pattern=self.j6_pattern_idx)
        self._refresh_j6_ui()
        if self._scanner:
            self._scanner.update_j6(self._j6_pattern(), self._j6_pc())

    # ── Actions ──────────────────────────────────────────────────────────────

    def action_next_panel(self) -> None:
        self.focused_panel = (self.focused_panel + 1) % 3

    def action_prev_genre(self) -> None:
        if self.focused_panel == 0:
            self.s1_genre_idx = (self.s1_genre_idx - 1) % len(GENRE_NAMES)
            self._refresh_s1_ui()
        elif self.focused_panel == 1:
            self.t8_genre_idx = (self.t8_genre_idx - 1) % len(T8_GENRE_NAMES)
            self._refresh_t8_ui()
        else:
            self.j6_genre_idx = (self.j6_genre_idx - 1) % len(J6_GENRE_NAMES)
            self._refresh_j6_ui()

    def action_next_genre(self) -> None:
        if self.focused_panel == 0:
            self.s1_genre_idx = (self.s1_genre_idx + 1) % len(GENRE_NAMES)
            self._refresh_s1_ui()
        elif self.focused_panel == 1:
            self.t8_genre_idx = (self.t8_genre_idx + 1) % len(T8_GENRE_NAMES)
            self._refresh_t8_ui()
        else:
            self.j6_genre_idx = (self.j6_genre_idx + 1) % len(J6_GENRE_NAMES)
            self._refresh_j6_ui()

    def action_prev_pattern(self) -> None:
        if self.focused_panel == 0:
            self.s1_pattern_idx = (self.s1_pattern_idx - 1) % 10
            self._refresh_s1_ui()
        elif self.focused_panel == 1:
            self.t8_pattern_idx = (self.t8_pattern_idx - 1) % 10
            self._refresh_t8_ui()
        else:
            self.j6_pattern_idx = (self.j6_pattern_idx - 1) % 10
            self._refresh_j6_ui()

    def action_next_pattern(self) -> None:
        if self.focused_panel == 0:
            self.s1_pattern_idx = (self.s1_pattern_idx + 1) % 10
            self._refresh_s1_ui()
        elif self.focused_panel == 1:
            self.t8_pattern_idx = (self.t8_pattern_idx + 1) % 10
            self._refresh_t8_ui()
        else:
            self.j6_pattern_idx = (self.j6_pattern_idx + 1) % 10
            self._refresh_j6_ui()

    def action_bass_next(self) -> None:
        if self.focused_panel == 1:
            self.t8_bass_pattern_idx = (self.t8_bass_pattern_idx + 1) % 10
            self._refresh_t8_ui()

    def action_bass_prev(self) -> None:
        if self.focused_panel == 1:
            self.t8_bass_pattern_idx = (self.t8_bass_pattern_idx - 1) % 10
            self._refresh_t8_ui()

    def action_prev_key(self) -> None:
        if self.focused_panel == 0:
            self.s1_key_idx = (self.s1_key_idx - 1) % len(KEY_NAMES)
            self._push_s1()
        elif self.focused_panel == 1:
            self.t8_key_idx = (self.t8_key_idx - 1) % len(KEY_NAMES)
            self._push_t8()
        # J-6: root is always C4=60, key/octave not applicable

    def action_next_key(self) -> None:
        if self.focused_panel == 0:
            self.s1_key_idx = (self.s1_key_idx + 1) % len(KEY_NAMES)
            self._push_s1()
        elif self.focused_panel == 1:
            self.t8_key_idx = (self.t8_key_idx + 1) % len(KEY_NAMES)
            self._push_t8()

    def action_prev_octave(self) -> None:
        if self.focused_panel == 0:
            self.s1_octave = max(OCTAVE_MIN, self.s1_octave - 1)
            self._push_s1()
        elif self.focused_panel == 1:
            self.t8_octave = max(OCTAVE_MIN, self.t8_octave - 1)
            self._push_t8()

    def action_next_octave(self) -> None:
        if self.focused_panel == 0:
            self.s1_octave = min(OCTAVE_MAX, self.s1_octave + 1)
            self._push_s1()
        elif self.focused_panel == 1:
            self.t8_octave = min(OCTAVE_MAX, self.t8_octave + 1)
            self._push_t8()

    def action_commit(self) -> None:
        if self.focused_panel == 0:
            self._push_s1()
        elif self.focused_panel == 1:
            self._push_t8()
        else:
            self._push_j6()

    def on_key(self, event) -> None:
        """Catch keys that need special handling across terminal emulators."""
        if event.character in ("=", "+"):
            self.action_bpm_up()
        elif event.key in ("shift+up", "shift+up"):
            self.action_bass_next()
            event.prevent_default()
        elif event.key == "shift+down":
            self.action_bass_prev()
            event.prevent_default()

    def action_toggle_device(self) -> None:
        panel_device = {0: ("S-1", "s1_paused"), 1: ("T-8", "t8_paused"), 2: ("J-6", "j6_paused")}
        name, attr = panel_device[self.focused_panel]
        if self._scanner:
            now_playing = self._scanner.toggle_device(name)
            setattr(self, attr, not now_playing)
            if not now_playing:
                # Clear step indicator when stopped
                step_attr = {"S-1": "s1_step", "T-8": "t8_step", "J-6": "j6_step"}[name]
                setattr(self, step_attr, -1)
        if self.focused_panel == 0:
            self._refresh_s1_ui()
        elif self.focused_panel == 1:
            self._refresh_t8_ui()
        else:
            self._refresh_j6_ui()

    def action_bpm_up(self) -> None:
        new = min(300, self.bpm + 5)
        if new != self.bpm:
            self.bpm = new
            if self._scanner:
                self._scanner.update_bpm(new)
            self._refresh_topbar()

    def action_bpm_down(self) -> None:
        new = max(20, self.bpm - 5)
        if new != self.bpm:
            self.bpm = new
            if self._scanner:
                self._scanner.update_bpm(new)
            self._refresh_topbar()


def run_ui(bpm=120, s1_genre="techno", s1_pattern=1, s1_key=DEFAULT_KEY, s1_octave=DEFAULT_OCTAVE,
           t8_genre="techno", t8_pattern=1, t8_bass_pattern=1, t8_key=DEFAULT_KEY, t8_octave=DEFAULT_OCTAVE,
           j6_genre="techno", j6_pattern=1) -> None:
    app = MpumpApp(
        bpm=bpm,
        s1_genre=s1_genre, s1_pattern=s1_pattern, s1_key=s1_key, s1_octave=s1_octave,
        t8_genre=t8_genre, t8_pattern=t8_pattern, t8_bass_pattern=t8_bass_pattern,
        t8_key=t8_key, t8_octave=t8_octave,
        j6_genre=j6_genre, j6_pattern=j6_pattern,
    )
    app.title = "mpump"
    app.sub_title = f"{bpm} BPM"
    app.run()
