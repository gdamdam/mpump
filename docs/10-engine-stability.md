# Chapter 10: Engine Stability

How the Web Audio engine stays healthy during extended interactive use. These rules were developed through debugging progressive audio degradation, crackling, and complete audio death during real-world usage.

## The Problem

mpump is designed to be played continuously — users click MIX, drag the KAOS pad, switch presets, toggle mute/solo, and change effects all while music plays. Each interaction creates, modifies, or destroys audio nodes. Without careful lifecycle management, the audio thread accumulates orphaned nodes and stale automation events until Chrome's audio renderer crashes.

## Core Stability Rules

### 1. Always cancelScheduledValues before setTargetAtTime

Every `setTargetAtTime`, `linearRampToValueAtTime`, or `setValueAtTime` call adds an event to the AudioParam's automation timeline. Without cancellation, these accumulate indefinitely.

**Rule:** Every setter that uses AudioParam automation must call `cancelScheduledValues(now)` first. This applies to: channel volume, channel EQ, master volume, drive, width, pan, low cut, and sidechain duck.

### 2. Never use restartDevice for mute/solo

`restartDevice` tears down the entire sequencer (`clearInterval` + `allNotesOff`) and rebuilds it (`setInterval` + schedule first bar). Use `hotSwapPatterns` instead — it replaces the pattern data array without touching the sequencer timing.

**Exception:** `restartDevice` is still needed for operations that change sequencer structure: `setKey`, `setOctave`, `setPatternLength`, `randomizeDevice`, `loadPreset`.

### 3. Guard schedule() with running check

Both `Sequencer.schedule()` and `T8Sequencer.schedule()` are called from `setInterval`. After `stop()` clears the interval, one final callback may still fire (it was queued before `clearInterval`). Without a `if (!this.running) return` guard at the top of `schedule()`, this ghost callback plays notes on a torn-down or replaced port.

### 4. Debounce rebuildFxChain

`rebuildFxChain` disconnects the master output, tears down all effect nodes, and rebuilds the chain. It's called by `setEffect` and `setEffectOrder`.

- Effect toggle (on/off): rebuild immediately
- Parameter change (knob adjustment): debounce 150ms
- BPM change with synced delay: debounce 100ms

This prevents rapid UI interaction (KAOS pad, effect sliders) from firing dozens of chain rebuilds per second.

### 5. Track and limit active drum sources

Each drum hit creates 3 nodes (BufferSourceNode + GainNode + StereoPannerNode). At 128 BPM with ~6 hits per 1/16 note, that's ~50 node-creates/sec. The `onended` callback disconnects them, but if it's delayed, nodes pile up.

**Rule:** Track active drum sources in a Set. Cap at 16 — kill oldest 4 when exceeded.

### 6. Limit synth polyphony to 16 voices

The `voices` Map has no natural cap. Fast patterns with many distinct notes can accumulate voices if `noteOff` doesn't fire in time. Kill the oldest voice when the map exceeds 16 entries.

### 7. Kill stale voices in heartbeat

The 1-second heartbeat timer (originally just for AudioContext resume) also checks for stuck voices older than 5 seconds and kills them. This catches edge cases where `onended` never fires.

### 8. setSynthParams: only kill voices on model change

`setSynthParams` is called from the KAOS pad at up to 20fps for cutoff/resonance changes. If it kills all voices on every call, the sequencer creates new ones on the next step — hundreds of stop/start cycles per second.

**Rule:** Only kill voices when `filterModel` or `oscType` changes (incompatible node types). For parameter-only changes (cutoff, resonance, filterType), update existing voices' AudioParams in-place.

**Fast path:** Skip voice iteration entirely if cutoff, resonance, and filterType haven't changed.

### 9. Throttle KAOS pad commands

The KAOS XY pad fires on every mouse/touch move. Even with requestAnimationFrame limiting, this can be 60+ events/sec. Each event sends `set_synth_params` to 2-3 devices.

**Rule:** Throttle to 50ms (20fps). Don't send `filterOn`/`filterType` overrides on every drag — only send the changed parameter (cutoff or resonance).

### 10. Clean up everything on close()

`AudioPort.close()` must clean up:
- All active synth voices (stop + disconnect)
- All active drum sources (stop)
- All trance gate intervals (clearInterval + stop LFOs)
- FX rebuild debounce timer (clearTimeout)
- Heartbeat interval (clearInterval)
- Event listeners (pointerdown, keydown, visibilitychange)

Missing any of these causes intervals to fire on a closed AudioContext.

### 11. Throttle restartDevice

`restartDevice` is protected by a 50ms per-device throttle. If the same device is restarted within 50ms, the second call is ignored. This prevents cascading restarts from rapid UI clicks.

### 12. Flush denormals in worklet filters

The poly-synth worklet's state-variable filter can produce denormalized floats (values near zero that are expensive to process). All filter state variables (`_low`, `_high`, `_band`, `_notch`) are flushed each block:

```javascript
if (Math.abs(v) < 1e-15) v = 0;
```

Without this, a silent filter can consume 10–50× more CPU than an active one. The same flushing is applied to the filter envelope and the side-channel 1-pole lowpass filter.

### 13. Voice steal click prevention

When the worklet steals the oldest voice to make room for a new one, the stolen voice's gain is ramped to zero over ~2ms (64 samples at 48 kHz) before being reclaimed. Without this micro-fade, voice stealing produces audible clicks, especially on sustained pads.

### 14. Effect node leak prevention

Effect chain rebuilds (`rebuildFxChain`) must fully disconnect all nodes from the previous chain before creating new ones. Previously, rapid effect toggling could leave orphaned nodes connected to the audio graph. The rebuild now tracks all created nodes and disconnects them at the start of the next rebuild.

### 15. Retrigger click fix

When a note-on arrives for a note that is already sounding (same channel + same MIDI note), the worklet fades out the existing voice before starting the new one. This prevents the phase discontinuity click that occurs when an oscillator restarts at a different phase.

### 16. Connect before disconnect (glitch-free topology changes)

When rewiring the audio graph (e.g., toggling channel mono, switching FX exclusion routing), connect the new path first, then disconnect the old path after a 5ms delay. This prevents momentary silence during the transition.

## Audio Node Lifecycle Summary

| Node type | Created by | Cleaned up by |
|-----------|-----------|---------------|
| Drum BufferSource + Gain + Pan | `playDrum` | `src.onended` callback |
| Synth Oscillator + Gain + Filter | `playSynth` | `disconnectVoice` via `oscs[0].onended` |
| Filter drive Gain (driveComp) | `playSynth` | Pushed to `pwmExtras`, cleaned by `disconnectVoice` |
| Effect chain nodes | `rebuildFxChain` | Disconnected at start of next rebuild |
| Trance gate LFO + smoother | `setChannelGate` | Teardown at start of next `setChannelGate` call (Web Audio path) |
| Trance gate (worklet) | `gate_pattern` message | Lives inside poly-synth worklet, no node cleanup needed |
| Duck (worklet) | `duck` / `duck_params` message | Lives inside poly-synth worklet, no node cleanup needed |
| FX bypass GainNodes | `updateDrumsBypassFx` / `updateSynthBassBypassFx` | Lives for AudioPort lifetime |
| Channel bus + EQ + filters | `getChannelBus` (lazy) | Never — lives for AudioPort lifetime |
| Master EQ + compressor + limiter | Constructor | Lives for AudioPort lifetime |

## Debugging Audio Issues

If audio degrades or crashes:

1. **Chrome DevTools → Performance tab** — record while reproducing, look for long audio thread tasks
2. **`chrome://media-internals`** — check AudioContext state and node count
3. **Console** — `[AudioPort] AudioContext is closed` means unrecoverable crash
4. **Common causes:** rapid KAOS pad + effect toggles, mute/solo spam, preset switching during playback
