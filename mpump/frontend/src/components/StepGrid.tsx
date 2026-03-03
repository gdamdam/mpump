import type { StepData } from "../types";

interface Props {
  steps: (StepData | null)[];
  currentStep: number;
  accent: string;
}

export function StepGrid({ steps, currentStep, accent }: Props) {
  // Find range for pitch visualization
  const semis = steps.filter(Boolean).map((s) => s!.semi);
  const minSemi = semis.length ? Math.min(...semis) : 0;
  const maxSemi = semis.length ? Math.max(...semis) : 0;
  const range = Math.max(maxSemi - minSemi, 1);

  return (
    <div className="step-grid">
      {steps.map((step, i) => {
        const active = i === currentStep;
        const barStart = i % 4 === 0;

        if (!step) {
          return (
            <div
              key={i}
              className={`step-cell rest ${active ? "active" : ""} ${barStart ? "bar-start" : ""}`}
            >
              <div className="step-bar rest-bar" />
            </div>
          );
        }

        const height = 20 + ((step.semi - minSemi) / range) * 80;

        return (
          <div
            key={i}
            className={`step-cell ${active ? "active" : ""} ${barStart ? "bar-start" : ""} ${step.slide ? "slide" : ""}`}
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
