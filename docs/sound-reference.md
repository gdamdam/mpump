# Sound Reference

Preset design rationale, drum tuning methodology, genre mix profiles, and pattern generation pipeline.

---

## Sound Design Philosophy

All sounds are 100% synthesized — no samples from the network. Everything generated in real-time via Web Audio API and AudioWorklet. Keeps the app instant and deterministic.

---

## Synth Presets (33)

### Categories

| Group | Count | Genre Focus | Character |
|-------|-------|-------------|-----------|
| **Leads** | 7 | Techno, Trance, EDM, Electro, Synthwave | Bright, sustained, melodic |
| **Keys** | 5 | House, IDM, Ambient, Lo-Fi | Bell-like, organ, Rhodes |
| **Pads** | 9 | Ambient, Dub-Techno, Trance, Deep House | Slow attack, warm, wide |
| **Plucks** | 4 | House, Trance, EDM | Fast decay, snappy |
| **Squelch** | 1 | Acid-Techno | High resonance, 303 filter model |
| **Aggressive** | 4 | DnB, Industrial, Techno | Distorted, driven |
| **Worklet** | 3 | Various | PWM, Sync, FM oscillators |

### Key Design Decisions

- **Acid Squelch → 303 filter**: Diode ladder with asymmetric clipping. Standard BiquadFilter can't self-oscillate the same way.
- **Screamer/Neuro → MOG filter**: Moog 4-pole ladder with tanh saturation for warm creamy overdrive.
- **Supersaw → 7-voice unison**: 7 detuned saws across stereo field, 30 cents spread.
- **Hoover → PWM + detune + unison**: PWM for buzz, heavy detune for width, MOG for warmth.
- **Rhodes → Wavetable organ**: Morph position 0.8 (mellow) + subtle pitch vibrato LFO.
- **Psy Bass → 20ms decay**: Saw with zero sustain — each 1/16 note is a sharp transient.

### Amplitude
`amp = (vel/127) * 0.2` — reduced from 0.3 to prevent sustained tones from overwhelming drums. Compensated by master +6 dB boost.

---

## Bass Presets (23)

| Preset | Target Genre | Why |
|--------|-------------|-----|
| Deep Sub | Deep House, Dub-Techno | Pure sine + sub — stays below kick |
| Acid Bass | Acid-Techno | 303 filter — the defining acid sound |
| 303 Acid | Acid-Techno, Chicago | Square wave variant, same filter |
| Reese | DnB, Jungle | Saw + heavy detune + LFO cutoff |
| Wobble | Dubstep | Saw + tempo-synced LFO cutoff |
| Arp Bass | Synthwave | Square + fast decay — octave bounce |
| Psy Bass | Psytrance | Saw + 20ms decay — rolling 1/16 |
| Jungle Bass | Jungle, Rave | PWM + detune + LFO — wild character |
| Warm Bass | Lo-Fi, Downtempo | Triangle, low cutoff — mellow |
| Garage Bass | UK Garage | Triangle + sub — smooth |
| UK Sub | UK Garage | Triangle, MOG filter, moderate resonance/drive, short decay |

Bass channel: HP at 50 Hz (kick owns sub below), LP at 3 kHz (synth owns highs), -4 dB mid cut at 300 Hz.

---

## Drum Kit Presets (15)

| Kit | Character | Key Tweaks |
|-----|-----------|------------|
| Default | Neutral, punchy | Kick decay 0.3, snare decay 0.4 |
| Boom Box | Heavy, boomy | Kick tune -5, decay 1.0, click 0.25 |
| DnB | Bright, punchy | Kick tune +4, decay 0.3, click 0.3 |
| Dub | Filtered, warm | All filterCutoff 0.55-0.7 |
| House | Balanced | Tight hats |
| Lo-Fi | Warm, muted | All filterCutoff 0.45-0.6 |
| Industrial | Extreme | Kick tune -10, decay 0.8, click 0.35 |
| Heavy | Dark, powerful | Kick tune -7, decay 0.8, click 0.2 |
| Glitch | High, short | All tune +8-12, decay 0.1-0.2 |
| Minimal | Bright clicks | Short decays, high tune |
| Trance | Bright, mid-decay | Kick tune +3, click 0.3 |
| Electro | Crisp, robotic | Kick tune -3, click 0.08 |
| Garage | Bouncy | Kick tune +1 |
| Tight | Tech house snap | Kick decay 0.2 |
| mloop | General purpose | Balanced |

### Machine Packs (7)

| Machine | Character | Kick decay | Key trait |
|---------|-----------|-----------|-----------|
| CR-78 | Vintage, warm | 0.3 | filterCutoff on all, muted |
| DMX | Electro snap | 0.3 | High click 0.25 |
| LinnDrum | Synth-pop clean | 0.3 | Moderate click |
| TR-606 | Acid minimal | 0.2 | Shortest kick, tune +3 |
| TR-707 | Italo house | 0.3 | Balanced, bright hats |
| TR-808 | Hip-hop boom | 0.3 | Low tune -2, deep sweep |
| TR-909 | Techno punch | 0.3 | High click 0.3, bright |

---

## Drum Tuning Methodology

Each voice tuned against Roland TR-808/909 reference samples.

### Process
1. Frequency analysis — zero-crossing counting at key time points
2. Level matching — peak and RMS comparison
3. Spectral peak identification — short-window analysis
4. Envelope profiling — attack time, decay to -20dB, total duration

### Kick Reference (808)
| Time | 808 freq | Synth freq |
|------|----------|------------|
| 0ms | 200 Hz | 215 Hz |
| 5ms | 100 Hz | 175 Hz |
| 20ms | 75 Hz | 105 Hz |
| 50ms | 50 Hz | 61 Hz |
| 100ms | 50 Hz | 51 Hz |

### Decay Philosophy
At 128 BPM: beat = 469ms, 1/8 note = 234ms. Default kick decay 0.3 = 180ms (under 1/8 note). Longer only for: Boom Box (1.0), Dub/Heavy/Industrial (0.8).

### Artifacts Fixed

| Issue | Cause | Fix |
|-------|-------|-----|
| Kick "boom...click" | DC offset click | Broadband burst (2kHz + 5kHz) |
| Body second peak | Envelope 110% | Two-part envelope |
| End-of-buffer click | Buffer cutoff | 5ms fade-out on ALL voices |
| Onset ramp artifact | 2ms linear ramp | Removed — buffers start from sin(0)=0 |
| DC offset clicks | Standalone pulse | Noise-multiplied transients |
| Hat harshness | Buffer levels too hot | Reduced ~40% |
| Cowbell piercing | Bandpass Q=8 | Reduced to Q=4 |

---

## Mix Scenes (10)

| Scene | Low | Mid | High | Drive | Width | Low Cut | MB | Character |
|-------|-----|-----|------|-------|-------|---------|-----|-----------|
| Neutral | 0 | 0 | 0 | 0 | 50% | 0 | 0.25 | Flat |
| Punchy | +2 | -2 | +2 | 0 | 60% | 35 | 0.30 | Tight kick |
| Warm | +2 | -1 | +1 | 0 | 65% | 25 | 0.30 | Smooth |
| Airy | +1 | -1 | +3 | 0 | 70% | 25 | 0.35 | Wide, bright |
| Tight | +1 | -2 | +2 | 0 | 55% | 35 | 0.35 | Controlled |
| Heavy | +3 | -1 | +2 | +1 | 50% | 20 | 0.35 | Deep sub |
| Mellow | +1 | -1 | -1 | 0 | 65% | 0 | 0.15 | Dark, soft |
| Spacious | +1 | -1 | +2 | -1 | 80% | 20 | 0.10 | Very wide |
| Crisp | +1 | -1 | +3 | +1 | 55% | 30 | 0.30 | Bright |
| Loud | +2 | -1 | +2 | +1 | 65% | 25 | 0.40 | Full |

---

## Genre Mix Profiles

Research from Sound on Sound, Attack Magazine, iZotope, MusicRadar, DJ TechTools.

### Sidechain Quick Reference

| Strength | GR | Ratio | Genres |
|----------|-----|-------|--------|
| Subtle | 2–3 dB | 2:1 | Lo-fi, ambient, garage |
| Moderate | 4–6 dB | 3:1–4:1 | House, DnB, dub techno |
| Strong | 6–10 dB | 4:1–8:1 | Techno, acid, dubstep |
| Extreme | 10–25 dB | 8:1–inf | EDM drops, trance drops |

Attack always fast (≤1 ms). Release tuned to beat rhythm.

### Per-Genre EQ & Mix Targets

**Techno**: Kick dominant. Bass sub LP at 80 Hz, body 98 Hz–1 kHz. Synth HP at 150–200 Hz. Sidechain 6–10 dB. Boost kick 70–90 Hz, cut 180 Hz, +2–3 dB at 3–4 kHz. Bass mono, percussive top widened.

**House / Deep House**: Kick wins low end, bass starts at ~100 Hz. Sidechain 6–8 dB (drops), 3 dB (deep). Bass boost 150–500 Hz for warmth. Deep house: warm low-mid 200–400 Hz.

**Trance / Psytrance**: Strong pump 8–12 dB on synths/pads. Air boost 8–13 kHz for "shine". Bass boost at 1 kHz + 3 kHz. Supersaws very wide.

**DnB / Jungle**: Bass co-dominant (0 to -2 dB vs kick). Sidechain 4–6 dB, fast attack ≤1ms. Reese bass 80–500 Hz. Parallel compression on breaks (8:1+, 25 dB GR).

**Dubstep**: Sub bass at 30–60 Hz, kick at 80–120 Hz (separate bands). Multiband sidechain 8–12 dB. Wobble bass 100–500 Hz with resonant LP/BP sweep.

**Ambient / Dub Techno**: Kick supportive, not dominant. Sidechain subtle 2–4 dB. BP filter with cutoff automation for dub character. All width from delays/reverbs.

**Acid Techno**: Acid line at 100 Hz–2 kHz (mid-range, not sub). Sidechain 6–10 dB. Filter sweep IS the mix movement.

**IDM / Glitch**: No fixed rules. Sub mono. Processing chain > mix levels. Bitcrushing creates its own spectral character.

**Electro / Breakbeat**: 808 body kick at 50–80 Hz. Breaks: harmonic exciter at 3–8 kHz (better than EQ boosts), layer 909 under break.

**Lo-fi / Downtempo**: LP at 8–12 kHz + tape saturation. Sidechain 0–3 dB. Boost 80–100 Hz "tape bump". Fold pads to mono/narrow.

**Synthwave**: Retain treble on synths (unlike lo-fi). 3-voice chorus on pads. Bass boost 200–400 Hz. Subtle sidechain 3–6 dB.

**Garage / 2-Step**: Avoid heavy sidechain (fights groove). Sub bass swung with beat. Boost kick 80 Hz, bass 60–80 Hz.

**EDM**: Extreme sidechain 10–15 dB on drops. Bass/808 mono below 120 Hz. Everything else max width. Mix with master limiter in mind.

### Universal Rule
Everything below ~120 Hz should be mono. Preserves low-end power on mono playback systems (clubs, phones, Bluetooth).

---

## Pattern Generation

### Data Format
Melodic: `{ semi, vel, slide }` or `null`. Drums: array of `{ note, vel }` per step. 16-step grids.

### Pipeline
```
Python scripts (hand-written)  →  JSON files  →  Browser loads at startup
  N(semi, vel, slide)              patterns-s1.json
  H(note, vel)                     patterns-t8-drums.json
  R = None                         patterns-t8-bass.json
                                   catalog.json (names + descriptions)
```

Scripts: `scripts/generate_new_patterns.py` (15 genres, ~910), `scripts/generate_new_genres.py` (5 genres, ~300).

### Per-Genre Conventions

| Genre | BPM | Drum Style | Bass Style | Synth Style |
|-------|-----|-----------|-----------|-------------|
| Techno | 130 | 4-on-floor, 1/16 hats | Root + minor intervals | Driving |
| Acid | 138 | Same + 303 slides | Chromatic, filter sweeps | — |
| Trance | 140 | 4-on-floor | Higher register | Arpeggiated triads |
| House | 124 | Clap on 2+4, offbeat OH | Walking | Organ stabs |
| DnB | 174 | Breakbeat syncopation | Reese + LFO | Fast arps |
| Dubstep | 140 | Half-time (snare on 3) | Wobble | Sparse |
| Lo-Fi | 80 | Boom-bap | Jazzy walking | Rhodes chords |
| Synthwave | 118 | 80s gated | Octave bounce | Ascending arps |
| Psytrance | 145 | Every beat | KBBB (kick+3 bass) | Acid-style |

### Counts

| Pool | Original 15 | +5 genres | Total |
|------|------------|-----------|-------|
| Synth | 310 | 100 | 410 |
| Drums | 300 | ~97 | ~397 |
| Bass | 300 | 100 | 400 |
| **Total** | **910** | **~297** | **~1207** |
