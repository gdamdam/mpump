import { useState } from "react";
import type { SynthParams, OscType, LfoShape, LfoTarget, FilterType } from "../types";
import { LFO_DIVISIONS } from "../types";
import { SYNTH_PRESETS, BASS_PRESETS } from "../data/soundPresets";

interface Props {
  params: SynthParams;
  accent: string;
  label: string;
  onChange: (params: Partial<SynthParams>) => void;
  hideVoices?: boolean;
}

const OSC_TYPES: OscType[] = ["sawtooth", "square", "sine", "triangle"];
const OSC_LABELS: Record<OscType, string> = {
  sawtooth: "SAW",
  square: "SQR",
  sine: "SIN",
  triangle: "TRI",
};

/** Render a tiny SVG of the ADSR envelope shape. */
function AdsrCurve({ attack, decay, sustain, release, accent }: {
  attack: number; decay: number; sustain: number; release: number; accent: string;
}) {
  // Normalize to SVG coords (width=120, height=40)
  const w = 120, h = 40, pad = 2;
  const totalTime = attack + decay + 0.3 + release; // 0.3 = sustain hold
  const scale = (w - pad * 2) / totalTime;

  const x0 = pad;
  const x1 = pad + attack * scale;          // end of attack
  const x2 = x1 + decay * scale;            // end of decay
  const x3 = x2 + 0.3 * scale;             // end of sustain hold
  const x4 = x3 + release * scale;          // end of release

  const yTop = pad;
  const yBot = h - pad;
  const ySus = yBot - sustain * (h - pad * 2);

  const path = `M ${x0},${yBot} L ${x1},${yTop} L ${x2},${ySus} L ${x3},${ySus} L ${x4},${yBot}`;

  return (
    <svg className="adsr-curve" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={path} fill="none" stroke={accent} strokeWidth="2" strokeLinejoin="round" />
      <path d={`${path} L ${x0},${yBot}`} fill={accent} fillOpacity="0.15" />
      {/* Phase markers */}
      <line x1={x1} y1={yTop} x2={x1} y2={yBot} stroke={accent} strokeWidth="0.5" strokeDasharray="2,2" opacity="0.4" />
      <line x1={x2} y1={ySus} x2={x2} y2={yBot} stroke={accent} strokeWidth="0.5" strokeDasharray="2,2" opacity="0.4" />
      <line x1={x3} y1={ySus} x2={x3} y2={yBot} stroke={accent} strokeWidth="0.5" strokeDasharray="2,2" opacity="0.4" />
    </svg>
  );
}

/** Render a tiny SVG of the filter response curve. */
function FilterCurve({ cutoff, resonance, accent, filterType }: {
  cutoff: number; resonance: number; accent: string; filterType: FilterType;
}) {
  const w = 120, h = 40, pad = 2;
  const cutX = pad + ((Math.log(cutoff) - Math.log(100)) / (Math.log(8000) - Math.log(100))) * (w - pad * 2);
  const resPeak = (resonance / 20) * 0.6;

  const points: string[] = [];
  for (let x = pad; x <= w - pad; x += 1) {
    const freq = Math.exp(Math.log(100) + ((x - pad) / (w - pad * 2)) * (Math.log(8000) - Math.log(100)));
    const ratio = freq / cutoff;
    let gain: number;

    if (filterType === "lowpass") {
      if (ratio < 0.9) gain = 1;
      else if (ratio < 1.1) { const d = Math.abs(ratio - 1) / 0.1; gain = 1 + resPeak * (1 - d); }
      else gain = Math.max(0.02, 1 / (ratio * ratio));
    } else if (filterType === "highpass") {
      if (ratio > 1.1) gain = 1;
      else if (ratio > 0.9) { const d = Math.abs(ratio - 1) / 0.1; gain = 1 + resPeak * (1 - d); }
      else gain = Math.max(0.02, ratio * ratio);
    } else if (filterType === "bandpass") {
      const dist = Math.abs(ratio - 1);
      if (dist < 0.15) gain = 1 + resPeak * (1 - dist / 0.15);
      else gain = Math.max(0.02, 1 / (1 + dist * dist * 10));
    } else {
      // notch
      const dist = Math.abs(ratio - 1);
      if (dist < 0.1) gain = Math.max(0.02, dist / 0.1 * 0.5);
      else gain = 1;
    }

    const y = h - pad - gain * (h - pad * 2) * 0.7;
    points.push(`${x},${Math.max(pad, Math.min(h - pad, y))}`);
  }

  return (
    <svg className="filter-curve" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={points.join(" ")} fill="none" stroke={accent} strokeWidth="2" />
      <line x1={cutX} y1={pad} x2={cutX} y2={h - pad} stroke={accent} strokeWidth="0.5" strokeDasharray="2,2" opacity="0.5" />
    </svg>
  );
}

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  accent: string;
  onChange: (v: number) => void;
}

export function Knob({ label, value, min, max, step, accent, onChange }: KnobProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="synth-knob">
      <span className="synth-knob-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ "--knob-pct": `${pct}%`, "--knob-accent": accent } as React.CSSProperties}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span className="synth-knob-value">{value < 1 ? value.toFixed(2) : Math.round(value)}</span>
    </label>
  );
}

export function SynthEditor({ params, accent, label, onChange, hideVoices }: Props) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [lfoOpen, setLfoOpen] = useState(false);

  return (
    <div className="synth-editor">
      <div className="synth-editor-label" style={{ color: accent }}>{label}</div>

      <div className="synth-osc-row">
        {OSC_TYPES.map((t) => (
          <button
            key={t}
            className={`synth-osc-btn ${params.oscType === t ? "active" : ""}`}
            title={`Oscillator: ${t}`}
            style={params.oscType === t ? { background: accent, color: "#000" } : undefined}
            onClick={() => onChange({ oscType: t })}
          >
            {OSC_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="synth-section">
        <div className="synth-section-header">ADSR</div>
        <AdsrCurve
          attack={params.attack}
          decay={params.decay}
          sustain={params.sustain}
          release={params.release}
          accent={accent}
        />
        <div className="synth-knobs">
          <Knob label="ATK" value={params.attack} min={0.001} max={1} step={0.005} accent={accent} onChange={(v) => onChange({ attack: v })} />
          <Knob label="DEC" value={params.decay} min={0.01} max={1} step={0.01} accent={accent} onChange={(v) => onChange({ decay: v })} />
          <Knob label="SUS" value={params.sustain} min={0} max={1} step={0.01} accent={accent} onChange={(v) => onChange({ sustain: v })} />
          <Knob label="REL" value={params.release} min={0.01} max={2} step={0.01} accent={accent} onChange={(v) => onChange({ release: v })} />
        </div>
      </div>

      <div className="synth-knobs" style={{ maxWidth: hideVoices ? 100 : 200 }}>
        <Knob label="DETUNE" value={params.detune} min={-50} max={50} step={1} accent={accent} onChange={(v) => onChange({ detune: v })} />
        {!hideVoices && <Knob label="VOICES" value={params.unison ?? 1} min={1} max={7} step={2} accent={accent} onChange={(v) => {
          const n = Math.round(v);
          const spread = n <= 1 ? 0 : (params.unisonSpread ?? Math.round(n * 5));
          onChange({ unison: n, unisonSpread: spread });
        }} />}
      </div>

      <div className="synth-section">
        <div className="synth-sub-row">
          <div className="synth-section-header" style={{ margin: 0 }}>SUB BASS</div>
          <button
            className={`synth-osc-btn ${params.subOsc ? "active" : ""}`}
            title="Toggle sub-bass oscillator"
            style={params.subOsc ? { background: accent, color: "#000" } : undefined}
            onClick={() => onChange({ subOsc: !params.subOsc })}
          >
            {params.subOsc ? "ON" : "OFF"}
          </button>
          {params.subOsc && (
            <Knob label="LVL" value={params.subLevel} min={0} max={1} step={0.01} accent={accent} onChange={(v) => onChange({ subLevel: v })} />
          )}
        </div>
      </div>

      <div className="synth-section">
        <div
          className={`synth-section-header synth-section-toggle ${params.filterOn !== false ? "on" : ""}`}
          style={params.filterOn !== false ? { color: accent } : undefined}
          onClick={() => setFilterOpen(!filterOpen)}
          title="Expand/collapse filter controls"
        >FILTER {params.filterOn !== false ? "●" : "○"} {filterOpen ? "▾" : "▸"}</div>
        {filterOpen && (
          <>
            <div className="synth-sub-row" style={{ marginBottom: 6 }}>
              <button
                className={`synth-osc-btn ${params.filterOn !== false ? "active" : ""}`}
                title="Toggle filter on/off"
                style={params.filterOn !== false ? { background: accent, color: "#000" } : undefined}
                onClick={() => onChange({ filterOn: params.filterOn === false })}
              >
                {params.filterOn !== false ? "ON" : "OFF"}
              </button>
            </div>
            <div className="synth-osc-row">
              {(["lowpass", "highpass", "bandpass", "notch"] as FilterType[]).map((ft) => (
                <button
                  key={ft}
                  className={`synth-osc-btn ${params.filterType === ft ? "active" : ""}`}
                  title={`Filter type: ${ft}`}
                  style={params.filterType === ft ? { background: accent, color: "#000" } : undefined}
                  onClick={() => onChange({ filterType: ft })}
                >
                  {ft === "lowpass" ? "LPF" : ft === "highpass" ? "HPF" : ft === "bandpass" ? "BPF" : "NOTCH"}
                </button>
              ))}
            </div>
            <div className="synth-filter-row">
              <FilterCurve cutoff={params.cutoff} resonance={params.resonance} accent={accent} filterType={params.filterType} />
              <div className="synth-filter-knobs">
                <Knob label="CUT" value={params.cutoff} min={100} max={8000} step={50} accent={accent} onChange={(v) => onChange({ cutoff: v })} />
                <Knob label="RES" value={params.resonance} min={0.5} max={20} step={0.5} accent={accent} onChange={(v) => onChange({ resonance: v })} />
                <Knob label="ENV" value={params.filterEnvDepth ?? 0} min={0} max={1} step={0.01} accent={accent} onChange={(v) => onChange({ filterEnvDepth: v })} />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="synth-section">
        <div
          className={`synth-section-header synth-section-toggle ${params.lfoOn ? "on" : ""}`}
          style={params.lfoOn ? { color: accent } : undefined}
          onClick={() => setLfoOpen(!lfoOpen)}
          title="Expand/collapse LFO controls"
        >LFO {params.lfoOn ? "●" : "○"} {lfoOpen ? "▾" : "▸"}</div>
        {lfoOpen && (
          <>
            <div className="synth-sub-row" style={{ marginBottom: 6 }}>
              <button
                className={`synth-osc-btn ${params.lfoOn ? "active" : ""}`}
                title="Toggle LFO on/off"
                style={params.lfoOn ? { background: accent, color: "#000" } : undefined}
                onClick={() => onChange({ lfoOn: !params.lfoOn })}
              >
                {params.lfoOn ? "ON" : "OFF"}
              </button>
            </div>
            <div className="synth-sub-row" style={{ marginBottom: 6 }}>
              {(["sine", "square", "triangle", "sawtooth"] as LfoShape[]).map((s) => (
                <button
                  key={s}
                  className={`synth-osc-btn ${params.lfoShape === s ? "active" : ""}`}
                  title={`LFO shape: ${s}`}
                  style={params.lfoShape === s ? { background: accent, color: "#000" } : undefined}
                  onClick={() => onChange({ lfoShape: s })}
                >
                  {s === "sawtooth" ? "SAW" : s === "triangle" ? "TRI" : s === "square" ? "SQR" : "SIN"}
                </button>
              ))}
            </div>
            <div className="synth-sub-row" style={{ marginBottom: 6 }}>
              {(["cutoff", "pitch", "both"] as LfoTarget[]).map((t) => (
                <button
                  key={t}
                  className={`synth-osc-btn ${params.lfoTarget === t ? "active" : ""}`}
                  title={`LFO target: ${t}`}
                  style={params.lfoTarget === t ? { background: accent, color: "#000" } : undefined}
                  onClick={() => onChange({ lfoTarget: t })}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="synth-sub-row" style={{ marginBottom: 6 }}>
              <button
                className={`synth-osc-btn ${!params.lfoSync ? "active" : ""}`}
                title="Free-running LFO rate in Hz"
                style={!params.lfoSync ? { background: accent, color: "#000" } : undefined}
                onClick={() => onChange({ lfoSync: false })}
              >
                FREE
              </button>
              <button
                className={`synth-osc-btn ${params.lfoSync ? "active" : ""}`}
                title="Tempo-synced LFO rate"
                style={params.lfoSync ? { background: accent, color: "#000" } : undefined}
                onClick={() => onChange({ lfoSync: true })}
              >
                SYNC
              </button>
            </div>
            <div className="synth-knobs">
              {params.lfoSync ? (
                <label className="synth-knob">
                  <span className="synth-knob-label">DIV</span>
                  <select
                    className="synth-preset-select"
                    value={params.lfoDivision}
                    onChange={(e) => onChange({ lfoDivision: e.target.value })}
                    style={{ width: "100%" }}
                  >
                    {LFO_DIVISIONS.map(d => (
                      <option key={d} value={d}>{d === "2" ? "2 bars" : d === "1" ? "1 bar" : d}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <Knob label="RATE" value={params.lfoRate} min={0.1} max={20} step={0.1} accent={accent} onChange={(v) => onChange({ lfoRate: v })} />
              )}
              <Knob label="DEPTH" value={params.lfoDepth} min={0} max={1} step={0.01} accent={accent} onChange={(v) => onChange({ lfoDepth: v })} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
