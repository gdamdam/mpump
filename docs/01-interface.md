# Chapter 1: The Interface

How mpump's UI works — from the header to the step grid, and everything in between.

## The Big Picture

mpump has three main views, each designed for a different way of making music:

```
  KAOS          SYNTH           SIMPLE          MIXER
  ┌──────┐    ┌──────────┐    ┌──────────┐    ┌──────────���
  │ XY   │    │ Drums    │    │ Drums    │    │ VU meter │
  │ pad  │    │ Bass     │    │ Bass     │    │          │
  │      │    │ Synth    │    │ Synth    │    │ DRUMS ═══│
  │ wave │    │ editors  │    │ (compact)│    │ BASS  ═══│
  │ form │    │ grids    │    │          │    │ SYNTH ═══│
  │      │    │ knobs    │    │          │    │ MASTER══ │
  └──────┘    └──────────┘    └────��─────┘    └──��───────┘
  Perform      Edit sounds     Quick jam       Mix levels
```

You switch between them using the mode buttons in the header: **KAOS | SYNTH | MIXER**. SIMPLE is activated in Settings — it's an accessibility-focused mode with large touch targets (56px+, WCAG AAA).

All three views share the same audio engine and state. Change a drum pattern in SYNTH, switch to KAOS — the pattern keeps playing. They're just different windows into the same session.

## The Header

The header is always visible, regardless of which mode you're in.

```
┌─────────────────────────────────────────────────────────────────────┐
│ MPUMP  "Track Name"  ═══VU═══                                      │
│ [Library] [KAOS][SYNTH][MIXER] 130BPM  MIX ↩ ⏹ REC ⤴Share        │
│                                        Pins ↟ 💾 📂 ? ⋯ ⚙        │
└──────────────────────────��──────────────────────────────────────────┘
```

**Top row:**
- **Logo** — animated ASCII art, click to pulse. Double-click cycles color palettes
- **Track name** — click to rename your session (marquee scrolls if long)
- **VU meter** — real-time level meter with peak hold

**Transport row:**
- **Library** — browse all 910 patterns organized by genre
- **Mode buttons** — switch between KAOS, SYNTH, MIXER
- **BPM** — click to type, scroll/arrows to adjust
- **MIX** — randomizes genre, pattern, and sounds across all instruments. Every 3rd MIX also randomizes BPM. The ↩ button undoes the last 3 MIXes
- **Play/Stop** — starts/stops all instruments (Space)
- **REC** — record audio output as WAV
- **Share** — generates a playable link encoding your full session state

**Right group:**
- **Pins** — save/load session presets (15 built-in + unlimited user presets with rename/delete)
- **Save (↟)** — save current preset
- **💾** — save session (Cmd+S)
- **📂** — browse saved sessions
- **?** — help
- **⋯** — more actions (export, import, settings overflow)
- **⚙** — settings (performance, Link Bridge, SIMPLE mode toggle)

## Three Instruments

mpump always runs three instruments simultaneously:

```
  ┌─────────┐    ┌───��─────┐    ┌─────────┐
  │  DRUMS  │    │  BASS   │    │  SYNTH  │
  │  ch. 9  │    │  ch. 1  │    │  ch. 0  │
  │         │    │         │    │         │
  │ 9 voices│    │ melodic │    │ melodic │
  │ one-shot│    │ mono    │    │ stereo  │
  │ synths  │    │ center  │    │ unison  │
  └────┬────┘    └────┬────┘    └────┬────┘
       │              │              │
       ▼              ���              ▼
  ┌──────────────────────────────────────┐
  │           Master Mix Bus             │
  │    → Effects → Limiter → Output      │
  └───��──────────────────────────────────┘
```

Each instrument has:
- Its own **genre** (techno, house, DnB, etc.) — 20 genres available
- Its own **pattern** — sequences of notes or drum hits (910 total)
- Its own **sound preset** — the timbre/character of the sound
- Its own **volume**, **mute**, **solo**, and **mono** controls
- A **lock** on both the sound preset and the genre/pattern — prevents MIX from changing them

## KAOS Mode

KAOS is the performance view. The centerpiece is the XY pad.

```
┌─────────────────────────────────────┐
│ DRUMS [House ▼] MUTE S 🔒 VOL ═══  │
│ BASS  [Default ▼] MUTE S �� VOL ═══│
��� SYNTH [Supersaw ▼] MUTE S 🔒 VOL ══│
├─────────────────────────────────────┤
│           X: Cutoff                 │
│  ┌─────────────────────────────┐    │
│  │                    o        │    │
│  │              ·              │    │
│  │         ·                   │    │
│  │                             │    │
│  │    ·                        │    │
│  └─────────────────────────────┘    │
│           Y: Resonance              │
├─────────────────────────────────────┤
│ DRUMS 🔒 [◀ techno ▶]              │
│           [◀ 4-on-floor ▶]         │
│ BASS  🔒 [◀ house ▶]               │
│           [◀ Jazz Walk ▶]          │
│ SYNTH 🔒 [◀ trance ▶]              │
│           [◀ Arp Rise ▶]           │
└─────────���──────────────────────��────┘
```

**Top section**: per-instrument mixer with sound preset dropdowns, volume sliders, mute/solo/lock buttons.

**XY pad**: drag your finger or mouse to control two parameters simultaneously. X axis controls filter cutoff (100–8000 Hz), Y axis controls resonance (0.5–20 Q, inverted — top is high). The pad shows touch trails (fading neon dots) and a waveform visualization in the background.

**Bottom section**: genre and pattern selectors for each instrument, with lock buttons and navigation arrows. Genres and patterns are also available as dropdowns sorted alphabetically.

## SYNTH Mode

SYNTH mode is where you edit everything in detail. It shows three instrument panels side by side (or stacked on mobile).

Each panel has:

```
┌─────────────────────────────────────┐
│ DRUMS [Default ▼] 🔒 MUTE SOLO CLR │
│ VOL ═══                             │
│ GENRE  [techno ▼] 🔒                │
│ PATTERN [4-on-floor ▼]              │
│ Chain: [Off ▼]                      │
│                                     │
│ ┌─ Step Grid ────────────────────┐  │
│ │ BD ■□□□■□□□■□□□■□□□           │  │
│ │ RS □□□□□□□□□□□□□□□□           │  │
│ │ SD □□□□■□□□□□□□■□□□           │  │
��� │ CH ■□■□■□■□■□■□■□■□           │  │
│ │ OH □□□□□□□□□□□□□□□□           │  │
│ │ CB □□□□□□□��□□□□□���□□           │  │
│ �� CY □□□□□��□□□□□□□□□□           │  │
�� │ CP □□□□□□□□□□□□□□□□           │  │
│ │ RD □□□□□□□□□□□□□□□□           │  │
│ └────���───────────────────────────┘  ���
│                                     │
│ ▸ drum kit (tune/decay/level/tone)  │
│ ▸ euclidean (algorithmic rhythms)   │
│ ▸ sample loader (custom WAV/MP3)    │
│                                     │
│ +Save  Patterns ▾  +Save Kit Kits ▾ │
└────��─────────────────────────��──────┘
```

**The step grid** is where you click to add/remove drum hits or melodic notes. 9 drum voices (BD, RS, SD, CH, OH, CB, CY, CP, RD), each row individually mutable by clicking the label. Click a cell to toggle a hit. The playhead highlights the current step.

For bass and synth, the grid shows melodic steps with note labels. Scroll wheel changes pitch, click the label for a dropdown note selector.

**Pattern length**: configurable from 1 to 32 steps (1, 2, 3, 4, 8, 16, 32).

**Chain mode**: link two patterns (A/B) that alternate at bar boundaries — doubles your effective sequence length.

**Collapsible sections** below the grid:
- **Drum kit editor** — knobs for TUNE, DECAY, LEVEL, TONE (per voice character), PAN
- **Euclidean editor** — algorithmic rhythm generator (set hits, steps, rotation per voice)
- **Sample loader** — load your own WAV/MP3/OGG samples to replace any drum voice

**Sound design** (for bass and synth panels):
- Oscillator type: SAW, SQR, SIN, TRI
- ADSR envelope with visual curve
- DETUNE + VOICES (1/3/5/7 unison with spread control)
- Sub-bass oscillator (on/off + level, -1 octave sine)
- Filter: LP/HP/BP/Notch with CUT, RES, ENV DEPTH knobs
- LFO: rate, depth, shape (sine/square/triangle/sawtooth), target (cutoff/pitch/both), tempo sync with division selector
- Scale lock: chromatic, major, minor, pentatonic, blues, dorian, mixolydian

**Pattern management**:
- +Save — save current pattern with a name
- Patterns dropdown — load, rename, delete saved patterns
- +Save Kit / Kits — same for drum kit presets and sound presets

## MIXER Mode

A traditional mixing console view.

```
┌─────────────────────────────────────┐
│         ┌─── VU ───┐               │
│         │    /      │  [LIMIT]      │
│         │   /       │               │
│         │  ╱        │               │
│         └───────────┘               │
│         -12.3 dB        CLIP       │
├─────────────────────────────────────┤
│ ● DRUMS  [M] [S] [Mo] ════ 70% PAN │
��� ● BASS   [M] [S]      ════ 70% PAN │
│ ● SYNTH  [M] [S] [Mo] ════ 70% PAN │
│ ����───────────────────────────────── │
│   MASTER              ════ 70% DRV │
└────��──────────────────────────────��─┘
```

- **VU meter** — analog needle meter with dB readout, colored zones (-40 to +3 dB), peak hold, clip indicator
- **LIMIT** — toggle the brick-wall limiter (threshold -1 dB, ratio 4:1)
- Per-channel: activity LED, label, **M**ute, **S**olo, **Mo**no, volume fader (default 70%), PAN slider
- Bass has no Mono button (bass is always center-panned)
- Master row: volume fader + DRIVE (input gain before limiter, -6 to +12 dB)

## SIMPLE Mode

Activated in Settings. A single-column layout with 56px+ touch targets, designed for accessibility (WCAG AAA). Shows all three instruments with play/pause, genre/pattern navigation, and basic controls. No knobs, no collapsible sections — just the essentials.

## Effects

Ten effects in a configurable chain. Each can be toggled on/off with adjustable parameters. The default signal chain order:

```
Input → [Compressor] → [Highpass] → [Distortion] → [Bitcrusher]
      → [Chorus]     → [Phaser]  → [Delay]       → [Reverb]
      → [Flanger]    → [Tremolo] → Output
```

The chain order can be rearranged by the user.

- **Compressor** — threshold (-24 dB default), ratio (4:1 default)
- **Highpass** — cutoff frequency (200 Hz default), Q
- **Distortion** — drive amount with gain compensation (20 default)
- **Bitcrusher** — bit depth reduction (8 bits default)
- **Chorus** — stereo chorus with quadrature LFOs (rate 1.5, depth 0.003, mix 0.3)
- **Phaser** — allpass sweep with LFO (rate 0.5, depth 1000)
- **Delay** — stereo ping-pong with tempo sync (1/16 default, feedback 0.4, mix 0.3). Supports per-channel exclusion (EXCL. DRUMS/BASS/SYNTH)
- **Reverb** — convolution reverb with adjustable decay (2s default, mix 0.3). Supports per-channel exclusion (EXCL. DRUMS/BASS/SYNTH)
- **Flanger** — through-zero flanger with rate and depth controls
- **Tremolo** — amplitude modulation with rate and depth
- **Duck** (sidechain) — kick-triggered ducking with depth and release controls. Runs inside the AudioWorklet for synth/bass channels. Supports per-channel exclusion (EXCL. BASS/SYNTH)

### Per-Channel FX Exclusion

Reverb, Delay, and Duck effect editors include **EXCL.** toggle buttons (DRUMS, BASS, SYNTH) that bypass specific channels from the effect. Excluded channels are routed directly to the master output via dedicated bypass nodes, skipping the effects chain while still passing through master EQ and limiter.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Play / Stop all |
| R | MIX (randomize) |
| Cmd+Z | Undo MIX |
| Cmd+S | Save session |
| 1 | KAOS mode |
| 2 | SYNTH mode |
| 3 | MIXER mode |
| 4 | SIMPLE mode |
| ? | Help |

## Sharing

Click **Share** in the header to generate a playable link. The link encodes your full session state — BPM, swing, genres, patterns, sound presets, effect settings, mute states, channel volumes, and any pattern edits — into a base64 URL parameter. A Cloudflare Worker at `s.mpump.live` serves Open Graph tags for link previews, then redirects browsers to the app.

When someone opens your link, they see a preview card of your beat and a Play button. One tap and they hear exactly what you made.

## Session Persistence

Your session is automatically saved to localStorage. When you reload mpump, everything comes back: patterns, sounds, effects, volumes, BPM, key, scale. You can also:

- **Pin a session** — named preset, quick-load from the Pins menu
- **Save to library** — persistent named sessions with rename/delete
- **Share via URL** — encodes everything into a playable link
- **Export WAV** — record and download your audio output
- **Export/import session** — full JSON file, importable later

## Onboarding

First-time visitors see a 7-step tutorial overlay with spotlight highlights on key controls:

1. Welcome — what mpump is
2. Play and mix — MIX button, XY pad
3. Keep it — REC and export tools
4. Share it — shareable links
5. Switch views — KAOS/SYNTH/MIXER modes
6. Take it with you — offline/PWA support
7. Go create — final message

The tutorial is dismissed permanently after completion and stored in localStorage.

## What's Next

Read [Chapter 2: The Sound Engine](02-sound-engine.md) to learn how mpump synthesizes drums, bass, and synth voices using the Web Audio API.
