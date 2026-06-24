import { useRef } from "react";
import type { DrumHit } from "../types";
import { tapVibrate } from "../utils/haptic";
import { useGridPointer } from "../hooks/useGridPointer";

interface Props {
  drumData: DrumHit[][];
  currentStep: number;
  accent: string;
  onToggle?: (stepIdx: number, note: number, vel: number) => void;
  /** Set an existing hit's velocity (vertical drag). */
  onSetVelocity?: (stepIdx: number, note: number, vel: number) => void;
  mutedNotes?: Set<number>;
  onToggleMute?: (note: number) => void;
}

const DRUM_ROWS: [number, string, string][] = [
  [36, "BD", "Bass Drum"],
  [37, "RS", "Rimshot"],
  [38, "SD", "Snare"],
  [42, "CH", "Closed Hi-Hat"],
  [46, "OH", "Open Hi-Hat"],
  [47, "CB", "Cowbell"],
  [49, "CY", "Crash"],
  [50, "CP", "Clap"],
  [51, "RD", "Ride"],
];

const DEFAULT_VEL = 100;
const VEL_PER_PX = 1.2; // vertical drag sensitivity for velocity

interface RowProps {
  note: number;
  label: string;
  fullName: string;
  drumData: DrumHit[][];
  currentStep: number;
  accent: string;
  muted: boolean;
  onToggle?: (stepIdx: number, note: number, vel: number) => void;
  onSetVelocity?: (stepIdx: number, note: number, vel: number) => void;
  onToggleMute?: (note: number) => void;
}

function DrumRow({ note, label, fullName, drumData, currentStep, accent, muted, onToggle, onSetVelocity, onToggleMute }: RowProps) {
  const startVel = useRef(DEFAULT_VEL);
  const hitAt = (i: number) => drumData[i]?.find((h) => h.note === note);

  // Shared pointer + keyboard: tap toggles, horizontal drag paints hits,
  // vertical drag on an existing hit nudges its velocity.
  const grid = useGridPointer({
    cellCount: drumData.length,
    cellOn: (i) => !!hitAt(i),
    onTap: (i) => { tapVibrate(); onToggle?.(i, note, DEFAULT_VEL); },
    onPaint: (i, on) => { if (!!hitAt(i) !== on) onToggle?.(i, note, DEFAULT_VEL); },
    onVerticalStart: (i) => { startVel.current = hitAt(i)?.vel ?? DEFAULT_VEL; },
    onVerticalMove: (i, dy) => {
      const cur = hitAt(i);
      if (!cur || !onSetVelocity) return;
      const v = Math.max(1, Math.min(127, Math.round(startVel.current - dy * VEL_PER_PX)));
      if (v !== cur.vel) onSetVelocity(i, note, v); // only dispatch on change (avoid per-move flood)
    },
    cellLabel: (i) => { const h = hitAt(i); return `${fullName} step ${i + 1}, ${h ? `velocity ${h.vel}` : "off"}`; },
  });

  return (
    <div className={`drum-row ${muted ? "drum-row-muted" : ""}`}>
      <span
        className={`drum-label ${onToggleMute ? "drum-label-btn" : ""} ${muted ? "drum-label-muted" : ""}`}
        title={muted ? `Unmute ${fullName}` : `Mute ${fullName}`}
        onClick={() => onToggleMute?.(note)}
      >
        {label}
      </span>
      <div className="drum-steps" role="group" aria-label={`${fullName} steps`} ref={grid.gridRef} {...grid.gridHandlers}>
        {drumData.map((hits, i) => {
          const hit = hits.find((h) => h.note === note);
          const active = i === currentStep;
          const barStart = i % 4 === 0;
          const pressing = grid.pressingIdx === i;

          return (
            <div
              key={i}
              data-grid-idx={i}
              className={`drum-cell ${active ? "active" : ""} ${barStart ? "bar-start" : ""} ${hit ? "hit" : ""} ${onToggle ? "editable" : ""} ${pressing ? "drum-pressing" : ""}`}
              style={
                hit
                  ? {
                      background: active && !muted ? "#fff" : accent,
                      opacity: muted ? 0.15 : active ? 1 : 0.4 + (hit.vel / 127) * 0.6,
                    }
                  : muted ? { opacity: 0.3 } : undefined
              }
              {...grid.cellProps(i)}
            />
          );
        })}
      </div>
    </div>
  );
}

export function DrumGrid({ drumData, currentStep, accent, onToggle, onSetVelocity, mutedNotes, onToggleMute }: Props) {
  return (
    <div className="drum-grid">
      {DRUM_ROWS.map(([note, label, fullName]) => (
        <DrumRow
          key={note}
          note={note}
          label={label}
          fullName={fullName}
          drumData={drumData}
          currentStep={currentStep}
          accent={accent}
          muted={mutedNotes?.has(note) ?? false}
          onToggle={onToggle}
          onSetVelocity={onSetVelocity}
          onToggleMute={onToggleMute}
        />
      ))}
    </div>
  );
}
