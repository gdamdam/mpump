# AudioWorklet GC Isolation Research

**Question:** Does Chrome's garbage collector pause the AudioWorklet thread when collecting on the main thread?

**Short answer:** No. The AudioWorklet thread has its own V8 isolate with its own heap and GC. Main-thread GC does not pause the AudioWorklet thread. However, the AudioWorklet thread's *own* GC can still cause glitches if you allocate inside `process()`.

---

## 1. AudioWorklet Thread Model

AudioWorklet runs on a **separate OS-level thread**, not on the main thread.

- In Chrome, when an AudioWorklet is activated, all Web Audio rendering moves from the `AudioOutputDevice` thread to a dedicated **AudioWorkletThread** ([Chromium platform-architecture-dev discussion, Aug 2020](https://groups.google.com/a/chromium.org/g/platform-architecture-dev/c/sxpZizgpDFM)).
- The AudioWorkletThread runs with **real-time priority** (when spawned from a top-level document with a real-time AudioContext) — see [crbug.com/813825](https://bugs.chromium.org/p/chromium/issues/detail?id=813825).
- User JavaScript in `AudioWorkletProcessor.process()` executes on this audio rendering thread, alongside native AudioNode processing. It does **not** hop to the main thread — this is the key design advantage over the deprecated ScriptProcessorNode ([Chrome blog: Audio Worklet](https://developer.chrome.com/blog/audio-worklet)).
- Since 2020, Chromium uses **per-AudioContext thread instantiation** — each AudioContext with an AudioWorklet gets its own thread, rather than sharing a singleton thread per frame.

**Source:** [Hongchan Choi's thread model change proposal](https://groups.google.com/a/chromium.org/g/platform-architecture-dev/c/sxpZizgpDFM/m/6X0jJTg9AwAJ), [Chrome AudioWorklet announcement](https://developer.chrome.com/blog/audio-worklet)

---

## 2. V8 GC and AudioWorklet: Separate Isolates

This is the critical finding:

> "An isolate is a concept of an instance in V8. In Blink, **isolates and threads are in 1:1 relationship**. One isolate is associated with the main thread. One isolate is associated with one worker thread."
>
> — [Chromium V8 Binding Design Doc](https://chromium.googlesource.com/chromium/src/+/master/third_party/blink/renderer/bindings/core/v8/V8BindingDesign.md)

Each V8 isolate has its **own heap and its own garbage collector**. This means:

### Main-thread GC does NOT pause AudioWorklet
- **Minor GC (Scavenge):** Pauses only the isolate it belongs to. The main-thread scavenger pauses the main thread; the AudioWorklet's scavenger pauses the AudioWorklet thread. They are independent.
- **Major GC (Mark-Sweep/Mark-Compact):** Same principle. The main thread's major GC (even a stop-the-world phase) only stops the main thread's isolate. The AudioWorklet thread continues running unaffected.
- V8's Orinoco GC uses parallel, incremental, and concurrent techniques, but all of these operate per-isolate ([V8 blog: Trash Talk](https://v8.dev/blog/trash-talk)).

### AudioWorklet's OWN GC can cause glitches
The AudioWorklet thread has its own V8 isolate, which means it has its own GC. If your `process()` method allocates objects (creating arrays, objects, closures, string concatenation), those allocations go into the AudioWorklet isolate's young generation. When that young generation fills up, the AudioWorklet's own scavenger runs — and **that** pauses the audio thread.

At 44.1kHz with 128-sample render quanta, you have a **~2.9ms budget** per callback. Even a minor GC pause of 0.5-1ms on the audio thread can cause audible glitches.

---

## 3. Real-World Evidence

### Chromium bug reports
- [crbug.com/825823](https://bugs.chromium.org/p/chromium/issues/detail?id=825823) — "Glitches from irregular callback timing" in AudioWorklet
- [crbug.com/813825](https://bugs.chromium.org/p/chromium/issues/detail?id=813825) — The RT priority thread effort specifically to reduce audio glitches
- [crbug.com/1055728](https://bugs.chromium.org/p/chromium/issues/detail?id=1055728) — AudioWorklet playback glitches with ReadableStream

### Blog post: Real-time audio on low-end Android
From [engineering.videocall.rs](https://engineering.videocall.rs/posts/how-to-make-javascript-audio-not-suck/):
> "On low-end devices, GC pauses and extra CPU cost made the audio thread miss its deadline, causing buffer overruns."

Their fix: pre-allocate everything, zero allocations in `process()`, use `TypedArray.set()` for bulk copies. This confirms the GC that matters is the **audio thread's own GC**, not the main thread's.

### Emscripten WASM Audio Worklets
From [Emscripten docs](https://emscripten.org/docs/api_reference/wasm_audio_worklets.html):
> "The runtime has been carefully developed to guarantee that **no temporary JavaScript level VM garbage will be generated**, eliminating the possibility of GC pauses from impacting audio synthesis performance."

This is talking about avoiding GC on the audio thread itself — further confirming the isolate separation.

---

## 4. postMessage Overhead

From [Surma's postMessage benchmark](https://surma.dev/things/is-postmessage-slow/):

- **Small objects** (like `{type: "noteOn", note: 60, vel: 100}` — ~50 bytes JSON): The structured clone cost is **negligible**, well under 0.1ms. Surma's research shows overhead only becomes visible above ~100KB payloads.
- The serialization blocks the **sending** realm (main thread), and deserialization blocks the **receiving** realm (AudioWorklet thread). Chrome and Safari defer deserialization until `.data` is accessed.
- For a noteOn/noteOff message, you're looking at **microseconds** of overhead — completely safe.
- **Important:** The `port.onmessage` handler in the AudioWorklet does NOT run during `process()`. It runs between render quanta, in the AudioWorklet thread's event loop. So message handling does not interrupt audio rendering.

### Alternative: SharedArrayBuffer + Atomics
For high-frequency data (parameter changes every frame), Chrome's AudioWorklet design pattern guide recommends SharedArrayBuffer with Atomics for zero-copy communication. But for infrequent note events, `port.postMessage()` is perfectly adequate.

**Source:** [Chrome AudioWorklet Design Patterns](https://developer.chrome.com/blog/audio-worklet-design-pattern/)

---

## 5. Best Practices from Audio Frameworks

### Tone.js
- Uses native AudioNodes (OscillatorNode, GainNode) rather than a single AudioWorklet for synthesis
- Recommends adjusting `latencyHint` to `"playback"` for sustained audio
- Schedules events ahead of time via the Transport
- [Performance wiki](https://github.com/Tonejs/Tone.js/wiki/Performance)

### FAUST
- Compiles DSP to **WebAssembly**, runs WASM inside AudioWorkletProcessor
- WASM execution generates zero JS garbage — all memory is in the WASM linear memory
- This is the gold standard for avoiding GC on the audio thread
- [faustwasm on GitHub](https://github.com/grame-cncm/faustwasm)

### Chrome's official guidance (Hongchan Choi)
The [AudioWorklet Design Pattern](https://developer.chrome.com/blog/audio-worklet-design-pattern/) article recommends three tiers:
1. **Simple:** AudioWorkletProcessor with careful JS (no allocations in `process()`)
2. **Better:** WASM inside AudioWorkletProcessor (no JS GC pressure at all)
3. **Maximum:** WASM + SharedArrayBuffer + Worker (heavy DSP in a Worker, AudioWorklet just reads SAB)

### General rules for `process()`
1. **Never allocate** in `process()` — no `new`, no array literals, no object creation, no string ops
2. **Pre-allocate** all buffers and state in the constructor
3. **No closures** created per-call
4. **Avoid `%` (modulo)** — use branch-based wrapping instead
5. **Use TypedArray.set()** for bulk copies (maps to memcpy)
6. **No I/O** — no console.log, no postMessage from within process()

---

## 6. Implications for mpump

### The good news
Moving to a single AudioWorklet processor for polyphonic synth is architecturally sound:
- Main-thread GC from React/DOM/Canvas will **NOT** cause audio glitches
- `port.postMessage({type: "noteOn", note, vel})` from main thread is cheap (microseconds)
- You get sample-accurate timing control within the AudioWorklet

### The risk to manage
- Any JS allocations inside `process()` trigger GC on the audio thread's own isolate
- For a polyphonic synth doing voice allocation, envelope calculation, and oscillator mixing — you must pre-allocate voice slots, envelope state arrays, and output buffers
- If voice count is dynamic, pre-allocate a fixed maximum voice pool

### Recommended approach for mpump
1. **Use AudioWorkletProcessor with pure JS** (not WASM) — for the complexity level of a groovebox synth, careful zero-allocation JS is sufficient
2. **Pre-allocate a voice pool** (e.g., 8 or 16 voices) with all state in typed arrays
3. **Use `port.postMessage()`** for note events — the cost is negligible
4. **Use AudioParam** for continuous parameters (filter cutoff, etc.) — these are native and GC-free
5. **Consider SharedArrayBuffer** only if you need to send high-frequency data (e.g., sequencer step data every frame) — overkill for note events

---

## Sources

1. [Chromium V8 Binding Design Doc](https://chromium.googlesource.com/chromium/src/+/master/third_party/blink/renderer/bindings/core/v8/V8BindingDesign.md) — isolate-per-thread confirmation
2. [AudioWorklet Thread Model Change](https://groups.google.com/a/chromium.org/g/platform-architecture-dev/c/sxpZizgpDFM) — RT thread, per-context instantiation
3. [V8 Blog: Trash Talk (Orinoco GC)](https://v8.dev/blog/trash-talk) — GC architecture, per-isolate operation
4. [Chrome: Audio Worklet Design Patterns](https://developer.chrome.com/blog/audio-worklet-design-pattern/) — SAB, WASM, messaging patterns
5. [Chrome: AudioWorklet Announcement](https://developer.chrome.com/blog/audio-worklet) — thread model overview
6. [Surma: Is postMessage slow?](https://surma.dev/things/is-postmessage-slow/) — structured clone benchmarks
7. [Real-time Audio on Low-End Android](https://engineering.videocall.rs/posts/how-to-make-javascript-audio-not-suck/) — GC avoidance in practice
8. [Emscripten WASM Audio Worklets](https://emscripten.org/docs/api_reference/wasm_audio_worklets.html) — zero-GC WASM approach
9. [crbug.com/813825](https://bugs.chromium.org/p/chromium/issues/detail?id=813825) — RT priority thread for AudioWorklet
10. [Tone.js Performance Wiki](https://github.com/Tonejs/Tone.js/wiki/Performance) — latencyHint, scheduling
