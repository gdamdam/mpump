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
2. Bass and synth channels instantly dip to **15% volume** (3ms attack)
3. Volume recovers exponentially over **~40ms**

This creates the "pumping" effect common in house and EDM, without needing to route a compressor sidechain. The ducking uses `setTargetAtTime()` on the channel gain nodes for smooth, click-free transitions.

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
