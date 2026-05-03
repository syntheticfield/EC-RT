export class Zone13AnalyserData {
  constructor(analyser) {
    this.analyser = analyser;
    this.freqData = new Uint8Array(analyser.frequencyBinCount);
    this.timeData = new Uint8Array(analyser.fftSize);
  }

  update() {
    this.analyser.getByteFrequencyData(this.freqData);
    this.analyser.getByteTimeDomainData(this.timeData);

    return {
      rawFreq: this.freqData,
      rawWave: this.timeData,
      amplitude: this.getAmplitude(),
      bass: this.getBandAverage(0, 12),
      mids: this.getBandAverage(12, 80),
      highs: this.getBandAverage(80, 180),
      transient: this.getTransient()
    };
  }

  getAmplitude() {
    let sum = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      const v = (this.timeData[i] - 128) / 128;
      sum += Math.abs(v);
    }
    return sum / this.timeData.length;
  }

  getBandAverage(start, end) {
    const max = Math.min(end, this.freqData.length);
    let sum = 0;
    let count = 0;

    for (let i = start; i < max; i++) {
      sum += this.freqData[i];
      count++;
    }

    return count ? (sum / count) / 255 : 0;
  }

  getTransient() {
    let peak = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      const v = Math.abs((this.timeData[i] - 128) / 128);
      if (v > peak) peak = v;
    }
    return peak;
  }
}