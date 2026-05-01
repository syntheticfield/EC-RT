window.Zone01Atmosphere = (() => {
  const viewer = document.getElementById("imageViewer");
  const img = document.getElementById("zoomImage");
  const audio = document.getElementById("posterAudio");

  if (!viewer || !img) return null;

  const CONFIG = {
    sharpStart: 0.08,
    sharpEnd: 0.42,
    maxBlur: 15,
    veilStrength: 0.22,
    audioInfluence: 0.035
  };

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function smoothstep(a, b, x) {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function update(time, cam) {
    const d = clamp(cam.depth || 0, 0, 1);

    const blurRatio = 1 - smoothstep(CONFIG.sharpStart, CONFIG.sharpEnd, d);
    const blur = blurRatio * CONFIG.maxBlur;

    const veil =
      blurRatio * CONFIG.veilStrength +
      (audio && !audio.paused
        ? (Math.sin(time * 0.0012) * 0.5 + 0.5) * CONFIG.audioInfluence
        : 0);

    viewer.style.setProperty("--depth", d.toFixed(3));
    viewer.style.setProperty("--veil", clamp(veil, 0, 0.55).toFixed(3));

    img.style.filter = `blur(${blur.toFixed(2)}px)`;
  }

  return { update };
})();