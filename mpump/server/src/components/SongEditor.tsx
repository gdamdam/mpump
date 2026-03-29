/**
 * SongEditor — Arrange patterns in a sequence (song mode).
 * Experimental: enabled via Settings toggle.
 * Bar duration synced to BPM and pattern length.
 */

import { useState, useEffect, useRef } from "react";
import type { ClientMessage, GenreInfo } from "../types";

interface Props {
  accent: string;
  device: string;
  genreList: GenreInfo[];
  genreIdx: number;
  patternIdx: number;
  bassPatterns?: { name: string }[];
  bassPatternIdx?: number;
  hasBass: boolean;
  bpm: number;
  patternLength: number;
  command: (msg: ClientMessage) => void;
}

interface SongStep {
  patternIdx: number;
  bassPatternIdx: number;
  bars: number;
}

export function SongEditor({ accent, device, genreList, genreIdx, patternIdx, bassPatterns, bassPatternIdx, hasBass, bpm, patternLength, command }: Props) {
  const [steps, setSteps] = useState<SongStep[]>([{ patternIdx, bassPatternIdx: bassPatternIdx ?? 0, bars: 1 }]);
  const [playing, setPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const timerRef = useRef<number>(0);
  const stepRef = useRef(0);
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;

  const patterns = genreList[genreIdx]?.patterns ?? [];

  // Duration of one bar in ms: patternLength steps × step duration
  const barMs = () => (patternLength * 60000) / (bpmRef.current * 4);

  const addStep = () => {
    setSteps(prev => [...prev, { patternIdx: 0, bassPatternIdx: 0, bars: 1 }]);
  };

  const removeStep = (idx: number) => {
    if (steps.length <= 1) return;
    setSteps(prev => prev.filter((_, i) => i !== idx));
  };

  const updateStep = (idx: number, params: Partial<SongStep>) => {
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, ...params } : s));
  };

  const scheduleNext = () => {
    const s = steps[stepRef.current];
    if (!s) return;
    command({ type: "set_pattern", device, idx: s.patternIdx });
    if (hasBass) command({ type: "set_pattern", device: `${device}_bass`, idx: s.bassPatternIdx });
    timerRef.current = window.setTimeout(() => {
      stepRef.current = (stepRef.current + 1) % steps.length;
      setCurrentStep(stepRef.current);
      scheduleNext();
    }, barMs() * s.bars);
  };

  const play = () => {
    if (steps.length === 0) return;
    setPlaying(true);
    stepRef.current = 0;
    setCurrentStep(0);
    scheduleNext();
  };

  const stop = () => {
    setPlaying(false);
    window.clearTimeout(timerRef.current);
  };

  useEffect(() => {
    return () => window.clearTimeout(timerRef.current);
  }, []);

  const totalBars = steps.reduce((a, s) => a + s.bars, 0);

  return (
    <div className="song-editor">
      <div className="synth-editor-header">
        <div className="drum-kit-label" style={{ color: accent }}>
          song mode <span className="song-info">{totalBars} bars</span>
        </div>
        <div className="euclid-actions">
          <button
            className={`synth-osc-btn ${playing ? "active" : ""}`}
            title={playing ? "Stop song playback" : "Play song sequence"}
            style={playing ? { fontSize: 9, background: accent, color: "#000" } : { fontSize: 9 }}
            onClick={playing ? stop : play}
          >
            {playing ? "STOP" : "PLAY"}
          </button>
          <button className="synth-osc-btn" title="Add song step" style={{ fontSize: 9 }} onClick={addStep}>+ ADD</button>
        </div>
      </div>

      <div className="song-steps">
        {steps.map((s, i) => (
          <div key={i} className={`song-step ${i === currentStep && playing ? "song-step-active" : ""}`} style={i === currentStep && playing ? { borderColor: accent } : undefined}>
            <span className="song-step-num">{i + 1}</span>
            <select
              className="synth-preset-select"
              value={s.patternIdx}
              onChange={(e) => updateStep(i, { patternIdx: parseInt(e.target.value) })}
              style={{ flex: 1 }}
            >
              {patterns.map((p, pi) => (
                <option key={pi} value={pi}>{p.name}</option>
              ))}
            </select>
            {hasBass && bassPatterns && (
              <select
                className="synth-preset-select"
                value={s.bassPatternIdx}
                title="Bass pattern"
                onChange={(e) => updateStep(i, { bassPatternIdx: parseInt(e.target.value) })}
                style={{ flex: 1 }}
              >
                {bassPatterns.map((p, pi) => (
                  <option key={pi} value={pi}>{p.name}</option>
                ))}
              </select>
            )}
            <select
              className="synth-preset-select"
              value={s.bars}
              title="Number of bars"
              onChange={(e) => updateStep(i, { bars: parseInt(e.target.value) })}
              style={{ width: 50 }}
            >
              {[1, 2, 4, 8].map(b => (
                <option key={b} value={b}>{b}bar{b > 1 ? "s" : ""}</option>
              ))}
            </select>
            {steps.length > 1 && (
              <button className="synth-osc-btn" title="Remove step" style={{ fontSize: 9 }} onClick={() => removeStep(i)}>✕</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
