import { describe, it, expect } from "vitest";
import { encodeSharePayload, decodeSharePayload, extractPayloadFromUrl, buildShareUrl } from "../utils/shareCodec";

describe("shareCodec", () => {
  const sample = { bpm: 140, tn: "Test Beat", sw: 0.5 };

  it("round-trips through encode/decode", () => {
    const encoded = encodeSharePayload(sample);
    const decoded = decodeSharePayload(encoded);
    expect(decoded).toEqual(sample);
  });

  it("compressed payload is shorter than plain base64", () => {
    const big = { bpm: 140, g: { preview_drums: { gi: 0, pi: 0 }, preview_bass: { gi: 0, pi: 0 }, preview_synth: { gi: 0, pi: 0 } }, tn: "Some Long Track Name" };
    const compressed = encodeSharePayload(big);
    const plain = btoa(JSON.stringify(big)).replace(/=+$/, "");
    expect(compressed.length).toBeLessThan(plain.length);
  });

  it("decodes legacy plain base64 payloads", () => {
    const plain = btoa(JSON.stringify(sample)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
    const decoded = decodeSharePayload(plain);
    expect(decoded).toEqual(sample);
  });

  it("extractPayloadFromUrl finds ?z= param", () => {
    const encoded = encodeSharePayload(sample);
    const { payload, compressed } = extractPayloadFromUrl(new URL(`https://s.mpump.live/?z=${encoded}`));
    expect(compressed).toBe(true);
    expect(payload).toBe(encoded);
  });

  it("extractPayloadFromUrl finds ?b= param", () => {
    const { payload, compressed } = extractPayloadFromUrl(new URL("https://s.mpump.live/?b=eyJicG0iOjEyMH0"));
    expect(compressed).toBe(false);
    expect(payload).toBe("eyJicG0iOjEyMH0");
  });

  it("extractPayloadFromUrl prefers ?z= over ?b=", () => {
    const encoded = encodeSharePayload(sample);
    const { payload, compressed } = extractPayloadFromUrl(new URL(`https://s.mpump.live/?z=${encoded}&b=eyJicG0iOjEyMH0`));
    expect(compressed).toBe(true);
    expect(payload).toBe(encoded);
  });

  it("extractPayloadFromUrl falls back to hash", () => {
    const { payload, compressed } = extractPayloadFromUrl(new URL("https://mpump.live/app.html#eyJicG0iOjEyMH0"));
    expect(compressed).toBe(false);
    expect(payload).toBe("eyJicG0iOjEyMH0");
  });

  it("buildShareUrl produces ?z= URL", () => {
    const url = buildShareUrl(sample);
    expect(url).toMatch(/^https:\/\/s\.mpump\.live\/\?z=/);
    // Round-trip: extract and decode
    const { payload } = extractPayloadFromUrl(new URL(url));
    expect(decodeSharePayload(payload)).toEqual(sample);
  });

  it("handles URL-safe base64 characters correctly", () => {
    // Object that produces +, /, = in standard base64
    const tricky = { bpm: 255, tn: "~!@#$%^&*()_+{}|:<>?" };
    const encoded = encodeSharePayload(tricky);
    expect(encoded).not.toMatch(/[+/=]/);
    expect(decodeSharePayload(encoded)).toEqual(tricky);
  });
});
