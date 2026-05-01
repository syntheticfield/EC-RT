window.Zone01Atmosphere = (() => {
  const viewer = document.getElementById("imageViewer");
  const img = document.getElementById("zoomImage");
  const audio = document.getElementById("posterAudio");

  if (!viewer || !img) return null;

  const CONFIG = {
    sharpStart: 0.03,
    sharpEnd: 0.28,

    maxBlur: 16,
    returnBlur: 0,

    veilStrength: 0.2,
    audioInfluence: 0.06,
    punishBlur: 0.6,
    punishVeil: 0.08
  };

  let lastDepth = 0;
  let punishedUntil = 0;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function smoothstep(a, b, x) {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function punish(duration = 380) {
    punishedUntil = performance.now() + duration;
  }

  function update(time, cam) {
    const d = cam.depth || 0;

    const velocity = Math.abs(d - lastDepth);
    const zoomingIn = d > lastDepth;

    if (zoomingIn && velocity > 0.065) {
      punish();
    }

    lastDepth = d;

    const punished = time < punishedUntil;
    const isReturn = viewer.classList.contains("is-return-blur");

    const depthBlur =
      (1 - smoothstep(CONFIG.sharpStart, CONFIG.sharpEnd, d)) *
      CONFIG.maxBlur;

    const returnBlur = isReturn ? CONFIG.returnBlur : 0;

    const finalBlur =
      depthBlur +
      returnBlur +
      (punished ? CONFIG.punishBlur : 0);

    const veil =
      (1 - smoothstep(0.06, 0.28, d)) * CONFIG.veilStrength +
      (punished ? CONFIG.punishVeil : 0);

    const audioPulse =
      audio && !audio.paused
        ? (Math.sin(time * 0.0016) * 0.5 + 0.5) * CONFIG.audioInfluence
        : 0;

    const finalVeil = clamp(veil + audioPulse, 0, 0.75);

    viewer.style.setProperty("--depth", d.toFixed(3));
    viewer.style.setProperty("--veil", finalVeil.toFixed(3));

    img.style.filter = `
      blur(${finalBlur}px)
      contrast(1)
      brightness(1)
      saturate(1)
    `;
  }

  return {
    update,
    punish
  };
})();