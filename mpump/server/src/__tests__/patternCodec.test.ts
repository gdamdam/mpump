/**
 * Tests for share URL codec: pattern encoding/decoding, gesture encoding,
 * payload validation, and synth params compact encoding.
 */
import { describe, it, expect } from "vitest";
import {
  encodeSteps, decodeSteps,
  encodeDrumSteps, decodeDrumSteps,
  encodeGesture, decodeGesture, gestureUrlFit,
  validateSharePayload,
  encodeSynthParamsCompact, decodeSynthParamsCompact,
} from "../utils/patternCodec";
import type { StepData, DrumHit } from "../types";

// ── helpers ──────────────────────────────────────────────────────────────

const mkStep = (semi: number, vel: number, slide = false): StepData => ({ semi, vel, slide });
const mkHit = (note: number, vel: number): DrumHit => ({ note, vel });

const minimalPayload = (overrides: Record<string, unknown> = {}) => ({
  bpm: 120,
  g: { techno: { gi: 0, pi: 0 } },
  ...overrides,
});

// ── encodeSteps / decodeSteps ────────────────────────────────────────────

describe("encodeSteps / decodeSteps", () => {
  it("round-trips an empty pattern (all nulls)", () => {
    const steps: (StepData | null)[] = Array(16).fill(null);
    expect(decodeSteps(encodeSteps(steps))).toEqual(steps);
  });

  it("round-trips a single note", () => {
    const steps: (StepData | null)[] = Array(16).fill(null);
    steps[0] = mkStep(5, 100);
    expect(decodeSteps(encodeSteps(steps))).toEqual(steps);
  });

  it("round-trips a full 16-step pattern", () => {
    const steps = Array.from({ length: 16 }, (_, i) => mkStep(i - 8, 64 + i, i % 3 === 0));
    expect(decodeSteps(encodeSteps(steps))).toEqual(steps);
  });

  it("round-trips steps with slide flag", () => {
    const steps: (StepData | null)[] = [mkStep(0, 80, true), mkStep(3, 90, false), null];
    expect(decodeSteps(encodeSteps(steps))).toEqual(steps);
  });

  it("clamps edge values on decode (0 vel, max semitone)", () => {
    const encoded = "48,0,0|-48,127,1|99,999,0";
    const decoded = decodeSteps(encoded);
    expect(decoded[0]).toEqual({ semi: 48, vel: 0, slide: false });
    expect(decoded[1]).toEqual({ semi: -48, vel: 127, slide: true });
    // out-of-range values get clamped
    expect(decoded[2]!.semi).toBe(48);
    expect(decoded[2]!.vel).toBe(127);
  });

  it("returns empty array if >64 steps", () => {
    const huge = Array(65).fill("0,60,0").join("|");
    expect(decodeSteps(huge)).toEqual([]);
  });

  it("returns null for malformed entries", () => {
    expect(decodeSteps("abc,def,0")).toEqual([null]);
  });
});

// ── encodeDrumSteps / decodeDrumSteps ────────────────────────────────────

describe("encodeDrumSteps / decodeDrumSteps", () => {
  it("round-trips an empty pattern (all empty arrays)", () => {
    const steps: DrumHit[][] = Array.from({ length: 16 }, () => []);
    expect(decodeDrumSteps(encodeDrumSteps(steps))).toEqual(steps);
  });

  it("round-trips a single hit", () => {
    const steps: DrumHit[][] = Array.from({ length: 4 }, () => []);
    steps[0] = [mkHit(36, 100)];
    expect(decodeDrumSteps(encodeDrumSteps(steps))).toEqual(steps);
  });

  it("round-trips multi-hit steps", () => {
    const steps: DrumHit[][] = [
      [mkHit(36, 100), mkHit(42, 80)],
      [],
      [mkHit(38, 90)],
      [mkHit(36, 100), mkHit(38, 80), mkHit(42, 60)],
    ];
    expect(decodeDrumSteps(encodeDrumSteps(steps))).toEqual(steps);
  });

  it("clamps note and velocity on decode", () => {
    const decoded = decodeDrumSteps("200.200");
    expect(decoded[0][0]).toEqual({ note: 127, vel: 127 });
  });

  it("returns empty array if >64 steps", () => {
    const huge = Array(65).fill("36.100").join("|");
    expect(decodeDrumSteps(huge)).toEqual([]);
  });
});

// ── encodeGesture / decodeGesture ────────────────────────────────────────

describe("encodeGesture / decodeGesture", () => {
  it("round-trips an empty gesture", () => {
    expect(decodeGesture(encodeGesture([]))).toEqual([]);
  });

  it("round-trips a single point", () => {
    const pts = [{ t: 100, x: 0.5, y: 0.75 }];
    const decoded = decodeGesture(encodeGesture(pts));
    expect(decoded).toHaveLength(1);
    expect(decoded[0].t).toBe(100);
    expect(decoded[0].x).toBeCloseTo(0.5, 3);
    expect(decoded[0].y).toBeCloseTo(0.75, 3);
  });

  it("round-trips 30 points (URL threshold)", () => {
    const pts = Array.from({ length: 30 }, (_, i) => ({
      t: i * 50, x: i / 30, y: 1 - i / 30,
    }));
    const decoded = decodeGesture(encodeGesture(pts));
    expect(decoded).toHaveLength(30);
    expect(gestureUrlFit(pts)).toBe(true);
  });

  it("clamps coordinates to 0–1 on decode", () => {
    const decoded = decodeGesture("0,-0.5,1.5");
    expect(decoded[0].x).toBe(0);
    expect(decoded[0].y).toBe(1);
  });

  it("returns empty array if >500 points", () => {
    const huge = Array(501).fill("0,0.5,0.5").join("|");
    expect(decodeGesture(huge)).toEqual([]);
  });

  it("gestureUrlFit returns false for >30 points", () => {
    const pts = Array.from({ length: 31 }, () => ({ t: 0, x: 0, y: 0 }));
    expect(gestureUrlFit(pts)).toBe(false);
  });
});

// ── validateSharePayload ─────────────────────────────────────────────────

describe("validateSharePayload", () => {
  it("accepts a valid minimal payload", () => {
    const result = validateSharePayload(minimalPayload());
    expect(result).not.toBeNull();
    expect(result!.bpm).toBe(120);
    expect(result!.g.techno).toEqual({ gi: 0, pi: 0, bgi: undefined, bpi: undefined });
  });

  it("accepts a valid full payload", () => {
    const result = validateSharePayload({
      bpm: 140, sw: 0.6, dk: "T-8", sp: "S-1", bp: "S-1",
      g: { techno: { gi: 1, pi: 3, bgi: 2, bpi: 5 } },
      fx: "10110000", me: "0,60,0|-", de: "36.100|-",
      mu: "010", cv: "80,70,90",
      eo: ["delay", "reverb"],
      fp: { delay: { time: 0.3, feedback: 0.4 } },
    });
    expect(result).not.toBeNull();
    expect(result!.sw).toBeCloseTo(0.6);
    expect(result!.fx).toBe("10110000");
    expect(result!.mu).toBe("010");
    expect(result!.cv).toBe("80,70,90");
    expect(result!.eo).toEqual(["delay", "reverb"]);
  });

  it("rejects non-object input", () => {
    expect(validateSharePayload(null)).toBeNull();
    expect(validateSharePayload("string")).toBeNull();
    expect(validateSharePayload(42)).toBeNull();
    expect(validateSharePayload(undefined)).toBeNull();
  });

  it("rejects __proto__ key (prototype pollution)", () => {
    const payload = minimalPayload();
    (payload as any).__proto__ = { bad: true };
    // Object.keys won't include __proto__ from assignment, so build with defineProperty
    const obj = { bpm: 120, g: { techno: { gi: 0, pi: 0 } } };
    Object.defineProperty(obj, "__proto__", { value: {}, enumerable: true });
    expect(validateSharePayload(obj)).toBeNull();
  });

  it("rejects constructor key (prototype pollution)", () => {
    const obj: any = { bpm: 120, g: { techno: { gi: 0, pi: 0 } }, constructor: {} };
    Object.defineProperty(obj, "constructor", { enumerable: true, value: {} });
    expect(validateSharePayload(obj)).toBeNull();
  });

  it("clamps BPM to 20–300", () => {
    expect(validateSharePayload(minimalPayload({ bpm: 5 }))!.bpm).toBe(20);
    expect(validateSharePayload(minimalPayload({ bpm: 999 }))!.bpm).toBe(300);
  });

  it("clamps swing to 0–1", () => {
    expect(validateSharePayload(minimalPayload({ sw: -0.5 }))!.sw).toBe(0);
    expect(validateSharePayload(minimalPayload({ sw: 2.0 }))!.sw).toBe(1);
  });

  it("rejects missing BPM", () => {
    expect(validateSharePayload({ g: { techno: { gi: 0, pi: 0 } } })).toBeNull();
  });

  it("rejects missing genres", () => {
    expect(validateSharePayload({ bpm: 120 })).toBeNull();
    expect(validateSharePayload({ bpm: 120, g: {} })).toBeNull();
  });

  it("rejects oversized pattern strings (>4000 chars)", () => {
    const long = "x".repeat(4001);
    const result = validateSharePayload(minimalPayload({ me: long }));
    expect(result).not.toBeNull();
    expect(result!.me).toBeUndefined(); // oversized string silently dropped
  });

  it("rejects invalid fx bitmask", () => {
    const result = validateSharePayload(minimalPayload({ fx: "abc" }));
    expect(result!.fx).toBeUndefined();
  });

  it("filters unknown effect names from eo", () => {
    const result = validateSharePayload(minimalPayload({ eo: ["delay", "bogus", "reverb"] }));
    expect(result!.eo).toEqual(["delay", "reverb"]);
  });

  it("rejects invalid mute string", () => {
    const result = validateSharePayload(minimalPayload({ mu: "222" }));
    expect(result!.mu).toBeUndefined();
  });
});

// ── encodeSynthParamsCompact / decodeSynthParamsCompact ───────────────────

describe("encodeSynthParamsCompact / decodeSynthParamsCompact", () => {
  it("omits values equal to defaults", () => {
    const encoded = encodeSynthParamsCompact({ oscType: "sawtooth", attack: 0.005 });
    expect(encoded).toEqual({}); // both are defaults
  });

  it("includes values different from defaults", () => {
    const encoded = encodeSynthParamsCompact({ oscType: "square", cutoff: 2000 });
    expect(encoded).toEqual({ ot: "square", co: 2000 });
  });

  it("round-trips non-default params", () => {
    const params = { oscType: "square", cutoff: 2000, resonance: 8, lfoOn: true };
    const decoded = decodeSynthParamsCompact(encodeSynthParamsCompact(params));
    expect(decoded.oscType).toBe("square");
    expect(decoded.cutoff).toBe(2000);
    expect(decoded.resonance).toBe(8);
    expect(decoded.lfoOn).toBe(true);
    // defaults still present
    expect(decoded.attack).toBe(0.005);
    expect(decoded.sustain).toBe(0.6);
  });

  it("ignores unknown keys", () => {
    const encoded = encodeSynthParamsCompact({ unknownKey: 42 } as any);
    expect(encoded).toEqual({});
  });
});
