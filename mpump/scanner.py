import math
import time
import mido

from .devices import DeviceConfig, DEVICE_REGISTRY, find_device, get_device
from .sequencer import MidiClock, Sequencer, T8Sequencer


class DeviceScanner:
    """Polls MIDI output ports and manages sequencer threads per device.

    Data-driven: uses DEVICE_REGISTRY to auto-detect any of the 50
    supported USB MIDI devices.  Dispatches by DeviceConfig.mode:

      synth      → Sequencer  (melodic patterns)
      drums      → T8Sequencer (drums only, no bass)
      drums+bass → T8Sequencer (drums + bass on separate channels)
    """

    POLL_INTERVAL = 0.5

    def __init__(
        self,
        bpm: int = 120,
        *,
        # Per-device state: {device_id: {...}}
        device_states: dict[str, dict] | None = None,
        # Step callback: fn(device_id, step_idx)
        step_callback=None,
        # Connection callback: fn(device_id, connected_bool)
        connected_callback=None,
    ):
        self.bpm = bpm
        self._device_states = device_states or {}
        self._step_cb = step_callback
        self._connected_cb = connected_callback
        self._active: dict[str, Sequencer | T8Sequencer] = {}
        self._configs: dict[str, DeviceConfig] = {}  # label → config for active
        self._clocks: dict[str, MidiClock] = {}
        self._stopped: set[str] = set()
        self._t0: float = time.perf_counter()

    def _available_ports(self) -> set[str]:
        return set(mido.get_output_names())

    def _next_bar_boundary(self) -> float:
        step_dur = 60.0 / (self.bpm * 4)
        bar_dur  = 16 * step_dur
        now      = time.perf_counter()
        elapsed  = now - self._t0
        n        = math.ceil(elapsed / bar_dur)
        t_bar    = self._t0 + n * bar_dur
        if t_bar - now < 0.05:
            t_bar += bar_dur
        return t_bar

    def _get_state(self, device_id: str) -> dict:
        return self._device_states.get(device_id, {})

    def _build(self, cfg: DeviceConfig, port_name: str,
               t_start: float | None = None) -> Sequencer | T8Sequencer | None:
        state = self._get_state(cfg.id)
        did = cfg.id

        if cfg.mode == "synth":
            pattern = state.get("pattern")
            if pattern is None:
                return None
            return Sequencer(
                name=cfg.label,
                port_match=port_name,
                channel=cfg.channel,
                pattern=pattern,
                root_note=state.get("root", cfg.root_note),
                base_velocity=cfg.base_velocity,
                note_fraction=cfg.gate_frac,
                bpm=self.bpm,
                step_callback=(lambda i, _d=did: self._step_cb(_d, i)) if self._step_cb else None,
                program_change=state.get("program_change"),
                t_start=t_start,
            )

        elif cfg.mode in ("drums", "drums+bass"):
            drum_pattern = state.get("drum_pattern")
            if drum_pattern is None:
                return None
            bass_pattern = state.get("bass_pattern") if cfg.mode == "drums+bass" else None
            return T8Sequencer(
                name=cfg.label,
                port_match=port_name,
                drum_pattern=drum_pattern,
                bass_pattern=bass_pattern,
                drum_channel=cfg.channel,
                bass_channel=cfg.bass_channel if cfg.mode == "drums+bass" else None,
                bass_root=state.get("bass_root", cfg.root_note),
                base_velocity=cfg.base_velocity,
                drum_gate_frac=cfg.drum_gate_frac,
                bass_gate_frac=cfg.bass_gate_frac,
                drum_map=cfg.drum_map,
                bpm=self.bpm,
                step_callback=(lambda i, _d=did: self._step_cb(_d, i)) if self._step_cb else None,
                t_start=t_start,
            )

        return None

    def tick(self) -> None:
        available = self._available_ports()

        # Check for new devices
        for cfg in DEVICE_REGISTRY:
            label = cfg.label
            if label in self._active or label in self._stopped:
                continue
            # Find matching port
            matched_port = None
            for port_name in available:
                if cfg.port_match in port_name:
                    matched_port = port_name
                    break
            if matched_port is None:
                continue

            t_start = self._next_bar_boundary()
            seq = self._build(cfg, matched_port, t_start=t_start)
            if seq is None:
                continue
            print(f"[scanner] {label} connected → launching sequencer + clock")
            self._active[label] = seq
            self._configs[label] = cfg
            seq.start()
            if cfg.send_clock:
                clk = MidiClock(matched_port, self.bpm)
                self._clocks[label] = clk
                clk.start()
            if self._connected_cb:
                self._connected_cb(cfg.id, True)

        # Check for disconnected devices
        gone = []
        for label, cfg in list(self._configs.items()):
            if label not in self._active:
                continue
            if not any(cfg.port_match in p for p in available):
                gone.append(label)

        for label in gone:
            cfg = self._configs[label]
            print(f"[scanner] {label} disconnected → stopping sequencer + clock")
            self._active[label].stop()
            self._active[label].join(timeout=2)
            del self._active[label]
            self._stopped.discard(label)
            if label in self._clocks:
                self._clocks[label].stop()
                self._clocks[label].join(timeout=2)
                del self._clocks[label]
            if self._connected_cb:
                self._connected_cb(cfg.id, False)

    def run(self) -> None:
        labels = [d.label for d in DEVICE_REGISTRY]
        print(f"[scanner] Watching for: {', '.join(labels[:5])}... ({len(labels)} devices)")
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

    def _restart(self, label: str) -> None:
        """Stop and restart sequencer for *label* aligned to the global step grid."""
        if label not in self._active:
            return
        cfg = self._configs[label]
        old = self._active.pop(label)
        old.stop()
        old.join(timeout=1)
        t_start = self._next_bar_boundary()
        # Find current port
        port_name = None
        for p in self._available_ports():
            if cfg.port_match in p:
                port_name = p
                break
        if port_name is None:
            return
        seq = self._build(cfg, port_name, t_start=t_start)
        if seq:
            self._active[label] = seq
            seq.start()
        if label in self._clocks:
            self._clocks[label].set_bpm(self.bpm)

    def is_paused(self, label: str) -> bool:
        return label in self._stopped

    def toggle_device(self, label: str) -> bool:
        """Stop or restart the named device in sync. Returns True if now playing."""
        if label in self._active:
            old = self._active.pop(label)
            old.stop()
            old.join(timeout=1)
            self._stopped.add(label)
            return False
        elif label in self._stopped:
            self._stopped.discard(label)
            cfg = self._configs.get(label)
            if cfg is None:
                # Try to find config by label
                for d in DEVICE_REGISTRY:
                    if d.label == label:
                        cfg = d
                        break
            if cfg is None:
                return False
            port_name = None
            for p in self._available_ports():
                if cfg.port_match in p:
                    port_name = p
                    break
            if port_name:
                t_start = self._next_bar_boundary()
                seq = self._build(cfg, port_name, t_start=t_start)
                if seq:
                    self._active[label] = seq
                    self._configs[label] = cfg
                    seq.start()
                    return True
        return False

    # ── Generic update method ────────────────────────────────────────────

    def update_device(self, device_id: str, **kwargs) -> None:
        """Update state for a device and restart it.

        Accepted kwargs vary by mode:
          synth:      pattern, root, program_change
          drums:      drum_pattern
          drums+bass: drum_pattern, bass_pattern, bass_root
        """
        state = self._device_states.setdefault(device_id, {})
        state.update(kwargs)
        # Find label for this device_id
        cfg = get_device(device_id)
        if cfg:
            self._restart(cfg.label)

    # ── Backwards-compatible update methods (used by ui.py / engine.py) ──

    def update_s1(self, pattern, root: int) -> None:
        self.update_device("s1", pattern=pattern, root=root)

    def update_t8(self, drum, bass, root: int) -> None:
        self.update_device("t8", drum_pattern=drum, bass_pattern=bass, bass_root=root)

    def update_j6(self, pattern, program_change: int | None) -> None:
        self.update_device("j6", pattern=pattern, program_change=program_change)

    def update_bpm(self, bpm: int) -> None:
        self.bpm = bpm
        self._t0 = time.perf_counter()
        for clk in self._clocks.values():
            clk.set_bpm(bpm)
        # Batch-restart all active devices at the same boundary
        names = list(self._active)
        old_seqs = {n: self._active.pop(n) for n in names}
        for seq in old_seqs.values():
            seq.stop()
        for seq in old_seqs.values():
            seq.join(timeout=1)
        t_start = self._next_bar_boundary()
        for label in names:
            cfg = self._configs.get(label)
            if cfg is None:
                continue
            port_name = None
            for p in self._available_ports():
                if cfg.port_match in p:
                    port_name = p
                    break
            if port_name is None:
                continue
            seq = self._build(cfg, port_name, t_start=t_start)
            if seq:
                self._active[label] = seq
                seq.start()
