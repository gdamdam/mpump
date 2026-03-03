import type { DeviceMode } from "../types";

export interface DeviceConfig {
  id: string;
  label: string;
  portMatch: string;
  mode: DeviceMode;
  channels: { main: number; bass?: number };
  rootNote: number;
  gateFraction: number;
  drumGateFraction: number;
  baseVelocity: number;
  drumMap?: Record<number, number>;
  hasKey: boolean;
  hasOctave: boolean;
  useProgramChange: boolean;
  sendClock: boolean;
  accent: string;
}

// Helper for synth defaults
const synth = (
  id: string, label: string, portMatch: string, accent: string,
  overrides?: Partial<DeviceConfig>,
): DeviceConfig => ({
  id, label, portMatch, mode: "synth",
  channels: { main: 0 }, rootNote: 45, gateFraction: 0.5, drumGateFraction: 0.1,
  baseVelocity: 100, hasKey: true, hasOctave: true,
  useProgramChange: false, sendClock: false, accent,
  ...overrides,
});

// Helper for drums defaults
const drums = (
  id: string, label: string, portMatch: string, accent: string,
  overrides?: Partial<DeviceConfig>,
): DeviceConfig => ({
  id, label, portMatch, mode: "drums",
  channels: { main: 9 }, rootNote: 36, gateFraction: 0.5, drumGateFraction: 0.1,
  baseVelocity: 100, hasKey: false, hasOctave: false,
  useProgramChange: false, sendClock: false, accent,
  ...overrides,
});

// Helper for drums+bass defaults
const drumsBass = (
  id: string, label: string, portMatch: string, accent: string,
  overrides?: Partial<DeviceConfig>,
): DeviceConfig => ({
  id, label, portMatch, mode: "drums+bass",
  channels: { main: 9, bass: 1 }, rootNote: 45, gateFraction: 0.5, drumGateFraction: 0.1,
  baseVelocity: 100, hasKey: true, hasOctave: true,
  useProgramChange: false, sendClock: false, accent,
  ...overrides,
});

export const DEVICE_REGISTRY: DeviceConfig[] = [
  // ── Roland AIRA Compact ──────────────────────────────────────────────
  synth("s1", "S-1", "S-1", "var(--s1)", { sendClock: true }),
  drumsBass("t8", "T-8", "T-8", "var(--t8)", { sendClock: true }),
  synth("j6", "J-6", "J-6", "var(--j6)", {
    rootNote: 60, gateFraction: 0.8, hasKey: false, hasOctave: false,
    useProgramChange: true, sendClock: true,
  }),

  // ── Roland ────────────────────────────────────────────────────────────
  drums("tr6s", "TR-6S", "TR-6S", "#e04040"),
  drums("tr8s", "TR-8S", "TR-8S", "#d63030"),
  drumsBass("mc101", "MC-101", "MC-101", "#00cc88", { channels: { main: 0, bass: 1 } }),
  drumsBass("mc707", "MC-707", "MC-707", "#00aa77", { channels: { main: 0, bass: 1 } }),
  synth("sh4d", "SH-4d", "SH-4d", "#44bbdd"),
  synth("tb3", "TB-3", "TB-3", "#33ff99"),
  synth("tb03", "TB-03", "Boutique", "#33ff77"),
  synth("jdxi", "JD-Xi", "JD-Xi", "#cc66ff"),
  synth("ju06a", "JU-06A", "Boutique", "#ff88aa"),
  synth("se02", "SE-02", "Boutique", "#ffaa33"),
  synth("gaia2", "GAIA 2", "GAIA 2", "#5599ff"),
  synth("sp404mk2", "SP-404MK2", "SP-404MK2", "#ff9900", {
    rootNote: 36, gateFraction: 0.3, hasKey: false, hasOctave: false,
  }),

  // ── Korg ──────────────────────────────────────────────────────────────
  synth("minilogue_xd", "minilogue xd", "minilogue xd", "#88ccff"),
  synth("monologue", "monologue", "monologue", "#ffcc00"),
  synth("nts1", "NTS-1", "NTS-1 digital kit", "#dddddd"),
  drumsBass("drumlogue", "drumlogue", "drumlogue", "#ff6688", { channels: { main: 9, bass: 0 } }),
  synth("minilogue", "minilogue", "minilogue", "#77bbee"),
  synth("wavestate", "wavestate", "wavestate", "#66ddaa"),
  synth("opsix", "opsix", "opsix", "#ff7744"),
  synth("modwave", "modwave", "modwave", "#aa88ff"),

  // ── Novation ──────────────────────────────────────────────────────────
  drumsBass("circuit_tracks", "Circuit Tracks", "Circuit Tracks", "#ff5500", {
    channels: { main: 9, bass: 0 },
  }),
  drums("circuit_rhythm", "Circuit Rhythm", "Circuit Rhythm", "#ee4400"),
  synth("bass_station_ii", "Bass Station II", "Bass Station II", "#ff3366"),
  synth("peak", "Peak", "Peak", "#88aaff"),

  // ── Arturia ───────────────────────────────────────────────────────────
  synth("microfreak", "MicroFreak", "MicroFreak", "#00ddff"),
  drums("drumbrute_impact", "DrumBrute Impact", "DrumBrute Impact", "#ffaa00"),

  // ── Behringer ─────────────────────────────────────────────────────────
  synth("td3", "TD-3", "TD-3", "#33ff66"),
  drums("rd6", "RD-6", "RD-6", "#ff5555", {
    channels: { main: 0 },
    drumMap: { 36: 36, 38: 40, 42: 42, 46: 46, 50: 39, 49: 51 },
  }),
  synth("crave", "Crave", "Crave", "#44ffaa"),
  synth("model_d", "Model D", "MODEL D", "#ddaa55"),
  synth("neutron", "Neutron", "Neutron", "#77ff55"),
  synth("poly_d", "Poly D", "Poly D", "#cc8844"),
  synth("k2", "K-2", "K-2", "#55ccaa"),
  synth("ms1", "MS-1", "MS-1", "#55ff88"),
  synth("deepmind12", "DeepMind 12", "DeepMind 12", "#4477cc"),
  synth("wasp_deluxe", "Wasp Deluxe", "Wasp Deluxe", "#cccc33"),

  // ── Elektron ──────────────────────────────────────────────────────────
  drums("syntakt", "Syntakt", "Syntakt", "#ff6600", { channels: { main: 0 } }),
  drums("digitakt", "Digitakt", "Digitakt", "#9933ff", {
    channels: { main: 0 },
    drumMap: { 36: 24, 38: 25, 42: 26, 46: 27, 50: 28, 49: 29 },
  }),
  drumsBass("model_cycles", "Model:Cycles", "Model:Cycles", "#33ccff", {
    channels: { main: 0, bass: 5 },
  }),
  drums("model_samples", "Model:Samples", "Model:Samples", "#ff33cc", {
    channels: { main: 0 },
  }),
  drums("analog_rytm", "Analog Rytm MKII", "Analog Rytm MKII", "#ee5500"),
  synth("analog_four", "Analog Four MKII", "Analog Four MKII", "#dd4400"),

  // ── Teenage Engineering ───────────────────────────────────────────────
  synth("opz", "OP-Z", "OP-Z", "#00ccff", { channels: { main: 4 } }),
  drumsBass("ep133", "EP-133 K.O. II", "EP-133", "#ffdd00", {
    channels: { main: 0, bass: 1 },
  }),

  // ── Sequential ────────────────────────────────────────────────────────
  synth("take5", "Take 5", "Take 5", "#7766dd"),

  // ── IK Multimedia ─────────────────────────────────────────────────────
  drums("uno_drum", "UNO Drum", "UNO Drum", "#ff4488"),
  synth("uno_synth", "UNO Synth", "UNO Synth", "#44ff88"),
];

export function findDeviceConfig(id: string): DeviceConfig | undefined {
  return DEVICE_REGISTRY.find(d => d.id === id);
}
