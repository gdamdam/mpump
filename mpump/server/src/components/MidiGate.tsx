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

const SEQ_PATTERN = [1,0,0,0,1,0,1,0,1,0,0,1,0,0,1,0];

export function MidiGate({ midiState, onConnectMidi, onPreview, midiSupported }: Props) {
  const [canInstall, setCanInstall] = useState(isInstallAvailable);
  const [logoKey, setLogoKey] = useState(0);
  const logoClickCount = useRef(0);
  const logoClickTimer = useRef(0);
  const flashTimer = useRef(0);
  const seqGridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = seqGridRef.current;
    if (!grid) return;
    const cells: HTMLDivElement[] = [];
    for (let i = 0; i < 16; i++) {
      const s = document.createElement("div");
      s.className = "mg-seq-step" + (SEQ_PATTERN[i] ? " dim-on" : "");
      grid.appendChild(s);
      cells.push(s);
    }
    let cur = 0;
    const id = setInterval(() => {
      cells.forEach((c, i) => { c.className = "mg-seq-step" + (SEQ_PATTERN[i] ? " dim-on" : ""); });
      cells[cur].className = "mg-seq-step on";
      cur = (cur + 1) % 16;
    }, 160);
    return () => { clearInterval(id); grid.innerHTML = ""; };
  }, []);

  useEffect(() => {
    const handler = () => setCanInstall(true);
    window.addEventListener("mpump-install-available", handler);
    return () => window.removeEventListener("mpump-install-available", handler);
  }, []);

  const isIOS = /iPad|iPhone/.test(navigator.userAgent) && !("standalone" in navigator && (navigator as unknown as { standalone: boolean }).standalone);

  return (
    <div className="midi-gate">
      <div className="mg-seq-header">
        <div className="mg-seq-grid" ref={seqGridRef} />
      </div>
      <div className="midi-gate-inner">
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

      <div className="midi-gate-subtitle">A groove you can resend</div>

      <button className="midi-gate-btn-preview" title="Start playing with browser audio"
        onClick={() => { trackEvent("play-start"); setLogoKey(k => k + 1); clearTimeout(flashTimer.current); flashTimer.current = window.setTimeout(() => onPreview(), 450); }}>
        Open
      </button>

      <div className="midi-gate-intro">
        Everything is already moving.
      </div>

      <div className="midi-gate-featured">
        <span className="midi-gate-pill">Working Grooves</span>
        <span className="midi-gate-pill">Playable Links</span>
        <span className="midi-gate-pill">Jam &amp; Live Set</span>
      </div>

      <div className="midi-gate-about">
        <a href="./landing.html?about">about mpump</a>
      </div>


      {midiState === "denied" && (
        <div className="midi-gate-subtle">
          MIDI access was denied. <button className="midi-gate-retry" title="Retry MIDI access" onClick={onConnectMidi}>Retry</button>
        </div>
      )}


      <span className="title-version midi-gate-version">v{__APP_VERSION__} · <a href="https://github.com/gdamdam/mpump" target="_blank" rel="noopener noreferrer">AGPL-3.0</a></span>
      </div>
    </div>
  );
}
