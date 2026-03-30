/**
 * Settings panel — master volume + color palette selection.
 */

import { useState, useEffect } from "react";
import { trackEvent } from "../utils/metrics";
import type { ClientMessage } from "../types";
import { getItem, setItem, getBool, setBool } from "../utils/storage";
import { isInstallAvailable, triggerInstallPrompt } from "../main";
import { MidiSyncGuide } from "./MidiSyncGuide";
import { enableLinkBridge, onLinkState, getLinkState, type LinkState } from "../utils/linkBridge";

export type PaletteId = "midnight" | "neon" | "forest" | "ember" | "cobalt" | "violet" | "minimal" | "cream" | "artic" | "sand" | "rose" | "slate";

interface PaletteDef {
  id: PaletteId;
  name: string;
  dark: boolean;
  bg: string;
  panel: string;
  cell: string;
  border: string;
  text: string;
  dim: string;
  preview: string;
}

export const PALETTES: PaletteDef[] = [
  // Dark
  { id: "forest", name: "Forest", dark: true,
    bg: "#0b1a0b", panel: "#122212", cell: "#1a2e1a", border: "#2a4a2a",
    text: "#c8e6c8", dim: "#6a8a6a", preview: "#66ff99" },
  { id: "ember", name: "Amber", dark: true,
    bg: "#1a0a0a", panel: "#241010", cell: "#2e1818", border: "#4a2222",
    text: "#f0d0c8", dim: "#8a5a50", preview: "#ff6644" },
  { id: "neon", name: "Neon", dark: true,
    bg: "#000000", panel: "#0a0a0a", cell: "#141414", border: "#222",
    text: "#fff", dim: "#666", preview: "#ff00ff" },
  // Light
  { id: "minimal", name: "Minimal", dark: false,
    bg: "#ffffff", panel: "#f0f0f0", cell: "#e0e0e0", border: "#aaa",
    text: "#111111", dim: "#444", preview: "#777777" },
  { id: "cream", name: "Cream", dark: false,
    bg: "#faf5eb", panel: "#f0e9d8", cell: "#e8dfc8", border: "#d4c9a8",
    text: "#2a2520", dim: "#8a7a60", preview: "#7c4dff" },
  { id: "rose", name: "Rosé", dark: false,
    bg: "#faf0f2", panel: "#f0e0e4", cell: "#e8d4da", border: "#d0b8c0",
    text: "#2a1820", dim: "#8a5a6a", preview: "#d04080" },
];

export function applyPalette(p: PaletteDef) {
  const root = document.documentElement;
  root.style.setProperty("--bg", p.bg);
  root.style.setProperty("--bg-panel", p.panel);
  root.style.setProperty("--bg-cell", p.cell);
  root.style.setProperty("--border", p.border);
  root.style.setProperty("--text", p.text);
  root.style.setProperty("--text-dim", p.dim);
  root.style.setProperty("--preview", p.preview);
  // Update body bg and fg for overall feel
  root.style.setProperty("--fg", p.text);
  root.style.setProperty("--fg-dim", p.dim);
  document.body.style.background = p.bg;
  document.body.style.color = p.text;
}

function loadPalette(): PaletteId {
  const stored = getItem("mpump-palette");
  if (stored && PALETTES.find(p => p.id === stored)) return stored as PaletteId;
  return "forest";
}

/** Read song mode preference from localStorage. */
export function getSongModeEnabled(): boolean {
  return getItem("mpump-song-mode") === "true";
}

/** Read visual effects preference from localStorage. */
export function getAnimationsEnabled(): boolean {
  return getItem("mpump-animations") === "true";
}

/** Alias — preferred name going forward. */
export const getVisualFxEnabled = getAnimationsEnabled;

/** Read bottom transport bar preference from localStorage. */
export function getBottomTransportEnabled(): boolean {
  return getBool("mpump-bottom-transport");
}

interface Props {
  volume: number;
  onVolumeChange: (v: number) => void;
  onClose: () => void;
  swing?: number;
  onSwingChange?: (sw: number) => void;
  previewMode?: string;
  onPreviewModeChange?: (mode: "kaos" | "synth" | "ease" | "mixer") => void;
  shareData?: string;
  cvEnabled?: boolean;
  onCVChange?: (on: boolean) => void;
  antiClipMode?: "off" | "limiter" | "hybrid";
  onAntiClipChange?: (mode: "off" | "limiter" | "hybrid") => void;
  command?: (msg: ClientMessage) => void;
  onAbout?: () => void;
  onHelp?: () => void;
  onTutorial?: () => void;
  onExportSession?: () => void;
  onImportSession?: (file: File) => void;
}

export function Settings({ volume, onVolumeChange, onClose, swing, onSwingChange, previewMode, onPreviewModeChange, shareData, cvEnabled, onCVChange, antiClipMode, onAntiClipChange, command, onAbout, onHelp, onTutorial, onExportSession, onImportSession }: Props) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const [copied, setCopied] = useState(false);
  const [palette, setPalette] = useState<PaletteId>(() => {
    const s = getItem("mpump-palette"); if (s && PALETTES.find(p => p.id === s)) return s as PaletteId; return "forest";
  });
  const [midiClockSync, setMidiClockSync] = useState(false);
  const [animations, setAnimations] = useState(getAnimationsEnabled);
  const [songMode, setSongMode] = useState(() => getItem("mpump-song-mode") === "true");
  const [videoRec, setVideoRec] = useState(() => getBool("mpump-video-rec"));
  const [showMidiGuide, setShowMidiGuide] = useState(false);
  const [linkEnabled, setLinkEnabled] = useState(() => getBool("mpump-link-bridge", false));
  const [linkState, setLinkState] = useState<LinkState>(getLinkState);

  useEffect(() => {
    const unsub = onLinkState((s) => setLinkState(s));
    return unsub;
  }, []);

  return (<>
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <span className="settings-title">Settings</span>
          <button className="settings-close" title="Close settings" onClick={onClose}>✕</button>
        </div>

        {/* Help & Tutorial buttons */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <button className="settings-help-btn" style={{ marginBottom: 0 }} onClick={() => { onClose(); onHelp?.(); }}>
            Help &amp; Shortcuts
          </button>
          <button className="settings-help-btn" style={{ marginBottom: 0 }} onClick={() => { onClose(); onTutorial?.(); }}>
            Tutorial
          </button>
        </div>

        {/* Volume */}
        <div className="settings-section">
          <div className="settings-label">Master Volume</div>
          <div className="settings-vol-row">
            <input
              type="range"
              className="settings-slider"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            />
            <span className="settings-vol-val">{Math.round(volume * 100)}%</span>
          </div>
        </div>

        {/* Swing */}
        {onSwingChange && swing != null && (
          <div className="settings-section">
            <div className="settings-label">Swing</div>
            <div className="settings-vol-row">
              <input
                type="range"
                className="settings-slider"
                min={0}
                max={100}
                step={1}
                value={Math.round(((swing - 0.5) / 0.3) * 100)}
                onChange={(e) => onSwingChange(0.5 + (parseInt(e.target.value) / 100) * 0.3)}
              />
              <span className="settings-vol-val">{Math.round(((swing - 0.5) / 0.3) * 100)}%</span>
            </div>
          </div>
        )}

        {/* Simple mode */}
        {onPreviewModeChange && (
          <div className="settings-section">
            <div className="settings-toggles">
              <button
                className={`settings-toggle ${previewMode === "ease" ? "on" : ""}`}
                title="Simplified interface with larger controls"
                onClick={() => onPreviewModeChange(previewMode === "ease" ? "kaos" : "ease")}
              >
                <span className="settings-toggle-dot" />Simple Mode
              </button>
            </div>
          </div>
        )}

        {/* Video recording (beta) */}
        <div className="settings-section">
          <div className="settings-toggles">
            <button
              className={`settings-toggle ${videoRec ? "on" : ""}`}
              title="Show video recording button in KAOS pad (beta)"
              onClick={() => {
                const next = !getBool("mpump-video-rec");
                setBool("mpump-video-rec", next);
                setVideoRec(next);
              }}
            >
              <span className="settings-toggle-dot" />Video REC (beta)
            </button>
          </div>
        </div>

        {/* Themes */}
        <div className="settings-section">
          <div className="settings-label">Theme</div>
          <div className="settings-palettes">
            {PALETTES.map((p) => (
              <button
                key={p.id}
                className={`settings-palette ${palette === p.id ? "active" : ""}`}
                title={`${p.name} theme`}
                onClick={() => {
                  setPalette(p.id);
                  const t = PALETTES.find(x => x.id === p.id)!;
                  const root = document.documentElement;
                  root.style.setProperty("--bg", t.bg);
                  root.style.setProperty("--bg-panel", t.panel);
                  root.style.setProperty("--bg-cell", t.cell);
                  root.style.setProperty("--border", t.border);
                  root.style.setProperty("--text", t.text);
                  root.style.setProperty("--text-dim", t.dim);
                  root.style.setProperty("--preview", t.preview);
                  root.style.setProperty("--fg", t.text);
                  root.style.setProperty("--fg-dim", t.dim);
                  document.body.style.background = t.bg;
                  document.body.style.color = t.text;
                  setItem("mpump-palette", p.id);
                }}
              >
                <div className="settings-palette-swatch" style={{ background: p.bg, borderColor: p.border }}>
                  <div className="settings-palette-dot" style={{ background: p.preview }} />
                  <div className="settings-palette-dot" style={{ background: p.text, opacity: 0.6 }} />
                </div>
                <span className="settings-palette-name">{p.name}</span>
              </button>
            ))}
          </div>
        </div>


        <div className="settings-section">
          <div className="settings-hint">
            Space = play/stop &middot; R = shuffle &middot; ←→ = pattern &middot; ↑↓ = genre
          </div>
        </div>

        {/* Session export/import */}
        {(onExportSession || onImportSession) && (
          <div className="settings-section">
            <div className="settings-label">Session</div>
            <div className="settings-toggles">
              {onExportSession && (
                <button className="settings-toggle on" onClick={onExportSession} title="Download full session as JSON">
                  <span className="settings-toggle-dot" />Export Session
                </button>
              )}
              {onImportSession && (
                <button className="settings-toggle" onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".json";
                  input.onchange = () => { if (input.files?.[0]) onImportSession(input.files[0]); };
                  input.click();
                }} title="Load a session JSON file">
                  <span className="settings-toggle-dot" />Import Session
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Performance ─────────────────────────────────── */}
        <div className="settings-section">
          <div className="settings-label">Performance</div>
          <div className="settings-toggles">
            {onAntiClipChange && (
              <select className="synth-preset-select" value={antiClipMode ?? "limiter"} title="Anti-clip prevents digital clipping" onChange={(e) => onAntiClipChange(e.target.value as "off" | "limiter" | "hybrid")} style={{ fontSize: 11 }}>
                <option value="limiter">Anti-Clip: Limiter</option>
                <option value="hybrid">Anti-Clip: Hybrid</option>
                <option value="off">Anti-Clip: Off</option>
              </select>
            )}
            {command && (
              <button className={`settings-toggle ${getBool("mpump-metronome") ? "on" : ""}`} title="Click track on quarter notes"
                onClick={() => { const next = !getBool("mpump-metronome"); setBool("mpump-metronome", next); command({ type: "set_metronome", on: next }); window.dispatchEvent(new Event("mpump-settings-changed")); }}>
                <span className="settings-toggle-dot" />Metronome
              </button>
            )}
            {command && (
              <button className={`settings-toggle ${getBool("mpump-humanize") ? "on" : ""}`} title="Subtle random velocity variation (±15%)"
                onClick={() => { const next = !getBool("mpump-humanize"); setBool("mpump-humanize", next); command({ type: "set_humanize", on: next }); window.dispatchEvent(new Event("mpump-settings-changed")); }}>
                <span className="settings-toggle-dot" />Humanize
              </button>
            )}
            <button className={`settings-toggle ${getBool("mpump-jam-identity", true) ? "on" : ""}`} title="Show names and colored trails in jam sessions"
              onClick={() => { const next = !getBool("mpump-jam-identity", true); setBool("mpump-jam-identity", next); window.dispatchEvent(new Event("mpump-settings-changed")); }}>
              <span className="settings-toggle-dot" />Jam Names
            </button>
            <button className={`settings-toggle ${getBool("mpump-key-lock", true) ? "on" : ""}`} title="Keep bass and synth on the same key and octave"
              onClick={() => { const next = !getBool("mpump-key-lock", true); setBool("mpump-key-lock", next); window.dispatchEvent(new Event("mpump-settings-changed")); }}>
              <span className="settings-toggle-dot" />Key Lock
            </button>
            {command && (
              <button className={`settings-toggle ${getBool("mpump-mono") ? "on" : ""}`} title="Mono output — collapse stereo to mono"
                onClick={() => { const next = !getBool("mpump-mono"); setBool("mpump-mono", next); command({ type: "set_mono", on: next }); window.dispatchEvent(new Event("mpump-settings-changed")); }}>
                <span className="settings-toggle-dot" />Mono
              </button>
            )}
            <select className="synth-preset-select" value={getItem("mpump-logo-pulse", "audio")} title="Logo pulse mode"
              onChange={(e) => { setItem("mpump-logo-pulse", e.target.value); window.dispatchEvent(new Event("mpump-settings-changed")); }} style={{ fontSize: 11 }}>
              <option value="audio">Logo Pulse: Audio</option>
              <option value="kick">Logo Pulse: Kick</option>
              <option value="off">Logo Pulse: Off</option>
            </select>
            <select className="synth-preset-select" value={getItem("mpump-kaos-wave", "bars-mirror")} title="KAOS pad visualization"
              onChange={(e) => setItem("mpump-kaos-wave", e.target.value)} style={{ fontSize: 11 }}>
              <option value="wave-glow">KAOS Viz: Waveform</option>
              <option value="bars-mirror">KAOS Viz: Bars</option>
              <option value="circular">KAOS Viz: Circular</option>
              <option value="spectrum">KAOS Viz: Spectrum</option>
              <option value="rotate">KAOS Viz: Rotate</option>
              <option value="off">KAOS Viz: Off</option>
            </select>
          </div>
        </div>

        {/* ── Link Bridge ─────────────────────────────────── */}
        <div className="settings-section">
          <div className="settings-label">Link Bridge</div>
          <div className="settings-toggles">
            <button className={`settings-toggle ${linkEnabled ? "on" : ""}`} title="Ableton Link sync"
              onClick={() => { const next = !linkEnabled; setLinkEnabled(next); setBool("mpump-link-bridge", next); enableLinkBridge(next); }}>
              <span className="settings-toggle-dot" style={linkEnabled && !linkState.connected ? { background: "var(--border)", boxShadow: "none" } : undefined} />Link
            </button>
            <button className="settings-toggle" title="MIDI sync setup guide" onClick={() => setShowMidiGuide(true)} style={{ fontSize: 10, opacity: 0.8 }}>
              Setup Guide
            </button>
          </div>
          {linkEnabled && (
            <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4, lineHeight: 1.6 }}>
              {linkState.connected
                ? <>● Connected · {linkState.peers} peer{linkState.peers !== 1 ? "s" : ""} · {linkState.clients} browser{linkState.clients !== 1 ? "s" : ""} · {Math.round(linkState.tempo)} BPM</>
                : <span title="Safari blocks localhost WebSocket connections from HTTPS pages. Use Chrome or Firefox for Link Bridge.">○ Not detected · <a href="https://github.com/gdamdam/mpump/releases/latest" target="_blank" rel="noopener noreferrer" style={{ color: "var(--preview)" }}>Download Bridge</a> · Chrome/Firefox only</span>}
              <div style={{ marginTop: 2 }}>Sync with <a href="https://mloop.mpump.live" target="_blank" rel="noopener noreferrer" style={{ color: "var(--preview)" }}>mloop</a> — enable L in both apps</div>
            </div>
          )}
        </div>

        {/* ── Experimental ────────────────────────────────── */}
        <div className="settings-section">
          <div className="settings-label"><span className="settings-exp-tag">BETA</span> Experimental</div>
          <div className="settings-toggles">
            <select className="synth-preset-select" value={getItem("mpump-mix-fx", "both")} title="Visual feedback on MIX"
              onChange={(e) => setItem("mpump-mix-fx", e.target.value)} style={{ fontSize: 11 }}>
              <option value="shake">MIX: Shake</option>
              <option value="flash">MIX: Flash</option>
              <option value="both">MIX: Shake + Flash</option>
              <option value="off">MIX: Off</option>
            </select>
            {onCVChange && (
              <button className={`settings-toggle ${cvEnabled ? "on" : ""}`} title="CV output via DC-coupled interface"
                onClick={() => onCVChange(!cvEnabled)}>
                <span className="settings-toggle-dot" />CV Output
              </button>
            )}
            <button className={`settings-toggle ${midiClockSync ? "on" : ""}`} title="Sync to external MIDI clock (24 PPQN)"
              onClick={() => { const next = !midiClockSync; setMidiClockSync(next); command?.({ type: "set_midi_clock_sync", on: next }); }}>
              <span className="settings-toggle-dot" />MIDI Clock In
            </button>
            <button className={`settings-toggle ${songMode ? "on" : ""}`} title="Chain patterns in SYNTH view"
              onClick={() => { const next = !songMode; setSongMode(next); setItem("mpump-song-mode", String(next)); window.dispatchEvent(new Event("mpump-settings-changed")); }}>
              <span className="settings-toggle-dot" />Song Mode
            </button>
            <button className={`settings-toggle ${animations ? "on" : ""}`} title="Beat pulse, genre tint, transitions"
              onClick={() => { const next = !animations; setAnimations(next); setItem("mpump-animations", String(next)); window.dispatchEvent(new Event("mpump-settings-changed")); }}>
              <span className="settings-toggle-dot" />Visual Effects
            </button>
            <button className={`settings-toggle ${getBool("mpump-wave-tap") ? "on" : ""}`} title="Click waveform bar to tap tempo"
              onClick={() => { const next = !getBool("mpump-wave-tap"); setBool("mpump-wave-tap", next); window.dispatchEvent(new Event("mpump-settings-changed")); }}>
              <span className="settings-toggle-dot" />Wave Tap Tempo
            </button>
            <button className={`settings-toggle ${getBool("mpump-bottom-transport") ? "on" : ""}`} title="Pin transport to bottom on mobile"
              onClick={() => { const next = !getBool("mpump-bottom-transport"); setBool("mpump-bottom-transport", next); window.dispatchEvent(new Event("mpump-settings-changed")); }}>
              <span className="settings-toggle-dot" />Bottom Transport
            </button>
          </div>
          {cvEnabled && command && (
            <div className="settings-cv-cal">
              <button className="settings-cal-btn" title="Send C4 (0V)" onClick={() => command({ type: "cv_test_note" })}>Test C4</button>
              <button className="settings-cal-btn" title="Sweep C3→C4→C5" onClick={() => command({ type: "cv_test_octave" })}>Test Octave</button>
            </div>
          )}
        </div>

        <div className="settings-section">
          <button
            className="settings-reset-btn"
            title="Reset all settings to defaults"
            onClick={() => {
              if (confirm("Reset all settings, presets, and effects to defaults?")) {
                localStorage.clear();
                location.reload();
              }
            }}
          >
            Reset to defaults
          </button>
        </div>

        <div className="settings-section settings-footer">
          <a href="https://github.com/gdamdam/mpump" target="_blank" rel="noopener noreferrer" className="settings-repo-link">
            github.com/gdamdam/mpump
          </a>
          <div className="settings-privacy" style={{ marginTop: 6 }}>
            mpump works offline for solo play. Bookmark or install for instant access anytime.
          </div>
          {isInstallAvailable() && (
            <button className="midi-gate-btn midi-gate-btn-midi" style={{ marginTop: 8, fontSize: 11 }} onClick={() => triggerInstallPrompt()}>
              Install App
            </button>
          )}
          {/iPad|iPhone/.test(navigator.userAgent) && !("standalone" in navigator && (navigator as unknown as { standalone: boolean }).standalone) && (
            <div className="settings-privacy" style={{ marginTop: 6 }}>
              Tap Share → Add to Home Screen for a full-screen app
            </div>
          )}
          <div className="settings-privacy">
            <span className="settings-about-link" onClick={() => { onClose(); onAbout?.(); }} title="View credits">v{__APP_VERSION__}</span> &middot;
            <a className="settings-about-link" href="https://ko-fi.com/gdamdam" target="_blank" rel="noopener noreferrer" title="Support mpump" style={{ color: "#ff4466", fontWeight: 700 }} onClick={() => trackEvent("kofi-settings")}>Support <span style={{ color: "#ff4466" }}>♥</span></a> &middot; No cookies &middot; No personal data
          </div>
          <button className="settings-done-btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
    {showMidiGuide && (
      <MidiSyncGuide
        onClose={() => setShowMidiGuide(false)}
        onEnableSync={() => { setMidiClockSync(true); command?.({ type: "set_midi_clock_sync", on: true }); }}
      />
    )}
    </>
  );
}

/** Apply saved palette on app load. */
export function initPalette(): void {
  const id = loadPalette();
  const p = PALETTES.find(x => x.id === id);
  if (p) applyPalette(p);
}
