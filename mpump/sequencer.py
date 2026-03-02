import threading
import time
import mido

from .patterns import Step
from .patterns_t8 import DrumStep


class MidiClock(threading.Thread):
    """Sends MIDI clock (24 PPQN) + Start/Stop to one device port.

    Opens its own connection to the port so the sequencer thread is
    not affected.  On macOS CoreMIDI multiple opens of the same
    virtual endpoint are allowed.
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
        port.send(mido.Message("start"))
        print(f"[clock:{self._port_match}] Started")

        try:
            while not self._stop_flag.is_set():
                with self._lock:
                    bpm = self._bpm
                port.send(clock)
                self._stop_flag.wait(timeout=60.0 / (bpm * self.PPQN))
        finally:
            try:
                port.send(mido.Message("stop"))
            except Exception:
                pass
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

        print(f"[{self.name}] Started — ch{self._channel + 1} "
              f"root={self._root_note} steps={len(self._pattern)}")

        gate = self._step_dur * self._note_fraction
        rest = self._step_dur - gate

        step_idx = 0
        pending_off: int | None = None   # note awaiting note_off (slide carry)

        try:
            while not self._stop_flag.is_set():
                if self._step_callback:
                    self._step_callback(step_idx)
                step: Step = self._pattern[step_idx]

                if step is None:
                    # Rest: release any sliding note immediately
                    if pending_off is not None:
                        self._off(port, pending_off)
                        pending_off = None
                    self._stop_flag.wait(timeout=self._step_dur)

                else:
                    semitones, vel_factor, slide = step
                    note = max(0, min(127, self._root_note + semitones))
                    velocity = min(127, int(self._base_velocity * vel_factor))

                    if slide:
                        # Send note_on; carry note_off to next step for legato
                        if pending_off is not None and pending_off != note:
                            # New note_on BEFORE old note_off → synth glides
                            self._on(port, note, velocity)
                            self._off(port, pending_off)
                        else:
                            self._on(port, note, velocity)
                        pending_off = note
                        self._stop_flag.wait(timeout=self._step_dur)
                    else:
                        # Normal: note_on then note_off within this step
                        if pending_off is not None:
                            self._on(port, note, velocity)
                            self._off(port, pending_off)
                            pending_off = None
                        else:
                            self._on(port, note, velocity)
                        self._stop_flag.wait(timeout=gate)
                        self._off(port, note)
                        self._stop_flag.wait(timeout=rest)

                step_idx = (step_idx + 1) % len(self._pattern)

        finally:
            if pending_off is not None:
                self._off(port, pending_off)
            self._all_notes_off(port)
            port.close()
            print(f"[{self.name}] Stopped.")


class T8Sequencer(threading.Thread):
    """Combined drum + bass sequencer for the Roland T-8.

    Opens a single port and drives two MIDI channels per step:
      - Ch 10 (index 9): drum hits  — DrumStep (list of note/vel pairs)
      - Ch  2 (index 1): bass synth — Step (semitone offset from root)

    Gate lengths are independent: drums fire very short (10% of step)
    while bass uses a longer gate (50%). Bass supports slide/accent
    using the same logic as Sequencer.
    """

    DRUM_CH  = 9   # MIDI channel 10 (0-indexed)
    BASS_CH  = 1   # MIDI channel 2  (0-indexed)

    DRUM_GATE_FRAC = 0.10
    BASS_GATE_FRAC = 0.50

    def __init__(
        self,
        port_match: str,
        drum_pattern: list[DrumStep],
        bass_pattern: list[Step],
        bass_root: int = 45,
        base_velocity: int = 100,
        bpm: int = 120,
        step_callback=None,
    ):
        super().__init__(daemon=True)
        self.name = "T-8"
        self._port_match  = port_match
        self._drum_pattern = drum_pattern
        self._bass_pattern = bass_pattern
        self._bass_root    = bass_root
        self._base_vel     = base_velocity
        self._stop_flag    = threading.Event()
        self._step_dur     = 60.0 / (bpm * 4)
        self._step_callback = step_callback

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
            self._send(port, self.DRUM_CH, note, vel, on=True)
            notes.append(note)
        return notes

    def _release_drums(self, port, notes: list[int]) -> None:
        for note in notes:
            self._send(port, self.DRUM_CH, note, 0, on=False)

    # ------------------------------------------------------------------
    # Thread entry point
    # ------------------------------------------------------------------

    def stop(self) -> None:
        self._stop_flag.set()

    def run(self) -> None:
        try:
            port = mido.open_output(self._port_match)
        except OSError as e:
            print(f"[T-8] Could not open port: {e}")
            return

        drum_gate = self._step_dur * self.DRUM_GATE_FRAC
        bass_gate = self._step_dur * self.BASS_GATE_FRAC
        bass_rest = self._step_dur - bass_gate

        print(f"[T-8] Started — drums Ch10 / bass Ch2 "
              f"root={self._bass_root} @ {round(60/(self._step_dur*4))} BPM")

        step_idx    = 0
        pending_bass_off: int | None = None
        pending_bass_slide = False

        try:
            while not self._stop_flag.is_set():
                if self._step_callback:
                    self._step_callback(step_idx)
                d_step: DrumStep  = self._drum_pattern[step_idx]
                b_step: Step      = self._bass_pattern[step_idx]

                # ── Drums ────────────────────────────────────────────
                pending_drum_notes = self._fire_drums(port, d_step)

                # ── Bass note_on (with slide carry logic) ────────────
                if b_step is None:
                    if pending_bass_off is not None:
                        self._send(port, self.BASS_CH, pending_bass_off, 0, False)
                        pending_bass_off = None
                    pending_bass_slide = False
                else:
                    semitones, vel_factor, slide = b_step
                    b_note = max(0, min(127, self._bass_root + semitones))
                    b_vel  = min(127, int(self._base_vel * vel_factor))

                    if pending_bass_off is not None and pending_bass_off != b_note:
                        self._send(port, self.BASS_CH, b_note, b_vel, True)
                        self._send(port, self.BASS_CH, pending_bass_off, 0, False)
                    else:
                        self._send(port, self.BASS_CH, b_note, b_vel, True)

                    pending_bass_off   = b_note
                    pending_bass_slide = slide

                # ── Wait drum gate, then release drums ───────────────
                self._stop_flag.wait(timeout=drum_gate)
                self._release_drums(port, pending_drum_notes)

                # ── Wait remainder up to bass gate ───────────────────
                bass_remaining = bass_gate - drum_gate
                self._stop_flag.wait(timeout=bass_remaining)

                # ── Release bass if not sliding ──────────────────────
                if b_step is not None and not pending_bass_slide:
                    self._send(port, self.BASS_CH, pending_bass_off, 0, False)
                    pending_bass_off = None

                # ── Wait rest of step ─────────────────────────────────
                self._stop_flag.wait(timeout=bass_rest)

                step_idx = (step_idx + 1) % len(self._drum_pattern)

        finally:
            if pending_bass_off is not None:
                self._send(port, self.BASS_CH, pending_bass_off, 0, False)
            self._all_off(port, self.DRUM_CH)
            self._all_off(port, self.BASS_CH)
            port.close()
            print("[T-8] Stopped.")
