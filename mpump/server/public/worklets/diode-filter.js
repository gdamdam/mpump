/**
 * 303 Diode Ladder Filter — 4-pole with asymmetric diode clipping per stage.
 * Sharper resonance peak, more squelchy/aggressive than Moog.
 * Based on Välimäki & Huovilainen diode ladder model.
 */
class DiodeFilterProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "cutoff", defaultValue: 4000, minValue: 20, maxValue: 20000, automationRate: "a-rate" },
      { name: "resonance", defaultValue: 1, minValue: 0, maxValue: 4, automationRate: "a-rate" },
    ];
  }

  constructor() {
    super();
    this.s = new Float64Array(4);
    this.y = new Float64Array(4);
  }

  // Asymmetric diode clipping — sharper on positive peaks
  diodeClip(x) {
    if (x > 0) return Math.tanh(x * 1.2);
    return Math.tanh(x * 0.8);
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

      // Frequency warping polynomial (same as Moog, see Huovilainen 2007)
      const wc = 2 * Math.PI * Math.min(fc, sr * 0.45) / sr;
      const g = 0.9892 * wc - 0.4342 * wc * wc + 0.1381 * wc * wc * wc - 0.0202 * wc * wc * wc * wc;

      const mono = (inL[i] + (inR ? inR[i] : inL[i])) * 0.5;

      // Feedback with input compensation for stability (matches Moog pattern)
      const feedback = res * 1.1 * (this.y[3] - mono * 0.0005);
      const x = mono - feedback;

      // 4 stages with diode clipping instead of tanh
      this.s[0] = this.y[0] + g * (this.diodeClip(x) - this.diodeClip(this.y[0]));
      this.s[1] = this.y[1] + g * (this.diodeClip(this.s[0]) - this.diodeClip(this.y[1]));
      this.s[2] = this.y[2] + g * (this.diodeClip(this.s[1]) - this.diodeClip(this.y[2]));
      this.s[3] = this.y[3] + g * (this.diodeClip(this.s[2]) - this.diodeClip(this.y[3]));

      // Flush denormals to prevent CPU spikes during silence
      this.y[0] = Math.abs(this.s[0]) < 1e-15 ? 0 : this.s[0];
      this.y[1] = Math.abs(this.s[1]) < 1e-15 ? 0 : this.s[1];
      this.y[2] = Math.abs(this.s[2]) < 1e-15 ? 0 : this.s[2];
      this.y[3] = Math.abs(this.s[3]) < 1e-15 ? 0 : this.s[3];

      // Gain-compensated for diode clipping compression
      const out = this.s[3] * 3.0;
      outL[i] = out;
      if (outR) outR[i] = out;
    }

    return true;
  }
}

registerProcessor("diode-filter", DiodeFilterProcessor);
