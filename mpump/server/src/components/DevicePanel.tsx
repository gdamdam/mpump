import { useState, useRef, useCallback, useEffect } from "react";
import { SignalLed } from "./SignalLed";
import type { Catalog, ClientMessage, DrumHit, DeviceState, StepData, PresetState } from "../types";
import { tapVibrate } from "../utils/haptic";
import { getItem, setItem, getBool, setBool } from "../utils/storage";
import { getDeviceGenres, getDeviceBassGenres } from "../data/catalog";
import { StepGrid } from "./StepGrid";
import { DrumGrid } from "./DrumGrid";
import { BassGrid } from "./BassGrid";
import { BeatIndicator } from "./BeatIndicator";
import { Transport } from "./Transport";
import { Picker } from "./Picker";
import { StepEditor } from "./StepEditor";
import { SaveDialog } from "./SaveDialog";
import { SynthEditor } from "./SynthEditor";
import { DrumKitEditor } from "./DrumKitEditor";
import { EuclideanEditor } from "./EuclideanEditor";
import { SampleLoader } from "./SampleLoader";
import { UserPatterns } from "./UserPatterns";
import { UserSounds } from "./UserSounds";
import {
  exportMelodicMidi, exportDrumMidi, exportDrumBassMidi,
  importMelodicMidi, importDrumMidi,
} from "../utils/midi";
import { parseKey, SCALE_NAMES } from "../data/keys";
import { SYNTH_PRESETS, BASS_PRESETS, DRUM_KIT_PRESETS, groupPresets } from "../data/soundPresets";
import { SAMPLE_PACKS } from "../data/samplePacks";
import { KaosDropdown } from "./KaosDropdown";

type PickerMode = null | "genre" | "pattern" | "key" | "octave" | "bass_genre" | "bass_pattern";

interface Props {
  state: DeviceState;
  catalog: Catalog | null;
  command: (msg: ClientMessage) => void;
  onLoadSamples?: (samples: Map<number, AudioBuffer>) => void;
  bpm?: number;
  presetState?: PresetState;
  allDevices?: DeviceState[];
  scaleLock?: string;
  onScaleLockChange?: (scale: string) => void;
  soloChannel?: "drums" | "bass" | "synth" | null;
  onSoloChange?: (channel: "drums" | "bass" | "synth" | null) => void;
  channelVolumes?: Record<number, number>;
  onChannelVolumeChange?: (ch: number, v: number) => void;
  getChannelAnalyser?: (ch: number) => AnalyserNode | null;
  getMutedDrumNotes?: () => Set<number>;
  playNote?: (ch: number, note: number, vel?: number) => void;
  stopNote?: (ch: number, note: number) => void;
  kbdFocusDevice?: string | null;
  onKbdFocusChange?: (device: string | null) => void;
}

// QWERTY → semitone offset from C (standard piano roll mapping)
const QWERTY_MAP: Record<string, number> = {
  // Lower row: C3-B3
  KeyZ: 0, KeyS: 1, KeyX: 2, KeyD: 3, KeyC: 4, KeyV: 5,
  KeyG: 6, KeyB: 7, KeyH: 8, KeyN: 9, KeyJ: 10, KeyM: 11,
  // Upper row: C4-B4
  KeyQ: 12, Digit2: 13, KeyW: 14, Digit3: 15, KeyE: 16, KeyR: 17,
  Digit5: 18, KeyT: 19, Digit6: 20, KeyY: 21, Digit7: 22, KeyU: 23,
  KeyI: 24,
};

export function DevicePanel({ state, catalog, command, onLoadSamples, bpm, presetState, allDevices, scaleLock: scaleLockProp, onScaleLockChange, soloChannel: soloProp, onSoloChange, channelVolumes, onChannelVolumeChange, getChannelAnalyser, getMutedDrumNotes, playNote, stopNote, kbdFocusDevice, onKbdFocusChange }: Props) {
  const { id: device, label, accent, mode, editing } = state;
  const isPreview = device.startsWith("preview_");

  const [picker, setPicker] = useState<PickerMode>(null);
  const [euclideanActive, setEuclideanActive] = useState(false);
  const [localScaleLock, setLocalScaleLock] = useState(() => getItem("mpump-scale-lock", "chromatic"));
  const scaleLock = scaleLockProp ?? localScaleLock;
  const setScaleLock = (v: string) => { setLocalScaleLock(v); setItem("mpump-scale-lock", v); onScaleLockChange?.(v); };
  // Initialize mute state from engine (persists across view switches)
  const [mutedDrumNotes, setMutedDrumNotes] = useState<Set<number>>(() => getMutedDrumNotes?.() ?? new Set());

  // QWERTY keyboard → note playing / step recording
  // Use shared focus: only one device can have kbd/rec active at a time
  const kbdActive = kbdFocusDevice === `${device}:play`;
  const stepRecMode = kbdFocusDevice === `${device}:rec`;
  const setKbdActive = (v: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof v === "function" ? v(kbdActive) : v;
    onKbdFocusChange?.(next ? `${device}:play` : null);
  };
  const setStepRecMode = (v: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof v === "function" ? v(stepRecMode) : v;
    onKbdFocusChange?.(next ? `${device}:rec` : null);
  };
  const [stepRecCursor, setStepRecCursor] = useState(0);
  const kbdOctaveShiftRef = useRef(0);
  const [kbdOctaveShift, setKbdOctaveShift] = useState(0);
  kbdOctaveShiftRef.current = kbdOctaveShift;
  const kbdChannel = mode === "drums" || mode === "drums+bass" ? 9 : mode === "bass" ? 1 : 0;
  const kbdBaseOctave = (state.octave ?? 2);
  const activeKeysRef = useRef<Set<string>>(new Set());
  // Sequencer root = 36 (C2) + key_idx + (octave - 2) * 12
  const kbdKeyIdx = state.key_idx ?? 9; // default A
  const kbdRoot = 36 + kbdKeyIdx + (kbdBaseOctave - 2) * 12;
  const getNoteForCode = useCallback((code: string): number | null => {
    const semi = QWERTY_MAP[code];
    if (semi === undefined) return null;
    if (mode === "drums") return [36, 38, 42, 46, 50, 37, 47, 49, 51][semi % 9] ?? 36;
    return kbdRoot + kbdOctaveShiftRef.current * 12 + semi;
  }, [mode, kbdRoot]);

  useEffect(() => {
    if (!kbdActive || !playNote || !stopNote) return;
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Octave shift: [ = down, ] = up
      if (e.code === "BracketLeft") { e.preventDefault(); setKbdOctaveShift(v => { const n = Math.max(v - 1, -3); kbdOctaveShiftRef.current = n; return n; }); return; }
      if (e.code === "BracketRight") { e.preventDefault(); setKbdOctaveShift(v => { const n = Math.min(v + 1, 3); kbdOctaveShiftRef.current = n; return n; }); return; }
      const note = getNoteForCode(e.code);
      if (note === null || activeKeysRef.current.has(e.code)) return;
      e.preventDefault();
      activeKeysRef.current.add(e.code);
      playNote(kbdChannel, note, 100);
    };
    const up = (e: KeyboardEvent) => {
      const note = getNoteForCode(e.code);
      if (note === null || !activeKeysRef.current.has(e.code)) return;
      activeKeysRef.current.delete(e.code);
      stopNote(kbdChannel, note);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      for (const code of activeKeysRef.current) {
        const note = getNoteForCode(code);
        if (note !== null) stopNote(kbdChannel, note);
      }
      activeKeysRef.current.clear();
    };
  }, [kbdActive, kbdChannel, mode, playNote, stopNote, getNoteForCode]);

  // Step-record mode: QWERTY keys write notes into the pattern
  const stepRecCursorRef = useRef(0);
  stepRecCursorRef.current = stepRecCursor;
  useEffect(() => {
    if (!stepRecMode || mode === "drums" || mode === "drums+bass") return;
    const patLen = state.patternLength || 16;
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Octave shift
      if (e.code === "BracketLeft") { e.preventDefault(); setKbdOctaveShift(v => { const n = Math.max(v - 1, -3); kbdOctaveShiftRef.current = n; return n; }); return; }
      if (e.code === "BracketRight") { e.preventDefault(); setKbdOctaveShift(v => { const n = Math.min(v + 1, 3); kbdOctaveShiftRef.current = n; return n; }); return; }
      // Backspace = clear step & go back
      if (e.code === "Backspace") {
        e.preventDefault();
        const prev = (stepRecCursorRef.current - 1 + patLen) % patLen;
        command({ type: "edit_step", device, step: prev, data: null });
        setStepRecCursor(prev);
        return;
      }
      // Space = rest (skip step)
      if (e.code === "Space") {
        e.preventDefault();
        command({ type: "edit_step", device, step: stepRecCursorRef.current, data: null });
        setStepRecCursor(v => (v + 1) % patLen);
        return;
      }
      const semi = QWERTY_MAP[e.code];
      if (semi === undefined) return;
      e.preventDefault();
      // Write note as semitone offset from root
      const data = { semi: semi + kbdOctaveShiftRef.current * 12, vel: 1, slide: false };
      command({ type: "edit_step", device, step: stepRecCursorRef.current, data });
      // Play the note for auditory feedback (match sequencer: root + semi)
      if (playNote) {
        const note = kbdRoot + data.semi;
        playNote(kbdChannel, note, 100);
        if (stopNote) setTimeout(() => stopNote(kbdChannel, note), 200);
      }
      setStepRecCursor(v => (v + 1) % patLen);
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [stepRecMode, mode, device, state.patternLength, command, playNote, stopNote, kbdChannel, kbdBaseOctave]);

  const toggleDrumVoiceMute = (note: number) => {
    setMutedDrumNotes(prev => {
      const next = new Set(prev);
      if (next.has(note)) next.delete(note); else next.add(note);
      return next;
    });
    command({ type: "toggle_drum_voice_mute", note });
  };
  const [localSolo, setLocalSolo] = useState<"drums" | "bass" | "synth" | null>(null);
  const soloChannel = soloProp !== undefined ? soloProp : localSolo;
  const setSoloChannel = (v: "drums" | "bass" | "synth" | null) => { setLocalSolo(v); onSoloChange?.(v); };
  const bassDeviceState = allDevices?.find(d => d.id === "preview_bass");
  const [chMono, setChMono] = useState<Record<number, boolean>>({});
  const toggleChMono = (ch: number) => {
    const next = !chMono[ch];
    setChMono(prev => ({ ...prev, [ch]: next }));
    command({ type: "set_channel_mono", channel: ch, on: next });
  };

  const toggleSolo = useCallback((channel: "drums" | "bass" | "synth") => {
    const unsolo = soloChannel === channel;
    // All 3 preview devices use set_drums_mute (each is a standalone device)
    command({ type: "set_drums_mute", device: "preview_drums", muted: unsolo ? false : channel !== "drums" });
    command({ type: "set_drums_mute", device: "preview_synth", muted: unsolo ? false : channel !== "synth" });
    command({ type: "set_drums_mute", device: "preview_bass", muted: unsolo ? false : channel !== "bass" });
    setSoloChannel(unsolo ? null : channel);
  }, [soloChannel, command]);

  const [editingStep, setEditingStep] = useState<number | null>(null);
  const [editingBassStep, setEditingBassStep] = useState<number | null>(null);
  const [showSave, setShowSave] = useState(false);
  const doubled = state.patternLength === 32;
  const STEP_LENGTHS = [1, 2, 3, 4, 8, 16, 32] as const;

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

    const MIN_SWIPE = 80;
    // Only horizontal swipe (genre change) — vertical scrolling left to browser
    if (Math.abs(dx) > Math.abs(dy) * 2 && Math.abs(dx) > MIN_SWIPE) {
      const delta = dx > 0 ? -1 : 1;
      if (genreList.length) {
        command({ type: "set_genre", device, idx: (state.genre_idx + delta + genreList.length) % genreList.length });
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

  // ── Inline step edit (scroll wheel / dropdown) ─────────────────────────

  const handleStepInlineEdit = useCallback((idx: number, data: StepData) => {
    command({ type: "edit_step", device, step: idx, data });
  }, [device, command]);

  const handleBassInlineEdit = useCallback((idx: number, data: StepData) => {
    command({ type: "edit_step", device: `${device}_bass`, step: idx, data });
  }, [device, command]);

  // ── User pattern library (save/load per instrument) ────────────────────

  const loadDrumPattern = useCallback((data: (StepData | null)[] | DrumHit[][]) => {
    const drums = data as DrumHit[][];
    for (let i = 0; i < drums.length; i++) {
      command({ type: "edit_drum_step", device, step: i, hits: drums[i] ?? [] });
    }
  }, [device, command]);

  const loadSynthPattern = useCallback((data: (StepData | null)[] | DrumHit[][]) => {
    const steps = data as (StepData | null)[];
    for (let i = 0; i < steps.length; i++) {
      command({ type: "edit_step", device, step: i, data: steps[i] });
    }
  }, [device, command]);

  const loadBassPattern = useCallback((data: (StepData | null)[] | DrumHit[][]) => {
    const steps = data as (StepData | null)[];
    for (let i = 0; i < steps.length; i++) {
      command({ type: "edit_step", device: `${device}_bass`, step: i, data: steps[i] });
    }
  }, [device, command]);

  const getDrumData = useCallback(() => [...state.drum_data], [state.drum_data]);
  const getSynthData = useCallback(() => [...state.pattern_data], [state.pattern_data]);
  const getBassData = useCallback(() => [...state.bass_data], [state.bass_data]);

  // ── Save / discard ─────────────────────────────────────────────────────

  const handleSave = useCallback((name: string, desc: string) => {
    command({ type: "save_pattern", device, name, desc });
  }, [device, command]);

  const handleDiscard = useCallback(() => {
    command({ type: "discard_edit", device });
  }, [device, command]);

  // ── MIDI export ────────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    if (!confirm("Export current pattern as MIDI file?")) return;
    const bpm = 120; // default; could be passed as prop
    const genrePart = genreName.replace(/\s+/g, "-");
    const patPart = patInfo?.name?.replace(/\s+/g, "-") ?? "pattern";

    if (mode === "synth" || mode === "bass") {
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
      className={`device-panel${kbdFocusDevice?.split(":")[0] === device ? " device-focused" : ""}`}
      style={{ "--device-accent": accent } as React.CSSProperties}
      onClick={() => { if (isPreview && onKbdFocusChange && kbdFocusDevice?.split(":")[0] !== device) onKbdFocusChange(`${device}:focus`); }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Header row */}
      <div className="panel-header">
        <div className="panel-label-wrap">
          <span className="panel-label" style={{ color: accent }}>
            {label}
          </span>
          {editing && <div className="editing-badge">EDIT</div>}
        </div>
        <div className="panel-actions">
          <KaosDropdown className="kaos-dropdown-pat" value={state.patternLength} onChange={(v: number) => command({ type: "set_pattern_length", device, length: v as typeof STEP_LENGTHS[number] })} title="Pattern length in steps" options={STEP_LENGTHS.map(n => ({ label: String(n), value: n }))} />
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
            onClick={() => mode === "synth" || mode === "bass" ? fileInputRef.current?.click() : drumFileInputRef.current?.click()}
          >
            &#x21E7;
          </button>
          {isPreview && editing && (
            <button
              className="device-midi-btn"
              title="Undo last edit"
              onClick={() => command({ type: "undo_edit", device })}
            >
              ↩
            </button>
          )}
          {isPreview && (
            <>
              <button className="device-midi-btn" title="Copy pattern" onClick={() => { tapVibrate(); command({ type: "copy_pattern", device }); }}>&#x2398;</button>
              <button className="device-midi-btn" title="Paste pattern" onClick={() => { tapVibrate(); command({ type: "paste_pattern", device }); }}>&#x2399;</button>
            </>
          )}
          {isPreview && playNote && (
            <button
              className={`device-shuffle-btn ${kbdActive ? "active" : ""}`}
              title={kbdActive ? "Keyboard playing: ON — Z-M lower octave, Q-U upper, [/] shift octave" : "Play with computer keyboard (QWERTY piano roll)"}
              style={kbdActive ? { background: accent, color: "#000" } : undefined}
              onClick={() => { setKbdActive(v => !v); }}
            >⌨</button>
          )}
          {isPreview && mode !== "drums" && mode !== "drums+bass" && (
            <button
              className={`device-shuffle-btn ${stepRecMode ? "active" : ""}`}
              title={stepRecMode ? `Step record: ON (step ${stepRecCursor + 1}) — keys=note, Space=rest, Backspace=undo, [/]=octave` : "Step record: write notes into pattern with keyboard"}
              style={stepRecMode ? { background: accent, color: "#000" } : undefined}
              onClick={() => { setStepRecMode(v => !v); setStepRecCursor(0); }}
            >✎</button>
          )}
          <Transport device={device} paused={state.paused} command={command} />
        </div>
      </div>

      {/* Hidden file inputs for MIDI import */}
      <input ref={fileInputRef} type="file" accept=".mid,.midi" style={{ display: "none" }} onChange={handleImportMelodic} />
      <input ref={drumFileInputRef} type="file" accept=".mid,.midi" style={{ display: "none" }} onChange={handleImportDrum} />

      {/* ── drums or drums+bass: drum section + optional bass ──────── */}
      {mode !== "synth" && mode !== "bass" ? (
        <>
          {/* DRUMS section */}
          <div className="t8-section">
            {isPreview && (
              <div className="t8-section-header">
                <div className="t8-section-label" style={{ color: accent }}>
                  {getChannelAnalyser && <SignalLed getAnalyser={() => getChannelAnalyser(9)} />}
                </div>
                {onChannelVolumeChange && <label className="ch-vol-inline"><span className="ch-vol-label">VOL</span><input type="range" className="ch-vol-slider" min={0} max={1} step={0.01} value={channelVolumes?.[9] ?? 0.4} title={`Drums: ${Math.round((channelVolumes?.[9] ?? 0.4) * 100)}%`} onChange={(e) => onChannelVolumeChange(9, parseFloat(e.target.value))} /></label>}
                {isPreview && (<>
                  <button className={`device-mute-btn ${state.drumsMuted ? "muted" : ""}`} title={state.drumsMuted ? "Unmute drums" : "Mute drums"} onClick={() => { setSoloChannel(null); command({ type: "toggle_drums_mute", device }); }}>
                    {state.drumsMuted ? "MUTED" : "MUTE"}
                  </button>
                  <button className={`device-mute-btn ${soloChannel === "drums" ? "muted" : ""}`} title={soloChannel === "drums" ? "Unsolo" : "Solo drums"} onClick={() => toggleSolo("drums")} style={soloChannel === "drums" ? { background: "var(--preview)", color: "#000", borderColor: "var(--preview)" } : undefined}>
                    SOLO
                  </button>
                  <button className={`device-mute-btn ${chMono[9] ? "muted" : ""}`} title={chMono[9] ? "Stereo drums" : "Mono drums"} onClick={() => toggleChMono(9)}>
                    MONO
                  </button>
                  <button className="device-mute-btn" title="Clear drum pattern" onClick={() => { for (let i = 0; i < (state.patternLength || 16); i++) command({ type: "edit_drum_step", device, step: i, hits: [] }); }}>
                    CLR
                  </button>
                </>)}
              </div>
            )}
            {isPreview && presetState && (
              <div className="info-row">
                <span className="info-key">sound</span>
                <KaosDropdown className="kaos-dropdown-sound" title="Drum kit sound" value={presetState.activeDrumKit} onChange={(v: string) => presetState.onDrumKitChange(v)} options={[
                  { group: "Machines", items: SAMPLE_PACKS.map(p => ({ label: p.name, value: `pack:${p.id}` })) },
                  { group: "Presets", items: DRUM_KIT_PRESETS.map((p, i) => ({ label: p.name, value: String(i) })) },
                ]} />
                <button className={`sound-lock-btn ${presetState.soundLock.drums ? "locked" : ""}`} title={presetState.soundLock.drums ? "Unlock drum kit" : "Lock drum kit from MIX"} onClick={() => presetState.setSoundLock(prev => ({ ...prev, drums: !prev.drums }))}>
                  {presetState.soundLock.drums ? "\u{1F512}" : "\u{1F513}"}
                </button>
              </div>
            )}
            <div className="info-row">
              <span className="info-key">genre</span>
              <KaosDropdown value={state.genre_idx} onChange={(idx: number) => command({ type: "set_genre", device, idx })} title="Genre — sets the style of patterns" options={[...genreList].map((g, oi) => ({ label: g.name, value: oi })).sort((a, b) => a.label.localeCompare(b.label))} />
              {isPreview && presetState && <button className={`sound-lock-btn ${presetState.patternLock.drums ? "locked" : ""}`} title={presetState.patternLock.drums ? "Unlock drums genre/pattern" : "Lock drums genre/pattern"} onClick={() => presetState.setPatternLock(prev => ({ ...prev, drums: !prev.drums }))}>{presetState.patternLock.drums ? "\u{1F512}" : "\u{1F513}"}</button>}
            </div>
            <div className="info-row">
              <span className="info-key">pattern</span>
              <KaosDropdown className="kaos-dropdown-pat" value={state.pattern_idx} onChange={(idx: number) => command({ type: "set_pattern", device, idx })} title="Pattern — the beat sequence" options={patternList.map((p, i) => ({ label: p.name, value: i })).sort((a, b) => a.label.localeCompare(b.label))} />
              {isPreview && presetState && presetState.patternLock.drums && <button className={`sound-lock-btn ${presetState.stepPatternLock.drums ? "locked" : ""}`} title={presetState.stepPatternLock.drums ? "Unlock drums pattern from MIX" : "Lock drums pattern from MIX"} onClick={() => presetState.setStepPatternLock(prev => ({ ...prev, drums: !prev.drums }))}>{presetState.stepPatternLock.drums ? "\u{1F512}" : "\u{1F513}"}</button>}
            </div>
            {patInfo?.desc && <div className="info-desc">{patInfo.desc}</div>}
            {isPreview && patternList.length > 1 && (
              <div className="chain-row">
                <span className="chain-label" title="Alternate between two patterns every bar">Chain:</span>
                <KaosDropdown className="kaos-dropdown-pat" title="Chain — alternate two patterns every bar" value={state.chainEnabled ? String(state.chainPatternIdx) : ""} onChange={(v: string) => {
                    if (v === "") {
                      if (state.chainEnabled) command({ type: "toggle_chain", device, chainIdx: state.chainPatternIdx });
                    } else {
                      const idx = parseInt(v);
                      if (!isNaN(idx)) command({ type: "toggle_chain", device, chainIdx: idx });
                    }
                  }} options={[{ label: "Off", value: "" }, ...patternList.filter((_, i) => i !== state.pattern_idx).map((p, _i) => { const oi = patternList.indexOf(p); return { label: p.name, value: String(oi) }; })]} />
                {state.chainEnabled && <span className="chain-badge" style={{ color: accent }} title={`${patternList[state.pattern_idx]?.name ?? "A"} ↔ ${patternList[state.chainPatternIdx]?.name ?? "B"}`}>A/B</span>}
              </div>
            )}
            <BeatIndicator step={state.step} accent={accent} numSteps={state.patternLength} />
            {!euclideanActive && (
              <>
                <DrumGrid
                  drumData={doubled ? state.drum_data.slice(0, 16) : state.drum_data}
                  currentStep={doubled ? (state.step < 16 ? state.step : -1) : state.step}
                  accent={accent}
                  onToggle={handleDrumToggle}
                  mutedNotes={isPreview ? mutedDrumNotes : undefined}
                  onToggleMute={isPreview ? toggleDrumVoiceMute : undefined}
                />
                {doubled && (
                  <div className="doubled-row">
                    <DrumGrid
                      drumData={state.drum_data.slice(16, 32)}
                      currentStep={state.step >= 16 ? state.step - 16 : -1}
                      accent={accent}
                      onToggle={(stepIdx, note, vel) => handleDrumToggle(stepIdx + 16, note, vel)}
                      mutedNotes={isPreview ? mutedDrumNotes : undefined}
                    />
                  </div>
                )}
              </>
            )}
            {isPreview && (
              <UserPatterns instrument="drums" accent={accent} getCurrentData={getDrumData} onLoad={loadDrumPattern} />
            )}
          </div>

          {/* Drum kit editor (preview only) */}
          {isPreview && (
            <DrumKitEditor accent={accent} command={command} activeDrumKit={presetState?.activeDrumKit} />
          )}

          {/* Euclidean rhythm generator (preview only) */}
          {isPreview && (
            <EuclideanEditor accent={accent} device={device} patternLength={state.patternLength} command={command} onActiveChange={setEuclideanActive} />
          )}

          {/* Custom sample loader (preview only) */}
          {isPreview && onLoadSamples && (
            <SampleLoader accent={accent} onSamplesLoaded={onLoadSamples} />
          )}

          {/* Humanize toggle (drums, preview only) */}
          {isPreview && (
            <div className="device-tools-row">
              <button className={`device-tool-btn ${getBool("mpump-humanize") ? "active" : ""}`} title="Subtle random velocity variation (±15%)" onClick={() => {
                const next = !getBool("mpump-humanize");
                setBool("mpump-humanize", next);
                command({ type: "set_humanize", on: next });
              }}>Humanize</button>
            </div>
          )}

          {/* BASS section (drums+bass only) */}
          {mode === "drums+bass" && bassGenreList && (
            <div className={`t8-section ${isPreview ? "bass-section-preview" : ""}`}>
              <div className="panel-header">
                <span className="panel-label" style={{ color: accent }}>
                  {isPreview && getChannelAnalyser && <SignalLed getAnalyser={() => getChannelAnalyser(1)} />}
                </span>
                {onChannelVolumeChange && <label className="ch-vol-inline"><span className="ch-vol-label">VOL</span><input type="range" className="ch-vol-slider" min={0} max={1} step={0.01} value={channelVolumes?.[1] ?? 0.5} title={`Bass: ${Math.round((channelVolumes?.[1] ?? 0.5) * 100)}%`} onChange={(e) => onChannelVolumeChange(1, parseFloat(e.target.value))} /></label>}
                <div className="panel-actions">
                  {isPreview && presetState && (
                    <KaosDropdown className="kaos-dropdown-sound" value={presetState.activeBass} onChange={(v: string) => presetState.onBassChange(v)} options={groupPresets(BASS_PRESETS).map(([g, items]) => ({ group: g || "Presets", items: items.map(([i, p]) => ({ label: p.name, value: String(i) })) }))} />
                  )}
                  {isPreview && presetState && (
                    <button className={`sound-lock-btn ${presetState.soundLock.bass ? "locked" : ""}`} title={presetState.soundLock.bass ? "Unlock bass" : "Lock bass"} onClick={() => presetState.setSoundLock(prev => ({ ...prev, bass: !prev.bass }))}>
                      {presetState.soundLock.bass ? "\u{1F512}" : "\u{1F513}"}
                    </button>
                  )}
                  <button className="device-shuffle-btn" title="Randomize bass genre &amp; pattern" onClick={() => command({ type: "randomize_bass", device })}>&#x2684;</button>
                  <button className={`device-mute-btn ${bassDeviceState?.drumsMuted ? "muted" : ""}`} title={bassDeviceState?.drumsMuted ? "Unmute bass" : "Mute bass"} onClick={() => { setSoloChannel(null); command({ type: "toggle_drums_mute", device: "preview_bass" }); }}>
                    {bassDeviceState?.drumsMuted ? "MUTED" : "MUTE"}
                  </button>
                  <button className={`device-mute-btn ${soloChannel === "bass" ? "muted" : ""}`} title={soloChannel === "bass" ? "Unsolo" : "Solo bass"} onClick={() => toggleSolo("bass")} style={soloChannel === "bass" ? { background: "var(--preview)", color: "#000", borderColor: "var(--preview)" } : undefined}>
                    SOLO
                  </button>
                </div>
              </div>
              <div className="info-row">
                <span className="info-key">genre</span>
                <KaosDropdown value={state.bass_genre_idx} onChange={(idx: number) => command({ type: "set_genre", device: "preview_bass", idx })} title="Bass genre" options={[...bassGenreList!].map((g, oi) => ({ label: g.name, value: oi })).sort((a, b) => a.label.localeCompare(b.label))} />
                {isPreview && presetState && <button className={`sound-lock-btn ${presetState.patternLock.bass ? "locked" : ""}`} title={presetState.patternLock.bass ? "Unlock bass genre/pattern" : "Lock bass genre/pattern"} onClick={() => presetState.setPatternLock(prev => ({ ...prev, bass: !prev.bass }))}>{presetState.patternLock.bass ? "\u{1F512}" : "\u{1F513}"}</button>}
              </div>
              <div className="info-row">
                <span className="info-key">pattern</span>
                <KaosDropdown className="kaos-dropdown-pat" value={state.bass_pattern_idx} onChange={(idx: number) => command({ type: "set_pattern", device: "preview_bass", idx })} title="Bass pattern" options={(bassPatternList ?? []).map((p, i) => ({ label: p.name, value: i })).sort((a, b) => a.label.localeCompare(b.label))} />
                {isPreview && presetState && presetState.patternLock.bass && <button className={`sound-lock-btn ${presetState.stepPatternLock.bass ? "locked" : ""}`} title={presetState.stepPatternLock.bass ? "Unlock bass pattern from MIX" : "Lock bass pattern from MIX"} onClick={() => presetState.setStepPatternLock(prev => ({ ...prev, bass: !prev.bass }))}>{presetState.stepPatternLock.bass ? "\u{1F512}" : "\u{1F513}"}</button>}
              </div>
              {state.hasKey && keys && (
                <div className="key-octave-row">
                  <label className="info-row half" title="Constrain notes to a musical scale" style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                    <span className="info-key">scale</span>
                    <KaosDropdown className="kaos-dropdown-pat" value={scaleLock} onChange={(v: string) => setScaleLock(v)} options={SCALE_NAMES.map(s => ({ label: s.charAt(0).toUpperCase() + s.slice(1), value: s }))} />
                  </label>
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
                rootNote={rootNote}
                scaleLock={scaleLock}
                onEditStep={handleBassInlineEdit}
              />
              {doubled && (
                <div className="doubled-row">
                  <BassGrid
                    steps={state.bass_data.slice(16, 32)}
                    currentStep={state.step >= 16 ? state.step - 16 : -1}
                    accent={accent}
                    onTap={(idx) => handleBassTap(idx + 16)}
                    onLongPress={(idx) => handleBassLongPress(idx + 16)}
                    rootNote={rootNote}
                    scaleLock={scaleLock}
                    onEditStep={(idx, data) => handleBassInlineEdit(idx + 16, data)}
                  />
                </div>
              )}
              {isPreview && (
                <UserPatterns instrument="bass" accent={accent} getCurrentData={getBassData} onLoad={loadBassPattern} />
              )}
              {isPreview && state.bassSynthParams && (
                <SynthEditor
                  params={state.bassSynthParams}
                  accent={accent}
                  label="type"
                  hideVoices
                  onChange={(p) => command({ type: "set_bass_synth_params", device, params: p })}
                />
              )}
              {isPreview && state.bassSynthParams && (
                <UserSounds
                  storageKey="mpump-sounds-bass"
                  label="bass"
                  accent={accent}
                  getParams={() => state.bassSynthParams!}
                  onLoad={(p) => command({ type: "set_bass_synth_params", device, params: p })}
                />
              )}
            </div>
          )}
        </>
      ) : (
        /* ── synth mode: genre/pattern + step grid ────────────────── */
        <>
          {isPreview && (
            <div className="t8-section-header">
              <div className="t8-section-label" style={{ color: accent }}>
                {getChannelAnalyser && <SignalLed getAnalyser={() => getChannelAnalyser(mode === "bass" ? 1 : 0)} />}
              </div>
              {onChannelVolumeChange && <label className="ch-vol-inline"><span className="ch-vol-label">VOL</span><input type="range" className="ch-vol-slider" min={0} max={1} step={0.01} value={channelVolumes?.[mode === "bass" ? 1 : 0] ?? 0.5} title={`${mode}: ${Math.round((channelVolumes?.[mode === "bass" ? 1 : 0] ?? 0.5) * 100)}%`} onChange={(e) => onChannelVolumeChange(mode === "bass" ? 1 : 0, parseFloat(e.target.value))} /></label>}
              <button className={`device-mute-btn ${state.drumsMuted ? "muted" : ""}`} title={state.drumsMuted ? `Unmute ${mode}` : `Mute ${mode}`} onClick={() => { setSoloChannel(null); command({ type: "toggle_drums_mute", device }); }}>
                {state.drumsMuted ? "MUTED" : "MUTE"}
              </button>
              <button className={`device-mute-btn ${soloChannel === (mode === "bass" ? "bass" : "synth") ? "muted" : ""}`} title={`Solo ${mode}`} onClick={() => toggleSolo(mode === "bass" ? "bass" : "synth")} style={soloChannel === (mode === "bass" ? "bass" : "synth") ? { background: "var(--preview)", color: "#000", borderColor: "var(--preview)" } : undefined}>
                SOLO
              </button>
              {mode !== "bass" && (
                <button className={`device-mute-btn ${chMono[0] ? "muted" : ""}`} title="Mono synth" onClick={() => toggleChMono(0)}>
                  MONO
                </button>
              )}
              <button className="device-mute-btn" title={`Clear ${mode} pattern`} onClick={() => command({ type: "clear_pattern", device })}>
                CLR
              </button>
            </div>
          )}
          {isPreview && presetState && (
            <div className="info-row">
              <span className="info-key">sound</span>
              {mode === "bass" ? (
                <KaosDropdown className="kaos-dropdown-sound" title="Bass sound preset" value={presetState.activeBass} onChange={(v: string) => presetState.onBassChange(v)} options={groupPresets(BASS_PRESETS).map(([g, items]) => ({ group: g || "Presets", items: items.map(([i, p]) => ({ label: p.name, value: String(i) })) }))} />
              ) : (
                <KaosDropdown className="kaos-dropdown-sound" title="Synth sound preset" value={presetState.activeSynth} onChange={(v: string) => presetState.onSynthChange(v)} options={groupPresets(SYNTH_PRESETS).map(([g, items]) => ({ group: g || "Presets", items: items.map(([i, p]) => ({ label: p.name, value: String(i) })) }))} />
              )}
              <button className={`sound-lock-btn ${presetState.soundLock[mode === "bass" ? "bass" : "synth"] ? "locked" : ""}`} title={presetState.soundLock[mode === "bass" ? "bass" : "synth"] ? `Unlock ${mode} sound` : `Lock ${mode} sound from MIX`} onClick={() => presetState.setSoundLock(prev => ({ ...prev, [mode === "bass" ? "bass" : "synth"]: !prev[mode === "bass" ? "bass" : "synth"] }))}>
                {presetState.soundLock[mode === "bass" ? "bass" : "synth"] ? "\u{1F512}" : "\u{1F513}"}
              </button>
            </div>
          )}
          <div className="info-row">
            <span className="info-key">genre</span>
            <KaosDropdown value={state.genre_idx} onChange={(idx: number) => command({ type: "set_genre", device, idx })} title="Genre — sets the style of patterns" options={[...genreList].map((g, oi) => ({ label: g.name, value: oi })).sort((a, b) => a.label.localeCompare(b.label))} />
            {isPreview && presetState && <button className={`sound-lock-btn ${presetState.patternLock[mode === "bass" ? "bass" : "synth"] ? "locked" : ""}`} title={`${presetState.patternLock[mode === "bass" ? "bass" : "synth"] ? "Unlock" : "Lock"} ${mode} genre/pattern`} onClick={() => presetState.setPatternLock(prev => ({ ...prev, [mode === "bass" ? "bass" : "synth"]: !prev[mode === "bass" ? "bass" : "synth"] }))}>{presetState.patternLock[mode === "bass" ? "bass" : "synth"] ? "\u{1F512}" : "\u{1F513}"}</button>}
          </div>
          <div className="info-row">
            <span className="info-key">pattern</span>
            <KaosDropdown className="kaos-dropdown-pat" value={state.pattern_idx} onChange={(idx: number) => command({ type: "set_pattern", device, idx })} title="Pattern — the beat sequence" options={patternList.map((p, i) => ({ label: p.name, value: i })).sort((a, b) => a.label.localeCompare(b.label))} />
            {isPreview && presetState && presetState.patternLock[mode === "bass" ? "bass" : "synth"] && <button className={`sound-lock-btn ${presetState.stepPatternLock[mode === "bass" ? "bass" : "synth"] ? "locked" : ""}`} title={`${presetState.stepPatternLock[mode === "bass" ? "bass" : "synth"] ? "Unlock" : "Lock"} ${mode} pattern from MIX`} onClick={() => presetState.setStepPatternLock(prev => ({ ...prev, [mode === "bass" ? "bass" : "synth"]: !prev[mode === "bass" ? "bass" : "synth"] }))}>{presetState.stepPatternLock[mode === "bass" ? "bass" : "synth"] ? "\u{1F512}" : "\u{1F513}"}</button>}
          </div>
          {patInfo?.desc && <div className="info-desc">{patInfo.desc}</div>}
          {isPreview && patternList.length > 1 && (
            <div className="chain-row">
              <span className="chain-label" title="Alternate between two patterns every bar">Chain:</span>
              <KaosDropdown className="kaos-dropdown-pat" title="Chain — alternate two patterns every bar" value={state.chainEnabled ? String(state.chainPatternIdx) : ""} onChange={(v: string) => {
                  if (v === "") {
                    if (state.chainEnabled) command({ type: "toggle_chain", device, chainIdx: state.chainPatternIdx });
                  } else {
                    const idx = parseInt(v);
                    if (!isNaN(idx)) command({ type: "toggle_chain", device, chainIdx: idx });
                  }
                }} options={[{ label: "Off", value: "" }, ...patternList.filter((_, i) => i !== state.pattern_idx).map((p, _i) => { const oi = patternList.indexOf(p); return { label: p.name, value: String(oi) }; })]} />
              {state.chainEnabled && <span className="chain-badge" style={{ color: accent }} title={`${patternList[state.pattern_idx]?.name ?? "A"} ↔ ${patternList[state.chainPatternIdx]?.name ?? "B"}`}>A/B</span>}
            </div>
          )}
          {state.hasKey && keys && (
            <div className="key-octave-row">
              <label className="info-row half" title="Constrain notes to a musical scale" style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                <span className="info-key">scale</span>
                <KaosDropdown className="kaos-dropdown-pat" value={scaleLock} onChange={(v: string) => setScaleLock(v)} options={SCALE_NAMES.map(s => ({ label: s.charAt(0).toUpperCase() + s.slice(1), value: s }))} />
              </label>
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
            rootNote={rootNote}
            scaleLock={scaleLock}
            onEditStep={handleStepInlineEdit}
          />
          {doubled && (
            <div className="doubled-row">
              <StepGrid
                steps={state.pattern_data.slice(16, 32)}
                currentStep={state.step >= 16 ? state.step - 16 : -1}
                accent={accent}
                onTap={(idx) => handleStepTap(idx + 16)}
                onLongPress={(idx) => handleStepLongPress(idx + 16)}
                rootNote={rootNote}
                scaleLock={scaleLock}
                onEditStep={(idx, data) => handleStepInlineEdit(idx + 16, data)}
              />
            </div>
          )}
          {isPreview && (
            <UserPatterns instrument={mode === "bass" ? "bass" : "synth"} accent={accent} getCurrentData={getSynthData} onLoad={loadSynthPattern} />
          )}
          {isPreview && state.synthParams && (
            <SynthEditor
              params={state.synthParams}
              accent={accent}
              label="type"
              hideVoices={mode === "bass"}
              onChange={(p) => command({ type: "set_synth_params", device, params: p })}
            />
          )}
          {isPreview && state.synthParams && (
            <UserSounds
              storageKey="mpump-sounds-synth"
              label="synth"
              accent={accent}
              getParams={() => state.synthParams!}
              onLoad={(p) => command({ type: "set_synth_params", device, params: p })}
            />
          )}
        </>
      )}

      {/* Arpeggiator (preview synth/bass only) */}
      {isPreview && (mode === "synth" || mode === "bass") && (
        <div className="device-tools-row">
          <span className="device-tool-label">Arp</span>
          <KaosDropdown className="kaos-dropdown-arp" value={getItem(`mpump-arp-mode-${device}`, "off")} onChange={(val: string) => {
            setItem(`mpump-arp-mode-${device}`, val);
            if (val === "off") {
              command({ type: "set_arp", enabled: false, mode: "up", rate: "1/8", device });
            } else {
              const rate = (getItem(`mpump-arp-rate-${device}`, "1/8")) as import("../types").ArpRate;
              command({ type: "set_arp", enabled: true, mode: val as import("../types").ArpMode, rate, device });
            }
          }} options={[{ label: "Off", value: "off" }, { label: "Up", value: "up" }, { label: "Down", value: "down" }, { label: "Up-Down", value: "up-down" }, { label: "Random", value: "random" }]} />
          {getItem(`mpump-arp-mode-${device}`) && getItem(`mpump-arp-mode-${device}`) !== "off" && (
            <KaosDropdown className="kaos-dropdown-arp" value={getItem(`mpump-arp-rate-${device}`, "1/8")} onChange={(val: string) => {
              setItem(`mpump-arp-rate-${device}`, val);
              const mode = (getItem(`mpump-arp-mode-${device}`, "up")) as import("../types").ArpMode;
              command({ type: "set_arp", enabled: true, mode, rate: val as import("../types").ArpRate, device });
            }} options={[{ label: "1/4", value: "1/4" }, { label: "1/8", value: "1/8" }, { label: "1/16", value: "1/16" }]} />
          )}
        </div>
      )}

      {/* Edit actions bar */}
      {editing && (
        <div className="edit-actions">
          <button className="edit-btn discard" title="Discard changes" onClick={handleDiscard}>
            Discard
          </button>
          <button
            className="edit-btn save"
            title="Save pattern"
   style={{ background: accent, color: "#000" }}
            onClick={() => setShowSave(true)}
          >
            +Save
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
          scaleLock={scaleLock}
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
          scaleLock={scaleLock}
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
