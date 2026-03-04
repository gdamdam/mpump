import { useState, useRef, useCallback } from "react";
import type { Catalog, ClientMessage, DrumHit, DeviceState, StepData } from "../types";
import { getDeviceGenres, getDeviceBassGenres } from "../data/catalog";
import { StepGrid } from "./StepGrid";
import { DrumGrid } from "./DrumGrid";
import { BassGrid } from "./BassGrid";
import { BeatIndicator } from "./BeatIndicator";
import { Transport } from "./Transport";
import { Picker } from "./Picker";
import { StepEditor } from "./StepEditor";
import { SaveDialog } from "./SaveDialog";
import {
  exportMelodicMidi, exportDrumMidi, exportDrumBassMidi,
  importMelodicMidi, importDrumMidi,
} from "../utils/midi";
import { parseKey } from "../data/keys";

type PickerMode = null | "genre" | "pattern" | "key" | "octave" | "bass_genre" | "bass_pattern";

interface Props {
  state: DeviceState;
  catalog: Catalog | null;
  command: (msg: ClientMessage) => void;
}

export function DevicePanel({ state, catalog, command }: Props) {
  const { id: device, label, accent, mode, editing } = state;

  const [picker, setPicker] = useState<PickerMode>(null);
  const [editingStep, setEditingStep] = useState<number | null>(null);
  const [editingBassStep, setEditingBassStep] = useState<number | null>(null);
  const [showSave, setShowSave] = useState(false);
  const doubled = state.patternLength === 32;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const drumFileInputRef = useRef<HTMLInputElement>(null);

  // Genre/pattern lists from catalog
  const genreList = catalog ? getDeviceGenres(catalog, device, mode) : [];
  const patternList = genreList[state.genre_idx]?.patterns ?? [];
  const bassGenreList = mode === "drums+bass" && catalog ? getDeviceBassGenres(catalog) : undefined;
  const bassPatternList = bassGenreList?.[state.bass_genre_idx]?.patterns;
  const keys = catalog?.keys;
  const octaveMin = catalog?.octave_min ?? 0;
  const octaveMax = catalog?.octave_max ?? 6;

  // Root note for step editors
  const rootNote = state.hasKey && keys
    ? parseKey(keys[state.key_idx], state.octave)
    : 45;

  // J-6 chord set display
  const chordSet = device === "j6" && catalog?.j6.chord_sets
    ? catalog.j6.chord_sets[genreList[state.genre_idx]?.name ?? ""] ?? null
    : null;

  // Swipe handling
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;

    const MIN_SWIPE = 50;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > MIN_SWIPE) {
      const delta = dx > 0 ? -1 : 1;
      if (genreList.length) {
        command({ type: "set_genre", device, idx: (state.genre_idx + delta + genreList.length) % genreList.length });
      }
    } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > MIN_SWIPE) {
      const delta = dy > 0 ? -1 : 1;
      if (patternList.length) {
        command({ type: "set_pattern", device, idx: (state.pattern_idx + delta + patternList.length) % patternList.length });
      }
    }
  };

  const genreName = genreList[state.genre_idx]?.name ?? "---";
  const patInfo = patternList[state.pattern_idx];

  // ── Melodic step editing (synth mode) ──────────────────────────────────

  const handleStepTap = useCallback((idx: number) => {
    const step = state.pattern_data[idx];
    const newData: StepData | null = step ? null : { semi: 0, vel: 1.0, slide: false };
    command({ type: "edit_step", device, step: idx, data: newData });
  }, [state.pattern_data, device, command]);

  const handleStepLongPress = useCallback((idx: number) => {
    setEditingStep(idx);
  }, []);

  const handleStepEditorSave = useCallback((data: StepData | null) => {
    if (editingStep !== null) {
      command({ type: "edit_step", device, step: editingStep, data });
    }
  }, [editingStep, device, command]);

  // ── Drum step editing ──────────────────────────────────────────────────

  const handleDrumToggle = useCallback((stepIdx: number, note: number, vel: number) => {
    const existing = state.drum_data[stepIdx] ?? [];
    const hasHit = existing.some((h) => h.note === note);
    const newHits: DrumHit[] = hasHit
      ? existing.filter((h) => h.note !== note)
      : [...existing, { note, vel }];
    command({ type: "edit_drum_step", device, step: stepIdx, hits: newHits });
  }, [state.drum_data, device, command]);

  // ── Bass step editing (drums+bass mode) ────────────────────────────────

  const handleBassTap = useCallback((idx: number) => {
    const step = state.bass_data[idx];
    const newData: StepData | null = step ? null : { semi: 0, vel: 1.0, slide: false };
    command({ type: "edit_step", device: `${device}_bass`, step: idx, data: newData });
  }, [state.bass_data, device, command]);

  const handleBassLongPress = useCallback((idx: number) => {
    setEditingBassStep(idx);
  }, []);

  const handleBassEditorSave = useCallback((data: StepData | null) => {
    if (editingBassStep !== null) {
      command({ type: "edit_step", device: `${device}_bass`, step: editingBassStep, data });
    }
  }, [editingBassStep, device, command]);

  // ── Save / discard ─────────────────────────────────────────────────────

  const handleSave = useCallback((name: string, desc: string) => {
    command({ type: "save_pattern", device, name, desc });
  }, [device, command]);

  const handleDiscard = useCallback(() => {
    command({ type: "discard_edit", device });
  }, [device, command]);

  // ── MIDI export ────────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    const bpm = 120; // default; could be passed as prop
    const genrePart = genreName.replace(/\s+/g, "-");
    const patPart = patInfo?.name?.replace(/\s+/g, "-") ?? "pattern";

    if (mode === "synth") {
      await exportMelodicMidi(state.pattern_data, rootNote, bpm, `${label}-${genrePart}-${patPart}.mid`);
    } else if (mode === "drums") {
      await exportDrumMidi(state.drum_data, bpm, `${label}-${genrePart}-${patPart}.mid`);
    } else if (mode === "drums+bass") {
      await exportDrumBassMidi(state.drum_data, state.bass_data, rootNote, bpm, `${label}-${genrePart}-${patPart}.mid`);
    }
  }, [mode, state, keys, genreName, patInfo, label]);

  // ── MIDI import ────────────────────────────────────────────────────────

  const handleImportMelodic = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const steps = await importMelodicMidi(file);
      for (let i = 0; i < Math.min(steps.length, state.patternLength); i++) {
        command({ type: "edit_step", device, step: i, data: steps[i] });
      }
    } catch (err) {
      console.error("MIDI import failed:", err);
    }
    e.target.value = ""; // reset for re-import
  }, [device, command]);

  const handleImportDrum = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const drumData = await importDrumMidi(file);
      for (let i = 0; i < Math.min(drumData.length, state.patternLength); i++) {
        command({ type: "edit_drum_step", device, step: i, hits: drumData[i] });
      }
    } catch (err) {
      console.error("MIDI import failed:", err);
    }
    e.target.value = "";
  }, [device, command]);

  return (
    <div
      className="device-panel"
      style={{ "--device-accent": accent } as React.CSSProperties}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Header row */}
      <div className="panel-header">
        <span className="panel-label" style={{ color: accent }}>
          {label}
          {editing && <span className="editing-badge">EDIT</span>}
        </span>
        <div className="panel-actions">
          <button
            className={`device-len-btn ${doubled ? "active" : ""}`}
            title="Toggle 16/32 steps"
            onClick={() => command({ type: "set_pattern_length", device, length: doubled ? 16 : 32 })}
          >
            {doubled ? "32" : "16"}
          </button>
          <button
            className="device-midi-btn"
            title="Export MIDI"
            onClick={handleExport}
          >
            &#x21E9;
          </button>
          <button
            className="device-midi-btn"
            title="Import MIDI"
            onClick={() => mode === "synth" ? fileInputRef.current?.click() : drumFileInputRef.current?.click()}
          >
            &#x21E7;
          </button>
          <button
            className="device-shuffle-btn"
            title="Randomize genre &amp; pattern"
            onClick={() => command({ type: "randomize_device", device })}
          >
            &#x2684;
          </button>
          <Transport device={device} paused={state.paused} command={command} />
        </div>
      </div>

      {/* Hidden file inputs for MIDI import */}
      <input ref={fileInputRef} type="file" accept=".mid,.midi" style={{ display: "none" }} onChange={handleImportMelodic} />
      <input ref={drumFileInputRef} type="file" accept=".mid,.midi" style={{ display: "none" }} onChange={handleImportDrum} />

      {/* ── drums or drums+bass: drum section + optional bass ──────── */}
      {mode !== "synth" ? (
        <>
          {/* DRUMS section */}
          <div className="t8-section">
            {mode === "drums+bass" && (
              <div className="t8-section-label" style={{ color: accent }}>drums</div>
            )}
            <button className="info-row" onClick={() => setPicker("genre")}>
              <span className="info-key">genre</span>
              <span className="info-val" style={{ color: accent }}>{genreName}</span>
            </button>
            <button className="info-row" onClick={() => setPicker("pattern")}>
              <span className="info-key">pattern</span>
              <span className="info-val">{patInfo?.name ?? "---"}</span>
            </button>
            {patInfo?.desc && <div className="info-desc">{patInfo.desc}</div>}
            <BeatIndicator step={state.step} accent={accent} numSteps={state.patternLength} />
            <DrumGrid
              drumData={doubled ? state.drum_data.slice(0, 16) : state.drum_data}
              currentStep={doubled ? (state.step < 16 ? state.step : -1) : state.step}
              accent={accent}
              onToggle={handleDrumToggle}
            />
            {doubled && (
              <div className="doubled-row">
                <DrumGrid
                  drumData={state.drum_data.slice(16, 32)}
                  currentStep={state.step >= 16 ? state.step - 16 : -1}
                  accent={accent}
                  onToggle={(stepIdx, note, vel) => handleDrumToggle(stepIdx + 16, note, vel)}
                />
              </div>
            )}
          </div>

          {/* BASS section (drums+bass only) */}
          {mode === "drums+bass" && bassGenreList && (
            <div className="t8-section">
              <div className="t8-section-header">
                <div className="t8-section-label" style={{ color: accent }}>bass</div>
                <button
                  className="device-shuffle-btn"
                  title="Randomize bass genre &amp; pattern"
                  onClick={() => command({ type: "randomize_bass", device })}
                >
                  &#x2684;
                </button>
              </div>
              <button className="info-row" onClick={() => setPicker("bass_genre")}>
                <span className="info-key">genre</span>
                <span className="info-val" style={{ color: accent }}>
                  {bassGenreList[state.bass_genre_idx]?.name ?? "---"}
                </span>
              </button>
              <button className="info-row" onClick={() => setPicker("bass_pattern")}>
                <span className="info-key">pattern</span>
                <span className="info-val">
                  {bassPatternList?.[state.bass_pattern_idx]?.name ?? "---"}
                </span>
              </button>
              {state.hasKey && keys && (
                <div className="key-octave-row">
                  <button className="info-row half" onClick={() => setPicker("key")}>
                    <span className="info-key">key</span>
                    <span className="info-val">{keys[state.key_idx]}</span>
                  </button>
                  <button className="info-row half" onClick={() => setPicker("octave")}>
                    <span className="info-key">oct</span>
                    <span className="info-val">{state.octave}</span>
                  </button>
                </div>
              )}
              <BassGrid
                steps={doubled ? state.bass_data.slice(0, 16) : state.bass_data}
                currentStep={doubled ? (state.step < 16 ? state.step : -1) : state.step}
                accent={accent}
                onTap={handleBassTap}
                onLongPress={handleBassLongPress}
              />
              {doubled && (
                <div className="doubled-row">
                  <BassGrid
                    steps={state.bass_data.slice(16, 32)}
                    currentStep={state.step >= 16 ? state.step - 16 : -1}
                    accent={accent}
                    onTap={(idx) => handleBassTap(idx + 16)}
                    onLongPress={(idx) => handleBassLongPress(idx + 16)}
                  />
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* ── synth mode: genre/pattern + step grid ────────────────── */
        <>
          <button className="info-row" onClick={() => setPicker("genre")}>
            <span className="info-key">genre</span>
            <span className="info-val" style={{ color: accent }}>
              {genreName}
              {chordSet !== null && <span className="chord-set"> set {chordSet}</span>}
            </span>
          </button>
          <button className="info-row" onClick={() => setPicker("pattern")}>
            <span className="info-key">pattern</span>
            <span className="info-val">{patInfo?.name ?? "---"}</span>
          </button>
          {patInfo?.desc && <div className="info-desc">{patInfo.desc}</div>}
          {state.hasKey && keys && (
            <div className="key-octave-row">
              <button className="info-row half" onClick={() => setPicker("key")}>
                <span className="info-key">key</span>
                <span className="info-val">{keys[state.key_idx]}</span>
              </button>
              <button className="info-row half" onClick={() => setPicker("octave")}>
                <span className="info-key">oct</span>
                <span className="info-val">{state.octave}</span>
              </button>
            </div>
          )}
          <BeatIndicator step={state.step} accent={accent} numSteps={state.patternLength} />
          <StepGrid
            steps={doubled ? state.pattern_data.slice(0, 16) : state.pattern_data}
            currentStep={doubled ? (state.step < 16 ? state.step : -1) : state.step}
            accent={accent}
            onTap={handleStepTap}
            onLongPress={handleStepLongPress}
          />
          {doubled && (
            <div className="doubled-row">
              <StepGrid
                steps={state.pattern_data.slice(16, 32)}
                currentStep={state.step >= 16 ? state.step - 16 : -1}
                accent={accent}
                onTap={(idx) => handleStepTap(idx + 16)}
                onLongPress={(idx) => handleStepLongPress(idx + 16)}
              />
            </div>
          )}
        </>
      )}

      {/* Edit actions bar */}
      {editing && (
        <div className="edit-actions">
          <button className="edit-btn discard" onClick={handleDiscard}>
            Discard
          </button>
          <button
            className="edit-btn save"
            style={{ background: accent, color: "#000" }}
            onClick={() => setShowSave(true)}
          >
            Save to Extras
          </button>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────── */}

      {picker === "genre" && (
        <Picker
          title={`${label} Genre`}
          items={genreList.map((g) => ({ label: g.name }))}
          selectedIdx={state.genre_idx}
          onSelect={(i) => command({ type: "set_genre", device, idx: i })}
          onClose={() => setPicker(null)}
          accent={accent}
        />
      )}
      {picker === "pattern" && (
        <Picker
          title={`${label} Pattern`}
          items={patternList.map((p) => ({ label: p.name, desc: p.desc }))}
          selectedIdx={state.pattern_idx}
          onSelect={(i) => command({ type: "set_pattern", device, idx: i })}
          onClose={() => setPicker(null)}
          accent={accent}
        />
      )}
      {picker === "key" && keys && (
        <Picker
          title="Key"
          items={keys.map((k) => ({ label: k }))}
          selectedIdx={state.key_idx}
          onSelect={(i) => command({ type: "set_key", device, idx: i })}
          onClose={() => setPicker(null)}
          accent={accent}
        />
      )}
      {picker === "octave" && (
        <Picker
          title="Octave"
          items={Array.from({ length: octaveMax - octaveMin + 1 }, (_, i) => ({
            label: String(octaveMin + i),
          }))}
          selectedIdx={(state.octave) - octaveMin}
          onSelect={(i) => command({ type: "set_octave", device, octave: octaveMin + i })}
          onClose={() => setPicker(null)}
          accent={accent}
        />
      )}
      {picker === "bass_genre" && bassGenreList && (
        <Picker
          title={`${label} Bass Genre`}
          items={bassGenreList.map((g) => ({ label: g.name }))}
          selectedIdx={state.bass_genre_idx}
          onSelect={(i) => command({ type: "set_genre", device: `${device}_bass`, idx: i })}
          onClose={() => setPicker(null)}
          accent={accent}
        />
      )}
      {picker === "bass_pattern" && bassPatternList && (
        <Picker
          title={`${label} Bass Pattern`}
          items={bassPatternList.map((p) => ({ label: p.name, desc: p.desc }))}
          selectedIdx={state.bass_pattern_idx}
          onSelect={(i) => command({ type: "set_pattern", device: `${device}_bass`, idx: i })}
          onClose={() => setPicker(null)}
          accent={accent}
        />
      )}

      {/* Step editor modal (melodic) */}
      {editingStep !== null && (
        <StepEditor
          initial={state.pattern_data[editingStep] ?? null}
          accent={accent}
          rootNote={rootNote}
          onSave={handleStepEditorSave}
          onClose={() => setEditingStep(null)}
        />
      )}

      {/* Step editor modal (bass) */}
      {editingBassStep !== null && (
        <StepEditor
          initial={state.bass_data[editingBassStep] ?? null}
          accent={accent}
          rootNote={rootNote}
          onSave={handleBassEditorSave}
          onClose={() => setEditingBassStep(null)}
        />
      )}

      {/* Save dialog */}
      {showSave && (
        <SaveDialog
          accent={accent}
          deviceLabel={label}
          onSave={handleSave}
          onClose={() => setShowSave(false)}
        />
      )}
    </div>
  );
}
