/**
 * JadePanel — Accessible interface for users with motor precision difficulties.
 *
 * Design principles:
 * - Minimum 56px touch targets (exceeds WCAG 2.5.5 AAA 44px)
 * - High contrast colors
 * - Single-tap only (no long-press, no swipe)
 * - Clear labels with aria attributes
 * - Single-column mobile-first layout
 * - Large text, simple controls
 */

import type { Catalog, ClientMessage, DeviceState, PresetState } from "../types";
import { getDeviceGenres, getDeviceBassGenres } from "../data/catalog";
import { SYNTH_PRESETS, BASS_PRESETS, DRUM_KIT_PRESETS, groupPresets } from "../data/soundPresets";
import { SAMPLE_PACKS } from "../data/samplePacks";
import { KaosDropdown } from "./KaosDropdown";

interface Props {
  state: DeviceState;
  catalog: Catalog | null;
  command: (msg: ClientMessage) => void;
  bpm: number;
  presetState?: PresetState;
}

export function JadePanel({ state, catalog, command, bpm, presetState }: Props) {
  const { id: device, label, mode, accent } = state;

  const genreList = catalog ? getDeviceGenres(catalog, device, mode) : [];
  const patternList = genreList[state.genre_idx]?.patterns ?? [];
  const bassGenreList = mode === "drums+bass" && catalog ? getDeviceBassGenres(catalog) : undefined;
  const bassPatternList = bassGenreList?.[state.bass_genre_idx]?.patterns;

  const genreName = genreList[state.genre_idx]?.name ?? "---";
  const patName = patternList[state.pattern_idx]?.name ?? "---";
  const bassGenreName = bassGenreList?.[state.bass_genre_idx]?.name ?? "---";
  const bassPatName = bassPatternList?.[state.bass_pattern_idx]?.name ?? "---";

  const prevGenre = () => {
    const idx = (state.genre_idx - 1 + genreList.length) % genreList.length;
    command({ type: "set_genre", device, idx });
  };
  const nextGenre = () => {
    const idx = (state.genre_idx + 1) % genreList.length;
    command({ type: "set_genre", device, idx });
  };
  const prevPattern = () => {
    const idx = (state.pattern_idx - 1 + patternList.length) % patternList.length;
    command({ type: "set_pattern", device, idx });
  };
  const nextPattern = () => {
    const idx = (state.pattern_idx + 1) % patternList.length;
    command({ type: "set_pattern", device, idx });
  };

  const prevBassGenre = () => {
    if (!bassGenreList) return;
    const idx = (state.bass_genre_idx - 1 + bassGenreList.length) % bassGenreList.length;
    command({ type: "set_genre", device: `${device}_bass`, idx });
  };
  const nextBassGenre = () => {
    if (!bassGenreList) return;
    const idx = (state.bass_genre_idx + 1) % bassGenreList.length;
    command({ type: "set_genre", device: `${device}_bass`, idx });
  };
  const prevBassPattern = () => {
    if (!bassPatternList) return;
    const idx = (state.bass_pattern_idx - 1 + bassPatternList.length) % bassPatternList.length;
    command({ type: "set_pattern", device: `${device}_bass`, idx });
  };
  const nextBassPattern = () => {
    if (!bassPatternList) return;
    const idx = (state.bass_pattern_idx + 1) % bassPatternList.length;
    command({ type: "set_pattern", device: `${device}_bass`, idx });
  };

  // Step visualization: big dots
  const numSteps = state.patternLength;
  const stepDots = Array.from({ length: numSteps }, (_, i) => {
    const active = mode === "synth"
      ? state.pattern_data[i] !== null
      : (state.drum_data[i]?.length ?? 0) > 0;
    const current = state.step === i;
    return { active, current };
  });

  return (
    <div className="jade-panel" role="main" aria-label={`${label} controls`}>
      <a href="#jade-controls" className="sr-only">Skip to controls</a>
      <div className="jade-label" style={{ color: accent }} aria-hidden="true">
        {label}
      </div>

      {/* Play / Pause + Sound presets */}
      <div role="status" id="jade-controls" className="jade-play-row">
        <button
          className={`jade-play ${state.paused ? "" : "playing"}`}
          style={!state.paused ? { background: accent } : { background: "var(--bg-cell)", color: "var(--text)", border: "3px solid var(--border)" }}
          onClick={() => command({ type: "toggle_pause", device })}
          title={state.paused ? "Play" : "Pause"}
          aria-label={state.paused ? "Play" : "Pause"}
        >
          {state.paused ? "PLAY" : "PAUSE"}
        </button>
        {mode !== "synth" && presetState && (
          <KaosDropdown className="jade-dropdown" value={presetState.activeDrumKit} onChange={(v: string) => presetState.onDrumKitChange(v)} options={[
            { group: "Machines", items: SAMPLE_PACKS.map(p => ({ label: p.name, value: `pack:${p.id}` })) },
            { group: "Presets", items: DRUM_KIT_PRESETS.map((p, i) => ({ label: p.name, value: String(i) })) },
          ]} />
        )}
        {mode === "synth" && presetState && (
          <KaosDropdown className="jade-dropdown" value={presetState.activeSynth} onChange={(v: string) => presetState.onSynthChange(v)} options={groupPresets(SYNTH_PRESETS).map(([g, items]) => ({ group: g || "Presets", items: items.map(([i, p]) => ({ label: p.name, value: String(i) })) }))} />
        )}
        {mode === "drums+bass" && presetState && (
          <KaosDropdown className="jade-dropdown" value={presetState.activeBass} onChange={(v: string) => presetState.onBassChange(v)} options={groupPresets(BASS_PRESETS).map(([g, items]) => ({ group: g || "Presets", items: items.map(([i, p]) => ({ label: p.name, value: String(i) })) }))} />
        )}
      </div>

      {/* Mute */}
      {mode === "drums+bass" && (
        <button
          className={`jade-mute ${state.drumsMuted ? "muted" : ""}`}
          onClick={() => command({ type: "toggle_drums_mute", device })}
          title={state.drumsMuted ? "Unmute drums" : "Mute drums"}
          aria-label={state.drumsMuted ? "Unmute drums" : "Mute drums"}
          aria-pressed={state.drumsMuted}
        >
          {state.drumsMuted ? "DRUMS MUTED" : "DRUMS ON"}
        </button>
      )}
      {mode === "synth" && (
        <button
          className={`jade-mute ${state.drumsMuted ? "muted" : ""}`}
          onClick={() => command({ type: "toggle_drums_mute", device })}
          title={state.drumsMuted ? "Unmute synth" : "Mute synth"}
          aria-label={state.drumsMuted ? "Unmute synth" : "Mute synth"}
          aria-pressed={state.drumsMuted}
        >
          {state.drumsMuted ? "SYNTH MUTED" : "SYNTH ON"}
        </button>
      )}

      {/* Randomize */}
      <button
        className="jade-action"
        onClick={() => command({ type: "randomize_device", device })}
        title="Randomize genre and pattern"
        aria-label="Randomize genre and pattern"
      >
        SHUFFLE
      </button>

      {/* Genre nav */}
      <div className="jade-section-label">Genre</div>
      <div className="jade-nav" role="group" aria-label="Genre selection">
        <button className="jade-nav-btn" onClick={prevGenre} title="Previous genre" aria-label="Previous genre">&#x25C0;</button>
        <span className="jade-nav-value" style={{ color: accent }} aria-live="polite" aria-label={`Genre: ${genreName}`}>{genreName}</span>
        <button className="jade-nav-btn" onClick={nextGenre} title="Next genre" aria-label="Next genre">&#x25B6;</button>
      </div>

      {/* Pattern nav */}
      <div className="jade-section-label">Pattern</div>
      <div className="jade-nav" role="group" aria-label="Pattern selection">
        <button className="jade-nav-btn" onClick={prevPattern} title="Previous pattern" aria-label="Previous pattern">&#x25C0;</button>
        <span className="jade-nav-value" style={{ color: accent }} aria-live="polite" aria-label={`Pattern: ${patName}`}>{patName}</span>
        <button className="jade-nav-btn" onClick={nextPattern} title="Next pattern" aria-label="Next pattern">&#x25B6;</button>
      </div>

      {/* Step visualization */}
      <div className="jade-steps" role="img" aria-live="assertive" aria-label={`Step ${state.step + 1} of ${numSteps}`}>
        {stepDots.map((dot, i) => (
          <div
            key={i}
            className={`jade-dot ${dot.active ? "on" : ""} ${dot.current ? "current" : ""}`}
            style={dot.current ? { background: accent } : dot.active ? { background: accent, opacity: 0.4 } : undefined}
          />
        ))}
      </div>

      {/* Bass synth (separate instrument) */}
      {mode === "drums+bass" && bassGenreList && (
        <div className="jade-panel jade-bass-section" role="region" aria-label="Bass synth controls">
          <div className="jade-label" style={{ color: accent }}>Bass Synth</div>

          <div className="jade-play-row">
            <button
              className={`jade-play ${state.bassMuted ? "" : "playing"}`}
              style={!state.bassMuted ? { background: accent } : { background: "var(--bg-cell)", color: "var(--text)", border: "3px solid var(--border)" }}
              onClick={() => command({ type: "toggle_bass_mute", device })}
              title={state.bassMuted ? "Play bass" : "Pause bass"}
              aria-label={state.bassMuted ? "Play bass" : "Pause bass"}
            >
              {state.bassMuted ? "PLAY" : "PAUSE"}
            </button>
            {presetState && (
              <KaosDropdown className="jade-dropdown" value={presetState.activeBass} onChange={(v: string) => presetState.onBassChange(v)} options={groupPresets(BASS_PRESETS).map(([g, items]) => ({ group: g || "Presets", items: items.map(([i, p]) => ({ label: p.name, value: String(i) })) }))} />
            )}
          </div>

          <div className="jade-section-label">Genre</div>
          <div className="jade-nav" role="group" aria-label="Bass genre selection">
            <button className="jade-nav-btn" onClick={prevBassGenre} title="Previous bass genre" aria-label="Previous bass genre">&#x25C0;</button>
            <span className="jade-nav-value" style={{ color: accent }} aria-live="polite" aria-label={`Bass genre: ${bassGenreName}`}>{bassGenreName}</span>
            <button className="jade-nav-btn" onClick={nextBassGenre} title="Next bass genre" aria-label="Next bass genre">&#x25B6;</button>
          </div>
          <div className="jade-section-label">Pattern</div>
          <div className="jade-nav" role="group" aria-label="Bass pattern selection">
            <button className="jade-nav-btn" onClick={prevBassPattern} title="Previous bass pattern" aria-label="Previous bass pattern">&#x25C0;</button>
            <span className="jade-nav-value" style={{ color: accent }} aria-live="polite" aria-label={`Bass pattern: ${bassPatName}`}>{bassPatName}</span>
            <button className="jade-nav-btn" onClick={nextBassPattern} title="Next bass pattern" aria-label="Next bass pattern">&#x25B6;</button>
          </div>
        </div>
      )}



    </div>
  );
}
