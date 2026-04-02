# mpump Documentation

Technical guides for understanding how mpump works under the hood.

## Chapters

1. **[The Interface](01-interface.md)** — How the three UI modes work, keyboard shortcuts, settings, and how the pieces fit together
2. **[The Sound Engine](02-sound-engine.md)** — How sounds are synthesized, scheduled, and mixed using the Web Audio API
3. **[Patterns & Devices](03-patterns-and-devices.md)** — The genre system, pattern data format, compilation pipeline, and 50-device MIDI registry
4. **[Sharing & Sessions](04-sharing-and-sessions.md)** — Share link encoding, Cloudflare Worker previews, session persistence, and localStorage schema
5. **[Advanced Features](05-advanced-features.md)** — Arpeggiator, sidechain duck, pattern chain, humanize, recording, custom samples, scale lock, and QWERTY keyboard playing
6. **[Live Jam](06-live-jam.md)** — Real-time jam sessions, Live Set mode, WebSocket relay, bar-sync quantize, and listener reactions
7. **[Drum Voice Tuning](07-drum-tuning.md)** — How drum voices were tuned against Roland TR-808/909 reference samples, Fletcher-Munson compensation, mix balance
8. **[Pattern Generation](08-pattern-generation.md)** — How the 1210+ patterns across 20 genres were created, compiled, and structured
9. **[Sound Library](09-sound-library.md)** — How 33 synth, 22 bass, 15 drum kit, and 7 machine presets were designed and matched to genres
10. **[Engine Stability](10-engine-stability.md)** — Audio node lifecycle, known pitfalls, and the stability rules that keep the audio thread healthy
11. **[Genre Mix Profiles](genre-mix-profiles.md)** — Research-backed mix profiles for 13 genre families with EQ, sidechain, width, and level targets
