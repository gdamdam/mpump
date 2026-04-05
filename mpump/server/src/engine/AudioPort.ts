/**
 * AudioPort — drop-in replacement for MidiPort that plays synthesized
 * sounds via the Web Audio API.  No sample files or MIDI devices needed.
 *
 * - Channel 9 (GM drums): 808-style one-shot drum samples
 * - All other channels: configurable synth with ADSR + filter envelope
 */

import type { SynthParams, EffectParams, EffectName, DrumVoiceParams } from "../types";
import { DEFAULT_SYNTH_PARAMS, DEFAULT_EFFECTS, DEFAULT_DRUM_VOICE, lfoDivisionToHz, delayDivisionToSeconds } from "../types";
import { CVOutput } from "./CVOutput";
import {
  perfToCtx,
  buildKit, DrumKit, DRUM_SYNTHS, applyFilter, applyFadeOut,
  DRUM_PAN, envValueAt,
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
  /** Fixed ring buffer for drift samples — avoids per-second array allocation. */
  private _driftBuf = new Float32Array(64);
  private _driftIdx = 0;
  private _driftCount = 0;
  /** Muted drum voice notes. */
  private mutedDrumNotes: Set<number> = new Set();
  /** Active drum sources — tracked to prevent accumulation. */
  private activeDrumSrcs: Set<AudioBufferSourceNode> = new Set();
  /** Pooled drum Gain+Panner pairs — avoids per-hit node creation (GC pressure). */
  private drumNodePool: { gain: GainNode; pan: StereoPannerNode }[] = [];
  private drumNodePoolMax = 24;
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
  /** Poly-synth AudioWorklet node (persistent, zero-allocation voices). */
  private polySynth: AudioWorkletNode | null = null;
  /** Per-channel gate fractions for poly-synth (set by Engine from device config). */
  private polySynthGateFractions = new Map<number, number>();
  private polySynthGateFractionDefault = 0.8;
  /** Drums bypass FX chain: when true, drums connect directly to fxOutput (skip reverb/delay/etc). */
  private drumsDirectOut: GainNode | null = null;
  private drumsBypassFx = false;
  /** Synth/bass bypass FX chain (shared node — worklet mixes both channels). */
  private synthBassDirectOut: GainNode | null = null;
  /** MB (multiband) bypass: excluded channels skip FX+EQ+MB, connect to driveGain. */
  private mbDrumsDirectOut: GainNode | null = null;
  private mbExcludeDrums = true;
  /** Stereo width gain (Haas effect level on high band). */
  private widthGain: GainNode | null = null;
  private widthDelay: DelayNode | null = null;
  private widthPanR: StereoPannerNode | null = null;
  private widthPanL: StereoPannerNode | null = null;
  private widthHP: BiquadFilterNode | null = null;
  private widthMerge: GainNode | null = null;
  private _userWidth = 0.5; // logical width set by user (0–1)
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
    // Performance mode from App-level detection
    const params = new URLSearchParams(window.location.search);
    this.perfMode = params.get("eco") === "true" ? "eco" : params.get("lite") === "true" ? "lite" : (localStorage.getItem("mpump-perf-mode") as "normal" | "lite" | "eco") ?? "normal";
    // Larger buffer prevents crackling under heavy effects chains (convolver, chorus, etc.).
    // The sequencer lookahead absorbs the extra latency.
    const hint = this.perfMode === "eco" ? "playback" : "balanced";
    this.ctx = new AC({ latencyHint: hint });
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
    this.eqMid.gain.value = -1.5; // "Punchy" default: mid cut (lighter for bass clarity)

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

    // Multiband compressor: skip in lite/eco mode (12 nodes, 3 compressors)
    if (this.perfMode === "normal") this.initMultiband();
    if (this.perfMode !== "normal") this.mbEnabled = false;

    // Stereo width (Haas effect on highs) — independent of MB
    this.initWidth();

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.connect(this.ctx.destination);


    // Default mode is "limiter": fxOutput → limiter → analyser
    this.rebuildAntiClipChain();

    // Initial chain: master → fxOutput (no effects)
    this.master.connect(this.fxOutput);

    // Drums bypass node: connects directly to fxOutput, skipping all effects
    this.drumsDirectOut = this.ctx.createGain();
    this.drumsDirectOut.gain.value = 1;
    this.drumsDirectOut.connect(this.fxOutput);

    // Synth/bass bypass node (worklet mixes both channels into one output)
    this.synthBassDirectOut = this.ctx.createGain();
    this.synthBassDirectOut.gain.value = 1;
    this.synthBassDirectOut.connect(this.fxOutput);

    // MB bypass nodes: skip FX+EQ+MB, connect directly to driveGain
    this.mbDrumsDirectOut = this.ctx.createGain();
    this.mbDrumsDirectOut.gain.value = 1;
    this.mbDrumsDirectOut.connect(this.driveGain);


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
      // Flush automation timelines on persistent nodes to prevent buildup.
      // cancelScheduledValues(0) clears ALL events (past + future), then we
      // re-set the current value so the node continues at the right level.
      const ct = this.ctx.currentTime;
      try {
        this.master.gain.cancelScheduledValues(0);
        this.master.gain.setValueAtTime(this.master.gain.value, ct);
      } catch { /* */ }
      for (const [, bus] of this.channelBuses) {
        try {
          bus.gain.cancelScheduledValues(0);
          bus.gain.setValueAtTime(bus.gain.value, ct);
        } catch { /* */ }
      }

      // CPU drift: compute max from ring buffer, reset count
      if (this._driftCount > 0) {
        let max = 0;
        for (let i = 0; i < this._driftCount; i++) {
          if (this._driftBuf[i] > max) max = this._driftBuf[i];
        }
        this._maxDrift = max;
        this._driftCount = 0;
        this._driftIdx = 0;
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
        this.ctx.audioWorklet.addModule("./worklets/poly-synth.js"),
      ]);
      this.workletsLoaded = true;
      // Create persistent poly-synth node (output channels = 2 for stereo)
      this.polySynth = new AudioWorkletNode(this.ctx, "poly-synth", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });
      // Connect poly-synth to master and sync params
      this.polySynth.connect(this.master);
      for (const [ch, params] of this.channelParams) {
        if (ch !== 9) this.sendPolySynthParams(params, ch);
      }
      for (const [ch, vol] of this.channelVolumes) {
        if (ch !== 9) this.polySynth.port.postMessage({ type: "volume", channel: ch, volume: vol });
      }
      for (const [ch, panner] of this.channelPanners) {
        if (ch !== 9) this.polySynth.port.postMessage({ type: "pan", channel: ch, pan: panner.pan.value });
      }
      this.polySynth.port.postMessage({ type: "bpm", bpm: this.bpm });
      this.polySynth.port.postMessage({ type: "duck_params", depth: this.duckDepth, release: this.duckRelease });
    } catch (e) {
      console.warn("AudioWorklet modules failed to load, using standard nodes:", e);
      this.workletsLoaded = false;
    }
  }

  /** Set gate fraction for poly-synth per channel (called by Engine with device config value). */
  setPolySynthGate(ch: number, fraction: number): void {
    this.polySynthGateFractions.set(ch, Math.max(0.1, Math.min(1, fraction)));
  }

  /** Send synth params to poly-synth worklet for a specific channel. */
  sendPolySynthParams(p: SynthParams, ch?: number): void {
    if (!this.polySynth) return;
    this.polySynth.port.postMessage({
      type: "params",
      channel: ch,
      oscType: p.oscType,
      filterModel: p.filterModel ?? "digital",
      filterType: p.filterType ?? "lowpass",
      attack: p.attack,
      decay: p.decay,
      sustain: p.sustain,
      release: p.release,
      cutoff: p.cutoff,
      resonance: p.resonance,
      filterOn: p.filterOn,
      filterEnvDepth: p.filterEnvDepth ?? 0,
      filterDecay: p.filterDecay ?? 0,
      filterDrive: p.filterDrive ?? 0,
      subOsc: p.subOsc,
      subLevel: p.subLevel,
      detune: p.detune ?? 0,
      unison: p.unison ?? 1,
      unisonSpread: p.unisonSpread ?? 25,
      syncRatio: p.syncRatio ?? 2,
      fmRatio: p.fmRatio ?? 2,
      fmIndex: p.fmIndex ?? 5,
      wavetable: p.wavetable ?? "basic",
      wavetablePos: p.wavetablePos ?? 0.5,
      lfoOn: p.lfoOn,
      lfoRate: p.lfoRate,
      lfoDepth: p.lfoDepth,
      lfoShape: p.lfoShape,
      lfoTarget: p.lfoTarget,
      lfoSync: p.lfoSync,
      lfoSyncRate: p.lfoSync ? lfoDivisionToHz(p.lfoDivision, this.bpm) : undefined,
      presetGain: p.gain ?? 1.0,
    });
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
    this.mbMidComp.ratio.value = 2.5;
    this.mbMidComp.attack.value = 0.005;
    this.mbMidComp.release.value = 0.1;
    this.mbMidComp.knee.value = 8;

    this.mbHighComp = this.ctx.createDynamicsCompressor();
    this.mbHighComp.threshold.value = -12;
    this.mbHighComp.ratio.value = 3.0;
    this.mbHighComp.attack.value = 0.003;
    this.mbHighComp.release.value = 0.08;
    this.mbHighComp.knee.value = 8;

    // Wire: filters → compressors
    this.mbLowLP.connect(this.mbLowComp);
    midLP.connect(this.mbMidComp);
    this.mbHighHP.connect(this.mbHighComp);

    // Merge: all 3 bands sum into one node
    this.mbMerge = this.ctx.createGain();
    this.mbLowComp.connect(this.mbMerge);
    this.mbMidComp.connect(this.mbMerge);
    this.mbHighComp.connect(this.mbMerge);
  }

  /** Stereo width via Haas effect on highs — works independently of MB. */
  private initWidth(): void {
    // HP filter to isolate highs (>3kHz) for widening
    this.widthHP = this.ctx.createBiquadFilter();
    this.widthHP.type = "highpass";
    this.widthHP.frequency.value = 3000;
    this.widthHP.Q.value = 0.7;

    // Haas effect: delayed copy panned right, direct panned slightly left
    this.widthDelay = this.ctx.createDelay(0.01);
    this.widthDelay.delayTime.value = 0.0004;
    this.widthPanR = this.ctx.createStereoPanner();
    this.widthPanR.pan.value = 0.6;
    this.widthPanL = this.ctx.createStereoPanner();
    this.widthPanL.pan.value = -0.3;

    // Gain control — Haas sum adds ~3dB, compensate
    const haasGain = this.ctx.createGain();
    haasGain.gain.value = this._userWidth * 0.7;
    this.widthGain = haasGain;

    // Merge point for width output
    this.widthMerge = this.ctx.createGain();

    // Wire: HP → gain → direct (left pan) + delayed (right pan) → widthMerge
    this.widthHP.connect(haasGain);
    haasGain.connect(this.widthPanL);
    haasGain.connect(this.widthDelay);
    this.widthDelay.connect(this.widthPanR);
    this.widthPanL.connect(this.widthMerge);
    this.widthPanR.connect(this.widthMerge);
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
      // Mid: threshold -12 to -24, ratio 2 to 4.5
      this.mbMidComp.threshold.value = -12 - a * 12;
      this.mbMidComp.ratio.value = 2 + a * 2.5;
      // High: threshold -9 to -21, ratio 2.5 to 5
      this.mbHighComp.threshold.value = -9 - a * 12;
      this.mbHighComp.ratio.value = 2.5 + a * 2.5;
    }
  }

  // ── Effects ───────────────────────────────────────────────────────────

  /** Update an effect's parameters and rebuild the chain. */
  private fxRebuildTimer = 0;
  setEffect<K extends EffectName>(name: K, params: Partial<EffectParams[K]>): void {
    const prev = this.fx[name];
    const onChanged = "on" in params && (params as { on?: boolean }).on !== (prev as { on?: boolean }).on;
    this.fx[name] = { ...prev, ...params } as EffectParams[K];
    if ("excludeDrums" in params) this.updateDrumsBypassFx();
    if ("excludeBass" in params || "excludeSynth" in params) this.updateSynthBassBypassFx();
    // Debounce ALL rebuilds — multiple rapid toggles collapse into one.
    // 100ms delay is imperceptible; old chain plays through until rebuild.
    clearTimeout(this.fxRebuildTimer);
    this.fxRebuildTimer = window.setTimeout(() => this.rebuildFxChain(), onChanged ? 100 : 200);
  }

  /** Check if any effect has a given exclude flag set. */
  private anyFxExcludes(flag: "excludeDrums" | "excludeBass" | "excludeSynth"): boolean {
    for (const name of Object.keys(this.fx) as (keyof EffectParams)[]) {
      const p = this.fx[name] as Record<string, unknown>;
      if (p[flag]) return true;
    }
    return false;
  }

  /** Reroute synth (ch 0) and bass (ch 1) based on excludeSynth/excludeBass state.
   *  In worklet mode both channels share one output node, so either flag bypasses both. */
  private updateSynthBassBypassFx(): void {
    if (!this.synthBassDirectOut) return;
    const excludeSynth = this.anyFxExcludes("excludeSynth");
    const excludeBass  = this.anyFxExcludes("excludeBass");

    // Worklet mode: polySynth mixes ch0+ch1 — reroute entire worklet output
    if (this.polySynth) {
      const bypass = excludeSynth || excludeBass;
      if (bypass) {
        try { this.polySynth.disconnect(this.master); } catch { /* */ }
        try { this.polySynth.connect(this.synthBassDirectOut); } catch { /* already connected */ }
      } else {
        try { this.polySynth.disconnect(this.synthBassDirectOut); } catch { /* */ }
        try { this.polySynth.connect(this.master); } catch { /* already connected */ }
      }
    }

    // Non-worklet: reroute individual channel panners
    for (const [ch, shouldBypass] of [[0, excludeSynth], [1, excludeBass]] as [number, boolean][]) {
      const panner = this.channelPanners.get(ch);
      if (!panner) continue;
      if (shouldBypass) {
        try { panner.disconnect(this.master); } catch { /* */ }
        try { panner.connect(this.synthBassDirectOut); } catch { /* already connected */ }
      } else {
        try { panner.disconnect(this.synthBassDirectOut); } catch { /* */ }
        try { panner.connect(this.master); } catch { /* already connected */ }
      }
    }
  }

  /** Reroute drum channel based on excludeDrums state of any effect. */
  private updateDrumsBypassFx(): void {
    const shouldBypass = this.anyFxExcludes("excludeDrums");
    if (shouldBypass === this.drumsBypassFx) return;
    this.drumsBypassFx = shouldBypass;
    const panner = this.channelPanners.get(DRUM_CH);
    if (!panner || !this.drumsDirectOut) return;
    if (shouldBypass) {
      try { panner.disconnect(this.master); } catch { /* */ }
      panner.connect(this.drumsDirectOut);
    } else {
      try { panner.disconnect(this.drumsDirectOut); } catch { /* */ }
      panner.connect(this.master);
    }
  }

  // ── MB (multiband) channel exclusion ────────────────────────────────

  /** Set MB exclude for a channel. Excluded channels bypass FX+EQ+MB, go straight to driveGain. */
  setMbExclude(channel: "drums", exclude: boolean): void {
    if (channel === "drums") { this.mbExcludeDrums = exclude; this.updateDrumsBypassMb(); }
  }

  getMbExclude(): { drums: boolean } {
    return { drums: this.mbExcludeDrums };
  }

  /** Reroute drums based on MB exclude state. */
  private updateDrumsBypassMb(): void {
    const panner = this.channelPanners.get(DRUM_CH);
    if (!panner || !this.mbDrumsDirectOut) return;
    if (this.mbExcludeDrums) {
      try { panner.disconnect(this.master); } catch { /* */ }
      try { panner.disconnect(this.drumsDirectOut!); } catch { /* */ }
      try { panner.connect(this.mbDrumsDirectOut); } catch { /* already connected */ }
    } else {
      try { panner.disconnect(this.mbDrumsDirectOut); } catch { /* */ }
      if (this.drumsBypassFx && this.drumsDirectOut) {
        try { panner.connect(this.drumsDirectOut); } catch { /* already connected */ }
      } else {
        try { panner.connect(this.master); } catch { /* already connected */ }
      }
    }
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

  /** Rebuild the audio effects chain with crossfade to avoid signal gaps.
   *  Keeps direct master→fxOutput path live during rebuild, uses a fade-in
   *  gain on the new chain, then removes the direct path once faded in. */
  private fxCleanupTimer = 0;
  private rebuildFxChain(): void {
    const ct = this.ctx.currentTime;
    const FADE = 0.015; // 15ms crossfade

    // Ensure direct master→fxOutput path is live (carries signal during rebuild)
    try { this.master.connect(this.fxOutput); } catch { /* already connected */ }

    // Tear down old effect nodes immediately — the direct master→fxOutput path
    // carries signal during rebuild, so no gap. Deferred cleanup was leaking nodes
    // when rapid rebuilds cancelled the previous cleanup timer before it fired.
    clearTimeout(this.fxCleanupTimer);
    for (const n of this.fxNodes) { try { n.disconnect(); } catch { /* */ } }
    for (const lfo of this.fxLFOs) { try { lfo.stop(); lfo.disconnect(); } catch { /* */ } }

    // Build new chain
    this.fxNodes = [];
    this.fxLFOs = [];

    let prev: AudioNode = this.master;
    for (const name of this.effectOrder) {
      if (!this.fx[name].on) continue;
      prev = this.buildEffect(name, prev);
    }

    if (this.fxNodes.length > 0) {
      // Equal-power crossfade: direct path fades out while new chain fades in.
      // Insert a crossfade gain on the direct bypass path.
      const xfadeOut = this.ctx.createGain();
      xfadeOut.gain.setValueAtTime(1, ct);
      xfadeOut.gain.linearRampToValueAtTime(0, ct + FADE);
      try { this.master.disconnect(this.fxOutput); } catch { /* */ }
      this.master.connect(xfadeOut);
      xfadeOut.connect(this.fxOutput);

      const fadeIn = this.ctx.createGain();
      fadeIn.gain.setValueAtTime(0, ct);
      fadeIn.gain.linearRampToValueAtTime(1, ct + FADE);
      prev.connect(fadeIn);
      fadeIn.connect(this.fxOutput);
      this.fxNodes.push(fadeIn);

      // After crossfade: remove bypass, clean up xfade node
      setTimeout(() => {
        try { this.master.disconnect(xfadeOut); } catch { /* */ }
        try { xfadeOut.disconnect(); } catch { /* */ }
      }, FADE * 1000 + 5);
    }
    // If no effects active, direct path stays (already connected above)
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
    const filterTypeChanged = prev && params.filterType !== undefined && params.filterType !== prev.filterType;
    const oscTypeChanged = prev && params.oscType !== undefined && params.oscType !== prev.oscType;
    this.channelParams.set(ch, params);
    // Keep poly-synth worklet in sync with current params
    if (this.polySynth) this.sendPolySynthParams(params, ch);

    if (filterModelChanged || filterTypeChanged || oscTypeChanged) {
      // Kill all voices — incompatible filter/osc state can't carry over
      if (this.polySynth) {
        this.polySynth.port.postMessage({ type: "allNotesOff", channel: ch });
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

  /** Live keyboard noteOn — gate:0 so worklet sustains until liveNoteOff rather than auto-releasing. */
  liveNoteOn(ch: number, note: number, vel: number): void {
    if (ch === DRUM_CH) {
      this.playDrum(note, vel);
      return;
    }
    if (this.polySynth) {
      this.polySynth.port.postMessage({ type: "noteOn", channel: ch, note, vel, gate: 0 });
      this.cv.setPitch(note);
      this.cv.setGate(true);
    }
  }

  liveNoteOff(ch: number, note: number): void {
    if (ch === DRUM_CH) return;
    if (this.polySynth) {
      this.polySynth.port.postMessage({ type: "noteOff", channel: ch, note });
      this.cv.setGate(false);
    }
  }

  allNotesOff(ch: number, _time?: number): void {
    if (ch === DRUM_CH) return;
    if (this.polySynth) {
      this.polySynth.port.postMessage({ type: "allNotesOff", channel: ch });
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
    if (this.polySynth) {
      this.polySynth.port.postMessage({ type: "bpm", bpm });
      // Re-sync LFO rates for tempo-synced channels
      for (const [ch, params] of this.channelParams) {
        if (ch !== 9 && params.lfoSync) {
          this.polySynth.port.postMessage({ type: "params", channel: ch, lfoSyncRate: lfoDivisionToHz(params.lfoDivision, bpm) });
        }
      }
    }
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
      eqMid.gain.value = isBass ? -0.5 : isSynth ? -0.5 : 0; // light bass mud cut (preserve punch + harmonics)
      const eqHigh = this.ctx.createBiquadFilter();
      eqHigh.type = "highshelf"; eqHigh.frequency.value = 5000;
      eqHigh.gain.value = 0; // flat — let preset filters shape tone
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
      // Channel may bypass effects chain depending on exclude flags
      const excludeSynth = this.anyFxExcludes("excludeSynth");
      const excludeBass  = this.anyFxExcludes("excludeBass");
      const drumsMbBypass = ch === DRUM_CH && this.mbExcludeDrums && this.mbDrumsDirectOut;
      const drumsBypass = ch === DRUM_CH && this.drumsBypassFx && this.drumsDirectOut;
      const synthBass = (ch === 0 && excludeSynth) || (ch === 1 && excludeBass);
      const nonDrumBypass = synthBass && this.synthBassDirectOut;
      panner.connect(drumsMbBypass ? this.mbDrumsDirectOut! : drumsBypass ? this.drumsDirectOut! : nonDrumBypass ? this.synthBassDirectOut! : this.master);
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
    // Worklet output bypasses channel buses — gate must run inside the worklet
    if (this.polySynth && ch !== DRUM_CH) {
      if (mode === "pattern" && pattern) {
        this.polySynth.port.postMessage({ type: "gate_pattern", channel: ch, on, depth, mode: "pattern", pattern });
      } else {
        const lfoRate = 1 / delayDivisionToSeconds(rate, this.bpm);
        this.polySynth.port.postMessage({ type: "gate_pattern", channel: ch, on, depth, mode: "lfo", lfoRate, lfoShape: shape });
      }
      // Clean up any stale Web Audio gate node for this channel
      const existing = this.channelGates.get(ch);
      if (existing) {
        if (existing.lfo) try { existing.lfo.stop(); existing.lfo.disconnect(); } catch { /* */ }
        if (existing.smoother) try { existing.smoother.disconnect(); } catch { /* */ }
        if (existing.depth) try { existing.depth.disconnect(); } catch { /* */ }
        if (existing.timerId) clearInterval(existing.timerId);
        const eq = this.channelEQs.get(ch);
        const eqOut = eq?.[2];
        const monoNode = this.channelMonoState.get(ch) ? this.channelMonoNodes.get(ch) : null;
        const nextNode = monoNode ?? this.channelPanners.get(ch);
        if (eqOut && nextNode) {
          try { eqOut.disconnect(existing.gate); } catch { /* */ }
          try { existing.gate.disconnect(); } catch { /* */ }
          eqOut.connect(nextNode);
        }
        this.channelGates.delete(ch);
      }
      return;
    }

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
        // Clear ALL automation to prevent timeline buildup (past events accumulate)
        gate.gain.cancelScheduledValues(0);
        gate.gain.setValueAtTime(gate.gain.value, ct);
        // Schedule bars until we're 2 bars ahead
        while (nextBar < ct + barDur * 2) {
          scheduleBar(nextBar);
          nextBar += barDur;
        }
      }, Math.max(500, barDur * 500)); // reschedule once per half-bar minimum

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
    // Sync volume to poly-synth worklet
    if (this.polySynth && ch !== 9) {
      this.polySynth.port.postMessage({ type: "volume", channel: ch, volume: vol });
    }
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
    if (this.polySynth && ch !== 9) {
      this.polySynth.port.postMessage({ type: "pan", channel: ch, pan: Math.max(-1, Math.min(1, pan)) });
    }
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

  /** Rebuild the fxOutput → ... → analyser chain based on current anti-clip mode.
   *  Uses quick fade-out/fade-in on fxOutput to avoid routing discontinuity. */
  private rebuildAntiClipChain(): void {
    const ct = this.ctx.currentTime;
    const FADE = 0.008; // 8ms fade — shorter than FX crossfade since rewire is fast

    // Fade out fxOutput before rewiring (prevents click from broken routing)
    this.fxOutput.gain.cancelScheduledValues(0);
    this.fxOutput.gain.setValueAtTime(this.fxOutput.gain.value, ct);
    this.fxOutput.gain.linearRampToValueAtTime(0, ct + FADE);

    // Disconnect all paths from fxOutput to analyser
    // (scheduled slightly after fade completes to let audio thread process the ramp)
    const rewire = () => {
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
      if (this.widthHP) try { this.widthHP.disconnect(); } catch { /* */ }
      if (this.widthMerge) try { this.widthMerge.disconnect(); } catch { /* */ }
      if (this.widthGain) try { this.widthGain.disconnect(); } catch { /* */ }
      if (this.widthDelay) try { this.widthDelay.disconnect(); } catch { /* */ }
      if (this.widthPanL) try { this.widthPanL.disconnect(); } catch { /* */ }
      if (this.widthPanR) try { this.widthPanR.disconnect(); } catch { /* */ }

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

      // Stereo width: tap postEQ → HP filter → Haas widener → driveGain (additive)
      if (this.widthHP && this.widthGain && this.widthMerge && this.widthDelay && this.widthPanL && this.widthPanR) {
        postEQ.connect(this.widthHP);
        this.widthHP.connect(this.widthGain);
        this.widthGain.connect(this.widthPanL);
        this.widthGain.connect(this.widthDelay);
        this.widthDelay.connect(this.widthPanR);
        this.widthPanL.connect(this.widthMerge);
        this.widthPanR.connect(this.widthMerge);
        this.widthMerge.connect(this.driveGain);
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

      // Reconnect MB bypass nodes to driveGain (driveGain.disconnect() broke them)
      if (this.mbDrumsDirectOut) try { this.mbDrumsDirectOut.connect(this.driveGain); } catch { /* */ }

      // Fade back in
      const now = this.ctx.currentTime;
      this.fxOutput.gain.setValueAtTime(0, now);
      this.fxOutput.gain.linearRampToValueAtTime(1, now + FADE);
    };

    // Schedule rewire after fade-out completes
    setTimeout(rewire, FADE * 1000 + 2);
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
  setDuckParams(depth: number, release: number, excludeBass?: boolean, excludeSynth?: boolean): void {
    this.duckDepth = Math.max(0, Math.min(1, depth));
    this.duckRelease = Math.max(0.01, Math.min(0.5, release));
    if (excludeBass !== undefined)  (this.fx.duck as { excludeBass?: boolean }).excludeBass  = excludeBass;
    if (excludeSynth !== undefined) (this.fx.duck as { excludeSynth?: boolean }).excludeSynth = excludeSynth;
    if (this.polySynth) {
      this.polySynth.port.postMessage({ type: "duck_params", depth: this.duckDepth, release: this.duckRelease });
    }
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
    this._userWidth = Math.max(0, Math.min(1, width));
    this.applyWidth();
  }

  private applyWidth(): void {
    if (!this.widthGain) return;
    this.widthGain.gain.value = this._userWidth * 0.7;
  }

  getWidth(): number {
    return this._userWidth;
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

  /** Apply a full mixer scene atomically — cheap .value mutations first,
   *  then defer the expensive MB graph rebuild to the next frame. */
  loadScene(scene: {
    volumes: Record<number, number>;
    pans: Record<number, number>;
    chEQ: Record<number, { low: number; mid: number; high: number }>;
    masterEQ: { low: number; mid: number; high: number };
    drive: number; width: number; lowCut: number;
    mbOn: boolean; mbAmount: number;
  }): void {
    // Batch 1: cheap .value assignments (no graph changes)
    for (const [ch, v] of Object.entries(scene.volumes)) this.setChannelVolume(Number(ch), v);
    for (const [ch, v] of Object.entries(scene.pans)) this.setChannelPan(Number(ch), v);
    for (const [ch, eq] of Object.entries(scene.chEQ)) this.setChannelEQ(Number(ch), eq.low, eq.mid, eq.high);
    this.setEQ(scene.masterEQ.low, scene.masterEQ.mid, scene.masterEQ.high);
    this.setDrive(scene.drive);
    this.setWidth(scene.width);
    this.setLowCut(scene.lowCut);
    // Batch 2: defer MB (triggers rebuildAntiClipChain) to next frame
    if (this.mbEnabled !== scene.mbOn) {
      setTimeout(() => {
        this.setMultibandEnabled(scene.mbOn);
        this.setMultibandAmount(scene.mbAmount);
      }, 0);
    } else {
      this.setMultibandAmount(scene.mbAmount);
    }
  }

  /** Report scheduling drift from sequencer (ms). Called per step. */
  reportDrift(driftMs: number): void {
    this._driftBuf[this._driftIdx] = Math.abs(driftMs);
    this._driftIdx = (this._driftIdx + 1) & 63; // wrap at 64
    if (this._driftCount < 64) this._driftCount++;
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
    if (this.ctx.state === "closed") return;
    try { await this.ctx.resume(); } catch { /* ignore */ }
  }

  close(): void {
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

  /** Borrow a Gain+Panner pair from pool, or create if pool empty. */
  private borrowDrumNodes(): { gain: GainNode; pan: StereoPannerNode } {
    const pair = this.drumNodePool.pop();
    if (pair) return pair;
    return { gain: this.ctx.createGain(), pan: this.ctx.createStereoPanner() };
  }

  /** Return a Gain+Panner pair to the pool (disconnect src, keep gain→pan→bus wired). */
  private returnDrumNodes(pair: { gain: GainNode; pan: StereoPannerNode }): void {
    if (this.drumNodePool.length < this.drumNodePoolMax) {
      this.drumNodePool.push(pair);
    } else {
      // Pool full — disconnect and let GC collect
      try { pair.gain.disconnect(); pair.pan.disconnect(); } catch { /* */ }
    }
  }

  // Fletcher-Munson compensation table (static — no per-hit allocation)
  private static readonly FM_GAIN: Record<number, number> = {
    36: 1.6, 38: 1.1, 42: 1.3, 46: 1.2, 47: 1.0,
    49: 1.1, 50: 0.9, 51: 1.0, 37: 1.0, 56: 0.9,
  };

  /** Shared onended handler — bound once, avoids per-hit closure allocation.
   *  Maps BufferSourceNode → pooled nodes via WeakMap (no leak). */
  private drumSrcNodes = new WeakMap<AudioBufferSourceNode, { gain: GainNode; pan: StereoPannerNode }>();
  private readonly drumOnEnded = (e: Event) => {
    const src = e.target as AudioBufferSourceNode;
    this.activeDrumSrcs.delete(src);
    try { src.disconnect(); } catch { /* */ }
    const nodes = this.drumSrcNodes.get(src);
    if (nodes) {
      try { nodes.gain.disconnect(); nodes.pan.disconnect(); } catch { /* */ }
      this.returnDrumNodes(nodes);
    }
  };

  private playDrum(note: number, vel: number, time?: number): void {
    if (this.mutedDrumNotes.has(note)) return;
    const buffer = this.customSamples.get(note) ?? this.kit.get(note);
    if (!buffer) return;

    const vp = this.drumVoiceParams.get(note);
    const level = vp?.level ?? 1;

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const targetGain = (vel / 127) * level * (AudioPort.FM_GAIN[note] ?? 1.5);
    const { gain, pan } = this.borrowDrumNodes();
    const drumWhen = perfToCtx(this.ctx, time);
    gain.gain.value = targetGain;

    // Stereo drum placement (user pan overrides default)
    pan.pan.value = vp?.pan ?? DRUM_PAN[note] ?? 0;

    // Wire: src → gain → pan → bus (gain→pan→bus stays wired for reuse)
    src.connect(gain);
    gain.connect(pan);
    pan.connect(this.getChannelBus(DRUM_CH));
    src.start(drumWhen);

    // Track active drum sources and return nodes to pool when done
    this.activeDrumSrcs.add(src);
    this.drumSrcNodes.set(src, { gain, pan });
    src.onended = this.drumOnEnded;

    // Safety: if too many drum sources active, kill oldest ones
    if (this.activeDrumSrcs.size > 16) {
      const iter = this.activeDrumSrcs.values();
      for (let i = 0; i < 8; i++) {
        const old = iter.next().value;
        if (old) {
          try { old.stop(); } catch { /* */ }
          try { old.disconnect(); } catch { /* */ }
          this.activeDrumSrcs.delete(old);
        }
      }
    }

    // Sidechain duck: on every kick hit, temporarily reduce bass/synth volume.
    // Uses direct .value assignment (not AudioParam automation) because
    // setChannelVolume also writes to bus.gain.value — mixing .value with
    // scheduled automation causes undefined behavior in the Web Audio spec.
    // Recovery uses setTimeout instead of setTargetAtTime for the same reason.
    if (this.sidechainDuck && note === 36) {
      this.applyDuck();
    }
  }

  // ── Sidechain duck (single timer, no per-kick allocation) ────────────

  private duckTimer = 0;
  private readonly duckRecover = () => {
    for (const [ch, bus] of this.channelBuses) {
      if (ch === DRUM_CH) continue;
      if (this.polySynth && ch !== DRUM_CH) continue; // worklet recovers internally
      bus.gain.value = this.channelVolumes.get(ch) ?? 1;
    }
  };
  private applyDuck(): void {
    const excludeBass  = !!(this.fx.duck as { excludeBass?: boolean }).excludeBass;
    const excludeSynth = !!(this.fx.duck as { excludeSynth?: boolean }).excludeSynth;
    // Worklet path: send duck message per non-excluded, non-drum channel
    if (this.polySynth) {
      if (!excludeSynth) this.polySynth.port.postMessage({ type: "duck", channel: 0, depth: this.duckDepth });
      if (!excludeBass)  this.polySynth.port.postMessage({ type: "duck", channel: 1, depth: this.duckDepth });
    }
    // Web Audio path: set bus gain for non-worklet, non-excluded channels
    const duckTo = 1 - this.duckDepth;
    for (const [ch, bus] of this.channelBuses) {
      if (ch === DRUM_CH) continue;
      if (this.polySynth) continue; // handled by worklet above
      if (ch === 0 && excludeSynth) continue;
      if (ch === 1 && excludeBass)  continue;
      const vol = this.channelVolumes.get(ch) ?? 1;
      if (vol <= 0) continue;
      bus.gain.value = vol * duckTo;
    }
    clearTimeout(this.duckTimer);
    this.duckTimer = window.setTimeout(this.duckRecover, this.duckRelease * 1000 + 20);
  }

  // ── Synth playback ───────────────────────────────────────────────────

  private playSynth(ch: number, note: number, vel: number, time?: number): void {
    // Poly-synth worklet path: zero native node allocation
    // Send gate duration (seconds) so worklet handles its own release timing.
    // This avoids the issue where look-ahead scheduling sends noteOn+noteOff
    // back-to-back in the same tick, killing the voice before attack ramps up.
    if (this.polySynth) {
      const stepDur = 60 / (this.bpm * 4); // 16th note duration in seconds
      const noteLen = this.channelParams.get(ch)?.noteLength ?? 1;
      const gateSec = stepDur * noteLen * (this.polySynthGateFractions.get(ch) ?? this.polySynthGateFractionDefault);
      this.polySynth.port.postMessage({ type: "noteOn", channel: ch, note, vel, gate: gateSec });
    }
  }
  private releaseSynth(_ch: number, _note: number, _time?: number): void {
    // Poly-synth handles gate timing internally — skip external noteOff
    if (this.polySynth) return;
  }
}
