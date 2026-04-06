/**
 * mpump share link Worker — serves dynamic OG tags + PNG images for messaging app previews.
 *
 * Routes:
 *   s.mpump.live/<payload>       → OG HTML (bots) or 302 redirect (browsers)
 *   s.mpump.live/img/<payload>   → Dynamic PNG card image (800×800)
 */

const APP_ORIGIN = "https://mpump.live";

/** Decompress a ?z= payload (deflate + url-safe b64) to plain url-safe b64. */
async function decompressPayload(z) {
  try {
    const b64 = z.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(z.length / 4) * 4, "=");
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const ds = new DecompressionStream("deflate");
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const reader = ds.readable.getReader();
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) { result.set(c, offset); offset += c.length; }
    const json = new TextDecoder().decode(result);
    return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch (e) {
    console.error("decompressPayload failed:", e);
    return z; // fallback: pass through as-is
  }
}

/** Try to decode as plain base64 JSON — returns true if valid, false if likely compressed. */
function tryDecodeB64(payload) {
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const json = atob(padded);
    JSON.parse(json);
    return true;
  } catch { return false; }
}

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
/** Escape for use inside JS string literals in script tags. */
function escJs(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/<\//g, "<\\/");
}

const BOT_RE = /bot|crawl|spider|preview|fetch|slack|discord|telegram|whatsapp|facebook|twitter|linkedin|signal|mastodon|bluesky|cardyb|okhttp|cfnetwork/i;

/** Pattern for valid short beat IDs. */
const ID_RE = /^[a-z0-9]{4,8}$/;

/** Paginate through all KV keys matching an optional prefix. */
async function listKVKeys(env, options = {}) {
  const keys = [];
  let cursor;
  do {
    const page = await env.BEATS.list({ ...options, cursor, limit: 1000 });
    keys.push(...page.keys);
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return keys;
}

/** Generate a random 6-char alphanumeric ID. */
function generateId() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, b => chars[b % chars.length]).join("");
}

/** CORS headers for API endpoints. */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    // Health check
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    // Dashboard
    if (url.pathname === "/dshbrd" && request.method === "GET") {
      return handleDashboard(env);
    }

    // Stats API
    if (url.pathname === "/stats" && request.method === "GET") {
      return handleStats(env);
    }

    // Error reporting endpoint
    if (url.pathname === "/error" && request.method === "POST") {
      try {
        const { message, stack, ua } = await request.json();
        if (env.ANALYTICS) {
          env.ANALYTICS.writeDataPoint({
            blobs: ["error", message || "unknown", stack || "", ua || ""],
            doubles: [1],
          });
        }
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json", ...CORS },
        });
      } catch {
        return new Response(null, { status: 204, headers: CORS });
      }
    }

    // Track endpoint — increment share counter
    if (url.pathname === "/track" && request.method === "POST") {
      try {
        const { id } = await request.json();
        if (!id || typeof id !== "string") {
          return new Response(JSON.stringify({ error: "Missing id" }), {
            status: 400, headers: { "Content-Type": "application/json", ...CORS },
          });
        }
        const key = `sc:${id}`;
        const current = parseInt(await env.BEATS.get(key) || "0", 10);
        ctx.waitUntil(env.BEATS.put(key, String(current + 1)));
        if (env.ANALYTICS) env.ANALYTICS.writeDataPoint({ blobs: ["share", id], doubles: [1] });
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json", ...CORS },
        });
      } catch {
        return new Response(JSON.stringify({ error: "Bad request" }), {
          status: 400, headers: { "Content-Type": "application/json", ...CORS },
        });
      }
    }

    // Shorten endpoint
    if (url.pathname === "/shorten" && request.method === "POST") {
      return handleShorten(request, env);
    }

    // Submit to Discover — must be before short-URL regex (6 chars matches)
    if (url.pathname === "/submit" && request.method === "POST") {
      return handleSubmit(request, env);
    }

    // Dismiss a submission (delete sub:{id})
    if (url.pathname === "/submit" && request.method === "DELETE") {
      try {
        const { id } = await request.json();
        if (!id || typeof id !== "string" || !ID_RE.test(id)) {
          return new Response(JSON.stringify({ error: "Invalid id" }), {
            status: 400, headers: { "Content-Type": "application/json", ...CORS },
          });
        }
        await env.BEATS.delete(`sub:${id}`);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json", ...CORS },
        });
      } catch {
        return new Response(JSON.stringify({ error: "Bad request" }), {
          status: 400, headers: { "Content-Type": "application/json", ...CORS },
        });
      }
    }

    // List submissions (unlinked admin endpoint)
    if (url.pathname === "/submissions" && request.method === "GET") {
      return handleSubmissions(env);
    }

    // Short URL resolution (4-8 char alphanumeric path)
    const shortPath = url.pathname.slice(1);
    if (ID_RE.test(shortPath) && env.BEATS) {
      return handleShortUrl(shortPath, url, request, env, ctx);
    }

    // Only cache GET requests for existing payload flow
    if (request.method === "GET") {
      const cache = caches.default;
      const cached = await cache.match(request);
      if (cached) return cached;
    }

    const response = await handleRequest(url);

    // Cache successful GET responses
    if (request.method === "GET" && response.status === 200) {
      try { caches.default.put(request, response.clone()); } catch {}
    }

    return response;
  },
};

/** POST /shorten — create a short URL for a beat. Deduplicates by payload hash. */
async function handleShorten(request, env) {
  try {
    const body = await request.json();
    const { url, parent } = body;
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "Missing url" }), {
        status: 400, headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    // Deduplicate: hash the payload and check if it already exists
    const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(url));
    const hashHex = [...new Uint8Array(hashBuf)].map(b => b.toString(16).padStart(2, "0")).join("");
    const hashKey = `hash:${hashHex}`;
    const existingId = await env.BEATS.get(hashKey);
    if (existingId) {
      return new Response(JSON.stringify({ id: existingId, short: `https://s.mpump.live/${existingId}` }), {
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    // Generate unique ID (retry on collision)
    let id;
    for (let i = 0; i < 5; i++) {
      id = generateId();
      const existing = await env.BEATS.get(`beat:${id}`);
      if (!existing) break;
      if (i === 4) {
        return new Response(JSON.stringify({ error: "ID collision" }), {
          status: 500, headers: { "Content-Type": "application/json", ...CORS },
        });
      }
    }

    // Store beat + hash→id mapping
    await Promise.all([
      env.BEATS.put(`beat:${id}`, JSON.stringify({
        url,
        parent: parent || null,
        created: new Date().toISOString(),
      })),
      env.BEATS.put(hashKey, id),
    ]);

    // sc: incremented via /track when user copies link or uses native share
    if (env.ANALYTICS) env.ANALYTICS.writeDataPoint({ blobs: ["create", id], doubles: [1] });

    // Increment parent's remix count only if payload differs
    if (parent && typeof parent === "string") {
      const parentData = await env.BEATS.get(`beat:${parent}`);
      if (parentData) {
        const parentBeat = JSON.parse(parentData);
        if (parentBeat.url !== url) {
          const countKey = `rc:${parent}`;
          const current = parseInt(await env.BEATS.get(countKey) || "0", 10);
          await env.BEATS.put(countKey, String(current + 1));
          if (env.ANALYTICS) env.ANALYTICS.writeDataPoint({ blobs: ["remix", parent, id], doubles: [1] });
        }
      }
    }

    const short = `https://s.mpump.live/${id}`;
    return new Response(JSON.stringify({ id, short }), {
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400, headers: { "Content-Type": "application/json", ...CORS },
    });
  }
}

/** Resolve a short URL — serve OG tags to bots, redirect browsers. */
/** GET /dashboard — HTML dashboard. */
async function handleDashboard(env) {
  const statsRes = await handleStats(env);
  const data = await statsRes.json();
  const { beats, totals, count } = data;

  const rows = beats.map(b => `
    <tr>
      <td><a href="https://s.mpump.live/${b.id}?nc" target="_blank">${b.id}</a></td>
      <td>${(b.created || "").slice(0, 10)}</td>
      <td>${b.plays}</td>
      <td>${b.remixes}</td>
      <td>${b.shares}</td>
      <td>${b.parent ? `<a href="https://s.mpump.live/${b.parent}?nc" target="_blank">${b.parent}</a>` : "—"}</td>
      <td><div style="background:#6c5ce7;height:14px;width:${Math.min(b.plays * 8, 200)}px;border-radius:3px"></div></td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>mpump stats</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,system-ui,sans-serif; background:#0a0a0a; color:#e0e0e0; padding:24px; }
  h1 { font-size:20px; margin-bottom:24px; color:#fff; }
  .cards { display:flex; gap:16px; margin-bottom:32px; flex-wrap:wrap; }
  .card { background:#1a1a2e; border-radius:12px; padding:20px 24px; min-width:140px; }
  .card .num { font-size:32px; font-weight:700; color:#6c5ce7; }
  .card .label { font-size:12px; color:#888; margin-top:4px; text-transform:uppercase; letter-spacing:1px; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th { text-align:left; padding:8px 12px; border-bottom:1px solid #333; color:#888; font-weight:500; text-transform:uppercase; font-size:11px; letter-spacing:1px; }
  td { padding:8px 12px; border-bottom:1px solid #1a1a2e; }
  tr:hover { background:#1a1a2e; }
  a { color:#6c5ce7; text-decoration:none; }
  a:hover { text-decoration:underline; }
  .updated { color:#555; font-size:11px; margin-top:24px; }
</style>
</head><body>
<h1>mpump stats</h1>
<div class="cards">
  <div class="card"><div class="num">${count}</div><div class="label">Beats</div></div>
  <div class="card"><div class="num">${totals.plays}</div><div class="label">Plays</div></div>
  <div class="card"><div class="num">${totals.remixes}</div><div class="label">Remixes</div></div>
  <div class="card"><div class="num">${totals.shares}</div><div class="label">Shares</div></div>
</div>
<table>
  <thead><tr><th>ID</th><th>Created</th><th>Plays</th><th>Remixes</th><th>Shares</th><th>Parent</th><th>Plays</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="updated">Updated ${new Date().toISOString().slice(0, 19)} UTC</div>
</body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
  });
}

/** GET /stats — return all beats with counters in one response. */
async function handleStats(env) {
  try {
    const allKeys = await listKVKeys(env);

    // Bucket keys by prefix
    const beats = {};
    const counters = { pc: {}, rc: {}, sc: {} };
    const beatKeys = [];

    for (const { name } of allKeys) {
      const [prefix, id] = [name.slice(0, name.indexOf(":")), name.slice(name.indexOf(":") + 1)];
      if (prefix === "beat") beatKeys.push({ name, id });
      else if (counters[prefix]) counters[prefix][id] = name;
    }

    // Fetch all beat data + counters in parallel
    const fetches = beatKeys.map(async ({ name, id }) => {
      const [beatJson, plays, remixes, shares] = await Promise.all([
        env.BEATS.get(name),
        env.BEATS.get(`pc:${id}`).then(v => parseInt(v || "0", 10)),
        env.BEATS.get(`rc:${id}`).then(v => parseInt(v || "0", 10)),
        env.BEATS.get(`sc:${id}`).then(v => parseInt(v || "0", 10)),
      ]);
      const beat = beatJson ? JSON.parse(beatJson) : {};
      return { id, created: beat.created || null, parent: beat.parent || null, plays, remixes, shares };
    });

    const results = await Promise.all(fetches);
    results.sort((a, b) => (b.created || "").localeCompare(a.created || ""));

    const totals = results.reduce((t, b) => {
      t.plays += b.plays; t.remixes += b.remixes; t.shares += b.shares; return t;
    }, { plays: 0, remixes: 0, shares: 0 });

    return new Response(JSON.stringify({ beats: results, totals, count: results.length }, null, 2), {
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS },
    });
  }
}

/** POST /submit — submit a beat for Discover review. Stores under sub:{id}. Does NOT auto-publish. */
async function handleSubmit(request, env) {
  try {
    const body = await request.json();
    const { id, shortUrl, title, genre, note, contact, parentId } = body;

    if (!id || typeof id !== "string" || !ID_RE.test(id)) {
      return new Response(JSON.stringify({ error: "Invalid beat ID" }), {
        status: 400, headers: { "Content-Type": "application/json", ...CORS },
      });
    }
    if (!title || typeof title !== "string" || title.trim().length === 0 || title.length > 80) {
      return new Response(JSON.stringify({ error: "Title required (max 80 chars)" }), {
        status: 400, headers: { "Content-Type": "application/json", ...CORS },
      });
    }
    if (!genre || typeof genre !== "string" || genre.trim().length === 0 || genre.length > 40) {
      return new Response(JSON.stringify({ error: "Genre required (max 40 chars)" }), {
        status: 400, headers: { "Content-Type": "application/json", ...CORS },
      });
    }
    if (note && (typeof note !== "string" || note.length > 120)) {
      return new Response(JSON.stringify({ error: "Note too long (max 120 chars)" }), {
        status: 400, headers: { "Content-Type": "application/json", ...CORS },
      });
    }
    if (contact && (typeof contact !== "string" || contact.length > 100)) {
      return new Response(JSON.stringify({ error: "Contact too long (max 100 chars)" }), {
        status: 400, headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const [beatData, existing] = await Promise.all([
      env.BEATS.get(`beat:${id}`),
      env.BEATS.get(`sub:${id}`),
    ]);

    if (!beatData) {
      return new Response(JSON.stringify({ error: "Beat not found" }), {
        status: 404, headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    if (existing) {
      return new Response(JSON.stringify({ ok: true, duplicate: true }), {
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    await env.BEATS.put(`sub:${id}`, JSON.stringify({
      id,
      shortUrl: shortUrl || `https://s.mpump.live/${id}`,
      title: title.trim(),
      genre: genre.trim(),
      note: note ? note.trim() : "",
      contact: contact ? contact.trim() : "",
      parentId: parentId || null,
      submittedAt: new Date().toISOString(),
    }));

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400, headers: { "Content-Type": "application/json", ...CORS },
    });
  }
}

/** GET /submissions — list all submissions sorted newest first. */
async function handleSubmissions(env) {
  try {
    const allKeys = await listKVKeys(env, { prefix: "sub:" });

    const submissions = await Promise.all(
      allKeys.map(({ name }) => env.BEATS.get(name).then(v => v ? JSON.parse(v) : null))
    );

    const valid = submissions.filter(Boolean);
    valid.sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));

    return new Response(JSON.stringify({ submissions: valid, count: valid.length }, null, 2), {
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS },
    });
  }
}

async function handleShortUrl(id, url, request, env, ctx) {
  const beatData = await env.BEATS.get(`beat:${id}`);
  if (!beatData) {
    return new Response("Not found", { status: 404, headers: CORS });
  }

  const beat = JSON.parse(beatData);
  const [remixCount, playCount] = await Promise.all([
    env.BEATS.get(`rc:${id}`).then(v => parseInt(v || "0", 10)),
    env.BEATS.get(`pc:${id}`).then(v => parseInt(v || "0", 10)),
  ]);

  // Increment play counter for non-bot requests (non-blocking), skip if ?nc=1
  const ua = request.headers.get("user-agent") || "";
  if (!BOT_RE.test(ua) && ctx && !url.searchParams.has("nc")) {
    ctx.waitUntil(env.BEATS.put(`pc:${id}`, String(playCount + 1)));
    if (env.ANALYTICS) env.ANALYTICS.writeDataPoint({ blobs: ["play", id], doubles: [1] });
  }

  // Extract payload from stored URL (hash fragment or query param)
  let rawPayload = "";
  let paramKey = "b";
  try {
    const storedUrl = new URL(beat.url.startsWith("http") ? beat.url : `https://mpump.live/app.html?b=${beat.url}`);
    rawPayload = storedUrl.searchParams.get("z") || storedUrl.searchParams.get("b") || storedUrl.hash.slice(1) || beat.url;
    if (storedUrl.searchParams.get("z")) paramKey = "z";
  } catch {
    rawPayload = beat.url;
  }

  const isCompressed = paramKey === "z";
  const payload = isCompressed ? await decompressPayload(rawPayload) : rawPayload;

  // Build title with remix info + play count
  const { title: baseTitle, desc: baseDesc } = decodeMeta(payload);
  const titleParts = [baseTitle];
  if (beat.parent) titleParts.push("remixed");
  if (remixCount > 0) titleParts.push(`${remixCount} remix${remixCount !== 1 ? "es" : ""}`);
  if (playCount > 100) titleParts.push(`${playCount} plays`);
  const title = titleParts.join(" · ");
  const desc = baseDesc;

  // App URL with parent reference
  const appUrl = `${APP_ORIGIN}/app.html?${paramKey}=${rawPayload}&p=${id}`;

  // Build image URL (same as existing logic)
  const imgPayload = (() => {
    try {
      const data = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=")));
      const mini = { bpm: data.bpm, g: data.g, tn: data.tn, de: data.de, cv: data.cv };
      return btoa(JSON.stringify(mini)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    } catch { return payload; }
  })();
  const imgUrl = `${url.origin}/img?b=${imgPayload}`;

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
<script>window.location.replace("${escJs(appUrl)}");</script>
<noscript><meta http-equiv="refresh" content="1;url=${esc(appUrl)}"></noscript>
</body></html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html;charset=UTF-8",
      "Cache-Control": "public, max-age=3600",
      ...CORS,
    },
  });
}

async function handleRequest(url) {
    let path = url.pathname.slice(1); // strip leading "/"
    if (path.startsWith("s/")) path = path.slice(2);

    // Image endpoint: /img/<payload> or /img?b=<payload> or /img?z=<payload> → PNG
    if (path.startsWith("img/") || path === "img") {
      const imgRawPayload = path.startsWith("img/") ? path.slice(4) : (url.searchParams.get("z") || url.searchParams.get("b") || "");
      const imgIsCompressed = !!url.searchParams.get("z") || (path.startsWith("img/") && !(await tryDecodeB64(imgRawPayload)));
      const payload = imgIsCompressed ? await decompressPayload(imgRawPayload) : imgRawPayload;
      if (!payload) return new Response("Missing payload", { status: 400 });
      const png = await generatePng(payload);
      return new Response(png, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=604800",
        },
      });
    }

    // Root or empty (no ?z= or ?b= param either) → redirect to main site
    if ((!path || path === "/" || path === "s") && !url.searchParams.get("b") && !url.searchParams.get("z")) {
      return Response.redirect(APP_ORIGIN, 302);
    }

    // Support ?z= (compressed) and ?b= (legacy) query params with path fallback for old links
    const isCompressed = !!url.searchParams.get("z");
    const rawPayload = url.searchParams.get("z") || url.searchParams.get("b") || path;
    // For compressed payloads, decompress to get the JSON, then re-encode as plain b64 for internal use
    const payload = isCompressed ? await decompressPayload(rawPayload) : rawPayload;
    const paramKey = isCompressed ? "z" : "b";
    const appUrl = `${APP_ORIGIN}/app.html?${paramKey}=${rawPayload}`;
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
<script>window.location.replace("${escJs(appUrl)}");</script>
<noscript><meta http-equiv="refresh" content="1;url=${esc(appUrl)}"></noscript>
</body></html>`;

      return new Response(html, {
        headers: {
          "Content-Type": "text/html;charset=UTF-8",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }
}
