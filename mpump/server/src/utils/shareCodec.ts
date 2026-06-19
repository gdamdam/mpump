import pako from "pako";

/** Max length of an incoming payload string. A maxed-out legitimate session
 *  compresses to a few KB of base64; anything far larger is hostile. */
export const MAX_PAYLOAD_CHARS = 32_000;
/** Ceiling on inflated output (chars). Guards against decompression bombs:
 *  a few KB of deflate can otherwise expand to hundreds of MB and OOM the tab. */
export const MAX_DECOMPRESSED_CHARS = 1_000_000;

// --- Encoding: JSON → compressed URL-safe base64 ---

/** Compress an object to URL-safe base64 (deflate + b64). */
export function encodeSharePayload(obj: object): string {
  const json = JSON.stringify(obj);
  const compressed = pako.deflate(new TextEncoder().encode(json));
  return uint8ToUrlSafeB64(compressed);
}

function uint8ToUrlSafeB64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

// --- Decoding: supports both ?z= (compressed) and ?b= (legacy plain base64) ---

/** Inflate with a hard ceiling on output size — aborts a decompression bomb
 *  before it can allocate unbounded memory. */
function inflateBounded(bytes: Uint8Array, maxChars: number): string {
  const inflator = new pako.Inflate({ to: "string" });
  let out = "";
  let aborted = false;
  inflator.onData = (chunk: unknown) => {
    out += chunk as string;
    if (out.length > maxChars) { aborted = true; throw new RangeError("share payload too large"); }
  };
  inflator.onEnd = () => { /* output accumulated in onData */ };
  try {
    inflator.push(bytes, true);
  } catch (e) {
    if (aborted) throw new RangeError("share payload too large");
    throw e;
  }
  if (inflator.err) throw new Error("invalid share payload");
  return out;
}

/** Decode a share payload string. Auto-detects compressed vs plain. */
export function decodeSharePayload(payload: string): unknown {
  if (payload.length > MAX_PAYLOAD_CHARS) throw new RangeError("share payload too large");
  const b64 = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  // Deflate streams start with 0x78 (zlib header)
  if (bytes.length > 2 && bytes[0] === 0x78) {
    return JSON.parse(inflateBounded(bytes, MAX_DECOMPRESSED_CHARS));
  }
  // Plain JSON base64 (input is already length-capped above)
  return JSON.parse(binary);
}

/** Extract the raw payload string from a URL, checking ?z= first, then ?b=, then hash. */
export function extractPayloadFromUrl(url: string | URL): { payload: string; compressed: boolean } {
  const u = typeof url === "string" ? new URL(url) : url;
  const z = (u.searchParams.get("z") || "").replace(/ /g, "+");
  if (z) return { payload: z, compressed: true };
  const b = (u.searchParams.get("b") || "").replace(/ /g, "+");
  if (b) return { payload: b, compressed: false };
  const hash = u.hash.length > 1 ? u.hash.slice(1) : "";
  return { payload: hash, compressed: false };
}

/** Build a share URL using compressed encoding. */
export function buildShareUrl(obj: object): string {
  return `https://s.mpump.live/?z=${encodeSharePayload(obj)}`;
}
