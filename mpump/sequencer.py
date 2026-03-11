"""Per-device MIDI sequencer threads.

Each connected MIDI device gets its own daemon thread running a tight
step-loop.  Three classes:

  MidiClock       — sends 24-PPQN clock ticks for BPM-synced FX
  Sequencer       — 16/32-step melodic loop (S-1, J-6, synths)
  T8Sequencer     — combined drum + bass loop (T-8, drum machines)

Timing uses time.perf_counter() with absolute target timestamps to
avoid drift accumulation.  Sequencers align their first step to a
global t_start (bar boundary) so multiple devices stay phase-locked.
"""

import math
import threading
import time
import mido

from .patterns import Step
from .patterns_t8 import DrumStep


class MidiClock(threading.Thread):
    """Sends MIDI clock ticks (24 PPQN) to one device port for BPM sync.

    Sends only clock (0xF8) messages — no Start/Stop — so the device's
    internal sequencer is not triggered.  This syncs BPM-dependent
    effects (LFO, delay, arpeggiator) without conflicting with our
    own note-level sequencing.

    Opens its own port connection; macOS CoreMIDI allows multiple
    connections to the same endpoint from the same process.
    """

    PPQN = 24  # clocks per quarter note

    def __init__(self, port_match: str, bpm: int):
        super().__init__(daemon=True)
        self.name = f"clock:{port_match}"
        self._port_match = port_match
        self._bpm       = bpm
        self._stop_flag = threading.Event()
        self._lock      = threading.Lock()

    def set_bpm(self, bpm: int) -> None:
        with self._lock:
            self._bpm = bpm

    def stop(self) -> None:
        self._stop_flag.set()

    def run(self) -> None:
        try:
            port = mido.open_output(self._port_match)
        except OSError as e:
            print(f"[clock:{self._port_match}] Cannot open port: {e}")
            return

        clock = mido.Message("clock")
        print(f"[clock:{self._port_match}] Started")

        try:
            while not self._stop_flag.is_set():
                with self._lock:
                    bpm = self._bpm
                port.send(clock)
                self._stop_flag.wait(timeout=60.0 / (bpm * self.PPQN))
        finally:
            port.close()
            print(f"[clock:{self._port_match}] Stopped.")


class Sequencer(threading.Thread):
    """Runs a 16-step MIDI sequencer loop for one device in its own thread.

    Each step is either None (rest) or (semitone_offset, velocity_factor, slide).
    semitone_offset is relative to root_note.
    slide=True creates monosynth legato: the next note_on is sent before the
    current note_off so the synth glides between pitches.
    """

    def __init__(
        self,
        name: str,
        port_match: str,
        channel: int,
        pattern: list[Step],
        root_note: int,
        base_velocity: int = 100,
        note_fraction: float = 0.5,
        bpm: int = 120,
        step_callback=None,
        program_change: int | None = None,
        t_start: float | None = None,
    ):
        super().__init__(daemon=True)
        self.name = name
        self._port_match = port_match
        self._channel = channel
        self._pattern = pattern
        self._root_note = root_note
        self._base_velocity = base_velocity
        self._note_fraction = note_fraction
        self._stop_flag = threading.Event()
        self._step_callback = step_callback
        self._program_change = program_change
        self._t_start = t_start

        # One step = one 16th note
        self._step_dur = 60.0 / (bpm * 4)

    # ------------------------------------------------------------------
    # MIDI helpers
    # ------------------------------------------------------------------

    def _on(self, port, note: int, velocity: int) -> None:
        port.send(mido.Message("note_on", channel=self._channel,
                               note=note, velocity=velocity))

    def _off(self, port, note: int) -> None:
        port.send(mido.Message("note_off", channel=self._channel,
                               note=note, velocity=0))

    def _all_notes_off(self, port) -> None:
        port.send(mido.Message("control_change", channel=self._channel,
                               control=123, value=0))

    # ------------------------------------------------------------------
    # Thread entry point
    # ------------------------------------------------------------------

    def stop(self) -> None:
        self._stop_flag.set()

    def run(self) -> None:
        try:
            port = mido.open_output(self._port_match)
        except OSError as e:
            print(f"[{self.name}] Could not open port: {e}")
            return

        if self._program_change is not None:
            port.send(mido.Message("program_change", channel=self._channel,
                                   program=self._program_change))
            print(f"[{self.name}] PC → {self._program_change} "
                  f"(chord set #{self._program_change + 1})")

        print(f"[{self.name}] Started — ch{self._channel + 1} "
              f"root={self._root_note} steps={len(self._pattern)}")

        gate = self._step_dur * self._note_fraction
        rest = self._step_dur - gate

        step_idx = 0
        pending_off: int | None = None   # note awaiting note_off (slide carry)

        # Align first step to global clock grid
        if self._t_start is not None:
            delay = self._t_start - time.perf_counter()
            if delay > 0:
                self._stop_flag.wait(timeout=delay)
            t_next = self._t_start
        else:
            t_next = time.perf_counter()

        try:
            while not self._stop_flag.is_set():
                t_step_start = t_next
                if self._step_callback:
                    self._step_callback(step_idx)
                step: Step = self._pattern[step_idx]

                if step is None:
                    # Rest: release any sliding note immediately
                    if pending_off is not None:
                        self._off(port, pending_off)
                        pending_off = None

                else:
                    semitones, vel_factor, slide = step
                    note = max(0, min(127, self._root_note + semitones))
                    velocity = min(127, int(self._base_velocity * vel_factor))

                    if slide:
                        # Send note_on; carry note_off to next step for legato
                        if pending_off is not None and pending_off != note:
                            self._on(port, note, velocity)
                            self._off(port, pending_off)
                        else:
                            self._on(port, note, velocity)
                        pending_off = note
                    else:
                        # Normal: note_on then note_off within this step
                        if pending_off is not None:
                            self._on(port, note, velocity)
                            self._off(port, pending_off)
                            pending_off = None
                        else:
                            self._on(port, note, velocity)
                        t_gate_off = t_step_start + gate
                        delay = t_gate_off - time.perf_counter()
                        if delay > 0:
                            self._stop_flag.wait(timeout=delay)
                        if self._stop_flag.is_set():
                            self._off(port, note)
                            break
                        self._off(port, note)

                # ── Wait until next step boundary ─────────────────────
                t_next = t_step_start + self._step_dur
                delay = t_next - time.perf_counter()
                if delay > 0:
                    self._stop_flag.wait(timeout=delay)

                step_idx = (step_idx + 1) % len(self._pattern)

        finally:
            if pending_off is not None:
                self._off(port, pending_off)
            self._all_notes_off(port)
            port.close()
            print(f"[{self.name}] Stopped.")


class T8Sequencer(threading.Thread):
    """Combined drum + bass sequencer for drum machines.

    Opens a single port and drives one or two MIDI channels per step:
      - Drum channel: drum hits — DrumStep (list of note/vel pairs)
      - Bass channel (optional): bass synth — Step (semitone offset from root)

    Gate lengths are independent: drums fire very short while bass uses
    a longer gate. Bass supports slide/accent using the same logic as
    Sequencer.
    """

    def __init__(
        self,
        name: str,
        port_match: str,
        drum_pattern: list[DrumStep],
        bass_pattern: list[Step] | None,
        drum_channel: int = 9,
        bass_channel: int | None = 1,
        bass_root: int = 45,
        base_velocity: int = 100,
        drum_gate_frac: float = 0.10,
        bass_gate_frac: float = 0.50,
        drum_map: dict[int, int] | None = None,
        bpm: int = 120,
        step_callback=None,
        t_start: float | None = None,
    ):
        super().__init__(daemon=True)
        self.name = name
        self._port_match    = port_match
        self._drum_pattern  = drum_pattern
        self._bass_pattern  = bass_pattern
        self._drum_ch       = drum_channel
        self._bass_ch       = bass_channel
        self._bass_root     = bass_root
        self._base_vel      = base_velocity
        self._drum_gate_frac = drum_gate_frac
        self._bass_gate_frac = bass_gate_frac
        self._drum_map      = drum_map
        self._stop_flag     = threading.Event()
        self._step_dur      = 60.0 / (bpm * 4)
        self._step_callback = step_callback
        self._t_start       = t_start

    # ------------------------------------------------------------------
    # MIDI helpers
    # ------------------------------------------------------------------

    def _send(self, port, ch: int, note: int, vel: int, on: bool) -> None:
        msg_type = "note_on" if on else "note_off"
        port.send(mido.Message(msg_type, channel=ch, note=note,
                               velocity=vel if on else 0))

    def _all_off(self, port, ch: int) -> None:
        port.send(mido.Message("control_change", channel=ch,
                               control=123, value=0))

    # ------------------------------------------------------------------
    # Per-step logic
    # ------------------------------------------------------------------

    def _fire_drums(self, port, step: DrumStep) -> list[int]:
        """Send all drum note_ons; return list of notes to turn off later."""
        notes = []
        for note, vel in step:
            if self._drum_map:
                note = self._drum_map.get(note, note)
            self._send(port, self._drum_ch, note, vel, on=True)
            notes.append(note)
        return notes

    def _release_drums(self, port, notes: list[int]) -> None:
        for note in notes:
            self._send(port, self._drum_ch, note, 0, on=False)

    # ------------------------------------------------------------------
    # Thread entry point
    # ------------------------------------------------------------------

    def stop(self) -> None:
        self._stop_flag.set()

    def run(self) -> None:
        try:
            port = mido.open_output(self._port_match)
        except OSError as e:
            print(f"[{self.name}] Could not open port: {e}")
            return

        has_bass = self._bass_ch is not None and self._bass_pattern is not None
        drum_gate = self._step_dur * self._drum_gate_frac
        bass_gate = self._step_dur * self._bass_gate_frac if has_bass else 0

        if has_bass:
            print(f"[{self.name}] Started — drums Ch{self._drum_ch+1} / "
                  f"bass Ch{self._bass_ch+1} root={self._bass_root} "
                  f"@ {round(60/(self._step_dur*4))} BPM")
        else:
            print(f"[{self.name}] Started — drums Ch{self._drum_ch+1} "
                  f"@ {round(60/(self._step_dur*4))} BPM")

        step_idx    = 0
        pending_bass_off: int | None = None
        pending_bass_slide = False

        # Align first step to global clock grid
        if self._t_start is not None:
            delay = self._t_start - time.perf_counter()
            if delay > 0:
                self._stop_flag.wait(timeout=delay)
            t_next = self._t_start
        else:
            t_next = time.perf_counter()

        try:
            while not self._stop_flag.is_set():
                t_step_start = t_next
                if self._step_callback:
                    self._step_callback(step_idx)
                d_step: DrumStep  = self._drum_pattern[step_idx]

                # ── Drums ────────────────────────────────────────────
                pending_drum_notes = self._fire_drums(port, d_step)

                # ── Bass note_on (with slide carry logic) ────────────
                if has_bass:
                    b_step: Step = self._bass_pattern[step_idx]

                    if b_step is None:
                        if pending_bass_off is not None:
                            self._send(port, self._bass_ch, pending_bass_off, 0, False)
                            pending_bass_off = None
                        pending_bass_slide = False
                    else:
                        semitones, vel_factor, slide = b_step
                        b_note = max(0, min(127, self._bass_root + semitones))
                        b_vel  = min(127, int(self._base_vel * vel_factor))

                        if pending_bass_off is not None and pending_bass_off != b_note:
                            self._send(port, self._bass_ch, b_note, b_vel, True)
                            self._send(port, self._bass_ch, pending_bass_off, 0, False)
                        else:
                            self._send(port, self._bass_ch, b_note, b_vel, True)

                        pending_bass_off   = b_note
                        pending_bass_slide = slide

                # ── Wait drum gate, then release drums ───────────────
                t_drum_off = t_step_start + drum_gate
                delay = t_drum_off - time.perf_counter()
                if delay > 0:
                    self._stop_flag.wait(timeout=delay)
                if self._stop_flag.is_set():
                    break
                self._release_drums(port, pending_drum_notes)

                # ── Wait remainder up to bass gate ───────────────────
                if has_bass:
                    t_bass_off = t_step_start + bass_gate
                    delay = t_bass_off - time.perf_counter()
                    if delay > 0:
                        self._stop_flag.wait(timeout=delay)
                    if self._stop_flag.is_set():
                        break

                    # ── Release bass if not sliding ──────────────────
                    if self._bass_pattern[step_idx] is not None and not pending_bass_slide:
                        self._send(port, self._bass_ch, pending_bass_off, 0, False)
                        pending_bass_off = None

                # ── Wait rest of step (absolute target) ───────────────
                t_next = t_step_start + self._step_dur
                delay = t_next - time.perf_counter()
                if delay > 0:
                    self._stop_flag.wait(timeout=delay)

                step_idx = (step_idx + 1) % len(self._drum_pattern)

        finally:
            if pending_bass_off is not None:
                self._send(port, self._bass_ch, pending_bass_off, 0, False)
            self._all_off(port, self._drum_ch)
            if has_bass:
                self._all_off(port, self._bass_ch)
            port.close()
            print(f"[{self.name}] Stopped.")
