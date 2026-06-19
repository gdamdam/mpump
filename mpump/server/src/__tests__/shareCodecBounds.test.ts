/**
 * Tests for share-link decode bounds — guards against decompression bombs and
 * oversized payloads exhausting tab memory when a hostile link is opened.
 */
import { describe, it, expect } from "vitest";
import { encodeSharePayload, decodeSharePayload, MAX_PAYLOAD_CHARS } from "../utils/shareCodec";

describe("shareCodec decode bounds", () => {
  it("rejects an oversized payload string before attempting to decode", () => {
    const huge = "A".repeat(MAX_PAYLOAD_CHARS + 1);
    expect(() => decodeSharePayload(huge)).toThrow();
  });

  it("rejects a decompression bomb that inflates past the output ceiling", () => {
    // Highly compressible input: tiny compressed string, enormous inflated output.
    const bomb = encodeSharePayload({ x: "a".repeat(3_000_000) });
    expect(bomb.length).toBeLessThan(MAX_PAYLOAD_CHARS); // input is small...
    expect(() => decodeSharePayload(bomb)).toThrow();     // ...but inflated output is bounded
  });

  it("still round-trips a normal-sized payload", () => {
    const p = { bpm: 140, g: { preview_drums: { gi: 0, pi: 0 } } };
    expect(decodeSharePayload(encodeSharePayload(p))).toEqual(p);
  });
});
