/* =========================
   Zone13GlitchRenderer — Glitch agressif
   
   mix-blend-mode: screen sur le canvas.
   Pour être visible avec screen blend : couleurs SATURÉES
   et haute opacité. Noir = transparent, blanc/couleur = visible.
   
   Effets :
   — Blocs cyan/magenta larges (datamosh)
   — RGB split 40-80px sur les pics
   — Lignes de scan épaisses colorées
   — Flash blanc sur transient fort
   — Drift horizontal synchronisé à la basse
   — Noise burst large
   ========================= */

export class Zone13GlitchRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext("2d");
    this.width  = 0;
    this.height = 0;
    this._t     = 0;
    this._flash = 0;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.width  = this.canvas.width  = Math.floor(r.width);
    this.height = this.canvas.height = Math.floor(r.height);
  }

  clear() { this.ctx.clearRect(0, 0, this.width, this.height); }

  render(audio) {
    const { amplitude, bass, mids, highs, transient } = audio;
    const { ctx, width: w, height: h } = this;
    this._t += 0.016;

    this.clear();

    /* ── 1. BLOCS DATAMOSH COLORÉS ─────────────────────
       Cyan / Magenta / Jaune — saturés, très visibles     */
    const PALETTE = [
      `rgba(0,255,255,`,    /* cyan    */
      `rgba(255,0,200,`,    /* magenta */
      `rgba(255,255,0,`,    /* jaune   */
      `rgba(255,80,0,`,     /* orange  */
    ];

    const blockCount = Math.floor(1 + amplitude * 20 + transient * 28);
    const maxShift   = amplitude * 70 + transient * 100;

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    for (let i = 0; i < blockCount; i++) {
      const bh  = 3 + Math.random() * (20 + mids * 35);
      const by  = Math.random() * h;
      const bx  = (Math.random() - 0.5) * maxShift;
      const col = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      const a   = 0.18 + amplitude * 0.45 + Math.random() * 0.15;
      ctx.fillStyle = `${col}${a.toFixed(2)})`;
      ctx.fillRect(bx, by, w, bh);
    }
    ctx.restore();

    /* ── 2. RGB SPLIT AGRESSIF ─────────────────────────
       Décalage de 40-80px sur les peaks                   */
    if (highs > 0.06 || transient > 0.22) {
      const shift = 40 + highs * 40 + transient * 40;
      this._rgbSplit(Math.floor(shift));
    }

    /* ── 3. SCAN LINES ÉPAISSES ────────────────────────
       Lignes cyan semi-opaques — vraiment visibles         */
    if (amplitude > 0.04) {
      const lineAlpha = 0.06 + amplitude * 0.14;
      ctx.save();
      ctx.fillStyle = `rgba(0,255,255,${lineAlpha})`;
      const step = 4 + Math.floor((1 - amplitude) * 8);
      for (let y = 0; y < h; y += step) {
        ctx.fillRect(0, y, w, 1.5);
      }
      ctx.restore();
    }

    /* ── 4. DRIFT HORIZONTAL (basse) ───────────────────
       Le canvas entier se décale à droite/gauche           */
    if (bass > 0.06) {
      const drift = Math.sin(this._t * 1.2) * bass * 22;
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.globalCompositeOperation = "screen";
      ctx.drawImage(this.canvas, drift, 0, w, h);
      ctx.restore();
    }

    /* ── 5. NOISE BURST ────────────────────────────────
       Pixels blancs / cyan sur les attaques               */
    if (amplitude > 0.06 || transient > 0.3) {
      const count = Math.floor(amplitude * 500 + transient * 380);
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < count; i++) {
        const px = Math.random() * w;
        const py = Math.random() * h;
        const ps = 1.5 + Math.random() * 4;
        const a  = 0.3 + Math.random() * 0.5;
        ctx.fillStyle = Math.random() < 0.5
          ? `rgba(255,255,255,${a})`
          : `rgba(0,255,255,${a})`;
        ctx.fillRect(px, py, ps, ps);
      }
      ctx.restore();
    }

    /* ── 6. FLASH BLANC ────────────────────────────────
       Sur transient fort — lumière brutale                 */
    if (transient > 0.65) {
      this._flash = Math.min(1, this._flash + (transient - 0.65) * 2.2);
    }
    if (this._flash > 0.008) {
      ctx.save();
      ctx.globalAlpha = this._flash * 0.55;
      ctx.fillStyle   = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      this._flash *= 0.72;
    }
  }

  /* RGB Split pixel-level — shift de 'amount' pixels */
  _rgbSplit(amount) {
    const { ctx, width: w, height: h } = this;
    if (amount < 1) return;
    const img  = ctx.getImageData(0, 0, w, h);
    const data = img.data;
    const copy = new Uint8ClampedArray(data);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i  = (y * w + x) * 4;
        const rx = Math.min(w - 1, x + amount);
        const bx = Math.max(0,     x - amount);
        data[i]     = copy[(y * w + rx) * 4];
        data[i + 2] = copy[(y * w + bx) * 4 + 2];
      }
    }
    ctx.putImageData(img, 0, 0);
  }
}
