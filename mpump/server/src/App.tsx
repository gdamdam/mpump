import { useEffect, useRef, useState } from "react";
import { useEngine } from "./hooks/useEngine";
import { Layout } from "./components/Layout";
import { MidiGate } from "./components/MidiGate";
import { ShareModal } from "./components/ShareModal";
import { isSupported } from "./engine/MidiAccess";
import { setItem, getJSON } from "./utils/storage";
import { trackEvent } from "./utils/metrics";
import { getLastSession, type SessionData } from "./utils/session";
import { extractPayloadFromUrl } from "./utils/shareCodec";

// Performance mode: "normal" | "lite" (no animations) | "eco" (lite + reduced audio)
export type PerfMode = "normal" | "lite" | "eco";

export function getPerfMode(): PerfMode {
  const params = new URLSearchParams(window.location.search);
  if (params.get("eco") === "true") return "eco";
  if (params.get("lite") === "true") return "lite";
  const stored = localStorage.getItem("mpump-perf-mode");
  if (stored === "lite" || stored === "eco") return stored;
  return "normal";
}

export const PERF_MODE = getPerfMode();

export function App() {
  const { state, catalog, command, midiState, connectMidi, startPreview, getAnalyser, getChannelAnalyser, loadCustomSamples, getMutedDrumNotes, playNote, stopNote, getMixerState, getCpuLoad, songState } = useEngine();
  const autoStarted = useRef(false);
  const [loadTimeout, setLoadTimeout] = useState(false);
  const [showContinueModal, setShowContinueModal] = useState(false);

  // ?reset=true — prompt to clear all data and reload
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("reset") === "true") {
      if (confirm("Reset all settings, presets, and effects to defaults?")) {
        localStorage.clear();
        window.location.href = window.location.pathname;
      } else {
        window.history.replaceState(null, "", window.location.pathname);
      }
    }
  }, []);

  // Detect share link (?z=, ?b= or legacy #) — show "Drop this beat" modal instead of auto-starting
  const initParams = new URLSearchParams(window.location.search);
  const { payload: initPayload, compressed: initCompressed } = extractPayloadFromUrl(new URL(window.location.href));
  const isShareLink = useRef(initPayload.length > 0);
  const jamRoomId = initParams.get("jam");
  const isJamLink = useRef(!!jamRoomId && jamRoomId !== "new");
  const [showJamGate, setShowJamGate] = useState(isJamLink.current);
  const [jamPeekCount, setJamPeekCount] = useState(-1); // -1 = loading
  const [jamPeekType, setJamPeekType] = useState<"jam" | "liveset" | null>(null);
  const shareUrl = useRef(initPayload ? `https://s.mpump.live/?${initCompressed ? "z" : "b"}=${initPayload}` : "");
  const [showShareGate, setShowShareGate] = useState(isShareLink.current);
  const shareArrivedTracked = useRef(false);
  if (isShareLink.current && !shareArrivedTracked.current) { shareArrivedTracked.current = true; trackEvent("share-arrived"); }
  // After play, keep showing the card overlay until user dismisses
  const [shareCardOverlay, setShareCardOverlay] = useState(false);

  // Listen for hash/popstate changes — detect share links opened while app is already loaded
  useEffect(() => {
    const onNavChange = () => {
      const { payload, compressed } = extractPayloadFromUrl(new URL(window.location.href));
      if (payload) {
        shareUrl.current = `https://s.mpump.live/?${compressed ? "z" : "b"}=${payload}`;
        setShowShareGate(true);
        setShareCardOverlay(false);
        trackEvent("share-arrived");
      }
    };
    window.addEventListener("hashchange", onNavChange);
    window.addEventListener("popstate", onNavChange);
    return () => {
      window.removeEventListener("hashchange", onNavChange);
      window.removeEventListener("popstate", onNavChange);
    };
  }, []);

  // Timeout for loading state — show retry if stuck
  useEffect(() => {
    if (midiState === "preview" && catalog === null) {
      const tid = setTimeout(() => setLoadTimeout(true), 5000);
      return () => clearTimeout(tid);
    }
    setLoadTimeout(false);
  }, [midiState, catalog]);

  // ?play: skip splash, auto-start preview (for testing)
  // ?jam=new: auto-start preview (skip splash, go straight to app with modal)
  useEffect(() => {
    if ((initParams.has("play") || initParams.get("jam") === "new") && !autoStarted.current) {
      autoStarted.current = true;
      setItem("mpump-tutorial-done", "1");
      startPreview();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Jam link: peek at room peer count (don't join yet)
  useEffect(() => {
    if (!isJamLink.current || !jamRoomId) return;
    const RELAY = import.meta.env.DEV ? `ws://${location.hostname}:4444` : "wss://mpump-jam-relay.fly.dev";
    // Pre-warm relay
    fetch(RELAY.replace("ws://", "http://").replace("wss://", "https://") + "/health").catch(() => {});
    // Quick peek: connect, join, get count, disconnect
    let ws: WebSocket | null = new WebSocket(RELAY);
    ws.onopen = () => { ws?.send(JSON.stringify({ type: "peek", room: jamRoomId })); };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "peers") { setJamPeekCount(msg.count); if (msg.roomType) setJamPeekType(msg.roomType); ws?.close(); ws = null; }
      } catch {}
    };
    ws.onerror = () => { setJamPeekCount(0); };
    // Timeout fallback
    const t = setTimeout(() => { if (ws) { ws.close(); ws = null; setJamPeekCount(0); } }, 5000);
    return () => { clearTimeout(t); ws?.close(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Jam gate: show "Join & Play" before starting
  if (showJamGate) {
    return (
      <div style={{ background: "#0b1a0b", minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 32, textAlign: "center", fontFamily: '"SF Mono", Menlo, Consolas, monospace' }}>
        <pre style={{ color: "#66ff99", fontSize: 12, lineHeight: 1.2, margin: 0 }}>{"█▀▄▀█ █▀█ █ █ █▀▄▀█ █▀█\n█ ▀ █ █▀▀ ▀▄▀ █ ▀ █ █▀▀"}</pre>
        <div style={{ fontSize: 16, color: "#66ff99", fontWeight: 700, marginTop: 8 }}>
          {jamPeekType === "liveset" ? "Someone is performing live" : "You're invited to a live jam"}
        </div>
        <div style={{ fontSize: 13, color: "#6a8a6a", maxWidth: 300, lineHeight: 1.5 }}>
          {jamPeekCount > 0
            ? jamPeekType === "liveset"
              ? `${jamPeekCount} ${jamPeekCount === 1 ? "person" : "people"} listening`
              : `${jamPeekCount} ${jamPeekCount === 1 ? "person is" : "people are"} jamming right now`
            : jamPeekCount === 0
              ? "Room is empty. You'll be the first"
              : "Connecting..."}
        </div>
        <div style={{ fontSize: 12, color: "#4a6a4a", maxWidth: 280, lineHeight: 1.4, marginTop: 4 }}>
          {jamPeekType === "liveset"
            ? "You'll hear everything the performer plays"
            : "Everyone controls the music together"}
        </div>
        <button
          style={{
            marginTop: 12, padding: "14px 40px", borderRadius: 24,
            background: "#66ff99", color: "#000", border: "none",
            fontSize: 18, fontWeight: 700, cursor: "pointer",
            fontFamily: "inherit",
          }}
          onClick={() => {
            setShowJamGate(false);
            autoStarted.current = true;
            setItem("mpump-tutorial-done", "1");
            trackEvent(jamPeekType === "liveset" ? "liveset-join" : "jam-join");
            startPreview();
          }}
        >
          {jamPeekType === "liveset" ? "▶ Listen" : "▶ Join & Play"}
        </button>
        <a
          href="./app.html"
          onClick={(e) => {
            e.preventDefault();
            setShowJamGate(false);
            autoStarted.current = true;
            setItem("mpump-tutorial-done", "1");
            // Strip jam param from URL
            const url = new URL(window.location.href);
            url.searchParams.delete("jam");
            window.history.replaceState({}, "", url.toString());
            startPreview();
          }}
          style={{ fontSize: 12, color: "#4a6a4a", marginTop: 8, cursor: "pointer", textDecoration: "none" }}
        >or open mpump solo →</a>
        <div style={{ fontSize: 11, color: "#4a6a4a", marginTop: 8 }}>
          No install · No account · No personal tracking
        </div>
      </div>
    );
  }

  // Pre-play gate: logo + message + static card + Play button
  if (showShareGate) {
    return (
      <div style={{ background: "#0d1117", minHeight: "100dvh" }}>
        <ShareModal
          url={shareUrl.current}
          qrUrl={shareUrl.current}
          hideActions
          onClose={() => {}}
        />
        {/* Logo + message + Play — vertically centered stack on top of the overlay */}
        <div style={{ position: "fixed", inset: 0, zIndex: 10001, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", gap: 8 }}>
          <pre style={{ color: "#66ff99", fontFamily: '"SF Mono", "Menlo", "Consolas", monospace', fontSize: 12, lineHeight: 1.2, margin: 0 }}>{"█▀▄▀█ █▀█ █ █ █▀▄▀█ █▀█\n█ ▀ █ █▀▀ ▀▄▀ █ ▀ █ █▀▀"}</pre>
          <div style={{ fontSize: 14, color: "#66ff99", fontWeight: 700, letterSpacing: 1.5, fontFamily: '"SF Mono", "Menlo", "Consolas", monospace' }}>
            🪩 Someone shared a beat with you 🎉
          </div>
          {/* Spacer for the card (400px height) */}
          <div style={{ height: 420 }} />
          <button className="midi-gate-btn midi-gate-btn-preview" style={{
            fontSize: 18, padding: "12px 40px", pointerEvents: "auto",
          }} onClick={() => {
            setShowShareGate(false);
            setShareCardOverlay(true);
            autoStarted.current = true;
            setItem("mpump-tutorial-done", "1");
            trackEvent("share-open");
            startPreview(true);
          }}>▶ Play</button>
        </div>
      </div>
    );
  }

  const hasJamParam = !!initParams.get("jam");
  if (midiState !== "granted" && midiState !== "preview" && !isJamLink.current && !hasJamParam) {
    const lastSession = getLastSession();
    return (
      <>
        <MidiGate midiState={midiState} onConnectMidi={connectMidi} onPreview={(genre?: string) => {
          if (genre) {
            setItem("mpump-start-genre", genre);
            trackEvent("play-start");
            startPreview();
            return;
          }
          if (lastSession && !initParams.get("jam") && !initParams.get("song")) {
            setShowContinueModal(true);
          } else {
            trackEvent("play-start");
            startPreview();
          }
        }} midiSupported={isSupported()} />
        {showContinueModal && lastSession && (() => {
          const ago = Math.round((Date.now() - lastSession.timestamp) / 60000);
          const timeLabel = ago < 60 ? `${ago}m ago` : ago < 1440 ? `${Math.round(ago / 60)}h ago` : `${Math.round(ago / 1440)}d ago`;
          const autosave = getJSON<SessionData | null>("mpump-autosave", null);
          const bpm = autosave?.bpm || lastSession.data.bpm;
          const bpmHue = 210 - Math.max(0, Math.min(1, (bpm - 90) / 70)) * 210;
          const bpmColor = `hsl(${bpmHue}, 100%, 70%)`;
          return (
            <div className="continue-modal-overlay" onClick={() => { setShowContinueModal(false); setItem("mpump-track-name", ""); setItem("mpump-autosave", ""); trackEvent("play-start"); startPreview(); }}>
              <div className="continue-modal" onClick={e => e.stopPropagation()}>
                <div className="continue-modal-bpm" style={{ color: bpmColor }}>{bpm} BPM</div>
                <div className="track-title-row track-style-b">
                  <div className="track-title-marquee continue-modal-display">
                    <span className="track-title-text">{lastSession.label}</span>
                  </div>
                </div>
                <div className="continue-modal-time">{timeLabel}</div>
                <button className="continue-modal-btn continue-modal-btn-go" onClick={() => {
                  setShowContinueModal(false);
                  trackEvent("play-start");
                  startPreview(true);
                }}>▶ Continue</button>
                <button className="continue-modal-btn continue-modal-btn-fresh" onClick={() => {
                  setShowContinueModal(false);
                  setItem("mpump-track-name", "");
                  setItem("mpump-autosave", "");
                  trackEvent("play-start");
                  startPreview();
                }}>Start fresh</button>
              </div>
            </div>
          );
        })()}
      </>
    );
  }

  if (midiState === "preview" && catalog === null) {
    const isSharedLink = autoStarted.current;
    return (
      <div className="loading-spinner">
        <pre className="loading-logo">{"█▀▄▀█ █▀█ █ █ █▀▄▀█ █▀█\n█ ▀ █ █▀▀ ▀▄▀ █ ▀ █ █▀▀"}</pre>
        {isSharedLink && <div className="loading-share-hint">Loading shared beat...</div>}
        <div className="loading-bar"><div className="loading-bar-fill" /></div>
        {loadTimeout && (
          <div style={{ marginTop: 16, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "#7d8590", marginBottom: 8 }}>Taking longer than expected...</div>
            <button className="midi-gate-btn midi-gate-btn-preview" onClick={() => location.reload()}>Reload</button>
          </div>
        )}
      </div>
    );
  }

  // Layout always renders in the same tree position — ShareModal overlays on top
  return (
    <>
      <Layout
        state={state}
        catalog={catalog}
        command={command}
        isPreview={midiState === "preview"}
        getAnalyser={getAnalyser}
        getChannelAnalyser={getChannelAnalyser}
        onConnectMidi={isSupported() ? connectMidi : undefined}
        onStartPreview={midiState === "granted" ? startPreview : undefined}
        onLoadSamples={loadCustomSamples}
        getMutedDrumNotes={getMutedDrumNotes}
        playNote={playNote}
        stopNote={stopNote}
        getMixerState={getMixerState}
        getCpuLoad={getCpuLoad}
        songState={songState}
      />
      {shareCardOverlay && (
        <ShareModal
          url={shareUrl.current}
          qrUrl={shareUrl.current}
          getAnalyser={getAnalyser ?? undefined}
          currentStep={state.devices["preview_drums"]?.step ?? -1}
          hideActions
          onClose={() => setShareCardOverlay(false)}
        />
      )}
    </>
  );
}
