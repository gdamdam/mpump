import { useRef, useCallback } from "react";
import type { ClientMessage } from "../types";

interface Props {
  bpm: number;
  command: (msg: ClientMessage) => void;
}

export function BpmControl({ bpm, command }: Props) {
  const intervalRef = useRef<number>(0);

  const adjust = useCallback(
    (delta: number) => command({ type: "set_bpm", bpm: bpm + delta }),
    [bpm, command],
  );

  const startHold = useCallback(
    (delta: number) => {
      adjust(delta);
      intervalRef.current = window.setInterval(() => adjust(delta), 150);
    },
    [adjust],
  );

  const stopHold = useCallback(() => {
    clearInterval(intervalRef.current);
  }, []);

  return (
    <div className="bpm-control">
      <button
        className="bpm-btn"
        onPointerDown={() => startHold(-1)}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
      >
        -
      </button>
      <div className="bpm-display">
        <span className="bpm-value">{bpm}</span>
        <span className="bpm-label">BPM</span>
      </div>
      <button
        className="bpm-btn"
        onPointerDown={() => startHold(1)}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
      >
        +
      </button>
    </div>
  );
}
