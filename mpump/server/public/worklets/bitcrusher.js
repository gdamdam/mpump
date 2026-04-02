/**
 * Bitcrusher — true sample-and-hold with bit depth reduction.
 * Unlike the WaveShaperNode hack, this does real sample rate reduction.
 */
class BitcrusherProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "bits", defaultValue: 8, minValue: 1, maxValue: 16, automationRate: "k-rate" },
      { name: "crushRate", defaultValue: 44100, minValue: 100, maxValue: 44100, automationRate: "k-rate" },
    ];
  }

  constructor() {
    super();
    this.holdL = 0;
    this.holdR = 0;
    this.phase = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0]) return true;

    const inL = input[0];
    const inR = input.length > 1 ? input[1] : null;
    const outL = output[0];
    const outR = output.length > 1 ? output[1] : null;

    const bits = parameters.bits[0];
    const crushRate = parameters.crushRate[0];
    const steps = Math.pow(2, bits);
    const phaseInc = crushRate / sampleRate;

    for (let i = 0; i < outL.length; i++) {
      this.phase += phaseInc;

      if (this.phase >= 1) {
        this.phase -= 1;
        // Triangular PDF dither: reduces quantization harshness by randomizing
        // the rounding threshold. Two uniform randoms summed = triangular distribution.
        const ditherL = (Math.random() - 0.5 + Math.random() - 0.5) / steps;
        this.holdL = Math.round(inL[i] * steps + ditherL) / steps;
        if (inR) {
          const ditherR = (Math.random() - 0.5 + Math.random() - 0.5) / steps;
          this.holdR = Math.round(inR[i] * steps + ditherR) / steps;
        }
      }

      outL[i] = this.holdL;
      if (outR) outR[i] = inR ? this.holdR : this.holdL;
    }

    return true;
  }
}

registerProcessor("bitcrusher", BitcrusherProcessor);
