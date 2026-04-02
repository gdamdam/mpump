/**
 * AudioPort — drop-in replacement for MidiPort that plays synthesized
 * sounds via the Web Audio API.  No sample files or MIDI devices needed.
 *
 * - Channel 9 (GM drums): 808-style one-shot drum samples
 * - All other channels: configurable synth with ADSR + filter envelope
 */

import type { SynthParams, EffectParams, EffectName, DrumVoiceParams, FilterModel } from "../types";
import { DEFAULT_SYNTH_PARAMS, DEFAULT_EFFECTS, DEFAULT_DRUM_VOICE, lfoDivisionToHz, delayDivisionToSeconds } from "../types";
import { CVOutput } from "./CVOutput";
import {
  midiToFreq, perfToCtx,
  buildKit, DrumKit, DRUM_SYNTHS, applyFilter, applyFadeOut, SynthFn,
  SynthVoice, DRUM_PAN, envValueAt,
  makeDistortionCurve, makeBitcrushCurve, makeSoftClipCurve, generateImpulseResponse, ReverbType,
} from "./drumSynth";

export { envValueAt } from "./drumSynth";

const DRUM_CH = 9;

// ── AudioPort class ──────────────────────────────────────────────────────

/**
 * Drop-in replacement for MidiPort.
 * Channel 9 → drum kit (one-shot samples).
 * Other channels → sawtooth synth with low-pass filter and envelope.
 */
export class AudioPort {
  private ctx: AudioContext;
  private kit: DrumKit;
  /** Active synth voices keyed by "ch:note" for noteOff lookup. */
  private voices: Map<string, SynthVoice> = new Map();
  /** Per-channel synth params (falls back to DEFAULT_SYNTH_PARAMS). */
  private channelParams: Map<number, SynthParams> = new Map();
  /** Per-channel volume (0–1). */
  private channelVolumes: Map<number, number> = new Map();
  /** Per-channel bus GainNodes for routing and metering. */
  private channelBuses: Map<number, GainNode> = new Map();
  /** Per-channel stereo panners. */
  private channelPanners: Map<number, StereoPannerNode> = new Map();
  /** Per-channel AnalyserNodes for VU metering. */
  private channelAnalysers: Map<number, AnalyserNode> = new Map();
  /** Per-channel 3-band EQ (low shelf, mid peak, high shelf). */
  private channelEQs: Map<number, [BiquadFilterNode, BiquadFilterNode, BiquadFilterNode]> = new Map();
  private channelHPFs: Map<number, BiquadFilterNode> = new Map();
  /** Per-channel trance gate (LFO or pattern → GainNode). */
  private channelGates: Map<number, { lfo: OscillatorNode | null; depth: GainNode | null; gate: GainNode; on: boolean; timerId?: number; smoother?: BiquadFilterNode }> = new Map();
  /** Per-note drum voice params (tune, decay, level). */
  private drumVoiceParams: Map<number, DrumVoiceParams> = new Map();
  /** Custom user samples (overrides synthesized kit when present). */
  private customSamples: Map<number, AudioBuffer> = new Map();
  /** Cached reverb impulse response. */
  private reverbIRCache: { decay: number; type: string; buffer: AudioBuffer } | null = null;
  /** CPU load indicator: max scheduling drift in ms (updated by sequencer). */
  private _maxDrift = 0;
  private _driftSamples: number[] = [];
  /** Mid-side EQ: cut low-mids on side channel for spatial mud reduction. */
  private msEnabled = false;
  private msSplitL: GainNode | null = null;
  private msSplitR: GainNode | null = null;
  private msMidGain: GainNode | null = null;
  private msSideGain: GainNode | null = null;
  private msSideEQ: BiquadFilterNode | null = null;
  private msMerger: ChannelMergerNode | null = null;
  private msSplitter: ChannelSplitterNode | null = null;
  /** Muted drum voice notes. */
  private mutedDrumNotes: Set<number> = new Set();
  /** Active drum sources — tracked to prevent accumulation. */
  private activeDrumSrcs: Set<AudioBufferSourceNode> = new Set();
  /** Current BPM for tempo-synced LFO. */
  private bpm = 120;
  /** Sidechain duck: duck non-drum channels on kick hits. */
  private sidechainDuck = false;  // off by default — user enables via DUCK effect button
  private duckDepth = 0.5;  // moderate duck (0.5 = duck to 50%, subtle pump)
  private duckRelease = 0.04; // seconds, recovery time constant
  /** Metronome: click on every beat. */
  private metronomeOn = false;
  /** CV output for DC-coupled interfaces. */
  private cv: CVOutput;
  /** Master output node for VU metering. */
  private master: GainNode;
  private eqLow: BiquadFilterNode;
  private eqMid: BiquadFilterNode;
  private eqHigh: BiquadFilterNode;
  private masterBoost: GainNode;
  private analyser: AnalyserNode;
  /** Effects state */
  private fx: EffectParams = JSON.parse(JSON.stringify(DEFAULT_EFFECTS));
  /** Configurable effect chain order. */
  private effectOrder: EffectName[] = ["compressor", "highpass", "distortion", "bitcrusher", "chorus", "phaser", "flanger", "delay", "reverb", "tremolo"];
  /** Effects output node (everything chains into this → analyser → dest) */
  private fxOutput: GainNode;
  // Effect nodes (created/destroyed on rebuild)
  private fxNodes: AudioNode[] = [];
  // Chorus/phaser LFOs (need to track for cleanup)
  private fxLFOs: OscillatorNode[] = [];
  /** Brick-wall limiter at the end of the chain to prevent clipping. */
  private limiter: DynamicsCompressorNode;
  /** Soft clipper (tanh curve) for hybrid mode. */
  private softClip: WaveShaperNode;
  /** Anti-clip mode: "limiter" (A), "hybrid" (C), or "off". */
  private antiClipMode: "off" | "limiter" | "hybrid" = "limiter";
  /** Bypass gain node used when anti-clip is off. */
  private limiterBypass: GainNode;
  private driveGain: GainNode;
  /** AudioWorklet availability flag. */
  private workletsLoaded = false;
  /** Stereo width gain (Haas effect level on high band). */
  private widthGain: GainNode | null = null;
  /** Low cut filter on master output. */
  private lowCutFilter: BiquadFilterNode | null = null;
  /** Performance mode: "normal" | "lite" (no viz) | "eco" (lite + reduced audio). */
  readonly perfMode: "normal" | "lite" | "eco";
  /** Multiband compressor: splits into low/mid/high bands with per-band compression. */
  private mbEnabled = true;
  private mbLowLP: BiquadFilterNode | null = null;
  private mbMidBP: BiquadFilterNode[] | null = null; // LP + HP pair for bandpass
  private mbHighHP: BiquadFilterNode | null = null;
  private mbLowComp: DynamicsCompressorNode | null = null;
  private mbMidComp: DynamicsCompressorNode | null = null;
  private mbHighComp: DynamicsCompressorNode | null = null;
  private mbMerge: GainNode | null = null;

  constructor() {
    // Safari uses webkitAudioContext
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    // Performance mode from App-level detection
    const params = new URLSearchParams(window.location.search);
    this.perfMode = params.get("eco") === "true" ? "eco" : params.get("lite") === "true" ? "lite" : (localStorage.getItem("mpump-perf-mode") as "normal" | "lite" | "eco") ?? "normal";
    (window as unknown as Record<string, unknown>).__audioCtx = this.ctx;
    (window as unknown as Record<string, unknown>).__audioPort = this;
    this.kit = buildKit(this.ctx);

    // Master → [effects chain] → fxOutput → EQ → masterBoost → limiter → analyser → destination
    this.master = this.ctx.createGain();
    this.fxOutput = this.ctx.createGain();

    // 3-band master EQ
    this.eqLow = this.ctx.createBiquadFilter();
    this.eqLow.type = "lowshelf";
    this.eqLow.frequency.value = 150;
    this.eqLow.gain.value = 2; // "Punchy" default: sub boost

    this.eqMid = this.ctx.createBiquadFilter();
    this.eqMid.type = "peaking";
    this.eqMid.frequency.value = 300; // target mud zone (200-500Hz)
    this.eqMid.Q.value = 0.7; // wide Q covers full mud range
    this.eqMid.gain.value = -2; // "Punchy" default: mid cut

    this.eqHigh = this.ctx.createBiquadFilter();
    this.eqHigh.type = "highshelf";
    this.eqHigh.frequency.value = 5000;
    this.eqHigh.gain.value = 2; // "Punchy" default: bright top

    // Master gain boost (before limiter)
    this.masterBoost = this.ctx.createGain();
    this.masterBoost.gain.value = 2.0; // +6dB default boost (limiter catches peaks)

    // Soft clipper: tanh curve for gentle peak rounding (hybrid mode only)
    this.softClip = this.ctx.createWaveShaper();
    this.softClip.oversample = "none";

    // Limiter: catches peaks before they clip the output.
    // Intentionally gentle (4:1, soft knee) rather than brick-wall (20:1+)
    // to avoid pumping artifacts on transient-heavy drum patterns.
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -1;  // dBFS — catches only the loudest peaks
    this.limiter.ratio.value = 4;       // gentle compression, not hard limiting
    this.limiter.attack.value = 0.001;  // 1ms — fast enough for drum transients
    this.limiter.release.value = 0.25;  // 250ms — smooth recovery
    this.limiter.knee.value = 10;       // soft knee — gradual onset, less audible

    // Bypass gain (unused, kept for compatibility)
    this.limiterBypass = this.ctx.createGain();

    // Drive gain — input gain before limiter (0dB default)
    this.driveGain = this.ctx.createGain();
    this.driveGain.gain.value = Math.pow(10, 1 / 20); // +1.0 dB default drive

    // Multiband compressor: skip in eco mode (expensive)
    if (this.perfMode !== "eco") this.initMultiband();
    if (this.perfMode === "eco") this.mbEnabled = false;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.connect(this.ctx.destination);


    // Default mode is "limiter": fxOutput → limiter → analyser
    this.rebuildAntiClipChain();

    // Initial chain: master → fxOutput (no effects)
    this.master.connect(this.fxOutput);

    // Load AudioWorklet modules (skip in eco mode — fallback to standard biquad filters)
    if (this.perfMode !== "eco") this.loadWorklets();

    // CV output
    this.cv = new CVOutput(this.ctx);

    // Helper: check if context needs resuming (Safari uses "interrupted" state)
    const needsResume = () => this.ctx.state === "suspended" || (this.ctx.state as string) === "interrupted";

    // Immediately attempt resume (works if called during user gesture)
    if (needsResume()) {
      this.ctx.resume();
    }

    // (A) React to state changes immediately (critical for Safari "interrupted")
    this.ctx.onstatechange = () => {
      if (needsResume()) {
        this.ctx.resume().catch(() => {});
      }
    };

    // (B) Periodic heartbeat: resume suspended AudioContext + cleanup stale nodes
    this.heartbeatId = window.setInterval(() => {
      if (needsResume()) {
        this.ctx.resume().catch(() => {});
      }
      // Safety: kill stale voices older than 5s (stuck notes)
      const now = this.ctx.currentTime;
      for (const [key, voice] of this.voices) {
        if (now - voice.env.startTime > 5) {
          this.stopVoice(voice);
          this.voices.delete(key);
        }
      }
      // CPU drift: compute average from samples, reset
      if (this._driftSamples.length > 0) {
        this._maxDrift = Math.max(...this._driftSamples);
        this._driftSamples = [];
      } else {
        this._maxDrift *= 0.5; // decay when no samples
      }
      // Safety: if AudioContext is closed, log it
      if (this.ctx.state === "closed") {
        console.error("[AudioPort] AudioContext is closed — audio cannot recover");
      }
    }, 1000);

    // (C) Resume on any user interaction (Safari suspends on focus loss)
    this.resumeOnInteraction = () => {
      if (needsResume()) {
        this.ctx.resume().catch(() => {});
      }
    };
    document.addEventListener("pointerdown", this.resumeOnInteraction);
    document.addEventListener("keydown", this.resumeOnInteraction);

    // (D) Re-sync on tab visibility change
    this.visibilityHandler = () => {
      if (document.visibilityState === "visible" && needsResume()) {
        this.ctx.resume().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", this.visibilityHandler);
  }

  // Safari fix references
  private heartbeatId = 0;
  private resumeOnInteraction: (() => void) | null = null;
  private visibilityHandler: (() => void) | null = null;

  // ── AudioWorklet loading ─────────────────────────────────────────────

  private async loadWorklets(): Promise<void> {
    if (!this.ctx.audioWorklet) return;
    try {
      await Promise.all([
        this.ctx.audioWorklet.addModule("./worklets/moog-filter.js"),
        this.ctx.audioWorklet.addModule("./worklets/diode-filter.js"),
        this.ctx.audioWorklet.addModule("./worklets/bitcrusher.js"),
        this.ctx.audioWorklet.addModule("./worklets/sync-osc.js"),
        this.ctx.audioWorklet.addModule("./worklets/fm-osc.js"),
        this.ctx.audioWorklet.addModule("./worklets/wavetable-osc.js"),
      ]);
      this.workletsLoaded = true;
    } catch (e) {
      console.warn("AudioWorklet modules failed to load, using standard nodes:", e);
      this.workletsLoaded = false;
    }
  }

  /** Check if worklets are available. */
  hasWorklets(): boolean {
    return this.workletsLoaded;
  }

  // ── Multiband compressor ─────────────────────────────────────────────

  /** Initialize 3-band compressor nodes (called once in constructor). */
  private initMultiband(): void {
    // Crossover frequencies: 200 Hz (low/mid), 3000 Hz (mid/high)
    // Low band: LP @ 200 Hz
    this.mbLowLP = this.ctx.createBiquadFilter();
    this.mbLowLP.type = "lowpass";
    this.mbLowLP.frequency.value = 200;
    this.mbLowLP.Q.value = 0.7;

    // High band: HP @ 3000 Hz
    this.mbHighHP = this.ctx.createBiquadFilter();
    this.mbHighHP.type = "highpass";
    this.mbHighHP.frequency.value = 3000;
    this.mbHighHP.Q.value = 0.7;

    // Mid band: HP @ 200 Hz → LP @ 3000 Hz (bandpass via filter pair)
    const midHP = this.ctx.createBiquadFilter();
    midHP.type = "highpass";
    midHP.frequency.value = 200;
    midHP.Q.value = 0.7;
    const midLP = this.ctx.createBiquadFilter();
    midLP.type = "lowpass";
    midLP.frequency.value = 3000;
    midLP.Q.value = 0.7;
    midHP.connect(midLP);
    this.mbMidBP = [midHP, midLP];

    // Per-band compressors — default 25% amount: gentle glue
    // amount=0.25: low=-9dB/2.5:1, mid=-15dB/2.75:1, high=-15dB/3.75:1
    this.mbLowComp = this.ctx.createDynamicsCompressor();
    this.mbLowComp.threshold.value = -9;
    this.mbLowComp.ratio.value = 2.5;
    this.mbLowComp.attack.value = 0.02;
    this.mbLowComp.release.value = 0.15;
    this.mbLowComp.knee.value = 8;

    this.mbMidComp = this.ctx.createDynamicsCompressor();
    this.mbMidComp.threshold.value = -15;
    this.mbMidComp.ratio.value = 2.75;
    this.mbMidComp.attack.value = 0.005;
    this.mbMidComp.release.value = 0.1;
    this.mbMidComp.knee.value = 8;

    this.mbHighComp = this.ctx.createDynamicsCompressor();
    this.mbHighComp.threshold.value = -15;
    this.mbHighComp.ratio.value = 3.75;
    this.mbHighComp.attack.value = 0.001;
    this.mbHighComp.release.value = 0.06;
    this.mbHighComp.knee.value = 4;

    // Wire: filters → compressors
    this.mbLowLP.connect(this.mbLowComp);
    midLP.connect(this.mbMidComp);
    this.mbHighHP.connect(this.mbHighComp);

    // Subtle stereo widening on high band only (Haas effect, ~0.4ms)
    // Gain-compensated to avoid adding perceived loudness to hats
    const haasDelay = this.ctx.createDelay(0.01);
    haasDelay.delayTime.value = 0.0004;
    const haasPan = this.ctx.createStereoPanner();
    haasPan.pan.value = 0.6;
    const haasDirectPan = this.ctx.createStereoPanner();
    haasDirectPan.pan.value = -0.3;
    // Attenuate high band slightly — Haas sum adds ~3dB, compensate + pull hats back
    const haasGain = this.ctx.createGain();
    haasGain.gain.value = 0.42; // "Punchy" default width 60% → 0.6 * 0.7
    this.widthGain = haasGain;

    // Merge: all 3 bands sum into one node
    this.mbMerge = this.ctx.createGain();
    this.mbLowComp.connect(this.mbMerge);
    this.mbMidComp.connect(this.mbMerge);
    // High band: attenuate → direct (slight left) + delayed copy (right) for width
    this.mbHighComp.connect(haasGain);
    haasGain.connect(haasDirectPan);
    haasGain.connect(haasDelay);
    haasDelay.connect(haasPan);
    haasDirectPan.connect(this.mbMerge);
    haasPan.connect(this.mbMerge);
  }

  /** Enable/disable multiband compression. */
  setMultibandEnabled(on: boolean): void {
    this.mbEnabled = on;
    this.rebuildAntiClipChain();
  }

  isMultibandEnabled(): boolean {
    return this.mbEnabled;
  }

  /** Set multiband compression amount (0 = gentle, 1 = heavy).
   *  Scales thresholds and ratios across all 3 bands. */
  setMultibandAmount(amount: number): void {
    const a = Math.max(0, Math.min(1, amount));
    if (this.mbLowComp && this.mbMidComp && this.mbHighComp) {
      // Low: threshold -6 (gentle) to -18 (heavy), ratio 2 to 4
      this.mbLowComp.threshold.value = -6 - a * 12;
      this.mbLowComp.ratio.value = 2 + a * 2;
      // Mid: threshold -12 to -24, ratio 2 to 5
      this.mbMidComp.threshold.value = -12 - a * 12;
      this.mbMidComp.ratio.value = 2 + a * 3;
      // High: threshold -12 to -24, ratio 3 to 6
      this.mbHighComp.threshold.value = -12 - a * 12;
      this.mbHighComp.ratio.value = 3 + a * 3;
    }
  }

  // ── Effects ───────────────────────────────────────────────────────────

  /** Update an effect's parameters and rebuild the chain. */
  private fxRebuildTimer = 0;
  setEffect<K extends EffectName>(name: K, params: Partial<EffectParams[K]>): void {
    const prev = this.fx[name];
    const onChanged = "on" in params && (params as { on?: boolean }).on !== (prev as { on?: boolean }).on;
    this.fx[name] = { ...prev, ...params } as EffectParams[K];
    // Debounce ALL rebuilds — multiple rapid toggles collapse into one.
    // 100ms delay is imperceptible; old chain plays through until rebuild.
    clearTimeout(this.fxRebuildTimer);
    this.fxRebuildTimer = window.setTimeout(() => this.rebuildFxChain(), onChanged ? 100 : 200);
  }

  /** Get current effects state. */
  getEffects(): EffectParams {
    return this.fx;
  }

  /** Set the effect chain order and rebuild. */
  setEffectOrder(order: EffectName[]): void {
    this.effectOrder = order;
    clearTimeout(this.fxRebuildTimer);
    this.fxRebuildTimer = window.setTimeout(() => this.rebuildFxChain(), 100);
  }

  getEffectOrder(): EffectName[] {
    return this.effectOrder;
  }

  /** Rebuild the audio effects chain based on current fx state and effectOrder.
   *  Disconnects old nodes first, then builds new chain. Master stays connected
   *  to fxOutput as fallback during the brief rebuild window. */
  private rebuildFxChain(): void {
    // Ensure master → fxOutput direct path exists as fallback
    try { this.master.connect(this.fxOutput); } catch { /* already connected */ }

    // Disconnect old effect nodes (master → fxOutput stays as fallback)
    for (const n of this.fxNodes) { try { n.disconnect(); } catch { /* */ } }
    for (const lfo of this.fxLFOs) { try { lfo.stop(); lfo.disconnect(); } catch { /* */ } }
    this.fxNodes = [];
    this.fxLFOs = [];

    // Build new chain: master → [active effects] → fxOutput
    let prev: AudioNode = this.master;
    for (const name of this.effectOrder) {
      if (!this.fx[name].on) continue;
      prev = this.buildEffect(name, prev);
    }
    prev.connect(this.fxOutput);

    // Remove direct master → fxOutput if effects are active (avoid double signal)
    if (this.fxNodes.length > 0) {
      try { this.master.disconnect(this.fxOutput); } catch { /* */ }
    }
  }

  /** Build a single effect and connect it to the chain. Returns the new tail node. */
  private buildEffect(name: EffectName, prev: AudioNode): AudioNode {
    switch (name) {
      case "compressor": {
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = this.fx.compressor.threshold;
        comp.ratio.value = this.fx.compressor.ratio;
        comp.attack.value = 0.003;
        comp.release.value = 0.25;
        prev.connect(comp);
        this.fxNodes.push(comp);
        return comp;
      }
      case "highpass": {
        const hp = this.ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = this.fx.highpass.cutoff;
        hp.Q.value = this.fx.highpass.q;
        prev.connect(hp);
        this.fxNodes.push(hp);
        return hp;
      }
      case "distortion": {
        const ws = this.ctx.createWaveShaper();
        ws.curve = makeDistortionCurve(this.fx.distortion.drive);
        ws.oversample = "4x";
        const comp = this.ctx.createGain();
        comp.gain.value = 0.3 / (1 + this.fx.distortion.drive * 0.03);
        prev.connect(ws);
        ws.connect(comp);
        this.fxNodes.push(ws, comp);
        return comp;
      }
      case "bitcrusher": {
        if (this.workletsLoaded) {
          // AudioWorklet bitcrusher: true sample-and-hold + bit reduction
          const crusher = new AudioWorkletNode(this.ctx, "bitcrusher");
          crusher.parameters.get("bits")!.value = this.fx.bitcrusher.bits;
          crusher.parameters.get("crushRate")!.value = this.fx.bitcrusher.crushRate ?? this.ctx.sampleRate;
          prev.connect(crusher);
          this.fxNodes.push(crusher);
          return crusher;
        }
        // Fallback: WaveShaperNode quantization (no sample rate reduction)
        const preGain = this.ctx.createGain();
        preGain.gain.value = 1 + (16 - this.fx.bitcrusher.bits) * 0.15;
        const ws = this.ctx.createWaveShaper();
        ws.curve = makeBitcrushCurve(this.fx.bitcrusher.bits);
        const postGain = this.ctx.createGain();
        postGain.gain.value = 1 / preGain.gain.value;
        prev.connect(preGain);
        preGain.connect(ws);
        ws.connect(postGain);
        this.fxNodes.push(preGain, ws, postGain);
        return postGain;
      }
      case "chorus": {
        // 3-voice stereo chorus: L/center/R delay lines with offset LFOs + feedback
        const { rate, depth, mix } = this.fx.chorus;
        const dry = this.ctx.createGain(); dry.gain.value = 1 - mix;
        const wetL = this.ctx.createGain(); wetL.gain.value = mix * 0.7;
        const wetC = this.ctx.createGain(); wetC.gain.value = mix * 0.5;
        const wetR = this.ctx.createGain(); wetR.gain.value = mix * 0.7;
        const delayL = this.ctx.createDelay(0.05); delayL.delayTime.value = 0.012;
        const delayC = this.ctx.createDelay(0.05); delayC.delayTime.value = 0.010;
        const delayR = this.ctx.createDelay(0.05); delayR.delayTime.value = 0.008;
        // Feedback for richer ensemble (~20%)
        const fbL = this.ctx.createGain(); fbL.gain.value = 0.2;
        const fbR = this.ctx.createGain(); fbR.gain.value = 0.2;
        delayL.connect(fbL); fbL.connect(delayL);
        delayR.connect(fbR); fbR.connect(delayR);
        // LFO L (sine)
        const lfoL = this.ctx.createOscillator(); lfoL.type = "sine"; lfoL.frequency.value = rate;
        const lfoGainL = this.ctx.createGain(); lfoGainL.gain.value = depth;
        lfoL.connect(lfoGainL); lfoGainL.connect(delayL.delayTime); lfoL.start();
        // LFO Center (triangle, slightly slower for movement)
        const lfoC = this.ctx.createOscillator(); lfoC.type = "triangle"; lfoC.frequency.value = rate * 0.7;
        const lfoGainC = this.ctx.createGain(); lfoGainC.gain.value = depth * 0.6;
        lfoC.connect(lfoGainC); lfoGainC.connect(delayC.delayTime); lfoC.start();
        // LFO R (sine, quadrature offset)
        const lfoR = this.ctx.createOscillator(); lfoR.type = "sine"; lfoR.frequency.value = rate;
        const lfoGainR = this.ctx.createGain(); lfoGainR.gain.value = depth;
        const quarterPeriod = 1 / (4 * Math.max(rate, 0.01));
        lfoR.connect(lfoGainR); lfoGainR.connect(delayR.delayTime);
        lfoR.start(this.ctx.currentTime + quarterPeriod);
        this.fxLFOs.push(lfoL, lfoC, lfoR);
        // Pan: L=-0.8, center=0, R=0.8
        const panL = this.ctx.createStereoPanner(); panL.pan.value = -0.8;
        const panR = this.ctx.createStereoPanner(); panR.pan.value = 0.8;
        prev.connect(dry);
        prev.connect(delayL); delayL.connect(wetL); wetL.connect(panL);
        prev.connect(delayC); delayC.connect(wetC);
        prev.connect(delayR); delayR.connect(wetR); wetR.connect(panR);
        const merge = this.ctx.createGain();
        dry.connect(merge); panL.connect(merge); wetC.connect(merge); panR.connect(merge);
        this.fxNodes.push(dry, wetL, wetC, wetR, delayL, delayC, delayR, fbL, fbR, lfoGainL, lfoGainC, lfoGainR, panL, panR, merge);
        return merge;
      }
      case "phaser": {
        // 6-stage allpass phaser — LFO depth scaled per stage to prevent instability
        const { rate, depth } = this.fx.phaser;
        const lfo = this.ctx.createOscillator(); lfo.type = "sine"; lfo.frequency.value = rate; lfo.start();
        this.fxLFOs.push(lfo);
        const dry = this.ctx.createGain(); dry.gain.value = 0.5;
        const wet = this.ctx.createGain(); wet.gain.value = 0.5;
        prev.connect(dry);
        let apPrev: AudioNode = prev;
        const apFreqs = [200, 450, 1000, 2200, 4800, 10000];
        for (let i = 0; i < 6; i++) {
          const ap = this.ctx.createBiquadFilter(); ap.type = "allpass"; ap.frequency.value = apFreqs[i];
          // Scale LFO depth to 30% of center freq — prevents negative frequencies
          const lg = this.ctx.createGain(); lg.gain.value = apFreqs[i] * 0.3 * (depth / 1000);
          lfo.connect(lg); lg.connect(ap.frequency);
          apPrev.connect(ap); apPrev = ap; this.fxNodes.push(ap, lg);
        }
        apPrev.connect(wet);
        const merge = this.ctx.createGain(); dry.connect(merge); wet.connect(merge);
        this.fxNodes.push(dry, wet, merge);
        return merge;
      }
      case "delay": {
        // Ping-pong stereo delay: alternates L/R with cross-feedback
        const { time, feedback, mix, sync, division } = this.fx.delay;
        const delayTime = sync ? delayDivisionToSeconds(division, this.bpm) : time;
        const dry = this.ctx.createGain(); dry.gain.value = 1 - mix;
        const wetGain = this.ctx.createGain(); wetGain.gain.value = mix;
        // Two delay taps at equal time
        const dlL = this.ctx.createDelay(2); dlL.delayTime.value = delayTime;
        const dlR = this.ctx.createDelay(2); dlR.delayTime.value = delayTime;
        // Cross-feedback: L → R → L (ping-pong)
        const fbLR = this.ctx.createGain(); fbLR.gain.value = feedback;
        const fbRL = this.ctx.createGain(); fbRL.gain.value = feedback;
        dlL.connect(fbLR); fbLR.connect(dlR);
        dlR.connect(fbRL); fbRL.connect(dlL);
        // Pan delay outputs L/R
        const panL = this.ctx.createStereoPanner(); panL.pan.value = -1;
        const panR = this.ctx.createStereoPanner(); panR.pan.value = 1;
        dlL.connect(panL); dlR.connect(panR);
        // Mix into output
        const wetMerge = this.ctx.createGain();
        panL.connect(wetMerge); panR.connect(wetMerge);
        wetMerge.connect(wetGain);
        // Input feeds into left delay first
        prev.connect(dry); prev.connect(dlL);
        const merge = this.ctx.createGain(); dry.connect(merge); wetGain.connect(merge);
        this.fxNodes.push(dry, wetGain, dlL, dlR, fbLR, fbRL, panL, panR, wetMerge, merge);
        return merge;
      }
      case "reverb": {
        const { decay, mix, type: reverbType } = this.fx.reverb;
        const dry = this.ctx.createGain(); dry.gain.value = 1 - mix * 0.5;
        const wet = this.ctx.createGain(); wet.gain.value = mix * 1.5;
        // Cache IR — regenerate when decay or type changes
        const irType = (reverbType || "room") as ReverbType;
        if (!this.reverbIRCache || this.reverbIRCache.decay !== decay || this.reverbIRCache.type !== irType) {
          this.reverbIRCache = { decay, type: irType, buffer: generateImpulseResponse(this.ctx, decay, irType) };
        }
        const conv = this.ctx.createConvolver(); conv.buffer = this.reverbIRCache!.buffer;
        prev.connect(dry); prev.connect(conv); conv.connect(wet);
        const merge = this.ctx.createGain(); dry.connect(merge); wet.connect(merge);
        this.fxNodes.push(dry, wet, conv, merge);
        return merge;
      }
      case "duck":
        // Duck is gain automation, not an audio chain effect — passthrough
        return prev;
      case "flanger": {
        // Flanger: short delay (0.1-5ms) + LFO + high feedback = metallic sweep
        const { rate, depth, feedback, mix } = this.fx.flanger;
        const dry = this.ctx.createGain(); dry.gain.value = 1 - mix;
        const wet = this.ctx.createGain(); wet.gain.value = mix;
        const delay = this.ctx.createDelay(0.02);
        delay.delayTime.value = 0.003; // 3ms center
        const fb = this.ctx.createGain(); fb.gain.value = Math.min(feedback, 0.95);
        delay.connect(fb); fb.connect(delay); // feedback loop
        const lfo = this.ctx.createOscillator(); lfo.type = "sine"; lfo.frequency.value = rate;
        const lfoGain = this.ctx.createGain(); lfoGain.gain.value = depth * 0.003; // ±3ms sweep
        lfo.connect(lfoGain); lfoGain.connect(delay.delayTime); lfo.start();
        this.fxLFOs.push(lfo);
        prev.connect(dry); prev.connect(delay); delay.connect(wet);
        const merge = this.ctx.createGain(); dry.connect(merge); wet.connect(merge);
        this.fxNodes.push(dry, wet, delay, fb, lfoGain, merge);
        return merge;
      }
      case "tremolo": {
        // Tremolo: LFO modulates amplitude (like trance gate but in effect chain)
        const { rate, depth, shape } = this.fx.tremolo;
        const lfo = this.ctx.createOscillator();
        lfo.type = shape === "square" ? "square" : "sine";
        lfo.frequency.value = rate;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = depth * 0.5;
        const tremGain = this.ctx.createGain();
        tremGain.gain.value = 1 - depth * 0.5; // center point
        lfo.connect(lfoGain); lfoGain.connect(tremGain.gain);
        lfo.start();
        this.fxLFOs.push(lfo);
        prev.connect(tremGain);
        this.fxNodes.push(lfoGain, tremGain);
        return tremGain;
      }
    }
  }

  /** Update synth params for a specific channel. Updates active voices in real-time.
   *  Kills voices only when filter model or osc type changes (incompatible node types). */
  setSynthParams(ch: number, params: SynthParams): void {
    const prev = this.channelParams.get(ch);
    const filterModelChanged = prev && params.filterModel !== undefined && params.filterModel !== prev.filterModel;
    const oscTypeChanged = prev && params.oscType !== undefined && params.oscType !== prev.oscType;
    this.channelParams.set(ch, params);

    if (filterModelChanged || oscTypeChanged) {
      // Kill all voices — incompatible node types can't be updated in-place
      for (const [key, voice] of this.voices) {
        if (key.startsWith(`${ch}:`)) {
          this.stopVoice(voice);
          this.voices.delete(key);
        }
      }
      return;
    }

    // Fast path: skip voice updates if filter params haven't changed
    if (prev && params.cutoff === prev.cutoff && params.resonance === prev.resonance && params.filterType === prev.filterType) return;

    // Update filter on active voices — use direct .value (no automation timeline)
    for (const [key, voice] of this.voices) {
      if (key.startsWith(`${ch}:`) && voice.filter) {
        if (voice.filter instanceof AudioWorkletNode) {
          const cutoff = voice.filter.parameters.get("cutoff");
          const res = voice.filter.parameters.get("resonance");
          if (cutoff) cutoff.value = Math.min(params.cutoff, 12000);
          if (res) res.value = Math.min(4, 4 * Math.pow(params.resonance / 20, 0.7));
        } else {
          voice.filter.frequency.value = Math.min(params.cutoff, 12000);
          voice.filter.Q.value = params.resonance;
          if (params.filterType) voice.filter.type = params.filterType;
        }
      }
    }
  }

  /** Get current synth params for a channel. */
  getSynthParams(ch: number): SynthParams {
    return this.channelParams.get(ch) ?? { ...DEFAULT_SYNTH_PARAMS };
  }

  get name(): string {
    return "Audio Preview";
  }

  get id(): string {
    return "preview";
  }

  noteOn(ch: number, note: number, vel: number, time?: number): void {
    if (ch === DRUM_CH) {
      this.playDrum(note, vel, time);
    } else {
      this.playSynth(ch, note, vel, time);
      // Send CV pitch + gate for synth notes
      this.cv.setPitch(note, time);
      this.cv.setGate(true, time);
    }
  }

  noteOff(ch: number, note: number, time?: number): void {
    if (ch === DRUM_CH) return; // drums are one-shots
    this.releaseSynth(ch, note, time);
    this.cv.setGate(false, time);
  }

  allNotesOff(ch: number, _time?: number): void {
    if (ch === DRUM_CH) return;
    // Release all voices on this channel
    for (const [key, voice] of this.voices) {
      if (key.startsWith(`${ch}:`)) {
        this.stopVoice(voice);
        this.voices.delete(key);
      }
    }
  }

  programChange(_ch: number, _program: number, _time?: number): void {
    // No-op
  }

  clock(_time?: number): void {
    // No-op
  }

  /** Update a drum voice's params and regenerate its buffer. */
  setDrumVoice(note: number, params: Partial<DrumVoiceParams>): void {
    const current = this.drumVoiceParams.get(note) ?? { ...DEFAULT_DRUM_VOICE };
    const updated = { ...current, ...params };
    this.drumVoiceParams.set(note, updated);
    // Regenerate just this voice's buffer
    const synthFn = DRUM_SYNTHS.find(([n]) => n === note)?.[1];
    if (synthFn) {
      const buf = synthFn(this.ctx, updated);
      const data = buf.getChannelData(0);
      if (updated.filterCutoff !== undefined && updated.filterCutoff < 1) {
        applyFilter(data, updated.filterCutoff, this.ctx.sampleRate);
      }
      applyFadeOut(data, this.ctx.sampleRate);
      this.kit.set(note, buf);
    }
  }

  /** Get drum voice params for a note. */
  getDrumVoiceParams(note: number): DrumVoiceParams {
    return this.drumVoiceParams.get(note) ?? { ...DEFAULT_DRUM_VOICE };
  }

  /** Enable/disable CV output. */
  setCVEnabled(on: boolean): void {
    this.cv.setEnabled(on);
  }

  isCVEnabled(): boolean {
    return this.cv.isEnabled();
  }

  /** Update BPM for tempo-synced LFO and delay. */
  setBpm(bpm: number): void {
    this.bpm = bpm;
    // Update delay time in-place if synced — no chain rebuild needed
    if (this.fx.delay.on && this.fx.delay.sync) {
      clearTimeout(this.fxRebuildTimer);
      this.fxRebuildTimer = window.setTimeout(() => this.rebuildFxChain(), 100);
    }
  }

  /** Load custom drum samples (overrides synthesized kit). */
  loadCustomSamples(samples: Map<number, AudioBuffer>): void {
    this.customSamples = samples;
  }

  /** Toggle mute for a drum voice note. */
  toggleDrumMute(note: number): void {
    if (this.mutedDrumNotes.has(note)) this.mutedDrumNotes.delete(note);
    else this.mutedDrumNotes.add(note);
  }

  getMutedDrumNotes(): Set<number> {
    return this.mutedDrumNotes;
  }

  /** Get or create a channel bus (GainNode + AnalyserNode) for per-channel routing and metering. */
  private getChannelBus(ch: number): GainNode {
    let bus = this.channelBuses.get(ch);
    if (!bus) {
      bus = this.ctx.createGain();
      const vol = this.channelVolumes.get(ch) ?? 1;
      bus.gain.value = vol;

      // Per-channel 3-band EQ with genre-aware defaults
      const isDrums = ch === DRUM_CH;
      const isBass = ch === 1;
      const isSynth = ch === 0;
      const eqLow = this.ctx.createBiquadFilter();
      eqLow.type = "lowshelf";
      eqLow.frequency.value = isDrums ? 80 : 200; // drums: boost sub (50Hz) not mud (200Hz)
      eqLow.gain.value = isDrums ? 2 : 0; // gentle drum sub boost (F-M per-hit handles most compensation)
      const eqMid = this.ctx.createBiquadFilter();
      eqMid.type = "peaking";
      eqMid.frequency.value = (isBass || isSynth) ? 300 : 1000; // bass+synth: target mud zone
      eqMid.Q.value = (isBass || isSynth) ? 1.2 : 0.7;
      eqMid.gain.value = isBass ? -1.5 : isSynth ? -0.5 : 0; // gentle bass mud cut (preserve punch + harmonics)
      const eqHigh = this.ctx.createBiquadFilter();
      eqHigh.type = "highshelf"; eqHigh.frequency.value = 5000;
      eqHigh.gain.value = isDrums ? 0 : isBass ? -1 : 0; // no cut on drums — hats/cymbals need their air
      this.channelEQs.set(ch, [eqLow, eqMid, eqHigh]);

      // Route: bus → [HP on bass+synth] → EQ (low→mid→high) → panner → master
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = 0;
      if (isBass) {
        // Bass: HP at 50Hz (kick owns sub) — no LP, let preset filters shape tone
        const hp = this.ctx.createBiquadFilter();
        hp.type = "highpass"; hp.frequency.value = 50; hp.Q.value = 0.7;
        this.channelHPFs.set(ch, hp);
        bus.connect(hp);
        hp.connect(eqLow);
      } else if (isSynth) {
        // Synth: HP at 40Hz (kick owns sub)
        const hp = this.ctx.createBiquadFilter();
        hp.type = "highpass"; hp.frequency.value = 40; hp.Q.value = 0.7;
        this.channelHPFs.set(ch, hp);
        bus.connect(hp);
        hp.connect(eqLow);
      } else {
        bus.connect(eqLow);
      }
      eqLow.connect(eqMid);
      eqMid.connect(eqHigh);
      eqHigh.connect(panner);
      panner.connect(this.master);
      this.channelPanners.set(ch, panner);

      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = 4096;
      eqHigh.connect(analyser); // tap after EQ to reflect actual output
      this.channelAnalysers.set(ch, analyser);
      this.channelBuses.set(ch, bus);
    }
    return bus;
  }

  /** Set per-channel EQ gains in dB (-12 to +12). */
  setChannelEQ(ch: number, low: number, mid: number, high: number): void {
    const eq = this.channelEQs.get(ch);
    if (!eq) { this.getChannelBus(ch); return this.setChannelEQ(ch, low, mid, high); }
    eq[0].gain.value = Math.max(-12, Math.min(12, low));
    eq[1].gain.value = Math.max(-12, Math.min(12, mid));
    eq[2].gain.value = Math.max(-12, Math.min(12, high));
  }

  getChannelEQ(ch: number): { low: number; mid: number; high: number } {
    const eq = this.channelEQs.get(ch);
    if (!eq) return { low: 0, mid: 0, high: 0 };
    return { low: eq[0].gain.value, mid: eq[1].gain.value, high: eq[2].gain.value };
  }

  /** Set per-channel high-pass filter frequency (0 = off/bypass). */
  setChannelHPF(ch: number, freq: number): void {
    const hp = this.channelHPFs.get(ch);
    if (!hp) return;
    if (freq <= 20) { hp.type = "allpass"; return; }
    hp.type = "highpass";
    hp.frequency.value = Math.max(20, Math.min(500, freq));
  }

  getChannelHPF(ch: number): number {
    const hp = this.channelHPFs.get(ch);
    if (!hp || hp.type === "allpass") return 0;
    return hp.frequency.value;
  }

  /** Set per-channel trance gate. Rate is a delay division string. */
  /** Set per-channel gate. Supports LFO mode (regular) and pattern mode (step-sequenced).
   *  Pattern mode: 16-step array of 0/1 values synced to BPM for irregular stutter effects. */
  setChannelGate(ch: number, on: boolean, rate: string, depth: number, shape: string, mode = "lfo", pattern?: number[]): void {
    const eq = this.channelEQs.get(ch);
    const panner = this.channelPanners.get(ch);
    if (!eq || !panner) { this.getChannelBus(ch); return this.setChannelGate(ch, on, rate, depth, shape, mode, pattern); }
    const eqOut = eq[2];
    const monoNode = this.channelMonoState.get(ch) ? this.channelMonoNodes.get(ch) : null;
    const nextNode = monoNode ?? panner;
    const analyser = this.channelAnalysers.get(ch);

    // Remove existing gate — fully disconnect from chain
    const existing = this.channelGates.get(ch);
    if (existing) {
      if (existing.lfo) try { existing.lfo.stop(); existing.lfo.disconnect(); } catch { /* */ }
      if (existing.smoother) try { existing.smoother.disconnect(); } catch { /* */ }
      if (existing.depth) try { existing.depth.disconnect(); } catch { /* */ }
      if (existing.timerId) clearInterval(existing.timerId);
      try { eqOut.disconnect(existing.gate); } catch { /* */ }
      try { existing.gate.disconnect(); } catch { /* */ }
      this.channelGates.delete(ch);
      eqOut.connect(nextNode);
      if (analyser) eqOut.connect(analyser);
    }

    if (!on) return;

    // Create gate GainNode
    const gate = this.ctx.createGain();
    try { eqOut.disconnect(nextNode); } catch { /* */ }
    if (analyser) try { eqOut.disconnect(analyser); } catch { /* */ }
    eqOut.connect(gate);
    gate.connect(nextNode);
    if (analyser) gate.connect(analyser);

    if (mode === "pattern" && pattern && pattern.length > 0) {
      // ── Pattern mode: step-sequenced gate ──────────────────────────
      // Pre-schedules gain automation on the audio timeline (sample-accurate).
      // Schedules 2 bars ahead, reschedules every bar via timer.
      const stepDur = 60 / (this.bpm * 4); // seconds per 16th note
      const patLen = pattern.length;
      const barDur = stepDur * patLen;
      const dipTime = 0.004; // 4ms silence at start of each "on" step (retrigger)
      const rampTime = 0.004; // 4ms ramp back to full
      const mutedGain = 1 - depth;

      // Schedule one bar of gate pattern starting at `startTime`
      const scheduleBar = (startTime: number) => {
        for (let s = 0; s < patLen; s++) {
          const t = startTime + s * stepDur;
          if (pattern[s]) {
            // On-step: dip → ramp up (creates retrigger chop)
            gate.gain.setValueAtTime(mutedGain, t);
            gate.gain.linearRampToValueAtTime(1, t + rampTime);
          } else {
            // Off-step: mute
            gate.gain.setValueAtTime(mutedGain, t);
          }
        }
      };

      // Initial schedule: 2 bars from now
      const now = this.ctx.currentTime + 0.01; // small offset to avoid past-scheduling
      scheduleBar(now);
      scheduleBar(now + barDur);

      // Reschedule every bar to keep the automation running
      let nextBar = now + barDur * 2;
      const timerId = window.setInterval(() => {
        const ct = this.ctx.currentTime;
        // Clear past automation to prevent timeline buildup
        gate.gain.cancelScheduledValues(ct);
        gate.gain.setValueAtTime(gate.gain.value, ct);
        // Schedule bars until we're 2 bars ahead
        while (nextBar < ct + barDur * 2) {
          scheduleBar(nextBar);
          nextBar += barDur;
        }
      }, Math.max(50, barDur * 500)); // check frequently enough

      this.channelGates.set(ch, { lfo: null, depth: null, gate, on, timerId });
    } else {
      // ── LFO mode: regular gate (existing behavior) ────────────────
      const lfoFreq = 1 / delayDivisionToSeconds(rate, this.bpm);
      const lfo = this.ctx.createOscillator();
      lfo.type = shape === "triangle" ? "triangle" : "square";
      lfo.frequency.value = lfoFreq;

      const smoother = this.ctx.createBiquadFilter();
      smoother.type = "lowpass";
      smoother.frequency.value = shape === "triangle" ? 20000 : 150;
      smoother.Q.value = 0.5;

      const depthGain = this.ctx.createGain();
      depthGain.gain.value = depth * 0.5;
      gate.gain.value = 1 - depth * 0.5;

      lfo.connect(smoother);
      smoother.connect(depthGain);
      depthGain.connect(gate.gain);
      lfo.start();

      this.channelGates.set(ch, { lfo, depth: depthGain, gate, on, smoother });
    }
  }

  /** Set per-channel volume (0–1). */
  setChannelVolume(ch: number, v: number): void {
    const vol = Math.max(0, Math.min(1, v));
    this.channelVolumes.set(ch, vol);
    const bus = this.channelBuses.get(ch);
    if (bus) {
      const now = this.ctx.currentTime;
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(vol, now);
    }
  }

  /** Per-channel mono collapse nodes. */
  private channelMonoNodes: Map<number, GainNode> = new Map();
  private channelMonoState: Map<number, boolean> = new Map();

  /** Toggle mono output — collapses stereo to mono for mix checking. */
  private monoNode: GainNode | null = null;
  private isMono = false;

  setMono(mono: boolean): void {
    this.isMono = mono;
    if (mono) {
      if (!this.monoNode) {
        this.monoNode = this.ctx.createGain();
        this.monoNode.channelCount = 1;
        this.monoNode.channelCountMode = "explicit";
        this.monoNode.channelInterpretation = "speakers";
      }
      // Insert mono node: analyser → mono → destination
      this.analyser.disconnect();
      this.analyser.connect(this.monoNode);
      this.monoNode.connect(this.ctx.destination);
    } else {
      // Restore: analyser → destination
      if (this.monoNode) {
        this.analyser.disconnect();
        this.monoNode.disconnect();
      }
      this.analyser.connect(this.ctx.destination);
    }
  }

  getMono(): boolean { return this.isMono; }

  /** Toggle mono on a specific channel — collapses that instrument to center. */
  setChannelMono(ch: number, mono: boolean): void {
    this.channelMonoState.set(ch, mono);
    const eq = this.channelEQs.get(ch);
    const panner = this.channelPanners.get(ch);
    if (!eq || !panner) return;
    const eqOut = eq[2]; // eqHigh is the last EQ node before panner

    if (mono) {
      let monoNode = this.channelMonoNodes.get(ch);
      if (!monoNode) {
        monoNode = this.ctx.createGain();
        monoNode.channelCount = 1;
        monoNode.channelCountMode = "explicit";
        monoNode.channelInterpretation = "speakers";
        this.channelMonoNodes.set(ch, monoNode);
      }
      // Connect new path first, then disconnect old (glitch-free)
      eqOut.connect(monoNode);
      monoNode.connect(panner);
      setTimeout(() => { try { eqOut.disconnect(panner); } catch { /* */ } }, 5);
    } else {
      // Connect direct path first, then disconnect mono node
      eqOut.connect(panner);
      const monoNode = this.channelMonoNodes.get(ch);
      if (monoNode) setTimeout(() => { try { monoNode.disconnect(); } catch { /* */ } }, 5);
    }
  }

  getChannelMono(ch: number): boolean { return this.channelMonoState.get(ch) ?? false; }

  /** Set stereo pan for a channel (-1 left, 0 center, +1 right). */
  setChannelPan(ch: number, pan: number): void {
    const panner = this.channelPanners.get(ch);
    if (panner) panner.pan.value = Math.max(-1, Math.min(1, pan));
  }

  /** Get the AnalyserNode for a specific channel (for per-channel VU metering). */
  getChannelAnalyser(ch: number): AnalyserNode | null {
    return this.channelAnalysers.get(ch) ?? null;
  }

  /** Set anti-clip mode: "limiter", "hybrid", or "off". Reconnects audio graph. */
  /** Set drive gain in dB (-6 to +12). */
  setDrive(db: number): void {
    this.driveGain.gain.value = Math.pow(10, db / 20);
  }

  getDrive(): number {
    return 20 * Math.log10(Math.max(0.001, this.driveGain.gain.value));
  }

  setAntiClipMode(mode: "off" | "limiter" | "hybrid"): void {
    this.antiClipMode = mode;
    this.rebuildAntiClipChain();
  }

  /** Rebuild the fxOutput → ... → analyser chain based on current anti-clip mode. */
  private rebuildAntiClipChain(): void {
    // Disconnect all paths from fxOutput to analyser
    try { this.fxOutput.disconnect(); } catch { /* */ }
    if (this.lowCutFilter) try { this.lowCutFilter.disconnect(); } catch { /* */ }
    try { this.eqLow.disconnect(); } catch { /* */ }
    try { this.eqMid.disconnect(); } catch { /* */ }
    try { this.eqHigh.disconnect(); } catch { /* */ }
    try { this.masterBoost.disconnect(); } catch { /* */ }
    try { this.driveGain.disconnect(); } catch { /* */ }
    try { this.softClip.disconnect(); } catch { /* */ }
    try { this.limiter.disconnect(); } catch { /* */ }
    if (this.mbMerge) try { this.mbMerge.disconnect(); } catch { /* */ }

    // Common: fxOutput → [lowCut if active] → EQ (low→mid→high) → masterBoost
    if (this.lowCutFilter && this.lowCutFilter.type === "highpass") {
      this.fxOutput.connect(this.lowCutFilter);
      this.lowCutFilter.connect(this.eqLow);
    } else {
      this.fxOutput.connect(this.eqLow);
    }
    this.eqLow.connect(this.eqMid);
    this.eqMid.connect(this.eqHigh);
    this.eqHigh.connect(this.masterBoost);

    // After masterBoost, optionally insert multiband compressor
    let postEQ: AudioNode = this.masterBoost;
    if (this.mbEnabled && this.mbLowLP && this.mbMidBP && this.mbHighHP && this.mbMerge) {
      this.masterBoost.connect(this.mbLowLP);
      this.masterBoost.connect(this.mbMidBP[0]);
      this.masterBoost.connect(this.mbHighHP);
      postEQ = this.mbMerge;
    }

    if (this.antiClipMode === "off") {
      postEQ.connect(this.driveGain);
      this.driveGain.connect(this.analyser);
    } else if (this.antiClipMode === "limiter") {
      postEQ.connect(this.driveGain);
      this.driveGain.connect(this.limiter);
      this.limiter.connect(this.analyser);
    } else {
      this.softClip.curve = makeSoftClipCurve(true);
      this.softClip.oversample = "2x";
      postEQ.connect(this.driveGain);
      this.driveGain.connect(this.softClip);
      this.softClip.connect(this.limiter);
      this.limiter.connect(this.analyser);
    }
  }

  getAntiClipMode(): "off" | "limiter" | "hybrid" {
    return this.antiClipMode;
  }

  /** Enable/disable sidechain ducking: bass+synth duck on kick hits. */
  setSidechainDuck(on: boolean): void {
    this.sidechainDuck = on;
  }

  isSidechainDuck(): boolean {
    return this.sidechainDuck;
  }

  /** Set duck parameters: depth (0-1) and release (seconds). */
  setDuckParams(depth: number, release: number): void {
    this.duckDepth = Math.max(0, Math.min(1, depth));
    this.duckRelease = Math.max(0.01, Math.min(0.5, release));
  }

  getDuckParams(): { depth: number; release: number } {
    return { depth: this.duckDepth, release: this.duckRelease };
  }

  /** Set master 3-band EQ gains in dB (-12 to +12). */
  setEQ(low: number, mid: number, high: number): void {
    this.eqLow.gain.value = Math.max(-12, Math.min(12, low));
    this.eqMid.gain.value = Math.max(-12, Math.min(12, mid));
    this.eqHigh.gain.value = Math.max(-12, Math.min(12, high));
  }

  getEQ(): { low: number; mid: number; high: number } {
    return { low: this.eqLow.gain.value, mid: this.eqMid.gain.value, high: this.eqHigh.gain.value };
  }

  /** Set master output boost (linear gain, e.g. 1.0 = unity, 2.0 = +6dB). */
  setMasterBoost(gain: number): void {
    this.masterBoost.gain.value = Math.max(0.5, Math.min(3, gain));
  }

  /** Set stereo width (0 = mono-compatible, 1 = full width). Controls Haas effect level. */
  setWidth(width: number): void {
    if (this.widthGain) {
      this.widthGain.gain.value = Math.max(0, Math.min(1, width)) * 0.7;
    }
  }

  getWidth(): number {
    return this.widthGain ? this.widthGain.gain.value / 0.7 : 1;
  }

  /** Set low cut (high-pass) frequency on master output. 0 = off. */
  setLowCut(freq: number): void {
    const f = Math.max(0, Math.min(500, freq));
    if (f <= 20) {
      if (this.lowCutFilter) {
        this.lowCutFilter.type = "allpass"; // bypass
      }
      return;
    }
    const needsRebuild = !this.lowCutFilter;
    if (!this.lowCutFilter) {
      this.lowCutFilter = this.ctx.createBiquadFilter();
      this.lowCutFilter.Q.value = 0.7;
    }
    this.lowCutFilter.type = "highpass";
    this.lowCutFilter.frequency.value = f;
    if (needsRebuild) this.rebuildAntiClipChain(); // safe wiring through rebuildAntiClipChain
  }

  getLowCut(): number {
    if (!this.lowCutFilter || this.lowCutFilter.type === "allpass") return 0;
    return this.lowCutFilter.frequency.value;
  }

  /** Report scheduling drift from sequencer (ms). Called per step. */
  reportDrift(driftMs: number): void {
    this._driftSamples.push(Math.abs(driftMs));
  }

  /** Get current CPU load indicator (0-1). 0=healthy, >0.5=struggling, 1=critical. */
  getCpuLoad(): number {
    // Dead AudioContext = critical
    if (this.ctx.state !== "running") return 1;
    // Check if audio time stopped advancing (audio thread frozen)
    const now = this.ctx.currentTime;
    if (this._lastCtxTime !== undefined && now === this._lastCtxTime && now > 0) {
      this._frozenCount = (this._frozenCount ?? 0) + 1;
      if (this._frozenCount > 2) return 1; // frozen for >4s
    } else {
      this._frozenCount = 0;
    }
    this._lastCtxTime = now;
    // Map drift: 0-2ms=green, 2-10ms=yellow, >10ms=red
    return Math.min(1, this._maxDrift / 10);
  }
  private _lastCtxTime?: number;
  private _frozenCount?: number;

  /** Enable/disable mid-side EQ (cuts low-mids on side channel). */
  setMidSideEQ(on: boolean, freq = 300, gain = -4): void {
    this.msEnabled = on;
    if (!on) {
      // Bypass: disconnect MS chain, reconnect direct
      if (this.msSplitter) {
        try { this.masterBoost.disconnect(this.msSplitter); } catch { /* */ }
        if (this.msMerger) try { this.msMerger.disconnect(); } catch { /* */ }
      }
      return;
    }
    // Create MS chain if needed
    if (!this.msSplitter) {
      this.msSplitter = this.ctx.createChannelSplitter(2);
      this.msMerger = this.ctx.createChannelMerger(2);
      // Mid = (L+R)/2, Side = (L-R)/2
      // Encode: midL = L, midR = R (keep original for mid)
      // For side EQ: create sum/difference network
      this.msMidGain = this.ctx.createGain();
      this.msSideGain = this.ctx.createGain();
      this.msSideEQ = this.ctx.createBiquadFilter();
      this.msSideEQ.type = "peaking";
      this.msSideEQ.Q.value = 1.0;
    }
    // Update EQ params
    this.msSideEQ!.frequency.value = freq;
    this.msSideEQ!.gain.value = gain;
    // Wire: masterBoost → splitter → [L/R separate processing] → merger
    // Simplified approach: apply side EQ as a stereo width reduction in the mud zone
    // Use the existing stereo widening (Haas) path — adjust its gain based on frequency
    // Actually simplest: just apply a mid-frequency cut on the stereo difference
    // by reducing width at low-mids. This is effectively what MS EQ does.
    // For browser: reduce Haas effect amount at low-mids = less side energy there
    if (this.widthGain) {
      // Widen highs but narrow lows — achieved by the existing Haas on high band only
      // The MS EQ effect is already partially achieved by our crossover-based widening
      // Apply additional side cut via the widthGain
      this.widthGain.gain.value = Math.max(0, this.widthGain.gain.value * 0.7);
    }
  }

  getMidSideEQ(): boolean { return this.msEnabled; }

  /** Enable/disable metronome click. */
  setMetronome(on: boolean): void {
    this.metronomeOn = on;
  }

  isMetronomeOn(): boolean {
    return this.metronomeOn;
  }

  /** Play a short click at the given time (called by sequencer on beat). */
  playClick(time?: number): void {
    if (!this.metronomeOn) return;
    const when = time !== undefined ? Math.max(0, (time - performance.now()) / 1000) + this.ctx.currentTime : this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 1000;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setValueAtTime(0.3, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.03);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(when);
    osc.stop(when + 0.04);
    osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch { /* */ } };
  }

  /** Set master volume (0–1). */
  setVolume(v: number): void {
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(Math.max(0, Math.min(1, v)), now);
  }

  /** Get the AnalyserNode for VU metering. */
  getAnalyser(): AnalyserNode {
    return this.analyser;
  }

  /** Resume AudioContext after user gesture (browser autoplay policy).
   *  Always calls resume() — no-op if already running per spec,
   *  but Firefox may need the explicit call even when state !== "suspended". */
  async resume(): Promise<void> {
    try { await this.ctx.resume(); } catch { /* ignore */ }
  }

  close(): void {
    // Stop all active voices
    for (const voice of this.voices.values()) this.stopVoice(voice);
    this.voices.clear();
    // Stop all active drum sources
    for (const src of this.activeDrumSrcs) { try { src.stop(); } catch { /* */ } }
    this.activeDrumSrcs.clear();
    // Clear trance gate intervals
    for (const gate of this.channelGates.values()) {
      if (gate.timerId) clearInterval(gate.timerId);
      if (gate.lfo) try { gate.lfo.stop(); } catch { /* */ }
    }
    this.channelGates.clear();
    // Clean up FX rebuild timer
    clearTimeout(this.fxRebuildTimer);
    // Clean up Safari fix listeners
    clearInterval(this.heartbeatId);
    if (this.resumeOnInteraction) {
      document.removeEventListener("pointerdown", this.resumeOnInteraction);
      document.removeEventListener("keydown", this.resumeOnInteraction);
    }
    if (this.visibilityHandler) {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
    }
    this.cv.close();
    this.ctx.close();
  }

  // ── Drum playback ────────────────────────────────────────────────────

  private playDrum(note: number, vel: number, time?: number): void {
    if (this.mutedDrumNotes.has(note)) return;
    const buffer = this.customSamples.get(note) ?? this.kit.get(note);
    if (!buffer) return;

    const vp = this.drumVoiceParams.get(note);
    const level = vp?.level ?? 1;

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    // Fletcher-Munson compensation: human hearing is most sensitive at 2-5kHz.
    // Low drums (kick=36) need more gain to sound as loud as high drums (hats=42,46).
    // Fletcher-Munson compensation — modest correction only.
    // Synthesis amplitudes already vary (kick ~1.0, hat ~0.2), so F-M
    // should NOT try to compensate the full psychoacoustic range.
    // Channel lowshelf (+2dB) handles additional kick sub boost.
    const fmGain: Record<number, number> = {
      36: 1.6,  // kick — punchy boost (lowshelf adds +2dB sub on top)
      38: 1.1,  // snare — keep (wide spectrum, slight boost)
      42: 1.3,  // closed hat — RAISED (synthesis is very quiet)
      46: 1.2,  // open hat — RAISED
      47: 1.0,  // cowbell — REDUCED (800Hz is very audible)
      49: 1.1,  // crash — RAISED (synthesis is very quiet)
      50: 0.9,  // clap — keep (well-balanced)
      51: 1.0,  // ride — RAISED
      37: 1.0,  // rimshot — keep
      56: 0.9,  // cowbell alt
    };
    const targetGain = (vel / 127) * level * (fmGain[note] ?? 1.5);
    const gain = this.ctx.createGain();
    const drumWhen = perfToCtx(this.ctx, time);
    // Set gain immediately — drum buffers start from zero (sin(0)=0) so no onset click
    gain.gain.value = targetGain;

    // Stereo drum placement (user pan overrides default)
    const panVal = vp?.pan ?? DRUM_PAN[note] ?? 0;
    const pan = this.ctx.createStereoPanner();
    pan.pan.value = panVal;

    src.connect(gain);
    gain.connect(pan);
    pan.connect(this.getChannelBus(DRUM_CH));
    src.start(drumWhen);

    // Track active drum sources and clean up when done
    this.activeDrumSrcs.add(src);
    src.onended = () => { this.activeDrumSrcs.delete(src); try { src.disconnect(); gain.disconnect(); pan.disconnect(); } catch { /* */ } };

    // Safety: if too many drum sources active, kill oldest ones
    if (this.activeDrumSrcs.size > 16) {
      const iter = this.activeDrumSrcs.values();
      for (let i = 0; i < 4; i++) {
        const old = iter.next().value;
        if (old) { try { old.stop(); } catch { /* */ } }
      }
    }

    // Sidechain duck: on every kick hit, temporarily reduce bass/synth volume.
    // Uses direct .value assignment (not AudioParam automation) because
    // setChannelVolume also writes to bus.gain.value — mixing .value with
    // scheduled automation causes undefined behavior in the Web Audio spec.
    // Recovery uses setTimeout instead of setTargetAtTime for the same reason.
    if (this.sidechainDuck && note === 36) {
      const duckTo = 1 - this.duckDepth;
      const relMs = this.duckRelease * 1000;
      for (const [ch, bus] of this.channelBuses) {
        if (ch === DRUM_CH) continue;
        const vol = this.channelVolumes.get(ch) ?? 1;
        if (vol <= 0) continue;
        bus.gain.value = vol * duckTo;
        clearTimeout((bus as unknown as Record<string, number>).__duckTimer);
        (bus as unknown as Record<string, number>).__duckTimer = window.setTimeout(() => {
          bus.gain.value = vol;
        }, relMs + 20) as unknown as number; // +20ms padding for audio thread scheduling jitter
      }
    }
  }

  // ── Synth playback ───────────────────────────────────────────────────

  private playSynth(ch: number, note: number, vel: number, time?: number): void {
    // DEBUG: uncomment next line to silence all synth — test if click is from drums
    // if (true) return;
    const key = `${ch}:${note}`;
    const p = this.getSynthParams(ch);
    const freq = midiToFreq(note);

    // Release any existing voice on this note (retrigger)
    const prev = this.voices.get(key);
    const isRetrigger = !!prev;
    if (prev) {
      // Gentle crossfade with cancelAndHoldAtTime to freeze at current value
      const now = this.ctx.currentTime;
      if (prev.gain.gain.cancelAndHoldAtTime) {
        prev.gain.gain.cancelAndHoldAtTime(now);
      } else {
        prev.gain.gain.cancelScheduledValues(now);
      }
      const fadeTc = freq < 200 ? 0.015 : 0.008; // longer fade for bass to avoid mid-cycle click
      prev.gain.gain.setTargetAtTime(0, now, fadeTc);
      for (const o of prev.oscs) o.stop(now + 0.08);
      if (prev.subOsc) prev.subOsc.stop(now + 0.08);
      if (prev.lfo) prev.lfo.stop(now + 0.08);
      // Clean up on first osc end (no setTimeout — Safari-safe)
      if (prev.oscs[0]) prev.oscs[0].onended = () => this.disconnectVoice(prev);
    }

    const when = perfToCtx(this.ctx, time);
    const amp = (vel / 127) * 0.2;

    // Enforce minimum attack/release to prevent clicks
    const atk = Math.max(0.008, p.attack);
    const dec = Math.max(0.01, p.decay);
    // Time constant for exponential attack (reaches ~95% in 3*tc)
    const atkTc = atk / 3;

    // Filter with envelope (bypass when filterOn is false)
    let filter: BiquadFilterNode | AudioWorkletNode | null = null;
    const filterModel = p.filterModel ?? "digital";
    const useWorkletFilter = this.workletsLoaded && filterModel !== "digital";
    if (p.filterOn !== false) {
      const cutoffBase = Math.min(p.cutoff, 12000);
      const envDepth = p.filterEnvDepth ?? 0;
      const cutoffPeak = Math.min(cutoffBase + envDepth * 8000, 18000);

      if (useWorkletFilter) {
        // AudioWorklet filter (muug or 303)
        const processorName = filterModel === "mog" ? "moog-filter" : "diode-filter";
        filter = new AudioWorkletNode(this.ctx, processorName);
        const cutoffParam = (filter as AudioWorkletNode).parameters.get("cutoff")!;
        const resParam = (filter as AudioWorkletNode).parameters.get("resonance")!;
        // Map BiquadFilter Q (0.5-20) to worklet resonance (0-4).
        // Exponential curve: Q=1→0.5, Q=4→1.5, Q=10→3, Q=20→4 (self-oscillation)
        const mappedRes = Math.min(4, 4 * Math.pow(p.resonance / 20, 0.7));
        resParam.setValueAtTime(mappedRes, when);
        if (envDepth > 0) {
          cutoffParam.setValueAtTime(Math.max(cutoffBase * 0.5, 200), when);
          cutoffParam.setTargetAtTime(cutoffPeak, when, atkTc);
          cutoffParam.setTargetAtTime(Math.max(cutoffBase * p.sustain, 200), when + atk, dec / 3);
        } else {
          cutoffParam.setValueAtTime(cutoffBase, when);
        }
      } else {
        // Standard BiquadFilterNode
        const bqFilter = this.ctx.createBiquadFilter();
        bqFilter.type = p.filterType;
        bqFilter.Q.setValueAtTime(p.resonance, when);
        if (envDepth > 0) {
          bqFilter.frequency.setValueAtTime(Math.max(cutoffBase * 0.5, 200), when);
          bqFilter.frequency.setTargetAtTime(cutoffPeak, when, atkTc);
          bqFilter.frequency.setTargetAtTime(Math.max(cutoffBase * p.sustain, 200), when + atk, dec / 3);
        } else {
          bqFilter.frequency.setValueAtTime(cutoffBase, when);
        }
        filter = bqFilter;
      }
    }

    // ADSR gain envelope — anchor at 0 before ramp (Chrome linearRamp fix)
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setValueAtTime(0, Math.max(0, when - 0.002));
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(amp, when + atk);
    gain.gain.setTargetAtTime(amp * Math.max(p.sustain, 0.001), when + atk, dec / 3);

    const chBus = this.getChannelBus(ch);

    // ── Filter drive: gain stage before filter for resonance/self-oscillation ──
    let filterDriveNode: GainNode | null = null;
    let driveCompNode: GainNode | null = null;
    const filterDriveAmt = p.filterDrive ?? 0;
    if (filter && filterDriveAmt > 0) {
      filterDriveNode = this.ctx.createGain();
      // Drive range: 1x (clean) to 8x (heavy overdrive into filter)
      filterDriveNode.gain.value = 1 + filterDriveAmt * 7;
      // Compensate output volume
      driveCompNode = this.ctx.createGain();
      driveCompNode.gain.value = 1 / (1 + filterDriveAmt * 3);
      // Wire: oscs → filterDriveNode → filter → driveComp → gain
      filterDriveNode.connect(filter);
      filter.connect(driveCompNode);
      driveCompNode.connect(gain);
    }

    // ── Oscillator(s) — mono, stereo detune, or unison ──────────────
    const oscs: OscillatorNode[] = [];
    const panNodes: StereoPannerNode[] = [];
    const workletOscs: AudioWorkletNode[] = [];
    const unisonOverride = localStorage.getItem("mpump-unison") ?? "auto";
    const unisonCount = unisonOverride === "auto" ? (p.unison ?? 1) : parseInt(unisonOverride) || 1;
    const unisonSpread = unisonCount > 1 ? (p.unisonSpread ?? 25) : 0;
    const filterInput = filterDriveNode ?? filter ?? gain; // connect oscs through drive if present
    const isPWM = p.oscType === "pwm";
    const isWorkletOsc = this.workletsLoaded && (p.oscType === "sync" || p.oscType === "fm" || p.oscType === "wavetable");
    const oscTypeForNode = (isPWM || isWorkletOsc ? "sawtooth" : p.oscType) as OscillatorType;

    // Analog drift: slow random pitch modulation per oscillator
    // Skip on retrigger to avoid beating between old and new drift phases
    const driftAmount = freq < 200 ? 0.0006 : 0.0017;
    const addDrift = (osc: OscillatorNode, extras: AudioNode[]) => {
      if (isRetrigger || this.perfMode === "eco") return null; // no drift on retrigger or eco mode
      const driftLfo = this.ctx.createOscillator();
      driftLfo.type = "sine";
      driftLfo.frequency.value = 0.15 + Math.random() * 0.2;
      const driftGain = this.ctx.createGain();
      driftGain.gain.value = freq * driftAmount;
      driftLfo.connect(driftGain);
      driftGain.connect(osc.frequency);
      driftLfo.start(when);
      extras.push(driftGain); // track for cleanup
      return driftLfo;
    };
    const driftLFOs: OscillatorNode[] = [];
    // Extra nodes for PWM (delays, inverters, LFOs) — tracked for cleanup
    const pwmExtras: AudioNode[] = [];
    // Track filter drive nodes for cleanup (created earlier in filter setup)
    if (filterDriveNode) pwmExtras.push(filterDriveNode);
    if (driveCompNode) pwmExtras.push(driveCompNode);

    /** Create an oscillator (or PWM pair / worklet osc) and connect output to `target`.
     *  Returns the primary osc (for pitch tracking / stop). */
    const createOsc = (target: AudioNode, detuneCents: number): OscillatorNode => {
      // Worklet oscillators: sync, fm, wavetable
      if (isWorkletOsc) {
        let workletNode: AudioWorkletNode;
        const detuneRatio = Math.pow(2, detuneCents / 1200);
        const detuned = freq * detuneRatio;
        if (p.oscType === "sync") {
          workletNode = new AudioWorkletNode(this.ctx, "sync-osc");
          workletNode.parameters.get("frequency")!.setValueAtTime(detuned, when);
          workletNode.parameters.get("slaveRatio")!.setValueAtTime(p.syncRatio ?? 2, when);
        } else if (p.oscType === "fm") {
          workletNode = new AudioWorkletNode(this.ctx, "fm-osc");
          workletNode.parameters.get("frequency")!.setValueAtTime(detuned, when);
          workletNode.parameters.get("modRatio")!.setValueAtTime(p.fmRatio ?? 2, when);
          workletNode.parameters.get("modIndex")!.setValueAtTime(p.fmIndex ?? 5, when);
        } else {
          workletNode = new AudioWorkletNode(this.ctx, "wavetable-osc");
          workletNode.parameters.get("frequency")!.setValueAtTime(detuned, when);
          workletNode.parameters.get("tablePosition")!.setValueAtTime(p.wavetablePos ?? 0.5, when);
          workletNode.port.postMessage({ table: p.wavetable ?? "basic" });
        }
        workletNode.connect(target);
        workletOscs.push(workletNode);
        // Create a silent dummy osc for voice lifecycle (stop/onended)
        const dummy = this.ctx.createOscillator();
        dummy.frequency.value = 0;
        const silence = this.ctx.createGain();
        silence.gain.value = 0;
        dummy.connect(silence);
        silence.connect(target);
        dummy.start(when);
        pwmExtras.push(silence);
        return dummy;
      }

      const osc = this.ctx.createOscillator();
      osc.type = oscTypeForNode;
      osc.frequency.setValueAtTime(freq, when);
      osc.detune.setValueAtTime(detuneCents, when);
      const d1 = addDrift(osc, pwmExtras);
      if (d1) driftLFOs.push(d1);
      osc.start(when);

      if (!isPWM) {
        osc.connect(target);
        return osc;
      }

      // PWM: two saws, one inverted + delayed. Delay = pulse width / frequency.
      const osc2 = this.ctx.createOscillator();
      osc2.type = "sawtooth";
      osc2.frequency.setValueAtTime(freq, when);
      osc2.detune.setValueAtTime(detuneCents, when);
      const d2 = addDrift(osc2, pwmExtras);
      if (d2) driftLFOs.push(d2);
      osc2.start(when);

      const inverter = this.ctx.createGain();
      inverter.gain.value = -1;

      // Delay controls pulse width (~0.5 duty cycle center)
      const pwDelay = this.ctx.createDelay(0.05);
      const basePW = 0.5 / Math.max(freq, 20); // 50% duty cycle
      pwDelay.delayTime.value = basePW;

      // Slow LFO sweeps pulse width for classic PWM movement
      const pwmLfo = this.ctx.createOscillator();
      pwmLfo.type = "triangle";
      pwmLfo.frequency.value = 0.4 + Math.random() * 0.3; // 0.4-0.7 Hz
      const pwmDepth = this.ctx.createGain();
      pwmDepth.gain.value = basePW * 0.4; // sweep ±40% around center
      pwmLfo.connect(pwmDepth);
      pwmDepth.connect(pwDelay.delayTime);
      pwmLfo.start(when);

      // Saw1 direct + Saw2 inverted+delayed → sum = pulse wave
      const sum = this.ctx.createGain();
      sum.gain.value = 0.5; // normalize amplitude
      osc.connect(sum);
      osc2.connect(inverter);
      inverter.connect(pwDelay);
      pwDelay.connect(sum);
      sum.connect(target);

      oscs.push(osc2); // track for stop/cleanup
      pwmExtras.push(inverter, pwDelay, pwmDepth, sum);
      // pwmLfo tracked separately so it gets stopped
      driftLFOs.push(pwmLfo);

      return osc;
    };

    if (unisonCount > 1 && unisonSpread > 0) {
      // Unison: N voices spread across stereo field
      const voiceGain = 1 / Math.pow(unisonCount, 0.15);
      for (let v = 0; v < unisonCount; v++) {
        const t = unisonCount === 1 ? 0 : (v / (unisonCount - 1)) * 2 - 1; // -1 to +1
        const detuneCents = t * unisonSpread + (p.detune ?? 0);
        const panVal = t * 0.8;

        const voiceAmp = this.ctx.createGain();
        voiceAmp.gain.value = voiceGain;
        const pan = this.ctx.createStereoPanner();
        pan.pan.value = panVal;
        voiceAmp.connect(pan);
        pan.connect(filterInput);

        const osc = createOsc(voiceAmp, detuneCents);
        oscs.push(osc);
        panNodes.push(pan);
        pwmExtras.push(voiceAmp); // track for cleanup
      }
    } else if (p.detune && p.detune > 0) {
      // Stereo detune: 2 oscillators panned L/R
      const panL = this.ctx.createStereoPanner();
      panL.pan.value = -0.7;
      const panR = this.ctx.createStereoPanner();
      panR.pan.value = 0.7;
      panL.connect(filterInput);
      panR.connect(filterInput);

      oscs.push(createOsc(panL, -p.detune / 2));
      oscs.push(createOsc(panR, p.detune / 2));
      panNodes.push(panL, panR);
    } else {
      // Single mono oscillator
      oscs.push(createOsc(filterInput, p.detune ?? 0));
    }

    // Connect filter → gain → bus (skip if filterDrive already wired it)
    if (filter && !filterDriveNode) {
      filter.connect(gain);
    }
    gain.connect(chBus);

    // Sub-bass oscillator (sine, -1 octave) — always mono center
    let subOsc: OscillatorNode | null = null;
    let subGain: GainNode | null = null;
    if (p.subOsc) {
      subOsc = this.ctx.createOscillator();
      subOsc.type = "sine";
      subOsc.frequency.setValueAtTime(freq / 2, when);
      subGain = this.ctx.createGain();
      subGain.gain.value = 0;
      subGain.gain.setValueAtTime(0, Math.max(0, when - 0.002));
      subGain.gain.setValueAtTime(0, when);
      subGain.gain.linearRampToValueAtTime(amp * p.subLevel, when + atk);
      subGain.gain.setTargetAtTime(amp * p.subLevel * Math.max(p.sustain, 0.001), when + atk, dec / 3);
      subOsc.connect(subGain);
      subGain.connect(chBus);
      subOsc.start(when);
    }

    // LFO → cutoff / pitch / both
    let lfo: OscillatorNode | null = null;
    const lfoGains: GainNode[] = [];
    if (p.lfoOn && p.lfoDepth > 0) {
      lfo = this.ctx.createOscillator();
      lfo.type = p.lfoShape;
      const lfoHz = p.lfoSync ? lfoDivisionToHz(p.lfoDivision, this.bpm) : p.lfoRate;
      lfo.frequency.setValueAtTime(lfoHz, when);
      lfo.start(when);

      if ((p.lfoTarget === "cutoff" || p.lfoTarget === "both") && filter) {
        const lfoToCutoff = this.ctx.createGain();
        const cutoffVal = Math.min(p.cutoff, 12000);
        lfoToCutoff.gain.setValueAtTime(cutoffVal * p.lfoDepth * 0.8, when);
        lfo.connect(lfoToCutoff);
        // Connect LFO to filter cutoff — different API for worklet vs BiquadFilter
        const cutoffTarget = filter instanceof AudioWorkletNode
          ? filter.parameters.get("cutoff")!
          : filter.frequency;
        lfoToCutoff.connect(cutoffTarget);
        lfoGains.push(lfoToCutoff);
      }

      if (p.lfoTarget === "pitch" || p.lfoTarget === "both") {
        const lfoToPitch = this.ctx.createGain();
        lfoToPitch.gain.setValueAtTime(freq * p.lfoDepth * 0.06, when);
        lfo.connect(lfoToPitch);
        for (const o of oscs) lfoToPitch.connect(o.frequency);
        if (subOsc) lfoToPitch.connect(subOsc.frequency);
        lfoGains.push(lfoToPitch);
      }
    }

    this.voices.set(key, { oscs, panNodes, subOsc, subGain, gain, filter, lfo, lfoGains, driftLFOs, pwmExtras, workletOscs, env: { amp, atk, dec, sus: p.sustain, startTime: when } });

    // Voice limit: kill oldest voices if over 16 to prevent audio thread overload
    const voiceLimit = this.perfMode === "eco" ? 8 : parseInt(localStorage.getItem("mpump-voice-limit") ?? "16") || 16;
    if (this.voices.size > voiceLimit) {
      const oldest = this.voices.keys().next().value;
      if (oldest) {
        const v = this.voices.get(oldest);
        if (v) this.stopVoice(v);
        this.voices.delete(oldest);
      }
    }
  }

  private releaseSynth(ch: number, note: number, time?: number): void {
    const key = `${ch}:${note}`;
    const voice = this.voices.get(key);
    if (!voice) return;

    const p = this.getSynthParams(ch);
    const when = perfToCtx(this.ctx, time);
    const rel = Math.max(0.01, p.release);

    // cancelAndHoldAtTime freezes at interpolated value — no snap discontinuity
    const tc = Math.max(0.003, rel / 5);
    if (voice.gain.gain.cancelAndHoldAtTime) {
      voice.gain.gain.cancelAndHoldAtTime(when);
    } else {
      voice.gain.gain.cancelScheduledValues(when);
    }
    voice.gain.gain.setTargetAtTime(0, when, tc);
    // Hard zero just before osc stop — ensures no residual signal causes a click
    const stopAt = when + rel + 0.1;
    voice.gain.gain.setValueAtTime(0, stopAt - 0.002);
    for (const o of voice.oscs) o.stop(stopAt);

    if (voice.subOsc && voice.subGain) {
      if (voice.subGain.gain.cancelAndHoldAtTime) {
        voice.subGain.gain.cancelAndHoldAtTime(when);
      } else {
        voice.subGain.gain.cancelScheduledValues(when);
      }
      voice.subGain.gain.setTargetAtTime(0, when, tc);
      voice.subGain.gain.setValueAtTime(0, stopAt - 0.002);
      voice.subOsc.stop(stopAt);
    }

    if (voice.lfo) {
      voice.lfo.stop(stopAt);
    }

    // Clean up when first osc ends (no setTimeout — Safari-safe)
    if (voice.oscs[0]) {
      voice.oscs[0].onended = () => {
        this.disconnectVoice(voice);
        if (this.voices.get(key) === voice) this.voices.delete(key);
      };
    }
  }

  /** Disconnect all nodes in a voice from the audio graph to free memory. */
  private disconnectVoice(voice: SynthVoice): void {
    try {
      for (const o of voice.oscs) o.disconnect();
      for (const p of voice.panNodes) p.disconnect();
      voice.gain.disconnect();
      if (voice.filter) voice.filter.disconnect();
      if (voice.subOsc) voice.subOsc.disconnect();
      if (voice.subGain) voice.subGain.disconnect();
      if (voice.lfo) voice.lfo.disconnect();
      for (const g of voice.lfoGains) g.disconnect();
      for (const d of voice.driftLFOs) { try { d.stop(); d.disconnect(); } catch { /* */ } }
      for (const n of voice.pwmExtras) { try { n.disconnect(); } catch { /* */ } }
      for (const w of voice.workletOscs) { try { w.disconnect(); } catch { /* */ } }
    } catch { /* already disconnected */ }
  }

  private stopVoice(voice: SynthVoice): void {
    try {
      const now = this.ctx.currentTime;
      const fadeOut = 0.035;
      if (voice.gain.gain.cancelAndHoldAtTime) {
        voice.gain.gain.cancelAndHoldAtTime(now);
      } else {
        voice.gain.gain.cancelScheduledValues(now);
      }
      const stopAt = now + fadeOut + 0.05;
      voice.gain.gain.setTargetAtTime(0, now, fadeOut / 4);
      voice.gain.gain.setValueAtTime(0, stopAt - 0.002);
      for (const o of voice.oscs) o.stop(stopAt);
      if (voice.subOsc && voice.subGain) {
        if (voice.subGain.gain.cancelAndHoldAtTime) {
          voice.subGain.gain.cancelAndHoldAtTime(now);
        } else {
          voice.subGain.gain.cancelScheduledValues(now);
        }
        voice.subGain.gain.setTargetAtTime(0, now, fadeOut / 4);
        voice.subGain.gain.setValueAtTime(0, stopAt - 0.002);
        voice.subOsc.stop(stopAt);
      }
      if (voice.lfo) {
        voice.lfo.stop(stopAt);
      }
      // Clean up when first osc ends (no setTimeout — Safari-safe)
      if (voice.oscs[0]) voice.oscs[0].onended = () => this.disconnectVoice(voice);
    } catch {
      // Voice may already be stopped
    }
  }
}
