import { useState } from "react";
import type { DrumHit } from "../types";
import { tapVibrate } from "../utils/haptic";

interface Props {
  drumData: DrumHit[][];
  currentStep: number;
  accent: string;
  onToggle?: (stepIdx: number, note: number, vel: number) => void;
  mutedNotes?: Set<number>;
  onToggleMute?: (note: number) => void;
}

const DRUM_ROWS: [number, string][] = [
  [36, "BD"],
  [37, "RS"],
  [38, "SD"],
  [42, "CH"],
  [46, "OH"],
  [47, "CB"],
  [49, "CY"],
  [50, "CP"],
  [51, "RD"],
];

const DEFAULT_VEL = 100;

export function DrumGrid({ drumData, currentStep, accent, onToggle, mutedNotes, onToggleMute }: Props) {
  const [pressingKey, setPressingKey] = useState<string | null>(null);

  return (
    <div className="drum-grid">
      {DRUM_ROWS.map(([note, label]) => {
        const muted = mutedNotes?.has(note) ?? false;
        return (
          <div key={note} className={`drum-row ${muted ? "drum-row-muted" : ""}`}>
            <span
              className={`drum-label ${onToggleMute ? "drum-label-btn" : ""} ${muted ? "drum-label-muted" : ""}`}
              title={muted ? `Unmute ${label}` : `Mute ${label}`}
              onClick={() => onToggleMute?.(note)}
            >
              {label}
            </span>
            <div className="drum-steps">
              {drumData.map((hits, i) => {
                const hit = hits.find((h) => h.note === note);
                const active = i === currentStep;
                const barStart = i % 4 === 0;

                return (
                  <div
                    key={i}
                    className={`drum-cell ${active ? "active" : ""} ${barStart ? "bar-start" : ""} ${hit ? "hit" : ""} ${onToggle ? "editable" : ""} ${pressingKey === `${note}-${i}` ? "drum-pressing" : ""}`}
                    style={
                      hit
                        ? {
                            background: active && !muted ? "#fff" : accent,
                            opacity: muted ? 0.15 : active ? 1 : 0.4 + (hit.vel / 127) * 0.6,
                          }
                        : muted ? { opacity: 0.3 } : undefined
                    }
                    onClick={() => { tapVibrate(); onToggle?.(i, note, DEFAULT_VEL); }}
                    onPointerDown={() => setPressingKey(`${note}-${i}`)}
                    onPointerUp={() => setPressingKey(null)}
                    onPointerLeave={() => setPressingKey(null)}
                    onPointerCancel={() => setPressingKey(null)}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
