/**
 * Hard Sync Oscillator — master resets slave phase on each cycle.
 * Classic aggressive lead sound. Slave ratio controls harmonic content.
 */
class SyncOscProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "frequency", defaultValue: 440, minValue: 20, maxValue: 20000, automationRate: "a-rate" },
      { name: "slaveRatio", defaultValue: 2, minValue: 1, maxValue: 16, automationRate: "a-rate" },
      { name: "shape", defaultValue: 0, minValue: 0, maxValue: 2, automationRate: "k-rate" }, // 0=saw, 1=square, 2=tri
    ];
  }

  constructor() {
    super();
    this.masterPhase = 0;
    this.slavePhase = 0;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || !output[0]) return true;

    const outL = output[0];
    const outR = output.length > 1 ? output[1] : null;

    const freqValues = parameters.frequency;
    const ratioValues = parameters.slaveRatio;
    const freqConst = freqValues.length === 1;
    const ratioConst = ratioValues.length === 1;
    const shape = Math.round(parameters.shape[0]);

    const invSr = 1 / sampleRate;

    for (let i = 0; i < outL.length; i++) {
      const freq = freqConst ? freqValues[0] : freqValues[i];
      const ratio = ratioConst ? ratioValues[0] : ratioValues[i];

      const masterInc = freq * invSr;
      const slaveInc = freq * ratio * invSr;

      this.masterPhase += masterInc;
      this.slavePhase += slaveInc;

      // Hard sync: reset slave phase to 0 when master completes a cycle.
      // This is what creates the classic aggressive "zipper" tone.
      if (this.masterPhase >= 1) {
        this.masterPhase -= 1;
        this.slavePhase = 0;
      }

      // Generate slave waveform
      const p = this.slavePhase % 1;
      let sample;
      switch (shape) {
        case 0: // Sawtooth
          sample = 2 * p - 1;
          break;
        case 1: // Square
          sample = p < 0.5 ? 1 : -1;
          break;
        case 2: // Triangle
          sample = p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
          break;
        default:
          sample = 2 * p - 1;
      }

      outL[i] = sample;
      if (outR) outR[i] = sample;
    }

    return true;
  }
}

registerProcessor("sync-osc", SyncOscProcessor);
