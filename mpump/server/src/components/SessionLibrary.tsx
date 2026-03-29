/**
 * SessionLibrary — modal for managing recent and saved sessions.
 */

import { useState, useEffect } from "react";
import { getRecentSessions, getSavedSessions, saveSession, renameSavedSession, deleteSavedSession } from "../utils/session";
import type { RecentSession, SavedSession, SessionData } from "../utils/session";

interface Props {
  onClose: () => void;
  onLoad: (data: SessionData, name: string) => void;
}

function timeAgo(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const month = d.toLocaleString("default", { month: "short" });
  const day = d.getDate();
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${month} ${day}, ${h}:${m}`;
}

export function SessionLibrary({ onClose, onLoad }: Props) {
  const [recent, setRecent] = useState<RecentSession[]>([]);
  const [saved, setSaved] = useState<SavedSession[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setRecent(getRecentSessions());
    setSaved(getSavedSessions());
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const handleSaveRecent = (r: RecentSession) => {
    saveSession(r.label, r.data);
    setSaved(getSavedSessions());
  };

  const handleRename = (id: string) => {
    if (editName.trim()) {
      renameSavedSession(id, editName.trim());
      setSaved(getSavedSessions());
    }
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    deleteSavedSession(id);
    setSaved(getSavedSessions());
  };

  return (
    <div className="sl-overlay" onClick={onClose}>
      <div className="sl-modal" onClick={e => e.stopPropagation()}>
        <div className="sl-header">
          <span className="sl-title">Sessions</span>
          <button className="settings-close" title="Close" onClick={onClose}>✕</button>
        </div>

        {/* Recent sessions */}
        <div className="sl-section">
          <div className="sl-section-title">Recent 5</div>
          {recent.length === 0 && <div className="sl-empty">No recent sessions yet.</div>}
          {recent.map((r, i) => (
            <div key={i} className="sl-row">
              <button className="sl-load" onClick={() => { onLoad(r.data, r.label); }}>
                <span className="sl-name">{r.label}</span>
                <span className="sl-meta">{r.data.bpm} BPM · {formatDate(r.timestamp)} ({timeAgo(r.timestamp)})</span>
              </button>
              <button className="sl-action sl-star" title="Save this session" onClick={() => handleSaveRecent(r)}>☆</button>
            </div>
          ))}
        </div>

        {/* Saved sessions */}
        <div className="sl-section">
          <div className="sl-section-title">Saved</div>
          {saved.length === 0 && <div className="sl-empty">No saved sessions. Star a recent session to save it.</div>}
          {saved.map(s => (
            <div key={s.id} className="sl-row">
              {editingId === s.id ? (
                <input
                  className="sl-rename-input"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleRename(s.id); if (e.key === "Escape") setEditingId(null); }}
                  onBlur={() => handleRename(s.id)}
                  autoFocus
                />
              ) : (
                <button className="sl-load" onClick={() => { onLoad(s.data, s.name); }}>
                  <span className="sl-name">{s.name}</span>
                  <span className="sl-meta">{s.data.bpm} BPM · {formatDate(s.timestamp)}</span>
                </button>
              )}
              <button className="sl-action" title="Rename" onClick={() => { setEditingId(s.id); setEditName(s.name); setConfirmDeleteId(null); }}>✏</button>
              <div style={{ position: "relative" }}>
                <button className="sl-action sl-delete" title="Delete" onClick={() => setConfirmDeleteId(confirmDeleteId === s.id ? null : s.id)}>✕</button>
                {confirmDeleteId === s.id && (
                  <div className="sl-confirm-drop">
                    <span>Delete?</span>
                    <button onClick={() => { handleDelete(s.id); setConfirmDeleteId(null); }}>Yes</button>
                    <button onClick={() => setConfirmDeleteId(null)}>No</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
