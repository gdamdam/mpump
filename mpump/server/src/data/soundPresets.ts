/**
 * Sound presets for synth, bass, and drum kit.
 */

import type { SynthParams, DrumVoiceParams } from "../types";
import { DEFAULT_DRUM_VOICE, DEFAULT_SYNTH_PARAMS } from "../types";

export interface SynthPreset {
  name: string;
  genres?: string;
  group?: string;
  params: SynthParams;
}

/** Group presets by group field, sorted alphabetically. Returns [groupName, [originalIndex, preset][]][] */
export function groupPresets<T extends { name: string; group?: string }>(presets: T[]): [string, [number, T][]][] {
  const groups = new Map<string, [number, T][]>();
  for (let i = 0; i < presets.length; i++) {
    const p = presets[i];
    const g = p.group || "";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push([i, p]);
  }
  // Sort groups alphabetically, ungrouped ("") first
  const sorted = [...groups.entries()].sort((a, b) => {
    if (a[0] === "") return -1;
    if (b[0] === "") return 1;
    return a[0].localeCompare(b[0]);
  });
  // Sort presets within each group alphabetically
  for (const [, items] of sorted) items.sort((a, b) => a[1].name.localeCompare(b[1].name));
  return sorted;
}

export interface DrumKitPreset {
  name: string;
  genres?: string;
  voices: Record<number, DrumVoiceParams>;
}

// ── Synth presets (18) ───────────────────────────────────────────────────

export const SYNTH_PRESETS: SynthPreset[] = [
  {
    name: "Default",
    params: { ...DEFAULT_SYNTH_PARAMS, gain: 1.2 },
  },
  {
    name: "Classic Saw", group: "Leads", genres: "Techno, House, EDM",
    params: {
      oscType: "sawtooth", attack: 0.005, decay: 0.15, sustain: 0.6,
      release: 0.06, filterOn: true, filterType: "lowpass", cutoff: 2800, resonance: 5, subOsc: true, subLevel: 0.4, detune: 0, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", filterEnvDepth: 0.3, filterModel: "mog", gain: 1.15,
    },
  },
  {
    name: "Square Lead", group: "Keys", genres: "Techno, Electro, Retro",
    params: {
      oscType: "square", attack: 0.01, decay: 0.1, sustain: 0.7,
      release: 0.1, filterOn: true, filterType: "lowpass", cutoff: 5000, resonance: 2, subOsc: true, subLevel: 0.3, detune: 0, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", filterEnvDepth: 0.15, gain: 1.2,
    },
  },
  {
    name: "Warm Pad", group: "Pads", genres: "Ambient, Dub Techno, Deep House",
    params: {
      oscType: "sawtooth", attack: 0.05, decay: 0.5, sustain: 0.9,
      release: 0.4, filterOn: true, filterType: "lowpass", cutoff: 1400, resonance: 0.8, subOsc: true, subLevel: 0.4, detune: 0, lfoOn: true, lfoSync: false, lfoRate: 0.8, lfoDepth: 0.15, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", unison: 3, unisonSpread: 15, noteLength: 4,
    },
  },
  {
    name: "Acid Squelch", group: "Squelch", genres: "Acid Techno, Acid House",
    params: {
      oscType: "sawtooth", attack: 0.001, decay: 0.08, sustain: 0.2,
      release: 0.04, filterOn: true, filterType: "lowpass", cutoff: 800, resonance: 15, subOsc: false, subLevel: 0.5, detune: 0, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", filterEnvDepth: 0.7, filterModel: "303", filterDrive: 0.3, gain: 1.4,
    },
  },
  {
    name: "Digital Bell", group: "Keys", genres: "Ambient, IDM, Chillout",
    params: {
      oscType: "fm", attack: 0.001, decay: 0.35, sustain: 0.1,
      release: 0.2, filterOn: true, filterType: "lowpass", cutoff: 3000, resonance: 1, subOsc: false, subLevel: 0.2, detune: 0, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", fmRatio: 2, fmIndex: 3, gain: 1.5,
    },
  },
  {
    name: "Pluck Stab", group: "Plucks", genres: "House, Tech House, EDM",
    params: {
      oscType: "sawtooth", attack: 0.001, decay: 0.04, sustain: 0.05,
      release: 0.02, filterOn: true, filterType: "lowpass", cutoff: 5000, resonance: 3, subOsc: true, subLevel: 0.25, detune: 6, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", filterEnvDepth: 0.4, gain: 1.4,
    },
  },
  {
    name: "Dark Drone", group: "Pads", genres: "Dark Ambient, Industrial, Dub Techno",
    params: {
      oscType: "sawtooth", attack: 0.04, decay: 0.4, sustain: 0.85,
      release: 0.3, filterOn: true, filterType: "lowpass", cutoff: 900, resonance: 3, subOsc: true, subLevel: 0.6, detune: 0, lfoOn: true, lfoSync: false, lfoRate: 0.3, lfoDepth: 0.25, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", unison: 3, unisonSpread: 20, noteLength: 4, gain: 1.1,
    },
  },
  {
    name: "Shimmer", group: "Pads", genres: "Ambient, Chillout, Trance",
    params: {
      oscType: "sine", attack: 0.03, decay: 0.3, sustain: 0.5,
      release: 0.25, filterOn: true, filterType: "lowpass", cutoff: 7000, resonance: 0.5, subOsc: true, subLevel: 0.5, detune: 0, lfoOn: true, lfoSync: false, lfoRate: 2.5, lfoDepth: 0.1, lfoDivision: "1/4", lfoShape: "triangle", lfoTarget: "pitch", unison: 3, unisonSpread: 20, noteLength: 4,
    },
  },
  {
    name: "Screamer", group: "Aggressive", genres: "Techno, Hardstyle, Industrial",
    params: {
      oscType: "sawtooth", attack: 0.003, decay: 0.08, sustain: 0.5,
      release: 0.04, filterOn: true, filterType: "lowpass", cutoff: 7000, resonance: 12, subOsc: true, subLevel: 0.3, detune: 0, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", filterEnvDepth: 0.5, unison: 3, unisonSpread: 10, filterModel: "mog", gain: 1.1,
    },
  },
  {
    name: "Cosmic", group: "Pads", genres: "Ambient, Psytrance, Space Disco",
    params: {
      oscType: "sine", attack: 0.04, decay: 0.4, sustain: 0.8,
      release: 0.5, filterOn: true, filterType: "lowpass", cutoff: 5000, resonance: 1, subOsc: true, subLevel: 0.3, detune: 0, lfoOn: true, lfoSync: false, lfoRate: 0.4, lfoDepth: 0.2, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "pitch", unison: 3, unisonSpread: 25, noteLength: 4,
    },
  },
  {
    name: "Razor", group: "Aggressive", genres: "Electro, Industrial, DnB",
    params: {
      oscType: "square", attack: 0.003, decay: 0.06, sustain: 0.3,
      release: 0.03, filterOn: true, filterType: "bandpass", cutoff: 3000, resonance: 12, subOsc: false, subLevel: 0, detune: 0, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", filterEnvDepth: 0.5, filterDrive: 0.2, gain: 1.4,
    },
  },
  {
    name: "Supersaw", group: "Leads", genres: "Trance, EDM, Future Bass",
    params: {
      oscType: "sawtooth", attack: 0.005, decay: 0.2, sustain: 0.7,
      release: 0.1, filterOn: true, filterType: "lowpass", cutoff: 4500, resonance: 3, subOsc: true, subLevel: 0.6, detune: 0, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", unison: 7, unisonSpread: 25,
    },
  },
  {
    name: "Ethereal", group: "Pads", genres: "Ambient, Chillout, Downtempo",
    params: {
      oscType: "triangle", attack: 0.04, decay: 0.3, sustain: 0.6,
      release: 0.4, filterOn: true, filterType: "highpass", cutoff: 800, resonance: 2, subOsc: false, subLevel: 0, detune: 0, lfoOn: true, lfoSync: false, lfoRate: 0.5, lfoDepth: 0.3, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "pitch", unison: 3, unisonSpread: 15, noteLength: 4, gain: 1.4,
    },
  },
  {
    name: "House Stab", group: "Plucks", genres: "House, Tech House",
    params: {
      oscType: "sawtooth", attack: 0.001, decay: 0.06, sustain: 0.0,
      release: 0.03, filterOn: true, filterType: "lowpass", cutoff: 2000, resonance: 8, subOsc: true, subLevel: 0.3, detune: 0, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", filterEnvDepth: 0.6, filterDecay: 0.025, gain: 1.4,
    },
  },
  {
    name: "Trance Arp", group: "Plucks", genres: "Trance, EDM",
    params: {
      oscType: "sawtooth", attack: 0.001, decay: 0.08, sustain: 0.15,
      release: 0.05, filterOn: true, filterType: "lowpass", cutoff: 5000, resonance: 2, subOsc: true, subLevel: 0.2, detune: 0, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", filterEnvDepth: 0.3, unison: 5, unisonSpread: 20, gain: 1.15,
    },
  },
  {
    name: "EDM Pluck", group: "Plucks", genres: "EDM, Future Bass, Progressive",
    params: {
      oscType: "sawtooth", attack: 0.001, decay: 0.04, sustain: 0.0,
      release: 0.02, filterOn: true, filterType: "lowpass", cutoff: 6000, resonance: 3, subOsc: true, subLevel: 0.4, detune: 0, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", filterEnvDepth: 0.5, unison: 5, unisonSpread: 15,
    },
  },
  {
    name: "Dub Chord", group: "Pads", genres: "Dub Techno, Deep House",
    params: {
      oscType: "triangle", attack: 0.03, decay: 0.4, sustain: 0.7,
      release: 0.5, filterOn: true, filterType: "lowpass", cutoff: 1000, resonance: 1.5, subOsc: true, subLevel: 0.3, detune: 0, lfoOn: true, lfoSync: false, lfoRate: 0.4, lfoDepth: 0.2, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", unison: 2, unisonSpread: 8, noteLength: 4, gain: 1.15,
    },
  },
  {
    name: "Neuro", group: "Aggressive", genres: "DnB, Neurofunk",
    params: {
      oscType: "sawtooth", attack: 0.002, decay: 0.1, sustain: 0.4,
      release: 0.05, filterOn: true, filterType: "lowpass", cutoff: 3000, resonance: 8, subOsc: true, subLevel: 0.4, detune: 10, lfoOn: true, lfoSync: true, lfoRate: 2, lfoDepth: 0.7, lfoDivision: "1/16", lfoShape: "sine", lfoTarget: "cutoff", filterEnvDepth: 0.4, filterModel: "mog", gain: 1.2,
    },
  },
  // ── New presets using AudioWorklet features ──────────────────────────
  {
    name: "PWM Pad", group: "Pads", genres: "Techno, Ambient, Dub Techno",
    params: {
      oscType: "pwm", attack: 0.04, decay: 0.4, sustain: 0.8,
      release: 0.5, filterOn: true, filterType: "lowpass", cutoff: 2000, resonance: 1.5, subOsc: true, subLevel: 0.3, detune: 0, lfoOn: true, lfoSync: false, lfoRate: 0.3, lfoDepth: 0.15, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", unison: 2, unisonSpread: 10, noteLength: 4,
    },
  },
  {
    name: "Sync Lead", group: "Leads", genres: "Electro, Techno, Synthwave",
    params: {
      oscType: "sync", attack: 0.003, decay: 0.12, sustain: 0.6,
      release: 0.08, filterOn: true, filterType: "lowpass", cutoff: 6000, resonance: 3, subOsc: true, subLevel: 0.3, detune: 8, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", syncRatio: 3, filterEnvDepth: 0.25, gain: 1.3,
    },
  },
  {
    name: "FM Bell", group: "Keys", genres: "IDM, Ambient, Glitch",
    params: {
      oscType: "fm", attack: 0.001, decay: 0.4, sustain: 0.1,
      release: 0.2, filterOn: true, filterType: "lowpass", cutoff: 3500, resonance: 1, subOsc: false, subLevel: 0.5, detune: 0, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", fmRatio: 3.5, fmIndex: 8, gain: 1.5,
    },
  },
  {
    name: "FM Metallic", group: "Keys", genres: "Glitch, IDM, Electro",
    params: {
      oscType: "fm", attack: 0.001, decay: 0.15, sustain: 0.2,
      release: 0.1, filterOn: true, filterType: "lowpass", cutoff: 3000, resonance: 4, subOsc: false, subLevel: 0.5, detune: 0, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", fmRatio: 7.01, fmIndex: 10, filterEnvDepth: 0.3, gain: 1.5,
    },
  },
  {
    name: "Wavetable Pad", group: "Pads", genres: "Ambient, Downtempo, Chillout",
    params: {
      oscType: "wavetable", attack: 0.05, decay: 0.4, sustain: 0.85,
      release: 0.6, filterOn: true, filterType: "lowpass", cutoff: 3000, resonance: 1, subOsc: true, subLevel: 0.3, detune: 0, lfoOn: true, lfoSync: false, lfoRate: 0.2, lfoDepth: 0.1, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", wavetable: "pad", wavetablePos: 0.4, unison: 2, unisonSpread: 12, noteLength: 4,
    },
  },
  {
    name: "Organ", group: "Keys", genres: "House, Deep House, Gospel House",
    params: {
      oscType: "wavetable", attack: 0.008, decay: 0.2, sustain: 0.8,
      release: 0.1, filterOn: false, filterType: "lowpass", cutoff: 6000, resonance: 1, subOsc: false, subLevel: 0.5, detune: 3, lfoOn: true, lfoSync: false, lfoRate: 5.5, lfoDepth: 0.02, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "pitch", wavetable: "organ", wavetablePos: 0.3, gain: 1.4,
    },
  },
  {
    name: "Hoover", group: "Leads", genres: "Jungle, Rave, Hardcore",
    params: {
      oscType: "pwm", attack: 0.005, decay: 0.15, sustain: 0.7,
      release: 0.08, filterOn: true, filterType: "lowpass", cutoff: 4000, resonance: 5, subOsc: true, subLevel: 0.5, detune: 0, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", unison: 5, unisonSpread: 25, filterModel: "mog", filterEnvDepth: 0.3,
    },
  },
  {
    name: "Sync Sweep", group: "Leads", genres: "Trance, Progressive, EDM",
    params: {
      oscType: "sync", attack: 0.005, decay: 0.2, sustain: 0.5,
      release: 0.1, filterOn: true, filterType: "lowpass", cutoff: 5000, resonance: 2, subOsc: true, subLevel: 0.3, detune: 0, lfoOn: true, lfoSync: true, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/2", lfoShape: "triangle", lfoTarget: "cutoff", syncRatio: 5, filterEnvDepth: 0.4, gain: 1.3,
    },
  },
  {
    name: "Vocal Pad", group: "Pads", genres: "Deep House, Garage, Chillout",
    params: {
      oscType: "wavetable", attack: 0.04, decay: 0.3, sustain: 0.7,
      release: 0.3, filterOn: true, filterType: "lowpass", cutoff: 2500, resonance: 2, subOsc: true, subLevel: 0.2, detune: 0, lfoOn: true, lfoSync: false, lfoRate: 0.15, lfoDepth: 0.1, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", wavetable: "vocal", wavetablePos: 0.5, unison: 2, unisonSpread: 10, noteLength: 2, gain: 1.15,
    },
  },
  {
    name: "Gritty PWM", group: "Aggressive", genres: "Breakbeat, Industrial, Techno",
    params: {
      oscType: "pwm", attack: 0.003, decay: 0.1, sustain: 0.5,
      release: 0.05, filterOn: true, filterType: "lowpass", cutoff: 3500, resonance: 10, subOsc: true, subLevel: 0.3, detune: 0, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", filterEnvDepth: 0.5, filterModel: "mog", filterDrive: 0.5, gain: 1.15,
    },
  },
  {
    name: "String Pad", group: "Pads", genres: "Trance, Ambient, House",
    params: {
      oscType: "sawtooth", attack: 0.08, decay: 0.5, sustain: 0.8,
      release: 0.6, filterOn: true, filterType: "lowpass", cutoff: 1500, resonance: 1, subOsc: true, subLevel: 0.2, detune: 0, lfoOn: true, lfoSync: false, lfoRate: 0.3, lfoDepth: 0.08, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", unison: 3, unisonSpread: 12, noteLength: 4, filterEnvDepth: 0.25, filterDecay: 0.5,
    },
  },
  {
    name: "Pluck Lead", group: "Leads", genres: "Trance, EDM, Progressive",
    params: {
      oscType: "sawtooth", attack: 0.001, decay: 0.06, sustain: 0.1,
      release: 0.03, filterOn: true, filterType: "lowpass", cutoff: 6000, resonance: 3, subOsc: true, subLevel: 0.3, detune: 0, unison: 3, unisonSpread: 12, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", filterEnvDepth: 0.5,
    },
  },
  {
    name: "Sub Lead", group: "Leads", genres: "DnB, Dubstep, Bass Music",
    params: {
      oscType: "triangle", attack: 0.005, decay: 0.3, sustain: 0.9,
      release: 0.15, filterOn: true, filterType: "lowpass", cutoff: 400, resonance: 3, subOsc: true, subLevel: 0.8, detune: 0, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", filterModel: "mog", gain: 1.2,
    },
  },
  {
    name: "Rhodes Keys", group: "Keys", genres: "Lo-Fi, Deep House, Downtempo",
    params: {
      oscType: "fm", attack: 0.01, decay: 0.4, sustain: 0.5,
      release: 0.15, filterOn: true, filterType: "lowpass", cutoff: 3000, resonance: 1, subOsc: false, subLevel: 0.5, detune: 5, lfoOn: true, lfoSync: false, lfoRate: 3, lfoDepth: 0.05, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "pitch", fmRatio: 1, fmIndex: 1.5, gain: 1.5,
    },
  },
];

// ── Bass presets (14) ────────────────────────────────────────────────────

export const BASS_PRESETS: SynthPreset[] = [
  {
    name: "Default",
    params: { ...DEFAULT_SYNTH_PARAMS, cutoff: 1800, subLevel: 0.6, filterEnvDepth: 0.1, gain: 1.15 },
  },
  {
    name: "Deep Sub", group: "Deep", genres: "Deep House, Dub Techno, Ambient",
    params: {
      oscType: "sine", attack: 0.005, decay: 0.2, sustain: 0.8,
      release: 0.1, filterOn: false, filterType: "lowpass", cutoff: 600, resonance: 1, subOsc: true, subLevel: 0.7, detune: 0, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", gain: 1.3,
    },
  },
  {
    name: "Acid Bass", group: "Acid", genres: "Acid Techno, Acid House",
    params: {
      oscType: "sawtooth", attack: 0.001, decay: 0.12, sustain: 0.35,
      release: 0.05, filterOn: true, filterType: "lowpass", cutoff: 600, resonance: 12, subOsc: true, subLevel: 0.3, detune: 0, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", filterEnvDepth: 0.5, filterModel: "303", filterDrive: 0.2, gain: 1.2,
    },
  },
  {
    name: "Square Bass", group: "Sustained", genres: "Techno, Electro, Retro",
    params: {
      oscType: "square", attack: 0.005, decay: 0.15, sustain: 0.5,
      release: 0.06, filterOn: true, filterType: "lowpass", cutoff: 1500, resonance: 4, subOsc: true, subLevel: 0.4, detune: 0, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", filterEnvDepth: 0.15,
    },
  },
  {
    name: "Pluck Bass", group: "Plucks", genres: "House, Tech House, EDM",
    params: {
      oscType: "sawtooth", attack: 0.001, decay: 0.06, sustain: 0.1,
      release: 0.03, filterOn: true, filterType: "lowpass", cutoff: 3000, resonance: 6, subOsc: true, subLevel: 0.4, detune: 0, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", filterEnvDepth: 0.5, gain: 1.2,
    },
  },
  {
    name: "Warm Bass", group: "Sustained", genres: "Deep House, Lo-Fi, Downtempo",
    params: {
      oscType: "triangle", attack: 0.008, decay: 0.2, sustain: 0.7,
      release: 0.15, filterOn: true, filterType: "lowpass", cutoff: 800, resonance: 3, subOsc: true, subLevel: 0.5, detune: 0, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", filterEnvDepth: 0.2, filterModel: "mog", gain: 1.2,
    },
  },
  {
    name: "Wobble", group: "Wobble", genres: "Dubstep, DnB, Riddim",
    params: {
      oscType: "sawtooth", attack: 0.005, decay: 0.15, sustain: 0.7,
      release: 0.08, filterOn: true, filterType: "lowpass", cutoff: 1500, resonance: 8, subOsc: true, subLevel: 0.4, detune: 0, lfoOn: true, lfoSync: true, lfoRate: 2, lfoDepth: 0.8, lfoDivision: "1/8", lfoShape: "sine", lfoTarget: "cutoff", filterEnvDepth: 0.2, filterModel: "mog", gain: 1.1,
    },
  },
  {
    name: "Distorted", group: "Wobble", genres: "Industrial, Techno, Hardstyle",
    params: {
      oscType: "square", attack: 0.001, decay: 0.08, sustain: 0.6,
      release: 0.03, filterOn: true, filterType: "lowpass", cutoff: 4000, resonance: 8, subOsc: true, subLevel: 0.3, detune: 0, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", filterEnvDepth: 0.3, filterModel: "303", filterDrive: 0.5,
    },
  },
  {
    name: "Reese", group: "Sustained", genres: "DnB, Jungle, Neurofunk",
    params: {
      oscType: "sawtooth", attack: 0.005, decay: 0.2, sustain: 0.7,
      release: 0.1, filterOn: true, filterType: "lowpass", cutoff: 800, resonance: 3, subOsc: true, subLevel: 0.7, detune: 0, lfoOn: true, lfoSync: false, lfoRate: 0.6, lfoDepth: 0.2, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", filterModel: "mog", unison: 2, unisonSpread: 12, gain: 1.1,
    },
  },
  {
    name: "Foghorn", group: "Deep", genres: "Dub, Ambient, Minimal",
    params: {
      oscType: "triangle", attack: 0.005, decay: 0.3, sustain: 0.9,
      release: 0.15, filterOn: true, filterType: "lowpass", cutoff: 300, resonance: 4, subOsc: true, subLevel: 0.8, detune: 0, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", filterModel: "mog", gain: 1.3,
    },
  },
  {
    name: "Zapper", group: "Plucks", genres: "Electro, Glitch, IDM",
    params: {
      oscType: "square", attack: 0.001, decay: 0.03, sustain: 0.0,
      release: 0.02, filterOn: true, filterType: "lowpass", cutoff: 6000, resonance: 7, subOsc: false, subLevel: 0.5, detune: 0, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", filterEnvDepth: 0.6, gain: 1.5,
    },
  },
  {
    name: "House Pump", group: "Plucks", genres: "House, Tech House",
    params: {
      oscType: "sine", attack: 0.005, decay: 0.12, sustain: 0.1,
      release: 0.05, filterOn: false, filterType: "lowpass", cutoff: 800, resonance: 2, subOsc: true, subLevel: 0.6, detune: 0, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", gain: 1.2,
    },
  },
  {
    name: "Garage Bass", group: "Plucks", genres: "UK Garage, 2-Step",
    params: {
      oscType: "triangle", attack: 0.012, decay: 0.2, sustain: 0.5,
      release: 0.1, filterOn: true, filterType: "lowpass", cutoff: 1000, resonance: 3, subOsc: true, subLevel: 0.5, detune: 0, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", gain: 1.2,
    },
  },
  {
    name: "UK Sub", group: "Sustained", genres: "UK Garage, 2-Step, Bass Music",
    params: {
      oscType: "sawtooth", attack: 0.008, decay: 0.2, sustain: 0.6,
      release: 0.1, filterOn: true, filterType: "lowpass", cutoff: 700, resonance: 3, subOsc: true, subLevel: 0.6, detune: 0, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", filterEnvDepth: 0.15, filterModel: "mog", filterDrive: 0.15, gain: 1.2,
    },
  },
  {
    name: "Trance Sub", group: "Deep", genres: "Trance, Progressive",
    params: {
      oscType: "sine", attack: 0.015, decay: 0.15, sustain: 0.7,
      release: 0.08, filterOn: true, filterType: "lowpass", cutoff: 300, resonance: 3, subOsc: true, subLevel: 0.8, detune: 0, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", filterEnvDepth: 0.15, filterDecay: 0.06, filterModel: "mog", gain: 1.3,
    },
  },
  // ── New bass presets using AudioWorklet features ─────────────────────
  {
    name: "303 Acid", group: "Acid", genres: "Acid Techno, Acid House, Chicago",
    params: {
      oscType: "square", attack: 0.001, decay: 0.08, sustain: 0.25,
      release: 0.03, filterOn: true, filterType: "lowpass", cutoff: 600, resonance: 16, subOsc: false, subLevel: 0.5, detune: 0, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", filterEnvDepth: 0.8, filterModel: "303", filterDrive: 0.5, gain: 1.3,
    },
  },
  {
    name: "FM Bass", group: "Plucks", genres: "IDM, Glitch, Electro",
    params: {
      oscType: "fm", attack: 0.001, decay: 0.12, sustain: 0.2,
      release: 0.05, filterOn: true, filterType: "lowpass", cutoff: 2000, resonance: 3, subOsc: true, subLevel: 0.5, detune: 0, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", fmRatio: 1, fmIndex: 3, filterEnvDepth: 0.3, gain: 1.3,
    },
  },
  {
    name: "PWM Bass", group: "Sustained", genres: "Techno, Electro, Synthwave",
    params: {
      oscType: "pwm", attack: 0.005, decay: 0.15, sustain: 0.6,
      release: 0.08, filterOn: true, filterType: "lowpass", cutoff: 1200, resonance: 4, subOsc: true, subLevel: 0.4, detune: 0, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", filterModel: "mog", gain: 1.15,
    },
  },
  {
    name: "Jungle Bass", group: "Sustained", genres: "Jungle, Rave, Breakbeat",
    params: {
      oscType: "pwm", attack: 0.003, decay: 0.2, sustain: 0.65,
      release: 0.1, filterOn: true, filterType: "lowpass", cutoff: 900, resonance: 5, subOsc: true, subLevel: 0.6, detune: 0, lfoOn: true, lfoSync: false, lfoRate: 0.4, lfoDepth: 0.15, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", filterModel: "mog", unison: 2, unisonSpread: 12, gain: 1.1,
    },
  },
  {
    name: "Sync Bass", group: "Plucks", genres: "Electro, Techno, Synthwave",
    params: {
      oscType: "sync", attack: 0.001, decay: 0.1, sustain: 0.3,
      release: 0.04, filterOn: true, filterType: "lowpass", cutoff: 2500, resonance: 6, subOsc: true, subLevel: 0.4, detune: 0, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", syncRatio: 2.5, filterEnvDepth: 0.4, gain: 1.2,
    },
  },
  {
    name: "Dub Bass", group: "Deep", genres: "Dub Techno, Dub, Ambient",
    params: {
      oscType: "triangle", attack: 0.01, decay: 0.25, sustain: 0.8,
      release: 0.15, filterOn: true, filterType: "lowpass", cutoff: 500, resonance: 2, subOsc: true, subLevel: 0.8, detune: 0, lfoOn: true, lfoSync: false, lfoRate: 0.2, lfoDepth: 0.1, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", filterModel: "mog", gain: 1.25,
    },
  },
  {
    name: "Arp Bass", group: "Plucks", genres: "Synthwave, Electro, Retro",
    params: {
      oscType: "square", attack: 0.001, decay: 0.05, sustain: 0.15,
      release: 0.03, filterOn: true, filterType: "lowpass", cutoff: 1500, resonance: 6, subOsc: true, subLevel: 0.5, detune: 0, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", filterEnvDepth: 0.5, filterDecay: 0.03, gain: 1.2,
    },
  },
  {
    name: "Psy Bass", group: "Plucks", genres: "Psytrance, Goa, Progressive",
    params: {
      oscType: "sawtooth", attack: 0.001, decay: 0.05, sustain: 0.05,
      release: 0.03, filterOn: true, filterType: "lowpass", cutoff: 3000, resonance: 5, subOsc: true, subLevel: 0.3, detune: 0, lfoOn: false, lfoSync: false, lfoRate: 2, lfoDepth: 0.5, lfoDivision: "1/4", lfoShape: "sine", lfoTarget: "cutoff", filterEnvDepth: 0.4, filterModel: "mog", gain: 1.3,
    },
  },
];

// ── Drum kit presets (21) ────────────────────────────────────────────────

const kit = (overrides: Partial<Record<number, Partial<DrumVoiceParams>>>): Record<number, DrumVoiceParams> => {
  const base: Record<number, DrumVoiceParams> = {
    36: { ...DEFAULT_DRUM_VOICE },
    37: { ...DEFAULT_DRUM_VOICE },
    38: { ...DEFAULT_DRUM_VOICE },
    42: { ...DEFAULT_DRUM_VOICE },
    46: { ...DEFAULT_DRUM_VOICE },
    47: { ...DEFAULT_DRUM_VOICE },
    49: { ...DEFAULT_DRUM_VOICE },
    50: { ...DEFAULT_DRUM_VOICE },
    51: { ...DEFAULT_DRUM_VOICE },
  };
  for (const [note, params] of Object.entries(overrides)) {
    base[Number(note)] = { ...base[Number(note)], ...params };
  }
  return base;
};

export const DRUM_KIT_PRESETS: DrumKitPreset[] = [
  { name: "Default", voices: kit({
    36: { decay: 0.3 },
    38: { decay: 0.4 },
    46: { tune: -1, decay: 0.5 },
    50: { decay: 0.3 },
  })},
  { name: "Boom Box", genres: "Hip-Hop, Breakbeat, Old School", voices: kit({
    36: { tune: -5, decay: 1.0, level: 1, click: 0.25, sweepDepth: 0.7, sweepRate: 0.3 },
    38: { tune: 3, decay: 0.3, level: 1, noiseMix: 0.5 },
    42: { tune: 2, decay: 0.4, level: 0.85, color: 0.0 },
    46: { tune: 0, decay: 0.2, level: 0.75, color: 0.0 },
    50: { tune: 0, decay: 0.1, level: 0.9 },
    49: { tune: 0, decay: 0.8, level: 0.7 },
  })},
  { name: "DnB", genres: "DnB, Jungle, Liquid", voices: kit({
    36: { tune: 4, decay: 0.3, level: 1, click: 0.3, sweepDepth: 0.6, sweepRate: 0.8 },
    38: { tune: 3, decay: 0.2, level: 1, noiseMix: 0.6 },
    42: { tune: 2, decay: 0.3, level: 0.85, color: 0.4 },
    46: { tune: 1, decay: 0.2, level: 0.7, color: 0.4 },
  })},
  { name: "Dub", genres: "Dub Techno, Dub, Ambient", voices: kit({
    36: { tune: -3, decay: 0.8, level: 0.9, click: 0.05, sweepDepth: 0.6, sweepRate: 0.3, filterCutoff: 0.7 },
    38: { tune: -2, decay: 0.3, level: 0.5, noiseMix: 0.3, filterCutoff: 0.6 },
    42: { tune: -1, decay: 0.4, level: 0.4, color: -0.6, filterCutoff: 0.55 },
    46: { tune: -2, decay: 0.5, level: 0.35, color: -0.6, filterCutoff: 0.55 },
  })},
  { name: "Electro", genres: "Electro, Breakdance, Miami Bass", voices: kit({
    36: { tune: -3, decay: 0.3, level: 1, click: 0.08, sweepDepth: 0.65, sweepRate: 0.5 },
    38: { tune: 0, decay: 0.5, level: 0.9, noiseMix: 0.6 },
    42: { tune: 0, decay: 0.5, level: 0.8, color: -0.2 },
    46: { tune: -1, decay: 0.6, level: 0.7, color: -0.2 },
    50: { tune: 3, decay: 0.1, level: 0.9 },
  })},
  { name: "Garage", genres: "UK Garage, 2-Step", voices: kit({
    36: { tune: 1, decay: 0.3, level: 0.9, click: 0.15, sweepDepth: 0.4, sweepRate: 0.5 },
    38: { tune: 2, decay: 0.2, level: 0.8, noiseMix: 0.5 },
    42: { tune: 3, decay: 0.3, level: 0.7, color: 0.2 },
    46: { tune: 1, decay: 0.3, level: 0.65, color: 0.2 },
    50: { tune: 3, decay: 0.1, level: 0.85 },
  })},
  { name: "Glitch", genres: "Glitch, IDM, Experimental", voices: kit({
    36: { tune: 10, decay: 0.1, level: 0.8, click: 0.0, sweepDepth: 0.1, sweepRate: 0.9 },
    38: { tune: 12, decay: 0.2, level: 0.7, noiseMix: 0.2 },
    42: { tune: 8, decay: 0.15, level: 0.6, color: 1.0 },
    46: { tune: 10, decay: 0.2, level: 0.55, color: 1.0 },
    50: { tune: 12, decay: 0.1, level: 0.6 },
    49: { tune: 8, decay: 0.3, level: 0.5, color: 0.8 },
  })},
  { name: "Heavy", genres: "Industrial, Techno, Hardcore", voices: kit({
    36: { tune: -7, decay: 0.8, level: 1, click: 0.2, sweepDepth: 0.8, sweepRate: 0.2 },
    38: { tune: -4, decay: 0.7, level: 1, noiseMix: 0.6 },
    42: { tune: -3, decay: 0.8, level: 0.8, color: -0.4, filterCutoff: 0.75 },
    46: { tune: -4, decay: 0.9, level: 0.8, color: -0.4, filterCutoff: 0.75 },
    50: { tune: -5, decay: 0.8, level: 0.9 },
  })},
  { name: "House", genres: "House, Deep House, Tech House", voices: kit({
    36: { tune: 0, decay: 0.3, level: 1, click: 0.2, sweepDepth: 0.5, sweepRate: 0.4 },
    38: { tune: 1, decay: 0.4, level: 1, noiseMix: 0.5 },
    42: { tune: 1, decay: 0.5, level: 1, color: -0.2 },
    46: { tune: 0, decay: 0.7, level: 0.85, color: -0.2 },
    50: { tune: 2, decay: 0.2, level: 1 },
  })},
  { name: "Industrial", genres: "Industrial, EBM, Dark Techno", voices: kit({
    36: { tune: -10, decay: 0.8, level: 1, click: 0.35, sweepDepth: 0.9, sweepRate: 0.2 },
    38: { tune: -6, decay: 0.9, level: 1, noiseMix: 0.8 },
    42: { tune: -5, decay: 0.8, level: 0.9, color: -0.6 },
    46: { tune: -6, decay: 1.1, level: 0.9, color: -0.6 },
    50: { tune: -8, decay: 1.1, level: 0.95 },
    49: { tune: -4, decay: 1.8, level: 0.85, color: -0.5 },
  })},
  { name: "Lo-Fi", genres: "Lo-Fi, Chillhop, Downtempo", voices: kit({
    36: { tune: -5, decay: 0.3, level: 0.9, click: 0.08, sweepDepth: 0.4, sweepRate: 0.3, filterCutoff: 0.6 },
    38: { tune: -3, decay: 0.7, level: 0.8, noiseMix: 0.65, filterCutoff: 0.5 },
    42: { tune: -2, decay: 0.7, level: 0.7, color: -0.5, filterCutoff: 0.45 },
    46: { tune: -3, decay: 0.6, level: 0.7, color: -0.5, filterCutoff: 0.45 },
  })},
  { name: "Minimal", genres: "Minimal, Microhouse, Click", voices: kit({
    36: { tune: 3, decay: 0.1, level: 0.7, click: 0.1, sweepDepth: 0.3, sweepRate: 0.6 },
    38: { tune: 2, decay: 0.2, level: 0.6, noiseMix: 0.3 },
    42: { tune: 3, decay: 0.2, level: 0.5, color: 0.5 },
    46: { tune: 1, decay: 0.1, level: 0.45, color: 0.5 },
    50: { tune: 5, decay: 0.1, level: 0.5 },
    49: { tune: 3, decay: 0.3, level: 0.4, color: 0.4 },
  })},
  { name: "mloop", voices: kit({
    36: { tune: 3, decay: 0.3, level: 1, click: 0.15, sweepDepth: 0.5, sweepRate: 0.5 },
    38: { tune: 0, decay: 0.4, level: 0.9, noiseMix: 0.55 },
    42: { tune: 0, decay: 0.4, level: 0.8, color: 0.0 },
    46: { tune: -1, decay: 0.7, level: 0.7, color: 0.0 },
    50: { tune: 2, decay: 0.2, level: 0.85 },
    49: { tune: 0, decay: 1.2, level: 0.65 },
  })},
  { name: "Techno", genres: "Techno, Dark Techno, Peak Time", voices: kit({
    36: { tune: 1, decay: 0.25, level: 1, click: 0.3, sweepDepth: 0.5, sweepRate: 0.6 },
    38: { tune: 1, decay: 0.2, level: 0.95, noiseMix: 0.55 },
    42: { tune: 1, decay: 0.3, level: 0.9, color: 0.3 },
    46: { tune: 0, decay: 0.4, level: 0.8, color: 0.3 },
    50: { tune: 2, decay: 0.15, level: 0.9 },
    49: { tune: 1, decay: 0.7, level: 0.65, color: 0.2 },
  })},
  { name: "Tight", genres: "Tech House, Minimal, Techno", voices: kit({
    36: { tune: 0, decay: 0.2, level: 1, click: 0.25, sweepDepth: 0.4, sweepRate: 0.7 },
    38: { tune: 0, decay: 0.2, level: 1, noiseMix: 0.5 },
    42: { tune: 0, decay: 0.3, level: 0.9, color: 0.0 },
    46: { tune: -1, decay: 0.2, level: 0.8, color: 0.0 },
    49: { tune: 0, decay: 0.5, level: 0.7 },
  })},
  { name: "Trance", genres: "Trance, Psytrance, Progressive", voices: kit({
    36: { tune: 3, decay: 0.3, level: 1, click: 0.3, sweepDepth: 0.5, sweepRate: 0.7 },
    38: { tune: 2, decay: 0.3, level: 0.9, noiseMix: 0.55 },
    42: { tune: 3, decay: 0.25, level: 0.85, color: 0.3 },
    46: { tune: 2, decay: 0.4, level: 0.75, color: 0.3 },
  })},
];
