interface Props {
  step: number;
  accent: string;
  numSteps?: number;
}

export function BeatIndicator({ step, accent, numSteps = 16 }: Props) {
  const numBeats = numSteps / 4;
  const beat = step >= 0 ? Math.floor(step / 4) : -1;

  return (
    <div className="beat-indicator">
      <div className="beat-dots">
        {Array.from({ length: numBeats }, (_, i) => (
          <div
            key={i}
            className={`beat-dot ${i === beat ? "active" : ""}`}
            style={i === beat ? { background: accent } : undefined}
          />
        ))}
      </div>
      <div className="beat-bar">
        {Array.from({ length: numSteps }, (_, i) => (
          <div
            key={i}
            className={`beat-cell ${i === step ? "active" : ""} ${i % 4 === 0 ? "bar-start" : ""}`}
            style={i === step ? { background: accent } : undefined}
          />
        ))}
      </div>
    </div>
  );
}
