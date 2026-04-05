import { useRef, useEffect } from "react";

const IS_LITE = new URLSearchParams(window.location.search).get("lite") === "true" || new URLSearchParams(window.location.search).get("eco") === "true" || localStorage.getItem("mpump-perf-mode") === "lite" || localStorage.getItem("mpump-perf-mode") === "eco";

export function SignalLed({ getAnalyser }: { getAnalyser: () => AnalyserNode | null }) {
  const dotRef = useRef<HTMLSpanElement>(null);
  const rafRef = useRef<number>(0);
  const levelRef = useRef(0);
  const getAnalyserRef = useRef(getAnalyser);
  getAnalyserRef.current = getAnalyser;

  useEffect(() => {
    if (IS_LITE) return; // no analyser polling in lite/eco/mobile
    const buf = new Uint8Array(256);
    let skip = 0;
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      if (++skip % 4 !== 0) return; // ~15fps
      const analyser = getAnalyserRef.current();
      if (!analyser || !dotRef.current) return;
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const s = (buf[i] - 128) / 128;
        sum += s * s;
      }
      const rms = Math.sqrt(sum / buf.length);
      const target = Math.min(1, rms * 10);
      const prev = levelRef.current;
      levelRef.current = target > prev ? prev + (target - prev) * 0.4 : prev + (target - prev) * 0.07;
      const l = levelRef.current;
      dotRef.current.style.opacity = String(0.15 + l * 0.85);
      dotRef.current.style.boxShadow = l > 0.08
        ? `0 0 ${2 + l * 6}px rgba(0,255,100,${l * 0.9})`
        : "none";
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return <span ref={dotRef} className="signal-led" style={{ opacity: 0.15 }} />;
}
