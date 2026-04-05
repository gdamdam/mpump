/**
 * AboutModal — Retro videogame-style scrolling credits.
 */

import { useEffect, useRef, useState } from "react";

interface Props {
  onClose: () => void;
  getAnalyser?: () => AnalyserNode | null;
}

const LINES = [
  "",
  "",
  "",
  "█▀▄▀█ █▀█ █ █ █▀▄▀█ █▀█",
  "█ ▀ █ █▀▀ ▀▄▀ █ ▀ █ █▀▀",
  "",
  `v${__APP_VERSION__}`,
  "",
  "mpump.live",
  "",
  "",
  "- - - - - - - - - - - -",
  "",
  "INSTANT BROWSER",
  "GROOVEBOX",
  "",
  "- - - - - - - - - - - -",
  "",
  "",
  "1210+ PATTERNS",
  "ACROSS 20 GENRES",
  "",
  "TECHNO · HOUSE · TRANCE",
  "DUB TECHNO · ACID · IDM",
  "DRUM & BASS · BREAKBEAT",
  "JUNGLE · GARAGE · ELECTRO",
  "AMBIENT · GLITCH · DOWNTEMPO",
  "",
  "",
  "- - - - - - - - - - - -",
  "",
  "3 VIEWS",
  "",
  "KAOS",
  "XY performance pad",
  "8 real-time effects",
  "",
  "SYNTH",
  "Step grid editor",
  "Sound design tools",
  "",
  "MIXER",
  "Per-channel metering",
  "Per-channel mixing",
  "",
  "",
  "- - - - - - - - - - - -",
  "",
  "SOUND ENGINE",
  "",
  "808-style drum synthesis",
  "Sawtooth / Square / Sine / Tri",
  "ADSR envelope · LPF HPF BPF Notch",
  "LFO with tempo sync",
  "Sub-bass oscillator",
  "Euclidean rhythm generator",
  "Custom sample loading",
  "",
  "",
  "- - - - - - - - - - - -",
  "",
  "EFFECTS",
  "",
  "Delay · Distortion · Reverb",
  "Compressor · Highpass",
  "Chorus · Phaser · Bitcrusher",
  "",
  "",
  "- - - - - - - - - - - -",
  "",
  "PERFORMANCE",
  "",
  "Arpeggiator · Song mode",
  "Gesture recording & loop",
  "Sidechain duck · Humanize",
  "Tap tempo · Scale lock",
  "Session export & import",
  "Audio WAV recording",
  "Video recording",
  "",
  "",
  "- - - - - - - - - - - -",
  "",
  "BUILT WITH",
  "",
  "Claude Code",
  "React · TypeScript · Vite",
  "Web Audio API · Web MIDI API",
  "Canvas · IndexedDB",
  "",
  "",
  "- - - - - - - - - - - -",
  "",
  "50+ USB MIDI DEVICES",
  "",
  "Roland · Korg · Elektron",
  "Novation · Arturia · Behringer",
  "Sequential · Teenage Engineering",
  "IK Multimedia",
  "",
  "",
  "- - - - - - - - - - - -",
  "",
  "",
  "CREATED BY",
  "",
  "gdamdam",
  "",
  "",
  "LICENSE",
  "",
  "AGPL-3.0",
  "",
  "",
  "NO INSTALL",
  "NO ACCOUNT",
  "NO PERSONAL DATA",
  "",
  "",
  "GENERATE BEATS.",
  "SHAPE THEM YOURS.",
  "SHARE INSTANTLY.",
  "",
  "",
  "- - - - - - - - - - - -",
  "",
  "",
  "I built mpump because I wanted",
  "to make music anywhere.",
  "On a laptop at a café,",
  "on a tablet on the couch,",
  "on a phone on the train.",
  "",
  "And when I had something good,",
  "I wanted to share it with my",
  "friends instantly — without",
  "asking them to install an app",
  "or register on some website.",
  "Just a link, they open it,",
  "they hear the beat.",
  "",
  "A focused instrument for",
  "catching momentum: find a groove,",
  "shape it live, push it somewhere",
  "personal, and move before",
  "the idea goes cold.",
  "",
  "The loops are short on purpose.",
  "The presets are starting points,",
  "not conclusions.",
  "",
  "No install, no account,",
  "no personal data.",
  "Free forever.",
  "",
  "",
  "Source Code (AGPL-3.0)",
  "github.com/gdamdam/mpump",
  "",
  "",
  "- - - - - - - - - - - -",
  "",
  "",
  "SUPPORT MPUMP",
  "",
  "Free & open source forever.",
  "If you enjoy it, consider",
  "buying me a coffee.",
  "",
  "ko-fi.com/gdamdam",
  "",
  "",
  "- - - - - - - - - - - -",
  "",
  "",
  "GR33TZ & R3SP3CT",
  "",
  "·· 1LL0B0 ··",
  "·· CL4UD3 ··",
  "·· J4M3S ··",
  "·· 0V3TT0 ··",
  "·· TR0N1X ··",
  "",
  "",
  "- - - - - - - - - - - -",
  "",
  "",
  "",
  "PRESS ANY KEY TO CLOSE",
  "",
  "",
  "",
  "",
];

export function AboutModal({ onClose, getAnalyser }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scrollY, setScrollY] = useState(0);
  const rafRef = useRef<number>(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const tid = setTimeout(() => setStarted(true), 500);
    return () => clearTimeout(tid);
  }, []);

  // Starfield + color cycling + audio-reactive background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Stars
    const stars: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i < 120; i++) {
      stars.push({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() });
    }
    // Rainbow rays
    const rays: { x: number; y: number; speed: number; len: number; alpha: number; phase: number; pulseSpeed: number; dir: number; angle: number }[] = [];
    const startTime = performance.now();

    const resize = () => {
      canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
      canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
      ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const buf = new Uint8Array(128);
    let frame = 0;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      frame++;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;

      // Audio level
      let level = 0;
      const analyser = getAnalyser?.();
      if (analyser) {
        analyser.getByteFrequencyData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i];
        level = sum / buf.length / 255;
      }

      // Color cycling background
      const hue = (frame * 0.3) % 360;
      const brightness = 0.03 + level * 0.08;
      ctx.fillStyle = `hsl(${hue}, 60%, ${brightness * 100}%)`;
      ctx.fillRect(0, 0, w, h);

      // Audio-reactive radial pulse
      if (level > 0.05) {
        const cx = w / 2, cy = h / 2;
        const r = Math.max(w, h) * (0.2 + level * 0.5);
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, `hsla(${hue + 180}, 80%, 50%, ${level * 0.15})`);
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }

      // Starfield
      const cx = w / 2, cy = h / 2;
      const speed = 0.003 + level * 0.01;
      for (const star of stars) {
        star.z -= speed;
        if (star.z <= 0) { star.x = Math.random() * 2 - 1; star.y = Math.random() * 2 - 1; star.z = 1; }
        const sx = cx + (star.x / star.z) * cx;
        const sy = cy + (star.y / star.z) * cy;
        const size = (1 - star.z) * 2.5;
        const alpha = (1 - star.z) * 0.8;
        ctx.fillStyle = `hsla(${(hue + star.x * 60) % 360}, 70%, 80%, ${alpha})`;
        ctx.fillRect(sx, sy, size, size);
      }

      // Rainbow laser rays — mirrored bursts, diagonal after 10s
      const rainbowColors = ["#ff0000", "#ff8800", "#ffff00", "#00ff00", "#0088ff", "#8800ff"];
      const bandH = 2;
      const elapsed = (performance.now() - startTime) / 1000;
      const diagonalPhase = elapsed > 10;

      // Spawn mirrored pairs (left→right + right→left)
      const spawnInterval = level > 0.3 ? 10 : 25;
      if (frame % spawnInterval === 0) {
        const baseY = Math.random() * h;
        const spd = 1.5 + Math.random() * 3 + level * 4;
        const len = 60 + Math.random() * 120;
        const alpha = 0.3 + Math.random() * 0.3;
        const phase = Math.random() * Math.PI * 2;
        const ps = 0.05 + Math.random() * 0.1;
        // From right (original direction)
        rays.push({ x: w + 20, y: baseY, speed: spd, len, alpha, phase, pulseSpeed: ps, dir: -1, angle: 0 });
        // Mirror: from left
        rays.push({ x: -len, y: h - baseY, speed: spd, len, alpha, phase, pulseSpeed: ps, dir: 1, angle: 0 });
      }
      // Diagonal rays after 10s
      if (diagonalPhase && frame % (spawnInterval * 2) === 0) {
        const spd = 1.5 + Math.random() * 3 + level * 3;
        const len = 60 + Math.random() * 120;
        const alpha = 0.2 + Math.random() * 0.3;
        const phase = Math.random() * Math.PI * 2;
        const ps = 0.04 + Math.random() * 0.08;
        const diagAngle = Math.PI / 6 + Math.random() * Math.PI / 6;
        rays.push({ x: -len, y: Math.random() * h * 0.6, speed: spd, len, alpha, phase, pulseSpeed: ps, dir: 1, angle: diagAngle });
        rays.push({ x: w + 20, y: h - Math.random() * h * 0.6, speed: spd, len, alpha, phase, pulseSpeed: ps, dir: -1, angle: -diagAngle });
      }

      // Draw and update rays
      for (let r = rays.length - 1; r >= 0; r--) {
        const ray = rays[r];
        ray.x += ray.speed * ray.dir;
        ray.y += Math.sin(ray.angle) * ray.speed * ray.dir;
        ray.phase += ray.pulseSpeed;
        const twinkle = 0.5 + 0.5 * Math.sin(ray.phase);
        const audioBoost = 1 + level * 1.5;
        const screenPos = ray.dir > 0 ? ray.x / w : (w - ray.x) / w;
        const fade = Math.max(0, Math.min(1, screenPos > 0.7 ? (1 - screenPos) / 0.3 : screenPos < 0 ? (screenPos + ray.len / w) : 1));
        const brightness = ray.alpha * twinkle * audioBoost * fade;

        ctx.save();
        ctx.translate(ray.x, ray.y);
        ctx.rotate(ray.angle * ray.dir);
        for (let i = 0; i < rainbowColors.length; i++) {
          ctx.fillStyle = rainbowColors[i];
          ctx.globalAlpha = Math.min(0.9, brightness);
          ctx.fillRect(0, i * bandH, ray.len, bandH);
        }
        ctx.restore();

        // Remove when fully off-screen
        const offRight = ray.dir > 0 && ray.x > w + ray.len;
        const offLeft = ray.dir < 0 && ray.x + ray.len < -ray.len;
        const offVert = ray.y < -ray.len * 2 || ray.y > h + ray.len * 2;
        if (offRight || offLeft || offVert) rays.splice(r, 1);
      }
      ctx.globalAlpha = 1;

      // Scroll text
      setScrollY(prev => prev + 0.6);
    };

    draw();
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, [getAnalyser]);

  // Close on any key or click
  useEffect(() => {
    const handler = () => onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-screen" ref={containerRef}>
        <canvas ref={canvasRef} className="about-bg-canvas" />
        <div className="about-scroll" style={{ transform: `translateY(${400 - scrollY}px)` }}>
          {LINES.map((line, i) => (
            <div key={i} className={`about-line ${line.startsWith("█") ? "about-logo" : line.startsWith("-") ? "about-sep" : ""}`}>
              {line || "\u00A0"}
            </div>
          ))}
        </div>
        <div className="about-scanlines" />
      </div>
    </div>
  );
}
