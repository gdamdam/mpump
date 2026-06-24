import { useRef, useCallback, useState } from "react";
import type { StepData } from "../types";
import { nextInScale, SCALES } from "../data/keys";
import { tapVibrate } from "../utils/haptic";
import { useGridPointer } from "../hooks/useGridPointer";
import { dyToSteps } from "../utils/gridGesture";

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

interface Props {
  steps: (StepData | null)[];
  currentStep: number;
  accent: string;
  onTap?: (stepIdx: number) => void;
  onLongPress?: (stepIdx: number) => void;
  rootNote?: number;
  scaleLock?: string;
  onEditStep?: (stepIdx: number, data: StepData) => void;
}

const LONG_PRESS_MS = 500;
const PX_PER_SEMI = 14; // vertical drag sensitivity for pitch

/** Get note name from root + semitone offset */
function getNoteName(rootNote: number, semi: number): string {
  return NOTE_NAMES[((rootNote + semi) % 12 + 12) % 12];
}

/** Get cell opacity based on scale degree */
function getCellOpacity(semi: number, vel: number, isActive: boolean): number {
  if (isActive) return 1;
  const degree = ((semi % 12) + 12) % 12;
  if (degree === 0) return vel > 1 ? 1 : 0.85; // root
  if (degree === 7) return vel > 1 ? 0.95 : 0.75; // perfect 5th
  return vel > 1 ? 0.85 : 0.65; // other
}

/** Build list of available notes for dropdown */
function getAvailableNotes(scaleLock: string | undefined, rootNote: number): { semi: number; name: string }[] {
  const scale = scaleLock && scaleLock !== "chromatic" ? SCALES[scaleLock] : SCALES.chromatic;
  if (!scale) return [];
  const notes: { semi: number; name: string }[] = [];
  for (let oct = -1; oct <= 2; oct++) {
    for (const interval of scale) {
      const semi = oct * 12 + interval;
      if (semi < -12 || semi > 24) continue;
      const midi = rootNote + semi;
      const noteName = NOTE_NAMES[((midi % 12) + 12) % 12];
      const octave = Math.floor(midi / 12) - 2;
      notes.push({ semi, name: `${noteName}${octave}` });
    }
  }
  return notes.reverse();
}

export function BassGrid({ steps, currentStep, accent, onTap, onLongPress, rootNote = 45, scaleLock, onEditStep }: Props) {
  const [dropdownIdx, setDropdownIdx] = useState<number | null>(null);
  const startSemi = useRef(0);

  const handleWheel = useCallback((e: React.WheelEvent, i: number, step: StepData) => {
    if (!onEditStep) return;
    e.preventDefault();
    const dir: 1 | -1 = e.deltaY < 0 ? 1 : -1;
    const nextSemi = scaleLock && scaleLock !== "chromatic"
      ? nextInScale(step.semi, dir, scaleLock)
      : step.semi + dir;
    const clamped = Math.max(-12, Math.min(24, nextSemi));
    if (clamped !== step.semi) onEditStep(i, { ...step, semi: clamped });
  }, [onEditStep, scaleLock]);

  const handleDropdownChange = useCallback((i: number, step: StepData, newSemi: number) => {
    if (!onEditStep) return;
    onEditStep(i, { ...step, semi: newSemi });
    setDropdownIdx(null);
  }, [onEditStep]);

  const availableNotes = dropdownIdx !== null ? getAvailableNotes(scaleLock, rootNote) : [];

  const handleNoteClick = useCallback((i: number) => {
    if (steps[i] && onEditStep) setDropdownIdx((prev) => prev === i ? null : i);
  }, [steps, onEditStep]);

  // Shared pointer + keyboard behavior: tap toggles, horizontal drag paints,
  // vertical drag nudges pitch (matches the cell's bar). Long-press → editor.
  const grid = useGridPointer({
    cellCount: steps.length,
    cellOn: (i) => !!steps[i],
    onTap: (i) => { tapVibrate(); setDropdownIdx(null); onTap?.(i); },
    onPaint: (i, on) => { if (!!steps[i] !== on) onTap?.(i); },
    onVerticalStart: (i) => { startSemi.current = steps[i]?.semi ?? 0; },
    onVerticalMove: (i, dy) => {
      const step = steps[i];
      if (!step || !onEditStep) return;
      const semi = Math.max(-12, Math.min(24, startSemi.current + dyToSteps(dy, PX_PER_SEMI)));
      if (semi !== step.semi) onEditStep(i, { ...step, semi });
    },
    onLongPress: onLongPress ? (i) => { setDropdownIdx(null); onLongPress(i); } : undefined,
    cellLabel: (i) => { const s = steps[i]; return s ? `Step ${i + 1}, ${getNoteName(rootNote, s.semi)}` : `Step ${i + 1}, empty`; },
    longPressMs: LONG_PRESS_MS,
  });

  return (
    <div className="bass-grid-wrap">
      <div className="bass-grid">
        <span className="drum-label">BS</span>
        <div className="drum-steps" role="group" aria-label="Bass steps" ref={grid.gridRef} {...grid.gridHandlers}>
          {steps.map((step, i) => {
            const active = i === currentStep;
            const barStart = i % 4 === 0;
            const pressing = grid.pressingIdx === i;

            if (!step) {
              return (
                <div
                  key={i}
                  data-grid-idx={i}
                  className={`drum-cell ${active ? "active" : ""} ${barStart ? "bar-start" : ""} ${onTap ? "editable" : ""} ${pressing ? "step-pressing" : ""}`}
                  {...grid.cellProps(i)}
                  onContextMenu={(e) => { e.preventDefault(); onLongPress?.(i); }}
                />
              );
            }

            const opacity = getCellOpacity(step.semi, step.vel, active);

            return (
              <div
                key={i}
                data-grid-idx={i}
                className={`drum-cell ${active ? "active" : ""} ${barStart ? "bar-start" : ""} hit ${step.slide ? "slide" : ""} ${onTap ? "editable" : ""} ${pressing ? "step-pressing" : ""}`}
                style={{ background: active ? "#fff" : accent, opacity }}
                {...grid.cellProps(i)}
                onContextMenu={(e) => { e.preventDefault(); setDropdownIdx(null); onLongPress?.(i); }}
                onWheel={(e) => handleWheel(e, i, step)}
              />
            );
          })}
        </div>
      </div>
      {/* Note names row below bass cells */}
      <div className="bass-note-row">
        <span className="drum-label"></span>
        <div className="drum-steps">
          {steps.map((step, i) => {
            const active = i === currentStep;
            const barStart = i % 4 === 0;
            const noteName = step ? getNoteName(rootNote, step.semi) : "";
            return (
              <div
                key={i}
                className={`bass-note-cell ${barStart ? "bar-start" : ""} ${step && onEditStep ? "editable" : ""}`}
                onClick={() => handleNoteClick(i)}
                onWheel={step ? (e) => handleWheel(e, i, step) : undefined}
              >
                <span className="step-note-label" style={{ color: active ? "#fff" : accent }}>
                  {noteName}
                </span>
                {dropdownIdx === i && step && onEditStep && (
                  <select
                    className="step-note-dropdown"
                    value={step.semi}
                    onChange={(e) => handleDropdownChange(i, step, Number(e.target.value))}
                    onBlur={() => setDropdownIdx(null)}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    style={{ borderColor: accent }}
                  >
                    {availableNotes.map((n) => (
                      <option key={n.semi} value={n.semi}>{n.name}</option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
