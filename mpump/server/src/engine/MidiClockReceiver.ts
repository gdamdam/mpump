/**
 * MidiClockReceiver — listens for MIDI clock messages and derives BPM + step
 * position. MIDI clock sends 24 ticks per quarter note (PPQN), so 6 ticks
 * equals one sixteenth-note step. BPM is derived every beat (24 ticks) from
 * a rolling window of up to 48 tick timestamps (2 beats) for stability.
 *
 * Also handles transport messages: Start (0xFA), Continue (0xFB), Stop (0xFC).
 */
export interface MidiClockCallbacks {
  onStep: () => void;
  onBpmDetected: (bpm: number) => void;
  onStart: () => void;
  onContinue: () => void;
  onStop: () => void;
}

export class MidiClockReceiver {
  private tickCount = 0;
  private subTick = 0;
  private tickTimes: number[] = [];
  private handler: ((e: MIDIMessageEvent) => void) | null = null;
  private _receiving = false;
  private _enabled = false;

  constructor(private cb: MidiClockCallbacks) {}

  get receiving(): boolean { return this._receiving; }
  get enabled(): boolean { return this._enabled; }

  enable(access: MIDIAccess): void {
    this._enabled = true;
    this._receiving = false;
    this.tickCount = 0;
    this.subTick = 0;
    this.tickTimes = [];

    this.handler = (e: MIDIMessageEvent) => {
      if (!e.data) return;
      const status = e.data[0];

      if (status === 0xF8) {
        // Clock tick — 24 PPQN
        this._receiving = true;
        this.tickTimes.push(performance.now());
        if (this.tickTimes.length > 96) this.tickTimes.shift();

        this.subTick++;
        if (this.subTick >= 6) {
          // 6 ticks = 1 sixteenth note step
          this.subTick = 0;
          this.cb.onStep();
        }

        // Update BPM display every 24 ticks (1 beat)
        this.tickCount++;
        if (this.tickCount >= 24) {
          this.deriveBpm();
          this.tickCount = 0;
        }
      } else if (status === 0xFA) {
        // Start — reset to beginning
        this.subTick = 0;
        this.tickCount = 0;
        this.tickTimes = [];
        this.cb.onStart();
      } else if (status === 0xFB) {
        // Continue — resume from current position
        this.cb.onContinue();
      } else if (status === 0xFC) {
        // Stop — pause all
        this._receiving = false;
        this.cb.onStop();
      }
    };

    for (const input of access.inputs.values()) {
      input.addEventListener("midimessage", this.handler as EventListener);
    }
  }

  disable(access: MIDIAccess | null): void {
    this._enabled = false;
    if (this.handler && access) {
      for (const input of access.inputs.values()) {
        input.removeEventListener("midimessage", this.handler as EventListener);
      }
    }
    this.handler = null;
    this.tickCount = 0;
    this.subTick = 0;
    this.tickTimes = [];
    this._receiving = false;
  }

  /** Derive BPM from rolling window of tick timestamps. */
  private deriveBpm(): void {
    const times = this.tickTimes;
    if (times.length < 12) return; // need at least half a beat of data
    // Use up to 48 most recent ticks (2 quarter notes) for a stable average
    const recent = times.slice(-48);
    const intervals: number[] = [];
    for (let i = 1; i < recent.length; i++) intervals.push(recent[i] - recent[i - 1]);
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    // avgInterval is ms per tick; multiply by 24 (PPQN) to get ms per beat
    const bpm = Math.round(60000 / (avgInterval * 24));
    if (bpm >= 20 && bpm <= 300) {
      this.cb.onBpmDetected(bpm);
    }
  }
}
