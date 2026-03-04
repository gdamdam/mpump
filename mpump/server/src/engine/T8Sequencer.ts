import type { MidiPort } from "./MidiPort";
import type { StepData, DrumHit } from "../types";

const LOOKAHEAD_MS = 100;
const SCHEDULE_INTERVAL_MS = 25;

/**
 * Combined drum + bass sequencer.
 * Drums on a configurable channel, bass on a configurable channel.
 * Supports drumMap for note remapping (e.g., GM notes → device-specific notes).
 */
export class T8Sequencer {
  private port: MidiPort;
  private drumCh: number;
  private bassCh: number;
  private drumPattern: DrumHit[][] = [];
  private bassPattern: (StepData | null)[] = [];
  private bassRoot: number;
  private baseVelocity: number;
  private drumGateFrac: number;
  private bassGateFrac: number;
  private drumMap: Record<number, number> | undefined;
  private bpm: number;

  private timerId: number = 0;
  private running = false;
  private stepIndex = 0;
  private nextStepTime = 0;
  private pendingBassNote: number | null = null;
  onStep: ((step: number) => void) | null = null;

  constructor(opts: {
    port: MidiPort;
    drumChannel: number;
    bassChannel: number;
    drumPattern: DrumHit[][];
    bassPattern: (StepData | null)[];
    bassRoot?: number;
    baseVelocity?: number;
    drumGateFraction?: number;
    bassGateFraction?: number;
    drumMap?: Record<number, number>;
    bpm: number;
    tStart?: number;
  }) {
    this.port = opts.port;
    this.drumCh = opts.drumChannel;
    this.bassCh = opts.bassChannel;
    this.drumPattern = opts.drumPattern;
    this.bassPattern = opts.bassPattern;
    this.bassRoot = opts.bassRoot ?? 45;
    this.baseVelocity = opts.baseVelocity ?? 100;
    this.drumGateFrac = opts.drumGateFraction ?? 0.10;
    this.bassGateFrac = opts.bassGateFraction ?? 0.50;
    this.drumMap = opts.drumMap;
    this.bpm = opts.bpm;
    this.nextStepTime = opts.tStart ?? performance.now();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.stepIndex = 0;
    this.pendingBassNote = null;
    this.timerId = window.setInterval(() => this.schedule(), SCHEDULE_INTERVAL_MS);
  }

  stop(): void {
    this.running = false;
    window.clearInterval(this.timerId);
    if (this.pendingBassNote !== null) {
      this.port.noteOff(this.bassCh, this.pendingBassNote);
      this.pendingBassNote = null;
    }
    this.port.allNotesOff(this.drumCh);
    this.port.allNotesOff(this.bassCh);
  }

  setDrumPattern(pattern: DrumHit[][]): void {
    this.drumPattern = pattern;
  }

  setBassPattern(pattern: (StepData | null)[]): void {
    this.bassPattern = pattern;
  }

  setBassRoot(root: number): void {
    this.bassRoot = root;
  }

  setBpm(bpm: number): void {
    this.bpm = bpm;
  }

  private schedule(): void {
    const horizon = performance.now() + LOOKAHEAD_MS;
    const stepDur = 60000 / (this.bpm * 4);
    const drumGate = stepDur * this.drumGateFrac;
    const bassGate = stepDur * this.bassGateFrac;

    while (this.nextStepTime < horizon) {
      const numSteps = Math.max(this.drumPattern.length, this.bassPattern.length) || 16;
      const idx = this.stepIndex % numSteps;
      const stepTime = this.nextStepTime;

      // Step callback
      if (this.onStep) {
        const delay = Math.max(0, stepTime - performance.now());
        setTimeout(() => this.onStep?.(idx), delay);
      }

      // ── Drums ──
      const drumHits = this.drumPattern[idx] ?? [];
      for (const hit of drumHits) {
        const note = this.drumMap ? (this.drumMap[hit.note] ?? hit.note) : hit.note;
        this.port.noteOn(this.drumCh, note, hit.vel, stepTime);
        this.port.noteOff(this.drumCh, note, stepTime + drumGate);
      }

      // ── Bass ──
      const bassStep = this.bassPattern[idx] ?? null;

      if (bassStep === null) {
        // Rest — release pending bass
        if (this.pendingBassNote !== null) {
          this.port.noteOff(this.bassCh, this.pendingBassNote, stepTime);
          this.pendingBassNote = null;
        }
      } else {
        const midiNote = Math.max(0, Math.min(127, this.bassRoot + bassStep.semi));
        const velocity = Math.min(127, Math.round(this.baseVelocity * bassStep.vel));

        if (bassStep.slide && this.pendingBassNote !== null) {
          // Slide: legato
          this.port.noteOn(this.bassCh, midiNote, velocity, stepTime);
          this.port.noteOff(this.bassCh, this.pendingBassNote, stepTime);
          this.pendingBassNote = midiNote;
        } else {
          // Normal
          if (this.pendingBassNote !== null) {
            this.port.noteOff(this.bassCh, this.pendingBassNote, stepTime);
            this.pendingBassNote = null;
          }
          this.port.noteOn(this.bassCh, midiNote, velocity, stepTime);
          this.pendingBassNote = midiNote;
        }

        // Check next step for slide
        const nextIdx = (idx + 1) % numSteps;
        const nextBass = this.bassPattern[nextIdx];
        if (!nextBass?.slide) {
          this.port.noteOff(this.bassCh, midiNote, stepTime + bassGate);
          this.pendingBassNote = null;
        }
      }

      this.stepIndex++;
      this.nextStepTime += stepDur;
    }
  }
}
