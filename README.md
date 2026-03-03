# mpump v1.0.1

Hot-plug MIDI sequencer for Roland AIRA Compact devices. Plug in a device and it starts playing immediately. Unplug it and it stops cleanly. No configuration files, no drivers — just USB and sound.

Multiple devices play in sync from a shared clock. Switching patterns or pausing a device waits for the next bar boundary so everything stays phase-locked.

Built for live use: run it before the set, leave it going, connect and disconnect hardware as needed.

---

## Install

```bash
pip install mpump
```

Requires Python 3.11+ and macOS (CoreMIDI). All supported devices are USB class-compliant — no extra drivers needed.

---

## Three interfaces

### Web UI

```bash
mpump-web
```

Opens a web server on port 8080. Point any browser on the local network at `http://<your-mac-ip>:8080` — works great from iOS Safari. Supports Add-to-Home-Screen for a full-screen PWA experience.

Features: live step-grid visualization, genre/pattern/key/octave switching, tap-to-edit patterns, save edited patterns to the EXTRAS genre. Multiple browser clients can connect simultaneously.

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

## Supported devices

| Device | Type | MIDI |
|---|---|---|
| **Roland S-1** | Monosynth (AIRA Compact) | Genre patterns — melodic/bass lines with slides and accents |
| **Roland T-8** | Drum machine (AIRA Compact) | Independent drum + bass patterns; drums on Ch 10, bass on Ch 2 |
| **Roland J-6** | Chord synth (AIRA Compact) | Chord-stab progressions on Ch 1; auto-selects chord set via Program Change |
| **Roland SP-404MK2** | Sampler | Fixed pad-trigger pattern on Ch 1 |

---

## Web UI (`mpump-web`)

```bash
mpump-web                     # defaults: BPM 120, port 8080
mpump-web --bpm 133           # custom tempo
mpump-web --port 9000         # custom port
```

| Flag | Default | Description |
|---|---|---|
| `--bpm N` | `120` | Initial tempo (20–300) |
| `--port N` | `8080` | HTTP port to listen on |

### Pattern editing

Tap any step in the grid to toggle it on/off. Long-press (or right-click) a step to open the detail editor where you can adjust semitone offset, velocity, and slide. Edited patterns can be saved to the **EXTRAS** genre, which persists across sessions in `~/.mpump/extras.json` and is available in all three interfaces.

---

## Terminal UI (`mpump-ui`)

```bash
mpump-ui                                        # defaults
mpump-ui --bpm 133 --genre acid-techno --pattern 3
mpump-ui --t8-genre dub-techno --t8-pattern 5 --t8-bass-pattern 2
mpump-ui --j6-genre trance --j6-pattern 4
```

### Key bindings

| Key | Action |
|---|---|
| `Tab` | Cycle focus: S-1 → T-8 → J-6 |
| `← / →` | Previous / next genre |
| `↑ / ↓` | Previous / next pattern (browse only) |
| `Enter` | Commit browsed pattern/genre to device |
| `b / B` | T-8 bass pattern down / up (browse only) |
| `k / K` | Root key down / up (immediate, S-1 and T-8) |
| `o / O` | Octave down / up (immediate, S-1 and T-8) |
| `Space` | Pause / resume focused device |
| `= / -` | BPM +5 / −5 |
| `q` | Quit |

Browse with `← → ↑ ↓` (and `b/B` for bass) then press `Enter` to apply. The now-playing strip always shows what is actually running.

---

## CLI flags (`mpump` and `mpump-ui`)

### S-1

| Flag | Default | Description |
|---|---|---|
| `--bpm N` | `120` | Tempo (20–300) |
| `--genre GENRE` | `techno` | S-1 genre — see [GENRES.md](GENRES.md) for full list |
| `--pattern N` | `1` | Pattern 1–10 within genre |
| `--key KEY` | `A` | Root key: `A A# Bb B C C# Db D D# Eb E F F# Gb G G# Ab` |
| `--octave N` | `2` | Root octave 0–6 (A2 = MIDI 45) |
| `--list` | — | Print all S-1 patterns and exit |

### T-8

| Flag | Default | Description |
|---|---|---|
| `--t8-genre GENRE` | `techno` | Drum/bass genre |
| `--t8-pattern N` | `1` | Drum pattern 1–10 |
| `--t8-bass-pattern N` | `1` | Bass pattern 1–10, independent of drums |
| `--t8-key KEY` | `A` | Root key for bass |
| `--t8-octave N` | `2` | Root octave for bass |
| `--list-t8` | — | Print all T-8 drum patterns and exit |
| `--list-t8-bass` | — | Print all T-8 bass patterns and exit |

### J-6

| Flag | Default | Description |
|---|---|---|
| `--j6-genre GENRE` | `techno` | Chord genre — see [GENRES.md](GENRES.md) for full list |
| `--j6-pattern N` | `1` | Chord pattern 1–10 |
| `--list-j6` | — | Print all J-6 patterns and exit |

---

## Pattern library

### S-1 — 150 patterns, 15 genres × 10

Genres: `techno`, `acid-techno`, `trance`, `dub-techno`, `idm`, `edm`, `drum-and-bass`, `house`, `breakbeat`, `jungle`, `garage`, `ambient`, `glitch`, `electro`, `downtempo`

All patterns are expressed as semitone offsets from the root, so `--key` and `--octave` transpose them freely.

```bash
mpump --list           # full catalogue with descriptions
```

### T-8 — 150 drum + 150 bass patterns, 15 genres × 10 each

Drum and bass patterns are selected independently. The bass runs on Ch 2; drums on Ch 10 (GM).

```bash
mpump --list-t8        # drum patterns
mpump --list-t8-bass   # bass patterns
```

### J-6 — 150 chord progressions, 15 genres × 10

Root is always C (MIDI 60). On connect, mpump sends a Program Change to auto-select the matching chord set on the J-6.

```bash
mpump --list-j6
```

### EXTRAS — user-created patterns

Patterns edited and saved via the web UI or TUI are stored in `~/.mpump/extras.json` and appear as the **extras** genre in all interfaces.

---

## Sync model

All devices share a single step-grid anchored to a global `t0`. Every sequencer starts at the next **bar boundary** (16 steps from `t0`), so:

- Devices that connect at different times are always phase-locked within one bar
- Pattern changes and pause/resume introduce at most one bar of delay, then re-enter on the beat
- BPM changes reset `t0` and batch-restart all devices at the same boundary

MIDI clock (24 PPQN) is sent to each device for BPM-synced effects (LFO, delay, arpeggiator). No MIDI Start/Stop messages are sent, so the devices' internal sequencers are not triggered.

---

## How slides work

On acid patterns, steps marked `slide=True` send the next `note_on` before the previous `note_off`. On a monosynth like the S-1, this triggers legato / portamento if portamento is enabled on the device.

---

## Project layout

```
pyproject.toml
mpump/
  cli.py          # mpump entry point (headless + TUI)
  ui.py           # Textual TUI application
  scanner.py      # hot-plug: polls MIDI ports every 0.5 s, spawns threads
  sequencer.py    # per-device 16-step loop thread (Sequencer + T8Sequencer)
  devices.py      # device profiles
  patterns.py     # S-1: 150 patterns (15 genres × 10)
  patterns_t8.py  # T-8: 150 drum + 150 bass patterns
  patterns_j6.py  # J-6: 150 chord progressions
  extras.py       # user-created patterns (~/.mpump/extras.json)
  keys.py         # key name → root MIDI note
  web/
    engine.py     # WebEngine: async state manager wrapping DeviceScanner
    server.py     # FastAPI + WebSocket + static SPA serving
  frontend/
    src/           # React + TypeScript SPA (Vite)
    dist/          # built output (served by mpump-web)
```

---

## Tested on

- macOS Sequoia 15, Python 3.11
- Roland S-1, T-8, J-6 (hot-plug + playback confirmed)
- Roland SP-404MK2 (hot-plug confirmed; pattern playback not yet hardware-tested)
