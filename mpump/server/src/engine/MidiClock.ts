import { MidiPort } from "./MidiPort";

const PPQN = 24;
const LOOKAHEAD_MS = 100;
const SCHEDULE_INTERVAL_MS = 25;

/**
 * MIDI clock sender using look-ahead scheduling.
 * Sends 24 PPQN clock ticks via Web MIDI output timestamps.
 */
export class MidiClock {
  private port: MidiPort;
  private bpm: number;
  private timerId: number = 0;
  private nextTickTime: number = 0;
  private running = false;

  constructor(port: MidiPort, bpm: number) {
    this.port = port;
    this.bpm = bpm;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.nextTickTime = performance.now();
    this.timerId = window.setInterval(() => this.schedule(), SCHEDULE_INTERVAL_MS);
  }

  stop(): void {
    this.running = false;
    window.clearInterval(this.timerId);
  }

  setBpm(bpm: number): void {
    this.bpm = bpm;
  }

  private schedule(): void {
    const horizon = performance.now() + LOOKAHEAD_MS;
    const tickInterval = 60000 / (this.bpm * PPQN);

    while (this.nextTickTime < horizon) {
      this.port.clock(this.nextTickTime);
      this.nextTickTime += tickInterval;
    }
  }
}
