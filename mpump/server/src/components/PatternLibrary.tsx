/**
 * PatternLibrary — Browsable catalog of all genres and patterns.
 * Opened from a header button. Click a pattern to load it.
 */

import { useState, useEffect } from "react";
import type { Catalog, ClientMessage } from "../types";

interface Props {
  catalog: Catalog;
  command: (msg: ClientMessage) => void;
  onClose: () => void;
}

type Tab = "drums" | "bass" | "synth";

export function PatternLibrary({ catalog, command, onClose }: Props) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const [tab, setTab] = useState<Tab>("drums");
  const [expandedGenre, setExpandedGenre] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const genres = tab === "drums"
    ? catalog.t8.drum_genres
    : tab === "bass"
      ? catalog.t8.bass_genres
      : catalog.s1.genres;

  const deviceId = tab === "drums" || tab === "bass" ? "preview_drums" : "preview_synth";
  const lower = search.toLowerCase();

  const filteredGenres = genres.map((g, gi) => ({
    ...g,
    gi,
    patterns: g.patterns.map((p, pi) => ({ ...p, pi })).filter(p =>
      !search || g.name.toLowerCase().includes(lower) || p.name.toLowerCase().includes(lower) || p.desc.toLowerCase().includes(lower)
    ),
  })).filter(g => g.patterns.length > 0);

  const loadPattern = (genreIdx: number, patternIdx: number) => {
    if (tab === "bass") {
      command({ type: "set_genre", device: `${deviceId}_bass`, idx: genreIdx });
      setTimeout(() => command({ type: "set_pattern", device: `${deviceId}_bass`, idx: patternIdx }), 50);
    } else {
      command({ type: "set_genre", device: deviceId, idx: genreIdx });
      setTimeout(() => command({ type: "set_pattern", device: deviceId, idx: patternIdx }), 50);
    }
  };

  return (
    <div className="lib-overlay" onClick={onClose}>
      <div className="lib-panel" onClick={(e) => e.stopPropagation()}>
        <div className="lib-header">
          <span className="lib-title">Pattern Library</span>
          <button className="settings-close" title="Close" onClick={onClose}>✕</button>
        </div>

        <div className="lib-tabs">
          {(["drums", "bass", "synth"] as Tab[]).map(t => (
            <button
              key={t}
              className={`lib-tab ${tab === t ? "active" : ""}`}
              onClick={() => { setTab(t); setExpandedGenre(null); }}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        <input
          className="lib-search"
          placeholder="Search genres and patterns..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="lib-count">{filteredGenres.reduce((a, g) => a + g.patterns.length, 0)} patterns</div>

        <div className="lib-list">
          {filteredGenres.map((g) => (
            <div key={g.gi} className="lib-genre">
              <button
                className="lib-genre-header"
                onClick={() => setExpandedGenre(expandedGenre === g.gi ? null : g.gi)}
              >
                <span className="lib-genre-name">{g.name}</span>
                <span className="lib-genre-count">{g.patterns.length}</span>
                <span className="lib-genre-arrow">{expandedGenre === g.gi ? "▼" : "▶"}</span>
              </button>
              {expandedGenre === g.gi && (
                <div className="lib-patterns">
                  {g.patterns.map((p) => (
                    <button
                      key={p.pi}
                      className="lib-pattern"
                      title={`Load: ${p.name}`}
                      onClick={() => { loadPattern(g.gi, p.pi); onClose(); }}
                    >
                      <span className="lib-pat-name">{p.name}</span>
                      {p.desc && <span className="lib-pat-desc">{p.desc}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
