interface Props {
  step: number;
  accent: string;
}

export function BeatIndicator({ step, accent }: Props) {
  const beat = step >= 0 ? Math.floor(step / 4) : -1;

  return (
    <div className="beat-indicator">
      <div className="beat-dots">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`beat-dot ${i === beat ? "active" : ""}`}
            style={i === beat ? { background: accent } : undefined}
          />
        ))}
      </div>
      <div className="beat-bar">
        {Array.from({ length: 16 }, (_, i) => (
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
