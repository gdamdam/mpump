import time
import mido

from devices import DEVICES
from sequencer import Sequencer


class DeviceScanner:
    """Polls MIDI output ports and manages one Sequencer thread per device.

    The S-1 receives a dynamically chosen pattern (genre/index/root_note).
    All other devices use the fixed pattern stored in their device profile.
    """

    POLL_INTERVAL = 0.5  # seconds between scans

    def __init__(
        self,
        bpm: int = 120,
        s1_pattern=None,      # list[Step] for S-1
        s1_root: int = 45,    # root MIDI note for S-1 (from --key)
    ):
        self.bpm = bpm
        self._s1_pattern = s1_pattern
        self._s1_root = s1_root
        self._active: dict[str, Sequencer] = {}

    def _available_ports(self) -> set[str]:
        return set(mido.get_output_names())

    def _build_sequencer(self, name: str, profile: dict) -> Sequencer:
        if name == "S-1":
            pattern  = self._s1_pattern
            root     = self._s1_root
        else:
            pattern  = profile["pattern"]
            root     = profile["root_note"]

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

        # Start sequencers for newly connected devices
        for name, profile in DEVICES.items():
            if profile["port_match"] in available and name not in self._active:
                # S-1 needs a pattern; skip if none configured
                if name == "S-1" and self._s1_pattern is None:
                    continue
                print(f"[scanner] {name} connected → launching sequencer")
                seq = self._build_sequencer(name, profile)
                self._active[name] = seq
                seq.start()

        # Stop sequencers for disconnected devices
        gone = [
            name for name, _ in self._active.items()
            if DEVICES[name]["port_match"] not in available
        ]
        for name in gone:
            print(f"[scanner] {name} disconnected → stopping sequencer")
            self._active[name].stop()
            self._active[name].join(timeout=2)
            del self._active[name]

    def run(self) -> None:
        watching = ", ".join(DEVICES)
        print(f"[scanner] Watching for: {watching}")
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
