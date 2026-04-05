# Architecture & Engine Internals

Deep technical reference for mpump's audio engine, synthesis, effects chain, and stability rules. For feature overviews, see [README.md](../README.md).

---

## Engine Layers

```
┌──────────────────────────────────────────────────────┐
│  Engine (orchestrator)                               │
│  - device state, pattern data, sequencer timing      │
│  - command dispatch, state change callbacks           │
├──────────────────────────────────────────────────────┤
│  AudioPort (synthesis + mixing)                      │
│  - voice allocation, drum synthesis, synth voices     │
│  - effects chain, limiter, analyser                  │
│  - per-channel gain, pan, mono, volume               │
├──────────────────────────────────────────────────────┤
│  Web Audio API                                       │
│  - OscillatorNode, GainNode, BiquadFilterNode        │
│  - AudioBuffer, StereoPannerNode, DynamicsCompressor │
│  - AnalyserNode, AudioWorklet (limiter)              │
└──────────────────────────────────────────────────────┘
```

**Engine** (`Engine.ts`) — orchestrator. Holds device state, pattern data, sequencer timing. Doesn't produce sound.

**AudioPort** (`AudioPort.ts`) — audio graph. Creates Web Audio nodes, allocates voices, triggers drums, routes through effects. Manages per-channel FX exclusion routing and communicates gate/duck parameters to the poly-synth worklet.

**drumSynth** (`drumSynth.ts`) — generates drum sounds as AudioBuffers using additive/subtractive synthesis.

---

## Sequencer Timing

```
Step duration = 60000 / (BPM × 4) ms

At 120 BPM: 125ms per step
At 140 BPM: ~107ms per step
Bar duration = numSteps × stepDuration = 16 × 125ms = 2000ms (at 120 BPM)
```

All devices share a global time origin (`t0`) from `performance.now()`. New devices sync at the **next bar boundary** (not next step). If a bar boundary is <50ms away, skip to the next one.

**Swing** shifts even-numbered steps forward. 0.5 = straight, 0.75 = heavy shuffle.

**Humanize** adds ±15% velocity randomization per note:
```
offset = velocity × (random × 0.3 − 0.15)
result = clamp(velocity + offset, 1, 127)
```

---

## Audio Graph

```
         ┌─────────────────────────────────────────────────┐
         │                  AudioPort                       │
         │                                                  │
ch 9 ──→ │ drumGain → drumPan ─┐                           │
         │                      ├──→ fxInput                │
ch 1 ──→ │ bassGain → bassPan ──┤        │                  │
         │                      │        ▼                  │
ch 0 ──→ │ synthGain → synthPan─┘ ┌─────────────┐          │
         │                        │ Effects     │          │
         │  (FX exclusion)        │ Chain       │          │
         │  drumsDirectOut ──┐    │ (10 nodes)  │          │
         │  synthBassDirectOut┤   └──────┬──────┘          │
         │                   │          │                   │
         │                   └──→ fxOutput ←────┘          │
         │                           │                      │
         │                           ▼                      │
         │                    ┌─────────────┐              │
         │                    │  Limiter    │              │
         │                    │  -1dB, 4:1  │              │
         │                    └──────┬──────┘              │
         │                           ▼                      │
         │                    ┌─────────────┐              │
         │                    │  Analyser   │──→ VU        │
         │                    └──────┬──────┘              │
         │                           ▼                      │
         │                    destination (speakers)        │
         └─────────────────────────────────────────────────┘
```

Each channel has: GainNode (volume), 3-band EQ (low shelf/mid peak/high shelf), optional trance gate, StereoPannerNode, AnalyserNode.

**Master chain**: 3-band EQ → 3-band multiband compressor (crossovers at 200 Hz / 3 kHz) → stereo widening (Haas on high band) → drive → soft-clip → limiter → analyser → destination.

**FX exclusion**: Excluded channels bypass effects via `drumsDirectOut` / `synthBassDirectOut` GainNodes connected directly to `fxOutput`, still passing through master EQ and limiter.

---

## Drum Synthesis

All 9 voices synthesized from oscillators, noise, and envelopes — rendered to AudioBuffers.

### Kick (BD, MIDI 36)
Tuned to Roland TR-808: 215 Hz → 105 Hz → 51 Hz sweep. Two-part body envelope: fast attack (`exp(-t*200)`, weight 0.55) + slow tail (`exp(-t*(5/decay))`, weight 0.12). Sub at 50 Hz. Click: broadband burst (2kHz + 5kHz), `exp(-t*2000)` decay. Default decay 0.3 = 180ms.

### Snare (SD, MIDI 38)
Body at 185 Hz, pitch envelope 280→185 Hz. Wire resonance bandpass at 3800 Hz (Q=3). noiseMix controls tone/noise balance.

### Hats (CH 42, OH 46)
6 inharmonic partials: 3500, 4100, 5200, 6300, 7500, 8800 Hz (7.5kHz dominant, 808 match). Sharp transient burst (<1ms). CH: short decay. OH: long decay.

### Other Voices
| Voice | MIDI | Technique |
|-------|------|-----------|
| Rimshot | 37 | 920 + 1600 Hz, noise, 40ms |
| Cowbell | 47 | 545 + 815 Hz squares (808 values), bandpass Q=4 |
| Cymbal | 49 | 5 partials 3.2–11 kHz (909 match) |
| Clap | 50 | 4 randomized micro-bursts + bandpass 3.2 kHz |
| Ride | 51 | 6 bell partials 392–8500 Hz + stick transient |

### Fletcher-Munson Compensation
Applied at playback time to compensate for equal-loudness contours (drums only):

| Voice | Note | Gain | Rationale |
|-------|------|------|-----------|
| Kick | 36 | 1.6 | Low frequency needs boost |
| Snare | 38 | 1.1 | Mid-range body + high-freq wire |
| CH | 42 | 1.3 | Ear-sensitive range, boosted for presence |
| OH | 46 | 1.2 | Same, slightly less energy |
| Tom/CB | 47 | 1.0 | Mid-range, neutral |
| Crash | 49 | 1.1 | Bright, slight boost |
| Clap | 50 | 0.9 | Noise-based, 1-5 kHz, slight cut |
| Ride | 51 | 1.0 | High partials, neutral |
| Rimshot | 37 | 1.0 | Mid-high, neutral |
| Cowbell | 56 | 0.9 | Mid-high, slight cut |

### Channel Frequency Separation

| Channel | HP filter | Low shelf | Mid cut | High shelf |
|---------|-----------|-----------|---------|------------|
| Drums (ch 9) | none | +4 dB @ 80 Hz | none | -1 dB @ 5 kHz |
| Bass (ch 1) | 50 Hz | 0 dB | -4 dB @ 300 Hz | -1 dB @ 5 kHz |
| Synth (ch 0) | 40 Hz | 0 dB | -1.5 dB @ 300 Hz | 0 dB |

Bass also has 3 kHz LP. Master EQ: +1 dB low @ 150 Hz, -2 dB mid @ 350 Hz, 0 dB high.

---

## Synth Voice Architecture

```
Main Oscillator: SAW/SQR/SIN/TRI/PWM/SYNC/FM/WTB
  + unison (1–7), detune (0–50 cents), analog drift (~±3 cents)
  + Sub Oscillator (optional, sine, -1 octave)
  → Filter: DIG (Biquad) / MOG (Moog ladder) / 303 (diode)
    LP/HP/BP/Notch, cutoff 100–8000 Hz, Q 0.5–20, env depth 0–1
  → ADSR: A 0.001–2s, D 0.01–2s, S 0–1, R 0.01–3s
  → LFO: sine/square/tri/saw, target cutoff/pitch/both
    free 0.1–20 Hz or tempo-synced
```

### AudioWorklet Poly-Synth
Zero-allocation voice engine on the audio thread:
- 16 max voices with oldest-voice stealing (2ms micro-fade on steal)
- Per-voice phase accumulators for SAW/SQR/SIN/TRI
- PWM via dual-saw subtraction
- State-variable filter with cutoff envelope
- Per-voice ADSR
- Trance gate: BPM-synced 16-step patterns, sample-accurate. Consecutive ON steps merge (no retrigger dip)
- Sidechain duck: kick-triggered with exponential recovery, per-channel depth/release
- Denormal flushing on all filter state variables (`if (Math.abs(v) < 1e-15) v = 0`)

Synth amplitude: `amp = (vel/127) * 0.2` (compensated by master +6 dB boost).

---

## Effects Chain

| Effect | Implementation | Key Params |
|--------|---------------|------------|
| Compressor | DynamicsCompressorNode | threshold -24 dB, ratio 4:1 |
| Highpass | BiquadFilterNode | cutoff 200 Hz, Q |
| Distortion | WaveShaperNode (asymmetric) | drive with gain compensation |
| Bitcrusher | AudioWorklet (sample-and-hold + dither) | bits 8, crushRate |
| Chorus | 3-voice stereo + quadrature LFOs | rate 1.5, depth 0.003, mix 0.3 |
| Phaser | 6-stage allpass, 200–10kHz sweep | rate 0.5, depth 1000 |
| Delay | Stereo ping-pong, tempo sync | 1/16, feedback 0.4, mix 0.3, EXCL |
| Reverb | ConvolverNode, 4 IR types | decay 2s, mix 0.3, EXCL |
| Flanger | Through-zero + feedback | rate, depth, mix |
| Tremolo | Amplitude LFO | rate, depth |
| Duck | Kick-triggered (worklet for ch 0/1) | depth, release, EXCL |

### Anti-Clip Limiter
- **Off** — no limiting
- **Limiter** (default) — -1 dB threshold, 4:1 ratio, 1ms attack, 250ms release, 10 dB knee
- **Hybrid** — soft-clip waveshaper before limiter

---

## Advanced Features

### Arpeggiator
Fixed chord shape: root, major 3rd, 5th, octave (intervals: 0, 4, 7, 12).

| Mode | Pattern |
|------|---------|
| up | 0 → 4 → 7 → 12 |
| down | 12 → 7 → 4 → 0 |
| up-down | 0 → 4 → 7 → 12 → 7 → 4 |
| random | random from 4 intervals |

Rates: 1/4, 1/8, 1/16. Each note gets 80% gate length.

### Sidechain Duck
Kick (MIDI 36) triggers bass/synth channels to configurable depth (default 15%). Worklet channels use sample-accurate per-block exponential recovery. Main-thread channels use `setTargetAtTime()`.

### Trance Gate
16-step on/off patterns synced to BPM. 8 numbered presets, 5 stutter presets (BDUP, TRIP, STUT, BKBT, GLTC), custom editable. Consecutive ON steps merge. Also supports LFO mode (sine/square/tri/saw).

### Per-Channel FX Exclusion
Reverb/Delay: EXCL. DRUMS/BASS/SYNTH. Duck: EXCL. BASS/SYNTH. Excluded channels route via dedicated bypass GainNodes to fxOutput, skipping effects but keeping master EQ + limiter.

Note: Synth (ch 0) and bass (ch 1) share a single worklet output, so excluding either from reverb/delay bypasses both in worklet mode.

### Pattern Chain
A/B alternation at bar boundaries. Engine swaps pattern data on step 0 via cycle counter. Hot-swap, no gap.

### Scale Lock
| Scale | Intervals |
|-------|-----------|
| Chromatic | all 12 |
| Major | 0 2 4 5 7 9 11 |
| Minor | 0 2 3 5 7 8 10 |
| Pentatonic | 0 2 4 7 9 |
| Blues | 0 3 5 6 7 10 |
| Dorian | 0 2 3 5 7 9 10 |
| Mixolydian | 0 2 4 5 7 9 10 |

### Metronome
1000 Hz sine, 30% volume, 30ms envelope on every quarter note.

---

## Engine Stability Rules

These rules prevent progressive audio degradation during extended interactive use.

### 1. cancelScheduledValues before setTargetAtTime
Every AudioParam automation call must cancel first. Applies to: channel volume, EQ, master volume, drive, width, pan, low cut, duck.

### 2. Never restartDevice for mute/solo
Use `hotSwapPatterns` instead. `restartDevice` only for structural changes: setKey, setOctave, setPatternLength, randomizeDevice, loadPreset.

### 3. Guard schedule() with running check
`if (!this.running) return` at top of `schedule()` prevents ghost notes after stop().

### 4. Debounce rebuildFxChain
- Effect toggle: rebuild immediately
- Parameter change: debounce 150ms
- BPM change with synced delay: debounce 100ms

### 5. Cap active drum sources at 16
Track in Set, kill oldest 4 when exceeded. ~50 node-creates/sec at 128 BPM.

### 6. Limit synth polyphony to 16 voices
Kill oldest voice when Map exceeds 16.

### 7. Kill stale voices in heartbeat
1-second timer kills voices older than 5 seconds.

### 8. setSynthParams: only kill voices on model change
Only kill on `filterModel` or `oscType` change. For param-only changes (cutoff, resonance), update AudioParams in-place. Skip voice iteration if cutoff/resonance/filterType unchanged.

### 9. Throttle KAOS pad to 50ms (20fps)
Don't send filterOn/filterType on every drag — only changed param.

### 10. Clean up everything on close()
All voices, drum sources, trance gate intervals, FX debounce timer, heartbeat interval, event listeners.

### 11. Throttle restartDevice 50ms per device

### 12. Flush denormals in worklet filters
`if (Math.abs(v) < 1e-15) v = 0` on all filter state. Without this, silent filters consume 10–50× CPU.

### 13. Voice steal click prevention
2ms micro-fade (64 samples at 48 kHz) before reclaiming stolen voice.

### 14. Effect node leak prevention
Rebuild tracks all created nodes, disconnects at start of next rebuild.

### 15. Retrigger click fix
Fade out existing voice before starting new one on same channel+note.

### 16. Connect before disconnect
New path first, disconnect old after 5ms delay. Prevents momentary silence.

### Audio Node Lifecycle

| Node type | Created by | Cleaned up by |
|-----------|-----------|---------------|
| Drum BufferSource+Gain+Pan | `playDrum` | `src.onended` |
| Synth Osc+Gain+Filter | `playSynth` | `disconnectVoice` via `oscs[0].onended` |
| Effect chain nodes | `rebuildFxChain` | Disconnected at start of next rebuild |
| Trance gate LFO | `setChannelGate` | Teardown at start of next call |
| FX bypass GainNodes | `updateDrumsBypassFx` | Lives for AudioPort lifetime |
| Channel bus + EQ | `getChannelBus` (lazy) | Lives for AudioPort lifetime |
| Master EQ + limiter | Constructor | Lives for AudioPort lifetime |

### Debugging
1. Chrome DevTools → Performance tab — look for long audio thread tasks
2. `chrome://media-internals` — check AudioContext state and node count
3. Console — `[AudioPort] AudioContext is closed` = unrecoverable crash
4. Common causes: rapid KAOS pad + effect toggles, mute/solo spam, preset switching during playback

---

## Link Bridge

```
┌─────────┐   WebSocket    ┌──────────────┐    UDP     ┌──────────┐
│  mpump  │←────────────→ │ Link Bridge  │←────────→ │ Ableton  │
│ browser │  localhost:    │ companion    │ multicast  │ / other  │
└─────────┘   19876        └──────────────┘            └──────────┘
```

Companion app bridges WebSocket to Link's UDP multicast. Browser receives at 20 Hz: tempo, beat, phase (0–3.999 for 4/4), peers. All on localhost — no internet needed.

---

## MIDI Output

Standard messages: Note On (0x90), Note Off (0x80), CC (0xB0). 53 devices recognized from registry. MIDI Clock sync via `MidiClockReceiver` (24 ppqn).
