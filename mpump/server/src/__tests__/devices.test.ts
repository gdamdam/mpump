import { describe, it, expect } from "vitest";
import { DEVICE_REGISTRY, findDeviceConfig } from "../data/devices";

describe("DEVICE_REGISTRY", () => {
  it("has 53 devices", () => {
    expect(DEVICE_REGISTRY.length).toBe(53);
  });

  it("each device has unique id", () => {
    const ids = DEVICE_REGISTRY.map(d => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each device has required fields", () => {
    for (const d of DEVICE_REGISTRY) {
      expect(d.id.length).toBeGreaterThan(0);
      expect(d.label.length).toBeGreaterThan(0);
      expect(d.portMatch.length).toBeGreaterThan(0);
      expect(["synth", "drums", "drums+bass", "bass"]).toContain(d.mode);
      expect(d.channels.main).toBeGreaterThanOrEqual(0);
      expect(d.channels.main).toBeLessThanOrEqual(15);
    }
  });

  it("preview devices exist", () => {
    expect(findDeviceConfig("preview_drums")).toBeDefined();
    expect(findDeviceConfig("preview_synth")).toBeDefined();
    expect(findDeviceConfig("preview_drums")!.mode).toBe("drums");
    expect(findDeviceConfig("preview_synth")!.mode).toBe("synth");
  });

  it("S-1, T-8, J-6 are registered", () => {
    expect(findDeviceConfig("s1")).toBeDefined();
    expect(findDeviceConfig("t8")).toBeDefined();
    expect(findDeviceConfig("j6")).toBeDefined();
  });
});
