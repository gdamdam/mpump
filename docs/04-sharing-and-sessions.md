# Chapter 4: Sharing & Sessions

How mpump encodes your beat into a URL, serves it to receivers, and persists everything between visits.

## Share Links

Click **Share** in the header and mpump encodes your full session state into a single URL:

```
https://s.mpump.live/?b=eyJicG0iOjE0MCwiZyI6ey...
                        └─── base64 payload ───┘
```

### What Gets Encoded

The share payload captures everything needed to reproduce your beat:

```typescript
{
  bpm: 140,                    // tempo
  sw: 0.1,                     // swing amount
  dk: "House",                 // drum kit preset name
  sp: "Supersaw",              // synth preset name
  bp: "Acid Bass",             // bass preset name
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
  mu: "010",                   // mute states (drums, bass, synth)
  cv: "70,80,65",              // channel volumes (%)
  spp: { ot: "sawtooth", ... }, // synth params (compact keys)
  bpp: { ot: "square", ... },  // bass params (compact keys)
  gs: "0,0.5,0.3|100,0.6,0.4" // gesture recording (t,x,y)
}
```

### Encoding

```
Object → JSON.stringify → btoa (base64) → URL-safe substitution
                                           + → -
                                           / → _
                                           trailing = stripped
```

Synth parameters use compact 2–4 character keys to reduce URL length (e.g., `oscType` → `ot`, `attack` → `a`, `filterOn` → `fo`). Only parameters that differ from defaults are included.

### Size Limits

| Data | Limit |
|------|-------|
| Pattern edit string | 4000 chars max |
| Pattern steps | 64 max |
| Drum hits per step | 16 max |
| Gesture points | 500 max (30 for URL-embeddable links, rest is QR-only) |
| BPM | 20–300 |
| Genre/pattern indices | 0–200 |

### Validation

Share payloads are validated on decode with strict rules:

- Prototype pollution keys rejected (`__proto__`, `constructor`, `prototype`)
- BPM required and clamped to 20–300
- Genre indices clamped to 0–200
- Effect names checked against a whitelist of 8 valid names
- Synth params: only number, boolean, and short string values allowed
- String values capped at 20 characters

## Cloudflare Worker

A Cloudflare Worker at `s.mpump.live` handles share link previews:

```
Browser opens s.mpump.live/?b=...
          │
          ▼
    Is this a bot? (Twitter, Slack, Discord, etc.)
          │                    │
         yes                  no
          │                    │
          ▼                    ▼
  Serve HTML with          302 redirect to
  Open Graph tags          mpump.live/?b=...
  + og:image URL
```

**Bot detection**: checks User-Agent for known crawlers (Twitterbot, Slackbot, Discord, etc.)

**OG tags served to bots**:
- `og:title` — track name or "mpump beat"
- `og:description` — BPM, genre, effects summary
- `og:image` — dynamically generated 800x800 PNG card

**Image generation**: the Worker decodes the payload and renders a PNG card with genre name, BPM, active effects, and an accent color derived from BPM (purple at slow tempos, red at fast).

For regular browsers, the Worker does a 302 redirect to `https://mpump.live/?b=<payload>`, where the main app handles the share link.

## Receiver Flow

When someone opens a share link:

```
1. Browser loads mpump.live/?b=<payload>
          │
          ▼
2. App.tsx parses ?b= query param
   (also checks legacy #hash format)
          │
          ▼
3. Share gate UI shown:
   - ShareModal renders a static preview card
   - "Someone shared a beat with you" message
   - Play button
          │
          ▼
4. User clicks Play
          │
          ▼
5. startPreview(true) initializes audio engine
          │
          ▼
6. Payload decoded + validated via validateSharePayload()
          │
          ▼
7. State applied via engine commands:
   - set_genre, set_pattern (per device)
   - set_bpm, set_swing
   - set_synth_params, set_bass_synth_params
   - set_effect (per active effect)
   - bulk_set_pattern (if pattern edits exist)
   - set_channel_volume, toggle_mute
          │
          ▼
8. Playback starts — receiver hears the sender's beat
```

The share link also listens for `hashchange` and `popstate` events, so if a user pastes a new share link while the app is already open, it triggers a new share gate without reloading.

## Session Persistence

mpump uses localStorage for all persistence — no database, no accounts, nothing stored server-side.

### Auto-Save

Sessions are automatically saved on two triggers:

1. **`beforeunload`** — saves when you close the tab or navigate away
2. **Periodic interval** — saves every ~30 seconds while the app is running

The auto-save captures everything: BPM, swing, volumes, all device state (genres, patterns, edits, synth params), effects, settings, and theme.

### Auto-Restore

On next visit, the app restores your last session automatically:

```
Page loads → catalog fetched → devices connected
                                      │
                                      ▼
                              Load mpump-autosave
                              from localStorage
                                      │
                                      ▼
                              applySession() restores
                              all state after 200ms delay
```

The 200ms delay ensures the audio engine is fully initialized before state is applied.

### Continue Prompt

The landing page shows a "Continue" button if a previous session exists, with the genre name and timestamp. This loads from `mpump-last-session`.

### Manual Save/Load

Users can manage sessions explicitly:

| Action | Storage Key | UI |
|--------|------------|-----|
| Auto-save | `mpump-autosave` | Automatic |
| Last session | `mpump-last-session` | Continue button on landing |
| Recent sessions | `mpump-recent-sessions` | Up to 5, newest first |
| Saved sessions | `mpump-saved-sessions` | 💾 button, named, with rename/delete |
| Session presets (Pins) | `mpump-presets` | Pins menu, quick-load |

### Export / Import

**Export**: downloads a `.json` file containing the full `SessionData` object. Uses the File System Access API for a native "Save As" dialog when available (Chrome/Edge), falls back to a standard download.

**Import**: opens a file picker for `.json` files. The file is read via `FileReader`, parsed, validated (must have `version` and `devices` fields), then applied to the engine.

Filename format: `mpump-session-2026-03-28-15-30.json`

## localStorage Schema

43 keys organized by category:

### Session Management
| Key | Type | Description |
|-----|------|-------------|
| `mpump-autosave` | SessionData | Auto-saved state (restored on reload) |
| `mpump-last-session` | RecentSession | Last played session (for Continue prompt) |
| `mpump-recent-sessions` | RecentSession[] | Up to 5 recent sessions |
| `mpump-saved-sessions` | SavedSession[] | User-managed session library |
| `mpump-presets` | object | Pin presets |

### Sound & Patterns
| Key | Type | Description |
|-----|------|-------------|
| `mpump-sounds-synth` | object | Custom synth presets |
| `mpump-sounds-bass` | object | Custom bass presets |
| `mpump-kits-drums` | object | Custom drum kit presets |
| `mpump-extras` | object | User-created patterns |
| `mpump-samples` | object | Custom audio samples (base64) |

### Effects & Audio
| Key | Type | Description |
|-----|------|-------------|
| `mpump-effects` | object | Full effect settings |
| `mpump-effect-order` | string[] | Effect chain order |

### Settings
| Key | Type | Description |
|-----|------|-------------|
| `mpump-track-name` | string | Current track name |
| `mpump-scale-lock` | string | Scale lock mode |
| `mpump-arp-mode` | string | Arpeggiator mode |
| `mpump-arp-rate` | string | Arpeggiator rate |
| `mpump-humanize` | boolean | Humanize toggle |
| `mpump-sidechain` | boolean | Sidechain duck toggle |
| `mpump-metronome` | boolean | Metronome toggle |
| `mpump-palette` | string | Theme/color palette |
| `mpump-gesture` | array | Gesture recording points |

### UI State & Flags
| Key | Type | Description |
|-----|------|-------------|
| `mpump-tutorial-done` | "1" | Tutorial completed |
| `mpump-animations` | boolean | Animation toggle |
| `mpump-link-bridge` | string | Link Bridge state |
| `mpump-logo-pulse` | string | Logo pulse mode |
| `mpump-start-genre` | string | Genre selected on landing page |

All keys use the `mpump-` prefix. The storage utility functions (`storage.ts`) wrap `localStorage` with try-catch for private browsing compatibility and silent failure on quota exceeded.

## Privacy

No data ever leaves the browser except:

- **GoatCounter** — anonymous page view counter (no cookies, no user IDs, no PII)
- **Share links** — the URL itself contains your beat data, transmitted when you share it
- **Cloudflare Worker** — decodes the share payload only to generate OG preview tags, stores nothing

There are no accounts, no analytics beyond page views, no cookies, and no tracking pixels. The core app runs client-side with localStorage as the only persistence layer. Sharing and jamming use stateless relays.
