/**
 * poly-synth.js — Zero-allocation polyphonic synthesizer AudioWorklet.
 *
 * Stage 3: Three filter models (digital biquad, Moog ladder, diode ladder),
 *          per-voice 4-pole state, unison (up to 7), PWM, filter drive,
 *          PolyBLEP saw/square/sine/tri, stereo spread, analog drift,
 *          ADSR + filter envelope, sub-osc.
 *
 * CRITICAL: No object allocation inside process(). Everything pre-allocated.
 */

const MAX_VOICES = 16;
const MAX_UNISON = 7;
const VXU = MAX_VOICES * MAX_UNISON;
const TWOPI = 2 * Math.PI;

// ── PolyBLEP ──
function polyblep(t, dt) {
  if (t < dt) { const r = t / dt; return r + r - r * r - 1; }
  if (t > 1 - dt) { const r = (t - 1) / dt; return r * r + r + r + 1; }
  return 0;
}

const OSC_SAW = 0, OSC_SQUARE = 1, OSC_SINE = 2, OSC_TRI = 3, OSC_PWM = 4;
const OSC_SYNC = 5, OSC_FM = 6, OSC_WAVETABLE = 7;
const FLT_DIGITAL = 0, FLT_MOOG = 1, FLT_DIODE = 2;
const FTYPE_LP = 0, FTYPE_HP = 1, FTYPE_BP = 2, FTYPE_NOTCH = 3;

function filterTypeFromString(s) {
  switch (s) {
    case "lowpass": return FTYPE_LP;
    case "highpass": return FTYPE_HP;
    case "bandpass": return FTYPE_BP;
    case "notch": return FTYPE_NOTCH;
    default: return FTYPE_LP;
  }
}

const WT_SIZE = 256; // wavetable frame size

function oscTypeFromString(s) {
  switch (s) {
    case "sawtooth": return OSC_SAW;
    case "square": return OSC_SQUARE;
    case "sine": return OSC_SINE;
    case "triangle": return OSC_TRI;
    case "pwm": return OSC_PWM;
    case "sync": return OSC_SYNC;
    case "fm": return OSC_FM;
    case "wavetable": return OSC_WAVETABLE;
    default: return OSC_SAW;
  }
}

// Generate wavetable data once (called in constructor, not process)
function generateWavetables() {
  const S = WT_SIZE;
  const tables = {};
  tables.basic = [
    Float32Array.from({ length: S }, (_, i) => Math.sin(2 * Math.PI * i / S)),
    Float32Array.from({ length: S }, (_, i) => { const p = i / S; return p < 0.5 ? 4 * p - 1 : 3 - 4 * p; }),
    Float32Array.from({ length: S }, (_, i) => 2 * i / S - 1),
    Float32Array.from({ length: S }, (_, i) => i < S / 2 ? 1 : -1),
  ];
  tables.vocal = Array.from({ length: 4 }, (_, f) => {
    const fm = [[800, 1200], [400, 2000], [600, 1600], [300, 2400]][f];
    return Float32Array.from({ length: S }, (_, i) => {
      const t = i / S;
      return Math.sin(2 * Math.PI * t) * 0.5 + Math.sin(2 * Math.PI * t * (fm[0] / 100)) * 0.3 + Math.sin(2 * Math.PI * t * (fm[1] / 100)) * 0.2;
    });
  });
  tables.metallic = Array.from({ length: 4 }, (_, f) => {
    const r = [1, 2.76, 5.04, 7.28 + f * 0.5];
    return Float32Array.from({ length: S }, (_, i) => {
      const t = i / S; let sum = 0;
      for (let h = 0; h < r.length; h++) sum += Math.sin(2 * Math.PI * t * r[h]) / (h + 1);
      return sum * 0.4;
    });
  });
  tables.pad = Array.from({ length: 4 }, (_, f) => {
    const nh = 8 + f * 4;
    return Float32Array.from({ length: S }, (_, i) => {
      const t = i / S; let sum = 0;
      for (let h = 1; h <= nh; h++) sum += Math.sin(2 * Math.PI * t * h) / (h * 0.7);
      return sum * 0.15;
    });
  });
  tables.organ = Array.from({ length: 4 }, (_, f) => {
    const draws = [[1,.8,0,.6,0,.3,0,.1,0],[1,0,.7,0,.5,0,.3,0,0],[.3,1,.5,.8,.3,.5,.2,.1,0],[1,.5,.3,.2,.1,.05,0,0,0]][f];
    return Float32Array.from({ length: S }, (_, i) => {
      const t = i / S; let sum = 0;
      for (let h = 0; h < draws.length; h++) if (draws[h] > 0) sum += Math.sin(2 * Math.PI * t * (h + 1)) * draws[h];
      return sum * 0.25;
    });
  });
  return tables;
}

function filterModelFromString(s) {
  switch (s) {
    case "mog": return FLT_MOOG;
    case "303": return FLT_DIODE;
    default: return FLT_DIGITAL;
  }
}

class PolySynthProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // ── Per-voice state ──
    this._active = new Uint8Array(MAX_VOICES);
    this._note = new Uint8Array(MAX_VOICES);
    this._channel = new Uint8Array(MAX_VOICES);
    this._freq = new Float64Array(MAX_VOICES);
    this._vel = new Float64Array(MAX_VOICES);
    this._subPhase = new Float64Array(MAX_VOICES);
    this._envStage = new Uint8Array(MAX_VOICES);
    this._envLevel = new Float64Array(MAX_VOICES);
    this._fltEnvLevel = new Float64Array(MAX_VOICES);
    this._age = new Uint32Array(MAX_VOICES);
    this._gateRemaining = new Float64Array(MAX_VOICES);
    this._lfoPhase = new Float64Array(MAX_VOICES); // per-voice LFO phase

    // Per-voice biquad filter state (digital mode)
    this._fltZ1 = new Float64Array(MAX_VOICES);
    this._fltZ2 = new Float64Array(MAX_VOICES);

    // Per-voice Moog/Diode ladder state: 4 stages × MAX_VOICES
    this._ladderY = new Float64Array(MAX_VOICES * 4); // delayed outputs
    // Per-voice 1-pole lowpass for side channel (tames unfiltered stereo highs)
    this._sideFilt = new Float64Array(MAX_VOICES);

    // ── Per-unison-voice state (flat: voice * MAX_UNISON + u) ──
    this._uPhase = new Float64Array(VXU);        // main osc / master (sync) / carrier (FM) phase
    this._uPhase2 = new Float64Array(VXU);       // slave (sync) / modulator (FM) phase
    this._uDriftPhase = new Float64Array(VXU);
    this._uDriftRate = new Float64Array(VXU);
    this._uPwmPhase = new Float64Array(VXU);

    // ── Per-channel synth parameters (index by MIDI channel, max 16) ──
    const MAX_CH = 16;
    this._chOscType = new Uint8Array(MAX_CH).fill(OSC_SAW);
    this._chFilterModel = new Uint8Array(MAX_CH).fill(FLT_DIGITAL);
    this._chFilterType = new Uint8Array(MAX_CH).fill(FTYPE_LP);
    this._chAttack = new Float64Array(MAX_CH).fill(0.005);
    this._chDecay = new Float64Array(MAX_CH).fill(0.15);
    this._chSustain = new Float64Array(MAX_CH).fill(0.6);
    this._chRelease = new Float64Array(MAX_CH).fill(0.06);
    this._chCutoff = new Float64Array(MAX_CH).fill(4000);
    this._chResonance = new Float64Array(MAX_CH).fill(4);
    this._chFilterOn = new Uint8Array(MAX_CH).fill(1);
    this._chFilterEnvDepth = new Float64Array(MAX_CH).fill(0);
    this._chFilterDecay = new Float64Array(MAX_CH); // 0 = use amp decay
    this._chFilterDrive = new Float64Array(MAX_CH).fill(0);
    this._chSubOsc = new Uint8Array(MAX_CH).fill(1);
    this._chSubLevel = new Float64Array(MAX_CH).fill(0.5);
    this._chDetune = new Float64Array(MAX_CH).fill(0);
    this._chUnison = new Uint8Array(MAX_CH).fill(1);
    this._chUnisonSpread = new Float64Array(MAX_CH).fill(25);
    this._chSyncRatio = new Float64Array(MAX_CH).fill(2);
    this._chFmRatio = new Float64Array(MAX_CH).fill(2);
    this._chFmIndex = new Float64Array(MAX_CH).fill(5);
    this._chWtPos = new Float64Array(MAX_CH).fill(0.5);
    // Wavetable name per channel (string, not typed array)
    this._chWtName = new Array(MAX_CH).fill("basic");
    this._chVolume = new Float64Array(MAX_CH).fill(0.7);
    this._chPan = new Float64Array(MAX_CH); // -1 to +1
    this._chMuted = new Uint8Array(MAX_CH); // 0=unmuted, 1=muted
    // LFO params per channel
    this._chLfoOn = new Uint8Array(MAX_CH);
    this._chLfoRate = new Float64Array(MAX_CH).fill(2); // Hz (free mode)
    this._chLfoDepth = new Float64Array(MAX_CH).fill(0.5);
    this._chLfoShape = new Uint8Array(MAX_CH); // 0=sine, 1=square, 2=tri, 3=saw
    this._chLfoTarget = new Uint8Array(MAX_CH); // 0=cutoff, 1=pitch, 2=both
    this._chLfoSync = new Uint8Array(MAX_CH); // 0=free, 1=tempo-synced
    this._chLfoSyncRate = new Float64Array(MAX_CH).fill(2); // synced Hz (computed from BPM)
    this._bpm = 120;
    this._gateFraction = 0.8;
    this._masterGain = 0.2;
    this._driftEnabled = true;

    // Wavetable data (generated once)
    this._wavetables = generateWavetables();

    // Biquad coefficients (digital mode)
    this._fltB0 = 0; this._fltB1 = 0; this._fltB2 = 0;
    this._fltA1 = 0; this._fltA2 = 0;

    this._rngState = 12345;
    this._sr = 44100;
    this._invSr = 1 / 44100;
    this._srReady = false;

    this.port.onmessage = (e) => this._handleMessage(e.data);
  }

  _rng() {
    this._rngState = (this._rngState * 1664525 + 1013904223) & 0x7fffffff;
    return this._rngState / 0x7fffffff;
  }

  _handleMessage(msg) {
    switch (msg.type) {
      case "noteOn": this._noteOn(msg.channel, msg.note, msg.vel, msg.gate || 0); break;
      case "noteOff": this._noteOff(msg.channel, msg.note); break;
      case "params": this._setParams(msg); break;
      case "volume": if (msg.channel !== undefined) this._chVolume[msg.channel] = msg.volume; break;
      case "pan": if (msg.channel !== undefined) this._chPan[msg.channel] = msg.pan; break;
      case "mute": if (msg.channel !== undefined) this._chMuted[msg.channel] = msg.muted ? 1 : 0; break;
      case "bpm": this._bpm = msg.bpm; break;
      case "gate": this._gateFraction = msg.fraction; break;
      case "allNotesOff": this._allNotesOff(msg.channel); break;
    }
  }

  _noteOn(channel, note, vel, gateSec) {
    let idx = -1;
    for (let i = 0; i < MAX_VOICES; i++) {
      if (this._active[i] && this._note[i] === note && this._channel[i] === channel) { idx = i; break; }
    }
    if (idx === -1) {
      for (let i = 0; i < MAX_VOICES; i++) { if (!this._active[i]) { idx = i; break; } }
    }
    if (idx === -1) {
      let best = 0, bestRel = -1, bestAny = -1;
      for (let i = 0; i < MAX_VOICES; i++) {
        if (this._active[i] === 2 && this._age[i] >= best) { best = this._age[i]; bestRel = i; }
      }
      if (bestRel >= 0) { idx = bestRel; }
      else {
        best = 0;
        for (let i = 0; i < MAX_VOICES; i++) { if (this._age[i] >= best) { best = this._age[i]; bestAny = i; } }
        idx = bestAny;
      }
    }
    if (idx === -1) return;

    // Must be captured before overwriting note/channel below.
    // Same-note retrigger: keep filter state (ladder stages are tracking correctly).
    // Different note or stolen voice: reset filter state — stale state from old freq causes a click.
    const isSameNote = this._active[idx] && this._note[idx] === note && this._channel[idx] === channel;

    const freq = 440 * Math.pow(2, (note - 69) / 12);
    this._active[idx] = 1;
    this._note[idx] = note;
    this._channel[idx] = channel;
    this._freq[idx] = freq;
    this._vel[idx] = vel / 127;
    this._envStage[idx] = 0;
    this._fltEnvLevel[idx] = 0.3 + 0.7 * (vel / 127); // velocity-scaled: louder notes = brighter attack
    this._age[idx] = 0;
    this._gateRemaining[idx] = gateSec > 0 ? gateSec * sampleRate : 0;

    // For new/stolen voices: reset filter state AND amplitude to zero.
    // The envelope is applied post-filter, so a non-zero envLevel with zeroed filter
    // state produces a click on the first sample. Zeroing both ensures a clean attack.
    // Same-note retriggers keep both — filter state matches current oscillator, no discontinuity.
    const lb = idx * 4;
    if (this._envLevel[idx] < 0.01 || !isSameNote) {
      this._ladderY[lb] = 0; this._ladderY[lb + 1] = 0;
      this._ladderY[lb + 2] = 0; this._ladderY[lb + 3] = 0;
      this._fltZ1[idx] = 0; this._fltZ2[idx] = 0;
      this._sideFilt[idx] = 0;
      this._envLevel[idx] = 0;
    }

    const base = idx * MAX_UNISON;
    for (let u = 0; u < MAX_UNISON; u++) {
      this._uDriftRate[base + u] = 0.15 + this._rng() * 0.2;
      this._uDriftPhase[base + u] = this._rng();
      this._uPwmPhase[base + u] = this._rng();
    }
  }

  _noteOff(channel, note) {
    for (let i = 0; i < MAX_VOICES; i++) {
      if (this._active[i] === 1 && this._note[i] === note && this._channel[i] === channel) {
        this._active[i] = 2; this._envStage[i] = 3; break;
      }
    }
  }

  _allNotesOff(channel) {
    for (let i = 0; i < MAX_VOICES; i++) {
      if (this._active[i] && (channel === undefined || this._channel[i] === channel)) {
        this._active[i] = 2; this._envStage[i] = 3;
      }
    }
  }

  _setParams(msg) {
    // Apply to specific channel, or all channels if not specified
    const chStart = msg.channel !== undefined ? msg.channel : 0;
    const chEnd = msg.channel !== undefined ? msg.channel + 1 : 16;
    for (let c = chStart; c < chEnd; c++) {
      if (msg.oscType !== undefined) this._chOscType[c] = oscTypeFromString(msg.oscType);
      if (msg.filterModel !== undefined) this._chFilterModel[c] = filterModelFromString(msg.filterModel);
      if (msg.filterType !== undefined) this._chFilterType[c] = filterTypeFromString(msg.filterType);
      if (msg.attack !== undefined) this._chAttack[c] = Math.max(0.001, msg.attack);
      if (msg.decay !== undefined) this._chDecay[c] = Math.max(0.01, msg.decay);
      if (msg.sustain !== undefined) this._chSustain[c] = Math.max(0.001, Math.min(1, msg.sustain));
      if (msg.release !== undefined) this._chRelease[c] = Math.max(0.01, msg.release);
      if (msg.cutoff !== undefined) this._chCutoff[c] = msg.cutoff;
      if (msg.resonance !== undefined) this._chResonance[c] = msg.resonance;
      if (msg.filterOn !== undefined) this._chFilterOn[c] = msg.filterOn ? 1 : 0;
      if (msg.filterEnvDepth !== undefined) this._chFilterEnvDepth[c] = msg.filterEnvDepth;
      if (msg.filterDecay !== undefined) this._chFilterDecay[c] = Math.max(0, msg.filterDecay);
      if (msg.filterDrive !== undefined) this._chFilterDrive[c] = msg.filterDrive;
      if (msg.subOsc !== undefined) this._chSubOsc[c] = msg.subOsc ? 1 : 0;
      if (msg.subLevel !== undefined) this._chSubLevel[c] = msg.subLevel;
      if (msg.detune !== undefined) this._chDetune[c] = msg.detune;
      if (msg.unison !== undefined) this._chUnison[c] = Math.max(1, Math.min(MAX_UNISON, msg.unison));
      if (msg.unisonSpread !== undefined) this._chUnisonSpread[c] = msg.unisonSpread;
      if (msg.syncRatio !== undefined) this._chSyncRatio[c] = msg.syncRatio;
      if (msg.fmRatio !== undefined) this._chFmRatio[c] = msg.fmRatio;
      if (msg.fmIndex !== undefined) this._chFmIndex[c] = msg.fmIndex;
      if (msg.wavetablePos !== undefined) this._chWtPos[c] = msg.wavetablePos;
      if (msg.wavetable !== undefined && this._wavetables[msg.wavetable]) this._chWtName[c] = msg.wavetable;
      if (msg.lfoOn !== undefined) this._chLfoOn[c] = msg.lfoOn ? 1 : 0;
      if (msg.lfoRate !== undefined) this._chLfoRate[c] = msg.lfoRate;
      if (msg.lfoDepth !== undefined) this._chLfoDepth[c] = msg.lfoDepth;
      if (msg.lfoShape !== undefined) {
        const shapes = { sine: 0, square: 1, triangle: 2, sawtooth: 3 };
        this._chLfoShape[c] = shapes[msg.lfoShape] ?? 0;
      }
      if (msg.lfoTarget !== undefined) {
        const targets = { cutoff: 0, pitch: 1, both: 2 };
        this._chLfoTarget[c] = targets[msg.lfoTarget] ?? 0;
      }
      if (msg.lfoSync !== undefined) this._chLfoSync[c] = msg.lfoSync ? 1 : 0;
      if (msg.lfoSyncRate !== undefined) this._chLfoSyncRate[c] = msg.lfoSyncRate;
    }
    if (msg.masterGain !== undefined) this._masterGain = msg.masterGain;
  }

  // ── Biquad coefficients (RBJ cookbook) ──
  _computeBiquad(cutoffHz, Q, type) {
    const w0 = TWOPI * Math.min(cutoffHz, this._sr * 0.49) * this._invSr;
    const sinW0 = Math.sin(w0);
    const cosW0 = Math.cos(w0);
    const alpha = sinW0 / (2 * Math.max(0.5, Q));
    const invA0 = 1 / (1 + alpha);
    switch (type) {
      case FTYPE_HP:
        this._fltB0 = ((1 + cosW0) * 0.5) * invA0;
        this._fltB1 = -(1 + cosW0) * invA0;
        this._fltB2 = this._fltB0;
        break;
      case FTYPE_BP:
        this._fltB0 = alpha * invA0;
        this._fltB1 = 0;
        this._fltB2 = -alpha * invA0;
        break;
      case FTYPE_NOTCH:
        this._fltB0 = invA0;
        this._fltB1 = (-2 * cosW0) * invA0;
        this._fltB2 = invA0;
        break;
      default: // FTYPE_LP
        this._fltB0 = ((1 - cosW0) * 0.5) * invA0;
        this._fltB1 = (1 - cosW0) * invA0;
        this._fltB2 = this._fltB0;
    }
    this._fltA1 = (-2 * cosW0) * invA0;
    this._fltA2 = (1 - alpha) * invA0;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || !output[0]) return true;
    const outL = output[0];
    const outR = output.length > 1 ? output[1] : outL;
    const N = outL.length;
    const isStereo = outR !== outL;

    if (!this._srReady) {
      this._sr = sampleRate; this._invSr = 1 / sampleRate;
      this._srReady = true; this._filterDirty = true;
    }

    for (let s = 0; s < N; s++) { outL[s] = 0; if (isStereo) outR[s] = 0; }

    const invSr = this._invSr;
    const sr = this._sr;
    const masterGain = this._masterGain;
    const driftEnabled = this._driftEnabled;

    for (let v = 0; v < MAX_VOICES; v++) {
      if (!this._active[v]) continue;
      this._age[v]++;

      const ch = this._channel[v];
      // Skip muted channels
      if (this._chMuted[ch]) continue;

      const freq = this._freq[v];
      const vel = this._vel[v];

      // Read per-channel params
      const oscType = this._chOscType[ch];
      const filterModel = this._chFilterModel[ch];
      const filterType = this._chFilterType[ch];
      const attack = this._chAttack[ch];
      const decay = this._chDecay[ch];
      const susLevel = this._chSustain[ch];
      const release = this._chRelease[ch];
      const baseCutoff = this._chCutoff[ch];
      const baseQ = this._chResonance[ch];
      const filterOn = this._chFilterOn[ch];
      const fltEnvDepth = this._chFilterEnvDepth[ch];
      const filterDrive = this._chFilterDrive[ch];
      const subOn = this._chSubOsc[ch];
      const subLevel = this._chSubLevel[ch];
      const detuneCents = this._chDetune[ch];
      const unisonCount = this._chUnison[ch];
      const unisonSpread = this._chUnisonSpread[ch];
      const syncRatio = this._chSyncRatio[ch];
      const fmRatio = this._chFmRatio[ch];
      const fmIndex = this._chFmIndex[ch];
      const wtPos = this._chWtPos[ch];
      const wtFrames = this._wavetables[this._chWtName[ch]] || null;

      // LFO params
      const lfoOn = this._chLfoOn[ch];
      const lfoDepth = this._chLfoDepth[ch];
      const lfoShape = this._chLfoShape[ch];
      const lfoTarget = this._chLfoTarget[ch];
      const lfoRate = this._chLfoSync[ch] ? this._chLfoSyncRate[ch] : this._chLfoRate[ch];
      const lfoDt = lfoRate * invSr;
      // Channel pan
      const chPan = this._chPan[ch];

      const atkCoeff = 1 - Math.exp(-1 / (attack * sr));
      const decCoeff = 1 - Math.exp(-1 / (decay * sr));
      const filterDecayTime = this._chFilterDecay[ch];
      const fltDecCoeff = filterDecayTime > 0 ? 1 - Math.exp(-1 / (filterDecayTime * sr)) : decCoeff;
      const relCoeff = 1 - Math.exp(-1 / (release * sr));
      const chVol = this._chVolume[ch];
      const envTarget = vel * masterGain * chVol;
      const voiceGain = 1 / Math.pow(unisonCount, 0.3);
      const ladderRes = Math.min(4, 4 * Math.pow(Math.max(0, baseQ) / 20, 0.7));
      const driveGain = 1 + filterDrive * 7;
      const driveComp = 1 / (1 + filterDrive * 3);
      const driftAmt = driftEnabled ? (freq < 200 ? 0.002 : 0.005) : 0;
      const uBase = v * MAX_UNISON;
      const lb = v * 4;

      let envLevel = this._envLevel[v];
      let envStage = this._envStage[v];
      let fltZ1 = this._fltZ1[v];
      let fltZ2 = this._fltZ2[v];
      let ly0 = this._ladderY[lb], ly1 = this._ladderY[lb + 1];
      let ly2 = this._ladderY[lb + 2], ly3 = this._ladderY[lb + 3];
      let fltEnvLevel = this._fltEnvLevel[v];
      let sideFilt = this._sideFilt[v];
      let subPhase = this._subPhase[v];
      let gateRemaining = this._gateRemaining[v];
      let lfoPhase = this._lfoPhase[v];

      // Gate auto-release
      if (gateRemaining > 0 && envStage < 3) {
        gateRemaining -= N;
        if (gateRemaining <= 0) { gateRemaining = 0; this._active[v] = 2; envStage = 3; }
      }

      // LFO cutoff modulation flag
      const lfoCutoff = lfoOn && (lfoTarget === 0 || lfoTarget === 2);
      // Pre-compute biquad if no per-sample cutoff modulation needed
      if (filterOn && filterModel === FLT_DIGITAL && !lfoCutoff && fltEnvDepth <= 0) {
        this._computeBiquad(baseCutoff, baseQ, filterType);
      }
      let b0 = this._fltB0, b1 = this._fltB1, b2 = this._fltB2;
      let a1 = this._fltA1, a2 = this._fltA2;

      for (let s = 0; s < N; s++) {
        // ── Envelope ──
        switch (envStage) {
          case 0:
            envLevel += (envTarget - envLevel) * atkCoeff;
            if (envLevel >= envTarget * 0.99) { envLevel = envTarget; envStage = 1; }
            break;
          case 1:
            envLevel += (envTarget * susLevel - envLevel) * decCoeff;
            if (envLevel <= envTarget * susLevel * 1.01) envStage = 2;
            break;
          case 2:
            envLevel = envTarget * susLevel;
            break;
          case 3:
            envLevel *= (1 - relCoeff);
            if (envLevel < 0.0001) { envLevel = 0; this._active[v] = 0; }
            break;
        }

        if (fltEnvDepth > 0) {
          fltEnvLevel *= (1 - fltDecCoeff);
          if (fltEnvLevel < 1e-8) fltEnvLevel = 0;
        }

        // ── LFO ──
        let lfoVal = 0;
        if (lfoOn && lfoDepth > 0) {
          switch (lfoShape) {
            case 0: lfoVal = Math.sin(TWOPI * lfoPhase); break; // sine
            case 1: lfoVal = lfoPhase < 0.5 ? 1 : -1; break; // square
            case 2: lfoVal = 4 * Math.abs(lfoPhase - 0.5) - 1; break; // triangle
            case 3: lfoVal = 2 * lfoPhase - 1; break; // sawtooth
          }
          lfoVal *= lfoDepth;
          lfoPhase += lfoDt;
          if (lfoPhase >= 1) lfoPhase -= 1;
        }

        // ── Sum unison voices ──
        let mixL = 0, mixR = 0;
        for (let u = 0; u < unisonCount; u++) {
          const ui = uBase + u;
          let uDetune, pan;
          if (unisonCount === 1) { uDetune = detuneCents; pan = 0; }
          else {
            const t = (u / (unisonCount - 1)) * 2 - 1;
            uDetune = t * unisonSpread + detuneCents;
            pan = t * 0.8;
          }
          const detuneRatio = Math.pow(2, uDetune / 1200);
          const drift = driftAmt > 0 ? Math.sin(TWOPI * this._uDriftPhase[ui]) * driftAmt : 0;
          // LFO pitch modulation (±6% at full depth)
          const lfoPitch = (lfoOn && (lfoTarget === 1 || lfoTarget === 2)) ? lfoVal * 0.06 : 0;
          const f = freq * (1 + drift + lfoPitch) * detuneRatio;
          const dt = f * invSr;
          let phase = this._uPhase[ui];
          let phase2 = this._uPhase2[ui];
          let osc;

          switch (oscType) {
            case OSC_SAW:
              osc = 2 * phase - 1 - polyblep(phase, dt);
              this._uPhase[ui] = (phase + dt) % 1;
              break;
            case OSC_SQUARE:
              osc = phase < 0.5 ? 1 : -1;
              osc += polyblep(phase, dt) - polyblep((phase + 0.5) % 1, dt);
              this._uPhase[ui] = (phase + dt) % 1;
              break;
            case OSC_SINE:
              osc = Math.sin(TWOPI * phase);
              this._uPhase[ui] = (phase + dt) % 1;
              break;
            case OSC_TRI:
              osc = 4 * Math.abs(phase - 0.5) - 1;
              this._uPhase[ui] = (phase + dt) % 1;
              break;
            case OSC_PWM: {
              const pwmPh = this._uPwmPhase[ui];
              const pw = 0.5 + 0.4 * (2 * Math.abs(2 * pwmPh - 1) - 1);
              const saw1 = 2 * phase - 1 - polyblep(phase, dt);
              const saw2Ph = (phase + pw) % 1;
              osc = (saw1 - (2 * saw2Ph - 1 - polyblep(saw2Ph, dt))) * 0.5;
              this._uPwmPhase[ui] = (pwmPh + (0.4 + this._uDriftRate[ui] * 0.8) * invSr) % 1;
              this._uPhase[ui] = (phase + dt) % 1;
              break;
            }
            case OSC_SYNC: {
              // Hard sync: master resets slave phase each cycle
              const slaveInc = dt * syncRatio;
              phase += dt;       // master
              phase2 += slaveInc; // slave
              if (phase >= 1) { phase -= 1; phase2 = 0; } // sync reset
              const sp = phase2 % 1;
              osc = 2 * sp - 1; // slave saw (no PolyBLEP — sync discontinuity IS the sound)
              this._uPhase[ui] = phase;
              this._uPhase2[ui] = phase2;
              break;
            }
            case OSC_FM: {
              // 2-operator FM: modulator phase-modulates carrier
              phase2 += f * fmRatio * invSr; // modulator
              if (phase2 >= 1) phase2 -= 1;
              const modOut = Math.sin(TWOPI * phase2) * fmIndex;
              phase += dt; // carrier
              if (phase >= 1) phase -= 1;
              osc = Math.sin(TWOPI * phase + modOut);
              this._uPhase[ui] = phase;
              this._uPhase2[ui] = phase2;
              break;
            }
            case OSC_WAVETABLE: {
              // Interpolating wavetable with frame morphing
              phase += dt;
              if (phase >= 1) phase -= 1;
              if (wtFrames) {
                const nFrames = wtFrames.length;
                const framePos = wtPos * (nFrames - 1);
                const f0 = Math.floor(framePos);
                const f1 = Math.min(f0 + 1, nFrames - 1);
                const fMix = framePos - f0;
                const idx = phase * WT_SIZE;
                const i0 = Math.floor(idx) % WT_SIZE;
                const i1 = (i0 + 1) % WT_SIZE;
                const frac = idx - Math.floor(idx);
                const v0 = wtFrames[f0][i0] + (wtFrames[f0][i1] - wtFrames[f0][i0]) * frac;
                const v1 = wtFrames[f1][i0] + (wtFrames[f1][i1] - wtFrames[f1][i0]) * frac;
                osc = v0 + (v1 - v0) * fMix;
              } else {
                osc = Math.sin(TWOPI * phase); // fallback
              }
              this._uPhase[ui] = phase;
              break;
            }
            default:
              osc = 0;
              this._uPhase[ui] = (phase + dt) % 1;
          }

          const gainL = voiceGain * (1 - pan * 0.5);
          const gainR = voiceGain * (1 + pan * 0.5);
          mixL += osc * gainL;
          mixR += osc * gainR;

          if (driftAmt > 0) this._uDriftPhase[ui] = (this._uDriftPhase[ui] + this._uDriftRate[ui] * invSr) % 1;
        }

        // ── Sub-oscillator ──
        if (subOn) {
          const subSample = Math.sin(TWOPI * subPhase) * subLevel;
          mixL += subSample; mixR += subSample;
          subPhase = (subPhase + freq * 0.5 * invSr) % 1;
        }

        // ── Filter drive ──
        if (filterDrive > 0) {
          mixL = Math.tanh(mixL * driveGain) * driveComp;
          mixR = Math.tanh(mixR * driveGain) * driveComp;
        }

        // ── Filter ──
        if (filterOn) {
          const mid = (mixL + mixR) * 0.5;
          const side = (mixL - mixR) * 0.5;
          // Effective cutoff with envelope + LFO modulation (shared by all filter models)
          const lfoCutMod = lfoCutoff ? lfoVal * baseCutoff * 0.8 : 0;
          const fc = baseCutoff + (fltEnvDepth > 0 ? fltEnvLevel * fltEnvDepth * 8000 : 0) + lfoCutMod;
          let filtered;

          if (filterModel === FLT_DIGITAL) {
            // Recompute biquad when cutoff is modulated per-sample
            if (lfoCutoff || fltEnvDepth > 0) {
              this._computeBiquad(Math.max(20, fc), baseQ, filterType);
              b0 = this._fltB0; b1 = this._fltB1; b2 = this._fltB2;
              a1 = this._fltA1; a2 = this._fltA2;
            }
            filtered = b0 * mid + fltZ1;
            fltZ1 = b1 * mid - a1 * filtered + fltZ2;
            fltZ2 = b2 * mid - a2 * filtered;
            if (Math.abs(fltZ1) < 1e-15) fltZ1 = 0;
            if (Math.abs(fltZ2) < 1e-15) fltZ2 = 0;

          } else if (filterModel === FLT_MOOG) {
            const wc = TWOPI * Math.min(fc, sr * 0.45) / sr;
            const g = 0.9892 * wc - 0.4342 * wc * wc + 0.1381 * wc * wc * wc - 0.0202 * wc * wc * wc * wc;
            const feedback = ladderRes * (ly3 - mid * 0.0005);
            const x = mid - Math.tanh(feedback);
            const s0 = ly0 + g * (Math.tanh(x) - Math.tanh(ly0));
            const s1 = ly1 + g * (Math.tanh(s0) - Math.tanh(ly1));
            const s2 = ly2 + g * (Math.tanh(s1) - Math.tanh(ly2));
            const s3 = ly3 + g * (Math.tanh(s2) - Math.tanh(ly3));
            ly0 = Math.abs(s0) < 1e-15 ? 0 : s0;
            ly1 = Math.abs(s1) < 1e-15 ? 0 : s1;
            ly2 = Math.abs(s2) < 1e-15 ? 0 : s2;
            ly3 = Math.abs(s3) < 1e-15 ? 0 : s3;
            filtered = s3 * 3.0;

          } else {
            // Välimäki diode ladder (4-pole, asymmetric clipping)
            const wc = TWOPI * Math.min(fc, sr * 0.45) / sr;
            const g = 0.9892 * wc - 0.4342 * wc * wc + 0.1381 * wc * wc * wc - 0.0202 * wc * wc * wc * wc;
            const feedback = ladderRes * 1.1 * (ly3 - mid * 0.0005);
            const x = mid - feedback;
            // Inline diode clip: asymmetric tanh
            const dc = (v) => v > 0 ? Math.tanh(v * 1.2) : Math.tanh(v * 0.8);
            const s0 = ly0 + g * (dc(x) - dc(ly0));
            const s1 = ly1 + g * (dc(s0) - dc(ly1));
            const s2 = ly2 + g * (dc(s1) - dc(ly2));
            const s3 = ly3 + g * (dc(s2) - dc(ly3));
            ly0 = Math.abs(s0) < 1e-15 ? 0 : s0;
            ly1 = Math.abs(s1) < 1e-15 ? 0 : s1;
            ly2 = Math.abs(s2) < 1e-15 ? 0 : s2;
            ly3 = Math.abs(s3) < 1e-15 ? 0 : s3;
            filtered = s3 * 3.0;
          }

          // 1-pole lowpass on side channel: tames unfiltered stereo highs from unison.
          // Follows the same effective cutoff as the main filter.
          const sideAlpha = Math.min(1, TWOPI * Math.min(fc, sr * 0.45) * invSr);
          sideFilt += (side - sideFilt) * sideAlpha;
          if (Math.abs(sideFilt) < 1e-15) sideFilt = 0;

          mixL = filtered + sideFilt;
          mixR = filtered - sideFilt;
        }

        // ── Apply envelope + channel pan ──
        const outSampleL = mixL * envLevel;
        const outSampleR = mixR * envLevel;
        if (isStereo) {
          // Equal-power pan: chPan -1(L) to +1(R)
          outL[s] += outSampleL * (1 - chPan * 0.5);
          outR[s] += outSampleR * (1 + chPan * 0.5);
        } else {
          outL[s] += outSampleL + outSampleR;
        }
      }

      // Write back
      this._envLevel[v] = envLevel;
      this._envStage[v] = envStage;
      this._fltZ1[v] = fltZ1;
      this._fltZ2[v] = fltZ2;
      this._ladderY[lb] = ly0; this._ladderY[lb + 1] = ly1;
      this._ladderY[lb + 2] = ly2; this._ladderY[lb + 3] = ly3;
      this._fltEnvLevel[v] = fltEnvLevel;
      this._sideFilt[v] = sideFilt;
      this._subPhase[v] = subPhase;
      this._gateRemaining[v] = gateRemaining;
      this._lfoPhase[v] = lfoPhase;
    }

    return true;
  }
}

registerProcessor("poly-synth", PolySynthProcessor);
