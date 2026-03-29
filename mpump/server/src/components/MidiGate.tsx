import { useState, useEffect, useRef } from "react";
import { trackEvent } from "../utils/metrics";
import type { MidiState } from "../types";
import { isInstallAvailable, triggerInstallPrompt } from "../main";
import { PALETTES, applyPalette } from "./Settings";
interface Props {
  midiState: MidiState;
  onConnectMidi: () => void;
  onPreview: (genre?: string) => void;
  midiSupported: boolean;
}

export function MidiGate({ midiState, onConnectMidi, onPreview, midiSupported }: Props) {
  const [canInstall, setCanInstall] = useState(isInstallAvailable);
  const [logoKey, setLogoKey] = useState(0);
  const logoClickCount = useRef(0);
  const logoClickTimer = useRef(0);
  const flashTimer = useRef(0);

  useEffect(() => {
    const handler = () => setCanInstall(true);
    window.addEventListener("mpump-install-available", handler);
    return () => window.removeEventListener("mpump-install-available", handler);
  }, []);

  const isIOS = /iPad|iPhone/.test(navigator.userAgent) && !("standalone" in navigator && (navigator as unknown as { standalone: boolean }).standalone);

  return (
    <div className="midi-gate">
      <pre className="midi-gate-logo" key={logoKey} style={{ cursor: "pointer" }} onClick={() => {
        logoClickCount.current++;
        setLogoKey(k => k + 1);
        clearTimeout(logoClickTimer.current);
        logoClickTimer.current = window.setTimeout(() => {
          if (logoClickCount.current >= 2) {
            const p = PALETTES[Math.floor(Math.random() * PALETTES.length)];
            applyPalette(p);
          }
          logoClickCount.current = 0;
        }, 400);
      }}>{"█▀▄▀█ █▀█ █ █ █▀▄▀█ █▀█\n█ ▀ █ █▀▀ ▀▄▀ █ ▀ █ █▀▀"}</pre>

      <div className="midi-gate-subtitle">Instant Browser Groovebox</div>
      <div className="midi-gate-intro">
        Drums, bass, synth, effects — ready in seconds.
      </div>

      <button className="midi-gate-btn midi-gate-btn-preview" title="Start playing with browser audio"
        style={{ background: "#66ff99", borderColor: "#66ff99", color: "#000" }}
        onClick={() => { trackEvent("play-start"); setLogoKey(k => k + 1); clearTimeout(flashTimer.current); flashTimer.current = window.setTimeout(() => onPreview(), 450); }}>
        ▶ Play
      </button>

      <div className="midi-gate-featured">
        <span className="midi-gate-pill">Instant Grooves</span>
        <span className="midi-gate-pill">Playable Links</span>
        <span className="midi-gate-pill">Jam &amp; Live Set</span>
      </div>

      <div className="midi-gate-about">
        <a href="./landing.html?about">About mpump</a>
      </div>


      {midiState === "denied" && (
        <div className="midi-gate-subtle">
          MIDI access was denied. <button className="midi-gate-retry" title="Retry MIDI access" onClick={onConnectMidi}>Retry</button>
        </div>
      )}


      <span className="title-version midi-gate-version">v{__APP_VERSION__} · <a href="https://github.com/gdamdam/mpump" target="_blank" rel="noopener noreferrer">Source Code (AGPL-3.0)</a></span>
    </div>
  );
}
