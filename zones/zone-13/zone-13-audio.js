export class Zone13Audio {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.analyser = null;
    this.sources = [];
    this.buffers = new Map();
  }

  async init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.8;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.85;

    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  async loadBuffer(name, url) {
    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
    this.buffers.set(name, audioBuffer);
    return audioBuffer;
  }

  createLayer(name, {
    loop = true,
    gain = 0.2,
    playbackRate = 1
  } = {}) {
    const buffer = this.buffers.get(name);
    if (!buffer) throw new Error(`Buffer introuvable: ${name}`);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    source.playbackRate.value = playbackRate;

    const layerGain = this.ctx.createGain();
    layerGain.gain.value = gain;

    source.connect(layerGain);
    layerGain.connect(this.masterGain);

    const layer = { source, gainNode: layerGain, name };
    this.sources.push(layer);
    return layer;
  }

  startLayer(layer, when = 0) {
    layer.source.start(this.ctx.currentTime + when);
  }

  async resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  getAnalyser() {
    return this.analyser;
  }
}