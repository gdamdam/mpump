/**
 * Wavetable Oscillator — interpolating wavetable with morphing.
 * Ships with 5 built-in tables. tablePosition morphs between frames.
 */

// Built-in wavetables: each is 256 samples, multiple frames per table
function generateTables() {
  const SIZE = 256;
  const tables = {};

  // Basic: sine → triangle → saw → square (4 frames)
  tables.basic = [
    Float32Array.from({ length: SIZE }, (_, i) => Math.sin(2 * Math.PI * i / SIZE)),
    Float32Array.from({ length: SIZE }, (_, i) => {
      const p = i / SIZE;
      return p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
    }),
    Float32Array.from({ length: SIZE }, (_, i) => 2 * i / SIZE - 1),
    Float32Array.from({ length: SIZE }, (_, i) => i < SIZE / 2 ? 1 : -1),
  ];

  // Vocal: formant-like with harmonics emphasizing vowel sounds (4 frames)
  tables.vocal = Array.from({ length: 4 }, (_, f) => {
    const formants = [[800, 1200], [400, 2000], [600, 1600], [300, 2400]][f];
    return Float32Array.from({ length: SIZE }, (_, i) => {
      const t = i / SIZE;
      return (Math.sin(2 * Math.PI * t) * 0.5
        + Math.sin(2 * Math.PI * t * (formants[0] / 100)) * 0.3
        + Math.sin(2 * Math.PI * t * (formants[1] / 100)) * 0.2);
    });
  });

  // Metallic: inharmonic partials for bell/metallic sounds (4 frames)
  tables.metallic = Array.from({ length: 4 }, (_, f) => {
    const ratios = [1, 2.76, 5.04, 7.28 + f * 0.5];
    return Float32Array.from({ length: SIZE }, (_, i) => {
      const t = i / SIZE;
      let sum = 0;
      for (let h = 0; h < ratios.length; h++) {
        sum += Math.sin(2 * Math.PI * t * ratios[h]) / (h + 1);
      }
      return sum * 0.4;
    });
  });

  // Pad: rich even+odd harmonics with slow roll-off (4 frames)
  tables.pad = Array.from({ length: 4 }, (_, f) => {
    const harmonics = 8 + f * 4;
    return Float32Array.from({ length: SIZE }, (_, i) => {
      const t = i / SIZE;
      let sum = 0;
      for (let h = 1; h <= harmonics; h++) {
        sum += Math.sin(2 * Math.PI * t * h) / (h * 0.7);
      }
      return sum * 0.15;
    });
  });

  // Organ: drawbar-like additive with specific harmonics (4 frames)
  tables.organ = Array.from({ length: 4 }, (_, f) => {
    // Drawbar registrations: different organ stops
    const draws = [
      [1, 0.8, 0, 0.6, 0, 0.3, 0, 0.1, 0],      // full
      [1, 0, 0.7, 0, 0.5, 0, 0.3, 0, 0],          // hollow
      [0.3, 1, 0.5, 0.8, 0.3, 0.5, 0.2, 0.1, 0],  // bright
      [1, 0.5, 0.3, 0.2, 0.1, 0.05, 0, 0, 0],     // mellow
    ][f];
    return Float32Array.from({ length: SIZE }, (_, i) => {
      const t = i / SIZE;
      let sum = 0;
      for (let h = 0; h < draws.length; h++) {
        if (draws[h] > 0) sum += Math.sin(2 * Math.PI * t * (h + 1)) * draws[h];
      }
      return sum * 0.25;
    });
  });

  return tables;
}

class WavetableOscProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "frequency", defaultValue: 440, minValue: 20, maxValue: 20000, automationRate: "a-rate" },
      { name: "tablePosition", defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "a-rate" },
    ];
  }

  constructor() {
    super();
    this.phase = 0;
    this.tables = generateTables();
    this.currentTable = "basic";

    // Listen for table selection changes
    this.port.onmessage = (e) => {
      if (e.data.table && this.tables[e.data.table]) {
        this.currentTable = e.data.table;
      }
    };
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || !output[0]) return true;

    const outL = output[0];
    const outR = output.length > 1 ? output[1] : null;

    const freqValues = parameters.frequency;
    const posValues = parameters.tablePosition;
    const freqConst = freqValues.length === 1;
    const posConst = posValues.length === 1;

    const table = this.tables[this.currentTable];
    const frames = table.length;
    const SIZE = table[0].length;
    const invSr = 1 / sampleRate;

    for (let i = 0; i < outL.length; i++) {
      const freq = freqConst ? freqValues[0] : freqValues[i];
      const pos = posConst ? posValues[0] : posValues[i];

      // Advance phase
      this.phase += freq * invSr;
      if (this.phase >= 1) this.phase -= 1;

      // Fractional position between frames
      const framePos = pos * (frames - 1);
      const frame0 = Math.floor(framePos);
      const frame1 = Math.min(frame0 + 1, frames - 1);
      const frameMix = framePos - frame0;

      // Interpolated table lookup
      const idx = this.phase * SIZE;
      const idx0 = Math.floor(idx) % SIZE;
      const idx1 = (idx0 + 1) % SIZE;
      const frac = idx - Math.floor(idx);

      // Linear interpolation within each frame
      const val0 = table[frame0][idx0] + (table[frame0][idx1] - table[frame0][idx0]) * frac;
      const val1 = table[frame1][idx0] + (table[frame1][idx1] - table[frame1][idx0]) * frac;

      // Crossfade between frames
      const sample = val0 + (val1 - val0) * frameMix;

      outL[i] = sample;
      if (outR) outR[i] = sample;
    }

    return true;
  }
}

registerProcessor("wavetable-osc", WavetableOscProcessor);
