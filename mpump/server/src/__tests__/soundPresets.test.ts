import { describe, it, expect } from "vitest";
import { SYNTH_PRESETS, BASS_PRESETS, DRUM_KIT_PRESETS, groupPresets } from "../data/soundPresets";
import type { SynthParams } from "../types";

function validateSynthParams(p: SynthParams, name: string) {
  expect(["sawtooth", "square", "sine", "triangle", "pwm", "sync", "fm", "wavetable"]).toContain(p.oscType);
  expect(["lowpass", "highpass", "bandpass", "notch"]).toContain(p.filterType);
  expect(p.attack, `${name} attack`).toBeGreaterThan(0);
  expect(p.decay, `${name} decay`).toBeGreaterThan(0);
  expect(p.sustain, `${name} sustain`).toBeGreaterThanOrEqual(0);
  expect(p.sustain, `${name} sustain`).toBeLessThanOrEqual(1);
  expect(p.release, `${name} release`).toBeGreaterThan(0);
  expect(p.cutoff, `${name} cutoff`).toBeGreaterThanOrEqual(100);
  expect(p.cutoff, `${name} cutoff`).toBeLessThanOrEqual(8000);
  expect(p.resonance, `${name} resonance`).toBeGreaterThanOrEqual(0.5);
  expect(typeof p.subOsc).toBe("boolean");
  expect(typeof p.lfoOn).toBe("boolean");
  expect(typeof p.detune).toBe("number");
}

describe("SYNTH_PRESETS", () => {
  it("has at least 6 presets (including Default)", () => {
    expect(SYNTH_PRESETS.length).toBeGreaterThanOrEqual(6);
  });

  it("each preset has a name and valid params", () => {
    for (const preset of SYNTH_PRESETS) {
      expect(preset.name.length).toBeGreaterThan(0);
      validateSynthParams(preset.params, preset.name);
    }
  });

  it("preset names are unique", () => {
    const names = SYNTH_PRESETS.map(p => p.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("BASS_PRESETS", () => {
  it("has at least 6 presets (including Default)", () => {
    expect(BASS_PRESETS.length).toBeGreaterThanOrEqual(6);
  });

  it("each preset has valid params", () => {
    for (const preset of BASS_PRESETS) {
      expect(preset.name.length).toBeGreaterThan(0);
      validateSynthParams(preset.params, preset.name);
    }
  });
});

describe("DRUM_KIT_PRESETS", () => {
  it("has at least 6 presets (including Default)", () => {
    expect(DRUM_KIT_PRESETS.length).toBeGreaterThanOrEqual(6);
  });

  it("each preset has voices with valid tune/decay/level", () => {
    for (const preset of DRUM_KIT_PRESETS) {
      expect(preset.name.length).toBeGreaterThan(0);
      for (const [note, voice] of Object.entries(preset.voices)) {
        expect(Number(note), `${preset.name} note`).toBeGreaterThanOrEqual(36);
        expect(voice.tune, `${preset.name} tune`).toBeGreaterThanOrEqual(-24);
        expect(voice.tune, `${preset.name} tune`).toBeLessThanOrEqual(24);
        expect(voice.decay, `${preset.name} decay`).toBeGreaterThan(0);
        expect(voice.level, `${preset.name} level`).toBeGreaterThanOrEqual(0);
        expect(voice.level, `${preset.name} level`).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("groupPresets", () => {
  it("groups presets by group field", () => {
    const presets = [
      { name: "A", group: "Leads" },
      { name: "B", group: "Pads" },
      { name: "C", group: "Leads" },
    ];
    const result = groupPresets(presets);
    expect(result).toHaveLength(2);
    const leadGroup = result.find(([g]) => g === "Leads");
    expect(leadGroup).toBeDefined();
    expect(leadGroup![1]).toHaveLength(2);
  });

  it("puts ungrouped presets first", () => {
    const presets = [
      { name: "Z", group: "Leads" },
      { name: "Default" }, // no group
    ];
    const result = groupPresets(presets);
    expect(result[0][0]).toBe(""); // ungrouped first
    expect(result[0][1][0][1].name).toBe("Default");
  });

  it("sorts groups alphabetically", () => {
    const presets = [
      { name: "A", group: "Pads" },
      { name: "B", group: "Aggressive" },
      { name: "C", group: "Leads" },
    ];
    const result = groupPresets(presets);
    const names = result.map(([g]) => g);
    expect(names).toEqual(["Aggressive", "Leads", "Pads"]);
  });

  it("sorts presets within each group alphabetically", () => {
    const presets = [
      { name: "Zebra", group: "X" },
      { name: "Alpha", group: "X" },
      { name: "Mid", group: "X" },
    ];
    const result = groupPresets(presets);
    const names = result[0][1].map(([, p]) => p.name);
    expect(names).toEqual(["Alpha", "Mid", "Zebra"]);
  });

  it("preserves original indices", () => {
    const presets = [
      { name: "First", group: "A" },
      { name: "Second", group: "A" },
    ];
    const result = groupPresets(presets);
    expect(result[0][1][0][0]).toBe(0); // original index 0
    expect(result[0][1][1][0]).toBe(1); // original index 1
  });

  it("works with actual SYNTH_PRESETS", () => {
    const result = groupPresets(SYNTH_PRESETS);
    expect(result.length).toBeGreaterThan(0);
    // All presets accounted for
    const total = result.reduce((n, [, items]) => n + items.length, 0);
    expect(total).toBe(SYNTH_PRESETS.length);
  });
});
