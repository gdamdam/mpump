import type { MidiPort } from "./MidiPort";
import type { StepData, DrumHit } from "../types";

const LOOKAHEAD_MS = 100;
const SCHEDULE_INTERVAL_MS = 25;
const DRUM_CH = 9;
const BASS_CH = 1;
const DRUM_GATE_FRAC = 0.10;
const BASS_GATE_FRAC = 0.50;

/**
 * Combined drum + bass sequencer for T-8.
 * Drums on channel 10 (idx 9), bass on channel 2 (idx 1).
 */
export class T8Sequencer {
  private port: MidiPort;
  private drumPattern: DrumHit[][] = [];
  private bassPattern: (StepData | null)[] = [];
  private bassRoot: number;
  private baseVelocity: number;
  private bpm: number;

  private timerId: number = 0;
  private running = false;
  private stepIndex = 0;
  private nextStepTime = 0;
  private pendingBassNote: number | null = null;
  onStep: ((step: number) => void) | null = null;

  constructor(opts: {
    port: MidiPort;
    drumPattern: DrumHit[][];
    bassPattern: (StepData | null)[];
    bassRoot?: number;
    baseVelocity?: number;
    bpm: number;
    tStart?: number;
  }) {
    this.port = opts.port;
    this.drumPattern = opts.drumPattern;
    this.bassPattern = opts.bassPattern;
    this.bassRoot = opts.bassRoot ?? 45;
    this.baseVelocity = opts.baseVelocity ?? 100;
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
      this.port.noteOff(BASS_CH, this.pendingBassNote);
      this.pendingBassNote = null;
    }
    this.port.allNotesOff(DRUM_CH);
    this.port.allNotesOff(BASS_CH);
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
    const drumGate = stepDur * DRUM_GATE_FRAC;
    const bassGate = stepDur * BASS_GATE_FRAC;

    while (this.nextStepTime < horizon) {
      const idx = this.stepIndex % 16;
      const stepTime = this.nextStepTime;

      // Step callback
      if (this.onStep) {
        const delay = Math.max(0, stepTime - performance.now());
        setTimeout(() => this.onStep?.(idx), delay);
      }

      // ── Drums ──
      const drumHits = this.drumPattern[idx] ?? [];
      for (const hit of drumHits) {
        this.port.noteOn(DRUM_CH, hit.note, hit.vel, stepTime);
        this.port.noteOff(DRUM_CH, hit.note, stepTime + drumGate);
      }

      // ── Bass ──
      const bassStep = this.bassPattern[idx] ?? null;

      if (bassStep === null) {
        // Rest — release pending bass
        if (this.pendingBassNote !== null) {
          this.port.noteOff(BASS_CH, this.pendingBassNote, stepTime);
          this.pendingBassNote = null;
        }
      } else {
        const midiNote = Math.max(0, Math.min(127, this.bassRoot + bassStep.semi));
        const velocity = Math.min(127, Math.round(this.baseVelocity * bassStep.vel));

        if (bassStep.slide && this.pendingBassNote !== null) {
          // Slide: legato
          this.port.noteOn(BASS_CH, midiNote, velocity, stepTime);
          this.port.noteOff(BASS_CH, this.pendingBassNote, stepTime);
          this.pendingBassNote = midiNote;
        } else {
          // Normal
          if (this.pendingBassNote !== null) {
            this.port.noteOff(BASS_CH, this.pendingBassNote, stepTime);
            this.pendingBassNote = null;
          }
          this.port.noteOn(BASS_CH, midiNote, velocity, stepTime);
          this.pendingBassNote = midiNote;
        }

        // Check next step for slide
        const nextIdx = (idx + 1) % 16;
        const nextBass = this.bassPattern[nextIdx];
        if (!nextBass?.slide) {
          this.port.noteOff(BASS_CH, midiNote, stepTime + bassGate);
          this.pendingBassNote = null;
        }
      }

      this.stepIndex++;
      this.nextStepTime += stepDur;
    }
  }
}
