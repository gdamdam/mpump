/**
 * CVOutput — Send control voltage via DC-coupled audio interface outputs.
 *
 * Uses Web Audio ConstantSourceNode to output precise DC voltages.
 * Requires a DC-coupled audio interface (Expert Sleepers, MOTU, RME, etc.)
 *
 * 1V/oct standard: MIDI note 60 (C4) = 0V, each semitone = 1/12 V.
 * Gate: 0V = off, 5V = on.
 *
 * Limitations:
 * - Most consumer audio interfaces are AC-coupled (block DC) — won't work
 * - Web Audio can't select specific output channels — uses default stereo out
 * - Left channel = pitch CV (1V/oct), Right channel = gate
 */

export class CVOutput {
  private ctx: AudioContext;
  private pitchSource: ConstantSourceNode;
  private gateSource: ConstantSourceNode;
  private merger: ChannelMergerNode;
  private masterGain: GainNode;
  private enabled = false;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;

    // Pitch CV on left channel
    this.pitchSource = ctx.createConstantSource();
    this.pitchSource.offset.value = 0;
    this.pitchSource.start();

    // Gate on right channel
    this.gateSource = ctx.createConstantSource();
    this.gateSource.offset.value = 0;
    this.gateSource.start();

    // Merge into stereo: L=pitch, R=gate
    this.merger = ctx.createChannelMerger(2);
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0; // disabled by default

    this.pitchSource.connect(this.merger, 0, 0);
    this.gateSource.connect(this.merger, 0, 1);
    this.merger.connect(this.masterGain);
    this.masterGain.connect(ctx.destination);
  }

  /** Enable/disable CV output. */
  setEnabled(on: boolean): void {
    this.enabled = on;
    this.masterGain.gain.setValueAtTime(on ? 1 : 0, this.ctx.currentTime);
    if (!on) {
      this.pitchSource.offset.setValueAtTime(0, this.ctx.currentTime);
      this.gateSource.offset.setValueAtTime(0, this.ctx.currentTime);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Set pitch CV (1V/oct from C4=0V).
   * MIDI note 60 = 0V, 72 = 1V, 48 = -1V, etc.
   * Scaled to Web Audio range: 1V ≈ 0.2 (to stay within -1..1 float range).
   */
  setPitch(midiNote: number, time?: number): void {
    if (!this.enabled) return;
    const volts = (midiNote - 60) / 12;
    // Scale: ±5V range maps to ±1.0 float
    const value = volts / 5;
    const when = time !== undefined
      ? this.ctx.currentTime + Math.max(0, (time - performance.now()) / 1000)
      : this.ctx.currentTime;
    this.pitchSource.offset.setValueAtTime(value, when);
  }

  /** Set gate high (note on) or low (note off). */
  setGate(on: boolean, time?: number): void {
    if (!this.enabled) return;
    const when = time !== undefined
      ? this.ctx.currentTime + Math.max(0, (time - performance.now()) / 1000)
      : this.ctx.currentTime;
    this.gateSource.offset.setValueAtTime(on ? 1.0 : 0, when);
  }

  close(): void {
    this.pitchSource.stop();
    this.gateSource.stop();
  }
}
