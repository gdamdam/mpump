import { useEffect } from "react";

interface Props {
  onClose: () => void;
}

export function PrivacyModal({ onClose }: Props) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div className="share-overlay" onClick={onClose}>
      <div className="share-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="share-header">
          <span className="share-title">Privacy</span>
          <button className="settings-close" title="Close" onClick={onClose}>✕</button>
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text)", maxHeight: "70dvh", overflowY: "auto", padding: "0 16px 16px" }}>
          <p style={{ marginBottom: 12 }}>mpump collects no personal data. No cookies, no accounts, no user tracking.</p>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            <li><strong>No cookies</strong>: mpump does not set any cookies</li>
            <li><strong>No personal data</strong>: no accounts, no emails, no user IDs</li>
            <li><strong>No fingerprinting</strong>: no device or browser identification</li>
            <li><strong>No third-party trackers</strong>: no Google, no Facebook, no ad networks</li>
            <li><strong>Anonymous beat stats</strong>: we count plays, shares, and remixes per beat — no personal data, no cookies, no user IDs. Page views counted via <a href="https://goatcounter.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--preview)" }}>GoatCounter</a></li>
            <li><strong>Error reporting</strong>: if the app crashes, an anonymous error report is sent to our relay — it contains only the error message and browser type. No personal data, no IPs stored</li>
            <li><strong>Saved locally</strong>: your grooves, settings, and patterns are stored privately in your browser. Nothing is sent to any server</li>
            <li><strong>Open source (AGPL-3.0)</strong>: full source code at <a href="https://github.com/gdamdam/mpump" target="_blank" rel="noopener noreferrer" style={{ color: "var(--preview)" }}>github.com/gdamdam/mpump</a></li>
          </ul>
          <p style={{ marginTop: 14, marginBottom: 6, fontWeight: 700, fontSize: 13 }}>Sharing</p>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            <li>When you share a beat, the link contains only beat settings (BPM, genre, patterns). No personal data</li>
            <li>Share links pass through a relay (<a href="https://s.mpump.live" target="_blank" rel="noopener noreferrer" style={{ color: "var(--preview)" }}>s.mpump.live</a>) that provides short URLs and preview cards for messaging apps</li>
            <li>The relay stores three things: <strong>beat settings</strong> (the same data in the link), <strong>which beat was remixed from which</strong> (parent→child), and <strong>anonymous counters</strong> (play count, remix count). No IPs, no user identifiers, no cookies</li>
            <li>Short URLs (<code style={{ fontSize: 12 }}>s.mpump.live/abc123</code>) redirect to the full self-contained link. You can always use the offline-compatible full link instead</li>
            <li>The relay code is open source in the same <a href="https://github.com/gdamdam/mpump/tree/main/worker" target="_blank" rel="noopener noreferrer" style={{ color: "var(--preview)" }}>GitHub repo</a></li>
          </ul>
          <p style={{ marginTop: 14, marginBottom: 6, fontWeight: 700, fontSize: 13 }}>Jam &amp; Live Set</p>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            <li>Jam sessions relay <strong>control data only</strong> (BPM, genre, effects, mute states). No audio is transmitted, each browser synthesizes sound locally</li>
            <li>No accounts, names, or identifiers are sent. Rooms are random 6-character codes that exist only in memory</li>
            <li>Connection IPs are not logged or stored. The relay processes messages in real-time and keeps nothing</li>
            <li>The jam relay is <a href="https://github.com/gdamdam/mpump/tree/main/worker/jam-relay" target="_blank" rel="noopener noreferrer" style={{ color: "var(--preview)" }}>open source</a></li>
          </ul>
          <p style={{ marginTop: 12, fontSize: 12, lineHeight: 1.6 }}>mpump is hosted on <a href="https://pages.github.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--preview)" }}>GitHub Pages</a>.<br />The share relay runs on <a href="https://workers.cloudflare.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--preview)" }}>Cloudflare Workers</a>.<br />The jam relay runs on <a href="https://fly.io" target="_blank" rel="noopener noreferrer" style={{ color: "var(--preview)" }}>Fly.io</a>.</p>
          <p style={{ marginTop: 8, fontSize: 12 }}>No database, no accounts.<br />Everything runs in your browser.<br />The share relay stores beat data and anonymous counters — no personal information. The jam relay is stateless.</p>
          <p style={{ marginTop: 12, opacity: 0.7, fontSize: 12 }}>Your music stays on your device. Always.</p>
        </div>
        <button className="settings-done-btn" onClick={onClose} style={{ marginTop: 16 }}>OK</button>
      </div>
    </div>
  );
}
