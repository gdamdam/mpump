import type { MidiPort } from "./MidiPort";
import type { StepData, DrumHit } from "../types";

const LOOKAHEAD_MS = 200;
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
  private swing: number;

  private timerId: number = 0;
  private running = false;
  private stepIndex = 0;
  private nextStepTime = 0;
  private pendingBassNote: number | null = null;
  onStep: ((step: number) => void) | null = null;

  /** Velocity humanize: apply random ±15% variation at playback time. */
  private humanize = false;

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
    swing?: number;
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
    this.swing = opts.swing ?? 0.5;
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

  setSwing(swing: number): void {
    this.swing = swing;
  }

  setHumanize(on: boolean): void {
    this.humanize = on;
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
    const drumGate = stepDur * this.drumGateFrac;
    const bassGate = stepDur * this.bassGateFrac;
    const numSteps = Math.max(this.drumPattern.length, this.bassPattern.length) || 16;
    const idx = this.stepIndex % numSteps;
    const swingOffset = (this.stepIndex % 2 === 1) ? stepDur * (this.swing - 0.5) * 2 : 0;
    const stepTime = time + swingOffset;

    if (this.onStep) {
      const delay = Math.max(0, stepTime - performance.now());
      setTimeout(() => this.onStep?.(idx), delay);
    }

    // Drums
    const drumHits = this.drumPattern[idx] ?? [];
    for (const hit of drumHits) {
      const note = this.drumMap ? (this.drumMap[hit.note] ?? hit.note) : hit.note;
      this.port.noteOn(this.drumCh, note, this.humanizeVel(hit.vel), stepTime);
      this.port.noteOff(this.drumCh, note, stepTime + drumGate);
    }

    // Bass
    const bassStep = this.bassPattern[idx] ?? null;
    if (bassStep === null) {
      if (this.pendingBassNote !== null) {
        this.port.noteOff(this.bassCh, this.pendingBassNote, stepTime);
        this.pendingBassNote = null;
      }
    } else {
      const midiNote = Math.max(0, Math.min(127, this.bassRoot + bassStep.semi));
      const velocity = this.humanizeVel(Math.min(127, Math.round(this.baseVelocity * bassStep.vel)));
      if (bassStep.slide && this.pendingBassNote !== null) {
        this.port.noteOn(this.bassCh, midiNote, velocity, stepTime);
        this.port.noteOff(this.bassCh, this.pendingBassNote, stepTime);
        this.pendingBassNote = midiNote;
      } else {
        if (this.pendingBassNote !== null) {
          this.port.noteOff(this.bassCh, this.pendingBassNote, stepTime);
          this.pendingBassNote = null;
        }
        this.port.noteOn(this.bassCh, midiNote, velocity, stepTime);
        this.pendingBassNote = midiNote;
      }
      const nextIdx = (idx + 1) % numSteps;
      const nextBass = this.bassPattern[nextIdx];
      if (!nextBass?.slide) {
        this.port.noteOff(this.bassCh, midiNote, stepTime + bassGate);
        this.pendingBassNote = null;
      }
    }
    this.stepIndex++;
  }

  private schedule(): void {
    if (!this.running) return;
    const horizon = performance.now() + LOOKAHEAD_MS;
    const stepDur = 60000 / (this.bpm * 4);
    const drumGate = stepDur * this.drumGateFrac;
    const bassGate = stepDur * this.bassGateFrac;

    while (this.nextStepTime < horizon) {
      const numSteps = Math.max(this.drumPattern.length, this.bassPattern.length) || 16;
      const idx = this.stepIndex % numSteps;
      // Swing: shift odd steps forward
      const swingOffset = (this.stepIndex % 2 === 1) ? stepDur * (this.swing - 0.5) * 2 : 0;
      const stepTime = this.nextStepTime + swingOffset;

      // Step callback
      if (this.onStep) {
        const delay = Math.max(0, stepTime - performance.now());
        setTimeout(() => this.onStep?.(idx), delay);
      }

      // ── Drums ──
      const drumHits = this.drumPattern[idx] ?? [];
      for (const hit of drumHits) {
        const note = this.drumMap ? (this.drumMap[hit.note] ?? hit.note) : hit.note;
        this.port.noteOn(this.drumCh, note, this.humanizeVel(hit.vel), stepTime);
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
        const velocity = this.humanizeVel(Math.min(127, Math.round(this.baseVelocity * bassStep.vel)));

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
