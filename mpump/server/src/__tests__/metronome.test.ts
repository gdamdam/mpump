/**
 * Metronome driver tests — preview_synth and preview_bass both run the
 * Sequencer branch on separate timers; if both drive playClick the click
 * flams (two slightly offset clicks per beat). Exactly one device (the
 * synth-mode one) must drive the metronome.
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Engine } from "../engine/Engine";
import type { MidiPort } from "../engine/MidiPort";

function mockPort() {
  return {
    name: "mock", id: "mock",
    noteOn: vi.fn(), noteOff: vi.fn(),
    allNotesOff: vi.fn(), programChange: vi.fn(), clock: vi.fn(),
  } as unknown as MidiPort;
}

type Priv = {
  data: unknown;
  audioPort: unknown;
  ports: Record<string, MidiPort>;
  deviceStates: Map<string, { melodicEdit: unknown }>;
  startDevice(id: string): void;
  stopDevice(id: string): void;
};

function setup() {
  const engine = new Engine(null, { onStateChange: () => {}, onStep: () => {}, onCatalogChange: () => {} });
  const eng = engine as unknown as Priv;
  eng.data = { catalog: { keys: ["A"] } }; // enough for getDeviceRoot
  const playClick = vi.fn();
  eng.audioPort = { playClick };
  return { eng, playClick };
}

function startPreviewDevice(eng: Priv, id: string) {
  const ds = eng.deviceStates.get(id)!;
  ds.melodicEdit = Array.from({ length: 16 }, () => null); // avoid catalog lookup
  eng.ports[id] = mockPort();
  eng.startDevice(id);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "performance", "Date"] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("metronome click driver", () => {
  it("is not driven by the bass device", () => {
    const { eng, playClick } = setup();
    startPreviewDevice(eng, "preview_bass");
    vi.advanceTimersByTime(4500); // past first bar boundary + one full bar
    expect(playClick).not.toHaveBeenCalled();
    eng.stopDevice("preview_bass");
  });

  it("is driven by the synth device", () => {
    const { eng, playClick } = setup();
    startPreviewDevice(eng, "preview_synth");
    vi.advanceTimersByTime(4500);
    expect(playClick.mock.calls.length).toBeGreaterThan(0);
    eng.stopDevice("preview_synth");
  });
});
