/**
 * MidiSyncGuide — step-by-step setup wizard for MIDI clock sync with DAWs.
 */

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface Props {
  onClose: () => void;
  onEnableSync?: () => void;
}

type Platform = "mac" | "windows" | "link";

const MAC_STEPS = [
  {
    title: "1. Open Audio MIDI Setup",
    body: "Open Spotlight (Cmd + Space) and type \"Audio MIDI Setup\". Open the app. If you don't see the MIDI window, go to Window → Show MIDI Studio.",
  },
  {
    title: "2. Enable IAC Driver",
    body: "Double-click \"IAC Driver\" in the MIDI Studio window. Check \"Device is online\". Click Apply. This creates a virtual MIDI port built into macOS — no downloads needed.",
  },
  {
    title: "3. Configure your DAW",
    body: "In Ableton Live: Preferences → Link, Tempo & MIDI → under MIDI Ports, find \"IAC Driver\" and enable \"Sync\" in the Output column. In other DAWs: enable MIDI Clock output on the IAC Driver port.",
  },
  {
    title: "4. Enable in mpump",
    body: "In mpump Settings, turn on \"MIDI Clock In\". Press Play in your DAW — mpump will sync to its tempo and respond to Start/Stop transport.",
  },
];

const WINDOWS_STEPS = [
  {
    title: "1. Install loopMIDI",
    body: "Download loopMIDI from tobias-erichsen.de/software/loopmidi.html (free). Install and run it. Click the \"+\" button to create a virtual MIDI port.",
  },
  {
    title: "2. Configure your DAW",
    body: "In Ableton Live: Options → Preferences → Link, Tempo & MIDI → under MIDI Ports, find your loopMIDI port and enable \"Sync\" in the Output column. In other DAWs: enable MIDI Clock output on the loopMIDI port.",
  },
  {
    title: "3. Enable in mpump",
    body: "In mpump Settings, turn on \"MIDI Clock In\". Press Play in your DAW — mpump will sync to its tempo and respond to Start/Stop transport.",
  },
];

const LINK_STEPS = [
  {
    title: "1. Download mpump Link Bridge",
    body: "Go to github.com/gdamdam/mpump/releases/latest and download the Link Bridge for your platform (~3 MB). On Mac: open the .dmg and drag to Applications. On Windows: run the .msi installer.",
  },
  {
    title: "2. Run the Link Bridge",
    body: "Double-click to launch. A small window appears showing tempo, peers, and connection status. On Mac, allow the firewall prompt — Link needs local network access to discover other apps.",
  },
  {
    title: "3. Open mpump",
    body: "Open mpump.live in your browser. Go to Settings → Sync and enable Link. A green dot ● appears next to the logo when connected.",
  },
  {
    title: "4. Open Ableton Live",
    body: "In Ableton (or any Link-enabled app), click the Link button to enable it. Tempo syncs automatically. Change BPM in either app — all peers follow instantly.",
  },
];

export function MidiSyncGuide({ onClose, onEnableSync }: Props) {
  const [platform, setPlatform] = useState<Platform>(() =>
    navigator.platform?.toLowerCase().includes("mac") ? "mac" : "windows"
  );
  const [step, setStep] = useState(0);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const steps = platform === "link" ? LINK_STEPS : platform === "mac" ? MAC_STEPS : WINDOWS_STEPS;
  const current = steps[step];
  const isLast = step === steps.length - 1;

  return createPortal(
    <div className="share-overlay" onClick={onClose} style={{ background: "rgba(0,0,0,0.88)", zIndex: 99999 }}>
      <div className="share-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, width: "90vw", background: "var(--bg)", border: "1.5px solid var(--border)", maxHeight: "80vh", overflowY: "auto" }}>
        <div className="share-header">
          <span className="share-title">DAW Sync Setup</span>
          <button className="settings-close" title="Close" onClick={onClose}>✕</button>
        </div>

        {/* Platform tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {(["mac", "windows", "link"] as Platform[]).map(p => (
            <button
              key={p}
              className={`lib-tab ${platform === p ? "active" : ""}`}
              style={{ flex: 1, padding: "6px 0", fontSize: 12, cursor: "pointer", background: platform === p ? "var(--preview)" : "var(--bg-cell)", color: platform === p ? "#fff" : "var(--text)", border: "1px solid var(--border)", borderRadius: 4 }}
              onClick={() => { setPlatform(p); setStep(0); }}
            >
              {p === "mac" ? "MIDI · Mac" : p === "windows" ? "MIDI · Win" : "Ableton Link"}
            </button>
          ))}
        </div>

        {/* Step content */}
        <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text)", minHeight: 120 }}>
          <p style={{ fontWeight: "bold", marginBottom: 8, color: "var(--preview)" }}>{current.title}</p>
          <p style={{ marginBottom: 12 }}>{current.body}</p>
        </div>

        {/* Progress dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, margin: "12px 0" }}>
          {steps.map((_, i) => (
            <span
              key={i}
              style={{
                width: 8, height: 8, borderRadius: "50%",
                background: i === step ? "var(--preview)" : "var(--border)",
                cursor: "pointer",
              }}
              onClick={() => setStep(i)}
            />
          ))}
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {step > 0 && (
            <button className="settings-done-btn" onClick={() => setStep(step - 1)} style={{ flex: 1, opacity: 0.7 }}>
              Back
            </button>
          )}
          {isLast ? (
            platform === "link" ? (
              <a
                href="https://github.com/gdamdam/mpump/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
                className="settings-done-btn"
                style={{ flex: 1, textAlign: "center", textDecoration: "none" }}
                onClick={onClose}
              >
                Download Link Bridge
              </a>
            ) : (
            <button
              className="settings-done-btn"
              onClick={() => { onEnableSync?.(); onClose(); }}
              style={{ flex: 1 }}
            >
              Enable MIDI Clock In
            </button>
            )
          ) : (
            <button className="settings-done-btn" onClick={() => setStep(step + 1)} style={{ flex: 1 }}>
              Next
            </button>
          )}
        </div>

        {/* Footer note */}
        <p style={{ fontSize: 11, opacity: 0.5, marginTop: 12, textAlign: "center" }}>
          Works with Ableton Live, Logic Pro, Bitwig, FL Studio, and any DAW that sends MIDI clock.
        </p>
      </div>
    </div>,
    document.body
  );
}
