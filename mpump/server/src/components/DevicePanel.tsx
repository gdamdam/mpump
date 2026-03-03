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

  // Genre/pattern lists from catalog
  const genreList = catalog ? getDeviceGenres(catalog, device, mode) : [];
  const patternList = genreList[state.genre_idx]?.patterns ?? [];
  const bassGenreList = mode === "drums+bass" && catalog ? getDeviceBassGenres(catalog) : undefined;
  const bassPatternList = bassGenreList?.[state.bass_genre_idx]?.patterns;
  const keys = catalog?.keys;
  const octaveMin = catalog?.octave_min ?? 0;
  const octaveMax = catalog?.octave_max ?? 6;

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
            className="device-shuffle-btn"
            title="Randomize genre &amp; pattern"
            onClick={() => command({ type: "randomize_device", device })}
          >
            &#x2684;
          </button>
          <Transport device={device} paused={state.paused} command={command} />
        </div>
      </div>

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
            <BeatIndicator step={state.step} accent={accent} />
            <DrumGrid
              drumData={state.drum_data}
              currentStep={state.step}
              accent={accent}
              onToggle={handleDrumToggle}
            />
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
                steps={state.bass_data}
                currentStep={state.step}
                accent={accent}
                onTap={handleBassTap}
                onLongPress={handleBassLongPress}
              />
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
          <BeatIndicator step={state.step} accent={accent} />
          <StepGrid
            steps={state.pattern_data}
            currentStep={state.step}
            accent={accent}
            onTap={handleStepTap}
            onLongPress={handleStepLongPress}
          />
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
          onSave={handleStepEditorSave}
          onClose={() => setEditingStep(null)}
        />
      )}

      {/* Step editor modal (bass) */}
      {editingBassStep !== null && (
        <StepEditor
          initial={state.bass_data[editingBassStep] ?? null}
          accent={accent}
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
