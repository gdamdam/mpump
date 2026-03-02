import time
import mido

from .devices import DEVICES
from .sequencer import MidiClock, Sequencer, T8Sequencer


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
        s1_step_callback=None,
        t8_step_callback=None,
        connected_callback=None,
    ):
        self.bpm             = bpm
        self._s1_pattern     = s1_pattern
        self._s1_root        = s1_root
        self._t8_drum        = t8_drum_pattern
        self._t8_bass        = t8_bass_pattern
        self._t8_bass_root   = t8_bass_root
        self._s1_step_cb     = s1_step_callback
        self._t8_step_cb     = t8_step_callback
        self._connected_cb   = connected_callback
        self._active: dict[str, Sequencer | T8Sequencer] = {}
        self._clocks: dict[str, MidiClock] = {}

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
                step_callback=self._t8_step_cb,
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

        cb = self._s1_step_cb if name == "S-1" else None
        return Sequencer(
            name=name,
            port_match=profile["port_match"],
            channel=profile["channel"],
            pattern=pattern,
            root_note=root,
            base_velocity=profile["base_velocity"],
            note_fraction=profile["note_fraction"],
            bpm=self.bpm,
            step_callback=cb,
        )

    def tick(self) -> None:
        available = self._available_ports()

        for name, profile in DEVICES.items():
            if profile["port_match"] in available and name not in self._active:
                seq = self._build(name, profile)
                if seq is None:
                    continue
                print(f"[scanner] {name} connected → launching sequencer + clock")
                self._active[name] = seq
                seq.start()
                clk = MidiClock(profile["port_match"], self.bpm)
                self._clocks[name] = clk
                clk.start()
                if self._connected_cb:
                    self._connected_cb(name, True)

        gone = [n for n in self._active if DEVICES[n]["port_match"] not in available]
        for name in gone:
            print(f"[scanner] {name} disconnected → stopping sequencer + clock")
            self._active[name].stop()
            self._active[name].join(timeout=2)
            del self._active[name]
            if name in self._clocks:
                self._clocks[name].stop()
                self._clocks[name].join(timeout=2)
                del self._clocks[name]
            if self._connected_cb:
                self._connected_cb(name, False)

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
        for clk in self._clocks.values():
            clk.stop()
            clk.join(timeout=2)
        self._clocks.clear()
        for seq in self._active.values():
            seq.stop()
            seq.join(timeout=2)
        self._active.clear()
        print("[scanner] All stopped.")

    def connected_devices(self) -> set[str]:
        return set(self._active.keys())

    def _restart(self, name: str) -> None:
        """Stop and restart sequencer for *name* if it is currently active."""
        if name not in self._active:
            return
        old = self._active.pop(name)
        old.stop()
        old.join(timeout=1)
        seq = self._build(name, DEVICES[name])
        if seq:
            self._active[name] = seq
            seq.start()
        # Clock keeps running through restarts — only update its BPM
        if name in self._clocks:
            self._clocks[name].set_bpm(self.bpm)

    def update_s1(self, pattern, root: int) -> None:
        self._s1_pattern = pattern
        self._s1_root    = root
        self._restart("S-1")

    def update_t8(self, drum, bass, root: int) -> None:
        self._t8_drum      = drum
        self._t8_bass      = bass
        self._t8_bass_root = root
        self._restart("T-8")

    def update_bpm(self, bpm: int) -> None:
        self.bpm = bpm
        for clk in self._clocks.values():
            clk.set_bpm(bpm)
        for name in list(self._active):
            self._restart(name)
