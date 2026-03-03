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

export function StepGrid({ steps, currentStep, accent, onTap, onLongPress }: Props) {
  const longFired = useRef(false);
  const timerRef = useRef<number>(0);

  const semis = steps.filter(Boolean).map((s) => s!.semi);
  const minSemi = semis.length ? Math.min(...semis) : 0;
  const maxSemi = semis.length ? Math.max(...semis) : 0;
  const range = Math.max(maxSemi - minSemi, 1);

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
    <div className="step-grid">
      {steps.map((step, i) => {
        const active = i === currentStep;
        const barStart = i % 4 === 0;

        if (!step) {
          return (
            <div
              key={i}
              className={`step-cell rest ${active ? "active" : ""} ${barStart ? "bar-start" : ""} ${onTap ? "editable" : ""}`}
              onClick={() => handleClick(i)}
              onPointerDown={() => startLong(i)}
              onPointerUp={cancelLong}
              onPointerLeave={cancelLong}
              onContextMenu={(e) => { e.preventDefault(); onLongPress?.(i); }}
            >
              <div className="step-bar rest-bar" />
            </div>
          );
        }

        const height = 20 + ((step.semi - minSemi) / range) * 80;

        return (
          <div
            key={i}
            className={`step-cell ${active ? "active" : ""} ${barStart ? "bar-start" : ""} ${step.slide ? "slide" : ""} ${onTap ? "editable" : ""}`}
            onClick={() => handleClick(i)}
            onPointerDown={() => startLong(i)}
            onPointerUp={cancelLong}
            onPointerLeave={cancelLong}
            onContextMenu={(e) => { e.preventDefault(); onLongPress?.(i); }}
          >
            <div
              className={`step-bar ${step.vel > 1 ? "accent" : ""}`}
              style={{
                height: `${height}%`,
                background: active ? "#fff" : step.vel > 1 ? "var(--accent-bright)" : accent,
              }}
            />
            {step.slide && <div className="slide-marker" style={{ background: accent }} />}
          </div>
        );
      })}
    </div>
  );
}
