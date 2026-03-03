import type { DrumHit } from "../types";

interface Props {
  drumData: DrumHit[][];
  currentStep: number;
  accent: string;
}

const DRUM_ROWS: [number, string][] = [
  [36, "BD"],
  [38, "SD"],
  [42, "CH"],
  [46, "OH"],
  [50, "CP"],
  [49, "CY"],
];

export function DrumGrid({ drumData, currentStep, accent }: Props) {
  return (
    <div className="drum-grid">
      {DRUM_ROWS.map(([note, label]) => (
        <div key={note} className="drum-row">
          <span className="drum-label">{label}</span>
          <div className="drum-steps">
            {drumData.map((hits, i) => {
              const hit = hits.find((h) => h.note === note);
              const active = i === currentStep;
              const barStart = i % 4 === 0;

              return (
                <div
                  key={i}
                  className={`drum-cell ${active ? "active" : ""} ${barStart ? "bar-start" : ""} ${hit ? "hit" : ""}`}
                  style={
                    hit
                      ? {
                          background: active ? "#fff" : accent,
                          opacity: active ? 1 : 0.4 + (hit.vel / 127) * 0.6,
                        }
                      : undefined
                  }
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
