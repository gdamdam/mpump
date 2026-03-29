import { describe, it, expect, vi, beforeEach } from "vitest";
import { trackEvent } from "../utils/metrics";

describe("trackEvent", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {});
  });

  it("calls goatcounter.count when available", () => {
    const countFn = vi.fn();
    (window as unknown as Record<string, unknown>).goatcounter = { count: countFn };
    trackEvent("test-event");
    expect(countFn).toHaveBeenCalledWith({ path: "event/test-event", event: true });
  });

  it("does not throw when goatcounter is missing", () => {
    (window as unknown as Record<string, unknown>).goatcounter = undefined;
    expect(() => trackEvent("test-event")).not.toThrow();
  });

  it("does not throw when goatcounter.count is missing", () => {
    (window as unknown as Record<string, unknown>).goatcounter = {};
    expect(() => trackEvent("test-event")).not.toThrow();
  });
});
