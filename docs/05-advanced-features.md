# Chapter 5: Advanced Features

Smaller features that add depth to the groovebox — arpeggiator, sidechain, recording, and more.

## Arpeggiator

Turns single pattern notes into arpeggiated sequences using a fixed chord shape: **root, major 3rd, 5th, octave** (semitone intervals: 0, 4, 7, 12).

| Mode | Pattern |
|------|---------|
| up | 0 → 4 → 7 → 12 |
| down | 12 → 7 → 4 → 0 |
| up-down | 0 → 4 → 7 → 12 → 7 → 4 |
| random | random pick from the four intervals |

Three rates available: **1/4**, **1/8**, **1/16** (quarter, eighth, sixteenth notes). Each arpeggio note gets 80% gate length. The arp subdivides each pattern step according to the rate, so at 1/16 with a 16-step pattern you get one arp note per step; at 1/4 you get one note per beat.

Applied to synth and bass voices only — drums are unaffected.

## Sidechain Duck

Simulates sidechain compression triggered by the kick drum (MIDI note 36). When enabled:

1. Kick fires on channel 9
2. Bass and synth channels instantly dip to configurable **depth** (default 15% volume)
3. Volume recovers exponentially over configurable **release** time

For channels running through the AudioWorklet poly-synth (synth ch 0, bass ch 1), ducking runs inside the worklet with sample-accurate timing. The worklet maintains per-channel `_chDuckLevel` values with exponential recovery computed per audio block. For drum channels, ducking uses main-thread `setTargetAtTime()` on channel gain nodes.

**Per-channel exclusion**: The duck editor includes EXCL. BASS and EXCL. SYNTH toggle buttons. Excluded channels are not ducked, allowing selective pumping (e.g., duck only synth while bass stays steady).

## Trance Gate

A tempo-synced volume chopper that creates rhythmic gating effects on synth and bass channels. Available per-channel from the MIXER view.

### Presets

- **8 numbered presets** (1–8): Classic trance gate patterns derived from standard rhythmic divisions — from straight 4-on-the-floor to complex syncopated patterns
- **5 named stutter presets** (BDUP, TRIP, STUT, BKBT, GLTC): Buildup, Triplet, Stutter, Breakbeat, and Glitch patterns for performance effects
- **Custom (E)**: User-editable 16-step pattern with tappable step grid. Auto-highlights when the active pattern doesn't match any preset

### Implementation

Gate patterns are 16-step arrays of on/off values, synced to BPM. Consecutive ON steps merge into a single sustained gate — no retriggering dip between adjacent active steps.

For worklet channels (synth/bass), gate parameters are sent via `port.postMessage({ type: 'gate_pattern' })` and applied per-block in the worklet's `process()` loop. This gives sample-accurate gating rather than the ~3ms granularity of main-thread Web Audio automation.

The gate also supports an LFO mode with configurable rate, depth, and shape (sine/square/triangle/sawtooth) as an alternative to step patterns.

## Per-Channel FX Exclusion

Reverb, Delay, and Duck support per-channel exclusion via EXCL. toggle buttons in their effect editors:

- **Reverb / Delay**: EXCL. DRUMS, EXCL. BASS, EXCL. SYNTH
- **Duck**: EXCL. BASS, EXCL. SYNTH

Excluded channels bypass the effects chain entirely via dedicated `GainNode` routing (`drumsDirectOut`, `synthBassDirectOut`) connected directly to the effects output node. This means excluded channels still pass through the master EQ, multiband compressor, and limiter — only the specific effect is bypassed.

**Note**: Synth (ch 0) and bass (ch 1) share a single worklet output node, so excluding either from reverb/delay bypasses both in worklet mode.

## Pattern Chain

Links two patterns (A and B) that alternate at bar boundaries:

```
Bar 1       Bar 2       Bar 3       Bar 4
┌─────┐    ┌─────┐    ┌─────┐    ┌─────┐
│  A  │ →  │  B  │ →  │  A  │ →  │  B  │
└─────┘    └─────┘    └─────┘    └─────┘
```

Enable chain mode in SYNTH view and select the B pattern index. The engine swaps pattern data on step 0 of each bar by toggling a cycle counter (0 = A, 1 = B). The swap is a hot-swap — no restart, no gap. Doubles your effective sequence length from 16 to 32 steps.

## Humanize

Adds subtle velocity randomization to make patterns feel less mechanical. Each note's velocity is offset by **±15%**:

```
offset = velocity × (random × 0.3 − 0.15)
result = clamp(velocity + offset, 1, 127)
```

Applied per-note to both regular playback and arpeggiator notes. Timing remains quantized — only velocity is humanized.

## Metronome

A simple click track on every quarter note (every 4th step). Plays a **1000 Hz sine wave** at 30% volume with a 30ms envelope — short enough to cut through the mix without being distracting. Useful for tempo reference when building patterns from scratch.

## Custom Samples

Replace any of the 9 drum voices with your own audio files:

1. Open the **sample loader** section in SYNTH view (below the drum kit editor)
2. Drop or select a WAV, MP3, or OGG file
3. The browser decodes it to an `AudioBuffer` via `decodeAudioData()`
4. The custom sample replaces the synthesized drum voice for that slot

Per-voice parameters (tune, decay, level, pan) still apply to custom samples. Samples are stored in localStorage as base64 data, so they persist across sessions.

## Recording

### Audio (WAV)

Click **REC** in the header to capture audio output. Recording uses raw PCM capture (not MediaRecorder) for maximum quality:

- **Format**: 16-bit PCM WAV, stereo
- **Metadata**: embedded LIST/INFO chunk with track name, artist, software, and date
- Click REC again to stop — the file downloads automatically

### Video (MP4 / WebM)

Available from the Share modal. Records the visual card animation alongside audio:

- **Chromium** (Chrome, Edge): MP4 via WebCodecs API + mp4-muxer — H.264 video at 30fps/2.5 Mbps, AAC audio at 128 kbps
- **Other browsers**: WebM via MediaRecorder — VP9/VP8 video, Opus audio

## Scale Lock

Constrains melodic editing to a specific scale. Seven scales available:

| Scale | Intervals | Notes per octave |
|-------|-----------|-----------------|
| Chromatic | all 12 | 12 |
| Major | 0 2 4 5 7 9 11 | 7 |
| Minor | 0 2 3 5 7 8 10 | 7 |
| Pentatonic | 0 2 4 7 9 | 5 |
| Blues | 0 3 5 6 7 10 | 6 |
| Dorian | 0 2 3 5 7 9 10 | 7 |
| Mixolydian | 0 2 4 5 7 9 10 | 7 |

When a scale is active:
- **Step editing** snaps pitches to the nearest scale tone
- **Navigation** (scroll wheel, arrow keys) skips non-scale tones
- Existing off-scale notes are snapped when the scale is changed
