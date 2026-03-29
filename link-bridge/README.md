<h1 align="center">mpump Link Bridge</h1>
<p align="center">Companion app for <a href="https://mpump.live">mpump.live</a> — bridges Ableton Link to the browser.<br>Wireless tempo and transport sync with Ableton Live, Logic Pro, and any Link-enabled app.<br>Download, double-click, done.</p>

<p align="center">
  <a href="https://github.com/gdamdam/mpump"><img src="https://img.shields.io/badge/version-0.1.0-blue" alt="Version"></a>
  <a href="https://github.com/gdamdam/mpump/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0-green" alt="License"></a>
  <a href="https://github.com/gdamdam/mpump"><img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey" alt="Platforms"></a>
  <a href="https://claude.ai/code"><img src="https://img.shields.io/badge/Built%20with-Claude%20Code-blueviolet?logo=anthropic&logoColor=white" alt="Built with Claude Code"></a>
</p>

> **Open source & safe:** The Link Bridge is fully open source (GPL-3.0). It makes no internet connections — only local network UDP for Link peer discovery and localhost WebSocket for browser sync. All code is auditable at [github.com/gdamdam/mpump/tree/main/link-bridge](https://github.com/gdamdam/mpump/tree/main/link-bridge).

---

## What it does

Ableton Link is a protocol for wireless tempo sync between music apps. Browsers can't speak Link directly (it uses UDP multicast), so this tiny companion app acts as a bridge.

```
Ableton Live ←→ Link Bridge ←→ mpump.live (browser)
                  ↕
            Other Link apps
```

- **Tempo sync** — change tempo in any app, all peers follow
- **Transport sync** — start/stop propagates across all Link peers
- **Zero config** — apps discover each other automatically on your local network
- **Multiple browsers** — any number of mpump tabs can connect

## Quick Start

1. **Download** the latest release from the [GitHub releases page](https://github.com/gdamdam/mpump/releases)
2. **Run** the app — a small window appears showing tempo, peers, and connection status
3. **macOS firewall prompt**: Click **Allow** — Link needs local network access to discover Ableton and other peers (see [Network](#network) below)
4. **Open** [mpump.live](https://mpump.live) → Settings → enable **Ableton Link (beta)**
4. **Open** Ableton Live (or any Link-enabled app) — sync starts automatically

That's it. No terminal, no Python, no configuration.

## How it works

The Link Bridge runs two things:

1. **Ableton Link peer** — joins the Link session on your local network (uses [rusty_link](https://github.com/anzbert/rusty_link), a Rust wrapper around the official Ableton Link SDK)
2. **WebSocket server** on `ws://localhost:19876` — mpump.live connects to this automatically when Link is enabled in Settings

The bridge broadcasts Link state (tempo, beat, phase, playing, peers) at 20Hz. When mpump sends a tempo change, it propagates to all Link peers.

## UI

The app window (300×400, always-on-top) shows:

- Current tempo from the Link session
- Number of Link peers connected
- Playing/stopped transport state
- Number of browser clients connected
- Start/Stop button

## Protocol

JSON messages over WebSocket:

**Server → Browser** (20Hz):
```json
{"type":"link","tempo":120.0,"beat":2.5,"phase":0.625,"playing":true,"peers":1,"clients":1}
```

**Browser → Server**:
```json
{"type":"set_tempo","tempo":130.0}
{"type":"set_playing","playing":true}
```

## Build from source

Requires [Rust](https://rustup.rs/) and [Node.js](https://nodejs.org/).

```bash
cd link-bridge
npm install
npx tauri build
```

The output is in `src-tauri/target/release/bundle/`:
- **macOS**: `.dmg` in `dmg/`
- **Windows**: `.msi` in `msi/` or `.exe` in `nsis/`
- **Linux**: `.deb` in `deb/` or `.AppImage` in `appimage/`

### Build requirements

- **Rust** 1.70+ (install via [rustup.rs](https://rustup.rs/))
- **Node.js** 18+ (for Tauri CLI)
- **C++ compiler** (Xcode CLT on macOS, MSVC on Windows) — needed to compile the Link SDK
- **macOS**: Xcode Command Line Tools (`xcode-select --install`)
- **Windows**: Visual Studio Build Tools with "Desktop development with C++"
- **Linux**: `build-essential`, `libgtk-3-dev`, `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`

## Project structure

```
link-bridge/
  package.json              # Tauri CLI
  src/
    index.html              # Frontend UI (single file, no framework)
  src-tauri/
    Cargo.toml              # Rust dependencies
    tauri.conf.json          # Tauri window/bundle config
    capabilities/
      default.json           # Tauri v2 permissions
    src/
      main.rs               # Link peer + WebSocket server
```

## Dependencies

| Crate | Version | Purpose |
|-------|---------|---------|
| `tauri` | 2.x | Native app shell |
| `rusty_link` | 0.4 | Ableton Link SDK (Rust bindings) |
| `tokio` | 1.x | Async runtime |
| `tokio-tungstenite` | 0.24 | WebSocket server |
| `serde` / `serde_json` | 1.x | JSON serialization |
| `futures-util` | 0.3 | Stream utilities |

## Network

The Link Bridge makes **two types of network connections**, both local:

1. **UDP multicast** on `224.76.78.75:20808` (LAN only) — this is how Ableton Link discovers peers on your local network. It triggers the macOS firewall prompt on first launch. **Click Allow** — without it, Link can't find Ableton or other apps. Nothing leaves your local network.

2. **TCP listen** on `127.0.0.1:19876` (localhost only) — the WebSocket server that mpump.live connects to. Only your own machine can reach it.

**No internet connection is made.** The app never contacts any external server.

## FAQ

**Why not just use MIDI clock?**
You can — mpump already supports MIDI Clock In (see Settings → Setup Guide). Link is an alternative that requires no cables, no virtual MIDI drivers, and syncs tempo + phase automatically.

**Why a separate app?**
Browsers can't open UDP sockets or join multicast groups, which is how Link discovers peers. A native bridge is the only way to connect a browser to a Link session.

**How big is the app?**
~5 MB on macOS, ~3 MB on Windows. It's built with Tauri (Rust + system webview), not Electron.

**Does it work with other Link apps?**
Yes — anything that supports Ableton Link: Ableton Live, Logic Pro, Bitwig, Reason, Serato DJ, djay, Traktor, and hundreds of iOS/Android music apps.

**Can I run it headless?**
Not yet. The Tauri window is required. A headless CLI version could be added in the future.

## License

[GPL-3.0](../LICENSE) — same license as mpump.

The Ableton Link SDK (compiled via `rusty_link`) is released under the [GPL-2.0-or-later](https://github.com/Ableton/link/blob/master/LICENSE.md) license by Ableton.
