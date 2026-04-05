/**
 * SongStrip — Compact horizontal scene arrangement strip for song mode.
 * Capture scenes, arrange them with bar counts and transitions, play/stop/loop.
 */

import { useState, useRef } from "react";
import type { ClientMessage, SongState, SongScene, SongArrangementEntry, TransitionType } from "../types";
import { getJSON, setJSON } from "../utils/storage";
import { checkRelayHealth, shortenBeat } from "../utils/shareRelay";

interface Props {
  accent: string;
  songState: SongState;
  command: (msg: ClientMessage) => void;
}

const TRANSITION_LABELS: Record<TransitionType, string> = {
  instant: "—",
  fade: "~",
  filter: "▽",
  breakdown: "!",
};
const TRANSITION_TITLES: Record<TransitionType, string> = {
  instant: "Instant cut",
  fade: "Volume crossfade",
  filter: "Filter sweep",
  breakdown: "Drum breakdown",
};

const TRANSITION_ORDER: TransitionType[] = ["instant", "fade", "filter", "breakdown"];

interface SavedSong {
  name: string;
  scenes: SongScene[];
  arrangement: SongArrangementEntry[];
}

const STORAGE_KEY = "mpump-saved-songs";

export function SongStrip({ accent, songState, command }: Props) {
  const { scenes, arrangement, loop, playback } = songState;
  const [showLib, setShowLib] = useState(false);
  const [showSongList, setShowSongList] = useState(false);
  const [savedSongs, setSavedSongs] = useState<SavedSong[]>(() => getJSON(STORAGE_KEY, []));
  const [songCopied, setSongCopied] = useState(false);
  const [songSharing, setSongSharing] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const totalBars = arrangement.reduce((a, e) => a + e.bars, 0);

  const saveSong = () => {
    if (scenes.length === 0 && arrangement.length === 0) return;
    const name = prompt("Song name:", `Song ${savedSongs.length + 1}`);
    if (!name?.trim()) return;
    const song: SavedSong = { name: name.trim(), scenes, arrangement };
    const updated = [...savedSongs.filter(s => s.name !== name.trim()), song];
    setSavedSongs(updated);
    setJSON(STORAGE_KEY, updated);
  };

  const loadSong = (song: SavedSong) => {
    command({ type: "song_load", scenes: song.scenes, arrangement: song.arrangement });
    setShowSongList(false);
  };

  const deleteSong = (name: string) => {
    const updated = savedSongs.filter(s => s.name !== name);
    setSavedSongs(updated);
    setJSON(STORAGE_KEY, updated);
  };

  const shareSong = async () => {
    if (scenes.length === 0 || arrangement.length === 0) return;
    setSongSharing(true);
    try {
      const payload = JSON.stringify({ s: scenes, a: arrangement });
      // Compress with deflate
      const encoder = new CompressionStream("deflate");
      const writer = encoder.writable.getWriter();
      writer.write(new TextEncoder().encode(payload));
      writer.close();
      const reader = encoder.readable.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const compressed = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) { compressed.set(c, off); off += c.length; }
      const b64 = btoa(String.fromCharCode(...compressed)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const longUrl = `${window.location.origin}/app.html?song=${b64}`;
      let url = longUrl;
      const up = await checkRelayHealth();
      if (up) {
        const result = await shortenBeat(longUrl);
        if (result) url = result.short;
      }
      await navigator.clipboard.writeText(url);
      setSongCopied(true);
      setTimeout(() => setSongCopied(false), 2000);
    } catch { /* silent */ }
    setSongSharing(false);
  };

  const capture = () => {
    const name = nameRef.current?.value?.trim() || `S${scenes.length + 1}`;
    command({ type: "song_capture_scene", name });
    if (nameRef.current) nameRef.current.value = "";
  };

  const addToArrangement = (sceneId: string) => {
    const entry: SongArrangementEntry = { sceneId, bars: 8, transition: "instant" };
    command({ type: "song_set_arrangement", arrangement: [...arrangement, entry] });
  };

  const removeFromArrangement = (idx: number) => {
    command({ type: "song_set_arrangement", arrangement: arrangement.filter((_, i) => i !== idx) });
  };

  const updateEntry = (idx: number, patch: Partial<SongArrangementEntry>) => {
    const updated = arrangement.map((e, i) => i === idx ? { ...e, ...patch } : e);
    command({ type: "song_set_arrangement", arrangement: updated });
  };

  const cycleTransition = (idx: number) => {
    const current = arrangement[idx].transition;
    const next = TRANSITION_ORDER[(TRANSITION_ORDER.indexOf(current) + 1) % TRANSITION_ORDER.length];
    updateEntry(idx, { transition: next });
  };

  const getSceneName = (id: string) => scenes.find(s => s.id === id)?.name ?? "?";

  return (
    <div className="song-editor" style={{ fontSize: 10 }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="drum-kit-label" style={{ color: accent, fontSize: 11, margin: 0 }}>SONG</span>
          <span style={{ opacity: 0.5, fontSize: 9 }}>{totalBars}b</span>
          {playback.playing && (
            <span style={{ fontSize: 9, color: accent }}>
              ▶ {playback.barInScene}/{arrangement[playback.currentIndex]?.bars ?? 0}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          <button
            className={`synth-osc-btn ${playback.playing ? "active" : ""}`}
            style={playback.playing ? { fontSize: 9, background: accent, color: "#000", padding: "2px 8px" } : { fontSize: 9, padding: "2px 8px" }}
            onClick={(e) => { e.stopPropagation(); command({ type: playback.playing ? "song_stop" : "song_play" }); }}
          >
            {playback.playing ? "■" : "▶"}
          </button>
          <button
            className={`synth-osc-btn ${loop ? "active" : ""}`}
            style={loop ? { fontSize: 9, background: accent, color: "#000", padding: "2px 6px" } : { fontSize: 9, padding: "2px 6px" }}
            onClick={(e) => { e.stopPropagation(); command({ type: "song_toggle_loop" }); }}
            title="Loop"
          >
            ↻
          </button>
          <button
            className="synth-osc-btn"
            style={{ fontSize: 9, padding: "2px 6px" }}
            onClick={(e) => { e.stopPropagation(); capture(); }}
            title="Capture current state as scene"
          >
            ⊕
          </button>
          <button
            className={`synth-osc-btn ${showLib ? "active" : ""}`}
            style={{ fontSize: 9, padding: "2px 6px" }}
            onClick={(e) => { e.stopPropagation(); setShowLib(!showLib); setShowSongList(false); }}
            title="Scene library"
          >
            LIB
          </button>
          <span style={{ width: 1, height: 12, background: "rgba(102,255,153,0.15)", display: "inline-block" }} />
          <button
            className="synth-osc-btn"
            style={{ fontSize: 9, padding: "2px 6px" }}
            onClick={(e) => { e.stopPropagation(); saveSong(); }}
            title="Save song"
          >
            +Save
          </button>
          <button
            className={`synth-osc-btn ${showSongList ? "active" : ""}`}
            style={{ fontSize: 9, padding: "2px 6px" }}
            onClick={(e) => { e.stopPropagation(); setShowSongList(!showSongList); setShowLib(false); }}
            title="Load saved song"
          >
            Songs
          </button>
          {arrangement.length > 0 && (
            <button
              className="synth-osc-btn"
              style={{ fontSize: 9, padding: "2px 5px", opacity: songSharing ? 0.4 : 0.7 }}
              onClick={(e) => { e.stopPropagation(); shareSong(); }}
              title="Copy song link to clipboard"
              disabled={songSharing}
            >
              {songCopied ? "✓" : "⤴"}
            </button>
          )}
        </div>
      </div>

      {/* Scene library (collapsible) */}
      {showLib && (
        <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
          <input
            ref={nameRef}
            type="text"
            placeholder="name..."
            className="synth-preset-select"
            style={{ width: 80, fontSize: 9, padding: "1px 4px" }}
            onKeyDown={(e) => e.key === "Enter" && capture()}
          />
          {scenes.map(s => (
            <span key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
              <button
                className="synth-osc-btn"
                style={{ fontSize: 9, padding: "1px 6px", borderRadius: "3px 0 0 3px" }}
                onClick={() => addToArrangement(s.id)}
                title={`Add "${s.name}" to arrangement`}
              >
                + {s.name}
              </button>
              <button
                className="synth-osc-btn"
                style={{ fontSize: 7, padding: "1px 3px", opacity: 0.4, borderRadius: "0 3px 3px 0" }}
                onClick={() => command({ type: "song_delete_scene", sceneId: s.id })}
                title={`Delete "${s.name}"`}
              >
                ✕
              </button>
            </span>
          ))}
          {scenes.length === 0 && <span style={{ opacity: 0.4, fontSize: 9 }}>Click ⊕ to capture a scene</span>}
        </div>
      )}

      {/* Saved songs list (collapsible) */}
      {showSongList && (
        <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
          {savedSongs.length === 0 && <span style={{ opacity: 0.4, fontSize: 9 }}>No saved songs yet</span>}
          {savedSongs.map(s => (
            <span key={s.name} style={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
              <button
                className="synth-osc-btn"
                style={{ fontSize: 9, padding: "1px 6px", borderRadius: "3px 0 0 3px" }}
                onClick={() => loadSong(s)}
                title={`Load "${s.name}" (${s.scenes.length} scenes, ${s.arrangement.length} blocks)`}
              >
                {s.name}
              </button>
              <button
                className="synth-osc-btn"
                style={{ fontSize: 7, padding: "1px 3px", opacity: 0.4, borderRadius: "0 3px 3px 0" }}
                onClick={() => deleteSong(s.name)}
                title={`Delete "${s.name}"`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Arrangement strip */}
      {arrangement.length > 0 && (
        <div style={{ display: "flex", gap: 2, overflowX: "auto", alignItems: "center" }}>
          {arrangement.map((entry, i) => {
            const isActive = playback.playing && playback.currentIndex === i;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 0 }}>
                {/* Transition between blocks */}
                {i > 0 && (
                  <button
                    className="synth-osc-btn"
                    style={{ fontSize: 8, padding: "0 2px", minWidth: 0, opacity: 0.4, margin: "0 1px" }}
                    onClick={() => cycleTransition(i)}
                    title={TRANSITION_TITLES[entry.transition]}
                  >
                    {TRANSITION_LABELS[entry.transition]}
                  </button>
                )}
                {/* Scene block */}
                <div
                  style={{
                    display: "flex", alignItems: "center", gap: 3,
                    padding: "2px 6px",
                    border: `1px solid ${isActive ? accent : "rgba(102,255,153,0.2)"}`,
                    borderRadius: 3,
                    background: isActive ? "rgba(102,255,153,0.1)" : "transparent",
                    cursor: playback.playing ? "pointer" : "default",
                    whiteSpace: "nowrap",
                    position: "relative",
                    overflow: "hidden",
                  }}
                  onClick={() => playback.playing && command({ type: "song_jump", index: i })}
                >
                  {/* Progress bar */}
                  {isActive && entry.bars > 0 && (
                    <div style={{
                      position: "absolute", left: 0, bottom: 0, height: 2,
                      width: `${(playback.barInScene / entry.bars) * 100}%`,
                      background: accent, opacity: 0.6,
                      transition: "width 0.3s linear",
                    }} />
                  )}
                  <span style={{ fontSize: 9, color: isActive ? accent : "inherit" }}>{getSceneName(entry.sceneId)}</span>
                  <select
                    className="synth-preset-select"
                    value={entry.bars}
                    onChange={(e) => updateEntry(i, { bars: parseInt(e.target.value) })}
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: 35, fontSize: 8, padding: 0 }}
                  >
                    {[1, 2, 4, 8, 16, 32].map(b => <option key={b} value={b}>{b}b</option>)}
                  </select>
                  <button
                    className="synth-osc-btn"
                    style={{ fontSize: 7, padding: "0 2px", opacity: 0.4 }}
                    onClick={(e) => { e.stopPropagation(); removeFromArrangement(i); }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {arrangement.length === 0 && !showLib && (
        <div style={{ fontSize: 9, opacity: 0.3 }}>Click ⊕ to capture, LIB to arrange</div>
      )}
    </div>
  );
}
