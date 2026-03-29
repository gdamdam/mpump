import { useState } from "react";
import type { StepData } from "../types";
import { midiToNoteName, nextInScale } from "../data/keys";

interface Props {
  initial: StepData | null;
  accent: string;
  rootNote: number;
  scaleLock?: string;
  onSave: (data: StepData | null) => void;
  onClose: () => void;
}

const VELOCITIES = [
  { label: "Ghost", val: 0.5 },
  { label: "Soft", val: 0.8 },
  { label: "Normal", val: 1.0 },
  { label: "Accent", val: 1.3 },
];

export function StepEditor({ initial, accent, rootNote, scaleLock, onSave, onClose }: Props) {
  const [semi, setSemi] = useState(initial?.semi ?? 0);
  const [vel, setVel] = useState(initial?.vel ?? 1.0);
  const [slide, setSlide] = useState(initial?.slide ?? false);

  const handleBackdrop = (e: React.PointerEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const nudge = (dir: 1 | -1) => {
    const next = scaleLock && scaleLock !== "chromatic"
      ? nextInScale(semi, dir, scaleLock)
      : semi + dir;
    setSemi(Math.max(-12, Math.min(24, next)));
  };

  return (
    <div className="picker-backdrop" onPointerDown={handleBackdrop}>
      <div className="picker-sheet step-editor">
        <div className="picker-header">
          <span className="picker-title" style={{ color: accent }}>Edit Step</span>
          <button className="picker-close" onClick={onClose}>&times;</button>
        </div>

        <div className="editor-body">
          {/* Note */}
          <div className="editor-row">
            <span className="editor-label">Note</span>
            <div className="editor-control">
              <button className="editor-btn" onClick={() => nudge(-1)}>-</button>
              <span className="editor-value">{midiToNoteName(Math.max(0, Math.min(127, rootNote + semi)))}</span>
              <button className="editor-btn" onClick={() => nudge(1)}>+</button>
            </div>
          </div>

          {/* Velocity */}
          <div className="editor-row">
            <span className="editor-label">Velocity</span>
            <div className="editor-chips">
              {VELOCITIES.map((v) => (
                <button
                  key={v.val}
                  className={`editor-chip ${vel === v.val ? "active" : ""}`}
                  style={vel === v.val ? { background: accent, color: "#000" } : undefined}
                  onClick={() => setVel(v.val)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Slide */}
          <div className="editor-row">
            <span className="editor-label">Slide</span>
            <button
              className={`editor-toggle ${slide ? "on" : ""}`}
              style={slide ? { background: accent } : undefined}
              onClick={() => setSlide(!slide)}
            >
              {slide ? "ON" : "OFF"}
            </button>
          </div>

          {/* Actions */}
          <div className="editor-actions">
            <button
              className="editor-action-btn delete"
              onClick={() => { onSave(null); onClose(); }}
            >
              Clear Step
            </button>
            <button
              className="editor-action-btn save"
              style={{ background: accent, color: "#000" }}
              onClick={() => { onSave({ semi, vel, slide }); onClose(); }}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
