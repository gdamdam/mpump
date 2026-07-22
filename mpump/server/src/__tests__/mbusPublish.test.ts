/**
 * mbusPublish — the "actively publishing" signal that drives local-monitor
 * muting (AudioPort) and the Settings indicator. The property that matters:
 * it must never report active without a live subscriber, or we'd silence the
 * local output while nothing is actually carrying it.
 * @vitest-environment node
 */
import { describe, it, expect, afterEach } from "vitest";
import {
  registerMbusTap,
  enableMbusPublish,
  isMbusPublishEnabled,
  isMbusActivelyPublishing,
} from "../utils/mbusPublish";

// A tap only needs to look like an AudioNode; publishOutput stores it and
// doesn't touch its graph until a subscriber actually requests it.
const fakeTap = { context: {} } as unknown as AudioNode;

afterEach(() => {
  enableMbusPublish(false); // stops the pub and disconnects the client (clears retry timers)
  registerMbusTap(null);
});

describe("isMbusActivelyPublishing", () => {
  it("is false when publishing is disabled", () => {
    registerMbusTap(fakeTap);
    expect(isMbusPublishEnabled()).toBe(false);
    expect(isMbusActivelyPublishing()).toBe(false);
  });

  it("is false while enabled but no subscriber is connected", () => {
    registerMbusTap(fakeTap);
    enableMbusPublish(true);
    expect(isMbusPublishEnabled()).toBe(true);
    // Announced (or still attempting), but nobody is receiving → local monitor
    // must stay on. Only a live subscriber flips this to true.
    expect(isMbusActivelyPublishing()).toBe(false);
  });
});
