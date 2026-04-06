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
          <p style={{ marginBottom: 12 }}>mpump does not use accounts, cookies, ads, or personal tracking.</p>
          <p style={{ marginBottom: 12 }}>A small amount of anonymous operational data does exist, because the app still needs basic counters and crash reports to stay alive and improve.</p>
          <p style={{ marginTop: 14, marginBottom: 6, fontWeight: 700, fontSize: 13 }}>What mpump does not collect</p>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            <li><strong>No accounts</strong>: no sign-up, no email, no user profile</li>
            <li><strong>No cookies</strong>: mpump does not set login, ad, or analytics cookies</li>
            <li><strong>No user IDs</strong>: mpump does not assign you a persistent personal identifier</li>
            <li><strong>No fingerprinting</strong>: mpump does not try to build a hidden identity from your device or browser</li>
            <li><strong>No third-party ad trackers</strong>: no Google Ads, Meta Pixel, or similar ad-tech</li>
          </ul>
          <p style={{ marginTop: 14, marginBottom: 6, fontWeight: 700, fontSize: 13 }}>What mpump does collect</p>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            <li><strong>Anonymous page counts</strong>: plain traffic counts via <a href="https://goatcounter.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--preview)" }}>GoatCounter</a></li>
            <li><strong>Anonymous beat counters</strong>: play, share, and remix counts tied to beats, not to people</li>
            <li><strong>Minimal crash reports</strong>: only the error message and a coarse browser label such as Chrome or Safari</li>
          </ul>
          <p style={{ marginTop: 14, marginBottom: 6, fontWeight: 700, fontSize: 13 }}>What stays local</p>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            <li><strong>Your sessions, patterns, and settings</strong>: stored in your browser on your device</li>
            <li><strong>Your music</strong>: generated locally in the browser unless you choose to share a beat or join a jam</li>
            <li><strong>Open source</strong>: full source code at <a href="https://github.com/gdamdam/mpump" target="_blank" rel="noopener noreferrer" style={{ color: "var(--preview)" }}>github.com/gdamdam/mpump</a> under AGPL-3.0</li>
          </ul>
          <p style={{ marginTop: 14, marginBottom: 6, fontWeight: 700, fontSize: 13 }}>Sharing</p>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            <li>When you share a beat, the link contains beat settings such as BPM, patterns, sounds, and effects. It does not contain your name, email, or account info</li>
            <li>Share links can pass through a relay at <a href="https://s.mpump.live" target="_blank" rel="noopener noreferrer" style={{ color: "var(--preview)" }}>s.mpump.live</a> for short URLs and preview cards in messaging apps</li>
            <li>The share relay stores beat data from the link, remix parent-child links, and anonymous counters. It does not store user accounts, cookies, or personal IDs</li>
            <li>Short URLs (<code style={{ fontSize: 12 }}>s.mpump.live/abc123</code>) redirect to the full self-contained link. You can always use the full link instead</li>
            <li>The share relay code is open source in the same <a href="https://github.com/gdamdam/mpump/tree/main/worker" target="_blank" rel="noopener noreferrer" style={{ color: "var(--preview)" }}>GitHub repo</a></li>
          </ul>
          <p style={{ marginTop: 14, marginBottom: 6, fontWeight: 700, fontSize: 13 }}>Jam &amp; Live Set</p>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            <li>Jam sessions relay <strong>control data only</strong> such as BPM, genre, effects, mute states, and pad movement. No audio is transmitted. Each browser makes its own sound locally</li>
            <li>No accounts, names, or personal IDs are required. Rooms are short random codes that exist only in memory</li>
            <li>The jam relay is meant to be lightweight and temporary. It does not keep user profiles, saved histories, or cookies</li>
            <li>The jam relay is <a href="https://github.com/gdamdam/mpump/tree/main/worker/jam-relay" target="_blank" rel="noopener noreferrer" style={{ color: "var(--preview)" }}>open source</a></li>
          </ul>
          <p style={{ marginTop: 12, fontSize: 12, lineHeight: 1.6 }}>mpump is hosted on <a href="https://pages.github.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--preview)" }}>GitHub Pages</a>.<br />The share relay runs on <a href="https://workers.cloudflare.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--preview)" }}>Cloudflare Workers</a>.<br />The jam relay runs on <a href="https://fly.io" target="_blank" rel="noopener noreferrer" style={{ color: "var(--preview)" }}>Fly.io</a>.</p>
          <p style={{ marginTop: 8, fontSize: 12 }}>Short version: mpump tries to know as little about you as possible while still being usable, shareable, and maintainable.</p>
          <p style={{ marginTop: 12, opacity: 0.7, fontSize: 12 }}>Your music stays on your device. Always.</p>
        </div>
        <button className="settings-done-btn" onClick={onClose} style={{ marginTop: 16 }}>OK</button>
      </div>
    </div>
  );
}
