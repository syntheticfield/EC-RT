/* =========================
   Zone13GlitchRenderer — Glitch discret sur les images
   
   mix-blend-mode: screen sur le canvas.
   Noir = transparent → seuls les éléments clairs (blanc/gris)
   affectent les images. Pas de couleurs saturées.
   
   Effets :
   — Lignes de déplacement horizontal (slices)
   — RGB split monochrome léger (3-10px)
   — Scan lines très fines, quasi invisibles
   — Noise de pixels blanc très sparse
   ========================= */

export class Zone13GlitchRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.width  = 0;
    this.height = 0;
    this._t     = 0;
  }

  resize() {
    const r        = this.canvas.getBoundingClientRect();
    this.width     = this.canvas.width  = Math.floor(r.width);
    this.height    = this.canvas.height = Math.floor(r.height);
  }

  clear() { this.ctx.clearRect(0, 0, this.width, this.height); }

  render(audio) {
    const { amplitude, bass, mids, transient } = audio;
    const { ctx, width: w, height: h } = this;
    this._t += 0.016;

    this.clear();

    /* Rien à rendre si le son est vraiment faible */
    if (amplitude < 0.03 && transient < 0.08) return;

    /* ── 1. SLICE HORIZONTAL — déplacement de bandes ──────
       Bandes étroites décalées latéralement, blanc semi-opaque.
       Crée l'illusion que les images se déchirent.           */
    const sliceCount = Math.floor(amplitude * 8 + transient * 14);

    if (sliceCount > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      for (let i = 0; i < sliceCount; i++) {
        const sy  = Math.random() * h;
        const sh  = 1 + Math.random() * (3 + mids * 6);   /* 1-9px de haut */
        const sx  = (Math.random() - 0.5) * (amplitude * 28 + transient * 44);
        const a   = 0.04 + amplitude * 0.10 + Math.random() * 0.06;

        ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
        ctx.fillRect(sx, sy, w, sh);
      }

      ctx.restore();
    }

    /* ── 2. RGB SPLIT MONOCHROME ────────────────────────────
       Décalage rouge / bleu de 3 à 10px — blanc uniquement,
       pas de couleurs saturées.                             */
    if (transient > 0.25 || amplitude > 0.18) {
      const shift = Math.floor(3 + transient * 7 + amplitude * 4);
      this._rgbSplitMono(shift, amplitude * 0.35 + transient * 0.25);
    }

    /* ── 3. SCAN LINES ULTRA-FINES ─────────────────────────
       Grille presque invisible, juste un léger tissu.       */
    if (amplitude > 0.06) {
      const a    = 0.015 + amplitude * 0.025;
      const step = 3;
      ctx.save();
      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
      for (let y = 0; y < h; y += step) ctx.fillRect(0, y, w, 0.8);
      ctx.restore();
    }

    /* ── 4. NOISE PIXELS SPARSE ────────────────────────────
       Quelques pixels blancs sur les attaques.             */
    if (transient > 0.35 || amplitude > 0.22) {
      const count = Math.floor(transient * 60 + amplitude * 40);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < count; i++) {
        const a = 0.12 + Math.random() * 0.22;
        ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
        ctx.fillRect(
          Math.random() * w,
          Math.random() * h,
          1 + Math.random() * 2,
          1 + Math.random() * 2
        );
      }
      ctx.restore();
    }
  }

  /* RGB split — shift du canal rouge vers la droite,
     bleu vers la gauche, en niveaux de gris uniquement.   */
  _rgbSplitMono(amount, strength) {
    const { ctx, width: w, height: h } = this;
    if (amount < 1 || strength < 0.01) return;

    const img  = ctx.getImageData(0, 0, w, h);
    const data = img.data;
    const copy = new Uint8ClampedArray(data);
    const s    = Math.min(1, strength);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i  = (y * w + x) * 4;
        /* Canal R : décalé vers la droite */
        const rx = Math.min(w - 1, x + amount);
        const ri = (y * w + rx) * 4;
        data[i]  = copy[i] + (copy[ri] - copy[i]) * s;

        /* Canal B : décalé vers la gauche */
        const bx = Math.max(0, x - amount);
        const bi = (y * w + bx) * 4 + 2;
        data[i + 2] = copy[i + 2] + (copy[bi] - copy[i + 2]) * s;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
}
