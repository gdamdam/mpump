<p align="center">
  <strong>mpump</strong> &mdash; hot-plug MIDI sequencer for USB MIDI devices
</p>

<p align="center">
  <a href="https://github.com/gdamdam/mpump"><img src="https://img.shields.io/badge/version-1.3.6-blue" alt="Version"></a>
  <a href="https://github.com/gdamdam/mpump"><img src="https://img.shields.io/badge/python-3.11+-3776AB?logo=python&logoColor=white" alt="Python 3.11+"></a>
  <a href="https://github.com/gdamdam/mpump/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-GPL--2.0-green" alt="License"></a>
  <a href="https://github.com/gdamdam/mpump"><img src="https://img.shields.io/badge/devices-50-blueviolet" alt="Supported devices"></a>
  <a href="https://github.com/gdamdam/mpump"><img src="https://img.shields.io/badge/patterns-610+-orange" alt="Pattern count"></a>
  <a href="https://github.com/gdamdam/mpump"><img src="https://img.shields.io/badge/genres-15-teal" alt="Genres"></a>
</p>

---

Plug in a USB MIDI device and it starts playing immediately. Unplug it and it stops cleanly. No configuration files, no drivers — just USB and sound.

Multiple devices play in sync from a shared clock. Switching patterns or pausing a device waits for the next bar boundary so everything stays phase-locked.

Built for live use: run it before the set, leave it going, connect and disconnect hardware as needed.

## Table of Contents

- [Install](#install)
- [Interfaces](#interfaces)
  - [Browser Sequencer (standalone)](#browser-sequencer-standalone)
  - [Web UI (Mac + Python)](#web-ui-mac--python)
  - [Terminal UI](#terminal-ui)
  - [Headless CLI](#headless-cli)
- [Supported Devices](#supported-devices)
- [CLI Reference](#cli-reference)
- [Pattern Library](#pattern-library)
- [Sync Model](#sync-model)
- [How Slides Work](#how-slides-work)
- [Project Layout](#project-layout)
- [Tested On](#tested-on)
- [Contributing](#contributing)
- [License](#license)

---

## Install

```bash
pip install mpump
```

Requires **Python 3.11+** and **macOS** (CoreMIDI). All supported devices are USB class-compliant — no extra drivers needed.

---

## Interfaces

### Browser Sequencer (standalone)

Open the hosted app in **Chrome**, **Edge**, or **Opera** — no install, no server, no Mac required. The sequencer runs entirely in the browser using the [Web MIDI API](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API). Connect your MIDI devices via USB, grant MIDI permission, and play.

> Firefox works with a Web MIDI add-on. Safari and iOS are not supported (no Web MIDI).

**Features:** auto-detection of 50 USB MIDI devices, live step-grid visualization, genre/pattern/key/octave switching, tap-to-edit patterns, shuffle button to randomize genre + pattern globally or per-device, save edited patterns to the EXTRAS genre.

To build and serve locally:

```bash
cd mpump/server
python3 scripts/export_patterns.py
npm install && npm run build
npm run preview
```

Deploy `mpump/server/dist/` to any HTTPS host (GitHub Pages, Netlify, Vercel) for zero-install access from any computer with USB MIDI.

### Web UI (Mac + Python)

```bash
mpump-web
```

Opens a web server on port 8080. Point any browser on the local network at `http://<your-mac-ip>:8080` — works great from iOS Safari. Supports Add-to-Home-Screen for a full-screen PWA experience.

**Features:** live step-grid visualization, genre/pattern/key/octave switching, tap-to-edit patterns, save edited patterns to the EXTRAS genre. Multiple browser clients can connect simultaneously.

### Terminal UI

```bash
mpump-ui
```

Three-panel TUI showing S-1, T-8 and J-6 side by side. Browse and commit patterns live.

### Headless CLI

```bash
mpump --cli
```

Starts immediately with the given flags, no UI.

---

## Supported Devices

The browser sequencer auto-detects **50 USB MIDI devices**. Devices are recognized by their USB MIDI port name and start playing automatically when plugged in.

### Roland

| Device | Type | Mode | Status |
|---|---|---|---|
| S-1 | AIRA Compact monosynth | synth | Tested |
| T-8 | AIRA Compact drum machine | drums+bass | Tested |
| J-6 | AIRA Compact chord synth | synth | Tested |
| SP-404MK2 | Sampler | synth | Untested |
| TR-6S | Drum machine | drums | Untested |
| TR-8S | Drum machine | drums | Untested |
| MC-101 | Groovebox | drums+bass | Untested |
| MC-707 | Groovebox | drums+bass | Untested |
| SH-4d | Polysynth | synth | Untested |
| TB-3 | Bass synth (303-style) | synth | Untested |
| TB-03 | Bass synth (303 clone, Boutique) | synth | Untested |
| JD-Xi | Crossover synth | synth | Untested |
| JU-06A | Juno clone (Boutique) | synth | Untested |
| SE-02 | Analog mono (Boutique) | synth | Untested |
| GAIA 2 | Wavetable/VA polysynth | synth | Untested |

### Korg

| Device | Type | Mode | Status |
|---|---|---|---|
| minilogue xd | 4-voice analog poly | synth | Untested |
| minilogue | 4-voice analog poly | synth | Untested |
| monologue | Analog monosynth | synth | Untested |
| NTS-1 | Programmable synth | synth | Untested |
| drumlogue | Hybrid drum machine | drums+bass | Untested |
| wavestate | Wave sequencing synth | synth | Untested |
| opsix | FM synth | synth | Untested |
| modwave | Wavetable synth | synth | Untested |

### Novation

| Device | Type | Mode | Status |
|---|---|---|---|
| Circuit Tracks | Groovebox | drums+bass | Untested |
| Circuit Rhythm | Sample groovebox | drums | Untested |
| Bass Station II | Analog monosynth | synth | Untested |
| Peak | 8-voice hybrid poly | synth | Untested |

### Arturia

| Device | Type | Mode | Status |
|---|---|---|---|
| MicroFreak | Digital/hybrid synth | synth | Untested |
| DrumBrute Impact | Analog drum machine | drums | Untested |

### Behringer

| Device | Type | Mode | Status |
|---|---|---|---|
| TD-3 | 303 clone | synth | Untested |
| RD-6 | 606 clone | drums | Untested |
| Crave | Semi-modular mono | synth | Untested |
| Model D | Minimoog clone | synth | Untested |
| Neutron | Semi-modular | synth | Untested |
| Poly D | 4-voice analog poly | synth | Untested |
| K-2 | MS-20 clone | synth | Untested |
| MS-1 | SH-101 clone | synth | Untested |
| DeepMind 12 | 12-voice analog poly | synth | Untested |
| Wasp Deluxe | EDP Wasp clone | synth | Untested |

### Elektron

| Device | Type | Mode | Status |
|---|---|---|---|
| Syntakt | Drum machine + synth | drums | Untested |
| Digitakt | Sampler / drums | drums | Untested |
| Model:Cycles | FM groovebox | drums+bass | Untested |
| Model:Samples | Sample groovebox | drums | Untested |
| Analog Rytm MKII | Analog drums + sampler | drums | Untested |
| Analog Four MKII | 4-voice analog poly | synth | Untested |

### Other

| Device | Type | Mode | Status |
|---|---|---|---|
| TE OP-Z | Multi-track synth | synth | Untested |
| TE EP-133 K.O. II | Sampler / drums | drums+bass | Untested |
| Sequential Take 5 | 5-voice analog poly | synth | Untested |
| IK UNO Drum | Analog/PCM drum machine | drums | Untested |
| IK UNO Synth | Analog monosynth | synth | Untested |

> **Tested** = verified with hardware. **Untested** = port names may need adjustment; please [report issues](https://github.com/gdamdam/mpump/issues).

All 50 devices are supported across all interfaces. The TUI shows dedicated panels for S-1, T-8, and J-6; other devices are auto-detected and sequenced in CLI and web modes.

---

## CLI Reference

### `mpump-web`

```bash
mpump-web                     # defaults: BPM 120, port 8080
mpump-web --bpm 133           # custom tempo
mpump-web --port 9000         # custom port
```

| Flag | Default | Description |
|---|---|---|
| `--bpm N` | `120` | Initial tempo (20-300) |
| `--port N` | `8080` | HTTP port to listen on |

#### Pattern editing

Tap any step in the grid to toggle it on/off. Long-press (or right-click) a step to open the detail editor where you can adjust semitone offset, velocity, and slide. Edited patterns can be saved to the **EXTRAS** genre, which persists across sessions in `~/.mpump/extras.json` and is available in all three interfaces.

### `mpump-ui`

```bash
mpump-ui                                        # defaults
mpump-ui --bpm 133 --genre acid-techno --pattern 3
mpump-ui --t8-genre dub-techno --t8-pattern 5 --t8-bass-pattern 2
mpump-ui --j6-genre trance --j6-pattern 4
```

#### Key bindings

| Key | Action |
|---|---|
| `Tab` | Cycle focus: S-1 -> T-8 -> J-6 |
| `<- / ->` | Previous / next genre |
| `up / down` | Previous / next pattern (browse only) |
| `Enter` | Commit browsed pattern/genre to device |
| `b / B` | T-8 bass pattern down / up (browse only) |
| `k / K` | Root key down / up (immediate, S-1 and T-8) |
| `o / O` | Octave down / up (immediate, S-1 and T-8) |
| `Space` | Pause / resume focused device |
| `= / -` | BPM +5 / -5 |
| `q` | Quit |

Browse with arrow keys (and `b/B` for bass) then press `Enter` to apply. The now-playing strip always shows what is actually running.

### `mpump` (headless CLI)

#### General

| Flag | Default | Description |
|---|---|---|
| `--bpm N` | `120` | Tempo (20-300) |
| `--list` | — | Print all synth patterns and exit |
| `--list-drums` | — | Print all drum patterns and exit |
| `--list-bass` | — | Print all bass patterns and exit |
| `--list-j6` | — | Print all J-6 chord patterns and exit |
| `--list-devices` | — | Print all 50 supported devices and exit |

#### S-1

| Flag | Default | Description |
|---|---|---|
| `--genre GENRE` | `techno` | S-1 genre — see [GENRES.md](GENRES.md) for full list |
| `--pattern N` | `1` | Pattern 1-10 within genre |
| `--key KEY` | `A` | Root key: `A A# Bb B C C# Db D D# Eb E F F# Gb G G# Ab` |
| `--octave N` | `2` | Root octave 0-6 (A2 = MIDI 45) |

#### T-8

| Flag | Default | Description |
|---|---|---|
| `--t8-genre GENRE` | `techno` | Drum/bass genre |
| `--t8-pattern N` | `1` | Drum pattern 1-10 |
| `--t8-bass-pattern N` | `1` | Bass pattern 1-10, independent of drums |
| `--t8-key KEY` | `A` | Root key for bass |
| `--t8-octave N` | `2` | Root octave for bass |

#### J-6

| Flag | Default | Description |
|---|---|---|
| `--j6-genre GENRE` | `techno` | Chord genre — see [GENRES.md](GENRES.md) for full list |
| `--j6-pattern N` | `1` | Chord pattern 1-10 |

---

## Pattern Library

Full pattern catalogue with names and descriptions: **[GENRES.md](GENRES.md)**

### S-1 — 160 melodic patterns

15 genres (acid-techno has 20, rest have 10). All patterns are expressed as semitone offsets from the root, so `--key` and `--octave` transpose them freely. All synth-mode devices in the browser sequencer share these patterns.

```bash
mpump --list           # full catalogue with descriptions
```

### T-8 — 150 drum + 150 bass patterns

15 genres x 10 each. Drum and bass patterns are selected independently. All drums-mode and drums+bass-mode devices in the browser sequencer share these patterns.

```bash
mpump --list-t8        # drum patterns
mpump --list-t8-bass   # bass patterns
```

### J-6 — 150 chord progressions

15 genres x 10. Root is always C (MIDI 60). On connect, mpump sends a Program Change to auto-select the matching chord set on the J-6.

```bash
mpump --list-j6
```

### EXTRAS — user-created patterns

Patterns edited and saved via the web UI or TUI are stored in `~/.mpump/extras.json` and appear as the **extras** genre in all interfaces. In the browser sequencer, extras are stored in localStorage and are independent of the file-based extras.

---

## Sync Model

All devices share a single step-grid anchored to a global `t0`. Every sequencer starts at the next **bar boundary** (16 steps from `t0`), so:

- Devices that connect at different times are always phase-locked within one bar
- Pattern changes and pause/resume introduce at most one bar of delay, then re-enter on the beat
- BPM changes reset `t0` and batch-restart all devices at the same boundary

MIDI clock (24 PPQN) is sent to devices that support it for BPM-synced effects (LFO, delay, arpeggiator). No MIDI Start/Stop messages are sent, so the devices' internal sequencers are not triggered.

---

## How Slides Work

On acid patterns, steps marked `slide=True` send the next `note_on` before the previous `note_off`. On a monosynth like the S-1 or TD-3, this triggers legato / portamento if portamento is enabled on the device.

---

## Project Layout

```
pyproject.toml
mpump/
  __init__.py       # package version
  cli.py            # mpump entry point (headless + TUI)
  ui.py             # Textual TUI application
  scanner.py        # hot-plug: polls MIDI ports every 0.5 s, spawns threads
  sequencer.py      # per-device step-loop threads (Sequencer + T8Sequencer)
  devices.py        # device profiles (port names, channels, config)
  patterns.py       # S-1: 160 melodic patterns (15 genres)
  patterns_t8.py    # T-8: 150 drum + 150 bass patterns
  patterns_j6.py    # J-6: 150 chord progressions
  extras.py         # user-created patterns (~/.mpump/extras.json)
  keys.py           # key name -> root MIDI note mapping
  web/
    engine.py       # WebEngine: async state manager wrapping DeviceScanner
    server.py       # FastAPI + WebSocket + static SPA serving
  frontend/
    src/             # React + TypeScript SPA (Vite, served by mpump-web)
    dist/            # built output
  server/
    scripts/         # export_patterns.py — Python -> JSON converter
    src/             # React + TypeScript standalone SPA (Web MIDI, 50 devices)
    public/data/     # generated pattern JSON files
    dist/            # built output — deploy to any HTTPS host
```

---

## Tested On

- macOS Sequoia 15, Python 3.11
- Roland S-1, T-8, J-6 (hot-plug + playback confirmed)
- Roland SP-404MK2 (hot-plug confirmed; pattern playback not yet hardware-tested)
- Browser sequencer: all 50 devices in registry (port names for non-Roland devices need hardware verification)

---

## Contributing

1. Fork the repo and create a feature branch
2. Make your changes and ensure tests pass: `pytest`
3. Submit a pull request

Bug reports and device compatibility feedback are welcome — please [open an issue](https://github.com/gdamdam/mpump/issues).

---

## License

[GPL-2.0](LICENSE)
