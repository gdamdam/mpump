# Sound Design Reference for Browser Groovebox Preset Tuning

## 1. Bass Sound Design by Genre

### Techno
- **Oscillators**: Sine/triangle for sub, saw for mid-bass. PWM on square for thickness.
- **Filter**: LP 24dB, cutoff 200-400 Hz, resonance at ~100 Hz for thump. Filter envelope: attack 0ms, decay 50-200ms, low sustain.
- **Envelope**: Attack 0-10ms, decay 50-300ms, sustain 0-30%, release 100-200ms. Snappy and punchy.
- **Rumble bass**: Reverbed kick, LP filtered ~150 Hz, sidechained. Not traditional synthesis.

### House / Deep House
- **Oscillators**: Triangle + square (pitched up 7 semitones for bass-lead hybrid). Pluck character.
- **Filter**: LP with envelope-controlled cutoff opening upward. Deep house: longer filter attack for "rounded" quality.
- **Envelope**: Plucky -- attack 0ms, decay 100-300ms, sustain 0-20%, release 50-150ms.
- **Key trait**: Mono voice, legato off. Korg M1-style pluck is the archetype.

### Trance
- **Oscillators**: Saw wave, sometimes layered with sub sine.
- **Filter**: LP, mid cutoff ~300-600 Hz, moderate resonance. Filter envelope with medium decay.
- **Envelope**: Attack 3-5ms (slight softness), decay 200-500ms, sustain 40-60%, release 200ms.

### Drum & Bass / Jungle
- **Reese bass** (see section 4). Two detuned saws, LP filtered 150-650 Hz.
- **Neuro bass**: FM synthesis (saw modulating sine), LP 24dB dirty, LFO on filter cutoff synced to tempo. Distortion 15dB+.
- **Sub layer**: Pure sine, mono, separate from mid-bass processing.

### Garage / UKG
- **Oscillators**: Saw or triangle, 2-voice with slight detune (~10 cents).
- **Filter**: LP ~400-800 Hz, gentle resonance. Warm but not aggressive.
- **Envelope**: Medium pluck, decay 150-300ms. Bouncy feel.

### Electro
- **Oscillators**: Square/pulse wave, PWM for movement.
- **Filter**: LP/BP, aggressive resonance 40-60%, cutoff swept 200-1000 Hz.
- **Envelope**: Punchy attack, decay 100-200ms. Often with pitch envelope (fast downward sweep ~19 semitones, 5-10ms).

### Dub Techno
- **Oscillators**: Sine or triangle. Minimal harmonics.
- **Filter**: LP, cutoff 100-300 Hz. Very little resonance. Warm and round.
- **Envelope**: Slow attack 10-30ms, long release 300-500ms. Soft, pad-like sustain.
- **Effects**: Chorus/delay essential for the washy character.

### Ambient
- **Oscillators**: Sine, triangle, or soft saw. Often layered.
- **Filter**: LP, cutoff 200-500 Hz, LFO modulation at 0.1-0.5 Hz for slow movement.
- **Envelope**: Long attack 50-200ms, high sustain, long release 500ms-2s.

### Breakbeat
- **Oscillators**: Saw or square, 1-2 voices.
- **Filter**: LP/BP, cutoff 300-600 Hz. Moderate resonance.
- **Envelope**: Punchy, attack 0-5ms, decay 100-250ms. Syncopation-friendly short notes.

### Acid Techno
- See section 3 (303 acid). Saw or square through resonant 18dB LP filter.

### Synthwave
- **Oscillators**: Wavetable or saw, pitched down 3 octaves. Phase modulation via LFO at keytrack rate for metallic character.
- **Filter**: LP with plucky envelope (fast decay). Cutoff automated over time.
- **Envelope**: Plucky with sidechain-style pumping (1/4 note LFO on amplitude).

## 2. Synth Lead/Pad Characteristics by Genre

### Trance -- Supersaw
- **Oscillators**: 3 saw oscillators, each with 7-9 voice unison. Total effective voices: 21-27.
- **Detuning**: 10-50 cents between unison voices. Start at ~25 cents. Too much = out of tune, too little = thin.
- **Filter**: HPF to remove mud (~150-200 Hz), optional LP at 8-12 kHz to tame harshness.
- **Envelope**: Sharp attack ~5ms, decay to 60-70% sustain, long release 300-500ms.
- **Effects**: Chorus, reverb (long tail, cut high-end), delay.
- **Noise layer**: High-passed white noise blended in for air.

### Techno -- PWM / Minimal Leads
- **Oscillators**: Square wave with pulse width modulation (LFO at 1-4 Hz, depth 20-40%).
- **Filter**: LP or BP, cutoff 500-2000 Hz, resonance 20-40%.
- **Envelope**: Short pluck for stabs (decay 50-150ms) or sustained for drones.
- **Key trait**: Sparse, functional. Often monophonic.

### House -- FM Stabs
- **Oscillators**: FM synthesis -- sine carrier modulated by sine/saw. Ratio 1:1 or 1:2 for classic stab.
- **Filter**: LP ~2-4 kHz, slight resonance.
- **Envelope**: Short stab -- attack 0ms, decay 80-200ms, sustain 0%.
- **Effects**: Reverb (plate or room), chorus for width.

### DnB -- Pads
- **Oscillators**: Saw or wavetable, 4-8 unison voices, moderate detune ~15-25 cents.
- **Filter**: LP 1-3 kHz with slow LFO modulation (0.1-0.3 Hz).
- **Envelope**: Slow attack 100-300ms, high sustain, long release 1-2s.

### Ambient -- Evolving Pads
- **Oscillators**: Wavetable with position modulated by slow LFO. Multiple layers.
- **Filter**: LP/BP with very slow LFO (0.05-0.2 Hz), cutoff 500-3000 Hz.
- **Envelope**: Attack 500ms-2s, sustain 80-100%, release 2-5s.
- **Effects**: Heavy reverb, granular delay.

### Synthwave -- Leads
- **Oscillators**: Saw or square, 2-4 voices with ~10-15 cents detune.
- **Filter**: LP 1-3 kHz, moderate resonance ~25%.
- **Envelope**: Medium attack 10-30ms, high sustain, moderate release 200-400ms.
- **Effects**: Chorus (essential), delay (1/8 note), reverb.

## 3. Acid Bass/Lead (303)

### Architecture
- **Oscillators**: Single oscillator, saw OR square wave (switchable, not blended).
- **Filter**: 18dB/octave lowpass (unique -- not 12dB or 24dB). Does NOT self-oscillate, which is why resonance is often maxed.
- **Distortion**: Post-filter saturation is essential to the bark/squelch. Soft clipping character.

### Critical Parameters
- **Filter cutoff range**: At 50% knob, playing C1 (65 Hz), resonant peak lands ~500 Hz. Full range sweeps roughly 100 Hz to 5 kHz.
- **Resonance**: High -- 60-100%. The 18dB slope means resonance doesn't whistle/self-oscillate even at max. This is THE defining character.
- **Envelope attack**: ~3ms (fixed, very fast).
- **Envelope decay**: 200ms (accented notes, fixed) to 2000ms (non-accented, variable via Decay knob). Start at 200-400ms for typical acid.
- **Filter envelope amount (Env Mod)**: Controls how far the filter opens. 50-80% for squelchy acid. Lower for darker tones.
- **Accent**: Simultaneously increases amplitude AND filter envelope depth on marked notes. Makes specific notes louder and brighter -- essential for the "wow" character.
- **Slide (glide)**: Portamento between notes, ~60ms glide time. Creates the liquid, singing quality. Only activates on legato (overlapping) notes.

### Implementation Notes for Browser Synth
- Use 18dB filter if possible (chain a 6dB with a 12dB, or use a custom coefficient). If only 12dB/24dB available, 24dB with reduced resonance is closer than 12dB.
- Accent should boost filter env amount by ~30-50% AND amplitude by ~3-6 dB simultaneously.
- Slide should be per-note, not global portamento.
- Distortion AFTER filter is critical. Waveshaper or tanh saturation.

## 4. Reese Bass

### Architecture
- **Oscillators**: 2 sawtooth oscillators (minimum). Can also use 1 oscillator with 8 unison voices.
- **Detuning**: +/- 0.15 to 0.30 semitones (15-30 cents) for classic throb. +/- 0.15 = mellow/slow beating. +/- 0.30 = standard. +/- 0.50 = aggressive/fast. Or: 8 unison voices at ~22% detune amount.
- **Waveform**: Sawtooth is canonical. Triangle or wavetable for softer variants.

### Filter
- **Type**: LP 24dB.
- **Cutoff**: 150-650 Hz depending on context. Jungle classic: ~650 Hz with 14% resonance. Darker: 150-200 Hz.
- **Movement**: Slow LFO or manual automation on cutoff for sweep. Notch filter sweep adds secondary movement.

### Processing
- **Mono below ~150 Hz**: Split sub and mid-bass. Sub in mono, mid can be stereo.
- **Distortion/overdrive**: After filter for aggressive variants (neurofunk, darkstep).
- **Unison stereo spread**: Use carefully -- too much stereo in low end causes phase cancellation on mono systems.
- **Polyphony**: Mono (monophonic) with legato/glide.

## 5. Sub Bass

### Waveform
- **Sine wave**: The standard. Pure fundamental, no harmonics. Clean, powerful, predictable.
- **Triangle wave**: Slight harmonics (odd only), adds presence without mud. Good when sine disappears on small speakers.
- **Shaped sine**: Sine with mild saturation to add 2nd/3rd harmonic for audibility on small speakers.

### Filter
- **LP at 80-120 Hz**: Remove anything above the fundamental region.
- **No resonance**: Clean and flat. Resonance causes level inconsistency.
- **Optional gentle HP at 20-30 Hz**: Remove inaudible sub-lows that waste headroom.

### Envelope
- **Attack**: 0-5ms. Fast but not clicking (avoid zero if DC offset causes click).
- **Decay**: N/A (sustain-based).
- **Sustain**: 100%. Sub should be consistent while note is held.
- **Release**: 20-50ms. Short but not instant (avoid click).

### Mono Behavior
- **Always mono**. Stereo sub causes phase cancellation, especially on club systems.
- **No detuning**: Even 1-2 cents of detune causes beating/level fluctuation in sub range.
- **No chorus/stereo effects** on sub layer.
- **Frequency range**: C1-C2 (32-65 Hz) is the sweet spot. Below C1 becomes felt, not heard.

## 6. Browser Audio / Web Audio API Constraints

### AudioWorklet
- **Block size**: Fixed 128 samples. Cannot be changed. At 44.1 kHz = ~2.9ms latency per block.
- **Thread**: Runs on dedicated audio thread, NOT main thread. But shares process with all audio nodes.
- **WASM**: Rust/C++ compiled to WebAssembly inside AudioWorklet is near-native performance. This is the recommended approach for quality synthesis.

### Practical Limitations
- **Polyphony budget**: 8-16 voices realistic on mid-range hardware without WASM. With WASM, 64-256 voices feasible.
- **Filter quality**: Built-in BiquadFilterNode is decent but only offers 12dB/oct (2-pole). For 18dB or 24dB, must cascade or implement in AudioWorklet.
- **Oscillator aliasing**: Built-in OscillatorNode uses anti-aliased wavetables (good quality). Custom oscillators in AudioWorklet need band-limited synthesis (PolyBLEP) to avoid aliasing.
- **Sample rate**: Usually 44100 or 48000 Hz, browser-dependent. Can request via AudioContext constructor.
- **Buffer underruns**: Main thread contention (CSS parsing, GC, layout) can cause glitches. Keep audio processing OFF main thread.
- **Mobile**: Significantly less headroom. 128-sample block causes distortion on some mobile browsers. iOS requires user gesture to start AudioContext.

### Tradeoffs That Matter for This Project
- **18dB filter for acid**: Must be custom (cascade 6dB + 12dB BiquadFilters, or implement in worklet).
- **Supersaw unison**: Each unison voice = separate oscillator. 7 voices x 3 oscillators = 21 OscillatorNodes per note. Budget carefully.
- **Envelope precision**: Built-in `linearRampToValueAtTime` / `exponentialRampToValueAtTime` are sample-accurate. Use these over manual per-block calculation.
- **Detune**: OscillatorNode.detune is in cents, maps directly to reese/supersaw parameters. Use AudioParam automation for smooth changes.
- **Distortion**: WaveShaperNode with custom curve (tanh or polynomial) for post-filter saturation. Oversample: '2x' or '4x' to reduce aliasing from nonlinear processing.
- **Latency**: Total round-trip (input to output) is typically 20-50ms in browsers. Acceptable for sequencer playback, problematic for live input.
