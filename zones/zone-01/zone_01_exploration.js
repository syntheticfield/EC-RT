window.Zone01Exploration = (() => {
  const viewer = document.getElementById("imageViewer");
  const img = document.getElementById("zoomImage");

  if (!viewer || !img) return null;

  const CONFIG = {
    minDepthToRecord: 0.22,
    holdToRecord: 720,
    maxMemoryPoints: 10,

    recompositionStartDepth: 0.42,
    recompositionFullDepth: 0.08,
    imageSharpDepth: 0.42,

    messageDuration: 1600
  };

  let recompositionLayer = null;
  let localTrace = null;
  let whisper = null;

  let pointerDown = false;
  let pointerStartedAt = 0;
  let pointerHasRecorded = false;
  let pointerMovedTooMuch = false;
  let pointerStartX = 0;
  let pointerStartY = 0;

  let messageText = "";
  let messageUntil = 0;
  let wasReturning = false;

  let cachedRect = { width: 1, height: 1 };
  let cachedMemories = [];
  const marks = new Map();

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function smoothstep(a, b, x) {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function random(min, max) {
    return min + Math.random() * (max - min);
  }

  function updateRectCache() {
    const rect = viewer.getBoundingClientRect();
    cachedRect.width = rect.width || 1;
    cachedRect.height = rect.height || 1;
  }

  function showMessage(text, duration = CONFIG.messageDuration) {
    messageText = text;
    messageUntil = performance.now() + duration;
  }

  function updateMessage() {
    const visible = performance.now() < messageUntil;
    whisper.textContent = visible ? messageText : "";
    whisper.classList.toggle("is-visible", visible);
  }

  function pointerToImage(cam) {
    return {
      x: clamp(0.5 + (cam.pointerX - cam.x) / (img.naturalWidth * cam.scale), 0, 1),
      y: clamp(0.5 + (cam.pointerY - cam.y) / (img.naturalHeight * cam.scale), 0, 1)
    };
  }

  function imagePointToScreen(point, cam) {
    return {
      x: (point.x - 0.5) * img.naturalWidth * cam.scale + cam.x,
      y: (point.y - 0.5) * img.naturalHeight * cam.scale + cam.y
    };
  }

  function getZoomLayer(depth) {
    if (depth < 0.35) return { zoomLayer: "surface", zoomIndex: 0 };
    if (depth < 0.68) return { zoomLayer: "detail", zoomIndex: 1 };
    return { zoomLayer: "grain", zoomIndex: 2 };
  }

  function createInterface() {
    recompositionLayer = document.createElement("div");
    recompositionLayer.className = "memory-recomposition-layer";
    viewer.appendChild(recompositionLayer);

    localTrace = document.createElement("div");
    localTrace.className = "attention-local-trace";
    viewer.appendChild(localTrace);

    whisper = document.createElement("div");
    whisper.className = "archive-whisper";
    viewer.appendChild(whisper);
  }

  function registerAttention(point, holdTime, depth) {
    const cam = window.Zone01Camera?.getState?.();
    const now = Date.now();
    const layer = getZoomLayer(depth);

    const memory = {
      id: `m-${now}-${Math.floor(Math.random() * 100000)}`,

      x: point.x,
      y: point.y,

      captureDepth: depth,
      captureScale: cam?.scale || 1,
      zoomLayer: layer.zoomLayer,
      zoomIndex: layer.zoomIndex,

      holdTime,
      strength: clamp(holdTime / 1800, 0.25, 1),

      scatterX: random(-180, 180),
      scatterY: random(-130, 130),
      phase: random(0, Math.PI * 2),

      bubbleScale: random(0.82, 1.35),
      strateScale: random(0.92, 1.18),

      shape: `${random(24, 44)}% ${random(56, 76)}% ${random(38, 62)}% ${random(40, 70)}% / ${random(42, 70)}% ${random(32, 58)}% ${random(48, 74)}% ${random(28, 56)}%`
    };

    window.Zone01Memory.addPoint(memory);
    rebuildRecomposition();

    viewer.classList.add("archive-pulse");
    window.setTimeout(() => viewer.classList.remove("archive-pulse"), 500);

    showMessage("fragment prélevé", 1200);
  }

  function createMark(memory) {
    if (marks.has(memory.id)) return;

    const mark = document.createElement("div");
    mark.className = "memory-recomposition-mark";

    const crop = document.createElement("div");
    crop.className = "memory-recomposition-crop";
    crop.style.setProperty("--soft-x", `${35 + Math.random() * 30}%`);
crop.style.setProperty("--soft-y", `${35 + Math.random() * 30}%`);
    crop.style.backgroundImage = `url("${img.currentSrc || img.src}")`;

    const faithfulZoom =
      180 +
      Math.pow(memory.captureDepth, 1.8) * 2400 +
      memory.zoomIndex * 420;

    crop.style.backgroundSize = `${faithfulZoom}% auto`;
    crop.style.backgroundPosition = `${memory.x * 100}% ${memory.y * 100}%`;

    mark.style.borderRadius = memory.shape;
    mark.appendChild(crop);
    recompositionLayer.appendChild(mark);

    marks.set(memory.id, { el: mark, crop });
  }

  function rebuildRecomposition() {
    cachedMemories = window.Zone01Memory.all().slice(-CONFIG.maxMemoryPoints);

    cachedMemories.forEach(createMark);

    for (const [id, mark] of marks.entries()) {
      if (!cachedMemories.some(memory => memory.id === id)) {
        mark.el.remove();
        marks.delete(id);
      }
    }

    const totalStrength = cachedMemories.reduce((sum, m) => sum + m.strength, 0);
    viewer.style.setProperty("--memory", clamp(totalStrength / 7, 0, 1).toFixed(3));
  }

  function updateHolding(cam) {
    const point = pointerToImage(cam);
    const screen = imagePointToScreen(point, cam);

    const canRecord =
      pointerDown &&
      !pointerHasRecorded &&
      !pointerMovedTooMuch &&
      cam.depth >= CONFIG.minDepthToRecord;

    const dwell = canRecord
      ? clamp((performance.now() - pointerStartedAt) / CONFIG.holdToRecord, 0, 1)
      : 0;

    localTrace.style.opacity = canRecord ? (0.14 + dwell * 0.55).toFixed(3) : 0;
    localTrace.style.setProperty("--dwell", dwell.toFixed(3));
    localTrace.style.transform =
      `translate3d(${screen.x}px, ${screen.y}px, 0) translate(-50%, -50%) scale(${0.8 + dwell * 0.9})`;

    if (dwell >= 1 && canRecord) {
      registerAttention(point, performance.now() - pointerStartedAt, cam.depth);
      pointerHasRecorded = true;
    }
  }

  function updateRecomposition(cam, time) {
    if (!cachedMemories.length) {
      recompositionLayer.classList.remove("is-visible");
      viewer.classList.remove("is-return-blur");
      return;
    }

    const depth = clamp(cam.depth || 0, 0, 1);

    const visible =
      1 - smoothstep(CONFIG.recompositionFullDepth, CONFIG.recompositionStartDepth, depth);

    const strate =
      1 - smoothstep(0.02, CONFIG.recompositionFullDepth, depth);

    const active = visible > 0.01 && depth < CONFIG.imageSharpDepth;

    recompositionLayer.classList.toggle("is-visible", active);
    viewer.classList.toggle("is-return-blur", active);

    if (!active) return;

    const w = cachedRect.width;
    const h = cachedRect.height;
    const count = cachedMemories.length;
    const breath = Math.sin(time * 0.00018) * 0.5 + 0.5;

    cachedMemories.forEach((memory, index) => {
      const mark = marks.get(memory.id);
      if (!mark) return;

      const strength = clamp(memory.strength, 0.25, 1);
      const zi = memory.zoomIndex || 0;

      const rememberedX = (memory.x - 0.5) * w * 0.55;
      const rememberedY = (memory.y - 0.5) * h * 0.55;

      const bubbleX = rememberedX + memory.scatterX * visible;
      const bubbleY = rememberedY + memory.scatterY * visible;

    const organicX =
  (memory.x - 0.5) * w * 0.42 +
  Math.cos(memory.phase) * w * 0.16 +
  Math.sin(memory.phase * 1.7) * w * 0.08;

const organicY =
  (memory.y - 0.5) * h * 0.24 +
  Math.sin(memory.phase) * h * 0.18 +
  Math.cos(memory.phase * 1.4) * h * 0.08;

const strateX = organicX;
const strateY = organicY;

      const x = bubbleX * (1 - strate) + strateX * strate;
      const y = bubbleY * (1 - strate) + strateY * strate;

      const bubbleScale = memory.bubbleScale * (0.75 + visible * 0.8);
     const fullScale =
  memory.strateScale *
  (4.6 + zi * 1.45 + count * 0.14 + strength * 0.9);const scale = bubbleScale * (1 - strate) + fullScale * strate;

      const slowY = Math.sin(time * 0.00012 + memory.phase) * 6 * visible;
      const slowScale = 1 + (breath - 0.5) * 0.018;

      mark.el.style.opacity = (visible * (0.62 + strength * 0.26)).toFixed(3);
      mark.el.style.transform =
        `translate3d(${x}px, ${y + slowY}px, 0) rotate(${(strate * (index - count / 2) * 2.2).toFixed(2)}deg) scale(${(scale * slowScale).toFixed(3)})`;

   mark.el.classList.toggle("is-strate", strate > 0.62);

mark.crop.style.opacity = (
  0.62 +
  visible * 0.18 +
  strate * 0.16
).toFixed(3);

mark.crop.style.transform = `
  scale(${1.08 + strate * 0.16})
  translate3d(${Math.sin(memory.phase) * strate * 8}px, ${Math.cos(memory.phase) * strate * 6}px, 0)
`;
    });
  }

  function updateReturnMessage(cam) {
    const returning = cam.depth < CONFIG.recompositionStartDepth && cachedMemories.length > 0;

    if (returning && !wasReturning) {
      showMessage("les fragments prélevés reviennent", 1400);
    }

    wasReturning = returning;
  }

  function bindEvents() {
    viewer.addEventListener("pointerdown", event => {
      pointerDown = true;
      pointerStartedAt = performance.now();
      pointerHasRecorded = false;
      pointerMovedTooMuch = false;
      pointerStartX = event.clientX;
      pointerStartY = event.clientY;
    }, { passive: true });

    viewer.addEventListener("pointermove", event => {
      if (!pointerDown) return;

      const d = Math.hypot(event.clientX - pointerStartX, event.clientY - pointerStartY);
      if (d > 24) pointerMovedTooMuch = true;
    }, { passive: true });

    const endPointer = () => {
      pointerDown = false;
      pointerStartedAt = 0;
      pointerHasRecorded = false;
      pointerMovedTooMuch = false;
      localTrace.style.opacity = 0;
    };

    viewer.addEventListener("pointerup", endPointer, { passive: true });
    viewer.addEventListener("pointercancel", endPointer, { passive: true });
    viewer.addEventListener("pointerleave", endPointer, { passive: true });

    window.addEventListener("resize", updateRectCache, { passive: true });
  }

  function init() {
    createInterface();
    updateRectCache();
    bindEvents();
    rebuildRecomposition();
    showMessage("zoomer, maintenir, revenir", 2600);
  }

  function update(time, cam) {
    updateHolding(cam);
    updateRecomposition(cam, time);
    updateReturnMessage(cam);
    updateMessage();
  }

  return { init, update };
})();