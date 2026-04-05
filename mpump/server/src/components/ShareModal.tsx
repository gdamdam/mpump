import { useState, useRef, useEffect, useCallback } from "react";
import QRCode from "qrcode";
import { decodeSteps, decodeDrumSteps, decodeGesture } from "../utils/patternCodec";
import { decodeSharePayload } from "../utils/shareCodec";

import type { StepData, DrumHit } from "../types";
import { trackEvent } from "../utils/metrics";

interface Props {
  url: string;
  longUrl?: string | null;
  parentId?: string | null;
  qrUrl?: string | null;
  gestureNote?: boolean;
  getAnalyser?: () => AnalyserNode | null;
  currentStep?: number;
  hideActions?: boolean;
  onOpen?: () => void;
  onClose: () => void;
}

export function ShareModal({ url, longUrl, parentId, qrUrl, gestureNote, getAnalyser, currentStep = -1, hideActions, onOpen, onClose }: Props) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  // Auto-play music when share modal opens
  useEffect(() => { if (onOpen) onOpen(); trackEvent("share-create"); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showLongUrl, setShowLongUrl] = useState(false);
  const isShortened = longUrl && url !== longUrl;
  const spectrumBars = false; // BPM-colored VU bars
  const inputRef = useRef<HTMLInputElement>(null);
  const cardCanvasRef = useRef<HTMLCanvasElement>(null);
  const staticCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef(0);
  const [showInfo, setShowInfo] = useState(false);

  const copyToClipboard = () => {
    const textToCopy = showLongUrl && longUrl ? longUrl : url;
    const copyText = () => {
      const ta = document.createElement("textarea");
      ta.value = textToCopy;
      ta.style.cssText = "position:fixed;left:-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(textToCopy).catch(copyText);
    } else {
      copyText();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  // Decode payload for metadata display + visualization data
  const decodePayload = useCallback(() => {
    try {
      const u = new URL(url);
      const hash = (u.searchParams.get("z") || u.searchParams.get("b") || "").replace(/ /g, "+")
        || url.split("#")[1]
        || u.pathname.slice(1); // Worker URL: payload is the path
      if (!hash) return { bpm: "", bpmNum: 0, genre: "", fx: "", custom: false, gesture: false, swing: "", melodic: null as (StepData | null)[] | null, drums: null as DrumHit[][] | null, bass: null as (StepData | null)[] | null, gesturePoints: null as { t: number; x: number; y: number }[] | null };
      const data = decodeSharePayload(hash) as any;
      const bpmNum = data.bpm ?? 0;
      const bpm = data.bpm ? `${data.bpm} BPM` : "";
      const genreKeys = data.g ? Object.keys(data.g) : [];
      const genre = genreKeys.length > 0 ? genreKeys.map((k: string) => k.replace("preview_", "")).join(" · ") : "";
      const fxNames = ["COMP", "HPF", "DIST", "CRUSH", "CHORUS", "PHASER", "DELAY", "REVERB"];
      const fx = data.fx
        ? data.fx.split("").map((b: string, i: number) => b === "1" ? fxNames[i] : null).filter(Boolean).join(" · ")
        : "";
      const custom = !!(data.me || data.de || data.be);
      const gesture = !!data.gs;
      const swing = data.sw != null ? `SW ${Math.round(data.sw * 100)}%` : "";
      // Raw data for visualization
      const melodic = data.me ? decodeSteps(data.me) : null;
      const drums = data.de ? decodeDrumSteps(data.de) : null;
      const bass = data.be ? decodeSteps(data.be) : null;
      const gesturePoints = data.gs ? decodeGesture(data.gs) : null;
      const trackName = data.tn || "";
      return { bpm, bpmNum, genre, fx, custom, gesture, swing, melodic, drums, bass, gesturePoints, trackName };
    } catch { return { bpm: "", bpmNum: 0, genre: "", fx: "", custom: false, gesture: false, swing: "", melodic: null, drums: null, bass: null, gesturePoints: null, trackName: "" }; }
  }, [url]);

  // Draw the full album-art card on canvas
  const drawCard = useCallback(async () => {
    const canvas = cardCanvasRef.current;
    if (!canvas) return;

    const S = 2; // render at 2x for retina/mobile sharpness
    const W = 400;
    const H = 400; // 1:1 square
    canvas.width = W * S;
    canvas.height = H * S;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(S, S);

    const bg = "#0d1117";
    const fg = "#e6edf3";
    const accent = "#66ff99";
    const dim = "#7d8590";
    const mono = '"SF Mono", "Menlo", "Consolas", monospace';

    // ── Background ─────────────────────────────────────────────────────
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.25;
    ctx.strokeRect(0, 0, W, H);
    ctx.globalAlpha = 1;

    // "DROP THIS BEAT" title — large, spaced, BPM-colored in bpm mode
    const meta = decodePayload();
    const titleBpmT = Math.max(0, Math.min(1, ((meta.bpmNum || 120) - 90) / 70));
    const titleHue = 210 - titleBpmT * 210;
    ctx.fillStyle = `hsl(${titleHue}, 100%, 70%)`;
    ctx.font = `bold 18px ${mono}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const title = meta.trackName ? meta.trackName.toUpperCase() : "DROP THIS BEAT";
    const spacing = 4;
    const chars = title.split("");
    const charWidths = chars.map((c: string) => ctx.measureText(c).width);
    const totalTW = charWidths.reduce((a: number, b: number) => a + b, 0) + spacing * (chars.length - 1);
    let tx = W / 2 - totalTW / 2;
    for (let i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], tx, 10);
      tx += charWidths[i] + spacing;
    }

    // ── Pattern Grid Visualization ──────────────────────────────────
    const pad = 12;
    const gridY = 38;

    // Build grid rows from payload data
    const gridRows: { label: string; cells: { active: boolean; vel: number; note?: number }[] }[] = [];

    // Drums: each step has multiple hits — extract unique instrument rows
    if (meta.drums && meta.drums.length > 0) {
      const drumNotes = new Set<number>();
      for (const step of meta.drums) for (const hit of step) drumNotes.add(hit.note);
      const sortedNotes = [...drumNotes].sort((a, b) => b - a); // high to low
      for (const note of sortedNotes.slice(0, 8)) { // max 8 drum rows
        gridRows.push({
          label: "D",
          cells: meta.drums.map(step => {
            const hit = step.find(h => h.note === note);
            return { active: !!hit, vel: hit?.vel ?? 0, note };
          }),
        });
      }
    }

    // Synth melodic
    if (meta.melodic && meta.melodic.length > 0) {
      // Map semitone offsets to row positions (higher pitch = higher row)
      const semiValues = meta.melodic.filter((s): s is StepData => s !== null).map(s => s.semi);
      const minSemi = Math.min(...semiValues, 0);
      const maxSemi = Math.max(...semiValues, 12);
      const range = Math.max(maxSemi - minSemi, 1);
      const numRows = Math.min(Math.max(range, 4), 8);
      for (let r = numRows - 1; r >= 0; r--) {
        const rowSemiLow = minSemi + (r / numRows) * range;
        const rowSemiHigh = minSemi + ((r + 1) / numRows) * range;
        gridRows.push({
          label: "S",
          cells: meta.melodic.map(step => {
            if (!step) return { active: false, vel: 0 };
            const inRow = step.semi >= rowSemiLow && step.semi < rowSemiHigh;
            return { active: inRow, vel: inRow ? step.vel : 0 };
          }),
        });
      }
    }

    // Bass
    if (meta.bass && meta.bass.length > 0) {
      const bassSemis = meta.bass.filter((s): s is StepData => s !== null).map(s => s.semi);
      const minB = Math.min(...bassSemis, 0);
      const maxB = Math.max(...bassSemis, 12);
      const rangeB = Math.max(maxB - minB, 1);
      const numRowsB = Math.min(Math.max(rangeB, 3), 6);
      for (let r = numRowsB - 1; r >= 0; r--) {
        const rowLow = minB + (r / numRowsB) * rangeB;
        const rowHigh = minB + ((r + 1) / numRowsB) * rangeB;
        gridRows.push({
          label: "B",
          cells: meta.bass.map(step => {
            if (!step) return { active: false, vel: 0 };
            const inRow = step.semi >= rowLow && step.semi < rowHigh;
            return { active: inRow, vel: inRow ? step.vel : 0 };
          }),
        });
      }
    }

    // Fallback: generate a placeholder pattern if no data
    if (gridRows.length === 0) {
      for (let r = 0; r < 8; r++) {
        gridRows.push({
          label: r < 4 ? "D" : "S",
          cells: Array.from({ length: 16 }, (_, i) => ({
            active: ((i + r * 3) % 5 === 0) || ((i + r) % 7 === 0),
            vel: 60 + Math.floor(Math.random() * 60),
          })),
        });
      }
    }

    // Draw grid
    const gridW = W - pad * 2;
    const maxGridH = H * 0.55; // ~55% of card for pattern grid
    const numCols = Math.max(...gridRows.map(r => r.cells.length), 16);
    const numRows = gridRows.length;
    const cellW = gridW / numCols;
    const cellH = Math.min(maxGridH / numRows, cellW * 1.2); // keep cells roughly square-ish
    const actualGridH = cellH * numRows;
    const gap = 1; // 1px gap between cells

    for (let r = 0; r < numRows; r++) {
      const row = gridRows[r];
      for (let c = 0; c < numCols; c++) {
        const cell = row.cells[c] || { active: false, vel: 0 };
        const cx = pad + c * cellW;
        const cy = gridY + r * cellH;

        if (cell.active) {
          const velNorm = cell.vel / 127;
          // BPM-colored grid with per-section offset
          const bpmT = Math.max(0, Math.min(1, ((meta.bpmNum || 120) - 90) / 70));
          const bpmHue = 210 - bpmT * 210;
          const hueShift = bpmHue + (row.label === "D" ? -15 : row.label === "S" ? 0 : 15);
          ctx.fillStyle = `hsla(${hueShift}, 100%, ${50 + velNorm * 25}%, ${0.4 + velNorm * 0.6})`;
          ctx.fillRect(cx + gap, cy + gap, cellW - gap * 2, cellH - gap * 2);
          // Brighter center dot for high velocity
          if (velNorm > 0.5) {
            ctx.fillStyle = `hsla(${hueShift}, 100%, 85%, ${velNorm * 0.5})`;
            const dotR = Math.min(cellW, cellH) * 0.15 * velNorm;
            ctx.beginPath();
            ctx.arc(cx + cellW / 2, cy + cellH / 2, dotR, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          // Empty cell: subtle grid
          ctx.fillStyle = "rgba(102, 255, 153, 0.04)";
          ctx.fillRect(cx + gap, cy + gap, cellW - gap * 2, cellH - gap * 2);
        }
      }
    }

    // Section dividers (between drums/synth/bass)
    let prevLabel = gridRows[0]?.label;
    for (let r = 1; r < numRows; r++) {
      if (gridRows[r].label !== prevLabel) {
        ctx.strokeStyle = accent;
        ctx.globalAlpha = 0.2;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(pad, gridY + r * cellH);
        ctx.lineTo(pad + gridW, gridY + r * cellH);
        ctx.stroke();
        ctx.globalAlpha = 1;
        prevLabel = gridRows[r].label;
      }
    }

    // ── BPM below grid ────────────────────────────────────────────
    let metaY = gridY + actualGridH + 12;

    ctx.textBaseline = "top";
    ctx.textAlign = "center";
    if (meta.bpm) {
      const bpm = meta.bpmNum || 120;
      const bpmHue = 210 - Math.max(0, Math.min(1, (bpm - 90) / 70)) * 210;
      const bpmColor = `hsl(${bpmHue}, 100%, 70%)`;
      ctx.fillStyle = bpmColor;
      ctx.font = `bold 24px ${mono}`;
      ctx.shadowColor = bpmColor;
      ctx.shadowBlur = 10;
      ctx.fillText(meta.bpm, W / 2, metaY);
      ctx.shadowBlur = 0;
    }
    metaY += 34;

    // Thin separator
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.15;
    ctx.beginPath(); ctx.moveTo(pad, metaY); ctx.lineTo(W - pad, metaY); ctx.stroke();
    ctx.globalAlpha = 1;
    metaY += 4;

    // mpump.live footer
    ctx.fillStyle = dim;
    ctx.font = `9px ${mono}`;
    ctx.globalAlpha = 0.4;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("mpump.live", W / 2, H - 4);
    ctx.globalAlpha = 1;

    // Save grid bounds + data for QR overlay and animation
    gridBoundsRef.current = { x: pad, y: gridY, w: gridW, h: actualGridH };
    gridDataRef.current = gridRows;
    gridLayoutRef.current = { numCols, numRows, cellW, cellH, gap };

    // Save static frame for animation compositing
    const staticCanvas = document.createElement("canvas");
    staticCanvas.width = canvas.width;
    staticCanvas.height = canvas.height;
    staticCanvas.getContext("2d")?.drawImage(canvas, 0, 0);
    staticCanvasRef.current = staticCanvas;

    // Store viz bounds for animation (waveform strip between separator and footer)
    vizBoundsRef.current = { top: metaY, bottom: H - 16, left: pad, right: W - pad, W, H, bpmNum: meta.bpmNum || 120 };

  }, [url, qrUrl, decodePayload]);

  const vizBoundsRef = useRef({ top: 0, bottom: 0, left: 0, right: 0, W: 400, H: 520, bpmNum: 120 });
  const gridBoundsRef = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const gridDataRef = useRef<{ label: string; cells: { active: boolean; vel: number }[] }[]>([]);
  const gridLayoutRef = useRef({ numCols: 16, numRows: 0, cellW: 0, cellH: 0, gap: 1 });
  const currentStepRef = useRef(currentStep);
  currentStepRef.current = currentStep;
  const glowRainbow = true; // rainbow glow particles
  const particlesRef = useRef<{ x: number; y: number; vx: number; vy: number; hue: number; life: number; maxLife: number; size: number }[]>([]);

  useEffect(() => {
    // Small delay for iOS Safari — canvas may not be ready during modal mount
    const startDelay = setTimeout(() => {
    drawCard().catch(err => console.error("[ShareModal] drawCard failed:", err)).then(() => {
      if (!staticCanvasRef.current) return; // drawCard failed, nothing to animate
      // Start animation loop
      const t0 = performance.now();
      const animate = () => {
        const canvas = cardCanvasRef.current;
        const staticC = staticCanvasRef.current;
        if (!canvas || !staticC) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const { top, bottom, left, right, W, H } = vizBoundsRef.current;
        const vizH = bottom - top;
        const vizW = right - left;

        // Blit static frame
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(staticC, 0, 0);
        ctx.setTransform(2, 0, 0, 2, 0, 0);

        // ── Animated pattern grid overlay ──────────────────────────────
        const gb = gridBoundsRef.current;
        const gd = gridDataRef.current;
        const gl = gridLayoutRef.current;
        const now = performance.now();
        if (gd.length > 0 && gl.numRows > 0) {
          const { bpmNum: aBpm } = vizBoundsRef.current;
          const beatMs = 60000 / (aBpm || 120);

          // Use real sequencer step when available, fall back to time-based
          const liveStep = currentStepRef.current;
          const activeStep = liveStep >= 0
            ? liveStep % gl.numCols
            : Math.floor((now / beatMs) % gl.numCols);

          for (let r = 0; r < gl.numRows; r++) {
            const row = gd[r];
            for (let c = 0; c < gl.numCols; c++) {
              const cell = row.cells[c];
              if (!cell) continue;
              const cx = gb.x + c * gl.cellW;
              const cy = gb.y + r * gl.cellH;

              if (c === activeStep) {
                ctx.fillStyle = cell.active
                  ? "rgba(255, 255, 255, 0.7)"
                  : "rgba(102, 255, 153, 0.15)";
                ctx.fillRect(cx + gl.gap, cy + gl.gap, gl.cellW - gl.gap * 2, gl.cellH - gl.gap * 2);
                if (cell.active) {
                  ctx.shadowColor = "rgba(255, 255, 255, 0.9)";
                  ctx.shadowBlur = 8;
                  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
                  ctx.fillRect(cx + gl.gap, cy + gl.gap, gl.cellW - gl.gap * 2, gl.cellH - gl.gap * 2);
                  ctx.shadowBlur = 0;
                }
              }
            }
          }
        }

        const analyser = getAnalyser?.();

        // ── Viz color mode helpers ──────────────────────────────────────
        const { bpmNum } = vizBoundsRef.current;

        // BPM → base hue (≤90 purple 270°, smooth gradient 90–160, ≥160 red 0°)
        const bpmT = Math.max(0, Math.min(1, (bpmNum - 90) / 70));
        const bpmBaseHue = 210 - bpmT * 210; // 270° → 0°

        // Per-bar hue: rainbow or BPM-colored, toggled by spectrumBars
        const barHue = (barIndex: number, numBars: number): number => {
          if (spectrumBars) {
            return (barIndex / numBars) * 270;
          } else {
            return bpmBaseHue - 15 + (barIndex / numBars) * 30;
          }
        };

        // Global hue for waveform / particles / border
        let globalHue = spectrumBars ? 150 : bpmBaseHue;
        let bassEnergy = 0;

        if (analyser && vizH > 0 && vizW > 0) {
          const freqData = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(freqData);

          // Bass energy (first 8 bins)
          for (let i = 0; i < 8; i++) bassEnergy += freqData[i];
          bassEnergy = bassEnergy / (8 * 255);

          // Dominant frequency ratio for global hue shift
          let lowSum = 0, highSum = 0;
          const mid3 = Math.floor(freqData.length / 3);
          for (let i = 0; i < mid3; i++) lowSum += freqData[i];
          for (let i = mid3; i < freqData.length; i++) highSum += freqData[i];
          const freqRatio = highSum / (lowSum + highSum + 1);
          if (spectrumBars) globalHue = 120 + freqRatio * 40;

          const numBars = 32;
          const step = Math.floor(freqData.length / numBars);
          const barW = vizW / numBars - 1;
          const midY = top + vizH / 2;

          // ── Frequency bars ──────────────────────────────────────────
          for (let i = 0; i < numBars; i++) {
            let sum = 0;
            for (let j = 0; j < step; j++) sum += freqData[i * step + j];
            const val = sum / step / 255;
            const barH = val * vizH * 0.8;
            const bh = barHue(i, numBars);
            ctx.fillStyle = `hsl(${bh}, 100%, 70%)`;
            ctx.globalAlpha = 0.2 + val * 0.55;
            ctx.fillRect(left + i * (barW + 1), midY - barH / 2, barW, barH);

            // ── Spawn particles from bars ────────────────────────────
            if (val > 0.4 && Math.random() < val * 0.3) {
              const barCenterX = left + i * (barW + 1) + barW / 2;
              const pHue = glowRainbow ? (i / numBars) * 270 : bh;
              particlesRef.current.push({
                x: barCenterX,
                y: midY - barH / 2,
                vx: 0,
                vy: -(0.6 + Math.random() * 1.5),
                hue: pHue,
                life: 0,
                maxLife: 80 + Math.random() * 80,
                size: 2 + Math.random() * 3,
              });
            }
          }
          ctx.globalAlpha = 1;

          // ── Waveform overlay ────────────────────────────────────────
          const waveData = new Uint8Array(analyser.fftSize);
          analyser.getByteTimeDomainData(waveData);
          const sliceW = vizW / waveData.length;
          ctx.beginPath();
          ctx.strokeStyle = `hsl(${globalHue}, 100%, 70%)`;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.5;
          for (let i = 0; i < waveData.length; i++) {
            const v = (waveData[i] / 128.0 - 1);
            const y = midY + v * vizH * 0.35;
            if (i === 0) ctx.moveTo(left, y); else ctx.lineTo(left + i * sliceW, y);
          }
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // ── Draw & update glow particles ────────────────────────────
        const particles = particlesRef.current;
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.y += p.vy;
          p.life++;
          if (p.life >= p.maxLife) { particles.splice(i, 1); continue; }
          const fade = 1 - p.life / p.maxLife;
          const pColor = `hsl(${p.hue}, 100%, 75%)`;
          ctx.shadowColor = pColor;
          ctx.shadowBlur = 6 + fade * 8;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * fade * 1.5, 0, Math.PI * 2);
          ctx.fillStyle = pColor;
          ctx.globalAlpha = fade * 0.8;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        if (particles.length > 200) particles.splice(0, particles.length - 200);
        ctx.globalAlpha = 1;

        // ── QR overlay (when toggled) ──────────────────────────────────
        if (showQR) {
          const gb = gridBoundsRef.current;
          const accent = "#66ff99";
          const mono = '"SF Mono", "Menlo", "Consolas", monospace';
          // Dark overlay on grid area
          ctx.fillStyle = "rgba(13, 17, 23, 0.88)";
          ctx.fillRect(gb.x, gb.y, gb.w, gb.h);
          // Render QR centered in grid area
          try {
            const qrInput = qrUrl || url;
            let qrData;
            let qrEc: "H" | "M" | "L" = "H";
            try { qrData = QRCode.create(qrInput, { errorCorrectionLevel: "H" }); }
            catch {
              try { qrEc = "M"; qrData = QRCode.create(qrInput, { errorCorrectionLevel: "M" }); }
              catch { qrEc = "L"; qrData = QRCode.create(url, { errorCorrectionLevel: "L" }); }
            }
            const modules = qrData.modules;
            const moduleCount = modules.size;
            const margin = 2;
            const totalModules = moduleCount + margin * 2;
            const qrSize = Math.min(gb.w, gb.h) - 16;
            const cellSize = qrSize / totalModules;
            const qrX = gb.x + (gb.w - qrSize) / 2;
            const qrY = gb.y + (gb.h - qrSize) / 2;
            ctx.fillStyle = "#000000";
            ctx.fillRect(qrX, qrY, qrSize, qrSize);
            ctx.fillStyle = "#ffffff";
            for (let row = 0; row < moduleCount; row++) {
              for (let col = 0; col < moduleCount; col++) {
                if (modules.get(row, col)) {
                  ctx.fillRect(qrX + (col + margin) * cellSize, qrY + (row + margin) * cellSize, Math.ceil(cellSize), Math.ceil(cellSize));
                }
              }
            }
            // Logo overlay on QR center (only at H level)
            if (qrEc === "H") {
              const logoSize = qrSize * 0.18;
              const lx = qrX + (qrSize - logoSize) / 2;
              const ly = qrY + (qrSize - logoSize) / 2;
              const lr = logoSize / 2;
              const line1 = "\u2588\u2580\u2584\u2580\u2588 \u2588\u2580\u2588 \u2588 \u2588 \u2588\u2580\u2584\u2580\u2588 \u2588\u2580\u2588";
              const line2 = "\u2588 \u2580 \u2588 \u2588\u2580\u2580 \u2580\u2584\u2580 \u2588 \u2580 \u2588 \u2588\u2580\u2580";
              const logoFontSize = Math.round(logoSize * 0.14);
              ctx.font = `bold ${logoFontSize}px ${mono}`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              const lcy = ly + lr;
              for (const [text, tly] of [[line1, lcy - logoFontSize * 0.6], [line2, lcy + logoFontSize * 0.6]] as const) {
                const tw = ctx.measureText(text).width;
                ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
                ctx.fillRect(lx + lr - tw / 2 - 4, (tly as number) - logoFontSize / 2 - 2, tw + 8, logoFontSize + 4);
              }
              ctx.fillStyle = accent;
              ctx.fillText(line1, lx + lr, lcy - logoFontSize * 0.6);
              ctx.fillText(line2, lx + lr, lcy + logoFontSize * 0.6);
            }
          } catch { /* QR too large — silently skip */ }
        }

        // ── A: Pulsing glow border (bass-reactive) ───────────────────
        const glowAlpha = 0.1 + bassEnergy * 0.4;
        ctx.strokeStyle = `hsl(${globalHue}, 100%, 70%)`;
        ctx.lineWidth = 2;
        ctx.globalAlpha = glowAlpha;
        ctx.strokeRect(1, 1, W - 2, H - 2);
        // Outer glow
        ctx.shadowColor = `hsl(${globalHue}, 100%, 70%)`;
        ctx.shadowBlur = 8 + bassEnergy * 20;
        ctx.strokeRect(1, 1, W - 2, H - 2);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;


        rafRef.current = requestAnimationFrame(animate);
      };
      rafRef.current = requestAnimationFrame(animate);
    });
    }, 50); // delay for iOS Safari canvas readiness

    return () => { clearTimeout(startDelay); cancelAnimationFrame(rafRef.current); };
  }, [drawCard, getAnalyser, showQR]);

  const shareCard = async () => {
    const canvas = cardCanvasRef.current;
    if (!canvas) return;
    // Try Web Share API with image + URL
    if (navigator.share && navigator.canShare) {
      try {
        const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, "image/jpeg", 0.92));
        if (!blob) return;
        const file = new File([blob], "mpump-beat.jpg", { type: "image/jpeg" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], url, title: "mpump beat" });
          return;
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return; // user cancelled
      }
    }
    // Fallback: download image (desktop / unsupported)
    const link = document.createElement("a");
    link.download = "mpump-beat.jpg";
    link.href = canvas.toDataURL("image/jpeg", 0.92);
    link.click();
  };


  // Decode for info panel
  const decodeFullPayload = (): Record<string, string> => {
    try {
      const u = new URL(url);
      const hash = (u.searchParams.get("z") || u.searchParams.get("b") || "").replace(/ /g, "+")
        || url.split("#")[1]
        || u.pathname.slice(1); // Worker URL: payload is the path
      if (!hash) return {};
      const data = decodeSharePayload(hash) as any;
      const info: Record<string, string> = {};
      if (data.bpm) info["BPM"] = String(data.bpm);
      if (data.sw != null) info["Swing"] = `${Math.round(data.sw * 100)}%`;
      if (data.dk != null) info["Drum kit"] = String(data.dk);
      if (data.sp != null) info["Synth preset"] = String(data.sp);
      if (data.bp != null) info["Bass preset"] = String(data.bp);
      if (data.fx) {
        const names = ["comp", "hpf", "dist", "crush", "chorus", "phaser", "delay", "reverb"];
        const active = data.fx.split("").map((b: string, i: number) => b === "1" ? names[i] : null).filter(Boolean);
        info["Effects"] = active.length > 0 ? active.join(", ") : "none";
      }
      if (data.fp) info["Effect params"] = Object.keys(data.fp).join(", ");
      if (data.spp) info["Synth sound"] = (data.spp as Record<string,unknown>).oscType ? String((data.spp as Record<string,unknown>).oscType) : "custom";
      if (data.bpp) info["Bass sound"] = (data.bpp as Record<string,unknown>).oscType ? String((data.bpp as Record<string,unknown>).oscType) : "custom";
      if (data.me) info["Synth edits"] = "custom pattern";
      if (data.de) info["Drum edits"] = "custom pattern";
      if (data.be) info["Bass edits"] = "custom pattern";
      if (data.gs) info["Gesture"] = "recorded";
      return info;
    } catch { return {}; }
  };

  return (
    <div className="share-overlay" onClick={onClose}>
      <div className="share-modal share-modal-card" onClick={(e) => { if (hideActions) { onClose(); } else { e.stopPropagation(); } }}>
        {!hideActions && <button className="share-close-btn" title="Close" onClick={onClose}>✕</button>}

        {/* Card */}
        <div className="share-card-wrap">
          <canvas ref={cardCanvasRef} className="share-card-canvas" />
        </div>

        {!hideActions && (<>
          {/* Remix badge */}
          {parentId && (
            <div style={{ textAlign: "center", fontSize: 10, opacity: 0.6, marginBottom: 4 }}>
              🔀 Remix of <a href={`https://s.mpump.live/${parentId}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--preview)", textDecoration: "none" }}>s.mpump.live/{parentId}</a>
            </div>
          )}
          {/* Actions below */}
          <div className="share-card-actions">
            <button className="share-card-action-primary" onClick={shareCard}>Share</button>
            <button className={`share-card-action ${copied ? "share-copied-btn" : ""}`} onClick={copyToClipboard}>
              {copied ? "Link copied!" : "Copy link"}
            </button>
            <button className={`share-card-action ${showQR ? "share-qr-active" : ""}`} onClick={() => setShowQR(!showQR)}>
              {showQR ? "▣ Grid" : "▣ QR"}
            </button>
          </div>

          {/* Link row */}
          <div className="share-url-row">
            <input
              ref={inputRef}
              className="share-url-input"
              value={showLongUrl && longUrl ? longUrl : url}
              readOnly
              onClick={() => inputRef.current?.select()}
            />
          </div>
          {isShortened && (
            <button
              style={{ fontSize: 9, opacity: 0.5, background: "none", border: "none", color: "inherit", cursor: "pointer", padding: "2px 0", textDecoration: "underline" }}
              onClick={() => setShowLongUrl(v => !v)}
            >{showLongUrl ? "Show short link" : "Show full link (works offline)"}</button>
          )}

          {/* Info toggle */}
          <button className="share-info-btn" title="What's encoded?" onClick={() => setShowInfo(!showInfo)}>?</button>
          {showInfo && (
            <div className="share-info-panel">
              <div className="share-info-title">Encoded in this link:</div>
              {Object.entries(decodeFullPayload()).map(([k, v]) => (
                <div key={k} className="share-info-row">
                  <span className="share-info-key">{k}</span>
                  <span className="share-info-val">{v}</span>
                </div>
              ))}
            </div>
          )}
        </>)}
      </div>
    </div>
  );
}
