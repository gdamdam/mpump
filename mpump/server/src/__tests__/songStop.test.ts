/**
 * songStop test — stopping a song must only pause devices that were actually
 * connected/running. Pausing every registry device adds never-connected
 * hardware to the `stopped` set, so later hot-plugged devices won't
 * auto-start in handleDeviceChange.
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { Engine } from "../engine/Engine";

describe("Engine.songStop", () => {
  it("only pauses connected devices, not the whole registry", () => {
    const engine = new Engine(null, { onStateChange: () => {}, onStep: () => {}, onCatalogChange: () => {} });
    const eng = engine as unknown as {
      emitStateNow: () => void;
      emitSongState: () => void;
      deviceStates: Map<string, { connected: boolean }>;
      stopped: Set<string>;
    };
    eng.emitStateNow = () => {};
    eng.emitSongState = () => {};
    eng.deviceStates.get("preview_drums")!.connected = true;

    engine.songStop();

    expect(eng.stopped.has("preview_drums")).toBe(true);
    // Never-connected hardware must not be marked stopped — that would block
    // auto-start when it is hot-plugged later.
    expect(eng.stopped.size).toBe(1);
  });
});
