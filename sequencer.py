import threading
import time
import mido

from devices import PATTERN


class Sequencer(threading.Thread):
    """Runs a 16-step MIDI sequencer loop for one device in its own thread."""

    def __init__(self, name: str, profile: dict, bpm: int = 120):
        super().__init__(daemon=True)
        self.name = name
        self.profile = profile
        self.bpm = bpm
        self._stop_flag = threading.Event()

        # One step = one 16th note = 60 / (bpm * 4) seconds
        self._step_duration = 60.0 / (bpm * 4)

    def _note_on(self, port: mido.ports.BaseOutput, note: int) -> None:
        port.send(mido.Message(
            "note_on",
            channel=self.profile["channel"],
            note=note,
            velocity=self.profile["velocity"],
        ))

    def _note_off(self, port: mido.ports.BaseOutput, note: int) -> None:
        port.send(mido.Message(
            "note_off",
            channel=self.profile["channel"],
            note=note,
            velocity=0,
        ))

    def stop(self) -> None:
        self._stop_flag.set()

    def run(self) -> None:
        try:
            port = mido.open_output(self.profile["port_match"])
        except OSError as e:
            print(f"[{self.name}] Could not open port: {e}")
            return

        print(f"[{self.name}] Started — ch{self.profile['channel'] + 1} "
              f"notes {self.profile['note_a']}/{self.profile['note_b']} "
              f"@ {self.bpm} BPM")

        gate = self._step_duration * self.profile["note_fraction"]
        rest = self._step_duration - gate

        step = 0
        try:
            while not self._stop_flag.is_set():
                slot = PATTERN[step]
                note = self.profile["note_a"] if slot == 0 else self.profile["note_b"]

                self._note_on(port, note)
                time.sleep(gate)
                self._note_off(port, note)

                step = (step + 1) % len(PATTERN)

                # Sleep remaining step time, but wake early if stopped
                self._stop_flag.wait(timeout=rest)

        finally:
            # All notes off on this channel before closing
            port.send(mido.Message("control_change",
                                   channel=self.profile["channel"],
                                   control=123, value=0))
            port.close()
            print(f"[{self.name}] Stopped.")
