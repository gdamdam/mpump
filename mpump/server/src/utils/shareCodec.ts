import pako from "pako";

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

/** Decode a share payload string. Auto-detects compressed vs plain. */
export function decodeSharePayload(payload: string): unknown {
  const b64 = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  // Deflate streams start with 0x78 (zlib header)
  if (bytes.length > 2 && bytes[0] === 0x78) {
    const decompressed = pako.inflate(bytes, { to: "string" });
    return JSON.parse(decompressed);
  }
  // Plain JSON base64
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
