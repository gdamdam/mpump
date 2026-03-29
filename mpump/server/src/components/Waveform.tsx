import { useRef, useEffect, useCallback } from "react";
import { getBool } from "../utils/storage";
import type { ClientMessage } from "../types";

interface Props {
  getAnalyser: () => AnalyserNode | null;
  command?: (msg: ClientMessage) => void;
}

/**
 * Oscilloscope waveform display. Draws time-domain data.
 * When "waveform tap tempo" is enabled in settings, clicking the waveform acts as tap tempo.
 */
export function Waveform({ getAnalyser, command }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const tapTimes = useRef<number[]>([]);

  const handleTap = useCallback(() => {
    if (!command || !getBool("mpump-wave-tap")) return;
    const now = performance.now();
    tapTimes.current.push(now);
    // Keep last 5 taps within 3 seconds
    tapTimes.current = tapTimes.current.filter(t => now - t < 3000).slice(-5);
    if (tapTimes.current.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < tapTimes.current.length; i++) {
        intervals.push(tapTimes.current[i] - tapTimes.current[i - 1]);
      }
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const bpm = Math.round(60000 / avg);
      if (bpm >= 20 && bpm <= 300) {
        command({ type: "set_bpm", bpm });
      }
    }
  }, [command]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const analyser = getAnalyser();
      if (!analyser) return;

      const data = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(data);

      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);

      const accent = getComputedStyle(document.documentElement).getPropertyValue("--preview").trim() || "#b388ff";

      // Center line
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.15;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Waveform
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const sliceW = w / data.length;
      for (let i = 0; i < data.length; i++) {
        const v = data[i] / 128.0;
        const y = (v * h) / 2;
        if (i === 0) ctx.moveTo(0, y);
        else ctx.lineTo(i * sliceW, y);
      }
      ctx.stroke();
    };

    draw();
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, [getAnalyser]);

  return (
    <canvas
      ref={canvasRef}
      className={`waveform ${getBool("mpump-wave-tap") ? "waveform-tappable" : ""}`}
      onClick={handleTap}
      title={getBool("mpump-wave-tap") ? "Tap for tempo" : undefined}
    />
  );
}
