import type { MidiPort } from "./MidiPort";
import type { StepData } from "../types";

const LOOKAHEAD_MS = 100;
const SCHEDULE_INTERVAL_MS = 25;

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
  private programChange: number | null;

  private timerId: number = 0;
  private running = false;
  private stepIndex = 0;
  private nextStepTime = 0;
  private pendingNote: number | null = null;
  private pendingOffTime = 0;
  onStep: ((step: number) => void) | null = null;

  constructor(opts: {
    port: MidiPort;
    channel: number;
    pattern: (StepData | null)[];
    rootNote: number;
    baseVelocity?: number;
    gateFraction?: number;
    bpm: number;
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
    this.programChange = opts.programChange ?? null;
    this.nextStepTime = opts.tStart ?? performance.now();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.stepIndex = 0;
    this.pendingNote = null;

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
  }

  setRootNote(root: number): void {
    this.rootNote = root;
  }

  setBpm(bpm: number): void {
    this.bpm = bpm;
  }

  private schedule(): void {
    const horizon = performance.now() + LOOKAHEAD_MS;
    const stepDur = 60000 / (this.bpm * 4);
    const gateDur = stepDur * this.gateFraction;

    while (this.nextStepTime < horizon) {
      const step = this.pattern[this.stepIndex % this.pattern.length];
      const stepTime = this.nextStepTime;

      // Fire step callback
      if (this.onStep) {
        const idx = this.stepIndex % this.pattern.length;
        // Schedule callback near step time
        const delay = Math.max(0, stepTime - performance.now());
        setTimeout(() => this.onStep?.(idx), delay);
      }

      if (step === null || step === undefined) {
        // Rest — release any pending note
        if (this.pendingNote !== null) {
          this.port.noteOff(this.channel, this.pendingNote, stepTime);
          this.pendingNote = null;
        }
      } else {
        const midiNote = Math.max(0, Math.min(127, this.rootNote + step.semi));
        const velocity = Math.min(127, Math.round(this.baseVelocity * step.vel));

        if (step.slide && this.pendingNote !== null) {
          // Slide: noteOn new before noteOff old (legato)
          this.port.noteOn(this.channel, midiNote, velocity, stepTime);
          this.port.noteOff(this.channel, this.pendingNote, stepTime);
          this.pendingNote = midiNote;
          this.pendingOffTime = stepTime + gateDur;
        } else {
          // Normal: release pending, noteOn new, schedule noteOff
          if (this.pendingNote !== null) {
            this.port.noteOff(this.channel, this.pendingNote, stepTime);
            this.pendingNote = null;
          }
          this.port.noteOn(this.channel, midiNote, velocity, stepTime);
          this.pendingNote = midiNote;
          this.pendingOffTime = stepTime + gateDur;
        }

        // Check if next step is a slide — if not, schedule noteOff at gate end
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
}
