import { useRef } from "react";
import type { StepData } from "../types";

interface Props {
  steps: (StepData | null)[];
  currentStep: number;
  accent: string;
  onTap?: (stepIdx: number) => void;
  onLongPress?: (stepIdx: number) => void;
}

const LONG_PRESS_MS = 400;

export function BassGrid({ steps, currentStep, accent, onTap, onLongPress }: Props) {
  const timerRef = useRef<number>(0);
  const firedRef = useRef(false);

  const handlePointerDown = (i: number) => {
    firedRef.current = false;
    timerRef.current = window.setTimeout(() => {
      firedRef.current = true;
      onLongPress?.(i);
    }, LONG_PRESS_MS);
  };

  const handlePointerUp = (i: number) => {
    clearTimeout(timerRef.current);
    if (!firedRef.current) {
      onTap?.(i);
    }
  };

  const handlePointerLeave = () => {
    clearTimeout(timerRef.current);
  };

  return (
    <div className="bass-grid">
      <span className="drum-label">BS</span>
      <div className="drum-steps">
        {steps.map((step, i) => {
          const active = i === currentStep;
          const barStart = i % 4 === 0;

          return (
            <div
              key={i}
              className={`drum-cell ${active ? "active" : ""} ${barStart ? "bar-start" : ""} ${step ? "hit" : ""} ${step?.slide ? "slide" : ""} ${onTap ? "editable" : ""}`}
              style={
                step
                  ? {
                      background: active ? "#fff" : accent,
                      opacity: active ? 1 : step.vel > 1 ? 1 : 0.7,
                    }
                  : undefined
              }
              onPointerDown={() => handlePointerDown(i)}
              onPointerUp={() => handlePointerUp(i)}
              onPointerLeave={handlePointerLeave}
            />
          );
        })}
      </div>
    </div>
  );
}
