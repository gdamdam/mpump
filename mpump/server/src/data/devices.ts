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

export const DEVICE_REGISTRY: DeviceConfig[] = [
  {
    id: "s1", label: "S-1", portMatch: "S-1",
    mode: "synth",
    channels: { main: 0 },
    rootNote: 45, gateFraction: 0.5, drumGateFraction: 0.1,
    baseVelocity: 100,
    hasKey: true, hasOctave: true,
    useProgramChange: false, sendClock: true,
    accent: "var(--s1)",
  },
  {
    id: "t8", label: "T-8", portMatch: "T-8",
    mode: "drums+bass",
    channels: { main: 9, bass: 1 },
    rootNote: 45, gateFraction: 0.5, drumGateFraction: 0.1,
    baseVelocity: 100,
    hasKey: true, hasOctave: true,
    useProgramChange: false, sendClock: true,
    accent: "var(--t8)",
  },
  {
    id: "j6", label: "J-6", portMatch: "J-6",
    mode: "synth",
    channels: { main: 0 },
    rootNote: 60, gateFraction: 0.8, drumGateFraction: 0.1,
    baseVelocity: 100,
    hasKey: false, hasOctave: false,
    useProgramChange: true, sendClock: true,
    accent: "var(--j6)",
  },
  // ── Phase 2 devices ─────────────────────────────────────────────────
  {
    id: "syntakt", label: "Syntakt", portMatch: "Syntakt",
    mode: "drums",
    channels: { main: 0 },
    rootNote: 36, gateFraction: 0.5, drumGateFraction: 0.1,
    baseVelocity: 100,
    hasKey: false, hasOctave: false,
    useProgramChange: false, sendClock: false,
    accent: "#ff6600",
  },
  {
    id: "digitakt", label: "Digitakt", portMatch: "Digitakt",
    mode: "drums",
    channels: { main: 0 },
    rootNote: 24, gateFraction: 0.5, drumGateFraction: 0.1,
    baseVelocity: 100,
    drumMap: { 36: 24, 38: 25, 42: 26, 46: 27, 50: 28, 49: 29 },
    hasKey: false, hasOctave: false,
    useProgramChange: false, sendClock: false,
    accent: "#9933ff",
  },
  {
    id: "opz", label: "OP-Z", portMatch: "OP-Z",
    mode: "synth",
    channels: { main: 4 },
    rootNote: 45, gateFraction: 0.5, drumGateFraction: 0.1,
    baseVelocity: 100,
    hasKey: true, hasOctave: true,
    useProgramChange: false, sendClock: false,
    accent: "#00ccff",
  },
];

export function findDeviceConfig(id: string): DeviceConfig | undefined {
  return DEVICE_REGISTRY.find(d => d.id === id);
}
