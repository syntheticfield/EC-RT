/* =========================
   Zone13GlitchRenderer
   Canvas overlay génératif — mix-blend-mode: screen

   Pas d'image source.
   Les effets sont construits sur le canvas et blendés
   visuellement sur les archives en dessous.

   Effets :
   — Blocs pixel datamosh (transient)
   — RGB split agressif (highs)
   — Drift sinusoïdal (bass)
   — Flash blanc (transient pic)
   — Noise burst granulaire (amplitude)
   — Scanlines CRT (continu, amplitude-modulé)
   ========================= */

export class Zone13GlitchRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext("2d");
    this.width  = 0;
    this.height = 0;
    this._t     = 0;
    this._flashAlpha = 0;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.width  = this.canvas.width  = Math.floor(r.width);
    this.height = this.canvas.height = Math.floor(r.height);
  }

  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  render(audioState) {
    const { amplitude, bass, mids, highs, transient } = audioState;
    const { ctx, width: w, height: h } = this;
    this._t += 0.016;

    this.clear();

    /* ── 1. BLOCS DATAMOSH ──────────────────────────────
       Rectangles de pixels déplacés horizontalement.
       Taille aléatoire, pilotés par amplitude + transient.      */
    const blockCount = Math.floor(2 + amplitude * 18 + transient * 22);
    const maxShift   = amplitude * 55 + transient * 85;

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    for (let i = 0; i < blockCount; i++) {
      const bh  = 2 + Math.random() * (14 + mids * 28);
      const by  = Math.random() * h;
      const bx  = (Math.random() - 0.5) * maxShift;

      /* Teinte : favorise magenta/cyan pour l'esthétique glitch */
      const hue = Math.random() < 0.5
        ? 280 + Math.random() * 60  /* magenta */
        : 170 + Math.random() * 50; /* cyan    */
      const a = 0.04 + amplitude * 0.18 + Math.random() * 0.08;

      ctx.fillStyle = `hsla(${hue}, 80%, 65%, ${a})`;
      ctx.fillRect(bx, by, w, bh);
    }
    ctx.restore();

    /* ── 2. RGB SPLIT PIXEL ────────────────────────────── */
    if (highs > 0.08 || transient > 0.28) {
      const shift = highs * 22 + transient * 18;
      this._rgbSplit(shift);
    }

    /* ── 3. DRIFT SINUSOÏDAL (basse) ────────────────────
       Le canvas se dessine sur lui-même avec un offset
       vertical oscillant.                                        */
    if (bass > 0.05) {
      const drift = Math.sin(this._t * 0.85) * bass * 14;
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.drawImage(this.canvas, 0, drift, w, h);
      ctx.restore();
    }

    /* ── 4. NOISE GRANULAIRE ────────────────────────────
       Pixel-noise distribué aléatoirement.
       Densité couplée à l'amplitude.                            */
    if (amplitude > 0.05) {
      const count = Math.floor(amplitude * 320 + transient * 200);
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < count; i++) {
        const px = Math.random() * w;
        const py = Math.random() * h;
        const ps = 1 + Math.random() * 2.5;
        const pa = Math.random() * 0.45;
        ctx.fillStyle = `rgba(255,255,255,${pa})`;
        ctx.fillRect(px, py, ps, ps);
      }
      ctx.restore();
    }

    /* ── 5. FLASH BLANC (pic transient) ─────────────────
       Charge le flash sur un pic, décroît exponentiellement.    */
    if (transient > 0.72) {
      this._flashAlpha = Math.min(1, this._flashAlpha + (transient - 0.72) * 1.4);
    }
    if (this._flashAlpha > 0.005) {
      ctx.save();
      ctx.globalAlpha = this._flashAlpha * 0.38;
      ctx.fillStyle   = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      this._flashAlpha *= 0.78; /* décroissance */
    }

    /* ── 6. SCANLINES CRT ───────────────────────────────
       Lignes horizontales semi-transparentes, densité fixe.
       Intensité modulée par l'amplitude.                         */
    if (amplitude > 0.02) {
      const lineAlpha = 0.015 + amplitude * 0.05;
      ctx.save();
      ctx.fillStyle = `rgba(0,0,0,${lineAlpha})`;
      for (let y = 0; y < h; y += 3) {
        ctx.fillRect(0, y, w, 1);
      }
      ctx.restore();
    }

    /* ── 7. VIGNETTE DYNAMIQUE ─────────────────────────── */
    if (amplitude > 0.03) {
      const strength = amplitude * 0.28 + bass * 0.15;
      const grd = ctx.createRadialGradient(w/2, h/2, w * 0.28, w/2, h/2, w * 0.75);
      grd.addColorStop(0, "rgba(0,0,0,0)");
      grd.addColorStop(1, `rgba(0,0,0,${strength})`);
      ctx.save();
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  /* ── RGB Split pixel-level ─────────────────────────── */
  _rgbSplit(amount) {
    const { ctx, width: w, height: h } = this;
    const img  = ctx.getImageData(0, 0, w, h);
    const data = img.data;
    const copy = new Uint8ClampedArray(data);
    const sh   = Math.floor(amount);
    if (sh < 1) return;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i  = (y * w + x) * 4;
        const rx = Math.min(w - 1, x + sh);
        const bx = Math.max(0,     x - sh);
        data[i]     = copy[(y * w + rx) * 4];      /* rouge → */
        data[i + 2] = copy[(y * w + bx) * 4 + 2]; /* bleu  ← */
      }
    }
    ctx.putImageData(img, 0, 0);
  }
}