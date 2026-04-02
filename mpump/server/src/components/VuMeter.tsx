import { useRef, useEffect, useState, useCallback } from "react";

interface Props {
  getAnalyser: () => AnalyserNode | null;
}

type VuStyle = "accent" | "classic" | "spectrum";
const STYLES: VuStyle[] = ["accent", "classic", "spectrum"];
const STYLE_LABELS: Record<VuStyle, string> = { accent: "Accent", classic: "Classic", spectrum: "Spectrum" };

export function VuMeter({ getAnalyser }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const [style, setStyle] = useState<VuStyle>("accent");
  const [hover, setHover] = useState(false);
  const hoverTimer = useRef<number>(0);
  const peakRef = useRef(0);
  const rmsRef = useRef(0);
  const peakFreqRef = useRef(0);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const tt = tooltipRef.current;
    if (!tt) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    tt.style.left = `${e.clientX - rect.left}px`;
  }, []);

  const cycleStyle = () => {
    setStyle(prev => STYLES[(STYLES.indexOf(prev) + 1) % STYLES.length]);
  };

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

    let freqBuf: Uint8Array | null = null;
    let frameSkip = 0;
    const BARS = 24;
    const smoothed = new Float32Array(BARS); // smoothed bar values for decay
    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      if (++frameSkip % 2 !== 0) return; // ~30fps
      const analyser = getAnalyser();
      if (!analyser) return;

      if (!freqBuf || freqBuf.length !== analyser.frequencyBinCount) freqBuf = new Uint8Array(analyser.frequencyBinCount);
      const freqData = freqBuf;
      analyser.getByteFrequencyData(freqData);

      let peak = 0, sumSq = 0, peakBin = 0, peakBinVal = 0;
      for (let i = 0; i < freqData.length; i++) {
        const v = freqData[i] / 255;
        if (v > peak) peak = v;
        sumSq += v * v;
        if (freqData[i] > peakBinVal) { peakBinVal = freqData[i]; peakBin = i; }
      }
      peakRef.current = peak;
      rmsRef.current = Math.sqrt(sumSq / freqData.length);
      peakFreqRef.current = (peakBin * analyser.context.sampleRate) / analyser.fftSize;

      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);

      const accent = getComputedStyle(document.documentElement).getPropertyValue("--preview").trim() || "#b388ff";

      if (style === "spectrum") {
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const sliceW = w / freqData.length;
        for (let i = 0; i < freqData.length; i++) {
          const val = freqData[i] / 255;
          const y = h - val * h;
          if (i === 0) ctx.moveTo(0, y);
          else ctx.lineTo(i * sliceW, y);
        }
        ctx.stroke();
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.1;
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        const barW = Math.floor(w / BARS) - 1;
        const step = Math.floor(freqData.length / BARS);

        for (let i = 0; i < BARS; i++) {
          let sum = 0;
          for (let j = 0; j < step; j++) sum += freqData[i * step + j];
          const raw = sum / step / 255;
          // Smooth: rise instant, fall fast — snappy and responsive
          smoothed[i] = raw > smoothed[i] ? raw : raw * 0.4 + smoothed[i] * 0.6;
          const val = smoothed[i];
          const barH = val * h;

          if (style === "classic") {
            const pct = val;
            let r: number, g: number;
            if (pct < 0.5) { r = Math.round(pct * 2 * 255); g = 255; }
            else { r = 255; g = Math.round((1 - (pct - 0.5) * 2) * 255); }
            ctx.fillStyle = `rgb(${r},${g},0)`;
          } else {
            ctx.fillStyle = accent;
            ctx.globalAlpha = 0.3 + val * 0.7;
          }

          ctx.fillRect(i * (barW + 1), h - barH, barW, barH);
          ctx.globalAlpha = 1;
        }
      }
    };

    draw();
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, [getAnalyser, style]);

  const peakDb = peakRef.current > 0 ? (20 * Math.log10(peakRef.current)).toFixed(1) : "-\u221E";
  const rmsDb = rmsRef.current > 0 ? (20 * Math.log10(rmsRef.current)).toFixed(1) : "-\u221E";
  const freqLabel = peakFreqRef.current >= 1000
    ? `${(peakFreqRef.current / 1000).toFixed(1)}kHz`
    : `${Math.round(peakFreqRef.current)}Hz`;

  return (
    <div
      className="vu-meter-wrap"
      onMouseEnter={() => {
        clearTimeout(hoverTimer.current);
        hoverTimer.current = window.setTimeout(() => setHover(true), 3000);
      }}
      onMouseLeave={() => {
        clearTimeout(hoverTimer.current);
        setHover(false);
      }}
      onMouseMove={onMouseMove}
    >
      <canvas ref={canvasRef} className="vu-meter" onClick={cycleStyle} />
      {hover && (
        <div ref={tooltipRef} className="vu-tooltip">
          <span>Peak <b>{peakDb} dB</b></span>
          <span>RMS <b>{rmsDb} dB</b></span>
          <span>Freq <b>{freqLabel}</b></span>
          <span className="vu-tooltip-hint">{STYLE_LABELS[style]} · click to cycle</span>
        </div>
      )}
    </div>
  );
}

/** CLIP LED — lights red when output is clipping, holds for 1s. */
export function ClipIndicator({ getAnalyser }: Props) {
  const [clipping, setClipping] = useState(false);
  const rafRef = useRef<number>(0);
  const bufRef = useRef<Uint8Array | null>(null);
  const frameSkip = useRef(0);
  const lastClipTime = useRef(0);

  useEffect(() => {
    const HOLD_MS = 1000;
    const check = () => {
      rafRef.current = requestAnimationFrame(check);
      if (++frameSkip.current % 6 !== 0) return; // ~10fps
      const analyser = getAnalyser();
      if (!analyser) { setClipping(false); return; }

      // Use time-domain data to detect actual waveform clipping (samples at digital rail)
      const size = analyser.fftSize;
      if (!bufRef.current || bufRef.current.length !== size)
        bufRef.current = new Uint8Array(size);
      analyser.getByteTimeDomainData(bufRef.current);
      let hasSignal = false;
      let clipCount = 0;
      for (let i = 0; i < size; i++) {
        const s = bufRef.current[i];
        if (s < 100 || s > 156) hasSignal = true;
        if (s === 0 || s === 255) clipCount++;
      }

      const now = performance.now();
      if (hasSignal && clipCount >= 3) lastClipTime.current = now;
      // LED on while within hold window, off otherwise
      setClipping(now - lastClipTime.current < HOLD_MS && lastClipTime.current > 0);
    };
    check();
    return () => cancelAnimationFrame(rafRef.current);
  }, [getAnalyser]);

  return (
    <div className={`clip-led ${clipping ? "clip-active" : ""}`} title="Clipping indicator">
      CLIP
    </div>
  );
}
