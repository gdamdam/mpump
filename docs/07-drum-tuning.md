# Chapter 7: Drum Voice Tuning & Mix Balance

How mpump's synthesized drum voices were tuned against Roland TR-808 and TR-909 reference samples, and how the mix balance was achieved using psychoacoustic compensation.

## Reference Samples

| Source | Location | Format |
|--------|----------|--------|
| Roland TR-808 | `SAMPLES/Roland TR808/Roland TR808/` | 16-bit WAV, 44.1 kHz |
| 909 From Mars | `SAMPLES/909 From Mars/01. Clean Kit/` | 24-bit WAV, 44.1 kHz |

Additional kits analyzed for cross-reference: CR-78, DMX, LinnDrum, TR-505, TR-606, TR-707.

## Methodology

For each drum voice:

1. **Frequency analysis** — measured instantaneous frequency at key time points using zero-crossing counting
2. **Level matching** — compared peak and RMS levels between synth output and 808 samples
3. **Spectral peak identification** — found dominant frequency bands using short-window analysis
4. **Envelope profiling** — measured attack time, decay time (to -20dB), and total duration

## Results per Voice

### Kick (BD)

**808 reference profile:**
| Time | 808 freq | Synth freq |
|------|----------|------------|
| 0ms | 200 Hz | 215 Hz |
| 5ms | 100 Hz | 175 Hz |
| 10ms | 100 Hz | 145 Hz |
| 20ms | 75 Hz | 105 Hz |
| 50ms | 50 Hz | 61 Hz |
| 100ms | 50 Hz | 51 Hz |

**Synthesis:** `baseF=45Hz`, sweep 80-250Hz. Two-part body envelope: fast attack (`exp(-t*200)` weight 0.55) + slow tail (`exp(-t*(5/decay))` weight 0.12), overall multiplier 0.95. Sub oscillator at 50Hz with matched decay. Click: broadband burst (2kHz + 5kHz) with fast `exp(-t*2000)` decay.

**Default decay:** 0.3 (180ms buffer). At 128 BPM this is well under 1/8 note (234ms) — industry standard for punchy electronic kicks.

### Snare (SD)

**808 reference:** Dominated by noise at ~3.8 kHz, body tone at ~185 Hz.

**Synthesis:** Wire resonance bandpass at 3800 Hz (Q=3). Pitch envelope on body (280 → 185 Hz). Level scaling 1.0 (raised from 0.7 to match 808 RMS). Body decay 18 (slowed from 25 for ~148ms audible ring, closer to real 808 ~180ms).

### Closed Hat (CH)

**808 reference:** Dominant frequency ~7.5 kHz.

**Synthesis:** 6 inharmonic partials centered around 7.5 kHz: 3500, 4100, 5200, 6300, 7500, 8800 Hz. Buffer levels reduced ~40% from initial values to sit behind kick in the mix. Sharp transient burst (<1ms).

### Open Hat (OH)

Same partial structure as CH with longer decay and higher noise level. Tune offset -1 semitone across all presets for slightly darker character.

### Rimshot (RS)

**808 reference:** ~1600 Hz early → 924 Hz settled. Very short (16ms).

**Synthesis:** Two pitched components at 920 + 1600 Hz (levels 0.3 + 0.2). Noise at 0.15. Duration 40ms.

### Cowbell (CB)

**808 reference:** ~840-900 Hz dominant. Uses 545 + 815 Hz square waves (actual 808 circuit values).

**Synthesis:** Original 808 frequencies (545 + 815 Hz). Bandpass resonance at 800 Hz (Q=4). Square wave levels at 0.22.

### Clap (CP)

**808 reference:** ~3.2 kHz dominant, multiple hand-spread bursts.

**Synthesis:** 4 randomized micro-bursts with staggered timing (0, 10, 22, 33ms offsets). Noise-based with envelope shaping.

### Crash (CY)

**909 reference:** ~5.6 kHz average, ~7.9 kHz early.

**Synthesis:** 5 inharmonic partials: 3200, 5000, 6800, 8500, 11000 Hz. Per-partial decay rates for natural shimmer.

### Ride (RD)

**909 reference:** Bell-like with harmonics from low-mid to high.

**Synthesis:** 6 partials spanning 392–8500 Hz (392, 1200, 2800, 4600, 6200, 8500) for proper bell character. Stick transient and subtle noise layer.

## Fletcher-Munson Compensation

Human hearing is most sensitive at 2-5 kHz. A 4 kHz sound at 60 dB SPL is perceived as loud as a 50 Hz sound at ~80 dB SPL — roughly a 20 dB difference. Without compensation, hats and cymbals dominate the kick in perceived loudness even at lower amplitude.

### Per-voice playback gain

Applied at playback time in `playDrum` to compensate for equal-loudness contours:

| Voice | Note | Gain | Rationale |
|-------|------|------|-----------|
| Kick | 36 | 2.5 | Low frequency needs most boost |
| Snare | 38 | 1.1 | Mid-range body but high-freq wire sizzle |
| Closed Hat | 42 | 0.9 | Ear-sensitive range, reduce |
| Open Hat | 46 | 0.8 | Same, slightly less energy |
| Tom | 47 | 1.5 | Mid-range |
| Crash | 49 | 0.7 | Brightest, most ear-sensitive |
| Clap | 50 | 0.9 | Noise-based, 1-5 kHz range |
| Ride | 51 | 0.8 | High partials |
| Rimshot | 37 | 1.0 | Mid-high |
| Cowbell | 56 | 0.8 | Mid-high |

The net effect: kick is ~13 dB louder than hats in the output, matching the 6-10 dB gap professional producers use (plus extra to compensate for Fletcher-Munson at moderate listening levels).

## Channel EQ & Frequency Separation

Each instrument channel has built-in EQ and filtering to prevent frequency overlap:

| Channel | HP filter | Low shelf | Mid cut | High shelf |
|---------|-----------|-----------|---------|------------|
| Drums (ch 9) | none | +4 dB @ 80 Hz | none | -1 dB @ 5 kHz |
| Bass (ch 1) | 50 Hz | 0 dB | -4 dB @ 300 Hz | -1 dB @ 5 kHz |
| Synth (ch 0) | 40 Hz | 0 dB | -1.5 dB @ 300 Hz | 0 dB |

**Bass also has a 3 kHz LP filter** — bass doesn't need high harmonics, they just clash with synth.

**Sidechain duck** is ON by default (depth 0.5) — bass and synth duck 50% on every kick hit, creating space in the low end.

**Master EQ:** +1 dB low shelf @ 150 Hz, -2 dB mid @ 350 Hz (mud cut safety net), 0 dB high.

## Decay Tuning Philosophy

At 128 BPM, one beat = 469ms, one 1/8 note = 234ms. Industry standard: kick should last less than 1/8 note.

**Default kick decay 0.3** = 180ms buffer. Most machines and presets use this.

Longer decays only for genres that need them:
- Boom Box: 1.0 (hip-hop boom)
- Dub/Heavy/Industrial: 0.8 (spacey/heavy character)

All other drum voices follow similar tightening — snares, claps, open hats all reduced to prevent bleed into subsequent hits.

## Artifacts Fixed During Tuning

| Issue | Cause | Fix |
|-------|-------|-----|
| Kick "boom...click" | DC offset click component | Replaced with broadband burst (2kHz + 5kHz sine) |
| Kick body second peak | Envelope 110% of first peak | Two-part envelope (fast attack + slow tail) |
| End-of-buffer click | Buffer cuts off while signal audible | 5ms fade-out on ALL voices via `applyFadeOut` |
| Missing fade-out on preset change | `setDrumVoice` didn't call fade-out | Added `applyFadeOut` to `setDrumVoice` |
| Onset gain ramp artifact | 2ms linear ramp softened transient + created click at ramp end | Removed ramp — buffers start from sin(0)=0 |
| DC offset clicks in tom, rimshot, cowbell | Standalone DC pulse from envelope | Replaced with noise-multiplied transients |
| Hat/cymbal harshness | Buffer levels too hot vs kick | Reduced buffer levels ~40%, FM gain compensation |
| Cowbell piercing | Bandpass Q=8 too resonant | Reduced to Q=4 |

## AudioWorklet Bitcrusher

The bitcrusher effect was upgraded from a WaveShaperNode quantization hack to a true AudioWorklet with sample-and-hold plus triangular PDF dithering. This produces authentic aliasing artifacts instead of just amplitude quantization.
