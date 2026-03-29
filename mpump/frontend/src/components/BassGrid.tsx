import { useRef, useCallback } from "react";
import type { StepData } from "../types";

interface Props {
  steps: (StepData | null)[];
  currentStep: number;
  accent: string;
  onTap?: (stepIdx: number) => void;
  onLongPress?: (stepIdx: number) => void;
}

const LONG_PRESS_MS = 500;

export function BassGrid({ steps, currentStep, accent, onTap, onLongPress }: Props) {
  const longFired = useRef(false);
  const timerRef = useRef<number>(0);

  const startLong = useCallback((i: number) => {
    longFired.current = false;
    clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      longFired.current = true;
      onLongPress?.(i);
    }, LONG_PRESS_MS);
  }, [onLongPress]);

  const cancelLong = useCallback(() => {
    clearTimeout(timerRef.current);
  }, []);

  const handleClick = useCallback((i: number) => {
    if (longFired.current) {
      longFired.current = false;
      return;
    }
    cancelLong();
    onTap?.(i);
  }, [onTap, cancelLong]);

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
              onClick={() => handleClick(i)}
              onPointerDown={() => startLong(i)}
              onPointerUp={cancelLong}
              onPointerLeave={cancelLong}
              onContextMenu={(e) => { e.preventDefault(); onLongPress?.(i); }}
            />
          );
        })}
      </div>
    </div>
  );
}
