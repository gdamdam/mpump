/**
 * useGestureRecorder — records and plays back XY pad gestures (finger/mouse
 * movements over the effects pad) as part of the session. Gestures are stored
 * as timestamped (x, y) points relative to recording start.
 *
 * Pause/resume handling: when the sequencer pauses, the gesture timeline freezes
 * by tracking the wall-clock moment of pause. On resume, loopStart is shifted
 * forward by the paused duration so the gesture stays in sync with the sequencer.
 */
import { useState, useRef, useEffect } from "react";
import { getJSON, setJSON, setItem } from "../utils/storage";

interface TouchPoint { x: number; y: number; age: number }

interface UseGestureRecorderParams {
  allPaused: boolean;
  allPausedRef: React.MutableRefObject<boolean>;
  applyXYRef: React.MutableRefObject<(x: number, y: number) => void>;
  posRef: React.MutableRefObject<{ x: number; y: number } | null>;
  trailsRef: React.MutableRefObject<TouchPoint[]>;
  setPos: (pos: { x: number; y: number } | null) => void;
  setTrails: (trails: TouchPoint[]) => void;
}

export function useGestureRecorder({
  allPaused,
  allPausedRef,
  applyXYRef,
  posRef,
  trailsRef,
  setPos,
  setTrails,
}: UseGestureRecorderParams) {
  const [gestureRec, setGestureRec] = useState(false);
  const [gestureLoop, setGestureLoop] = useState(false);
  const gesturePoints = useRef<{ t: number; x: number; y: number }[]>([]);
  const gestureStart = useRef(0);
  const gestureRaf = useRef(0);
  const gestureLoopStart = useRef(0);
  const gesturePausedAt = useRef<number | null>(null); // wall-clock time when paused, null = not paused

  // Restore gesture from localStorage on mount
  useEffect(() => {
    const saved = getJSON<{ t: number; x: number; y: number }[]>("mpump-gesture", []);
    if (saved.length > 0) gesturePoints.current = saved;
  }, []);

  // Stop recording if all music stops
  useEffect(() => {
    if (gestureRec && allPaused) {
      setGestureRec(false);
      setJSON("mpump-gesture", gesturePoints.current);
    }
  }, [allPaused, gestureRec]);

  // Gesture recording controls
  const startGestureRec = () => {
    gesturePoints.current = [];
    gestureStart.current = 0; // will be set on first pad touch
    setGestureRec(true);
    setGestureLoop(false);
    cancelAnimationFrame(gestureRaf.current);
  };

  const stopGestureRec = () => {
    setGestureRec(false);
    setJSON("mpump-gesture", gesturePoints.current);
  };

  const startGestureLoop = () => {
    if (gesturePoints.current.length < 2) return;
    setGestureLoop(true);
    gesturePausedAt.current = null;
    const points = gesturePoints.current;
    const duration = points[points.length - 1].t;
    gestureLoopStart.current = performance.now();

    const tick = () => {
      const now = performance.now();

      // Handle pause: when all devices are paused, freeze the timeline
      if (allPausedRef.current) {
        if (gesturePausedAt.current === null) {
          gesturePausedAt.current = now; // mark when we paused
        }
        gestureRaf.current = requestAnimationFrame(tick);
        return; // skip applying — dot stays frozen
      }

      // Handle resume: shift loopStart forward by the time spent paused
      // so elapsed time doesn't jump — the gesture continues where it left off
      if (gesturePausedAt.current !== null) {
        gestureLoopStart.current += now - gesturePausedAt.current;
        gesturePausedAt.current = null;
      }

      const elapsed = (now - gestureLoopStart.current) % duration;
      // Binary-ish scan: find the last point whose timestamp <= elapsed
      let i = 0;
      while (i < points.length - 1 && points[i + 1].t < elapsed) i++;
      const p = points[i];
      setPos({ x: p.x, y: p.y });
      posRef.current = { x: p.x, y: p.y };
      const gt = [...trailsRef.current.slice(-20), { x: p.x, y: p.y, age: Date.now() }];
      trailsRef.current = gt;
      setTrails(gt);
      applyXYRef.current(p.x, p.y);
      gestureRaf.current = requestAnimationFrame(tick);
    };
    gestureRaf.current = requestAnimationFrame(tick);
  };

  const stopGestureLoop = () => {
    setGestureLoop(false);
    gesturePausedAt.current = null;
    cancelAnimationFrame(gestureRaf.current);
  };

  const clearGesture = () => {
    gesturePoints.current = [];
    setGestureRec(false);
    setGestureLoop(false);
    cancelAnimationFrame(gestureRaf.current);
    setItem("mpump-gesture", "");
  };

  return {
    gestureRec,
    gestureLoop,
    gesturePoints,
    gestureStart,
    startGestureRec,
    stopGestureRec,
    startGestureLoop,
    stopGestureLoop,
    clearGesture,
  };
}
