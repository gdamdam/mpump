import threading
import time
import mido

from patterns import Step


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
