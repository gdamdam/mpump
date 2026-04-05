# User Guide — Technical Details

Deep reference for sharing, sessions, MIDI devices, live jam, and pattern editing internals. For feature overviews, see [README.md](../README.md).

---

## Share Links

### Payload Encoding

```
Object → JSON.stringify → btoa (base64) → URL-safe substitution (+ → -, / → _, trailing = stripped)
```

Synth params use compact keys to reduce URL length: `oscType` → `ot`, `attack` → `a`, `filterOn` → `fo`. Only non-default values included.

### Payload Structure

```typescript
{
  bpm: 140,                    // tempo
  sw: 0.1,                     // swing
  dk: "House",                 // drum kit preset
  sp: "Supersaw",              // synth preset
  bp: "Acid Bass",             // bass preset
  g: {                         // genre + pattern indices per device
    preview_drums: { gi: 7, pi: 3, bgi: 7, bpi: 2 },
    preview_bass:  { gi: 7, pi: 5 },
    preview_synth: { gi: 7, pi: 1 }
  },
  fx: "10010001",              // effect on/off bitmask
  fp: { delay: { time: 0.3 } }, // non-default effect params
  eo: ["compressor", ...],     // effect chain order
  me: "0,1,0|7,0.8,1|-|...",  // edited synth pattern (compact)
  de: "36.120+42.100|42.80|", // edited drum pattern (compact)
  be: "0,1,0|-5,0.8,0|...",   // edited bass pattern (compact)
  mu: "010",                   // mute states
  cv: "70,80,65",              // channel volumes (%)
  spp: { ot: "sawtooth", ... }, // synth params
  bpp: { ot: "square", ... },  // bass params
  p: "a7x3k"                  // parent short ID (remix lineage)
}
```

### Size Limits

| Data | Limit |
|------|-------|
| Pattern edit string | 4000 chars |
| Pattern steps | 64 |
| Drum hits per step | 16 |
| Gesture points | 500 (30 for URL, rest QR-only) |
| BPM | 20–300 |

### Validation
- Prototype pollution keys rejected (`__proto__`, `constructor`, `prototype`)
- BPM clamped 20–300, genre indices 0–200
- Effect names whitelisted (10 valid)
- Synth param values: number, boolean, string (≤20 chars)

### Short URLs & Relay

The Cloudflare Worker at `s.mpump.live` provides:
- `POST /shorten` — creates short ID, stores in KV, tracks parent lineage
- `GET /{id}` — bots get OG HTML (title: "135 BPM · techno · remixed · N remixes"), browsers get 302 redirect
- `GET /health` — health check (cached 60s client-side)

Client checks relay health first. If up: shorten + show short URL. If down: full self-contained URL (works offline).

### Receiver Flow

```
1. Browser loads mpump.live/?b=<payload>
2. App.tsx parses ?b= (also checks legacy #hash)
3. Share gate UI shown with preview card + Play button
4. User clicks Play → audio engine initializes
5. Payload decoded + validated
6. State applied via engine commands (set_genre, set_bpm, set_synth_params, etc.)
7. Playback starts
```

Also handles `hashchange` and `popstate` — pasting a new share link triggers new share gate without reload.

---

## Song Sharing

Songs use `?song=` URL param with compressed payload:

```
JSON (scenes + arrangement) → CompressionStream (deflate) → base64 → URL param → relay shortener
```

Decoded on load via `DecompressionStream`. Triggers `song_load` command and enables song mode. Continue modal is suppressed for song links.

---

## Session Persistence

All in localStorage — no database, no accounts.

### Auto-Save Triggers
1. `beforeunload` — on tab close/navigate
2. Periodic interval — every ~30s

### Auto-Restore
```
Page loads → catalog fetched → devices connected → Load mpump-autosave → applySession() after 200ms delay
```

The 200ms delay ensures audio engine is fully initialized.

### localStorage Schema

**Session Management:**
| Key | Description |
|-----|-------------|
| `mpump-autosave` | Auto-saved state |
| `mpump-last-session` | Last played (Continue prompt) |
| `mpump-recent-sessions` | Up to 5 recent |
| `mpump-saved-sessions` | User-managed library |
| `mpump-presets` | Groove presets (pins) |

**Sound & Patterns:**
| Key | Description |
|-----|-------------|
| `mpump-sounds-synth` | Custom synth presets |
| `mpump-sounds-bass` | Custom bass presets |
| `mpump-kits-drums` | Custom drum kits |
| `mpump-extras` | User-created patterns |
| `mpump-samples` | Custom samples (base64) |

**Effects:**
| Key | Description |
|-----|-------------|
| `mpump-effects` | Effect settings |
| `mpump-effect-order` | Chain order |

**Settings:**
| Key | Description |
|-----|-------------|
| `mpump-track-name` | Track name |
| `mpump-scale-lock` | Scale lock |
| `mpump-arp-mode` / `mpump-arp-rate` | Arpeggiator |
| `mpump-humanize` / `mpump-sidechain` / `mpump-metronome` | Toggles |
| `mpump-palette` | Theme |
| `mpump-gesture` | Gesture recording |
| `mpump-perf-mode` | Performance mode (normal/lite/eco) |
| `mpump-hint-sessions` | Hint session counter |
| `mpump-hints-seen` | Dismissed hint views |

**UI Flags:**
| Key | Description |
|-----|-------------|
| `mpump-tutorial-done` | Tutorial completed |
| `mpump-animations` | Animation toggle |
| `mpump-link-bridge` | Link Bridge state |

All keys prefixed `mpump-`. Storage utility wraps with try-catch for private browsing.

### Export / Import
Export: downloads `.json` (File System Access API on Chrome/Edge, standard download fallback). Import: FileReader + validation (must have `version` and `devices` fields).

---

## Device Registry

53 MIDI devices recognized by USB port name matching.

```typescript
interface DeviceConfig {
  id: string;              // "s1", "t8"
  label: string;           // "S-1", "T-8"
  portMatch: string;       // MIDI port name substring
  mode: DeviceMode;        // "synth" | "drums" | "drums+bass" | "bass"
  channels: { main: number; bass?: number; };
  rootNote: number;        // 36–60
  gateFraction: number;    // 0.3–0.9
  drumGateFraction: number; // typically 0.1
  baseVelocity: number;   // typically 100
  drumMap?: Record<number, number>;
  hasKey: boolean;
  hasOctave: boolean;
  accent: string;          // UI color
}
```

### Auto-Detection
```
USB plugged in → requestMIDIAccess() → statechange → detectPorts()
  → output.name.includes(portMatch)? → Create MidiPort → Connect → Sync at next bar
```

First substring match wins.

### Preview Mode (No MIDI)
| Virtual Device | Mode | Channel |
|---------------|------|---------|
| preview_drums | drums+bass | 9 (drums), 1 (bass) |
| preview_bass | bass | 1 |
| preview_synth | synth | 0 |

### Pattern-to-Device Mapping
| Device Mode | Melodic | Drum | Bass |
|-------------|---------|------|------|
| synth | S-1 patterns | — | — |
| drums | — | T-8 drums | — |
| drums+bass | — | T-8 drums | T-8 bass |
| bass | T-8 bass | — | — |

---

## Live Jam & Live Set

### Architecture
```
┌─────────┐   wss://    ┌──────────────────┐   wss://    ┌─────────┐
│ Browser │←──────────→│  Relay (Fly.io)  │←──────────→│ Browser │
│ Engine  │            │  ~60 lines Node  │            │ Engine  │
│ Web     │            │  Rooms in memory  │            │ Web     │
│ Audio   │            │  No persistence   │            │ Audio   │
└─────────┘            └──────────────────┘            └─────────┘
```

No audio transmitted. Control messages only (~50 bytes each).

### Two Modes
- **Jam** (up to 4): all peers send + receive
- **Live Set** (1 + 49): only controller sends (relay enforces server-side)

### Message Sizes
| Action | Size |
|--------|------|
| Change genre | ~60B |
| Change BPM | ~30B |
| Toggle mute | ~50B |
| XY pad move | ~30B |
| Effect toggle | ~80B |
| MIX | ~200B |

### What's Broadcast
BPM, key, octave, swing, pattern length, genres, patterns, effects + chain order, mutes, volumes, pans, presets, duck, drive, anti-clip, humanize, metronome, XY pad (15 Hz).

### What Stays Local
Step edits, randomization results, save/clipboard/undo.

### Sync on Join
```
Host ← sync_request ← Relay ← join ← Joiner
Host → sync payload → Relay → sync payload → Joiner (applies all + auto-play)
```

### Bar Sync (Quantize)
Mutes and effects queue, fire at step 0. Prevents awkward mid-bar transitions.

### Feedback Loop Prevention
`remoteRef` flag set during remote command apply → broadcastCommand checks flag → skips re-broadcast. Toggle commands converted to explicit set commands before broadcasting.

### Listener Restrictions (Live Set)
Server: relay ignores non-controller messages. Client: pointer-events:none, XY view-only, shortcuts disabled. Only master volume + REC available.

### Connection
HTTP wake request first (Fly.io sleeps idle). WebSocket retries: 5 attempts with 1–5s backoff. Guard against stale connections via WebSocket reference check.

---

## Contextual Hints

Post-tutorial hints shown per view for first 3 sessions:
- Session count tracked in `mpump-hint-sessions`
- Per-view dismiss tracking in `mpump-hints-seen`
- Hints disappear on click, auto-expire after 3 sessions
- Content differs per view (KAOS, SYNTH, MIXER)

---

## Remix Lineage

- Parent ID (`p`) carried in share payload and URL params
- Remix banner shown below header when opening a remixed beat
- One-tap remix share when user makes changes (3-second delay ignores initial load)
- MIX clears remix parent (no longer a remix after randomize)
- Relay tracks parent→child relationships and remix counts in KV
