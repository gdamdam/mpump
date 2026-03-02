import time
import mido

from .devices import DEVICES
from .sequencer import Sequencer, T8Sequencer


class DeviceScanner:
    """Polls MIDI output ports and manages sequencer threads per device.

    S-1  → Sequencer  (melodic, dynamic genre/pattern/key)
    T-8  → T8Sequencer (drums Ch10 + bass Ch2, dynamic genre/pattern/key)
    J-6  → Sequencer  (fixed chord pattern)
    SP-404MK2 → Sequencer (fixed pad pattern)
    """

    POLL_INTERVAL = 0.5

    def __init__(
        self,
        bpm: int = 120,
        s1_pattern=None,
        s1_root: int = 45,
        t8_drum_pattern=None,
        t8_bass_pattern=None,
        t8_bass_root: int = 45,
    ):
        self.bpm             = bpm
        self._s1_pattern     = s1_pattern
        self._s1_root        = s1_root
        self._t8_drum        = t8_drum_pattern
        self._t8_bass        = t8_bass_pattern
        self._t8_bass_root   = t8_bass_root
        self._active: dict[str, Sequencer | T8Sequencer] = {}

    def _available_ports(self) -> set[str]:
        return set(mido.get_output_names())

    def _build(self, name: str, profile: dict) -> Sequencer | T8Sequencer | None:
        if profile["type"] == "t8":
            if self._t8_drum is None:
                return None
            return T8Sequencer(
                port_match=profile["port_match"],
                drum_pattern=self._t8_drum,
                bass_pattern=self._t8_bass,
                bass_root=self._t8_bass_root,
                base_velocity=profile["base_velocity"],
                bpm=self.bpm,
            )

        # synth devices
        if name == "S-1":
            if self._s1_pattern is None:
                return None
            pattern = self._s1_pattern
            root    = self._s1_root
        else:
            pattern = profile["pattern"]
            root    = profile["root_note"]

        return Sequencer(
            name=name,
            port_match=profile["port_match"],
            channel=profile["channel"],
            pattern=pattern,
            root_note=root,
            base_velocity=profile["base_velocity"],
            note_fraction=profile["note_fraction"],
            bpm=self.bpm,
        )

    def tick(self) -> None:
        available = self._available_ports()

        for name, profile in DEVICES.items():
            if profile["port_match"] in available and name not in self._active:
                seq = self._build(name, profile)
                if seq is None:
                    continue
                print(f"[scanner] {name} connected → launching sequencer")
                self._active[name] = seq
                seq.start()

        gone = [n for n in self._active if DEVICES[n]["port_match"] not in available]
        for name in gone:
            print(f"[scanner] {name} disconnected → stopping sequencer")
            self._active[name].stop()
            self._active[name].join(timeout=2)
            del self._active[name]

    def run(self) -> None:
        print(f"[scanner] Watching for: {', '.join(DEVICES)}")
        print(f"[scanner] Ports now: {sorted(self._available_ports()) or '(none)'}")
        try:
            while True:
                self.tick()
                time.sleep(self.POLL_INTERVAL)
        except KeyboardInterrupt:
            pass
        finally:
            self.shutdown()

    def shutdown(self) -> None:
        print("\n[scanner] Shutting down...")
        for seq in self._active.values():
            seq.stop()
            seq.join(timeout=2)
        self._active.clear()
        print("[scanner] All stopped.")
