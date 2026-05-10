/* =========================
   Zone13Audio — Piste unique, déclenchement aléatoire
   
   Pas de granulaire. Une seule piste joue à la fois.
   Le moteur tire au sort l'un des 3 WAVs, attend
   que la piste se termine, puis reprogramme un prochain
   déclenchement dans un délai aléatoire.
   
   Gain maître élevé (0.92) pour une présence réelle.
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
    this.onTrigger     = null; /* callback(srcIdx) au déclenchement */
    this.onEnd         = null; /* callback() à la fin de piste      */
  }

  async init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.92;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize               = 2048;
    this.analyser.smoothingTimeConstant = 0.72;

    this.masterGain.connect(this.analyser);
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
    if (this.ctx?.state === "suspended") await this.ctx.resume();
  }

  /* Lance un WAV aléatoire parmi les 3 sources */
  triggerRandom() {
    if (!this.buffers.length) return;

    /* Stoppe la piste courante */
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

  /* Déclenchement manuel depuis le panel */
  manualTrigger() {
    clearTimeout(this._nextTimer);
    this.triggerRandom();
  }

  /* Lance le cycle auto dès l'activation */
  startCycle() {
    this.triggerRandom();
  }

  _scheduleNext() {
    clearTimeout(this._nextTimer);
    /* Intervalle : 6 à 28 secondes de silence entre les pistes */
    const delay = 6000 + Math.random() * 22000;
    this._nextTimer = setTimeout(() => this.triggerRandom(), delay);
  }

  getAnalyser() { return this.analyser; }
}
