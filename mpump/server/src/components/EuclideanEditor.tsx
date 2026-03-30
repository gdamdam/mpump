/**
 * EuclideanEditor — per-voice Euclidean rhythm controls.
 * Each drum voice gets hits/steps/rotation knobs.
 * Generates patterns in real-time via Bjorklund algorithm.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { ClientMessage, DrumHit } from "../types";
import { DRUM_VOICES } from "../types";
import { euclidean } from "../engine/euclidean";

interface Props {
  accent: string;
  device: string;
  patternLength: number;
  command: (msg: ClientMessage) => void;
  onActiveChange?: (active: boolean) => void;
}

interface VoiceEuclid {
  enabled: boolean;
  hits: number;
  steps: number;
  rotation: number;
  velocity: number;
}

const DEFAULT_VOICE: VoiceEuclid = {
  enabled: false,
  hits: 4,
  steps: 16,
  rotation: 0,
  velocity: 100,
};

const VOICE_DEFAULTS: Record<number, Partial<VoiceEuclid>> = {
  36: { hits: 4, steps: 16 },
  38: { hits: 3, steps: 16 },
  42: { hits: 8, steps: 16 },
  46: { hits: 2, steps: 16 },
  50: { hits: 5, steps: 16 },
  49: { hits: 1, steps: 16 },
};

export function EuclideanEditor({ accent, device, patternLength, command, onActiveChange }: Props) {
  const [voices, setVoices] = useState<Record<number, VoiceEuclid>>(() =>
    Object.fromEntries(DRUM_VOICES.map(v => [
      v.note,
      { ...DEFAULT_VOICE, ...VOICE_DEFAULTS[v.note], steps: patternLength },
    ]))
  );
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState(false);
  const applyTimer = useRef<number>(0);

  const anyEnabled = DRUM_VOICES.some(dv => voices[dv.note].enabled);

  // Apply all Euclidean patterns as a batch
  const applyPatterns = useCallback(() => {
    const numSteps = patternLength;
    for (let step = 0; step < numSteps; step++) {
      const hits: DrumHit[] = [];
      for (const { note } of DRUM_VOICES) {
        const v = voices[note];
        if (!v.enabled) continue;
        const pattern = euclidean(v.hits, v.steps, v.rotation);
        const eucIdx = step % v.steps;
        if (pattern[eucIdx]) {
          hits.push({ note, vel: v.velocity });
        }
      }
      command({ type: "edit_drum_step", device, step, hits });
    }
  }, [voices, patternLength, device, command]);

  // Re-apply when voices change, debounced
  useEffect(() => {
    if (!anyEnabled) {
      if (active) {
        command({ type: "discard_edit", device });
        setActive(false);
        onActiveChange?.(false);
      }
      return;
    }
    setActive(true);
    onActiveChange?.(true);
    // Debounce to avoid flooding during slider drags
    window.clearTimeout(applyTimer.current);
    applyTimer.current = window.setTimeout(() => applyPatterns(), 50);
    return () => window.clearTimeout(applyTimer.current);
  }, [voices, anyEnabled]);

  const updateVoice = (note: number, params: Partial<VoiceEuclid>) => {
    setVoices(prev => ({ ...prev, [note]: { ...prev[note], ...params } }));
  };

  const enableAll = () => {
    setVoices(prev => {
      const next = { ...prev };
      for (const { note } of DRUM_VOICES) next[note] = { ...next[note], enabled: true };
      return next;
    });
  };

  const disableAll = () => {
    setVoices(prev => {
      const next = { ...prev };
      for (const { note } of DRUM_VOICES) next[note] = { ...next[note], enabled: false };
      return next;
    });
  };

  // Paste: bake Euclidean pattern into the drum grid, then turn off Euclidean
  const pasteToGrid = () => {
    if (!anyEnabled) return;
    // Write pattern to edit buffer (same as applyPatterns but persists)
    const numSteps = patternLength;
    for (let step = 0; step < numSteps; step++) {
      const hits: DrumHit[] = [];
      for (const { note } of DRUM_VOICES) {
        const v = voices[note];
        if (!v.enabled) continue;
        const pattern = euclidean(v.hits, v.steps, v.rotation);
        const eucIdx = step % v.steps;
        if (pattern[eucIdx]) {
          hits.push({ note, vel: v.velocity });
        }
      }
      command({ type: "edit_drum_step", device, step, hits });
    }
    // Disable Euclidean — pattern stays in edit buffer
    setVoices(prev => {
      const next = { ...prev };
      for (const { note } of DRUM_VOICES) next[note] = { ...next[note], enabled: false };
      return next;
    });
    setActive(false);
    onActiveChange?.(false);
  };

  const [open, setOpen] = useState(false);

  return (
    <div className={`euclid-editor ${active ? "euclid-active" : ""}`} style={active ? { borderColor: accent } : undefined}>
      <button className="collapsible-header" onClick={() => setOpen(!open)}>
        <span className="drum-kit-label" style={{ color: accent }}>
          euclidean {active && <span className="euclid-badge">ACTIVE</span>}
        </span>
        <span className="collapsible-arrow">{open ? "▼" : "▶"}</span>
      </button>

      {open && <>
      <div className="euclid-hint">hits = how many &nbsp;·&nbsp; steps = over how many</div>
      <div className="euclid-actions" style={{ marginBottom: 6 }}>
          <button
            className={`synth-osc-btn ${anyEnabled ? "active" : ""}`}
            title="Enable all voices"
            onClick={enableAll}
            style={anyEnabled ? { fontSize: 9, background: accent, color: "#000" } : { fontSize: 9 }}
          >ENABLE ALL</button>
          {anyEnabled && (
            <button
              className="synth-osc-btn"
              title="Copy Euclidean pattern to drum grid and turn off"
              onClick={pasteToGrid}
              style={{ fontSize: 9, background: accent, color: "#000" }}
            >PASTE TO GRID</button>
          )}
          <button className="synth-osc-btn" title="Disable all voices" onClick={disableAll} style={{ fontSize: 9 }}>DISABLE ALL</button>
          <button
            className="synth-osc-btn"
            title={expanded ? "Collapse" : "Expand"}
            onClick={() => setExpanded(!expanded)}
            style={{ fontSize: 9 }}
          >
            {expanded ? "▲" : "▼"}
          </button>
        </div>

      <div className="euclid-grid" style={{ gridTemplateColumns: expanded ? "28px 24px 1fr 1fr 36px 1fr 1fr auto" : "28px 24px 1fr 1fr 36px auto" }}>
        <div className="euclid-hdr" />
        <div className="euclid-hdr">ON</div>
        <div className="euclid-hdr">HITS</div>
        <div className="euclid-hdr">STEPS</div>
        <div className="euclid-hdr" />
        {expanded && <div className="euclid-hdr">ROT</div>}
        {expanded && <div className="euclid-hdr">VEL</div>}
        <div className="euclid-hdr">PATTERN</div>

        {DRUM_VOICES.map(({ note, name }) => {
          const v = voices[note];
          const pattern = v.enabled ? euclidean(v.hits, v.steps, v.rotation) : [];
          return [
            <div key={`n${note}`} className="euclid-name" style={{ color: accent }}>{name}</div>,
            <button
              key={`e${note}`}
              className={`euclid-toggle ${v.enabled ? "on" : ""}`}
              title={`Toggle ${name}`}
              style={v.enabled ? { background: accent, color: "#000" } : undefined}
              onClick={() => updateVoice(note, { enabled: !v.enabled })}
            />,
            <input
              key={`h${note}`}
              type="range"
              className="euclid-slider"
              min={0}
              max={v.steps}
              value={v.hits}
              disabled={!v.enabled}
              title={`Hits: ${v.hits}`}
              onChange={(e) => updateVoice(note, { hits: parseInt(e.target.value) })}
            />,
            <input
              key={`s${note}`}
              type="range"
              className="euclid-slider"
              min={2}
              max={32}
              value={v.steps}
              disabled={!v.enabled}
              title={`Steps: ${v.steps}`}
              onChange={(e) => updateVoice(note, { steps: parseInt(e.target.value) })}
            />,
            <div key={`f${note}`} className="euclid-fraction" style={!v.enabled ? { opacity: 0.3 } : undefined}>
              {v.hits}/{v.steps}
            </div>,
            expanded && (
              <input
                key={`r${note}`}
                type="range"
                className="euclid-slider"
                min={0}
                max={v.steps - 1}
                value={v.rotation}
                disabled={!v.enabled}
                title={`Rotation: ${v.rotation}`}
                onChange={(e) => updateVoice(note, { rotation: parseInt(e.target.value) })}
              />
            ),
            expanded && (
              <input
                key={`v${note}`}
                type="range"
                className="euclid-slider"
                min={40}
                max={127}
                value={v.velocity}
                disabled={!v.enabled}
                title={`Velocity: ${v.velocity}`}
                onChange={(e) => updateVoice(note, { velocity: parseInt(e.target.value) })}
              />
            ),
            <div key={`p${note}`} className="euclid-viz">
              {v.enabled && pattern.map((hit, i) => (
                <div
                  key={i}
                  className={`euclid-dot ${hit ? "hit" : ""}`}
                  style={hit ? { background: accent } : undefined}
                />
              ))}
            </div>,
          ];
        })}
      </div>
      </>}
    </div>
  );
}
