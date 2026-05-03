export class Zone13GlitchRenderer {
  constructor(canvas, image) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { willReadFrequently: true });
    this.image = image;

    this.width = 0;
    this.height = 0;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.floor(rect.width);
    this.height = Math.floor(rect.height);

    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  render(audioState) {
    const { amplitude, bass, mids, highs, transient } = audioState;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(this.image, 0, 0, w, h);

    const sliceCount = 20 + Math.floor(highs * 40);
    const maxOffset = Math.floor(amplitude * 40 + transient * 60);

    for (let i = 0; i < sliceCount; i++) {
      const y = Math.random() * h;
      const sliceH = 2 + Math.random() * (10 + mids * 20);
      const offsetX = (Math.random() - 0.5) * maxOffset;

      ctx.drawImage(
        this.canvas,
        0, y, w, sliceH,
        offsetX, y, w, sliceH
      );
    }

    if (highs > 0.12) {
      this.applyRgbSplit(highs * 18);
    }

    if (bass > 0.08) {
      this.applyDrift(bass * 10);
    }
  }

  applyRgbSplit(amount) {
    const { ctx, width: w, height: h } = this;
    const img = ctx.getImageData(0, 0, w, h);
    const data = img.data;
    const copy = new Uint8ClampedArray(data);

    const shift = Math.floor(amount);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;

        const rx = Math.min(w - 1, x + shift);
        const bx = Math.max(0, x - shift);

        const ri = (y * w + rx) * 4;
        const bi = (y * w + bx) * 4;

        data[i] = copy[ri];
        data[i + 2] = copy[bi + 2];
      }
    }

    ctx.putImageData(img, 0, 0);
  }

  applyDrift(amount) {
    const { ctx, width: w, height: h } = this;
    const offset = Math.sin(performance.now() * 0.001) * amount;
    ctx.drawImage(this.canvas, offset, 0, w, h);
  }
}