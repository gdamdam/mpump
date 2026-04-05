/**
 * SongStrip — Compact horizontal scene arrangement strip for song mode.
 * Capture scenes, arrange them with bar counts and transitions, play/stop/loop.
 */

import { useState, useRef } from "react";
import type { ClientMessage, SongState, SongArrangementEntry, TransitionType } from "../types";

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

export function SongStrip({ accent, songState, command }: Props) {
  const { scenes, arrangement, loop, playback } = songState;
  const [showLib, setShowLib] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const totalBars = arrangement.reduce((a, e) => a + e.bars, 0);

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
            onClick={(e) => { e.stopPropagation(); setShowLib(!showLib); }}
            title="Scene library"
          >
            LIB
          </button>
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
            <button
              key={s.id}
              className="synth-osc-btn"
              style={{ fontSize: 9, padding: "1px 6px" }}
              onClick={() => addToArrangement(s.id)}
              title={`Add "${s.name}" to arrangement`}
            >
              + {s.name}
            </button>
          ))}
          {scenes.length === 0 && <span style={{ opacity: 0.4, fontSize: 9 }}>Click ⊕ to capture a scene</span>}
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
                  }}
                  onClick={() => playback.playing && command({ type: "song_jump", index: i })}
                >
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
