/**
 * Integration tests for the Cloudflare share-link worker (s.mpump.live).
 * These hit the live deployed worker — skip in CI with SKIP_INTEGRATION=1.
 */
import { describe, it, expect } from "vitest";

const WORKER_URL = "https://s.mpump.live";
const SAMPLE_PAYLOAD = "eyJicG0iOjEyMH0"; // {"bpm":120}
const SKIP = !!process.env.SKIP_INTEGRATION;

describe.skipIf(SKIP)("share worker (live)", () => {
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
});
