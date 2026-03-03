export interface SynthDevice {
  type: "synth";
  portMatch: string;
  channel: number;
  rootNote: number;
  baseVelocity: number;
  gateFraction: number;
}

export interface T8Device {
  type: "t8";
  portMatch: string;
  drumChannel: number;
  bassChannel: number;
  baseVelocity: number;
}

export const DEVICES = {
  "S-1": {
    type: "synth" as const,
    portMatch: "S-1",
    channel: 0,
    rootNote: 45, // set at runtime via key/octave
    baseVelocity: 100,
    gateFraction: 0.5,
  },
  "T-8": {
    type: "t8" as const,
    portMatch: "T-8",
    drumChannel: 9,
    bassChannel: 1,
    baseVelocity: 100,
  },
  "J-6": {
    type: "synth" as const,
    portMatch: "J-6",
    channel: 0,
    rootNote: 60, // C4 always
    baseVelocity: 100,
    gateFraction: 0.8,
  },
};
