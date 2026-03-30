/**
 * EffectEditor — Modal for adjusting individual effect parameters.
 * Shown on long-press of effect buttons in KAOS view.
 */

import { useEffect } from "react";
import type { EffectParams, EffectName } from "../types";
import { DELAY_DIVISIONS } from "../types";

interface Props {
  name: EffectName;
  params: EffectParams[EffectName];
  onUpdate: (params: Record<string, unknown>) => void;
  onClose: () => void;
}

interface SliderDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
}

const EFFECT_SLIDERS: Record<EffectName, SliderDef[]> = {
  delay: [
    { key: "time", label: "Time", min: 0.05, max: 1.5, step: 0.01, unit: "s" },
    { key: "feedback", label: "Feedback", min: 0, max: 0.9, step: 0.01 },
    { key: "mix", label: "Mix", min: 0, max: 1, step: 0.01 },
  ],
  distortion: [
    { key: "drive", label: "Drive", min: 1, max: 100, step: 1 },
  ],
  reverb: [
    { key: "decay", label: "Decay", min: 0.5, max: 5, step: 0.1, unit: "s" },
    { key: "mix", label: "Mix", min: 0, max: 1, step: 0.01 },
  ],
  compressor: [
    { key: "threshold", label: "Threshold", min: -60, max: 0, step: 1, unit: "dB" },
    { key: "ratio", label: "Ratio", min: 1, max: 20, step: 0.5 },
  ],
  highpass: [
    { key: "cutoff", label: "Cutoff", min: 20, max: 2000, step: 10, unit: "Hz" },
    { key: "q", label: "Q", min: 0.5, max: 15, step: 0.5 },
  ],
  chorus: [
    { key: "rate", label: "Rate", min: 0.1, max: 10, step: 0.1, unit: "Hz" },
    { key: "depth", label: "Depth", min: 0.001, max: 0.01, step: 0.001 },
    { key: "mix", label: "Mix", min: 0, max: 1, step: 0.01 },
  ],
  phaser: [
    { key: "rate", label: "Rate", min: 0.1, max: 5, step: 0.1, unit: "Hz" },
    { key: "depth", label: "Depth", min: 100, max: 3000, step: 50 },
  ],
  bitcrusher: [
    { key: "bits", label: "Bits", min: 2, max: 16, step: 1 },
  ],
  duck: [
    { key: "depth", label: "Depth", min: 0.1, max: 1, step: 0.05 },
    { key: "release", label: "Release", min: 0.01, max: 0.3, step: 0.01, unit: "s" },
  ],
};

const EFFECT_NAMES: Record<EffectName, string> = {
  delay: "Delay",
  distortion: "Distortion",
  reverb: "Reverb",
  compressor: "Compressor",
  highpass: "High-Pass Filter",
  chorus: "Chorus",
  phaser: "Phaser",
  bitcrusher: "Bitcrusher",
  duck: "Sidechain Duck",
};

export function EffectEditor({ name, params, onUpdate, onClose }: Props) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const sliders = EFFECT_SLIDERS[name];
  const p = params as Record<string, number | boolean | string>;

  return (
    <div className="fx-editor-overlay" onClick={onClose}>
      <div className="fx-editor" onClick={(e) => e.stopPropagation()}>
        <div className="fx-editor-header">
          <span className="fx-editor-title">{EFFECT_NAMES[name]}</span>
          <button className="fx-editor-close" onClick={onClose}>✕</button>
        </div>
        {/* Delay: sync/free toggle + division selector */}
        {name === "delay" && (
          <div className="fx-editor-row" style={{ gap: 6 }}>
            <button
              className={`synth-osc-btn ${!p.sync ? "active" : ""}`}
              style={!p.sync ? { background: "var(--preview)", color: "#000" } : undefined}
              onClick={() => onUpdate({ sync: false })}
            >FREE</button>
            <button
              className={`synth-osc-btn ${p.sync ? "active" : ""}`}
              style={p.sync ? { background: "var(--preview)", color: "#000" } : undefined}
              onClick={() => onUpdate({ sync: true })}
            >SYNC</button>
            {p.sync && (
              <select
                className="synth-preset-select"
                value={p.division as string}
                onChange={(e) => onUpdate({ division: e.target.value })}
                style={{ marginLeft: 4 }}
              >
                {DELAY_DIVISIONS.map(d => (
                  <option key={d} value={d}>{d === "1/8d" ? "1/8 dotted" : d}</option>
                ))}
              </select>
            )}
          </div>
        )}
        {/* Duck envelope visualization */}
        {name === "duck" && (() => {
          const depth = p.depth as number;
          const release = p.release as number;
          const w = 200, h = 60;
          const duckTo = 1 - depth;
          // Normalize release to visual width (0.01-0.3s → 20%-90% of width)
          const relW = 0.2 + (release - 0.01) / 0.29 * 0.7;
          const attackX = w * 0.08; // quick attack
          const bottomY = h * (1 - duckTo * 0.15); // ducked level
          const topY = h * 0.1; // full volume
          const releaseEndX = attackX + w * relW;
          const d = `M0,${topY} L${attackX},${bottomY} Q${(attackX + releaseEndX) / 2},${bottomY} ${releaseEndX},${topY} L${w},${topY}`;
          return (
            <svg className="fx-duck-envelope" viewBox={`0 0 ${w} ${h}`} width={w} height={h}>
              <rect x={0} y={0} width={w} height={h} fill="rgba(0,0,0,0.3)" rx={4} />
              <line x1={0} y1={topY} x2={w} y2={topY} stroke="rgba(102,255,153,0.15)" strokeWidth={1} strokeDasharray="3,3" />
              <path d={d} fill="rgba(102,255,153,0.1)" stroke="#66ff99" strokeWidth={2} />
              <circle cx={attackX} cy={bottomY} r={3} fill="#66ff99" />
              <text x={attackX} y={h - 2} fill="rgba(102,255,153,0.5)" fontSize={8} textAnchor="middle">kick</text>
            </svg>
          );
        })()}
        {sliders.map((s) => {
          // Hide time slider when delay is synced
          if (name === "delay" && s.key === "time" && p.sync) return null;
          const val = p[s.key] as number;
          return (
            <div className="fx-editor-row" key={s.key}>
              <span className="fx-editor-label">{s.label}</span>
              <input
                type="range"
                className="fx-editor-slider"
                min={s.min}
                max={s.max}
                step={s.step}
                value={val}
                onChange={(e) => onUpdate({ [s.key]: parseFloat(e.target.value) })}
              />
              <span className="fx-editor-value">
                {val < 1 && val > 0 ? val.toFixed(s.step < 0.01 ? 3 : 2) : Math.round(val * 10) / 10}
                {s.unit ? ` ${s.unit}` : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
