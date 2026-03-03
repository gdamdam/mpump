# Data-driven device registry for 50 USB MIDI devices.
#
# Mirrors mpump/server/src/data/devices.ts — every device that the browser
# sequencer supports is also listed here so the Python CLI/TUI/web backend
# can auto-detect and sequence it.

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class DeviceConfig:
    id: str                # "s1", "tr6s", etc.
    label: str             # "S-1", "TR-6S"
    port_match: str        # substring to match in MIDI port name
    mode: str              # "synth" | "drums" | "drums+bass"
    channel: int           # main MIDI channel (0-indexed)
    bass_channel: int | None = None   # bass channel for drums+bass
    root_note: int = 45    # default root MIDI note
    gate_frac: float = 0.5
    drum_gate_frac: float = 0.10
    bass_gate_frac: float = 0.50
    base_velocity: int = 100
    drum_map: dict[int, int] | None = None
    has_key: bool = True
    has_octave: bool = True
    use_program_change: bool = False
    send_clock: bool = False


def _synth(
    id: str, label: str, port_match: str, **kw,
) -> DeviceConfig:
    return DeviceConfig(
        id=id, label=label, port_match=port_match, mode="synth",
        channel=kw.pop("channel", 0), **kw,
    )


def _drums(
    id: str, label: str, port_match: str, **kw,
) -> DeviceConfig:
    return DeviceConfig(
        id=id, label=label, port_match=port_match, mode="drums",
        channel=kw.pop("channel", 9), has_key=kw.pop("has_key", False),
        has_octave=kw.pop("has_octave", False), root_note=kw.pop("root_note", 36),
        **kw,
    )


def _drums_bass(
    id: str, label: str, port_match: str, **kw,
) -> DeviceConfig:
    return DeviceConfig(
        id=id, label=label, port_match=port_match, mode="drums+bass",
        channel=kw.pop("channel", 9), bass_channel=kw.pop("bass_channel", 1),
        **kw,
    )


# ---------------------------------------------------------------------------
# 50-device registry  (order matches devices.ts)
# ---------------------------------------------------------------------------

DEVICE_REGISTRY: list[DeviceConfig] = [
    # ── Roland AIRA Compact ──────────────────────────────────────────────
    _synth("s1", "S-1", "S-1", send_clock=True),
    _drums_bass("t8", "T-8", "T-8", send_clock=True),
    _synth("j6", "J-6", "J-6",
           root_note=60, gate_frac=0.8, has_key=False, has_octave=False,
           use_program_change=True, send_clock=True),

    # ── Roland ────────────────────────────────────────────────────────────
    _drums("tr6s", "TR-6S", "TR-6S"),
    _drums("tr8s", "TR-8S", "TR-8S"),
    _drums_bass("mc101", "MC-101", "MC-101", channel=0, bass_channel=1),
    _drums_bass("mc707", "MC-707", "MC-707", channel=0, bass_channel=1),
    _synth("sh4d", "SH-4d", "SH-4d"),
    _synth("tb3", "TB-3", "TB-3"),
    _synth("tb03", "TB-03", "Boutique"),
    _synth("jdxi", "JD-Xi", "JD-Xi"),
    _synth("ju06a", "JU-06A", "Boutique"),
    _synth("se02", "SE-02", "Boutique"),
    _synth("gaia2", "GAIA 2", "GAIA 2"),
    _synth("sp404mk2", "SP-404MK2", "SP-404MK2",
           root_note=36, gate_frac=0.3, has_key=False, has_octave=False),

    # ── Korg ──────────────────────────────────────────────────────────────
    _synth("minilogue_xd", "minilogue xd", "minilogue xd"),
    _synth("monologue", "monologue", "monologue"),
    _synth("nts1", "NTS-1", "NTS-1 digital kit"),
    _drums_bass("drumlogue", "drumlogue", "drumlogue", channel=9, bass_channel=0),
    _synth("minilogue", "minilogue", "minilogue"),
    _synth("wavestate", "wavestate", "wavestate"),
    _synth("opsix", "opsix", "opsix"),
    _synth("modwave", "modwave", "modwave"),

    # ── Novation ──────────────────────────────────────────────────────────
    _drums_bass("circuit_tracks", "Circuit Tracks", "Circuit Tracks",
                channel=9, bass_channel=0),
    _drums("circuit_rhythm", "Circuit Rhythm", "Circuit Rhythm"),
    _synth("bass_station_ii", "Bass Station II", "Bass Station II"),
    _synth("peak", "Peak", "Peak"),

    # ── Arturia ───────────────────────────────────────────────────────────
    _synth("microfreak", "MicroFreak", "MicroFreak"),
    _drums("drumbrute_impact", "DrumBrute Impact", "DrumBrute Impact"),

    # ── Behringer ─────────────────────────────────────────────────────────
    _synth("td3", "TD-3", "TD-3"),
    _drums("rd6", "RD-6", "RD-6", channel=0,
           drum_map={36: 36, 38: 40, 42: 42, 46: 46, 50: 39, 49: 51}),
    _synth("crave", "Crave", "Crave"),
    _synth("model_d", "Model D", "MODEL D"),
    _synth("neutron", "Neutron", "Neutron"),
    _synth("poly_d", "Poly D", "Poly D"),
    _synth("k2", "K-2", "K-2"),
    _synth("ms1", "MS-1", "MS-1"),
    _synth("deepmind12", "DeepMind 12", "DeepMind 12"),
    _synth("wasp_deluxe", "Wasp Deluxe", "Wasp Deluxe"),

    # ── Elektron ──────────────────────────────────────────────────────────
    _drums("syntakt", "Syntakt", "Syntakt", channel=0),
    _drums("digitakt", "Digitakt", "Digitakt", channel=0,
           drum_map={36: 24, 38: 25, 42: 26, 46: 27, 50: 28, 49: 29}),
    _drums_bass("model_cycles", "Model:Cycles", "Model:Cycles",
                channel=0, bass_channel=5),
    _drums("model_samples", "Model:Samples", "Model:Samples", channel=0),
    _drums("analog_rytm", "Analog Rytm MKII", "Analog Rytm MKII"),
    _synth("analog_four", "Analog Four MKII", "Analog Four MKII"),

    # ── Teenage Engineering ───────────────────────────────────────────────
    _synth("opz", "OP-Z", "OP-Z", channel=4),
    _drums_bass("ep133", "EP-133 K.O. II", "EP-133", channel=0, bass_channel=1),

    # ── Sequential ────────────────────────────────────────────────────────
    _synth("take5", "Take 5", "Take 5"),

    # ── IK Multimedia ─────────────────────────────────────────────────────
    _drums("uno_drum", "UNO Drum", "UNO Drum"),
    _synth("uno_synth", "UNO Synth", "UNO Synth"),
]

# Fast lookup by id
_REGISTRY_BY_ID: dict[str, DeviceConfig] = {d.id: d for d in DEVICE_REGISTRY}


def get_device(device_id: str) -> DeviceConfig | None:
    return _REGISTRY_BY_ID.get(device_id)


def find_device(port_name: str) -> DeviceConfig | None:
    """Return the first DeviceConfig whose port_match is a substring of *port_name*."""
    for cfg in DEVICE_REGISTRY:
        if cfg.port_match in port_name:
            return cfg
    return None


# ---------------------------------------------------------------------------
# Backwards-compat: old DEVICES dict shape used by ui.py
# ---------------------------------------------------------------------------

def _compat_dict() -> dict[str, dict]:
    """Build the old-style DEVICES dict for code that still uses it."""
    out: dict[str, dict] = {}
    for cfg in DEVICE_REGISTRY:
        if cfg.mode == "drums+bass":
            out[cfg.label] = {
                "port_match": cfg.port_match,
                "drum_channel": cfg.channel,
                "bass_channel": cfg.bass_channel,
                "bass_root": None,
                "base_velocity": cfg.base_velocity,
                "drum_pattern": None,
                "bass_pattern": None,
                "type": "t8",
            }
        else:
            out[cfg.label] = {
                "port_match": cfg.port_match,
                "channel": cfg.channel,
                "root_note": cfg.root_note,
                "base_velocity": cfg.base_velocity,
                "note_fraction": cfg.gate_frac,
                "pattern": None,
                "type": "synth",
            }
    return out


DEVICES: dict[str, dict] = _compat_dict()
