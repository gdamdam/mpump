<h1 align="center">mpump</h1>
<p align="center"><strong>Make a beat. Send a link. Let someone change it.</strong><br><br>A browser drum machine and synth where the beat lives in the link.<br>Open it, change it, send it back different.<br>No install. No account. Free.</p>

<p align="center">
  <a href="https://mpump.live/">https://mpump.live/</a>
</p>

---

<p align="center">
  <img src="mpump-demo.gif?v=1.8.5" width="600" alt="mpump demo">
</p>

You make a groove, send the link, and the other person opens it in their browser — same beat, same sounds. They change it and send it back different. Or they join live and you play together.

It starts fast and sounds good.

No install, no account, no personal data. Your stuff stays in your browser. Free forever.

<p align="center">
  <a href="https://github.com/gdamdam/mpump"><img src="https://img.shields.io/badge/version-1.8.5-blue" alt="Version"></a>
  <a href="https://github.com/gdamdam/mpump/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="License"></a>
  <img src="https://img.shields.io/badge/Web%20Audio-API-FF6600" alt="Web Audio API">
  <img src="https://img.shields.io/badge/AudioWorklet-DSP-FF6600" alt="AudioWorklet">
</p>

---

## What you can do

- **Make a groove in seconds** — hit MIX and a beat is already playing. Drums, bass, synth, effects.
- **Send it as a link** — share the URL. The other person opens it and hears exactly what you made.
- **Let them change it** — they can tweak the beat, switch genres, change sounds, and send it back different.
- **Play together live** — start a Jam session with up to 4 friends, or a Live Set for up to 49 listeners.
- **Go deep if you want** — 20 genres, 1210+ patterns, step editor, arpeggiator, effects chain, mixer with EQ and compression.

No install. No account. Works offline. Your stuff stays in your browser.

---

## Table of Contents

- [Three Views](#three-views)
- [Audio Engine](#audio-engine)
- [Sound Presets](#sound-presets)
- [Features](#features)
- [Song Mode](#song-mode)
- [DAW Sync](#daw-sync)
- [Pattern Library](#pattern-library)
- [Project Layout](#project-layout)
- [Privacy](#privacy)
- [License](#license)

---

## Three Views

| View | Description |
|---|---|
| **KAOS** | Performance XY pad (remappable axes), neon touch trails, chaos auto-randomizer, 10-effect rack with long-press editing |
| **SYNTH** | Full step-grid editor with drum/bass/synth sections, ADSR/filter/LFO controls, Euclidean rhythm generator, arpeggiator, scale lock |
| **MIXER** | Console with per-channel faders, EQ, pan, mute/solo, clip LEDs. Master EQ, multiband compressor, stereo width, low cut, drive (ON/OFF toggle), trance gate. Mix scenes (10 profiles: Neutral, Punchy, Warm, Airy, Tight, Heavy, Mellow, Spacious, Crisp, Loud + user saves) |

---

## Audio Engine

All sounds are synthesized in real-time via the Web Audio API. No sample files needed.

**Drums**: 808/909-tuned synthesized kit — all 9 voices (kick, snare, CH, OH, clap, rimshot, cowbell, crash, ride) level-matched to Roland TR-808 reference samples. Per-voice tune, decay, level, and tone shaping. 7 built-in sample packs (CR-78, DMX, LinnDrum, TR-606, TR-707, TR-808, TR-909) plus custom WAV/MP3/OGG loading.

**Synth**: AudioWorklet poly-synth engine — zero-allocation voice synthesis running entirely on the audio thread. 8 waveforms — SAW, SQR, SIN, TRI, PWM (pulse width modulation), SYNC (hard sync), FM (2-operator frequency modulation), WTB (wavetable with 5 morph tables). Full ADSR envelope, 3 filter models: DIG (standard), MOG (4-pole Moog ladder via AudioWorklet), 303 (diode ladder). 4 filter types (LPF, HPF, BPF, notch) with cutoff, resonance, envelope depth, and drive. Sub-bass oscillator, unison (1–7 voices), detune, analog drift, and LFO with tempo sync. Per-channel trance gate and sidechain duck run inside the worklet for sample-accurate timing.

**Bass**: Independent bass sequencer on a separate channel. Same synth engine as the lead synth with dedicated presets. Trance gate (tempo-synced volume chopper) per channel with 8 numbered presets, 5 stutter presets, and custom editable patterns.

**Effects**: 10 real-time effects with reorderable chain: Delay (stereo ping-pong, tempo sync), Distortion (asymmetric soft-clip), Reverb (4 types: room/hall/plate/spring), Compressor, Duck (sidechain), Chorus (3-voice + feedback), Phaser (6-stage), Bitcrusher (AudioWorklet), Flanger, Tremolo. Per-channel FX exclusion — bypass drums, bass, or synth from reverb, delay, and duck via dedicated routing nodes.

**Master**: 3-band multiband compressor (adjustable amount), stereo widening (Haas effect on high band), low-cut filter, drive, 3-band EQ. Per-channel 3-band EQ for drums/bass/synth. Anti-clip limiter with hybrid soft-clip mode.

**QWERTY Keyboard**: DAW-style piano layout — A–L = white keys (C to D), W–O = black keys, Z/X = octave down/up, C/V = velocity down/up. Works on drums, bass, and synth. Hold mode sustains notes; step record writes notes into the pattern.

---

## Sound Presets

| Type | Count | Examples |
|---|---|---|
| Synth | 33 | Classic Saw, Acid Squelch (303 filter), Supersaw, PWM Pad, Sync Lead, FM Bell, FM Metallic, Wavetable Pad, Organ, Hoover, Vocal Pad, Gritty PWM, Neuro (MOG filter), Screamer, Sync Sweep, and more |
| Bass | 26 | Acid Bass (303 filter), Deep Sub, Reese (MOG filter), 303 Acid, FM Bass, PWM Bass, Jungle Bass, Sync Bass, Dub Bass, Wobble, UK Sub, and more |
| Drum Kits | 16 | Default, Boom Box, DnB, Dub, Electro, Garage, Glitch, Heavy, House, Industrial, Lo-Fi, Minimal, mloop, Tight, Trance, and more |
| Mix Scenes | 10 | Neutral, Punchy, Warm, Airy, Tight, Heavy, Mellow, Spacious, Crisp, Loud |
| Sample Packs | 7 | CR-78, DMX, LinnDrum, TR-606, TR-707, TR-808, TR-909 |

---

## Features

**Performance**
- 1210+ curated patterns across 20 genres (techno, acid-techno, trance, dub-techno, IDM, EDM, DnB, house, breakbeat, jungle, garage, ambient, glitch, electro, downtempo, dubstep, lo-fi, synthwave, deep-house, psytrance)
- Randomize all (MIX button) with 3-level undo history
- Swing/shuffle (50–75%)
- Tap tempo
- Arpeggiator (up, down, up-down, random) with rate control (1/4, 1/8, 1/16)
- Euclidean rhythm generator per drum voice (Bjorklund algorithm)
- Scale lock (major, minor, pentatonic, blues, dorian, mixolydian)
- Velocity humanize (subtle random variation)
- Duck (auto-duck bass/synth on kick hits, per-channel exclusion, worklet-based for synth/bass)
- Metronome click track
- Gesture recording (record and loop XY pad movements)
- Configurable effect chain order (drag to reorder, activation order = chain position)
- Genre lock (lock icon, restrict MIX to a single genre)
- MIX visual feedback (shake, flash, or both, configurable)
- 4 KAOS visualizers (mirrored bars, waveform glow, circular, spectrum)
- Haptic feedback on mobile (Android)

**Editing**
- Tap-to-edit step grid with per-step semitone, velocity, and slide controls
- Pattern copy/paste across genres and devices
- Save edited patterns to EXTRAS genre
- Undo (Cmd+Z / Ctrl+Z)
- 16 or 32 step patterns

**Session**
- Full session export/import (JSON with patterns, sounds, effects, volumes, settings)
- Save/load grooves (20 built-in + user grooves for quick genre/pattern combos)
- Share link via short URL (`s.mpump.live/{id}`) with full offline fallback
- Remix lineage — shared beats track their parent; one-tap remix share when you change something
- Record to WAV

**Jam & Live Set**
- Live Jam: up to 4 peers, everyone controls the music together
- Live Set: 1 controller performs for up to 49 listeners
- WebSocket relay (no audio streaming, each browser synthesizes locally)
- Bar-sync quantize: mutes and effects snap to the beat
- XY pad movements visible across peers with trails
- Full state sync on join (genres, patterns, sounds, effects, volumes)

**Mixer**
- Independent volume for drums, synth, bass, and master
- Per-channel mute, solo, pan, mono buttons and activity LEDs
- Per-channel 3-band EQ (low shelf 200 Hz, mid peak 1 kHz, high shelf 5 kHz, ±12 dB)
- Per-channel trance gate (synth/bass only) — tempo-synced volume chopper with 8 numbered presets, 5 stutter presets (BDUP, TRIP, STUT, BKBT, GLTC), and custom editable 16-step patterns. Runs inside the AudioWorklet for sample-accurate gating
- 3-band multiband compressor with adjustable amount (0–100%)
- Stereo width control (0–100%) via Haas effect on high band
- Low-cut filter (0–200 Hz) for phone/laptop speakers
- Drive/saturation (-6 to +12 dB) with ON/OFF toggle, default +1 dB
- Mix scenes: 10 built-in profiles (Neutral, Punchy, Warm, etc.) + save/load user scenes. Auto mode applies a genre-optimized profile; ★ badges highlight matching scenes for the current genre
- Anti-clip limiter with hybrid soft-clip mode

**Interface**
- 6 color themes (Forest, Amber, Neon, Minimal, Cream, Rosé)
- Keyboard shortcuts (Space, R, arrows for navigation, M/S/L for mute/solo/lock, B for BPM, Tab to cycle views, 1-3 for view mode, ? for help)
- QWERTY keyboard playing (⌨ button per instrument, A–L white keys, W–O black keys, Z/X octave, C/V velocity)
- PWA with offline support and auto-update detection
- MIDI device connect button (no permission prompt on load)
- Responsive: works on desktop, tablet, and mobile

## Song Mode

- Capture scenes (snapshot of patterns, sounds, mixer, BPM) and arrange them into a song
- Horizontal arrangement strip with progress bar and configurable bar counts (1/2/4/8/16/32) per scene
- 4 transition types between scenes: instant cut, volume crossfade, filter sweep, drum breakdown
- Loop the arrangement or play once through
- Sound changes use release-tail crossfade — old notes finish naturally, new notes use the new preset
- Save/load songs to browser storage (+Save / Songs buttons)
- Share songs as links (⤴ button in song strip)
- Enable via ⋯ more menu

---

## DAW Sync

### Ableton Link

For wireless tempo sync with no cables and no MIDI setup, use the **[mpump Link Bridge](link-bridge/)** companion app.

1. **Download** `mpump Link Bridge` from the [releases page](https://github.com/gdamdam/mpump/releases) (~3 MB)
2. **Run it**: a small window shows tempo, peers, and connection status
3. **Open mpump.live**: enable Link in Settings → Sync section (green dot ● appears next to the logo when connected)
4. **Open Ableton Live** (or any Link-enabled app): tempo syncs automatically

No terminal, no configuration. Works with Ableton Live, Logic Pro, Bitwig, Traktor, djay, and hundreds of Link-enabled apps.

See [link-bridge/README.md](link-bridge/README.md) for build instructions and technical details.

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

---

## Pattern Library

| Source | Patterns | Genres | Notes |
|---|---|---|---|
| Melodic (S-1) | 410 | 20 | Semitone offsets, transposable via key/octave |
| Drums (T-8) | 400 | 20 | 9-voice drum hits per step |
| Bass (T-8) | 400 | 20 | Independent from drums |
| **Total** | **1210+** | **20** | |

Patterns are shared across all synth-mode and drums-mode devices. User-edited patterns are saved to the **EXTRAS** genre (localStorage).

---

## Project Layout

```
mpump/
  server/               # Browser sequencer (mpump.live)
    src/
      components/       # React components
      engine/           # Web Audio synth + MIDI engine
      data/             # device registry, presets, patterns
      hooks/            # useEngine, useKeyboard, etc.
      utils/            # MIDI export, session, storage
    public/
      worklets/         # AudioWorklet processors (poly-synth, MOG filter, 303, bitcrusher, sync/FM/wavetable oscs)
      data/             # pre-compiled pattern JSON
  frontend/             # Lightweight React client (dev)
worker/                 # Cloudflare Worker for share link previews
link-bridge/            # Ableton Link companion app
docs/                   # Documentation (11 chapters)
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

**Audio chain:** Voice → Channel Bus (per-instrument gain + analyser) → Master Gain → Effects Chain (10 effects in series) → Air Rolloff (gentle HF taper) → Soft Clip (tanh, hybrid mode) → Limiter → Analyser → Destination. Channels with FX exclusion enabled bypass the effects chain via dedicated routing nodes while still passing through the master EQ and limiter.

**Pattern system:** 1210+ patterns stored as JSON. Melodic patterns are semitone offsets (transposable). Drum patterns are note/velocity arrays. Bass runs on a separate sequencer with independent genre/pattern selection.

---

## Privacy

mpump collects no personal data. No account. No tracking.

- **No cookies, no fingerprinting, no tracking IDs**
- **No third-party trackers**: no Google, no Facebook, no ad networks
- **Local storage only**: grooves, settings, and patterns stay in your browser. Nothing is sent to any server
- **Anonymous counters**: page views and events (play, share) counted via [GoatCounter](https://goatcounter.com), a privacy-first, cookie-free analytics tool
- **Open source**: full codebase on [GitHub](https://github.com/gdamdam/mpump)

### Sharing

When you share a beat, the link contains only beat settings (BPM, genre, patterns, effects). No personal data, no user identifiers.

Share links go through a relay (`s.mpump.live`) that does three things:

1. **Short URLs** — `s.mpump.live/{id}` instead of long encoded links. The full self-contained link is always available as a fallback (works offline, no relay needed).
2. **Preview cards** — adds metadata so messaging apps display a card with BPM, genre, and pattern grid.
3. **Remix lineage** — when you remix someone's beat and share it, the relay stores which beat yours came from. This is the only data stored: a link between two beats. No user info, no IPs, no timestamps beyond creation date.

**What the relay stores:**
- Beat URLs (the same data that's in the link — BPM, patterns, effects)
- Parent references (which beat was remixed from which)
- Anonymous counters (play count, remix count — no user identifiers attached)

**What the relay does NOT store:**
- No user accounts, emails, or names
- No IP addresses
- No cookies or tokens
- No browser fingerprints

The relay is fully open source in [`worker/`](worker/).

### Live Jam

Jam and Live Set sessions use a lightweight WebSocket relay for peer discovery and message passing. Mutes and effects can be bar-synced (quantized to beat boundaries) for tighter coordination.

**What flows through the relay:**
- Control data only (~50 bytes/msg): BPM, genre, pattern index, effect toggles, mute states, XY pad positions
- Ephemeral room IDs (random 6-char codes, exist only in memory)

**What does NOT flow through the relay:**
- No audio. Each browser synthesizes locally
- No user accounts, emails, or persistent identifiers
- No IP addresses logged or stored
- No cookies or tokens
- No persistent data. Rooms vanish when empty

The relay runs is fully open source in [`worker/jam-relay/`](worker/jam-relay/).

### Hosting

mpump is hosted on [GitHub Pages](https://pages.github.com). 

The share relay runs on [Cloudflare Workers](https://workers.cloudflare.com). 

The jam relay runs on [Fly.io](https://fly.io).

---

Your music stays on your device. Always.

---

## License

[AGPL-3.0](LICENSE)

## Trademark

"mpump" is an unregistered trademark of the author.
Use of the name or logo for derivative projects or services may cause confusion and is not permitted.

---

Built with Claude Code. Design, architecture, UX, audio chain, and creative direction by [gdamdam](https://github.com/gdamdam).
