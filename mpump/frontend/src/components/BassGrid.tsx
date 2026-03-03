import type { StepData } from "../types";

interface Props {
  steps: (StepData | null)[];
  currentStep: number;
  accent: string;
}

export function BassGrid({ steps, currentStep, accent }: Props) {
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
              className={`drum-cell ${active ? "active" : ""} ${barStart ? "bar-start" : ""} ${step ? "hit" : ""} ${step?.slide ? "slide" : ""}`}
              style={
                step
                  ? {
                      background: active ? "#fff" : accent,
                      opacity: active ? 1 : step.vel > 1 ? 1 : 0.7,
                    }
                  : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}
