/**
 * Built-in sample packs — synthesized drum kits modeled after classic machines.
 * Generated at runtime via AudioContext, no external files needed.
 * Sorted alphabetically by name.
 */

import type { DrumVoiceParams } from "../types";

export interface SamplePack {
  id: string;
  name: string;
  genres?: string;
  voices: Record<number, DrumVoiceParams>;
}

export const SAMPLE_PACKS: SamplePack[] = [
  {
    id: "cr78", name: "CR-78", genres: "Early Electro, Italo, New Wave",
    voices: {
      36: { tune: -4, decay: 0.3, level: 0.85, click: 0.03, sweepDepth: 0.2, sweepRate: 0.4, filterCutoff: 0.65 },
      38: { tune: -1, decay: 0.2, level: 0.8, noiseMix: 0.35, filterCutoff: 0.6 },
      42: { tune: -2, decay: 0.3, level: 0.65, color: -0.6, filterCutoff: 0.55 },
      46: { tune: -3, decay: 0.3, level: 0.55, color: -0.6, filterCutoff: 0.55 },
      50: { tune: 0, decay: 0.1, level: 0.7, filterCutoff: 0.6 },
      49: { tune: -2, decay: 0.8, level: 0.5, color: -0.5, filterCutoff: 0.5 },
    },
  },
  {
    // Drumulator: 8-bit µ-law @ 28kHz, NO reconstruction filter → gritty, aliased, thin, crunchy
    id: "drumulator", name: "Drumulator", genres: "Electro, Synth-Pop, EBM, Synthwave",
    voices: {
      36: { tune: 3, decay: 0.18, level: 1, click: 0.35, sweepDepth: 0.25, sweepRate: 0.65, noiseMix: 0.1, color: 0.15, filterCutoff: 0.72 },
      38: { tune: 2, decay: 0.18, level: 0.95, noiseMix: 0.65, color: 0.35, filterCutoff: 0.75 },
      42: { tune: 2, decay: 0.2, level: 0.8, color: 0.45, filterCutoff: 0.72 },
      46: { tune: 1, decay: 0.25, level: 0.7, color: 0.45, filterCutoff: 0.72 },
      47: { tune: 1, decay: 0.2, level: 0.85, noiseMix: 0.08, color: 0.15, filterCutoff: 0.72 },
      50: { tune: 3, decay: 0.08, level: 0.85, color: 0.2, filterCutoff: 0.75 },
      56: { tune: 1, decay: 0.12, level: 0.75, color: 0.15, filterCutoff: 0.72 },
      49: { tune: 1, decay: 0.5, level: 0.6, color: 0.4, filterCutoff: 0.7 },
    },
  },
  {
    // DMX: 8-bit companded → ~12-bit effective, filtered output → punchy, warm, full
    id: "dmx", name: "DMX", genres: "Electro, Hip-Hop, Breakdance",
    voices: {
      36: { tune: -2, decay: 0.35, level: 1, click: 0.3, sweepDepth: 0.65, sweepRate: 0.4, color: -0.1, filterCutoff: 0.8 },
      38: { tune: -1, decay: 0.35, level: 1, noiseMix: 0.45, click: 0.15, color: -0.1, filterCutoff: 0.78 },
      42: { tune: -1, decay: 0.35, level: 0.85, color: -0.15, filterCutoff: 0.75 },
      46: { tune: -2, decay: 0.45, level: 0.75, color: -0.15, filterCutoff: 0.75 },
      50: { tune: 0, decay: 0.15, level: 0.9, color: -0.1, filterCutoff: 0.78 },
      49: { tune: -1, decay: 1.3, level: 0.7, color: -0.1, filterCutoff: 0.78 },
    },
  },
  {
    id: "linn", name: "LinnDrum", genres: "Synth-Pop, New Wave, Hip-Hop",
    voices: {
      36: { tune: -2, decay: 0.3, level: 1.0, click: 0.18, sweepDepth: 0.5, sweepRate: 0.4 },
      38: { tune: -1, decay: 0.6, level: 1.0, noiseMix: 0.5 },
      42: { tune: 3, decay: 0.5, level: 0.85, color: 0.2 },
      46: { tune: 2, decay: 0.7, level: 0.8, color: 0.2 },
      50: { tune: 2, decay: 0.3, level: 0.9 },
      49: { tune: 1, decay: 1.4, level: 0.7, color: 0.1 },
    },
  },
  {
    id: "606", name: "TR-606", genres: "Acid, Minimal, Electro",
    voices: {
      36: { tune: 3, decay: 0.2, level: 0.9, click: 0.08, sweepDepth: 0.25, sweepRate: 0.7 },
      38: { tune: 2, decay: 0.2, level: 0.9, noiseMix: 0.7 },
      42: { tune: 2, decay: 0.25, level: 0.8, color: 0.4 },
      46: { tune: 1, decay: 0.2, level: 0.7, color: 0.4 },
      50: { tune: 4, decay: 0.1, level: 0.85 },
      49: { tune: 1, decay: 0.6, level: 0.6, color: 0.3 },
    },
  },
  {
    id: "707", name: "TR-707", genres: "Italo, Early House, Synth-Pop",
    voices: {
      36: { tune: 1, decay: 0.3, level: 1, click: 0.2, sweepDepth: 0.4, sweepRate: 0.5 },
      38: { tune: 1, decay: 0.3, level: 0.95, noiseMix: 0.5 },
      42: { tune: 1, decay: 0.4, level: 0.85, color: 0.2 },
      46: { tune: 0, decay: 0.4, level: 0.75, color: 0.2 },
      50: { tune: 2, decay: 0.1, level: 0.9 },
      49: { tune: 0, decay: 1.0, level: 0.65, color: 0.1 },
    },
  },
  {
    id: "808", name: "TR-808", genres: "Hip-Hop, Trap, Electro",
    voices: {
      36: { tune: -2, decay: 0.3, level: 1, click: 0.05, sweepDepth: 0.7, sweepRate: 0.3 },
      38: { tune: 0, decay: 0.4, level: 0.9, noiseMix: 0.7 },
      42: { tune: 0, decay: 0.5, level: 0.8, color: -0.3 },
      46: { tune: -1, decay: 0.6, level: 0.75, color: -0.3 },
      50: { tune: 2, decay: 0.4, level: 0.85 },
      49: { tune: 0, decay: 1.2, level: 0.7, color: -0.3 },
    },
  },
  {
    id: "909", name: "TR-909", genres: "Techno, House, Trance",
    voices: {
      36: { tune: 2, decay: 0.3, level: 1, click: 0.3, sweepDepth: 0.5, sweepRate: 0.6 },
      38: { tune: 1, decay: 0.5, level: 1, noiseMix: 0.5 },
      42: { tune: 0, decay: 0.6, level: 0.9, color: 0.3 },
      46: { tune: -1, decay: 0.5, level: 0.8, color: 0.3 },
      50: { tune: 4, decay: 0.2, level: 0.9 },
      49: { tune: 3, decay: 1.0, level: 0.7, color: 0.2 },
    },
  },
];
