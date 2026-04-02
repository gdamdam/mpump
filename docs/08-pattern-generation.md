# Chapter 8: Pattern Generation & Genre Library

How mpump's 1210+ patterns across 20 genres were created, structured, and compiled.

## Pattern Data Format

All patterns use 16-step grids. Each step is either a note or a rest (`null`).

### Melodic (Synth & Bass)
```json
{ "semi": 0, "vel": 1.0, "slide": false }
```
- `semi` — semitone offset from the current root note (0 = root, 7 = fifth, 12 = octave)
- `vel` — velocity multiplier (1.0 = normal, >1 = accented, <1 = ghost)
- `slide` — portamento to next note (303-style glide)

### Drums
```json
[{ "note": 36, "vel": 120 }, { "note": 42, "vel": 100 }]
```
Each step can trigger multiple drum voices simultaneously.

| Voice | MIDI | Label |
|-------|------|-------|
| Bass Drum | 36 | BD |
| Rim Shot | 37 | RS |
| Snare | 38 | SD |
| Closed Hat | 42 | CH |
| Open Hat | 46 | OH |
| Cowbell | 47 | CB |
| Cymbal | 49 | CY |
| Clap | 50 | CP |
| Ride | 51 | RD |

## Generation Pipeline

### 1. Pattern Definition (Python)

Patterns are hand-written in Python scripts using helper functions:

```python
N(semi, vel=1.0, slide=False)  # melodic note
H(note, vel=100)                # drum hit
R = None                        # rest
```

**Files:**
- `scripts/generate_new_patterns.py` — original 15 genres (~910 patterns)
- `scripts/generate_new_genres.py` — 5 additional genres (~300 patterns, total ~1210)

### 2. Compilation to JSON

The scripts read existing JSON data, append new patterns, and write:
- `public/data/patterns-s1.json` — all synth melodic patterns
- `public/data/patterns-t8-drums.json` — all drum patterns  
- `public/data/patterns-t8-bass.json` — all bass patterns
- `public/data/catalog.json` — genre metadata (names + pattern descriptions)

### 3. Runtime Loading

`catalog.ts` loads the JSON at startup via `loadCatalog()`. The Engine indexes patterns by genre name. When the user selects a genre + pattern index, the Engine reads the corresponding array from the loaded data.

## Pattern Design Principles

### Per-Genre Conventions

Each genre follows specific rhythmic and melodic conventions:

**Techno (130 BPM):** Four-on-floor kick, driving 1/16 hats, minimal melody on root + minor intervals.

**Acid-Techno (138 BPM):** Same drums as techno but with 303-style bass patterns — lots of slides, filter envelope sweeps, chromatic movement.

**Trance (140 BPM):** Arpeggiated melodies ascending/descending through triads, supersaw pads, uplifting key changes.

**Dub-Techno (118 BPM):** Muted drums, filtered hats, deep sub bass, sparse chords with long reverb tails.

**House (124 BPM):** Four-on-floor, clap on 2+4, offbeat open hats, organ stabs, walking bass.

**DnB (174 BPM):** Breakbeat drums (kick-snare syncopation), Reese bass with LFO, fast arpeggiated leads.

**Dubstep (140 BPM):** Half-time drums (kick on 1, snare on 3), wobble bass, sparse atmospheric synths.

**Lo-Fi (80 BPM):** Boom-bap drums (kick 1+3, snare 2+4), jazzy walking bass, Rhodes chord voicings.

**Synthwave (118 BPM):** 80s-style drums (kick 1+3, gated snare 2+4), octave bounce bass, ascending arpeggios.

**Deep House (122 BPM):** Four-on-floor with subtle 1/16 hats, smooth melodic bass, offbeat organ stabs.

**Psytrance (145 BPM):** Kick on every beat, KBBB bass pattern (kick + 3 bass notes per beat), acid-style leads.

### Pattern Naming Convention

Each pattern has a name and description in `catalog.json`:
```json
{ "name": "Siren Cycle", "desc": "rising minor scale loop" }
```
Names are evocative (not technical) to help users browse. Descriptions explain the musical character.

### Pattern Counts

| Genre | Synth | Drums | Bass | Total |
|-------|-------|-------|------|-------|
| Original 15 genres | 310 | 300 | 300 | 910 |
| 5 new genres | 100 | ~97 | 100 | ~297 |
| **Total** | **410** | **~397** | **400** | **~1207** |

## How to Add More Patterns

1. Create or edit a Python script in `scripts/`
2. Define patterns using `N()`, `H()`, `R` helpers
3. Add metadata (name + description) for each pattern
4. Run the script to update the JSON files
5. The app loads new patterns automatically on next build

## Sources

Pattern conventions were researched from production guides on:

- Studio Brootle
- Attack Magazine
- Native Instruments Blog
- Orpheus Audio Academy
- Evosounds
- Musical-U
- Baby Audio
- Synthwave Pro
- DJ.Studio
- EDMProd
- Mixed In Key
- UJAM Tutorials
- Transmission Samples
- Loopmasters
- Mode Audio
- Wikipedia
