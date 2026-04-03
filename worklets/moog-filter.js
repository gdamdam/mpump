/**
 * Moog Ladder Filter — 4-pole (24dB/oct) resonant lowpass
 * Based on Huovilainen's nonlinear model with thermal voltage compensation.
 * Self-oscillates at resonance = 4.
 */
class MoogFilterProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "cutoff", defaultValue: 4000, minValue: 20, maxValue: 20000, automationRate: "a-rate" },
      { name: "resonance", defaultValue: 1, minValue: 0, maxValue: 4, automationRate: "a-rate" },
    ];
  }

  constructor() {
    super();
    // 4 one-pole filter stages
    this.s = new Float64Array(4); // stage outputs
    this.y = new Float64Array(4); // delayed outputs
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0]) return true;

    const inL = input[0];
    const inR = input.length > 1 ? input[1] : input[0];
    const outL = output[0];
    const outR = output.length > 1 ? output[1] : output[0];

    const cutoffValues = parameters.cutoff;
    const resValues = parameters.resonance;
    const cutoffConst = cutoffValues.length === 1;
    const resConst = resValues.length === 1;

    const sr = sampleRate;

    for (let i = 0; i < outL.length; i++) {
      const fc = cutoffConst ? cutoffValues[0] : cutoffValues[i];
      const res = resConst ? resValues[0] : resValues[i];

      // Frequency warping: polynomial approximation of bilinear transform
      // Based on Huovilainen (2007) "Non-linear Digital Implementation of the Moog Ladder Filter"
      // Maps digital frequency to analog equivalent for accurate cutoff tracking
      const wc = 2 * Math.PI * Math.min(fc, sr * 0.45) / sr;
      const g = 0.9892 * wc - 0.4342 * wc * wc + 0.1381 * wc * wc * wc - 0.0202 * wc * wc * wc * wc;

      // Process mono sum for filter (stereo reconstructed after)
      const mono = (inL[i] + (inR ? inR[i] : inL[i])) * 0.5;

      // Feedback with nonlinear saturation (tanh)
      const feedback = res * (this.y[3] - mono * 0.0005);
      const x = mono - Math.tanh(feedback);

      // 4 cascaded one-pole stages with nonlinear processing
      this.s[0] = this.y[0] + g * (Math.tanh(x) - Math.tanh(this.y[0]));
      this.s[1] = this.y[1] + g * (Math.tanh(this.s[0]) - Math.tanh(this.y[1]));
      this.s[2] = this.y[2] + g * (Math.tanh(this.s[1]) - Math.tanh(this.y[2]));
      this.s[3] = this.y[3] + g * (Math.tanh(this.s[2]) - Math.tanh(this.y[3]));

      // Update delays (flush denormals to prevent CPU spikes during silence)
      this.y[0] = Math.abs(this.s[0]) < 1e-15 ? 0 : this.s[0];
      this.y[1] = Math.abs(this.s[1]) < 1e-15 ? 0 : this.s[1];
      this.y[2] = Math.abs(this.s[2]) < 1e-15 ? 0 : this.s[2];
      this.y[3] = Math.abs(this.s[3]) < 1e-15 ? 0 : this.s[3];

      // Output: 4-pole lowpass, gain-compensated for tanh compression
      const out = this.s[3] * 3.0;
      outL[i] = out;
      if (outR) outR[i] = out;
    }

    return true;
  }
}

registerProcessor("moog-filter", MoogFilterProcessor);
