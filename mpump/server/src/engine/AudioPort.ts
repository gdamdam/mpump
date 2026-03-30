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
  midiToFreq, perfToCtx,
  buildKit, DrumKit, DRUM_SYNTHS, applyFilter, SynthFn,
  SynthVoice, DRUM_PAN, envValueAt,
  makeDistortionCurve, makeBitcrushCurve, makeSoftClipCurve, generateImpulseResponse,
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
  /** Per-note drum voice params (tune, decay, level). */
  private drumVoiceParams: Map<number, DrumVoiceParams> = new Map();
  /** Custom user samples (overrides synthesized kit when present). */
  private customSamples: Map<number, AudioBuffer> = new Map();
  /** Cached reverb impulse response. */
  private reverbIRCache: { decay: number; buffer: AudioBuffer } | null = null;
  /** Muted drum voice notes. */
  private mutedDrumNotes: Set<number> = new Set();
  /** Current BPM for tempo-synced LFO. */
  private bpm = 120;
  /** Sidechain duck: duck non-drum channels on kick hits. */
  private sidechainDuck = false;
  private duckDepth = 0.85; // 0-1, how much to reduce (0.85 = duck to 15%)
  private duckRelease = 0.04; // seconds, recovery time constant
  /** Metronome: click on every beat. */
  private metronomeOn = false;
  /** CV output for DC-coupled interfaces. */
  private cv: CVOutput;
  /** Master output node for VU metering. */
  private master: GainNode;
  private analyser: AnalyserNode;
  /** Effects state */
  private fx: EffectParams = JSON.parse(JSON.stringify(DEFAULT_EFFECTS));
  /** Configurable effect chain order. */
  private effectOrder: EffectName[] = ["compressor", "highpass", "distortion", "bitcrusher", "chorus", "phaser", "delay", "reverb"];
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

  constructor() {
    // Safari uses webkitAudioContext
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    this.kit = buildKit(this.ctx);

    // Master → [effects chain] → fxOutput → limiter → analyser → destination
    this.master = this.ctx.createGain();
    this.fxOutput = this.ctx.createGain();

    // Soft clipper: tanh curve for gentle peak rounding (hybrid mode only)
    this.softClip = this.ctx.createWaveShaper();
    this.softClip.oversample = "none";

    // Limiter: catches peaks before they clip
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -1;
    this.limiter.ratio.value = 4;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.25;
    this.limiter.knee.value = 10;

    // Bypass gain (unused, kept for compatibility)
    this.limiterBypass = this.ctx.createGain();

    // Drive gain — input gain before limiter (0dB default)
    this.driveGain = this.ctx.createGain();
    this.driveGain.gain.value = 1;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.connect(this.ctx.destination);


    // Default mode is "limiter": fxOutput → limiter → analyser
    this.rebuildAntiClipChain();

    // Initial chain: master → fxOutput (no effects)
    this.master.connect(this.fxOutput);

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

    // (B) Periodic heartbeat: resume suspended AudioContext every 1s
    this.heartbeatId = window.setInterval(() => {
      if (needsResume()) {
        this.ctx.resume().catch(() => {});
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

  // ── Effects ───────────────────────────────────────────────────────────

  /** Update an effect's parameters and rebuild the chain. */
  setEffect<K extends EffectName>(name: K, params: Partial<EffectParams[K]>): void {
    const prev = this.fx[name];
    this.fx[name] = { ...prev, ...params } as EffectParams[K];
    // Rebuild chain on any parameter change so audio nodes reflect new values
    this.rebuildFxChain();
  }

  /** Get current effects state. */
  getEffects(): EffectParams {
    return this.fx;
  }

  /** Set the effect chain order and rebuild. */
  setEffectOrder(order: EffectName[]): void {
    this.effectOrder = order;
    this.rebuildFxChain();
  }

  getEffectOrder(): EffectName[] {
    return this.effectOrder;
  }

  /** Rebuild the audio effects chain based on current fx state and effectOrder. */
  private rebuildFxChain(): void {
    // Disconnect old chain
    this.master.disconnect();
    for (const n of this.fxNodes) {
      try { n.disconnect(); } catch { /* already disconnected */ }
    }
    for (const lfo of this.fxLFOs) {
      try { lfo.stop(); lfo.disconnect(); } catch { /* already stopped */ }
    }
    this.fxNodes = [];
    this.fxLFOs = [];

    // Build chain: master → [active effects in configurable order] → fxOutput
    let prev: AudioNode = this.master;

    for (const name of this.effectOrder) {
      if (!this.fx[name].on) continue;
      prev = this.buildEffect(name, prev);
    }

    // Connect final node to fxOutput
    prev.connect(this.fxOutput);
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
        // Pre-gain drives signal harder into quantization for more audible crush
        const preGain = this.ctx.createGain();
        preGain.gain.value = 1 + (16 - this.fx.bitcrusher.bits) * 0.15; // lower bits = more boost
        const ws = this.ctx.createWaveShaper();
        ws.curve = makeBitcrushCurve(this.fx.bitcrusher.bits);
        const postGain = this.ctx.createGain();
        postGain.gain.value = 1 / preGain.gain.value; // compensate volume
        prev.connect(preGain);
        preGain.connect(ws);
        ws.connect(postGain);
        this.fxNodes.push(preGain, ws, postGain);
        return postGain;
      }
      case "chorus": {
        // Stereo chorus: two delay lines with quadrature LFOs panned L/R
        const { rate, depth, mix } = this.fx.chorus;
        const dry = this.ctx.createGain(); dry.gain.value = 1 - mix;
        const wetL = this.ctx.createGain(); wetL.gain.value = mix;
        const wetR = this.ctx.createGain(); wetR.gain.value = mix;
        const delayL = this.ctx.createDelay(0.05); delayL.delayTime.value = 0.012;
        const delayR = this.ctx.createDelay(0.05); delayR.delayTime.value = 0.008;
        // LFO L (sine)
        const lfoL = this.ctx.createOscillator(); lfoL.type = "sine"; lfoL.frequency.value = rate;
        const lfoGainL = this.ctx.createGain(); lfoGainL.gain.value = depth;
        lfoL.connect(lfoGainL); lfoGainL.connect(delayL.delayTime); lfoL.start();
        // LFO R (cosine via phase offset — use a second osc at 90° offset delay)
        const lfoR = this.ctx.createOscillator(); lfoR.type = "sine"; lfoR.frequency.value = rate;
        const lfoGainR = this.ctx.createGain(); lfoGainR.gain.value = depth;
        // Start lfoR with quarter-period offset for quadrature
        const quarterPeriod = 1 / (4 * Math.max(rate, 0.01));
        lfoR.connect(lfoGainR); lfoGainR.connect(delayR.delayTime);
        lfoR.start(this.ctx.currentTime + quarterPeriod);
        this.fxLFOs.push(lfoL, lfoR);
        // Pan wet signals L/R
        const panL = this.ctx.createStereoPanner(); panL.pan.value = -0.8;
        const panR = this.ctx.createStereoPanner(); panR.pan.value = 0.8;
        prev.connect(dry);
        prev.connect(delayL); delayL.connect(wetL); wetL.connect(panL);
        prev.connect(delayR); delayR.connect(wetR); wetR.connect(panR);
        const merge = this.ctx.createGain();
        dry.connect(merge); panL.connect(merge); panR.connect(merge);
        this.fxNodes.push(dry, wetL, wetR, delayL, delayR, lfoGainL, lfoGainR, panL, panR, merge);
        return merge;
      }
      case "phaser": {
        const { rate, depth } = this.fx.phaser;
        const lfo = this.ctx.createOscillator(); lfo.type = "sine"; lfo.frequency.value = rate; lfo.start();
        this.fxLFOs.push(lfo);
        const dry = this.ctx.createGain(); dry.gain.value = 0.5;
        const wet = this.ctx.createGain(); wet.gain.value = 0.5;
        prev.connect(dry);
        let apPrev: AudioNode = prev;
        for (let i = 0; i < 4; i++) {
          const ap = this.ctx.createBiquadFilter(); ap.type = "allpass"; ap.frequency.value = 1000 + i * 500;
          const lg = this.ctx.createGain(); lg.gain.value = depth; lfo.connect(lg); lg.connect(ap.frequency);
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
        const { decay, mix } = this.fx.reverb;
        const dry = this.ctx.createGain(); dry.gain.value = 1 - mix * 0.5; // keep dry louder
        const wet = this.ctx.createGain(); wet.gain.value = mix * 1.5; // boost wet to cut through
        // Cache impulse response — only regenerate when decay changes
        if (!this.reverbIRCache || this.reverbIRCache.decay !== decay) {
          this.reverbIRCache = { decay, buffer: generateImpulseResponse(this.ctx, decay) };
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
    }
  }

  /** Update synth params for a specific channel. Also updates active voices in real-time. */
  setSynthParams(ch: number, params: SynthParams): void {
    this.channelParams.set(ch, params);
    // Update filter on all active voices for this channel
    const now = this.ctx.currentTime;
    for (const [key, voice] of this.voices) {
      if (key.startsWith(`${ch}:`) && voice.filter) {
        voice.filter.frequency.cancelScheduledValues(now);
        voice.filter.frequency.setTargetAtTime(Math.min(params.cutoff, 12000), now, 0.02);
        voice.filter.Q.cancelScheduledValues(now);
        voice.filter.Q.setTargetAtTime(params.resonance, now, 0.02);
        if (params.filterType) voice.filter.type = params.filterType;
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
      if (updated.filterCutoff !== undefined && updated.filterCutoff < 1) {
        applyFilter(buf.getChannelData(0), updated.filterCutoff, this.ctx.sampleRate);
      }
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
    if (this.fx.delay.on && this.fx.delay.sync) this.rebuildFxChain();
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

      // Route: bus → panner → master (+ analyser tap for VU)
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = 0;
      bus.connect(panner);
      panner.connect(this.master);
      this.channelPanners.set(ch, panner);

      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = 4096;
      bus.connect(analyser);
      this.channelAnalysers.set(ch, analyser);
      this.channelBuses.set(ch, bus);
    }
    return bus;
  }

  /** Set per-channel volume (0–1). */
  setChannelVolume(ch: number, v: number): void {
    const vol = Math.max(0, Math.min(1, v));
    this.channelVolumes.set(ch, vol);
    const bus = this.channelBuses.get(ch);
    if (bus) {
      bus.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.015);
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
    const bus = this.channelBuses.get(ch);
    const panner = this.channelPanners.get(ch);
    if (!bus || !panner) return;

    // Disconnect only the bus→panner link (preserve bus→analyser)
    try { bus.disconnect(panner); } catch { /* not connected */ }

    if (mono) {
      let monoNode = this.channelMonoNodes.get(ch);
      if (!monoNode) {
        monoNode = this.ctx.createGain();
        monoNode.channelCount = 1;
        monoNode.channelCountMode = "explicit";
        monoNode.channelInterpretation = "speakers";
        this.channelMonoNodes.set(ch, monoNode);
      }
      // bus → monoNode → panner → master
      bus.connect(monoNode);
      monoNode.connect(panner);
    } else {
      const monoNode = this.channelMonoNodes.get(ch);
      if (monoNode) { try { monoNode.disconnect(); } catch { /* */ } }
      // bus → panner → master
      bus.connect(panner);
    }
  }

  getChannelMono(ch: number): boolean { return this.channelMonoState.get(ch) ?? false; }

  /** Set stereo pan for a channel (-1 left, 0 center, +1 right). */
  setChannelPan(ch: number, pan: number): void {
    const panner = this.channelPanners.get(ch);
    if (panner) panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), this.ctx.currentTime, 0.02);
  }

  /** Get the AnalyserNode for a specific channel (for per-channel VU metering). */
  getChannelAnalyser(ch: number): AnalyserNode | null {
    return this.channelAnalysers.get(ch) ?? null;
  }

  /** Set anti-clip mode: "limiter", "hybrid", or "off". Reconnects audio graph. */
  /** Set drive gain in dB (-6 to +12). */
  setDrive(db: number): void {
    const linear = Math.pow(10, db / 20);
    this.driveGain.gain.setTargetAtTime(linear, this.ctx.currentTime, 0.02);
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
    try { this.driveGain.disconnect(); } catch { /* */ }
    try { this.softClip.disconnect(); } catch { /* */ }
    try { this.limiter.disconnect(); } catch { /* */ }

    if (this.antiClipMode === "off") {
      // Clean: fxOutput → drive → analyser → destination
      this.fxOutput.connect(this.driveGain);
      this.driveGain.connect(this.analyser);
    } else if (this.antiClipMode === "limiter") {
      // Limiter: fxOutput → drive → limiter → analyser → destination
      this.fxOutput.connect(this.driveGain);
      this.driveGain.connect(this.limiter);
      this.limiter.connect(this.analyser);
    } else {
      // Hybrid: fxOutput → drive → softClip → limiter → analyser → destination
      this.softClip.curve = makeSoftClipCurve(true);
      this.softClip.oversample = "2x";
      this.fxOutput.connect(this.driveGain);
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
    this.master.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), this.ctx.currentTime, 0.015);
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

    const targetGain = (vel / 127) * level * 1.2;
    const gain = this.ctx.createGain();
    const drumWhen = perfToCtx(this.ctx, time);
    // Anchor gain at 0 slightly before start, then ramp
    gain.gain.value = 0;
    gain.gain.setValueAtTime(0, Math.max(0, drumWhen - 0.002));
    gain.gain.setValueAtTime(0, drumWhen);
    gain.gain.linearRampToValueAtTime(targetGain, drumWhen + 0.002);

    // Stereo drum placement (user pan overrides default)
    const panVal = vp?.pan ?? DRUM_PAN[note] ?? 0;
    const pan = this.ctx.createStereoPanner();
    pan.pan.value = panVal;

    src.connect(gain);
    gain.connect(pan);
    pan.connect(this.getChannelBus(DRUM_CH));
    src.start(drumWhen);

    // (C) Disconnect drum nodes after buffer ends to free memory
    src.onended = () => { try { src.disconnect(); gain.disconnect(); pan.disconnect(); } catch { /* */ } };

    // Sidechain duck: dip non-drum channel gains on kick
    if (this.sidechainDuck && note === 36) {
      const when = perfToCtx(this.ctx, time);
      const duckTo = 1 - this.duckDepth; // depth 0.85 → duck to 0.15
      for (const [ch, bus] of this.channelBuses) {
        if (ch === DRUM_CH) continue;
        const vol = this.channelVolumes.get(ch) ?? 1;
        if (vol <= 0) continue; // skip muted channels
        bus.gain.cancelScheduledValues(when);
        bus.gain.setTargetAtTime(vol * duckTo, when, 0.003);
        bus.gain.setTargetAtTime(vol, when + 0.02, this.duckRelease);
      }
    }
  }

  // ── Synth playback ───────────────────────────────────────────────────

  private playSynth(ch: number, note: number, vel: number, time?: number): void {
    // DEBUG: uncomment next line to silence all synth — test if click is from drums
    // if (true) return;
    const key = `${ch}:${note}`;
    const p = this.getSynthParams(ch);

    // Release any existing voice on this note (retrigger)
    const prev = this.voices.get(key);
    if (prev) {
      // Gentle crossfade with cancelAndHoldAtTime to freeze at current value
      const now = this.ctx.currentTime;
      if (prev.gain.gain.cancelAndHoldAtTime) {
        prev.gain.gain.cancelAndHoldAtTime(now);
      } else {
        prev.gain.gain.cancelScheduledValues(now);
      }
      prev.gain.gain.setTargetAtTime(0, now, 0.008); // 8ms fade
      for (const o of prev.oscs) o.stop(now + 0.05);
      if (prev.subOsc) prev.subOsc.stop(now + 0.05);
      if (prev.lfo) prev.lfo.stop(now + 0.05);
      // Clean up on first osc end (no setTimeout — Safari-safe)
      if (prev.oscs[0]) prev.oscs[0].onended = () => this.disconnectVoice(prev);
    }

    const when = perfToCtx(this.ctx, time);
    const freq = midiToFreq(note);
    const amp = (vel / 127) * 0.3;

    // Enforce minimum attack/release to prevent clicks
    const atk = Math.max(0.008, p.attack);
    const dec = Math.max(0.01, p.decay);
    // Time constant for exponential attack (reaches ~95% in 3*tc)
    const atkTc = atk / 3;

    // Filter with envelope (bypass when filterOn is false)
    let filter: BiquadFilterNode | null = null;
    if (p.filterOn !== false) {
      filter = this.ctx.createBiquadFilter();
      filter.type = p.filterType;
      filter.Q.setValueAtTime(p.resonance, when);
      const cutoffBase = Math.min(p.cutoff, 12000);
      const envDepth = p.filterEnvDepth ?? 0;
      const cutoffPeak = Math.min(cutoffBase + envDepth * 8000, 18000);
      if (envDepth > 0) {
        // Filter envelope: start low, sweep up during attack, decay back
        filter.frequency.setValueAtTime(Math.max(cutoffBase * 0.5, 200), when);
        filter.frequency.setTargetAtTime(cutoffPeak, when, atkTc);
        filter.frequency.setTargetAtTime(
          Math.max(cutoffBase * p.sustain, 200), when + atk, dec / 3,
        );
      } else {
        // No envelope: sit at cutoff from the start (no sweep artifact)
        filter.frequency.setValueAtTime(cutoffBase, when);
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

    // ── Oscillator(s) — mono, stereo detune, or unison ──────────────
    const oscs: OscillatorNode[] = [];
    const panNodes: StereoPannerNode[] = [];
    const unisonCount = p.unison ?? 1;
    const unisonSpread = p.unisonSpread ?? 0;
    const filterInput = filter ?? gain; // connect oscs to filter if present, else gain

    if (unisonCount > 1 && unisonSpread > 0) {
      // Unison: N voices spread across stereo field
      // Softer normalization — base amp already compensates for stereo
      const voiceGain = 1 / Math.pow(unisonCount, 0.3);
      for (let v = 0; v < unisonCount; v++) {
        const t = unisonCount === 1 ? 0 : (v / (unisonCount - 1)) * 2 - 1; // -1 to +1
        const detuneCents = t * unisonSpread;
        const panVal = t * 0.8; // spread across 80% of stereo field

        const osc = this.ctx.createOscillator();
        osc.type = p.oscType;
        osc.frequency.setValueAtTime(freq, when);
        osc.detune.setValueAtTime(detuneCents + (p.detune ?? 0), when);

        const voiceAmp = this.ctx.createGain();
        voiceAmp.gain.value = voiceGain;

        const pan = this.ctx.createStereoPanner();
        pan.pan.value = panVal;

        osc.connect(voiceAmp);
        voiceAmp.connect(pan);
        pan.connect(filterInput);
        osc.start(when);
        oscs.push(osc);
        panNodes.push(pan);
      }
    } else if (p.detune && p.detune > 0) {
      // Stereo detune: 2 oscillators panned L/R
      const oscL = this.ctx.createOscillator();
      oscL.type = p.oscType;
      oscL.frequency.setValueAtTime(freq, when);
      oscL.detune.setValueAtTime(-p.detune / 2, when);

      const oscR = this.ctx.createOscillator();
      oscR.type = p.oscType;
      oscR.frequency.setValueAtTime(freq, when);
      oscR.detune.setValueAtTime(p.detune / 2, when);

      const panL = this.ctx.createStereoPanner();
      panL.pan.value = -0.7;
      const panR = this.ctx.createStereoPanner();
      panR.pan.value = 0.7;

      oscL.connect(panL);
      panL.connect(filterInput);
      oscR.connect(panR);
      panR.connect(filterInput);

      oscL.start(when);
      oscR.start(when);
      oscs.push(oscL, oscR);
      panNodes.push(panL, panR);
    } else {
      // Single mono oscillator
      const osc = this.ctx.createOscillator();
      osc.type = p.oscType;
      osc.frequency.setValueAtTime(freq, when);
      if (p.detune) osc.detune.setValueAtTime(p.detune, when);
      osc.connect(filterInput);
      osc.start(when);
      oscs.push(osc);
    }

    // Connect filter → gain → bus
    if (filter) {
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
        lfoToCutoff.connect(filter.frequency);
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

    this.voices.set(key, { oscs, panNodes, subOsc, subGain, gain, filter, lfo, lfoGains, env: { amp, atk, dec, sus: p.sustain, startTime: when } });
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
    for (const o of voice.oscs) o.stop(when + rel + 0.1);

    if (voice.subOsc && voice.subGain) {
      if (voice.subGain.gain.cancelAndHoldAtTime) {
        voice.subGain.gain.cancelAndHoldAtTime(when);
      } else {
        voice.subGain.gain.cancelScheduledValues(when);
      }
      voice.subGain.gain.setTargetAtTime(0, when, tc);
      voice.subOsc.stop(when + rel + 0.1);
    }

    if (voice.lfo) {
      voice.lfo.stop(when + rel + 0.03);
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
      voice.gain.gain.setTargetAtTime(0, now, fadeOut / 4);
      for (const o of voice.oscs) o.stop(now + fadeOut + 0.05);
      if (voice.subOsc && voice.subGain) {
        if (voice.subGain.gain.cancelAndHoldAtTime) {
          voice.subGain.gain.cancelAndHoldAtTime(now);
        } else {
          voice.subGain.gain.cancelScheduledValues(now);
        }
        voice.subGain.gain.setTargetAtTime(0, now, fadeOut / 4);
        voice.subOsc.stop(now + fadeOut + 0.05);
      }
      if (voice.lfo) {
        voice.lfo.stop(now + fadeOut + 0.03);
      }
      // Clean up when first osc ends (no setTimeout — Safari-safe)
      if (voice.oscs[0]) voice.oscs[0].onended = () => this.disconnectVoice(voice);
    } catch {
      // Voice may already be stopped
    }
  }
}
