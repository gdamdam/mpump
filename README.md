<h1 align="center">mpump</h1>
<p align="center"><strong>Browser groovebox. Drums, bass, synth, effects. Ready in seconds.</strong><br><br>Pick a genre, get a groove, make it yours, send it as a link.<br>Curated patterns across 15 genres. No install. No account. Free.</p>

<p align="center">
  <a href="https://github.com/gdamdam/mpump"><img src="https://img.shields.io/badge/version-1.3.5-blue" alt="Version"></a>
  <a href="https://github.com/gdamdam/mpump/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="License"></a>
  <br>
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/Web%20Audio-API-FF6600?logo=mozilla&logoColor=white" alt="Web Audio API">
  <img src="https://img.shields.io/badge/Web%20MIDI-API-FF6600?logo=midi&logoColor=white" alt="Web MIDI API">
  <br>
  <a href="https://mpump.live/">https://mpump.live/</a>
</p>

---

<p align="center">
  <img src="mpump-demo.gif" width="600" alt="mpump demo">
</p>

910 curated patterns across 15 genres. Built-in drums, bass, synth, 8 real-time effects, and an analog needle VU meter. All synthesized in the browser via Web Audio. No install. No account. No personal data.

Connect a USB MIDI device and it starts sequencing automatically. 50 devices recognized, hot-plug support, bar-locked transitions. USB MIDI requires Chrome, Edge, or Opera.

---

## Why mpump

I built mpump because I wanted to make music anywhere and share it instantly. Just a link. They open it, they hear the beat. Or better: they join and play with you, live.

Most music tools make you choose: too simple to be useful, or too complex to be fun. I wanted a groovebox that starts instantly, gives you a spark fast, and lets you share it, jam on it, or perform it for others.

No install, no account, no personal data. Your music stays on your device. Free forever.

---

## Table of Contents

- [Three Views](#three-views)
- [Audio Engine](#audio-engine)
- [Sound Presets](#sound-presets)
- [Features](#features)
- [DAW Sync](#daw-sync)
- [Pattern Library](#pattern-library)
- [Project Layout](#project-layout)
- [Privacy](#privacy)
- [License](#license)

---

## Three Views

| View | Description |
|---|---|
| **KAOS** | Performance XY pad (remappable axes), neon touch trails, chaos auto-randomizer, 8-effect rack with long-press editing |
| **SYNTH** | Full step-grid editor with drum/bass/synth sections, ADSR/filter/LFO controls, Euclidean rhythm generator, arpeggiator, scale lock |
| **MIXER** | Analog needle VU meter with dB readout and clip indicator, per-channel volume faders, mute buttons, activity LEDs, anti-clip limiter |

---

## Audio Engine

All sounds are synthesized in real-time via the Web Audio API. No sample files needed.

**Drums**: 808-style synthesized kit: kick, snare, closed hat, open hat, clap, cymbal. Per-voice tune, decay, and level. 7 built-in sample packs (CR-78, DMX, LinnDrum, TR-606, TR-707, TR-808, TR-909) plus custom WAV/MP3/OGG loading.

**Synth**: 4 waveforms (saw, square, sine, triangle), full ADSR envelope, 4 filter types (LPF, HPF, BPF, notch) with cutoff and resonance, sub-bass oscillator, detune, and LFO with tempo sync.

**Bass**: Independent bass sequencer on a separate channel. Same synth engine as the lead synth with dedicated presets.

**Effects**: 8 real-time effects in series: Delay, Distortion (with gain compensation), Reverb, Compressor, High-pass Filter, Chorus, Phaser, Bitcrusher.

**Anti-clip**: Brick-wall limiter (default on) prevents digital clipping. Optional hybrid mode adds a soft-clip stage. Toggleable from mixer or settings.

---

## Sound Presets

| Type | Count | Examples |
|---|---|---|
| Synth | 19 | Default, Classic Saw, Square Lead, Warm Pad, Acid Squelch, Digital Bell, Pluck Stab, Dark Drone, Shimmer, Screamer, Cosmic, Razor, Supersaw, Ethereal, House Stab, Trance Arp, EDM Pluck, Dub Chord, Neuro |
| Bass | 14 | Default, Deep Sub, Acid Bass, Square Bass, Pluck Bass, Warm Bass, Wobble, Distorted, Reese, Foghorn, Zapper, House Pump, Garage Bass, Trance Sub |
| Drum Kits | 15 | Default, Boom Box, DnB, Dub, Electro, Garage, Glitch, Heavy, House, Industrial, Lo-Fi, Minimal, mloop, Tight, Trance |
| Sample Packs | 7 | CR-78, DMX, LinnDrum, TR-606, TR-707, TR-808, TR-909 |

---

## Features

**Performance**
- 910 curated patterns across 15 genres (techno, acid-techno, trance, dub-techno, IDM, EDM, DnB, house, breakbeat, jungle, garage, ambient, glitch, electro, downtempo)
- Randomize all (MIX button) with 3-level undo history
- Swing/shuffle (50–75%)
- Tap tempo
- Arpeggiator (up, down, up-down, random) with rate control (1/4, 1/8, 1/16)
- Euclidean rhythm generator per drum voice (Bjorklund algorithm)
- Scale lock (major, minor, pentatonic, blues, dorian, mixolydian)
- Velocity humanize (subtle random variation)
- Duck (auto-duck bass/synth on kick hits)
- Metronome click track
- Gesture recording (record and loop XY pad movements)
- Configurable effect chain order (drag to reorder, activation order = chain position)
- Genre lock (★, restrict MIX to a single genre)
- MIX visual feedback (shake, flash, or both, configurable)
- 4 KAOS visualizers (mirrored bars, waveform glow, circular, spectrum)
- Waveform tap tempo (click the waveform bar to set BPM)
- Haptic feedback on mobile (Android)

**Editing**
- Tap-to-edit step grid with per-step semitone, velocity, and slide controls
- Pattern copy/paste across genres and devices
- Save edited patterns to EXTRAS genre
- Undo (Cmd+Z / Ctrl+Z)
- 16 or 32 step patterns

**Session**
- Full session export/import (JSON with patterns, sounds, effects, volumes, settings)
- Save/load presets (15 built-in including scene presets + user presets)
- Share link via URL (encodes BPM, genres, patterns, effects)
- Record to WAV
- Video recording with facecam overlay (beta, enable in Settings)

**Jam & Live Set**
- Live Jam: up to 4 peers, everyone controls the music together
- Live Set: 1 controller performs for up to 49 listeners
- WebSocket relay (no audio streaming, each browser synthesizes locally)
- Bar-sync quantize: mutes and effects snap to the beat
- XY pad movements visible across peers with trails
- Full state sync on join (genres, patterns, sounds, effects, volumes)

**Mixer**
- Analog needle VU meter with dB scale (-40 to +3), peak hold, clip indicator
- Independent volume for drums, synth, bass, and master
- Per-channel mute buttons and activity LEDs
- Anti-clip limiter with hybrid (beta) mode

**Interface**
- 6 color themes (Forest, Amber, Neon, Minimal, Cream, Rosé)
- Keyboard shortcuts (Space, R, Cmd+Z, arrows, 1-3 for view mode, ? for help)
- PWA with offline support and auto-update detection
- MIDI device connect button (no permission prompt on load)
- Responsive: works on desktop, tablet, and mobile

---

## DAW Sync

### MIDI Clock

mpump can sync to any DAW or hardware that sends MIDI clock. No downloads needed.

**Mac** (2 steps):
1. Open **Audio MIDI Setup** → double-click **IAC Driver** → check **Device is online**
2. In your DAW (e.g. Ableton Live) → Preferences → MIDI → enable **Sync** output on the IAC port

**Windows** (3 steps):
1. Download and install [loopMIDI](https://www.tobias-erichsen.de/software/loopmidi.html) (free) → create a virtual MIDI port
2. In your DAW → Preferences → MIDI → enable **Sync** output on the loopMIDI port

Then in mpump: **Settings → MIDI Clock In** (or use the **Setup Guide** button for step-by-step instructions).

Features: tick-driven stepping (6 ticks = 1 sixteenth note at 24 PPQN), Start/Stop/Continue transport control, rolling BPM display.

### Ableton Link

For wireless tempo sync with no cables and no MIDI setup, use the **[mpump Link Bridge](link-bridge/)** companion app.

1. **Download** `mpump Link Bridge` from the [releases page](https://github.com/gdamdam/mpump/releases) (~3 MB)
2. **Run it**: a small window shows tempo, peers, and connection status
3. **Open mpump.live**: it auto-detects the bridge (green dot ● appears next to the logo)
4. **Open Ableton Live** (or any Link-enabled app): tempo syncs automatically

No terminal, no configuration. Works with Ableton Live, Logic Pro, Bitwig, Traktor, djay, and hundreds of Link-enabled apps.

See [link-bridge/README.md](link-bridge/README.md) for build instructions and technical details.

---

## Pattern Library

| Source | Patterns | Genres | Notes |
|---|---|---|---|
| Melodic (S-1) | 310 | 15 | Semitone offsets, transposable via key/octave |
| Drums (T-8) | 300 | 15 | 6-voice drum hits per step |
| Bass (T-8) | 300 | 15 | Independent from drums |
| **Total** | **910** | **15** | |

Patterns are shared across all synth-mode and drums-mode devices. User-edited patterns are saved to the **EXTRAS** genre (localStorage).

---

## Project Layout

```
mpump/
  server/               # Browser sequencer (mpump.live)
    src/
      components/       # 45 React components
      engine/           # Web Audio synth + MIDI engine
      data/             # device registry, presets, patterns
      utils/            # MIDI export, session, storage
    public/             # static assets, SW, CNAME
  frontend/             # Lightweight React client (dev)
worker/                 # Cloudflare Worker for share link previews
link-bridge/            # Ableton Link companion app
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (React)                      │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                │
│  │  KAOS    │ │  SYNTH   │ │  MIXER   │                │
│  │  XY Pad  │ │  Editor  │ │  VU/Faders│                │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘                │
│       └─────────────┴────────────┘                      │
│                         │                                │
│                    ClientMessage                         │
│                         │                                │
│              ┌──────────▼──────────┐                     │
│              │      Engine.ts      │                     │
│              │  State + Sequencers │                     │
│              └──┬──────────────┬───┘                     │
│                 │              │                          │
│      ┌──────────▼───┐  ┌──────▼──────────┐               │
│      │  Sequencer   │  │  T8Sequencer    │               │
│      │  (synth/bass)│  │  (drums)        │               │
│      └──────┬───────┘  └──────┬──────────┘               │
│             └────────┬────────┘                          │
│                      │ noteOn/noteOff                    │
│           ┌──────────▼──────────┐                        │
│           │  AudioPort (Web Audio)                       │
│           │  OR                  │                        │
│           │  MidiPort (USB MIDI) │                        │
│           └──────────┬──────────┘                        │
│                      │                                   │
│    ┌─────────────────▼──────────────────┐                │
│    │  Channel Buses → Effects Chain →   │                │
│    │  Limiter → Analyser → Destination  │                │
│    └────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────┘
```

**Data flow:** UI components dispatch `ClientMessage` commands → `Engine` manages state and sequencers → Sequencers schedule notes via look-ahead (100ms) → `AudioPort` synthesizes sound (Web Audio) or `MidiPort` sends MIDI to hardware. State changes flow back via callbacks to React.

**Audio chain:** Voice → Channel Bus (per-instrument gain + analyser) → Master Gain → Effects Chain (8 effects in series) → Soft Clip (hybrid mode) → Limiter → Analyser → Destination.

**Pattern system:** 910 patterns stored as JSON. Melodic patterns are semitone offsets (transposable). Drum patterns are note/velocity arrays. Bass runs on a separate sequencer with independent genre/pattern selection.

---

## Privacy

mpump collects no personal data. No account. No tracking.

- **No cookies, no fingerprinting, no tracking IDs**
- **No third-party trackers**: no Google, no Facebook, no ad networks
- **Local storage only**: presets, settings, and patterns stay in your browser. Nothing is sent to any server
- **Anonymous counters**: page views and events (play, share) counted via [GoatCounter](https://goatcounter.com), a privacy-first, cookie-free analytics tool
- **Open source**: full codebase on [GitHub](https://github.com/gdamdam/mpump)

### Sharing

When you share a beat, the link contains only beat settings (BPM, genre, patterns, effects). No personal data, no user identifiers.

Share links pass through a lightweight stateless relay (`s.mpump.live`) that adds preview metadata so messaging apps can display a card. The relay logs nothing, stores nothing, sets no cookies. Only messaging app crawlers hit the relay; your browser is redirected straight to mpump. Open source in [`worker/`](worker/).

### Live Jam

Jam and Live Set sessions use a lightweight WebSocket relay for peer discovery and message passing. Mutes and effects can be bar-synced (quantized to beat boundaries) for tighter coordination.

**What flows through the relay:**
- Control data only (~50 bytes/msg): BPM, genre, pattern index, effect toggles, mute states, XY pad positions
- Ephemeral room IDs (random 6-char codes, exist only in memory)

**What does NOT flow through the relay:**
- No audio. Each browser synthesizes locally
- No user accounts, names, emails, or identifiers
- No IP addresses logged or stored
- No cookies or tokens
- No persistent data. Rooms vanish when empty

The relay runs on [Fly.io](https://fly.io) and is fully open source in [`worker/jam-relay/`](worker/jam-relay/).

### Hosting

mpump is hosted on [GitHub Pages](https://pages.github.com). 

The share relay runs on [Cloudflare Workers](https://workers.cloudflare.com). The jam relay runs on [Fly.io](https://fly.io).

---

Your music stays on your device. Always.

---

## License

[AGPL-3.0](LICENSE)

## Trademark

"mpump" is an unregistered trademark of the author.
Use of the name or logo for derivative projects or services may cause confusion and is not permitted.

---

Design, architecture, UX, audio chain, and creative direction by [gdamdam](https://github.com/gdamdam).
