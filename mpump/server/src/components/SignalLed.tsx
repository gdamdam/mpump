import { useRef, useEffect } from "react";

export function SignalLed({ getAnalyser }: { getAnalyser: () => AnalyserNode | null }) {
  const dotRef = useRef<HTMLSpanElement>(null);
  const rafRef = useRef<number>(0);
  const levelRef = useRef(0);
  // Keep a stable ref so the RAF loop always calls the latest getter
  // without restarting when the inline prop function changes reference.
  const getAnalyserRef = useRef(getAnalyser);
  getAnalyserRef.current = getAnalyser;

  useEffect(() => {
    const buf = new Uint8Array(256);
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
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
