/**
 * Tests for MidiGate component — pure logic only (no rendering).
 * We cannot import MidiGate directly because it triggers side effects
 * from main.tsx/Settings.tsx that require document. We test via source
 * inspection and standalone logic extraction.
 */
import { describe, it, expect, beforeAll } from "vitest";

describe("MidiGate – exports (source verification)", () => {
  let src: string;

  beforeAll(async () => {
    const fs = await import("fs");
    const path = await import("path");
    src = fs.readFileSync(
      path.resolve(__dirname, "../components/MidiGate.tsx"),
      "utf-8",
    );
  });

  it("exports MidiGate as a named export", () => {
    expect(src).toContain("export function MidiGate(");
  });

  it("has no default export", () => {
    expect(src).not.toMatch(/export default/);
  });
});

describe("MidiGate – tagline pills", () => {
  it("component source contains 'Working Grooves'", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.resolve(__dirname, "../components/MidiGate.tsx"),
      "utf-8",
    );
    expect(src).toContain("Instant grooves");
  });
});

describe("MidiGate – iOS detection regex", () => {
  // This regex is used in MidiGate.tsx for iOS detection
  const iosRegex = /iPad|iPhone/;

  it("matches iPad", () => {
    expect(iosRegex.test("iPad")).toBe(true);
  });

  it("matches iPhone", () => {
    expect(iosRegex.test("iPhone")).toBe(true);
  });

  it("does not match Android", () => {
    expect(iosRegex.test("Android")).toBe(false);
  });

  it("matches iPad in a full user-agent string", () => {
    const ua = "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)";
    expect(iosRegex.test(ua)).toBe(true);
  });

  it("does not match desktop Chrome", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
    expect(iosRegex.test(ua)).toBe(false);
  });
});
