/**
 * FM Oscillator — 2-operator frequency modulation.
 * Carrier + modulator. Modulator phase-modulates the carrier.
 * modRatio sets harmonic relationship, modIndex sets depth.
 */
class FmOscProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "frequency", defaultValue: 440, minValue: 20, maxValue: 20000, automationRate: "a-rate" },
      { name: "modRatio", defaultValue: 2, minValue: 0.5, maxValue: 16, automationRate: "a-rate" },
      { name: "modIndex", defaultValue: 5, minValue: 0, maxValue: 100, automationRate: "a-rate" },
    ];
  }

  constructor() {
    super();
    this.carrierPhase = 0;
    this.modPhase = 0;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || !output[0]) return true;

    const outL = output[0];
    const outR = output.length > 1 ? output[1] : null;

    const freqValues = parameters.frequency;
    const ratioValues = parameters.modRatio;
    const indexValues = parameters.modIndex;
    const freqConst = freqValues.length === 1;
    const ratioConst = ratioValues.length === 1;
    const indexConst = indexValues.length === 1;

    const twoPi = 2 * Math.PI;
    const invSr = 1 / sampleRate;

    for (let i = 0; i < outL.length; i++) {
      const freq = freqConst ? freqValues[0] : freqValues[i];
      const ratio = ratioConst ? ratioValues[0] : ratioValues[i];
      const index = indexConst ? indexValues[0] : indexValues[i];

      const modFreq = freq * ratio;

      // Advance modulator phase
      this.modPhase += modFreq * invSr;
      if (this.modPhase >= 1) this.modPhase -= 1;

      // Modulator output
      const modOut = Math.sin(twoPi * this.modPhase) * index;

      // Advance carrier phase with FM
      this.carrierPhase += freq * invSr;
      if (this.carrierPhase >= 1) this.carrierPhase -= 1;

      // Carrier output with phase modulation
      const sample = Math.sin(twoPi * this.carrierPhase + modOut);

      outL[i] = sample;
      if (outR) outR[i] = sample;
    }

    return true;
  }
}

registerProcessor("fm-osc", FmOscProcessor);
