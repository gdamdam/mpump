/**
 * External MIDI clock sync tests — when sync is enabled, sequencers must be
 * driven exclusively by external ticks (advanceStep); the internal setInterval
 * look-ahead scheduler must be suspended or both paths play notes (doubled,
 * racing playback).
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Sequencer } from "../engine/Sequencer";
import { T8Sequencer } from "../engine/T8Sequencer";
import { Engine } from "../engine/Engine";
import type { MidiPort } from "../engine/MidiPort";
import type { StepData } from "../types";

function mockPort() {
  return {
    name: "mock", id: "mock",
    noteOn: vi.fn(), noteOff: vi.fn(),
    allNotesOff: vi.fn(), programChange: vi.fn(), clock: vi.fn(),
  } as unknown as MidiPort & { noteOn: ReturnType<typeof vi.fn> };
}

const PATTERN: (StepData | null)[] = Array.from({ length: 16 }, () => ({ semi: 0, vel: 1, slide: false }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "performance", "Date"] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("Sequencer external sync", () => {
  it("suspends the internal scheduler while synced; advanceStep still plays", () => {
    const port = mockPort();
    const seq = new Sequencer({ port, channel: 0, pattern: PATTERN, rootNote: 60, bpm: 120 });
    // Production order (Engine.startDevice): external sync is set before start(),
    // so start() never primes the internal scheduler while synced.
    seq.setExternalSync(true);
    seq.start();

    vi.advanceTimersByTime(1000);
    // Internal scheduler must not have played anything
    expect(port.noteOn).not.toHaveBeenCalled();

    seq.advanceStep(performance.now());
    expect(port.noteOn).toHaveBeenCalledTimes(1);
    seq.stop();
  });

  it("start() while synced does not spin the internal timer (clock Start handler)", () => {
    const port = mockPort();
    const seq = new Sequencer({ port, channel: 0, pattern: PATTERN, rootNote: 60, bpm: 120 });
    seq.setExternalSync(true);
    seq.start(); // MidiClockReceiver onStart does stop() + start()
    vi.advanceTimersByTime(1000);
    expect(port.noteOn).not.toHaveBeenCalled();
    seq.stop();
  });

  it("primes the look-ahead on start() — first step scheduled before the first interval tick", () => {
    const port = mockPort();
    const seq = new Sequencer({ port, channel: 0, pattern: PATTERN, rootNote: 60, bpm: 120 });
    seq.start();
    // No timer advance yet: the immediate prime must already have scheduled the
    // first step. Without priming, nothing fires until SCHEDULE_INTERVAL_MS (25ms),
    // which is the slip that put mpump behind Link peers on near-downbeat starts.
    expect(port.noteOn).toHaveBeenCalled();
    seq.stop();
  });

  it("resumes internal scheduling when sync is disabled", () => {
    const port = mockPort();
    const seq = new Sequencer({ port, channel: 0, pattern: PATTERN, rootNote: 60, bpm: 120 });
    seq.setExternalSync(true);
    seq.start();
    vi.advanceTimersByTime(500);
    expect(port.noteOn).not.toHaveBeenCalled();

    seq.setExternalSync(false);
    vi.advanceTimersByTime(500);
    expect(port.noteOn.mock.calls.length).toBeGreaterThan(0);
    seq.stop();
  });
});

describe("T8Sequencer external sync", () => {
  it("suspends the internal scheduler while synced; advanceStep still plays", () => {
    const port = mockPort();
    const seq = new T8Sequencer({
      port, drumChannel: 9, bassChannel: 9,
      drumPattern: Array.from({ length: 16 }, () => [{ note: 36, vel: 100 }]),
      bassPattern: Array.from({ length: 16 }, (): null => null),
      bpm: 120,
    });
    // Production order (Engine.startDevice): external sync is set before start().
    seq.setExternalSync(true);
    seq.start();

    vi.advanceTimersByTime(1000);
    expect(port.noteOn).not.toHaveBeenCalled();

    seq.advanceStep(performance.now());
    expect(port.noteOn).toHaveBeenCalledTimes(1);
    seq.stop();
  });
});

describe("Engine.setMidiClockSync", () => {
  it("toggles external-sync mode on running sequencers", () => {
    const access = {
      inputs: new Map([["in1", { addEventListener: vi.fn(), removeEventListener: vi.fn() }]]),
      outputs: new Map(),
      onstatechange: null,
    } as unknown as MIDIAccess;
    const engine = new Engine(access, {
      onStateChange: () => {}, onStep: () => {}, onCatalogChange: () => {},
    });
    const fakeSeq = {
      setExternalSync: vi.fn(), stop: vi.fn(), start: vi.fn(),
      setBpm: vi.fn(), advanceStep: vi.fn(), setHumanize: vi.fn(),
    };
    (engine as unknown as { sequencers: Map<string, unknown> }).sequencers.set("dev", fakeSeq);

    engine.setMidiClockSync(true);
    expect(fakeSeq.setExternalSync).toHaveBeenCalledWith(true);
    engine.setMidiClockSync(false);
    expect(fakeSeq.setExternalSync).toHaveBeenCalledWith(false);
  });
});
