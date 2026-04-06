/**
 * Integration tests for the Cloudflare share-link worker (s.mpump.live).
 * These hit the live deployed worker and only run when RUN_INTEGRATION=1.
 */
import { describe, it, expect } from "vitest";
import pako from "pako";

const WORKER_URL = "https://s.mpump.live";
const SAMPLE_PAYLOAD = "eyJicG0iOjEyMH0"; // {"bpm":120}
const RUN_INTEGRATION = process.env.RUN_INTEGRATION === "1";

/** Compress an object the same way shareCodec does. */
function compressPayload(obj: object): string {
  const json = JSON.stringify(obj);
  const compressed = pako.deflate(new TextEncoder().encode(json));
  let binary = "";
  for (let i = 0; i < compressed.length; i++) binary += String.fromCharCode(compressed[i]);
  return btoa(binary).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

describe.skipIf(!RUN_INTEGRATION)("share worker (live)", () => {
  it("returns OG HTML for share link", async () => {
    const res = await fetch(`${WORKER_URL}/?b=${SAMPLE_PAYLOAD}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('og:title');
    expect(html).toContain('og:image');
    expect(html).toContain("120 BPM");
  });

  it("sets cache-control on OG HTML", async () => {
    const res = await fetch(`${WORKER_URL}/?b=${SAMPLE_PAYLOAD}`);
    const cc = res.headers.get("cache-control");
    expect(cc).toContain("public");
    expect(cc).toContain("max-age=");
  });

  it("returns PNG for /img endpoint", async () => {
    const res = await fetch(`${WORKER_URL}/img?b=${SAMPLE_PAYLOAD}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    const buf = await res.arrayBuffer();
    // PNG magic bytes: 137 80 78 71
    const sig = new Uint8Array(buf.slice(0, 4));
    expect(sig[0]).toBe(137);
    expect(sig[1]).toBe(80);
    expect(sig[2]).toBe(78);
    expect(sig[3]).toBe(71);
  });

  it("sets long cache-control on PNG", async () => {
    const res = await fetch(`${WORKER_URL}/img?b=${SAMPLE_PAYLOAD}`);
    const cc = res.headers.get("cache-control");
    expect(cc).toContain("max-age=604800");
  });

  it("redirects root to mpump.live", async () => {
    const res = await fetch(WORKER_URL, { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("mpump.live");
  });

  it("returns 400 for /img without payload", async () => {
    const res = await fetch(`${WORKER_URL}/img`);
    expect(res.status).toBe(400);
  });

  it("includes track name in OG title when present", async () => {
    // {"bpm":130,"tn":"Test Track"}
    const payload = btoa(JSON.stringify({ bpm: 130, tn: "Test Track" }));
    const res = await fetch(`${WORKER_URL}/?b=${payload}`);
    const html = await res.text();
    expect(html).toContain("Test Track");
    expect(html).toContain("130 BPM");
  });

  it("returns OG HTML for compressed ?z= share link", async () => {
    const z = compressPayload({ bpm: 145, tn: "Compressed Beat" });
    const res = await fetch(`${WORKER_URL}/?z=${z}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("og:title");
    expect(html).toContain("Compressed Beat");
    expect(html).toContain("145 BPM");
  });

  it("compressed ?z= link redirects to app with ?z= param", async () => {
    const z = compressPayload({ bpm: 120 });
    const res = await fetch(`${WORKER_URL}/?z=${z}`);
    const html = await res.text();
    expect(html).toContain(`app.html?z=${z}`);
  });

  it("old ?b= links still work after compression feature", async () => {
    const res = await fetch(`${WORKER_URL}/?b=${SAMPLE_PAYLOAD}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("120 BPM");
  });

  // --- /shorten, /track, /stats, ?nc ---

  let testBeatId: string | null = null;

  it("POST /shorten creates a short URL", async () => {
    const payload = compressPayload({ bpm: 999, tn: "Test Only" });
    const url = `https://mpump.live/?z=${payload}`;
    const res = await fetch(`${WORKER_URL}/shorten`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { id: string; short: string };
    expect(data.id).toMatch(/^[a-z0-9]{4,8}$/);
    expect(data.short).toContain(data.id);
    testBeatId = data.id;
  });

  it("POST /shorten deduplicates same payload", async () => {
    const payload = compressPayload({ bpm: 999, tn: "Test Only" });
    const url = `https://mpump.live/?z=${payload}`;
    const res = await fetch(`${WORKER_URL}/shorten`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json() as { id: string };
    expect(data.id).toBe(testBeatId);
  });

  it("POST /shorten returns 400 without url", async () => {
    const res = await fetch(`${WORKER_URL}/shorten`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("short URL resolves and returns OG HTML", async () => {
    if (!testBeatId) return;
    const res = await fetch(`${WORKER_URL}/${testBeatId}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("og:title");
    expect(html).toContain("999 BPM");
  });

  it("?nc skips play count increment", async () => {
    if (!testBeatId) return;
    // Wait for any prior KV writes to settle
    await new Promise(r => setTimeout(r, 1000));
    const before = await fetch(`${WORKER_URL}/stats`).then(r => r.json()) as { beats: { id: string; plays: number }[] };
    const beatBefore = before.beats.find((b: { id: string }) => b.id === testBeatId);
    const playsBefore = beatBefore?.plays ?? 0;

    // Open with ?nc — should NOT increment
    await fetch(`${WORKER_URL}/${testBeatId}?nc`);
    await new Promise(r => setTimeout(r, 1000));

    const after = await fetch(`${WORKER_URL}/stats`).then(r => r.json()) as { beats: { id: string; plays: number }[] };
    const beatAfter = after.beats.find((b: { id: string }) => b.id === testBeatId);
    expect(beatAfter?.plays ?? 0).toBe(playsBefore);
  });

  it("POST /track increments share counter", async () => {
    if (!testBeatId) return;
    const res = await fetch(`${WORKER_URL}/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: testBeatId }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { ok: boolean };
    expect(data.ok).toBe(true);
  });

  it("POST /track returns 400 without id", async () => {
    const res = await fetch(`${WORKER_URL}/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("GET /stats returns beats with counters", async () => {
    const res = await fetch(`${WORKER_URL}/stats`);
    expect(res.status).toBe(200);
    const data = await res.json() as { beats: unknown[]; totals: { plays: number; remixes: number; shares: number }; count: number };
    expect(data.count).toBeGreaterThan(0);
    expect(data.beats).toBeInstanceOf(Array);
    expect(data.totals).toHaveProperty("plays");
    expect(data.totals).toHaveProperty("remixes");
    expect(data.totals).toHaveProperty("shares");
  });

  it("GET /health returns ok", async () => {
    const res = await fetch(`${WORKER_URL}/health`);
    expect(res.status).toBe(200);
    const data = await res.json() as { ok: boolean };
    expect(data.ok).toBe(true);
  });
});
