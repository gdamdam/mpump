# Chapter 6: Live Jam & Live Set

Real-time collaborative sessions where multiple browsers play the same beat simultaneously over the internet.

## How It Works

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  Each browser runs its own audio engine (Web Audio API).     │
│  No audio is ever transmitted. Only control messages         │
│  (~50 bytes each) flow through a WebSocket relay.            │
│                                                              │
│  Think of it like MIDI over the internet:                    │
│  "change to genre 3, pattern 5, BPM 128"                    │
│  not "here's 44.1kHz stereo audio"                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Two Modes

```
JAM (up to 4)                    LIVE SET (1 + 49)
┌─────┐  ┌─────┐                ┌─────┐
│  A  │←→│  B  │                │ DJ  │──→ Listener 1
└─────┘  └─────┘                │     │──→ Listener 2
   ↕        ↕                   │     │──→ Listener 3
┌─────┐  ┌─────┐                │     │──→ ...
│  C  │←→│  D  │                │     │──→ Listener 49
└─────┘  └─────┘                └─────┘
Everyone sends + receives       Only controller sends
```

In **Jam** mode, all peers can change anything. Changes propagate instantly to everyone.

In **Live Set** mode, one controller drives the session. Listeners hear everything the controller does but cannot send commands. The relay enforces this server-side.

## Creating and Joining

1. Click the **Jam/Live Set** button in the header
2. Choose **Create Jam Room** or **Start Live Set**
3. The relay assigns a random 6-character room code
4. Share the room URL with others. They click it to join automatically

When a new peer joins, the host sends a full state snapshot: BPM, key, octave, genre, pattern indices, effect states, synth/bass presets, mute states, and volumes. The joiner stays silent until this sync completes, preventing desynchronized playback.

## Message Flow

```
User action          What's sent                    Size
─────────────────────────────────────────────────────────
Change genre         {set_genre, device, idx}        ~60B
Change BPM           {set_bpm, bpm: 128}             ~30B
Toggle mute          {set_drums_mute, muted: true}   ~50B
Change drum kit      {jam_set_drum_kit, id: "3"}     ~40B
XY pad move          {xy, x: 0.5, y: 0.3}           ~30B
Effect toggle        {set_effect, name, params}      ~80B
MIX (randomize)      {load_preset, bpm, genres}     ~200B
```

**Broadcast to all peers:**
- Tempo (BPM), key, octave, swing, pattern length
- Genre and pattern selection (drums, bass, synth)
- All effect states and effect chain order
- Mute states, channel volumes, panning
- Sound preset changes (drum kit, synth, bass)
- Sidechain duck, drive, anti-clip, humanize, metronome
- XY pad movements (throttled to 15 Hz)

**Stays local (not broadcast):**
- Individual step edits in the grid
- Randomization (results would differ per peer)
- Save, clipboard, and undo operations

## Infrastructure

```
┌─────────┐     wss://      ┌──────────────────┐     wss://      ┌─────────┐
│ Browser │ ←──────────────→│  Relay (Fly.io)  │←──────────────→ │ Browser │
│         │                 │                  │                 │         │
│ React   │                 │  60 lines Node   │                 │ React   │
│ Engine  │                 │  Rooms in memory  │                 │ Engine  │
│ Web     │                 │  No persistence   │                 │ Web     │
│ Audio   │                 │  No IP logging    │                 │ Audio   │
└─────────┘                 └──────────────────┘                 └─────────┘
  🔊 local                    just a router                       🔊 local
  synthesis                   for JSON msgs                       synthesis
```

The relay is a stateless WebSocket server running on Fly.io. It maintains an in-memory map of rooms, each containing a set of connected peers.

**What the relay does:**
- Creates rooms on first join, deletes them when empty
- Broadcasts messages from one peer to all others in the room
- Enforces peer limits (4 for jam, 50 for live set)
- Enforces role permissions (only controllers broadcast in live set)
- Promotes a new controller if the original one disconnects

**What the relay does NOT do:**
- Log IP addresses
- Store any messages or session data
- Persist rooms (everything is in-memory, gone on restart)

## Key Design Decisions

**Why WebSocket relay, not P2P WebRTC?**
- WebRTC requires STUN/TURN servers and fails ~15% of the time
- We tested Trystero (Nostr, MQTT, BitTorrent). All unreliable
- WebSocket relay is 60 lines, works 100%, costs $0 on Fly.io free tier
- For ~50 byte messages, the relay adds negligible latency (~20ms)
- Bonus: relay hides peer IPs from each other (better privacy than P2P)

**Why not stream audio?**
- Audio streaming needs ~128kbps per listener (WebRTC or media server)
- Control messages need ~0.5kbps total. 250,000x less bandwidth
- Each browser already has the synth engine. Just send it the same instructions
- Result: 49 listeners cost the same bandwidth as 1

## How Sync Works on Join

```
Host                    Relay                   Joiner
 │                        │                       │
 │                        │←── join room ──────────│
 │←── sync_request ───────│                        │
 │                        │                        │
 │── sync payload ───────→│── sync payload ───────→│
 │   (genres, BPM,        │                        │
 │    sounds, mutes,      │                   applies all
 │    volumes, effects)   │                   + auto-play
```

## Bar Sync (Quantize)

When enabled, mutes and effect changes queue up and fire together on the next bar boundary (step 0). This prevents awkward mid-bar transitions when peers have slight timing differences.

```
User clicks MUTE at step 11
  │
  ├→ NOT applied yet (queued)
  │
  │  step 12... 13... 14... 15...
  │
  ├→ step 0: FLUSH
  │  ├→ apply locally (rawCommand)
  │  └→ broadcast to peers (set_drums_mute, muted: true)
  │
  └→ Both peers hear the mute ON THE BEAT
```

## Feedback Loop Prevention

When a peer receives a remote command, a flag is set while applying it locally. This prevents the command from being re-broadcast back to other peers.

```
Peer A sends set_bpm → Relay → Peer B receives
                                    │
                              remoteRef = true
                              rawCommand(set_bpm)  ← applies to engine
                              remoteRef = false
                                    │
                              broadcastCommand checks remoteRef
                              → it was true during apply
                              → skips broadcast
                              → no feedback loop
```

Toggle commands (like "toggle mute") are converted to explicit set commands ("set mute on/off") before broadcasting, ensuring all peers end up in the same state regardless of their starting state.

## Listener Restrictions (Live Set)

```
Server-side:  relay ignores all messages from non-controller
Client-side:  pointer-events:none on controls
              XY pad view-only (no touch handlers)
              Keyboard shortcuts disabled
              Only master volume + REC available
```

## Connection Handling

On first connect, the client sends an HTTP request to wake the relay (Fly.io may sleep idle instances). The WebSocket connection retries up to 5 times with increasing backoff (1s, 2s, 3s, 4s, 5s). When a peer intentionally leaves, retries are disabled.

A guard prevents stale connections. If the WebSocket reference has changed (due to reconnect), old message handlers are ignored.

## Privacy

- Only control data crosses the network. No audio, no personal information
- Room codes are random and ephemeral. They exist only in relay memory
- No IPs are logged, no data is stored, no cookies are set
- The relay processes messages in real time and keeps nothing

## Analytics

Five anonymous events are counted via GoatCounter (no personal data):
- `jam-create` / `jam-join` / `jam-peer-joined`
- `liveset-create` / `liveset-join`
