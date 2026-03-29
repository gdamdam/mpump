/**
 * JamModal — create or join a live jam or live set room.
 */

import { useState, useRef } from "react";
import type { JamStatus, RoomType, JamRole } from "../hooks/useJam";

interface Props {
  status: JamStatus;
  roomId: string | null;
  roomType: RoomType;
  role: JamRole;
  peerCount: number;
  quantize: boolean;
  onToggleQuantize: () => void;
  onCreateRoom: (type: RoomType) => Promise<string>;
  onJoinRoom: (id: string, type?: RoomType) => void;
  onLeave: () => void;
  onDisconnect: () => void; // leave room but keep modal open
  onClose: () => void;
  isJoining?: boolean; // true when auto-joining via URL (skip idle pills)
}

const PEER_COLORS = ["#66ff99", "#ff6699", "#6699ff", "#ffcc66"];

export function JamModal({ status, roomId, roomType, role, peerCount, quantize, onToggleQuantize, onCreateRoom, onJoinRoom, onLeave, onDisconnect, onClose, isJoining }: Props) {
  const [joinId, setJoinId] = useState("");
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<RoomType>("jam");
  const inputRef = useRef<HTMLInputElement>(null);
  const mountTime = useRef(Date.now());
  // Reset copied state when room changes
  const prevRoomRef = useRef(roomId);
  if (prevRoomRef.current !== roomId) { prevRoomRef.current = roomId; if (copied) setCopied(false); }

  const roomUrl = roomId ? `${window.location.origin}${window.location.pathname}?jam=${roomId}` : "";

  const copyLink = () => {
    const copyText = (text: string) => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;left:-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(roomUrl).catch(() => copyText(roomUrl));
    } else {
      copyText(roomUrl);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreate = async () => {
    await onCreateRoom(tab);
    // Don't auto-copy — let user click "Copy invite link" manually
  };

  const handleJoin = () => {
    const id = joinId.trim();
    if (!id) return;
    const match = id.match(/[?&]jam=([a-z0-9]+)/);
    onJoinRoom(match ? match[1] : id);
  };

  return (
    <div className="jam-modal-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget && Date.now() - mountTime.current > 500) onClose(); }}>
      <div className="jam-modal">
        <div className="jam-modal-header">
          <span className="jam-modal-title">{
            status === "connected"
              ? (roomType === "liveset" ? "Live Set" : "Live Jam")
              : status === "connecting"
                ? "Connecting..."
                : <>Play Together <span className="jam-beta">beta</span></>
          }</span>
          <button className="jam-modal-close" onClick={onClose}>&times;</button>
        </div>

        {/* Mode selector — visible when idle (not joining) or connected (not listener) */}
        {!(status === "idle" && isJoining) && role !== "listener" && <div className="jam-modal-body" style={{ paddingBottom: 0 }}>
          <div className="jam-pills">
            <button
              className={`jam-pill ${(status === "idle" ? tab : roomType) === "jam" ? "active" : ""}`}
              onClick={() => {
                if (status === "connected" && roomType !== "jam") { onDisconnect(); }
                setTab("jam");
              }}
            >
              Jam
              <span className="jam-pill-sub">up to 4</span>
            </button>
            <button
              className={`jam-pill ${(status === "idle" ? tab : roomType) === "liveset" ? "active" : ""}`}
              onClick={() => {
                if (status === "connected" && roomType !== "liveset") { onDisconnect(); }
                setTab("liveset");
              }}
            >
              Live Set
              <span className="jam-pill-sub">up to 49</span>
            </button>
          </div>
        </div>}

        {status === "idle" && isJoining && (
          <div className="jam-modal-body" style={{ paddingTop: 0 }}>
            <p className="jam-modal-desc">Connecting to room...</p>
          </div>
        )}

        {status === "idle" && !isJoining && (
          <div className="jam-modal-body" style={{ paddingTop: 0 }}>
            <p className="jam-modal-desc" style={{ color: "var(--text)" }}>
              {tab === "jam" ? (<>
                Jam with up to 4 people.<br />
                Everyone controls the music together.
              </>) : (<>
                Perform for up to 49 listeners.<br />
                You control, they listen and watch.
              </>)}
            </p>

            <button className="jam-btn-primary" onClick={handleCreate}>
              {tab === "jam" ? "Create Jam Room" : "Start Live Set"}
            </button>

            <div className="jam-divider">or join</div>

            <div className="jam-join-row">
              <input
                ref={inputRef}
                className="jam-join-input"
                placeholder="Paste room link or ID"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleJoin(); }}
              />
              <button className="jam-btn-secondary" onClick={handleJoin} disabled={!joinId.trim()}>Join</button>
            </div>
          </div>
        )}

        {status === "connecting" && (
          <div className="jam-modal-body" style={{ paddingTop: 0 }}>
            <p className="jam-modal-desc">Connecting...</p>
          </div>
        )}

        {status === "connected" && (
          <div className="jam-modal-body" style={{ paddingTop: 0 }}>
            <button className="jam-copy-link" onClick={copyLink} title="Copy invite link">
              {copied ? "✓ Link copied!" : "📋 Copy invite link"}
            </button>

            <div className="jam-peers">
              <div className="jam-peers-label">
                {roomType === "liveset"
                  ? `${peerCount} / 50 · ${role === "controller" ? "You're performing" : "Listening"}`
                  : `Connected ${peerCount}/4`}
              </div>
              <div className="jam-peer-dots">
                {roomType === "jam" && Array.from({ length: Math.min(peerCount, 4) }, (_, i) => (
                  <span key={i} className="jam-peer-dot" style={{ background: PEER_COLORS[i % PEER_COLORS.length] }} title={i === 0 ? "You" : `Peer ${i}`} />
                ))}
              </div>
            </div>

            {role !== "listener" && (
              <div className="jam-quantize">
                <span className="jam-quantize-label">Bar-sync</span>
                <button
                  className={`jam-quantize-btn ${quantize ? "on" : ""}`}
                  onClick={onToggleQuantize}
                  title={quantize ? "Actions sync to bar boundary" : "Actions apply instantly"}
                >
                  {quantize ? "ON" : "OFF"}
                </button>
                <span className="jam-quantize-hint">{quantize ? "Mutes, effects, XY snap to beat" : "Instant (may drift)"}</span>
              </div>
            )}

            <button className="jam-btn-primary" onClick={onClose}>
              ▶ Back to {roomType === "liveset" ? "Live Set" : "Jam"}
            </button>

            <button className="jam-btn-leave" onClick={onLeave}>
              {roomType === "liveset" && role === "controller" ? "End Live Set" : "Leave"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
