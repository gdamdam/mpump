/**
 * Smoke tests for the vendored mbus-client (src/transport/mbus). The library
 * itself is tested upstream (mbus/packages/mbus-client); these only guard the
 * vendoring — that the module graph resolves under mpump's tsconfig and the
 * protocol layer round-trips — so a bad re-sync fails fast.
 */

import { describe, expect, it } from "vitest";
import { createMbusClient, MBUS_VERSION, outbound, parseServerMessage } from "../transport/mbus";

describe("vendored mbus-client", () => {
  it("exposes the client factory", () => {
    expect(typeof createMbusClient).toBe("function");
  });

  it("builds outbound frames that parse back as JSON", () => {
    expect(JSON.parse(outbound.hello())).toEqual({ type: "mbus/hello", mbus: MBUS_VERSION });
    expect(JSON.parse(outbound.announce("mpump"))).toEqual({
      type: "mbus/announce",
      name: "mpump",
    });
  });

  it("parses a welcome frame and ignores non-mbus traffic", () => {
    const welcome = JSON.stringify({
      type: "mbus/welcome",
      clientId: "c1",
      mbus: MBUS_VERSION,
      sources: [{ sourceId: "s1", name: "mpump", clientId: "c2" }],
    });
    expect(parseServerMessage(welcome)).toEqual({
      type: "welcome",
      clientId: "c1",
      mbus: MBUS_VERSION,
      sources: [{ sourceId: "s1", name: "mpump", clientId: "c2" }],
    });
    expect(parseServerMessage(JSON.stringify({ type: "link/tempo", bpm: 120 }))).toBeNull();
    expect(parseServerMessage("not json")).toBeNull();
  });
});
