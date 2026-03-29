import { useRef, useCallback } from "react";
import type { ClientMessage } from "../types";

const MIN_BPM = 20;
const MAX_BPM = 300;

interface Props {
  bpm: number;
  command: (msg: ClientMessage) => void;
}

export function BpmControl({ bpm, command }: Props) {
  const timerRef = useRef<number>(0);
  const holdCount = useRef(0);
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;

  const step = useCallback(
    (delta: number) => {
      holdCount.current++;
      // After 15 ticks (~3s), step by 5
      const size = holdCount.current > 15 ? 5 * Math.sign(delta) : delta;
      const next = Math.max(MIN_BPM, Math.min(MAX_BPM, bpmRef.current + size));
      if (next !== bpmRef.current) command({ type: "set_bpm", bpm: next });
    },
    [command],
  );

  const startHold = useCallback(
    (delta: number) => {
      holdCount.current = 0;
      step(delta);
      // Start at 200ms, accelerate to 60ms
      let delay = 200;
      const tick = () => {
        step(delta);
        delay = Math.max(60, delay - 8);
        timerRef.current = window.setTimeout(tick, delay);
      };
      timerRef.current = window.setTimeout(tick, delay);
    },
    [step],
  );

  const stopHold = useCallback(() => {
    clearTimeout(timerRef.current);
    holdCount.current = 0;
  }, []);

  return (
    <div className="bpm-control">
      <div className="bpm-arrows">
        <button
          className="bpm-arrow"
          title="Increase BPM"
          onPointerDown={() => startHold(1)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
        >
          ▲
        </button>
        <button
          className="bpm-arrow"
          title="Decrease BPM"
          onPointerDown={() => startHold(-1)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
        >
          ▼
        </button>
      </div>
      <div className="bpm-display">
        <span className="bpm-value">{bpm}</span>
        <span className="bpm-label">BPM</span>
      </div>
    </div>
  );
}
