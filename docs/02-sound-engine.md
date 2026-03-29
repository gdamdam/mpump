# Chapter 2: The Sound Engine

How mpump synthesizes drums, bass, and synth voices, schedules them, mixes them, and sends them out — all in the browser using the Web Audio API.

## Architecture

The engine has three layers:

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

**Engine** (`Engine.ts`, ~1500 lines) is the orchestrator. It holds all device state, pattern data, and sequencer timing. It doesn't produce sound — it tells AudioPort what notes to play and when.

**AudioPort** (`AudioPort.ts`, ~1000 lines) is the audio graph. It creates and manages Web Audio nodes, allocates synth voices, triggers drum sounds, and routes everything through effects to the output.

**drumSynth** (`drumSynth.ts`) generates drum sounds as AudioBuffers using additive/subtractive synthesis — no samples loaded from the network.

## Sequencer Timing

The sequencer runs on 16th-note steps:

```
Step duration = 60000 / (BPM × 4) ms

At 120 BPM: 60000 / 480 = 125ms per step
At 140 BPM: 60000 / 560 ≈ 107ms per step
```

All devices share a global time origin (`t0`) from `performance.now()`. When a new device connects or un-pauses, it syncs at the **next bar boundary** — not the next step. This keeps everything phase-locked.

```
Bar duration = numSteps × stepDuration
             = 16 × 125ms = 2000ms (at 120 BPM, 16-step pattern)
```

If a bar boundary is less than 50ms away, the engine skips to the next one to avoid scheduling glitches.

**Swing** shifts even-numbered steps forward in time. A swing value of 0.5 is straight; 0.75 is heavy shuffle. The offset is applied per-step during scheduling.

**Humanize** adds subtle random timing and velocity variations to make patterns feel less mechanical.

## Drum Synthesis

All 9 drum voices are synthesized from scratch using oscillators, noise, and envelopes — rendered to AudioBuffers at initialization and on parameter changes.

### Kick (BD, MIDI 36)

```
┌─ Click ──┐   ┌─ Body ─────────────────────┐
│ short    │ + │ sine oscillator              │
│ noise    │   │ pitch sweep: 220→40 Hz       │
│ burst    │   │ exponential decay             │
└──────────┘   └──────────────────────────────┘
                         +
               ┌─ Sub ─────────────────────┐
               │ sine at base freq (40 Hz) │
               │ longer decay              │
               └───────────────────────────┘
```

Parameters: **click** (attack transient level, 0–1), **sweepDepth** (pitch sweep amount), **sweepRate** (how fast pitch drops), **tune** (±24 semitones), **decay** (multiplier), **filterCutoff** (optional LP filter).

### Snare (SD, MIDI 38)

```
┌─ Tone ──────────┐   ┌─ Noise ──────────┐
│ 185 Hz + 100 Hz │ + │ white noise       │
│ sine oscillators │   │ bandpass filtered  │
│ fast decay       │   │ longer tail        │
└──────────────────┘   └───────────────────┘
```

**noiseMix** (0–1) controls the balance between tonal body and noise. 0 = pure tone, 1 = pure noise.

### Closed Hat (CH, MIDI 42) & Open Hat (OH, MIDI 46)

```
┌─ Ring Partials ──────────────────────┐
│ 3 square oscillators at:             │
│   3500 Hz, 5200 Hz, 7800 Hz         │
│ bandpass filtered                    │
│ CH: short decay  /  OH: long decay   │
└──────────────────────────────────────┘
```

**color** (-1 to +1) shifts brightness. Negative values darken (lower partials emphasized), positive values brighten (higher partials).

### Other Voices

| Voice | MIDI | Technique |
|-------|------|-----------|
| Rimshot (RS) | 37 | Short pitched click, high-frequency content |
| Cowbell (CB) | 47 | Two detuned square oscillators, metallic ring |
| Cymbal (CY) | 49 | Dense ring partials, long decay, bandpass filtered |
| Clap (CP) | 50 | Multiple short noise bursts with slight delays (hand spread) |
| Ride (RD) | 51 | Similar to cymbal, brighter, shorter body |

All voices support: **tune** (±24 semitones), **decay** (0.2–3.0 multiplier), **level** (0–1), **pan** (-1 to +1), **filterCutoff** (0=dark, 1=bypass).

### Custom Samples

Users can load WAV/MP3/OGG files to replace any drum voice. The sample is decoded to an AudioBuffer and used instead of the synthesized sound. Per-voice parameters (tune, decay, level) still apply.

## Synth and Bass Voices

Both synth and bass use the same voice architecture with different default parameters.

### Voice Architecture

```
┌─ Main Oscillator ────────────┐
│ SAW / SQR / SIN / TRI        │
│ optional unison (1–7 voices)  │
│ detune spread (0–50 cents)    │
├───────────────────────────────┤
│ + Sub Oscillator (optional)   │
│   sine, -1 octave             │
│   level 0–1                   │
├───────────────────────────────┤
│ → Filter (optional)           │
│   LP / HP / BP / Notch        │
│   cutoff 100–8000 Hz          │
│   resonance 0.5–20 Q          │
│   envelope depth 0–1          │
├───────────────────────────────┤
│ → ADSR Envelope               │
│   attack  0.001–2s            │
│   decay   0.01–2s             │
│   sustain 0–1                 │
│   release 0.01–3s             │
├───────────────────────────────┤
│ → LFO (optional)              │
│   shape: sine/square/tri/saw  │
│   target: cutoff/pitch/both   │
│   free rate (0.1–20 Hz)       │
│   or tempo-synced division    │
│   depth 0–1                   │
└───────────────────────────────┘
```

### Voice Allocation

Synth voices are polyphonic — each note-on creates a new voice, tracked in a `Map<"ch:note", SynthVoice>`. When a note-off arrives, the voice enters its release phase and is cleaned up after release completes.

**Unison**: When unison > 1, multiple oscillators are created per voice, spread across the stereo field with configurable detune. 7 voices with 30 cents spread = classic supersaw.

**Filter envelope**: When `filterEnvDepth` > 0, each note-on sweeps the filter cutoff from `cutoff + depth` down to `cutoff`, creating the classic acid squelch.

**Slide/Glide**: Pattern steps with `slide: true` glide pitch from the previous note instead of retriggering, for 303-style bass lines.

### Sound Presets

19 synth presets (grouped: Leads, Keys, Pads, Plucks, Squelch, Aggressive) and 14 bass presets (grouped: Deep, Acid, Sustained, Plucks, Wobble). 15 drum kit presets with per-voice parameter overrides.

## Audio Graph

```
         ┌─────────────────────────────────────────────────┐
         │                  AudioPort                       │
         │                                                  │
ch 9 ──→ │ drumGain → drumPan ─┐                           │
         │                      │                           │
ch 1 ──→ │ bassGain → bassPan ──┤──→ fxInput               │
         │                      │        │                  │
ch 0 ──→ │ synthGain → synthPan─┘        ▼                  │
         │                        ┌─────────────┐          │
         │                        │ Effects     │          │
         │                        │ Chain       │          │
         │                        │ (8 nodes)   │          │
         │                        └──────┬──────┘          │
         │                               ▼                  │
         │                        ┌─────────────┐          │
         │                        │  Limiter    │          │
         │                        │  -1dB, 4:1  │          │
         │                        └──────┬──────┘          │
         │                               ▼                  │
         │                        ┌─────────────┐          │
         │                        │  Analyser   │──→ VU    │
         │                        └──────┬──────┘          │
         │                               ▼                  │
         │                        destination (speakers)    │
         └─────────────────────────────────────────────────┘
```

Each channel has its own `GainNode` (volume), `StereoPannerNode`, and `AnalyserNode` for per-channel metering. The master analyser drives the VU meter in the header and MIXER mode.

## Effects Chain

The effects chain is a series of Web Audio nodes connected in sequence. Users can reorder the chain.

| Effect | Implementation | Key Params |
|--------|---------------|------------|
| Compressor | DynamicsCompressorNode | threshold, ratio |
| Highpass | BiquadFilterNode (highpass) | cutoff, Q |
| Distortion | WaveShaperNode | drive (with gain compensation) |
| Bitcrusher | ScriptProcessor / AudioWorklet | bit depth |
| Chorus | Stereo delay lines + quadrature LFOs | rate, depth, mix |
| Phaser | 4-stage allpass filters with LFO sweep | rate, depth |
| Delay | Stereo ping-pong delay with tempo sync | time/division, feedback, mix |
| Reverb | ConvolverNode with generated impulse | decay, mix |

All effects use dry/wet mixing so you can blend the processed signal with the original.

## Anti-Clip / Limiter

Three modes available:

- **Off** — no limiting, signal can clip
- **Limiter** (default) — brick-wall limiter at -1 dB threshold, 4:1 ratio, 1ms attack, 250ms release, 10 dB knee
- **Hybrid** — soft-clip waveshaper before the limiter for warmer saturation

The DRIVE control on the master channel adds input gain (-6 to +12 dB) before the limiter — push it for intentional compression/distortion.

## MIDI Output

When a USB MIDI device is connected, the Engine sends standard MIDI messages instead of (or in addition to) triggering AudioPort:

```
Note On:  [0x90 | channel, note, velocity]
Note Off: [0x80 | channel, note, 0]
CC:       [0xB0 | channel, controller, value]
```

50 devices are recognized by name from the device registry (`devices.ts`). Each device entry specifies MIDI channel mappings, note ranges, and supported features. Unrecognized MIDI devices can still be used with generic settings.

**MIDI Clock Sync**: mpump can receive MIDI clock (24 ppqn) from external sources via `MidiClockReceiver`, syncing its tempo and transport to hardware or DAW.

## Link Bridge

Link Bridge connects mpump to Ableton Link — a protocol for syncing tempo and phase across devices on the same network.

```
┌─────────┐     WebSocket      ┌──────────────┐     UDP      ┌──────────┐
│  mpump  │ ←──────────────→  │ Link Bridge  │ ←──────────→ │ Ableton  │
│ browser │   localhost:19876  │ companion    │  multicast   │ / other  │
└─────────┘                    └──────────────┘              └──────────┘
```

A companion app runs a WebSocket server on localhost that bridges to Link's UDP multicast. The browser connects and receives sync state at 20 Hz:

- **tempo** — shared BPM across all Link peers
- **beat** — current beat position (e.g., 2.5)
- **phase** — position within the bar (0–3.999 for 4/4)
- **peers** — number of other Link clients on the network

All traffic stays on localhost — no internet required. If the bridge isn't running, mpump silently falls back to its own internal clock.

## Pattern Data Format

### Melodic (synth and bass)

Each step is either `null` (rest) or a `StepData` object:

```typescript
{ semi: number, vel: number, slide: boolean }
```

- **semi** — semitone offset from the current root note (e.g., 0 = root, 7 = fifth)
- **vel** — velocity factor (0–1, multiplied with base velocity)
- **slide** — if true, glide pitch from previous note instead of retriggering

### Drums

Each step is an array of `DrumHit` objects (multiple voices can trigger on the same step):

```typescript
{ note: number, vel: number }
```

- **note** — MIDI note number identifying the voice (36=BD, 38=SD, 42=CH, etc.)
- **vel** — velocity (0–127)

### Pattern Storage

Patterns are pre-compiled to JSON files in `public/data/` at build time, organized by device and genre. Each genre has 10 patterns per instrument type. The browser loads them on demand.

## Offline / PWA

mpump registers a service worker (`sw.js`) that caches all assets on first visit. The cache is versioned — each deploy bumps the version string, causing the worker to invalidate and re-fetch. After the first load, mpump works fully offline with no network requests.

The app can be installed as a PWA on Android (via `beforeinstallprompt`) and iOS (Add to Home Screen). The manifest provides icons, theme color, and standalone display mode.
