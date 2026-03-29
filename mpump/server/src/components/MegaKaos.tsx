/**
 * MegaKaos — Fullscreen XY pad easter egg.
 * The entire screen becomes a giant kaospad sensor.
 * Click = flash random color. Drag = control synth params. ESC = close.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { ClientMessage, DeviceState } from "../types";

interface Props {
  devices: DeviceState[];
  command: (msg: ClientMessage) => void;
  getAnalyser?: () => AnalyserNode | null;
  onClose: () => void;
}

const CREDITS = [
  "", "",
  "█▀▄▀█ █▀█ █ █ █▀▄▀█ █▀█",
  "█ ▀ █ █▀▀ ▀▄▀ █ ▀ █ █▀▀",
  "", `v${__APP_VERSION__}`, "", "mpump.live", "",
  "- - - - - - - - - - - -", "",
  "INSTANT BROWSER", "GROOVEBOX", "",
  "910 PATTERNS · 15 GENRES", "",
  "50+ USB MIDI DEVICES", "",
  "3 VIEWS · 8 EFFECTS", "",
  "ARPEGGIATOR · SONG MODE",
  "GESTURE RECORDING",
  "WAV & VIDEO RECORDING",
  "SIDECHAIN · HUMANIZE",
  "SESSION EXPORT & IMPORT", "",
  "- - - - - - - - - - - -", "",
  "CREATED BY", "", "gdamdam", "",
  "BUILT WITH CLAUDE CODE", "",
  "GPL-3.0", "", "github.com/gdamdam/mpump", "",
  "- - - - - - - - - - - -", "",
  "ko-fi.com/gdamdam", "",
  "- - - - - - - - - - - -", "",
  "GR33TZ & R3SP3CT", "",
  "·· 1LL0B0 ··", "·· CL4UD3 ··", "·· J4M3S ··", "·· 0V3TT0 ··",
  "·· TR0N1X ··",
  "", "", "ESC TO CLOSE", "", "",
];

const FLASH_COLORS = [
  "#ff0044", "#ff6600", "#ffcc00", "#00ff66", "#00ccff",
  "#6600ff", "#ff00cc", "#00ffcc", "#ff3366", "#33ff99",
  "#ff9900", "#00ff00", "#ff00ff", "#00ffff", "#ffff00",
  "#ff4488", "#44ff88", "#8844ff", "#ff8844", "#44ffcc",
];

export function MegaKaos({ devices, command, getAnalyser, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const posRef = useRef<{ x: number; y: number } | null>(null);
  const trailsRef = useRef<{ x: number; y: number; age: number }[]>([]);
  const dragging = useRef(false);
  const [flashColor, setFlashColor] = useState<string | null>(null);
  const flashTimer = useRef(0);
  const lastXYTime = useRef(0);
  const colorIdx = useRef(0);

  // Apply XY to synth params: X = cutoff, Y = resonance
  const applyXY = useCallback((nx: number, ny: number) => {
    const now = performance.now();
    if (now - lastXYTime.current < 30) return;
    lastXYTime.current = now;
    const cutoff = 100 + nx * 7900;
    const resonance = 0.5 + (1 - ny) * 19.5; // top = high
    for (const d of devices) {
      if (d.mode === "synth" || d.mode === "bass") {
        command({ type: "set_synth_params", device: d.id, params: { cutoff, resonance } });
      }
    }
  }, [devices, command]);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    const nx = clientX / window.innerWidth;
    const ny = clientY / window.innerHeight;
    posRef.current = { x: nx, y: ny };
    trailsRef.current = [...trailsRef.current.slice(-50), { x: nx, y: ny, age: Date.now() }];
    applyXY(nx, ny);
  }, [applyXY]);

  // Flash on click (not drag)
  const handleClick = () => {
    if (dragging.current) return;
    const color = FLASH_COLORS[colorIdx.current % FLASH_COLORS.length];
    colorIdx.current++;
    setFlashColor(color);
    clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashColor(null), 150);
  };

  // Mouse events
  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = false;
    handleMove(e.clientX, e.clientY);
    const onMove = (ev: MouseEvent) => { dragging.current = true; handleMove(ev.clientX, ev.clientY); };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      posRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Touch events
  const onTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    dragging.current = false;
    handleMove(e.touches[0].clientX, e.touches[0].clientY);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    dragging.current = true;
    handleMove(e.touches[0].clientX, e.touches[0].clientY);
  };
  const onTouchEnd = () => { posRef.current = null; };

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const buf = new Uint8Array(128);
    let accentCache = "#66ff99";
    let accentAge = 0;
    let frame = 0;
    const startTime = performance.now();

    // Floating credits — each line is a drifting entity
    type CreditFloat = { text: string; x: number; y: number; vx: number; vy: number; phase: number; wobbleAmp: number; alpha: number; font: string };
    const floats: CreditFloat[] = [];
    let nextCreditIdx = 0;
    let lastCreditFrame = 0;

    // Rainbow laser rays
    const RAINBOW = ["#ff0000", "#ff8800", "#ffff00", "#00ff00", "#0088ff", "#8800ff"];
    const BAND_H = 2;
    type Ray = { x: number; y: number; speed: number; len: number; alpha: number; phase: number; pulseSpeed: number; dir: number; angle: number };
    const rays: Ray[] = [];

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const w = window.innerWidth;
      const h = window.innerHeight;

      // Audio level
      let level = 0;
      const analyser = getAnalyser?.();
      if (analyser) {
        analyser.getByteFrequencyData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i];
        level = sum / buf.length / 255;
      }

      // Dark background
      ctx.fillStyle = `rgba(0, 0, 0, ${0.92 - level * 0.1})`;
      ctx.fillRect(0, 0, w, h);

      // Accent color
      accentAge++;
      if (accentAge > 60) {
        accentAge = 0;
        accentCache = getComputedStyle(document.documentElement).getPropertyValue("--preview").trim() || "#66ff99";
      }

      // Grid
      ctx.strokeStyle = accentCache;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.06;
      for (let i = 1; i < 8; i++) {
        ctx.beginPath(); ctx.moveTo(w * i / 8, 0); ctx.lineTo(w * i / 8, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, h * i / 8); ctx.lineTo(w, h * i / 8); ctx.stroke();
      }

      // Audio-reactive bars at bottom
      if (analyser) {
        const freqData = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(freqData);
        const bars = 64;
        const step = Math.floor(freqData.length / bars);
        const barW = w / bars - 1;
        ctx.fillStyle = accentCache;
        for (let i = 0; i < bars; i++) {
          let sum = 0;
          for (let j = 0; j < step; j++) sum += freqData[i * step + j];
          const val = sum / step / 255;
          const barH = val * h * 0.3;
          ctx.globalAlpha = 0.08 + val * 0.12;
          ctx.fillRect(i * (barW + 1), h - barH, barW, barH);
          // Mirror top
          ctx.fillRect(i * (barW + 1), 0, barW, barH * 0.5);
        }
      }
      ctx.globalAlpha = 1;

      // Rainbow laser rays — mirrored bursts, diagonal after 10s
      frame++;
      const elapsed = (performance.now() - startTime) / 1000;
      const diagonalPhase = elapsed > 10; // diagonals unlock after 10s

      // Spawn rays in mirrored pairs (left→right + right→left)
      const spawnInterval = level > 0.3 ? 8 : 20;
      if (frame % spawnInterval === 0) {
        const baseY = Math.random() * h;
        const spd = 2 + Math.random() * 4 + level * 5;
        const len = 80 + Math.random() * 160;
        const alpha = 0.25 + Math.random() * 0.35;
        const phase = Math.random() * Math.PI * 2;
        const ps = 0.05 + Math.random() * 0.1;
        // From left
        rays.push({ x: -len, y: baseY, speed: spd, len, alpha, phase, pulseSpeed: ps, dir: 1, angle: 0 });
        // Mirror: from right
        rays.push({ x: w + 20, y: h - baseY, speed: spd, len, alpha, phase, pulseSpeed: ps, dir: -1, angle: 0 });
      }
      // Diagonal rays after 10s
      if (diagonalPhase && frame % (spawnInterval * 2) === 0) {
        const spd = 1.5 + Math.random() * 3 + level * 3;
        const len = 60 + Math.random() * 120;
        const alpha = 0.2 + Math.random() * 0.3;
        const phase = Math.random() * Math.PI * 2;
        const ps = 0.04 + Math.random() * 0.08;
        // Top-left to bottom-right
        const diagAngle = Math.PI / 6 + Math.random() * Math.PI / 6; // 30°–60°
        rays.push({ x: -len, y: Math.random() * h * 0.6, speed: spd, len, alpha, phase, pulseSpeed: ps, dir: 1, angle: diagAngle });
        // Bottom-right to top-left (mirror)
        rays.push({ x: w + 20, y: h - Math.random() * h * 0.6, speed: spd, len, alpha, phase, pulseSpeed: ps, dir: -1, angle: -diagAngle });
      }

      // Draw and update rays
      for (let r = rays.length - 1; r >= 0; r--) {
        const ray = rays[r];
        ray.x += ray.speed * ray.dir;
        ray.y += Math.sin(ray.angle) * ray.speed * ray.dir;
        ray.phase += ray.pulseSpeed;
        // Twinkle + audio breathing + fade based on screen position
        const twinkle = 0.5 + 0.5 * Math.sin(ray.phase);
        const audioBoost = 1 + level * 1.5;
        const screenPos = ray.dir > 0 ? ray.x / w : (w - ray.x) / w;
        const fade = Math.max(0, Math.min(1, screenPos > 0.7 ? (1 - screenPos) / 0.3 : screenPos < 0 ? (screenPos + ray.len / w) : 1));
        const brightness = ray.alpha * twinkle * audioBoost * fade;

        ctx.save();
        ctx.translate(ray.x, ray.y);
        ctx.rotate(ray.angle * ray.dir);
        for (let i = 0; i < RAINBOW.length; i++) {
          ctx.fillStyle = RAINBOW[i];
          ctx.globalAlpha = Math.min(0.85, brightness);
          ctx.fillRect(0, i * BAND_H, ray.len, BAND_H);
        }
        ctx.restore();

        // Remove when fully off-screen
        const offRight = ray.dir > 0 && ray.x > w + ray.len;
        const offLeft = ray.dir < 0 && ray.x + ray.len < -ray.len;
        const offVert = ray.y < -ray.len * 2 || ray.y > h + ray.len * 2;
        if (offRight || offLeft || offVert) rays.splice(r, 1);
      }
      ctx.globalAlpha = 1;

      // Trails
      const now = Date.now();
      const trails = trailsRef.current;
      for (let i = trails.length - 1; i >= 0; i--) {
        const t = trails[i];
        const age = (now - t.age) / 1200;
        if (age > 1) { trails.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.arc(t.x * w, t.y * h, 12 * (1 - age) + level * 8, 0, Math.PI * 2);
        ctx.fillStyle = accentCache;
        ctx.globalAlpha = (1 - age) * 0.5;
        ctx.fill();
      }

      // Cursor + crosshairs
      const p = posRef.current;
      if (p) {
        // Crosshairs
        ctx.strokeStyle = accentCache;
        ctx.globalAlpha = 0.2 + level * 0.2;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, p.y * h); ctx.lineTo(w, p.y * h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p.x * w, 0); ctx.lineTo(p.x * w, h); ctx.stroke();

        // Cursor
        const pulse = 1 + Math.sin(now * 0.005) * 0.3 + level * 0.5;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, 14 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = accentCache;
        ctx.globalAlpha = 0.7;
        ctx.fill();
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, 28 * pulse, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;

      // XY labels
      ctx.fillStyle = accentCache;
      ctx.globalAlpha = 0.3;
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText("CUTOFF →", 10, h - 10);
      ctx.save();
      ctx.translate(14, h - 30);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText("RESONANCE →", 0, 0);
      ctx.restore();

      // Floating chaos credits — spawn lines from random edges, drift across
      const spawnCredit = frame - lastCreditFrame > 45 && nextCreditIdx < CREDITS.length;
      if (spawnCredit) {
        let text = CREDITS[nextCreditIdx];
        nextCreditIdx++;
        // Skip empty lines, advance faster
        while (!text.trim() && nextCreditIdx < CREDITS.length) {
          text = CREDITS[nextCreditIdx];
          nextCreditIdx++;
        }
        if (text.trim()) {
          lastCreditFrame = frame;
          // Pick random edge: 0=top, 1=bottom, 2=left, 3=right
          const edge = Math.floor(Math.random() * 4);
          let sx: number, sy: number, vx: number, vy: number;
          const speed = 0.3 + Math.random() * 0.4;
          if (edge === 0) { sx = w * 0.2 + Math.random() * w * 0.6; sy = -20; vx = (Math.random() - 0.5) * 0.3; vy = speed; }
          else if (edge === 1) { sx = w * 0.2 + Math.random() * w * 0.6; sy = h + 20; vx = (Math.random() - 0.5) * 0.3; vy = -speed; }
          else if (edge === 2) { sx = -20; sy = h * 0.2 + Math.random() * h * 0.6; vx = speed; vy = (Math.random() - 0.5) * 0.3; }
          else { sx = w + 20; sy = h * 0.2 + Math.random() * h * 0.6; vx = -speed; vy = (Math.random() - 0.5) * 0.3; }
          const isLogo = text.startsWith("█");
          const isSep = text.startsWith("-");
          floats.push({
            text, x: sx, y: sy, vx, vy,
            phase: Math.random() * Math.PI * 2,
            wobbleAmp: 0.3 + Math.random() * 0.5,
            alpha: isLogo ? 0.6 : isSep ? 0.2 : 0.4,
            font: isLogo ? "bold 14px monospace" : isSep ? "10px monospace" : "13px monospace",
          });
        }
      }
      // Loop credits when exhausted
      if (nextCreditIdx >= CREDITS.length && floats.length === 0) {
        nextCreditIdx = 0;
      }

      // Draw floating credits
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      for (let f = floats.length - 1; f >= 0; f--) {
        const fl = floats[f];
        fl.x += fl.vx;
        fl.y += fl.vy;
        fl.phase += 0.02;
        // Sine wobble perpendicular to direction
        const wobbleX = Math.sin(fl.phase) * fl.wobbleAmp * Math.abs(fl.vy) * 15;
        const wobbleY = Math.sin(fl.phase) * fl.wobbleAmp * Math.abs(fl.vx) * 15;
        // Fade near edges
        const ex = Math.min(fl.x / (w * 0.15), (w - fl.x) / (w * 0.15), 1);
        const ey = Math.min(fl.y / (h * 0.15), (h - fl.y) / (h * 0.15), 1);
        const edgeFade = Math.max(0, Math.min(ex, ey));
        ctx.globalAlpha = fl.alpha * edgeFade;
        ctx.font = fl.font;
        ctx.fillText(fl.text, fl.x + wobbleX, fl.y + wobbleY);
        // Remove when off-screen
        if (fl.x < -200 || fl.x > w + 200 || fl.y < -50 || fl.y > h + 50) {
          floats.splice(f, 1);
        }
      }
      ctx.globalAlpha = 1;

      // ESC hint
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillStyle = accentCache;
      ctx.globalAlpha = 0.25;
      ctx.font = "bold 12px monospace";
      ctx.fillText("ESC to close", w - 10, 10);
      ctx.globalAlpha = 1;
    };

    draw();
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [getAnalyser]);

  return (
    <div
      className="megakaos-overlay"
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onClick={handleClick}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        cursor: "crosshair",
        touchAction: "none",
        overflow: "hidden",
      }}
    >
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      {/* Flash overlay */}
      {flashColor && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: flashColor,
            opacity: 0.6,
            pointerEvents: "none",
            transition: "opacity 0.15s ease-out",
          }}
        />
      )}
    </div>
  );
}
