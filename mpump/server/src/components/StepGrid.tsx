import { useRef, useCallback, useState } from "react";
import type { StepData } from "../types";
import { tapVibrate } from "../utils/haptic";
import { nextInScale, SCALES } from "../data/keys";
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

/** Get accent color with opacity/hue shift based on scale degree */
function getCellColor(accent: string, semi: number, isActive: boolean): string {
  if (isActive) return "#fff";
  const degree = ((semi % 12) + 12) % 12;
  if (degree === 0) return accent; // root = full accent
  if (degree === 7) return `color-mix(in srgb, ${accent} 80%, transparent)`; // perfect 5th
  return `color-mix(in srgb, ${accent} 70%, transparent)`; // other notes
}

/** Build list of available notes for dropdown */
function getAvailableNotes(scaleLock: string | undefined, rootNote: number): { semi: number; name: string }[] {
  const scale = scaleLock && scaleLock !== "chromatic" ? SCALES[scaleLock] : SCALES.chromatic;
  if (!scale) return [];
  const notes: { semi: number; name: string }[] = [];
  // 3 octaves: -12 to +24
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

function semiToNoteName(semi: number, root: number): string {
  const midi = root + semi;
  return NOTE_NAMES[((midi % 12) + 12) % 12] + Math.floor(midi / 12 - 1);
}

export function StepGrid({ steps, currentStep, accent, onTap, onLongPress, rootNote = 45, scaleLock, onEditStep }: Props) {
  const [dropdownIdx, setDropdownIdx] = useState<number | null>(null);
  const startSemi = useRef(0);

  const semis = steps.filter(Boolean).map((s) => s!.semi);
  const minSemi = semis.length ? Math.min(...semis) : 0;
  const maxSemi = semis.length ? Math.max(...semis) : 0;
  const range = Math.max(maxSemi - minSemi, 1);

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
  // vertical drag nudges pitch (matches the bar height). Long-press → editor.
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
    cellLabel: (i) => { const s = steps[i]; return s ? `Step ${i + 1}, ${semiToNoteName(s.semi, rootNote)}` : `Step ${i + 1}, rest`; },
    longPressMs: LONG_PRESS_MS,
  });

  return (
    <div className="step-grid-wrap">
      <div className="step-grid" role="group" aria-label="Synth steps" ref={grid.gridRef} {...grid.gridHandlers}>
        {steps.map((step, i) => {
          const active = i === currentStep;
          const barStart = i % 4 === 0;
          const pressing = grid.pressingIdx === i;

          if (!step) {
            return (
              <div
                key={i}
                data-grid-idx={i}
                className={`step-cell rest ${active ? "active" : ""} ${barStart ? "bar-start" : ""} ${onTap ? "editable" : ""} ${pressing ? "step-pressing" : ""}`}
                title={`Step ${i + 1}: rest`}
                {...grid.cellProps(i)}
                onContextMenu={(e) => { e.preventDefault(); onLongPress?.(i); }}
              >
                <div className="step-bar rest-bar" />
              </div>
            );
          }

          const height = 25 + ((step.semi - minSemi) / range) * 65;
          const cellColor = getCellColor(accent, step.semi, active);

          return (
            <div
              key={i}
              data-grid-idx={i}
              className={`step-cell ${active ? "active" : ""} ${barStart ? "bar-start" : ""} ${step.slide ? "slide" : ""} ${onTap ? "editable" : ""} ${pressing ? "step-pressing" : ""}`}
              title={`Step ${i + 1}: ${semiToNoteName(step.semi, rootNote)} vel:${step.vel}`}
              {...grid.cellProps(i)}
              onContextMenu={(e) => { e.preventDefault(); setDropdownIdx(null); onLongPress?.(i); }}
              onWheel={(e) => handleWheel(e, i, step)}
            >
              <div
                className={`step-bar ${step.vel > 1 ? "accent" : ""}`}
                style={{
                  height: `${height}%`,
                  background: active ? "#fff" : step.vel > 1 ? "var(--accent-bright)" : cellColor,
                }}
              />
              {step.slide && <div className="slide-marker" style={{ background: accent }} />}
            </div>
          );
        })}
      </div>
      {/* Note names row below step cells */}
      <div className="step-note-row">
        {steps.map((step, i) => {
          const active = i === currentStep;
          const barStart = i % 4 === 0;
          const noteName = step ? getNoteName(rootNote, step.semi) : "";
          return (
            <div
              key={i}
              className={`step-note-cell ${barStart ? "bar-start" : ""} ${step && onEditStep ? "editable" : ""}`}
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
  );
}
