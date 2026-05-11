/* =========================
   Zone13Audio — Piste unique, déclenchement aléatoire
   Gain maître 1.5 + compresseur doux pour la présence.
   ========================= */

export class Zone13Audio {
  constructor() {
    this.ctx           = null;
    this.masterGain    = null;
    this.analyser      = null;
    this.buffers       = [];
    this.currentSource = null;
    this.currentSrcIdx = -1;
    this._nextTimer    = null;
    this.onTrigger     = null;
    this.onEnd         = null;
  }

  async init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1.5;

    /* Compresseur doux — évite l'écrêtage dur à gain élevé */
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value      =  8;
    comp.ratio.value     =  4;
    comp.attack.value    =  0.004;
    comp.release.value   =  0.22;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize               = 2048;
    this.analyser.smoothingTimeConstant = 0.72;

    this.masterGain.connect(comp);
    comp.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  async loadBuffers(urls) {
    this.buffers = await Promise.all(
      urls.map(async url => {
        const res = await fetch(url);
        const ab  = await res.arrayBuffer();
        return this.ctx.decodeAudioData(ab);
      })
    );
  }

  async resume() {
    if (this.ctx?.state === 'suspended') await this.ctx.resume();
  }

  triggerRandom() {
    if (!this.buffers.length) return;
    try { this.currentSource?.stop(); } catch (_) {}
    this.currentSource = null;

    const idx    = Math.floor(Math.random() * this.buffers.length);
    const source = this.ctx.createBufferSource();
    source.buffer = this.buffers[idx];
    source.connect(this.masterGain);
    source.start(this.ctx.currentTime);

    this.currentSource = source;
    this.currentSrcIdx = idx;
    this.onTrigger?.(idx);

    source.onended = () => {
      this.currentSource = null;
      this.currentSrcIdx = -1;
      this.onEnd?.();
      this._scheduleNext();
    };
  }

  manualTrigger() {
    clearTimeout(this._nextTimer);
    this.triggerRandom();
  }

  startCycle() { this.triggerRandom(); }

  _scheduleNext() {
    clearTimeout(this._nextTimer);
    const delay = 6000 + Math.random() * 22000;
    this._nextTimer = setTimeout(() => this.triggerRandom(), delay);
  }

  getAnalyser() { return this.analyser; }
}
