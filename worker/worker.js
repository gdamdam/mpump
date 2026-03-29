/**
 * mpump share link Worker — serves dynamic OG tags + PNG images for messaging app previews.
 *
 * Routes:
 *   s.mpump.live/<payload>       → OG HTML (bots) or 302 redirect (browsers)
 *   s.mpump.live/img/<payload>   → Dynamic PNG card image (800×800)
 */

const APP_ORIGIN = "https://mpump.live";

/** Decode full payload for image generation. */
function decodePayload(payload) {
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const data = JSON.parse(atob(padded));
    const bpm = data.bpm || 120;
    const genres = data.g
      ? Object.keys(data.g).map((k) => k.replace("preview_", ""))
      : [];
    const genre = genres.length > 0 ? genres[0] : "";
    const fxNames = ["comp", "hpf", "dist", "crush", "chorus", "phaser", "delay", "reverb"];
    const fx = data.fx
      ? data.fx.split("").map((b, i) => (b === "1" ? fxNames[i] : null)).filter(Boolean)
      : [];

    const decodeSteps = (s) =>
      s.split("|").map((p) => {
        if (p === "-") return null;
        const [semi, vel] = p.split(",");
        return { semi: +semi, vel: +vel };
      });

    let drums = [];
    if (data.de) {
      drums = data.de.split("|").map((s) =>
        s === "-" ? [] : s.split("+").map((h) => {
          const [n, v] = h.split(".");
          return { note: +n, vel: +v };
        })
      );
    }

    const melodic = data.me ? decodeSteps(data.me) : null;
    const bass = data.be ? decodeSteps(data.be) : null;

    const trackName = data.tn || "";
    return { bpm, genre, genres, fx, drums, melodic, bass, trackName, raw: data };
  } catch {
    return { bpm: 120, genre: "", genres: [], fx: [], drums: [], melodic: null, bass: null, trackName: "", raw: {} };
  }
}

/** Extract human-readable metadata from the share payload. */
function decodeMeta(payload) {
  const { bpm, genres, fx, trackName } = decodePayload(payload);
  let title = "mpump beat";
  if (trackName && bpm) title = `${trackName} · ${bpm} BPM`;
  else if (bpm && genres.length) title = `${bpm} BPM · ${genres.join(" · ")}`;
  else if (bpm) title = `${bpm} BPM`;
  const parts = [];
  if (fx.length) parts.push(`Effects: ${fx.join(", ")}`);
  parts.push("Listen and remix on mpump — instant browser groovebox");
  return { title, desc: parts.join(". ") };
}

/** BPM → hue (≤90=purple 270°, gradient 90–160, ≥160=red 0°). */
function bpmHue(bpm) {
  const t = Math.max(0, Math.min(1, (bpm - 90) / 70));
  return 210 - t * 210;
}

// ── PNG generation ────────────────────────────────────────────────────────

/** HSL (h=degrees, s/l=0–1) → [r, g, b] integers 0–255. */
function hslToRgb(h, s, l) {
  h = h / 360;
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 0.5) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  return [Math.round(f(h + 1/3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1/3) * 255)];
}

/** BPM → [r, g, b] accent color. */
function bpmRgb(bpm) {
  if (bpm < 90)  return [123, 104, 238];
  if (bpm < 120) return [0, 212, 170];
  if (bpm < 140) return [102, 255, 153];
  if (bpm < 160) return [255, 170, 0];
  return [255, 68, 102];
}

/** Blend color into RGB pixel buffer rectangle (opacity 0–1). */
function fillRect(px, W, x, y, w, h, r, g, b, opacity = 1) {
  const x1 = Math.max(0, Math.round(x));
  const y1 = Math.max(0, Math.round(y));
  const x2 = Math.min(W, Math.round(x + w));
  const y2 = Math.round(y + h); // height bound checked per-pixel
  for (let py = y1; py < y2; py++) {
    if (py < 0) continue;
    for (let px2 = x1; px2 < x2; px2++) {
      const i = (py * W + px2) * 3;
      if (opacity >= 1) {
        px[i] = r; px[i+1] = g; px[i+2] = b;
      } else {
        px[i]   = Math.round(px[i]   + (r - px[i])   * opacity);
        px[i+1] = Math.round(px[i+1] + (g - px[i+1]) * opacity);
        px[i+2] = Math.round(px[i+2] + (b - px[i+2]) * opacity);
      }
    }
  }
}

/**
 * 5×7 bitmap font for digits 0–9 and letters B P M.
 * Each array has 7 entries (rows). Each row is a 5-bit mask: bit 4 = leftmost pixel.
 */
const PIXEL_FONT = {
  '0': [0b11111,0b10001,0b10001,0b10001,0b10001,0b10001,0b11111],
  '1': [0b00100,0b01100,0b00100,0b00100,0b00100,0b00100,0b01110],
  '2': [0b11111,0b00001,0b00001,0b11111,0b10000,0b10000,0b11111],
  '3': [0b11111,0b00001,0b00001,0b01111,0b00001,0b00001,0b11111],
  '4': [0b10001,0b10001,0b10001,0b11111,0b00001,0b00001,0b00001],
  '5': [0b11111,0b10000,0b10000,0b11111,0b00001,0b00001,0b11111],
  '6': [0b11111,0b10000,0b10000,0b11111,0b10001,0b10001,0b11111],
  '7': [0b11111,0b00001,0b00001,0b00011,0b00010,0b00010,0b00010],
  '8': [0b11111,0b10001,0b10001,0b11111,0b10001,0b10001,0b11111],
  '9': [0b11111,0b10001,0b10001,0b11111,0b00001,0b00001,0b11111],
  'A': [0b01110,0b10001,0b10001,0b11111,0b10001,0b10001,0b10001],
  'B': [0b11110,0b10001,0b10001,0b11110,0b10001,0b10001,0b11110],
  'C': [0b01111,0b10000,0b10000,0b10000,0b10000,0b10000,0b01111],
  'D': [0b11110,0b10001,0b10001,0b10001,0b10001,0b10001,0b11110],
  'E': [0b11111,0b10000,0b10000,0b11110,0b10000,0b10000,0b11111],
  'F': [0b11111,0b10000,0b10000,0b11110,0b10000,0b10000,0b10000],
  'G': [0b01111,0b10000,0b10000,0b10111,0b10001,0b10001,0b01111],
  'H': [0b10001,0b10001,0b10001,0b11111,0b10001,0b10001,0b10001],
  'I': [0b01110,0b00100,0b00100,0b00100,0b00100,0b00100,0b01110],
  'J': [0b00111,0b00010,0b00010,0b00010,0b00010,0b10010,0b01100],
  'K': [0b10001,0b10010,0b10100,0b11000,0b10100,0b10010,0b10001],
  'L': [0b10000,0b10000,0b10000,0b10000,0b10000,0b10000,0b11111],
  'M': [0b10001,0b11011,0b10101,0b10001,0b10001,0b10001,0b10001],
  'N': [0b10001,0b11001,0b10101,0b10011,0b10001,0b10001,0b10001],
  'O': [0b01110,0b10001,0b10001,0b10001,0b10001,0b10001,0b01110],
  'P': [0b11110,0b10001,0b10001,0b11110,0b10000,0b10000,0b10000],
  'Q': [0b01110,0b10001,0b10001,0b10001,0b10101,0b10010,0b01101],
  'R': [0b11110,0b10001,0b10001,0b11110,0b10100,0b10010,0b10001],
  'S': [0b01111,0b10000,0b10000,0b01110,0b00001,0b00001,0b11110],
  'T': [0b11111,0b00100,0b00100,0b00100,0b00100,0b00100,0b00100],
  'U': [0b10001,0b10001,0b10001,0b10001,0b10001,0b10001,0b01110],
  'V': [0b10001,0b10001,0b10001,0b10001,0b10001,0b01010,0b00100],
  'W': [0b10001,0b10001,0b10001,0b10101,0b10101,0b11011,0b10001],
  'X': [0b10001,0b10001,0b01010,0b00100,0b01010,0b10001,0b10001],
  'Y': [0b10001,0b10001,0b01010,0b00100,0b00100,0b00100,0b00100],
  'Z': [0b11111,0b00001,0b00010,0b00100,0b01000,0b10000,0b11111],
  '-': [0b00000,0b00000,0b00000,0b11111,0b00000,0b00000,0b00000],
  '.': [0b00000,0b00000,0b00000,0b00000,0b00000,0b00000,0b00100],
  ' ': [0b00000,0b00000,0b00000,0b00000,0b00000,0b00000,0b00000],
};

/**
 * Render a string using the pixel font.
 * Returns the x coordinate after the last character.
 */
function drawText(px, W, text, x, y, scale, r, g, b, opacity = 1) {
  let cx = x;
  for (const ch of String(text)) {
    const bitmap = PIXEL_FONT[ch];
    if (!bitmap) { cx += scale * 4; continue; }
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (bitmap[row] & (1 << (4 - col))) {
          fillRect(px, W, cx + col * scale, y + row * scale, scale, scale, r, g, b, opacity);
        }
      }
    }
    cx += 6 * scale; // 5px char + 1px gap
  }
  return cx;
}

/** Build grid row data from decoded pattern. */
function buildGridRows(drums, melodic, bass) {
  const rows = [];

  if (drums.length > 0) {
    const notes = new Set();
    for (const step of drums) for (const h of step) notes.add(h.note);
    for (const note of [...notes].sort((a, b) => b - a).slice(0, 6)) {
      rows.push(drums.map((step) => {
        const hit = step.find((h) => h.note === note);
        return hit ? hit.vel / 127 : 0;
      }));
    }
  }

  const addPitchRows = (steps, maxRows) => {
    if (!steps) return;
    const semis = steps.filter(Boolean).map((s) => s.semi);
    if (!semis.length) return;
    const lo = Math.min(...semis, 0), hi = Math.max(...semis, 12);
    const range = Math.max(hi - lo, 1);
    const n = Math.min(Math.max(Math.ceil(range), 2), maxRows);
    for (let r = n - 1; r >= 0; r--) {
      const rlo = lo + (r / n) * range, rhi = lo + ((r + 1) / n) * range;
      rows.push(steps.map((s) => (!s ? 0 : (s.semi >= rlo && s.semi < rhi) ? s.vel / 127 : 0)));
    }
  };
  addPitchRows(melodic, 5);
  addPitchRows(bass, 4);

  // Fallback placeholder
  if (rows.length === 0) {
    for (let r = 0; r < 6; r++)
      rows.push(Array.from({ length: 16 }, (_, i) =>
        ((i + r * 3) % 5 === 0 || (i + r) % 7 === 0) ? 0.55 + ((i * 7 + r * 13) % 9) / 25 : 0
      ));
  }
  return rows;
}

/** CRC-32 for PNG chunk integrity. */
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xEDB88320 : 0);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/** Build a PNG chunk: 4-byte length + 4-byte type + data + 4-byte CRC. */
function pngChunk(type, data) {
  const typeBytes = new TextEncoder().encode(type);
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length, false);
  out.set(typeBytes, 4);
  out.set(data, 8);
  const crcBuf = new Uint8Array(4 + data.length);
  crcBuf.set(typeBytes);
  crcBuf.set(data, 4);
  view.setUint32(8 + data.length, crc32(crcBuf), false);
  return out;
}

/** Encode RGB pixel buffer (Uint8Array, width*height*3 bytes) as a PNG file. */
async function encodePng(pixels, W, H) {
  // Build filter-0 scanlines: [0x00][R G B R G B ...]
  const scanlines = new Uint8Array(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    scanlines[y * (1 + W * 3)] = 0; // filter type None
    scanlines.set(pixels.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }

  // Compress using zlib (CompressionStream 'deflate' = RFC 1950, required by PNG)
  const cs = new CompressionStream("deflate");
  const writer = cs.writable.getWriter();
  writer.write(scanlines);
  writer.close();
  const compressed = new Uint8Array(await new Response(cs.readable).arrayBuffer());

  // IHDR
  const ihdrData = new Uint8Array(13);
  const dv = new DataView(ihdrData.buffer);
  dv.setUint32(0, W, false);
  dv.setUint32(4, H, false);
  ihdrData[8] = 8; // 8-bit depth
  ihdrData[9] = 2; // RGB color type

  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, pngChunk("IHDR", ihdrData), pngChunk("IDAT", compressed), pngChunk("IEND", new Uint8Array(0))];
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

/** Generate a dynamic PNG card (800×800) for a beat share link. */
async function generatePng(payload) {
  const { bpm, drums, melodic, bass, trackName } = decodePayload(payload);
  const W = 800, H = 800;
  const px = new Uint8Array(W * H * 3);

  const hue = bpmHue(bpm);
  const [ar, ag, ab] = hslToRgb(hue, 1.0, 0.70);
  const [br, bg, bb] = bpmRgb(bpm);

  // Background
  fillRect(px, W, 0, 0, W, H, 13, 17, 23);

  // Top accent stripe
  fillRect(px, W, 0, 0, W, 12, ar, ag, ab, 0.70);

  // Border (1px, low opacity)
  for (let x = 0; x < W; x++) {
    fillRect(px, W, x, 0, 1, 1, ar, ag, ab, 0.25);
    fillRect(px, W, x, H - 1, 1, 1, ar, ag, ab, 0.25);
  }
  for (let y = 1; y < H - 1; y++) {
    fillRect(px, W, 0, y, 1, 1, ar, ag, ab, 0.25);
    fillRect(px, W, W - 1, y, 1, 1, ar, ag, ab, 0.25);
  }

  // mpump logo — centered between accent stripe and grid
  const logoScale = 6;
  const logoText = "mpump";
  const logoW = logoText.length * 6 * logoScale - logoScale;
  const logoX = Math.round((W - logoW) / 2);
  drawText(px, W, logoText, logoX, 26, logoScale, ar, ag, ab, 0.85);

  // Beat grid
  const gridRows = buildGridRows(drums, melodic, bass);
  const padX = 28, gridY = 80, gridW = W - padX * 2, gridH = 450;
  const numCols = Math.max(...gridRows.map((r) => r.length), 16);
  const numRows = gridRows.length;
  const cellW = gridW / numCols;
  const cellH = Math.min(gridH / numRows, cellW);
  const gridYOff = Math.round(gridY + (gridH - cellH * numRows) / 2);
  const gap = 2;

  for (let r = 0; r < numRows; r++) {
    const rowHue = hue + (r - numRows / 2) * 6;
    for (let c = 0; c < numCols; c++) {
      const val = gridRows[r][c] || 0;
      const cx = Math.round(padX + c * cellW + gap);
      const cy = Math.round(gridYOff + r * cellH + gap);
      const cw = Math.max(1, Math.round(cellW - gap * 2));
      const ch = Math.max(1, Math.round(cellH - gap * 2));
      if (val > 0) {
        const [cr, cg, cb] = hslToRgb(rowHue, 1.0, 0.50 + val * 0.25);
        fillRect(px, W, cx, cy, cw, ch, cr, cg, cb, 0.40 + val * 0.60);
      } else {
        fillRect(px, W, cx, cy, cw, ch, ar, ag, ab, 0.05);
      }
    }
  }

  // BPM number — large pixel digits, centered
  const bpmStr = String(bpm);
  const digitScale = bpmStr.length <= 3 ? 16 : 12;
  const digitW = bpmStr.length * 6 * digitScale - digitScale; // total width
  const bpmX = Math.round((W - digitW) / 2);
  const bpmY = 570;
  drawText(px, W, bpmStr, bpmX, bpmY, digitScale, br, bg, bb);

  // "BPM" label in smaller pixels, centered below number
  const labelScale = 5;
  const labelW = 3 * 6 * labelScale - labelScale;
  const labelX = Math.round((W - labelW) / 2);
  const labelY = bpmY + 7 * digitScale + 14;
  drawText(px, W, "BPM", labelX, labelY, labelScale, br, bg, bb, 0.55);

  // Track name — above BPM, same color
  if (trackName) {
    const tnStr = trackName.toUpperCase();
    const tnScale = tnStr.length > 16 ? 3 : tnStr.length > 10 ? 4 : 5;
    const tnW = tnStr.length * 6 * tnScale - tnScale;
    const tnX = Math.round((W - tnW) / 2);
    const tnY = bpmY - 30;
    drawText(px, W, tnStr, tnX, tnY, tnScale, br, bg, bb, 0.8);
  }

  // Thin separator line between grid and BPM
  const sepY = trackName ? bpmY - 55 : bpmY - 18;
  fillRect(px, W, padX, sepY, gridW, 1, ar, ag, ab, 0.20);

  return encodePng(px, W, H);
}

/** Escape for HTML/SVG attributes. */
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const BOT_RE = /bot|crawl|spider|preview|fetch|slack|discord|telegram|whatsapp|facebook|twitter|linkedin|signal|mastodon|bluesky|cardyb|okhttp|cfnetwork/i;

export default {
  async fetch(request) {
    const url = new URL(request.url);
    let path = url.pathname.slice(1); // strip leading "/"
    if (path.startsWith("s/")) path = path.slice(2);

    // Image endpoint: /img/<payload> or /img?b=<payload> → PNG
    if (path.startsWith("img/") || path === "img") {
      const payload = path.startsWith("img/") ? path.slice(4) : (url.searchParams.get("b") || "");
      if (!payload) return new Response("Missing payload", { status: 400 });
      const png = await generatePng(payload);
      return new Response(png, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    // Root or empty (no ?b= param either) → redirect to main site
    if ((!path || path === "/" || path === "s") && !url.searchParams.get("b")) {
      return Response.redirect(APP_ORIGIN, 302);
    }

    // Support ?b= query param (new URL-safe format) with path fallback for old links
    const payload = url.searchParams.get("b") || path;
    const appUrl = `${APP_ORIGIN}/app.html?b=${payload}`;
    const { title, desc } = decodeMeta(payload);
    // Build a minimal payload for the image URL (WhatsApp/Signal reject long URLs)
    const imgPayload = (() => {
      try {
        const data = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=")));
        const mini = { bpm: data.bpm, g: data.g, tn: data.tn, de: data.de, cv: data.cv };
        return btoa(JSON.stringify(mini)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      } catch { return payload; }
    })();
    const imgUrl = `${url.origin}/img?b=${imgPayload}`;

    // Always serve OG HTML — meta refresh handles browser redirect,
    // and all crawlers (Signal, iMessage, Discord, etc.) see the OG tags.
    {
      const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<title>${esc(title)} — mpump</title>
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${esc(url.href)}" />
<meta property="og:type" content="music.song" />
<meta property="og:site_name" content="mpump" />
<meta property="og:image" content="${esc(imgUrl)}" />
<meta property="og:image:type" content="image/png" />
<meta property="og:image:width" content="800" />
<meta property="og:image:height" content="800" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(desc)}" />
<meta name="twitter:image" content="${esc(imgUrl)}" />
</head><body><p>Redirecting to <a href="${esc(appUrl)}">mpump</a>...</p>
<script>window.location.replace("${esc(appUrl)}");</script>
<noscript><meta http-equiv="refresh" content="1;url=${esc(appUrl)}"></noscript>
</body></html>`;

      return new Response(html, {
        headers: {
          "Content-Type": "text/html;charset=UTF-8",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
  },
};
