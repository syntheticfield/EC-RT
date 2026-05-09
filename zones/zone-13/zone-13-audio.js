/* =========================
   Zone13Audio — Moteur Granulaire Stochastique

   Les 3 WAVs ne jouent pas en boucle continue.
   Ils sont découpés en grains courts, déclenchés
   de façon aléatoire selon des paramètres contrôlables :
   densité, scatter de pitch, position dans le buffer.

   Pattern WebAudio lookahead scheduling (Chris Wilson)
   pour une précision temporelle maximale.
   ========================= */

export class Zone13Audio {
  constructor() {
    this.ctx          = null;
    this.masterGain   = null;
    this.analyser     = null;
    this.buffers      = [];       /* AudioBuffer[] — un par fichier source */
    this.grainActive  = [true, true, true];
    this.grainDensity = 0.38;     /* 0–1 → intervalle entre grains         */
    this.grainPitch   = 0.32;     /* 0–1 → amplitude du scatter de pitch   */
    this.grainPos     = 0.5;      /* 0–1 → position de lecture dans buffer */
    this.grainSize    = 0.5;      /* 0–1 → durée des grains                */
    this._nextGrain   = 0;
    this._timer       = null;
    this.onGrainFire  = null;     /* callback(srcIndex) → visuels          */
  }

  /* ── Init contexte WebAudio ──────────────────────── */

  async init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.72;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize               = 2048;
    this.analyser.smoothingTimeConstant = 0.78;

    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  /* ── Chargement des sources ──────────────────────── */

  async loadBuffers(urls) {
    this.buffers = await Promise.all(
      urls.map(async url => {
        const res = await fetch(url);
        const ab  = await res.arrayBuffer();
        return this.ctx.decodeAudioData(ab);
      })
    );
    console.log(`[Zone13Audio] ${this.buffers.length} buffers chargés`);
  }

  /* ── Granular scheduler ──────────────────────────── */

  startGranular() {
    this._nextGrain = this.ctx.currentTime + 0.05;
    this._runScheduler();
  }

  stopGranular() {
    clearTimeout(this._timer);
    this._timer = null;
  }

  _runScheduler() {
    const LOOK_AHEAD = 0.14;

    while (this._nextGrain < this.ctx.currentTime + LOOK_AHEAD) {
      this._fireGrain();
      this._nextGrain += this._nextInterval();
    }

    this._timer = setTimeout(() => this._runScheduler(), 35);
  }

  /* Intervalle exponentiel selon densité */
  _nextInterval() {
    /* density 0 → ~4s,  density 1 → ~0.015s */
    const base   = Math.pow(10, 0.62 - this.grainDensity * 2.24);
    const jitter = (Math.random() - 0.5) * base * 0.55;
    return Math.max(0.012, base + jitter);
  }

  /* Déclenche un grain à this._nextGrain */
  _fireGrain() {
    const activeIdx = this.grainActive
      .map((on, i) => (on && this.buffers[i]) ? i : -1)
      .filter(i => i >= 0);

    if (!activeIdx.length) return;

    const srcIdx = activeIdx[Math.floor(Math.random() * activeIdx.length)];
    const buffer = this.buffers[srcIdx];

    /* Durée du grain */
    const dur = 0.03 + Math.random() * (0.08 + this.grainSize * 1.1);

    /* Position dans le buffer */
    const center  = this.grainPos * (buffer.duration - dur);
    const scatter = (Math.random() - 0.5) * buffer.duration * 0.28;
    const offset  = Math.max(0, Math.min(buffer.duration - dur - 0.005, center + scatter));

    /* Pitch scatter — 0 = monotone, 1 = ±18 demi-tons */
    const rate = Math.pow(2, (Math.random() - 0.5) * this.grainPitch * 36 / 12);

    /* Enveloppe */
    const attack  = Math.min(0.025, dur * 0.2);
    const release = Math.min(0.1,   dur * 0.38);
    const t       = this._nextGrain;
    const vol     = 0.12 + Math.random() * 0.12;

    const source = this.ctx.createBufferSource();
    source.buffer             = buffer;
    source.playbackRate.value = rate;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0,   t);
    env.gain.linearRampToValueAtTime(vol, t + attack);
    env.gain.setValueAtTime(vol,  t + dur - release);
    env.gain.linearRampToValueAtTime(0,   t + dur);

    const pan = this.ctx.createStereoPanner();
    pan.pan.value = (Math.random() - 0.5) * 1.7;

    source.connect(env);
    env.connect(pan);
    pan.connect(this.masterGain);
    source.start(t, offset, dur + 0.01);

    /* Callback visuel décalé dans le temps */
    if (this.onGrainFire) {
      const delay = Math.max(0, (t - this.ctx.currentTime) * 1000);
      setTimeout(() => this.onGrainFire(srcIdx), delay);
    }
  }

  async resume() {
    if (this.ctx?.state === "suspended") await this.ctx.resume();
  }

  getAnalyser() { return this.analyser; }
}