import time
import mido

from devices import DEVICES
from sequencer import Sequencer


class DeviceScanner:
    """Polls MIDI output ports and manages sequencer threads per device."""

    POLL_INTERVAL = 0.5  # seconds between port list scans

    def __init__(self, bpm: int = 120):
        self.bpm = bpm
        # name → running Sequencer thread
        self._active: dict[str, Sequencer] = {}

    def _available_ports(self) -> set[str]:
        return set(mido.get_output_names())

    def _find_device(self, port_name: str) -> tuple[str, dict] | None:
        """Return (device_name, profile) if port_name matches a known device."""
        for name, profile in DEVICES.items():
            if profile["port_match"] == port_name:
                return name, profile
        return None

    def tick(self) -> None:
        """One scan cycle: start new sequencers, stop removed ones."""
        available = self._available_ports()

        # Start sequencers for newly connected devices
        for port_name in available:
            match = self._find_device(port_name)
            if match is None:
                continue
            name, profile = match
            if name not in self._active:
                print(f"[scanner] {name} connected → launching sequencer")
                seq = Sequencer(name, profile, bpm=self.bpm)
                self._active[name] = seq
                seq.start()

        # Stop sequencers for disconnected devices
        gone = [
            name for name, seq in self._active.items()
            if DEVICES[name]["port_match"] not in available
        ]
        for name in gone:
            print(f"[scanner] {name} disconnected → stopping sequencer")
            self._active[name].stop()
            self._active[name].join(timeout=2)
            del self._active[name]

    def run(self) -> None:
        """Block forever, scanning for device changes."""
        print(f"[scanner] Watching for devices: {', '.join(DEVICES)}")
        print(f"[scanner] Known ports: {sorted(self._available_ports()) or '(none)'}")
        try:
            while True:
                self.tick()
                time.sleep(self.POLL_INTERVAL)
        except KeyboardInterrupt:
            pass
        finally:
            self.shutdown()

    def shutdown(self) -> None:
        """Stop all running sequencers."""
        print("\n[scanner] Shutting down...")
        for name, seq in list(self._active.items()):
            seq.stop()
            seq.join(timeout=2)
        self._active.clear()
        print("[scanner] All stopped.")
