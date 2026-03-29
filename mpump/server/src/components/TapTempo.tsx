import { useRef, useState } from "react";
import type { ClientMessage } from "../types";

interface Props {
  command: (msg: ClientMessage) => void;
}

/**
 * Tap tempo button. Averages last 4 tap intervals to compute BPM.
 * Visual flash on tap for feedback.
 */
export function TapTempo({ command }: Props) {
  const taps = useRef<number[]>([]);
  const commandRef = useRef(command);
  commandRef.current = command;
  const [flash, setFlash] = useState(false);

  const handleTap = () => {
    const now = performance.now();

    // Visual feedback
    setFlash(true);
    setTimeout(() => setFlash(false), 100);

    // Reset if gap > 2 seconds
    if (taps.current.length > 0 && now - taps.current[taps.current.length - 1] > 2000) {
      taps.current = [];
    }

    taps.current.push(now);

    // Keep last 5 taps (4 intervals)
    if (taps.current.length > 5) taps.current.shift();

    // Need at least 2 taps for an interval
    if (taps.current.length < 2) return;

    // Average intervals
    let sum = 0;
    for (let i = 1; i < taps.current.length; i++) {
      sum += taps.current[i] - taps.current[i - 1];
    }
    const avgMs = sum / (taps.current.length - 1);
    const bpm = Math.round(60000 / avgMs);
    if (bpm >= 20 && bpm <= 300) {
      commandRef.current({ type: "set_bpm", bpm });
    }
  };

  return (
    <button
      className={`tap-tempo-btn ${flash ? "tap-flash" : ""}`}
      onClick={handleTap}
      title="Tap repeatedly to set tempo"
    >
      ♩ TAP
    </button>
  );
}
