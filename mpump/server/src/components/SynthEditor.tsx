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

const OSC_TYPES: OscType[] = ["sawtooth", "square", "sine", "triangle", "pwm", "sync", "fm", "wavetable"];
const OSC_LABELS: Record<OscType, string> = {
  sawtooth: "SAW",
  square: "SQR",
  sine: "SIN",
  triangle: "TRI",
  pwm: "PWM",
  sync: "SYNC",
  fm: "FM",
  wavetable: "WTB",
};

import type { FilterModel } from "../types";
const FILTER_MODELS: FilterModel[] = ["digital", "mog", "303"];
const FILTER_MODEL_LABELS: Record<FilterModel, string> = {
  digital: "DIG",
  mog: "MOG",
  "303": "303",
};

/** Render a tiny SVG of the ADSR envelope shape. Standard fixed-segment layout. */
function AdsrCurve({ attack, decay, sustain, release, accent }: {
  attack: number; decay: number; sustain: number; release: number; accent: string;
}) {
  const w = 200, h = 50, pad = 4;
  // Each segment gets a proportional share of 4 equal slots, clamped
  const segW = (w - pad * 2) / 4;
  const norm = (v: number, max: number) => Math.max(0.05, Math.min(1, v / max));
  const aW = norm(attack, 2) * segW;
  const dW = norm(decay, 2) * segW;
  const sW = segW; // sustain hold is always fixed width
  const rW = norm(release, 3) * segW;

  const x0 = pad;
  const x1 = x0 + aW;
  const x2 = x1 + dW;
  const x3 = x2 + sW;
  const x4 = x3 + rW;

  const yTop = pad;
  const yBot = h - pad;
  const ySus = yBot - sustain * (h - pad * 2);

  const path = `M ${x0},${yBot} L ${x1},${yTop} L ${x2},${ySus} L ${x3},${ySus} L ${x4},${yBot}`;

  return (
    <svg className="adsr-curve" viewBox={`0 0 ${w} ${h}`}>
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
        {OSC_TYPES.slice(0, 5).map((t) => (
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
        <span style={{ width: 1, background: "var(--border)", margin: "0 2px", alignSelf: "stretch" }} />
        {OSC_TYPES.slice(5).map((t) => (
          <button
            key={t}
            className={`synth-osc-btn ${params.oscType === t ? "active" : ""}`}
            title={`Oscillator: ${t} (AudioWorklet)`}
            style={params.oscType === t ? { background: accent, color: "#000" } : undefined}
            onClick={() => onChange({ oscType: t })}
          >
            {OSC_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Worklet osc params — shown when sync/fm/wavetable selected */}
      {params.oscType === "sync" && (
        <div className="synth-knobs" style={{ marginBottom: 6 }}>
          <Knob label="RATIO" value={params.syncRatio ?? 2} min={1} max={16} step={0.1} accent={accent} onChange={(v) => onChange({ syncRatio: v })} />
        </div>
      )}
      {params.oscType === "fm" && (
        <div className="synth-knobs" style={{ marginBottom: 6 }}>
          <Knob label="RATIO" value={params.fmRatio ?? 2} min={0.5} max={16} step={0.1} accent={accent} onChange={(v) => onChange({ fmRatio: v })} />
          <Knob label="INDEX" value={params.fmIndex ?? 5} min={0} max={100} step={1} accent={accent} onChange={(v) => onChange({ fmIndex: v })} />
        </div>
      )}
      {params.oscType === "wavetable" && (
        <div style={{ marginBottom: 6 }}>
          <div className="synth-osc-row">
            {(["basic", "vocal", "metallic", "pad", "organ"] as const).map(t => (
              <button
                key={t}
                className={`synth-osc-btn ${(params.wavetable ?? "basic") === t ? "active" : ""}`}
                style={(params.wavetable ?? "basic") === t ? { background: accent, color: "#000" } : undefined}
                onClick={() => onChange({ wavetable: t })}
              >{t.toUpperCase()}</button>
            ))}
          </div>
          <div className="synth-knobs">
            <Knob label="MORPH" value={params.wavetablePos ?? 0.5} min={0} max={1} step={0.01} accent={accent} onChange={(v) => onChange({ wavetablePos: v })} />
          </div>
        </div>
      )}

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
              <span style={{ width: 4 }} />
              {FILTER_MODELS.map((fm) => (
                <button
                  key={fm}
                  className={`synth-osc-btn ${(params.filterModel ?? "digital") === fm ? "active" : ""}`}
                  title={`Filter model: ${fm}`}
                  style={(params.filterModel ?? "digital") === fm ? { background: accent, color: "#000" } : undefined}
                  onClick={() => onChange({ filterModel: fm })}
                >
                  {FILTER_MODEL_LABELS[fm]}
                </button>
              ))}
            </div>
            <div className="synth-filter-row">
              <FilterCurve cutoff={params.cutoff} resonance={params.resonance} accent={accent} filterType={params.filterType} />
              <div className="synth-filter-knobs">
                <Knob label="CUT" value={params.cutoff} min={100} max={8000} step={50} accent={accent} onChange={(v) => onChange({ cutoff: v })} />
                <Knob label="RES" value={params.resonance} min={0.5} max={20} step={0.5} accent={accent} onChange={(v) => onChange({ resonance: v })} />
                <Knob label="ENV" value={params.filterEnvDepth ?? 0} min={0} max={1} step={0.01} accent={accent} onChange={(v) => onChange({ filterEnvDepth: v })} />
                <Knob label="DRV" value={params.filterDrive ?? 0} min={0} max={1} step={0.01} accent={accent} onChange={(v) => onChange({ filterDrive: v })} />
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
            {/* Row 1: ON/OFF + Shape */}
            <div className="synth-sub-row" style={{ marginBottom: 4 }}>
              <button
                className={`synth-osc-btn ${params.lfoOn ? "active" : ""}`}
                style={params.lfoOn ? { background: accent, color: "#000" } : undefined}
                onClick={() => onChange({ lfoOn: !params.lfoOn })}
              >{params.lfoOn ? "ON" : "OFF"}</button>
              {(["sine", "square", "triangle", "sawtooth"] as LfoShape[]).map((s) => (
                <button key={s}
                  className={`synth-osc-btn ${params.lfoShape === s ? "active" : ""}`}
                  style={params.lfoShape === s ? { background: accent, color: "#000" } : undefined}
                  onClick={() => onChange({ lfoShape: s })}
                >{s === "sawtooth" ? "SAW" : s === "triangle" ? "TRI" : s === "square" ? "SQR" : "SIN"}</button>
              ))}
            </div>
            {/* Row 2: Target + Sync */}
            <div className="synth-sub-row" style={{ marginBottom: 4 }}>
              {(["cutoff", "pitch", "both"] as LfoTarget[]).map((t) => (
                <button key={t}
                  className={`synth-osc-btn ${params.lfoTarget === t ? "active" : ""}`}
                  style={params.lfoTarget === t ? { background: accent, color: "#000" } : undefined}
                  onClick={() => onChange({ lfoTarget: t })}
                >{t.toUpperCase()}</button>
              ))}
              <button
                className={`synth-osc-btn ${!params.lfoSync ? "active" : ""}`}
                style={!params.lfoSync ? { background: accent, color: "#000" } : undefined}
                onClick={() => onChange({ lfoSync: false })}
              >FREE</button>
              <button
                className={`synth-osc-btn ${params.lfoSync ? "active" : ""}`}
                style={params.lfoSync ? { background: accent, color: "#000" } : undefined}
                onClick={() => onChange({ lfoSync: true })}
              >SYNC</button>
            </div>
            {/* Row 3: Full-width LFO waveform */}
            {(() => {
              const w = 200, h = 40;
              const shape = params.lfoShape;
              const depth = params.lfoOn ? params.lfoDepth : 0.3;
              // Map division/rate to visual cycles
              const DIV_CYCLES: Record<string, number> = { "2": 0.5, "1": 1, "1/2": 2, "1/4": 4, "1/8": 8, "1/16": 16, "1/4d": 3, "1/8d": 6 };
              const rawCycles = params.lfoSync
                ? (DIV_CYCLES[params.lfoDivision] ?? 2)
                : 0.5 + (params.lfoRate / 20) * 6;
              const cycles = Math.min(rawCycles, 8);
              const pts = Array.from({ length: 80 }, (_, i) => {
                const t = i / 79;
                let y = 0;
                const phase = t * cycles;
                switch (shape) {
                  case "sine": y = Math.sin(phase * Math.PI * 2); break;
                  case "square": y = Math.sin(phase * Math.PI * 2) >= 0 ? 1 : -1; break;
                  case "triangle": y = 2 * Math.abs(2 * (phase % 1) - 1) - 1; break;
                  case "sawtooth": y = 2 * (phase % 1) - 1; break;
                }
                return `${4 + t * (w - 8)},${h / 2 - y * depth * (h / 2 - 4)}`;
              }).join(" ");
              return (
                <svg className="lfo-curve" viewBox={`0 0 ${w} ${h}`} style={{ opacity: params.lfoOn ? 1 : 0.3 }}>
                  <rect x={0} y={0} width={w} height={h} fill="rgba(0,0,0,0.2)" rx={4} />
                  <line x1={4} y1={h / 2} x2={w - 4} y2={h / 2} stroke="rgba(102,255,153,0.15)" strokeWidth={1} />
                  <polyline points={pts} fill="none" stroke={accent} strokeWidth={1.5} />
                </svg>
              );
            })()}
            {/* Row 4: Rate + Depth sliders */}
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
