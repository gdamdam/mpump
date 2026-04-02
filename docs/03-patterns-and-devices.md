# Chapter 3: Patterns & Devices

How mpump organizes its 910 patterns, maps them to 53 MIDI devices, and loads everything into the browser.

## Genre System

20 genres are shared across all instruments (15 original + 5 added in v1.5):

| # | Genre | Style |
|---|-------|-------|
| 1 | techno | Four-on-the-floor, industrial |
| 2 | acid-techno | 303 squelch, resonant bass |
| 3 | trance | Arpeggios, builds, pads |
| 4 | dub-techno | Reverb-heavy, minimal |
| 5 | idm | Glitchy, irregular rhythms |
| 6 | edm | Festival-style, big drops |
| 7 | drum-and-bass | Fast breaks, rolling bass |
| 8 | house | Groovy, four-on-the-floor |
| 9 | breakbeat | Syncopated drums, funk |
| 10 | jungle | Chopped breaks, sub bass |
| 11 | garage | 2-step rhythms, shuffled |
| 12 | ambient | Sparse, atmospheric |
| 13 | glitch | Stuttered, experimental |
| 14 | electro | Robotic, 808-style |
| 15 | downtempo | Slow, laid-back |

Each genre has **10 patterns per instrument pool** (drums, bass, synth), totaling 150 patterns per genre, 910 across all pools.

## Pattern Data Format

Three pools of patterns, stored as separate JSON files:

### Melodic Patterns (synth and bass)

Each pattern is a 16-step array. Each step is either `null` (rest) or a note:

```json
[
  { "semi": 0, "vel": 1, "slide": false },
  null,
  { "semi": 7, "vel": 0.8, "slide": true },
  null,
  ...
]
```

- **semi** — semitone offset from root (0 = root, 7 = fifth, -5 = down a fourth)
- **vel** — velocity factor (0–1)
- **slide** — glide from previous note instead of retriggering

### Drum Patterns

Each step is an array of simultaneous hits:

```json
[
  [{ "note": 36, "vel": 120 }, { "note": 42, "vel": 100 }],
  [{ "note": 42, "vel": 80 }],
  [],
  [{ "note": 42, "vel": 100 }],
  ...
]
```

- **note** — MIDI note number (36=BD, 37=RS, 38=SD, 42=CH, 46=OH, 47=CB, 49=CY, 50=CP, 51=RD)
- **vel** — velocity (0–127)

## Pattern Compilation Pipeline

Patterns are authored in Python and compiled to JSON at build time:

```
Python scripts              JSON files                    Browser
┌──────────────┐           ┌──────────────┐           ┌──────────────┐
│ generate_    │  export   │ patterns-    │  fetch()   │ catalog.ts   │
│ new_patterns │ ───────→  │ s1.json      │ ────────→  │ merges into  │
│ .py          │           │ t8-drums.json│           │ engine state │
│              │           │ t8-bass.json │           │              │
└──────────────┘           └──────────────┘           └──────────────┘
                           + catalog.json
                             (names, descs)
```

The Python scripts use helper functions for readability:

```python
N(semi, vel, slide)  # Melodic note
H(note, vel)         # Drum hit
R                    # Rest (None)
```

**Build command**: `npm run export-patterns` runs the Python compilation.

**Output location**: `mpump/server/public/data/`

## The Catalog

`catalog.json` is the index — it maps genre names and pattern metadata (name, description) to positions in the pattern arrays:

```json
{
  "s1": {
    "genres": [
      {
        "name": "techno",
        "patterns": [
          { "name": "Iron Grid", "desc": "Relentless 16th-note pulse" },
          { "name": "Warehouse", "desc": "Dark, driving sequence" },
          ...
        ]
      },
      ...
    ]
  },
  "t8": {
    "drum_genres": [ ... ],
    "bass_genres": [ ... ]
  },
  "keys": ["C", "C#", "D", ...],
  "octave_min": 0,
  "octave_max": 6
}
```

Pattern data and catalog are loaded in parallel on app start. The catalog index tells the engine which array position corresponds to "techno, pattern 3."

## Catalog Loading

`catalog.ts` fetches 4 files in parallel:

1. `catalog.json` — genre/pattern names
2. `patterns-s1.json` — synth melodic patterns
3. `patterns-t8-drums.json` — drum patterns
4. `patterns-t8-bass.json` — bass melodic patterns

After loading, it merges any **user-created patterns** stored in localStorage (keys: `s1`, `t8_drums`, `t8_bass`). User patterns are appended to the end of each genre's pattern list.

### Device-to-Catalog Mapping

Not all devices use the same pattern pool. Helper functions route each device to the right data:

| Device Mode | Melodic Source | Drum Source | Bass Source |
|-------------|---------------|-------------|-------------|
| synth | S-1 patterns | — | — |
| drums | — | T-8 drum patterns | — |
| drums+bass | — | T-8 drum patterns | T-8 bass patterns |
| bass | T-8 bass patterns | — | — |

All 20 genres are available to every device regardless of mode — the genre list is universal.

## Device Registry

53 MIDI devices are recognized automatically when plugged in via USB. Each device is defined in `devices.ts`:

```typescript
interface DeviceConfig {
  id: string;          // "s1", "t8", "tr8s", etc.
  label: string;       // "S-1", "T-8", "TR-8S"
  portMatch: string;   // MIDI port name substring to match
  mode: DeviceMode;    // "synth" | "drums" | "drums+bass" | "bass"
  channels: {
    main: number;      // MIDI channel for primary voice
    bass?: number;     // MIDI channel for bass (drums+bass only)
  };
  rootNote: number;    // Base MIDI note (36–60)
  gateFraction: number;    // Note gate length (0.3–0.9)
  drumGateFraction: number; // Drum gate length (typically 0.1)
  baseVelocity: number;    // Default MIDI velocity (typically 100)
  drumMap?: Record<number, number>; // Custom drum note remapping
  hasKey: boolean;     // Supports key selection
  hasOctave: boolean;  // Supports octave shift
  useProgramChange: boolean;
  sendClock: boolean;
  accent: string;      // UI color
}
```

### Supported Devices

**Roland AIRA Compact**: S-1, T-8, J-6
**Roland**: TR-6S, TR-8S, MC-101, MC-707, SH-4d, TB-3, TB-03, JD-Xi, JU-06A, SE-02, GAIA 2, SP-404MK2
**Korg**: minilogue xd, monologue, NTS-1, drumlogue, wavestate, opsix, modwave, volca series
**Novation**: Circuit Tracks, Circuit Rhythm, Bass Station II, Peak
**Arturia**: MicroFreak, MiniBrute 2, DrumBrute
**Elektron**: Digitakt, Analog Rytm, Model:Cycles, Model:Samples
**And more** — 53 total across manufacturers.

### Auto-Detection Flow

```
USB MIDI plugged in
      │
      ▼
navigator.requestMIDIAccess()
      │
      ▼
statechange event fires
      │
      ▼
detectPorts() iterates MIDI outputs
      │
      ▼
output.name.includes(config.portMatch)?
      │                    │
     yes                  no
      │                    │
      ▼                  skip
Create MidiPort wrapper
Connect to Engine
Start at next bar boundary
```

The match is a simple substring check on the MIDI port name. First match wins — if a port matches multiple registry entries, the first one is used.

### Browser Audio (Preview Mode)

When no MIDI device is connected, mpump runs in **preview mode** — three virtual devices using browser audio synthesis:

| Virtual Device | ID | Mode | Channel |
|---------------|-----|------|---------|
| Drums | preview_drums | drums+bass | 9 (drums), 1 (bass) |
| Bass | preview_bass | bass | 1 |
| Synth | preview_synth | synth | 0 |

These use the same pattern data and genre system as hardware devices, but route notes to AudioPort instead of MIDI output.

## Adding a New Genre

1. Add patterns in Python (10 per instrument pool)
2. Run `npm run export-patterns` to recompile JSON
3. Add the genre name to `catalog.json` with pattern names/descriptions
4. The browser picks it up automatically — no code changes needed

## Adding a New Device

1. Add a `DeviceConfig` entry to `DEVICE_REGISTRY` in `devices.ts`
2. Set `portMatch` to a unique substring from the device's MIDI port name
3. Choose the right `mode` (synth/drums/drums+bass/bass)
4. Set MIDI channels, root note, and gate fractions for the device
5. Add `drumMap` if the device uses non-standard drum note numbers
