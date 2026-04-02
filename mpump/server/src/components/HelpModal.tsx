/**
 * HelpModal — Organized help reference for all features.
 */

import { useState, useEffect } from "react";

interface Props {
  onClose: () => void;
  onShowTutorial: () => void;
  onShowCredits: () => void;
}

const SECTIONS = [
  {
    title: "Getting Started",
    items: [
      "mpump is a browser groovebox — drums, bass, synth, and effects. Pick a genre, get a groove, tweak it, share it as a link.",
      "Click **Start playing** — music plays instantly, no setup needed",
      "Hit **MIX** to randomize everything — genre, pattern, and sounds",
      "Use **↩** next to MIX to undo (keeps last 3 mixes)",
      "Use **◀ ▶** arrows or **click genre/pattern names** to browse",
      "Use the **preset dropdowns** to change drum kit, synth, and bass sounds",
    ],
  },
  {
    title: "Three Views",
    items: [
      "**KAOS** — XY performance pad. Drag to control filter cutoff and resonance. Toggle effects, reorder the chain",
      "**SYNTH** — Full step-grid editor. Edit patterns, tweak oscillator, ADSR, filter, drum kit, Euclidean rhythms, arpeggiator",
      "**MIXER** — Analog needle VU meter, per-channel volume faders, mute/solo, pan, mono, 3-band EQ, drive, anti-clip limiter",
    ],
  },
  {
    title: "KAOS Pad & Effects",
    items: [
      "**Drag** the pad to control two parameters (selectable at bottom-left and bottom-right)",
      "Available targets: Cutoff, Resonance, Distortion, Highpass, BPM, Swing, Volume",
      "**Double-tap** the pad to cycle through visualizer modes",
      "**Triple-tap** the pad to randomize all patterns",
      "**Effects** — tap to toggle on/off, **hold** to edit parameters",
      "**Chain order** — click the chain text below effects to open the reorder modal. Drag effects to change signal flow",
      "**CHAOS** button — auto-shuffles patterns every 4 beats",
      "**Gesture recording** — click REC, drag the pad, stop REC. Click LOOP to replay the gesture in a loop. CLEAR to erase",
      "**Visualizer** — 4 background modes: Mirrored Bars, Waveform Glow, Circular, Spectrum. Change in Settings",
    ],
  },
  {
    title: "Drums & Bass",
    items: [
      "**Click BD/SD/CH labels** in the grid to mute individual drum voices",
      "**Drum Kit** selector — 15 kits (808 Classic, 909 Punchy, Lo-Fi, Boom Box, Glitch, etc.)",
      "**Bass** has independent mute, genre, and pattern controls",
      "**Euclidean** generator — set hits, steps, and rotation per voice. Click PASTE to bake into the grid",
      "**Humanize** checkbox — adds subtle velocity variation for a more human feel",
      "**Samples** — load custom WAV/MP3/OGG drum samples per voice",
    ],
  },
  {
    title: "Sound Design (SYNTH mode)",
    items: [
      "**33 synth presets** — Default, Classic Saw, Warm Pad, Acid Squelch, Screamer, Supersaw, Neuro, Dub Chord, House Stab, Trance Arp, EDM Pluck, and more",
      "**22 bass presets** — Deep Sub, Acid Bass, Wobble, Reese, House Pump, Garage Bass, Trance Sub, Foghorn, Zapper, and more",
      "**Oscillator** — SAW, SQR, SIN, TRI, PWM, SYNC, FM, WTB waveforms",
      "**ADSR** — Attack, Decay, Sustain, Release envelope with visual curve",
      "**Filter** — LPF, HPF, BPF, Notch with cutoff and resonance",
      "**Sub Bass** — adds a sine wave one octave below",
      "**LFO** — modulates cutoff or pitch. Free (Hz) or tempo-synced divisions",
      "**Scale lock** — constrain notes to major, minor, pentatonic, blues, dorian, mixolydian",
      "**Arpeggiator** — up, down, up-down, random modes at 1/4, 1/8, 1/16 rate",
      "**Duck** — auto-duck bass/synth on kick hits",
      "**Pattern copy/paste** — copy across genres and devices",
    ],
  },
  {
    title: "Mixer",
    items: [
      "**Needle VU meter** — analog gauge with dB scale (-40 to +3), peak hold, clip indicator",
      "**Channel faders** — independent volume for Drums, Synth, Bass, and Master",
      "**Mute (M)** — per-channel mute with activity LEDs",
      "**Solo (S)** — solo a single channel, muting all others",
      "**Pan** — per-channel stereo panning",
      "**Mono** — collapse a channel to mono (useful for bass)",
      "**EQ** — 3-band master equalizer (LOW/MID/HIGH, ±12 dB) with live dB readout and clip indicator",
      "**DRV** — master drive/saturation (-6 to +12 dB) with waveform preview",
      "**Anti-clip limiter** — on by default, prevents digital clipping. Hybrid mode (beta) in Settings",
      "**LIMIT button** — toggle limiter on/off from the VU panel",
      "**Mix Scenes (SCN)** — 10 built-in profiles (Neutral, Punchy, Warm, Airy, Tight, Heavy, Mellow, Spacious, Crisp, Loud) + save/load user scenes",
    ],
  },
  {
    title: "Header Controls",
    items: [
      "**MIX** — Randomize genre, pattern, and sounds",
      "**↩** — Undo last MIX (up to 3 levels)",
      "**▶/⏹** — Play/stop all instruments",
      "**REC** — Record audio to WAV file",
      "**▲▼ BPM** — Adjust tempo (hold for continuous change)",
      "**TAP** — Tap repeatedly to set tempo",
      "**SW** — Swing/shuffle (in the sub-header bar)",
      "**⇩/⇧** — Export/import full session as JSON",
      "**⤴** — Share current setup as a link",
      "**⚙** — Settings (volume, themes, experimental features)",
    ],
  },
  {
    title: "Keyboard Shortcuts",
    items: [
      "**Space** — Play/stop",
      "**R** — Randomize all",
      "**← →** — Switch focused instrument (drums/bass/synth)",
      "**↑ ↓** — Cycle sound preset",
      "**Shift + ← →** — Previous/next pattern",
      "**Shift + ↑ ↓** — Previous/next genre",
      "**M** — Mute/unmute focused instrument",
      "**S** — Solo/unsolo focused instrument",
      "**L** — Lock/unlock sound (protects from MIX)",
      "**Shift + M** — MIX (randomize all)",
      "**B** — Set BPM (opens input modal)",
      "**Tab / Shift+Tab** — Cycle views (KAOS → SYNTH → MIXER)",
      "**1 / 2 / 3** — Switch to KAOS / SYNTH / MIXER",
      "**?** — Open help",
      "**Cmd+Z / Ctrl+Z** — Undo pattern edit",
      "**Escape** — Close any open modal",
    ],
  },
  {
    title: "Session & Sharing",
    items: [
      "**Session export (⇩)** — saves everything as a JSON file: patterns, sounds, effects, volumes, chain order, settings, theme",
      "**Session import (⇧)** — restores a full session from JSON",
      "**Share link (⤴)** — generates a URL with your setup. Anyone who opens it gets the same genre, pattern, BPM, and effects",
      "**Record (REC)** — captures mixed audio output as WAV",
      "**MIDI export** — downloads the current pattern as a .mid file",
      "**Pattern Library (♫)** — browse all 1210+ patterns with search",
      "**Presets** — save/load named presets from the sub-header bar",
    ],
  },
  {
    title: "Settings (Experimental)",
    beta: true,
    items: [
      "**Anti-Clip** — Limiter (default), Hybrid (beta), or Off",
      "**Metronome** — click track on quarter notes",
      "**Humanize** — subtle random velocity variation",
      "**Duck** — auto-duck on kick hits",
      "**CV Output** — 1V/oct pitch + gate for DC-coupled audio interfaces",
      "**MIDI Clock In** — sync to external MIDI clock (24 PPQN) with Start/Stop/Continue transport control. Steps are tick-driven for tight sync. Use IAC Driver (Mac) or loopMIDI (Windows) to sync with Ableton Live or any DAW",
      "**Song Mode** — arrange pattern sequences",
      "**KAOS Viz** — 4 pad visualizers: Mirrored Bars, Waveform Glow, Circular, Spectrum",
      "**MIX Effect** — visual feedback on MIX: Shake, Flash, Both, or Off",
    ],
  },
  {
    title: "MIDI Clock Sync",
    items: [
      "Enable **MIDI Clock In** in Settings to sync mpump's sequencer to an external clock source",
      "Supports standard MIDI clock: **0xF8** (tick), **0xFA** (start), **0xFB** (continue), **0xFC** (stop)",
      "Steps are tick-driven (6 ticks = 1 sixteenth note at 24 PPQN) — no BPM estimation, direct sync",
      "BPM is derived from incoming ticks for display only — the external clock is the master",
      "**Ableton Live**: Open Audio MIDI Setup (Mac) → enable IAC Driver. In Ableton Preferences → MIDI, enable Sync output on the IAC port",
      "**Windows**: Install loopMIDI (free) to create a virtual MIDI port. In your DAW, enable Sync output on the loopMIDI port",
      "**Hardware**: Any device that sends MIDI clock (drum machines, Korg SQ-1, etc.) works directly via USB MIDI",
      "Transport control: Start/Stop in your DAW controls mpump playback",
      "Use the **Setup Guide** button in Settings for step-by-step instructions with Mac and Windows tabs",
    ],
  },
  {
    title: "Ableton Link",
    items: [
      "**Ableton Link** provides wireless tempo and transport sync between apps — no cables, no MIDI setup",
      'Download the <strong><a href="https://github.com/gdamdam/mpump/releases/latest" target="_blank" rel="noopener noreferrer">mpump Link Bridge</a></strong> companion app (~3 MB)',
      "Double-click to run — a small window shows tempo, peers, and connection status. Allow the macOS firewall prompt (Link needs local network for peer discovery)",
      "mpump **auto-detects** the Link Bridge — no need to enable anything in Settings. A green dot **●** appears next to the logo when connected",
      "Open Ableton Live (or any Link-enabled app) — they discover each other automatically via your local network",
      "Tempo changes in any app propagate to all Link peers instantly",
      "Works with Ableton Live, Logic Pro, Bitwig, Traktor, djay, and hundreds of Link-enabled iOS/Android apps",
    ],
  },
  {
    title: "USB MIDI Devices",
    items: [
      "Requires **Chrome, Edge, or Opera** (Firefox/Safari don't support Web MIDI)",
      "Click **MIDI** button in the header to connect",
      "50 devices registered: Roland, Korg, Elektron, Novation, Arturia, Behringer, and more",
      "3 tested (S-1, T-8, J-6), 47 registered with expected port names",
      "Hot-plug: connect and disconnect devices while playing",
    ],
  },
  {
    title: "Privacy",
    items: [
      "mpump collects no personal data. No cookies, no accounts, no tracking.",
      "**No cookies** — mpump does not set any cookies",
      "**No personal data** — no accounts, no emails, no tracking IDs",
      "**No fingerprinting** — no device or browser identification",
      "**Anonymous counters** — page views and events (play, share) counted via GoatCounter — no personal data, no cookies, no user IDs",
      "**Local storage only** — presets, settings, patterns stay in your browser",
      "**Open source** — all code is public on GitHub",
    ],
  },
  {
    title: "Sharing & Privacy",
    items: [
      "Share links contain only beat settings (BPM, genre, patterns) — no personal data",
      "Links pass through a stateless relay (s.mpump.live) that adds preview metadata for messaging apps",
      "The relay logs nothing, stores nothing, sets no cookies — it just reads the beat settings from the URL and returns a title like \"135 BPM · idm\"",
      "Only messaging app crawlers (iMessage, Discord, etc.) hit the relay; your browser is redirected straight to mpump",
      "The relay is open source in the same GitHub repo (worker/ folder)",
    ],
  },
];

const isBeta = new URLSearchParams(window.location.search).has("beta");

export function HelpModal({ onClose, onShowTutorial, onShowCredits }: Props) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const [expanded, setExpanded] = useState<number | null>(0);

  return (
    <div className="help-overlay" onClick={onClose}>
      <div className="help-panel" onClick={(e) => e.stopPropagation()}>
        <div className="help-header">
          <span className="help-title">How to use mpump</span>
          <button className="settings-close" title="Close" onClick={onClose}>✕</button>
        </div>
        <button className="help-tutorial-btn" style={{ width: "100%", marginBottom: 8 }} onClick={() => { onClose(); onShowTutorial(); }}>
          ▶ Show tutorial
        </button>
        <div className="help-list">
          {SECTIONS.filter(s => !("beta" in s) || isBeta).map((s, i) => (
            <div key={i} className="help-section">
              <button
                className={`help-section-header ${expanded === i ? "expanded" : ""}`}
                onClick={() => setExpanded(expanded === i ? null : i)}
              >
                <span>{s.title}</span>
                <span className="help-arrow">{expanded === i ? "▼" : "▶"}</span>
              </button>
              {expanded === i && (
                <ul className="help-items">
                  {s.items.map((item, j) => (
                    <li key={j} className="help-item" dangerouslySetInnerHTML={{
                      __html: item.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                    }} />
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <a href="./landing.html?about" className="help-tutorial-btn" style={{ flex: 1, textAlign: "center", textDecoration: "none", color: "inherit" }}>
            About
          </a>
          <button className="help-tutorial-btn" style={{ flex: 1 }} onClick={() => { onClose(); onShowCredits(); }}>
            Credits
          </button>
        </div>
      </div>
    </div>
  );
}
