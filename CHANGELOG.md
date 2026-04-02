# Changelog

## v1.5.0 — Sound Quality Overhaul

_103 commits. The biggest update to mpump's audio engine since launch._

### New Genres
- **Dubstep** (140 BPM) — half-time drums, wobble bass, sparse atmosphere
- **Lo-Fi** (80 BPM) — boom-bap drums, walking bass, jazzy Rhodes chords
- **Synthwave** (118 BPM) — 80s drums, octave bounce bass, arpeggiated leads
- **Deep House** (122 BPM) — four-on-floor, smooth bass, organ stabs
- **Psytrance** (145 BPM) — driving kicks, KBBB rolling bass, acid leads
- ~300 new patterns across the 5 genres (20 drum + 20 bass + 20 synth each)
- Total: **20 genres, ~1210 patterns**

### Sound Engine
- All 9 drum voices tuned to Roland TR-808/909 reference samples
- Drum voice levels matched to 808 RMS (±30%)
- DC offset click artifacts eliminated on all drum voices
- 3 filter models: **DIG** (standard), **MOG** (Moog 4-pole ladder), **303** (diode ladder) — via AudioWorklet
- 4 new oscillator types: **PWM**, **SYNC** (hard sync), **FM** (2-operator), **WTB** (wavetable with 5 tables)
- Filter drive for resonance and self-oscillation
- Analog oscillator drift for warmth
- Bitcrusher upgraded to AudioWorklet with true sample-rate reduction and triangular PDF dithering

### Effects
- **10 effects** (was 8) — added **Flanger** and **Tremolo**
- Reverb: 4 types (room, hall, plate, spring) with early reflections and allpass diffusion
- Chorus: 3-voice with feedback (was 2-voice)
- Phaser: 6-stage (was 4-stage)
- Distortion: higher resolution curve with asymmetric clipping
- Soft-clip: two-stage tape-like saturation

### Presets
- **33 synth presets** (was 19) — includes Sync Lead, FM Bell, PWM Pad, Hoover, Wavetable Pad, Organ, String Pad, Pluck Lead, Sub Lead, Rhodes Keys, and more
- **22 bass presets** (was 14) — includes 303 Acid, FM Bass, PWM Bass, Jungle Bass, Sync Bass, Arp Bass, Psy Bass, and more
- **21 mixer scenes** — genre-matched EQ/compression/width profiles for all 20 genres plus Default
- Existing acid/neuro/reese presets updated to use MOG/303 filter models

### Mixer
- Per-channel 3-band EQ for drums, bass, and synth with SVG frequency response curve
- Multiband compressor with adjustable amount (0-100%) and ON/OFF toggle
- Stereo width control via Haas effect on high band
- Low-cut filter (0-200 Hz) for phone/laptop speakers
- Per-channel trance gate for synth and bass — tempo-synced volume chopper with rate, depth, shape, circular SVG
- Mix scenes: 21 built-in genre profiles + user save/load (SCN)
- Mixer undo (Cmd+Z) — snapshot stack for EQ/drive/width/lowCut/multiband changes
- Mixer settings now included in share links

### KAOS View
- VOL / EQ / KIT / GATE buttons per channel (replaced inline volume slider)
- Each opens a dedicated modal with controls and SVG visualization
- 🎛 scene picker dropdown in header — one-tap genre mixer optimization
- Dropdown labels for clarity ("Mix Scene", "Set All Genres")
- Larger touch targets on channel buttons

### SYNTH View
- ⌨ QWERTY keyboard playing — Z-M lower octave, Q-U upper octave
- ✎ Step-record mode — write notes into pattern via keyboard (Space = rest, Backspace = undo)
- `[` / `]` octave shift (±3 range)
- ⌨ and ✎ mutually exclusive across all instruments
- Oscillator buttons grouped: standard (SAW/SQR/SIN/TRI/PWM) | advanced (SYNC/FM/WTB)
- DIG / MOG / 303 filter model selector in filter section
- Detailed tooltips showing full key mappings

### Master Bus
- Default EQ: flat mid (mud cut handled per-channel on bass only)
- Default volumes: drums 0.8, bass 0.6, synth 0.6
- Bass channel: -4dB cut at 300Hz to reduce low-mid mud
- Drum channel: +2dB low shelf, -1dB high shelf

### Bug Fixes
- **Cmd+R randomize** — R keyboard shortcut was firing before browser reload, randomizing the session. Now blocked when Cmd/Ctrl held.
- **Session persistence** — save button now also updates autosave. Autosave runs every 3s (was 10s).
- **Filter drive connection** — filterDriveNode was never connected to the filter, causing silence on presets with drive > 0.
- **Worklet filter volume** — MOG/303 filters were 3x quieter than digital due to tanh compression. Gain-compensated.
- **Drum mute UI** — mute state now persists across view switches.
- **VU meter routing** — fixed after per-channel EQ insertion.
- **Step bar visibility** — bars were invisible because `accent + "b3"` is invalid CSS when accent is a CSS variable. Now uses `color-mix()`.
- **DrumKitEditor crash** — sample packs without all voice entries caused undefined access. Falls back to defaults.
- **Retrigger artifacts** — drift LFOs skipped on retrigger to prevent phase beating.
- **Hard sync** — slave phase now resets to 0 (was incorrectly offsetting).
- **Resonance scaling** — exponential mapping for worklet filters (Q=4 → 1.3, Q=20 → 4).
- **Update banner** — added dismiss button.

### Documentation
- Updated README with full feature set
- Chapter 7: Drum Voice Tuning — 808/909 reference methodology
- Chapter 8: Pattern Generation — format, pipeline, genre conventions
- Chapter 9: Sound Library — preset design, genre matching, sources
- Comprehensive inline comments on all drum synthesis, worklet algorithms, and tuning decisions

### Quality
- 34 automated sound quality regression tests (drum artifacts, level matching, synth clipping, preset counts)
- Run: `npx vitest run src/__tests__/sound-quality.test.ts`