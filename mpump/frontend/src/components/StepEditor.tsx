import { useState } from "react";
import type { StepData } from "../types";

interface Props {
  initial: StepData | null;
  accent: string;
  onSave: (data: StepData | null) => void;
  onClose: () => void;
}

const VELOCITIES = [
  { label: "Ghost", val: 0.5 },
  { label: "Soft", val: 0.8 },
  { label: "Normal", val: 1.0 },
  { label: "Accent", val: 1.3 },
];

export function StepEditor({ initial, accent, onSave, onClose }: Props) {
  const [semi, setSemi] = useState(initial?.semi ?? 0);
  const [vel, setVel] = useState(initial?.vel ?? 1.0);
  const [slide, setSlide] = useState(initial?.slide ?? false);

  const handleBackdrop = (e: React.PointerEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="picker-backdrop" onPointerDown={handleBackdrop}>
      <div className="picker-sheet step-editor">
        <div className="picker-header">
          <span className="picker-title" style={{ color: accent }}>Edit Step</span>
          <button className="picker-close" onClick={onClose}>&times;</button>
        </div>

        <div className="editor-body">
          {/* Semitone */}
          <div className="editor-row">
            <span className="editor-label">Semitone</span>
            <div className="editor-control">
              <button className="editor-btn" onClick={() => setSemi(Math.max(-12, semi - 1))}>-</button>
              <span className="editor-value">{semi >= 0 ? `+${semi}` : semi}</span>
              <button className="editor-btn" onClick={() => setSemi(Math.min(24, semi + 1))}>+</button>
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
