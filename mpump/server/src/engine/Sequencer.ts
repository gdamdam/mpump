import type { MidiPort } from "./MidiPort";
import type { StepData, ArpMode, ArpRate } from "../types";

// How far ahead to schedule notes (ms). Must be > 4× SCHEDULE_INTERVAL
// to guarantee no gaps. Higher = more latency, lower = more CPU.
const LOOKAHEAD_MS = 100;
// How often the scheduler runs (ms). 25ms = ~40 checks/sec.
const SCHEDULE_INTERVAL_MS = 25;

/** Arp chord intervals from root: root, major 3rd, 5th, octave. */
const ARP_INTERVALS = [0, 4, 7, 12];

function arpRateToSubdivisions(rate: ArpRate): number {
  switch (rate) {
    case "1/4": return 1;
    case "1/8": return 2;
    case "1/16": return 4;
  }
}

function getArpSequence(mode: ArpMode): number[] {
  switch (mode) {
    case "up": return [0, 1, 2, 3];
    case "down": return [3, 2, 1, 0];
    case "up-down": return [0, 1, 2, 3, 2, 1];
    case "random": return [0, 1, 2, 3]; // indices chosen randomly at play time
  }
}

/**
 * 16-step melodic sequencer for S-1 / J-6.
 * Uses look-ahead scheduling with Web MIDI timestamps for jitter-free output.
 */
export class Sequencer {
  private port: MidiPort;
  private channel: number;
  private pattern: (StepData | null)[] = [];
  private rootNote: number;
  private baseVelocity: number;
  private gateFraction: number;
  private bpm: number;
  private swing: number;
  private programChange: number | null;

  private timerId: number = 0;
  private running = false;
  private stepIndex = 0;
  private nextStepTime = 0;
  private pendingNote: number | null = null;
  private pendingOffTime = 0;
  onStep: ((step: number) => void) | null = null;

  /** Velocity humanize: apply random ±15% variation at playback time. */
  private humanize = false;

  /** Arpeggiator state. */
  private arpEnabled = false;
  private arpMode: ArpMode = "up";
  private arpRate: ArpRate = "1/8";
  private arpSeqIdx = 0;

  constructor(opts: {
    port: MidiPort;
    channel: number;
    pattern: (StepData | null)[];
    rootNote: number;
    baseVelocity?: number;
    gateFraction?: number;
    bpm: number;
    swing?: number;
    programChange?: number | null;
    tStart?: number;
  }) {
    this.port = opts.port;
    this.channel = opts.channel;
    this.pattern = opts.pattern;
    this.rootNote = opts.rootNote;
    this.baseVelocity = opts.baseVelocity ?? 100;
    this.gateFraction = opts.gateFraction ?? 0.5;
    this.bpm = opts.bpm;
    this.swing = opts.swing ?? 0.5;
    this.programChange = opts.programChange ?? null;
    this.nextStepTime = opts.tStart ?? performance.now();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.stepIndex = 0;
    this.pendingNote = null;
    this.arpSeqIdx = 0;

    if (this.programChange !== null) {
      this.port.programChange(this.channel, this.programChange);
    }

    this.timerId = window.setInterval(() => this.schedule(), SCHEDULE_INTERVAL_MS);
  }

  stop(): void {
    this.running = false;
    window.clearInterval(this.timerId);
    if (this.pendingNote !== null) {
      this.port.noteOff(this.channel, this.pendingNote);
      this.pendingNote = null;
    }
    this.port.allNotesOff(this.channel);
  }

  setPattern(pattern: (StepData | null)[]): void {
    this.pattern = pattern;
    this.arpSeqIdx = 0;
  }

  setRootNote(root: number): void {
    this.rootNote = root;
  }

  setBpm(bpm: number): void {
    this.bpm = bpm;
  }

  setSwing(swing: number): void {
    this.swing = swing;
  }

  setHumanize(on: boolean): void {
    this.humanize = on;
  }

  setArp(enabled: boolean, mode: ArpMode, rate: ArpRate): void {
    this.arpEnabled = enabled;
    this.arpMode = mode;
    this.arpRate = rate;
    this.arpSeqIdx = 0;
  }

  private humanizeVel(vel: number): number {
    if (!this.humanize) return vel;
    const offset = vel * (Math.random() * 0.3 - 0.15);
    return Math.min(127, Math.max(1, Math.round(vel + offset)));
  }

  /** Advance one step externally (for MIDI clock sync mode). */
  advanceStep(time: number): void {
    if (!this.running) return;
    const stepDur = 60000 / (this.bpm * 4);
    const gateDur = stepDur * this.gateFraction;
    const step = this.pattern[this.stepIndex % this.pattern.length];
    const swingOffset = (this.stepIndex % 2 === 1) ? stepDur * (this.swing - 0.5) * 2 : 0;
    const stepTime = time + swingOffset;

    if (this.onStep) {
      const idx = this.stepIndex % this.pattern.length;
      const delay = Math.max(0, stepTime - performance.now());
      setTimeout(() => this.onStep?.(idx), delay);
    }

    if (step === null || step === undefined) {
      if (this.pendingNote !== null) {
        this.port.noteOff(this.channel, this.pendingNote, stepTime);
        this.pendingNote = null;
      }
    } else if (this.arpEnabled) {
      this.scheduleArp(step, stepTime, stepDur, gateDur);
    } else {
      const midiNote = Math.max(0, Math.min(127, this.rootNote + step.semi));
      const velocity = this.humanizeVel(Math.min(127, Math.round(this.baseVelocity * step.vel)));
      if (step.slide && this.pendingNote !== null) {
        this.port.noteOn(this.channel, midiNote, velocity, stepTime);
        this.port.noteOff(this.channel, this.pendingNote, stepTime);
        this.pendingNote = midiNote;
        this.pendingOffTime = stepTime + gateDur;
      } else {
        if (this.pendingNote !== null) {
          this.port.noteOff(this.channel, this.pendingNote, stepTime);
          this.pendingNote = null;
        }
        this.port.noteOn(this.channel, midiNote, velocity, stepTime);
        this.pendingNote = midiNote;
        this.pendingOffTime = stepTime + gateDur;
      }
      const nextIdx = (this.stepIndex + 1) % this.pattern.length;
      const nextStep = this.pattern[nextIdx];
      if (!nextStep?.slide) {
        this.port.noteOff(this.channel, midiNote, this.pendingOffTime);
        this.pendingNote = null;
      }
    }
    this.stepIndex++;
  }

  private schedule(): void {
    if (!this.running) return;
    const horizon = performance.now() + LOOKAHEAD_MS;
    const stepDur = 60000 / (this.bpm * 4);
    const gateDur = stepDur * this.gateFraction;

    while (this.nextStepTime < horizon) {
      const step = this.pattern[this.stepIndex % this.pattern.length];
      const swingOffset = (this.stepIndex % 2 === 1) ? stepDur * (this.swing - 0.5) * 2 : 0;
      const stepTime = this.nextStepTime + swingOffset;

      // Report scheduling drift for CPU load indicator
      const drift = performance.now() - stepTime;
      if (drift > 0 && "reportDrift" in this.port) (this.port as unknown as { reportDrift: (ms: number) => void }).reportDrift(drift);

      // Fire step callback
      if (this.onStep) {
        const idx = this.stepIndex % this.pattern.length;
        const delay = Math.max(0, stepTime - performance.now());
        setTimeout(() => this.onStep?.(idx), delay);
      }

      if (step === null || step === undefined) {
        // Rest — release any pending note
        if (this.pendingNote !== null) {
          this.port.noteOff(this.channel, this.pendingNote, stepTime);
          this.pendingNote = null;
        }
      } else if (this.arpEnabled) {
        // Arpeggiator: subdivide the step into rapid sub-notes
        this.scheduleArp(step, stepTime, stepDur, gateDur);
      } else {
        // Normal playback
        const midiNote = Math.max(0, Math.min(127, this.rootNote + step.semi));
        const velocity = this.humanizeVel(Math.min(127, Math.round(this.baseVelocity * step.vel)));

        if (step.slide && this.pendingNote !== null) {
          this.port.noteOn(this.channel, midiNote, velocity, stepTime);
          this.port.noteOff(this.channel, this.pendingNote, stepTime);
          this.pendingNote = midiNote;
          this.pendingOffTime = stepTime + gateDur;
        } else {
          if (this.pendingNote !== null) {
            this.port.noteOff(this.channel, this.pendingNote, stepTime);
            this.pendingNote = null;
          }
          this.port.noteOn(this.channel, midiNote, velocity, stepTime);
          this.pendingNote = midiNote;
          this.pendingOffTime = stepTime + gateDur;
        }

        const nextIdx = (this.stepIndex + 1) % this.pattern.length;
        const nextStep = this.pattern[nextIdx];
        if (!nextStep?.slide) {
          this.port.noteOff(this.channel, midiNote, this.pendingOffTime);
          this.pendingNote = null;
        }
      }

      this.stepIndex++;
      this.nextStepTime += stepDur;
    }
  }

  /** Schedule arpeggiated sub-notes within one step. */
  private scheduleArp(step: StepData, stepTime: number, stepDur: number, _gateDur: number): void {
    // Release any pending note
    if (this.pendingNote !== null) {
      this.port.noteOff(this.channel, this.pendingNote, stepTime);
      this.pendingNote = null;
    }

    const subdivisions = arpRateToSubdivisions(this.arpRate);
    const subDur = stepDur / subdivisions;
    const subGate = subDur * 0.8;
    const seq = getArpSequence(this.arpMode);
    const baseMidi = this.rootNote + step.semi;
    const baseVel = Math.min(127, Math.round(this.baseVelocity * step.vel));

    for (let i = 0; i < subdivisions; i++) {
      const t = stepTime + i * subDur;
      // Pick interval from arp sequence
      let seqIndex: number;
      if (this.arpMode === "random") {
        seqIndex = Math.floor(Math.random() * ARP_INTERVALS.length);
      } else {
        seqIndex = seq[this.arpSeqIdx % seq.length];
        this.arpSeqIdx++;
      }
      const midiNote = Math.max(0, Math.min(127, baseMidi + ARP_INTERVALS[seqIndex]));
      const vel = this.humanizeVel(baseVel);

      this.port.noteOn(this.channel, midiNote, vel, t);
      this.port.noteOff(this.channel, midiNote, t + subGate);
    }
  }
}
