# Chapter 9: Sound Library & Genre-Matched Presets

How mpump's 33 synth, 22 bass, 15 drum kit presets, and 7 machine packs were designed, and how each sound was matched to its genre.

## Sound Design Philosophy

mpump's sounds are 100% synthesized — no samples loaded from the network. Every sound is generated in real-time via the Web Audio API and AudioWorklet processors. This keeps the app instant (no download wait) and deterministic (same sound everywhere).

## Synth Presets (33)

### How Sounds Were Matched to Genres

Each preset has a `genres` tag listing which electronic music genres it's designed for. These were determined by:

1. **Production convention** — what synthesizers and sounds define each genre historically
2. **Frequency spectrum** — what frequency range the genre emphasizes
3. **Envelope character** — whether the genre uses sustained pads, short stabs, or plucked sounds
4. **Filter behavior** — whether resonance, filter envelope, or drive are important

### Preset Categories

| Group | Count | Genre Focus | Sound Character |
|-------|-------|-------------|-----------------|
| **Leads** | 7 | Techno, Trance, EDM, Electro, Synthwave | Bright, sustained, melodic |
| **Keys** | 5 | House, IDM, Ambient, Lo-Fi | Bell-like, organ, Rhodes |
| **Pads** | 9 | Ambient, Dub-Techno, Trance, Deep House | Slow attack, warm, wide |
| **Plucks** | 4 | House, Trance, EDM | Fast decay, snappy, rhythmic |
| **Squelch** | 1 | Acid-Techno | High resonance, filter envelope, 303 model |
| **Aggressive** | 4 | DnB, Industrial, Techno | Distorted, driven, loud |
| **Worklet** | 3 | Various | PWM, Sync, FM oscillator types |

### Key Sound Decisions

**Acid Squelch → 303 filter model:** The TB-303's distinctive squelch comes from its diode ladder filter with asymmetric clipping. We use the `filterModel: "303"` AudioWorklet to replicate this — standard BiquadFilter can't self-oscillate the same way.

**Screamer/Neuro → MOG filter model:** Moog-style 4-pole ladder with tanh saturation gives the warm, creamy overdrive characteristic of aggressive techno and neurofunk bass.

**Supersaw → 7-voice unison:** The classic trance supersaw uses multiple detuned sawtooth oscillators. Our unison engine spreads 7 voices across the stereo field with configurable detune (30 cents spread).

**Hoover → PWM + detune + unison:** The hoover sound (jungle/rave staple) uses pulse width modulation for the buzzy character, heavy detune for width, and the MOG filter for warmth.

**Rhodes Keys → Wavetable organ morph:** Real Rhodes pianos use tine + tonebar hammering. We approximate this with the wavetable organ preset morphed to position 0.8 (mellow registration) with subtle pitch vibrato LFO.

**Psy Bass → Ultra-fast decay:** Psytrance rolling basslines need notes that are essentially "clicks" — saw oscillator with 20ms decay, zero sustain. Each 1/16 note is a sharp transient, not a sustained tone.

### Synth amplitude

Synth/bass voices use `amp = (vel/127) * 0.2` — reduced from the typical 0.3 to prevent sustained tones from overwhelming transient drums in the mix. This is compensated by the master boost (+6 dB).

## Bass Presets (23)

### Genre Matching

| Preset | Target Genre | Why This Sound |
|--------|-------------|----------------|
| Deep Sub | Deep House, Dub-Techno | Pure sine + sub — stays below kick, doesn't compete |
| Acid Bass | Acid-Techno | 303 filter model — the defining sound of acid |
| 303 Acid | Acid-Techno, Chicago | Square wave variant — different character, same filter |
| Reese | DnB, Jungle | Saw + heavy detune + LFO on cutoff — the Reese bass sound |
| Wobble | Dubstep | Saw + tempo-synced LFO on cutoff — the classic wobble |
| Arp Bass | Synthwave | Square + fast decay — octave bounce (New Order style) |
| Psy Bass | Psytrance | Saw + 20ms decay — rolling 1/16 note bass |
| Jungle Bass | Jungle, Rave | PWM + detune + LFO — unstable, wild character |
| Warm Bass | Lo-Fi, Downtempo | Triangle, low cutoff — mellow and rounded |
| Garage Bass | UK Garage | Triangle + sub — smooth, not aggressive |
| UK Sub | UK Garage, Bass Music | Warm raspy sub — triangle osc, MOG filter with moderate resonance and drive, short decay for rhythmic punch |

### Bass channel processing

Bass channel has HP at 50 Hz (kick owns sub below that), LP at 3 kHz (synth owns highs above that), and -4 dB mid cut at 300 Hz. This frequency separation prevents kick/bass mud.

## Drum Kit Presets (15)

Each drum kit preset overrides the default voice parameters (tune, decay, level, click, noiseMix, color, filterCutoff) to create a genre-appropriate kit character.

| Kit | Character | Key Tweaks |
|-----|-----------|------------|
| Default | Neutral, punchy | Kick: decay 0.3, snare: decay 0.4 |
| Boom Box | Heavy, boomy | Kick: tune -5, decay 1.0, click 0.25 |
| DnB | Bright, punchy | Kick: tune +4, decay 0.3, click 0.3 |
| Dub | Filtered, warm | All: filterCutoff 0.55-0.7, low levels |
| House | Balanced | Kick: decay 0.3, tight hats |
| Lo-Fi | Warm, muted | All: filterCutoff 0.45-0.6, soft levels |
| Industrial | Extreme | Kick: tune -10, decay 0.8, click 0.35 |
| Heavy | Dark, powerful | Kick: tune -7, decay 0.8, click 0.2 |
| Glitch | High-pitched, short | All: tune +8-12, decay 0.1-0.2 |
| Minimal | Bright clicks | All: short decays, high tune |
| Trance | Bright, mid-decay | Kick: tune +3, click 0.3 |
| Electro | Crisp, robotic | Kick: tune -3, click 0.08 |
| Garage | Bouncy | Kick: tune +1, snare: light |
| Tight | Tech house snap | Kick: decay 0.2, all tight |
| mloop | General purpose | Balanced across all voices |

## Machine Packs (7)

Synthesized drum kits modeled after classic drum machines. Same synthesis engine as presets, with voice parameters tuned to match the character of each machine.

| Machine | Character | Kick decay | Key trait |
|---------|-----------|-----------|-----------|
| CR-78 | Vintage, warm | 0.3 | filterCutoff on all voices, muted character |
| DMX | Electro snap | 0.3 | High click (0.25), tight |
| LinnDrum | Synth-pop clean | 0.3 | Moderate click, clean |
| TR-606 | Acid minimal | 0.2 | Shortest kick, high tune (+3) |
| TR-707 | Italo house | 0.3 | Balanced, bright hats |
| TR-808 | Hip-hop boom | 0.3 | Low tune (-2), deep sweep |
| TR-909 | Techno punch | 0.3 | High click (0.3), bright |

All machines default to tight kick decays (0.2-0.3). Users can adjust decay via the KIT editor (range 0.1-2.0, step 0.1).

## 808/909 Reference Tuning

All drum voices were tuned against Roland TR-808 and TR-909 reference samples. See [Chapter 7: Drum Voice Tuning](07-drum-tuning.md) for the full methodology, Fletcher-Munson compensation, and frequency separation.

## Mix Scenes (10)

Character-based (not genre-named) so users don't feel locked to a specific genre:

| Scene | Low | Mid | High | Drive | Width | Low Cut | MB Amt | Character |
|-------|-----|-----|------|-------|-------|---------|--------|-----------|
| Neutral | 0 | 0 | 0 | 0 | 50% | 0 | 0.25 | Flat, no coloring |
| Punchy | +2 | -2 | +2 | 0 | 60% | 35 | 0.30 | Tight kick, clear mids |
| Warm | +2 | -1 | +1 | 0 | 65% | 25 | 0.30 | Smooth, round |
| Airy | +1 | -1 | +3 | 0 | 70% | 25 | 0.35 | Wide, bright, open |
| Tight | +1 | -2 | +2 | 0 | 55% | 35 | 0.35 | Controlled, clean |
| Heavy | +3 | -1 | +2 | +1 | 50% | 20 | 0.35 | Deep sub, weight |
| Mellow | +1 | -1 | -1 | 0 | 65% | 0 | 0.15 | Dark, soft, relaxed |
| Spacious | +1 | -1 | +2 | -1 | 80% | 20 | 0.10 | Very wide, minimal |
| Crisp | +1 | -1 | +3 | +1 | 55% | 30 | 0.30 | Bright, defined |
| Loud | +2 | -1 | +2 | +1 | 65% | 25 | 0.40 | Full, compressed |

See [Genre Mix Profiles](genre-mix-profiles.md) for the research behind these values.

## Sources

Sound design conventions researched from:

- Studio Brootle
- Native Instruments Blog
- Baby Audio
- Evosounds
- Attack Magazine
- Mixed In Key
- Synthwave Pro
- UJAM Tutorials
- EDMProd
- Sound on Sound
- iZotope Learn
- Huovilainen (2007) — DAFx conference paper on Moog ladder filter digital implementation
