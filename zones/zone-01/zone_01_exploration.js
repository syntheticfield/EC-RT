window.Zone01Exploration = (() => {
  const viewer = document.getElementById("imageViewer");
  const img = document.getElementById("zoomImage");

  if (!viewer || !img) return null;

  const CONFIG = {
    minDepthToRecord: 0.2,
    holdToRecord: 720,
    maxMemoryPoints: 6,

    recompositionStartDepth: 0.38,
    recompositionFullDepth: 0.08,
    returnMessageDepth: 0.36,

    memoryFadeDuration: 90000,
    messageDuration: 1800
  };

  let whisper = null;
  let localTrace = null;
  let recompositionLayer = null;

  let pointerDown = false;
  let pointerStartedAt = 0;
  let pointerHasRecorded = false;
  let pointerMovedTooMuch = false;

  let lastPointerX = 0;
  let lastPointerY = 0;

  let messageText = "";
  let messageUntil = 0;
  let wasReturning = false;
  let lastTouchTapTime = 0;

  const memoryMarks = new Map();

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function smoothstep(a, b, x) {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function showMessage(text, duration = CONFIG.messageDuration) {
    messageText = text;
    messageUntil = performance.now() + duration;
  }

  function updateMessage() {
    if (!whisper) return;
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

  function playMemoryBirth(point, cam) {
    const screen = imagePointToScreen(point, cam);

    const birth = document.createElement("div");
    birth.className = "memory-birth-fx";
    birth.style.left = `calc(50% + ${screen.x}px)`;
    birth.style.top = `calc(50% + ${screen.y}px)`;

    viewer.appendChild(birth);

    requestAnimationFrame(() => {
      birth.classList.add("is-active");
    });

    setTimeout(() => birth.remove(), 900);
  }

  function trimMemoryIfNeeded() {
    const memories = window.Zone01Memory.all();
    if (memories.length <= CONFIG.maxMemoryPoints) return;

    const kept = memories.slice(memories.length - CONFIG.maxMemoryPoints);

    window.Zone01Memory.reset();
    kept.forEach(memory => window.Zone01Memory.addPoint(memory));
  }

  function registerAttention(point, holdTime, depth) {
    const now = Date.now();
    const cam = window.Zone01Camera?.getState();

    const zoomLayer =
      depth < 0.35 ? "surface" :
      depth < 0.68 ? "detail" :
      "grain";

    const zoomIndex =
      zoomLayer === "surface" ? 0 :
      zoomLayer === "detail" ? 1 :
      2;

    const memory = {
      id: `m-${now}-${Math.floor(Math.random() * 99999)}`,

      x: point.x,
      y: point.y,

      holdTime,
      strength: clamp(holdTime / 1800, 0.25, 1),

      firstSeen: now,
      lastSeen: now,

      lastDepth: depth,
      captureDepth: depth,
      captureScale: cam?.scale || 1,

      zoomLayer,
      zoomIndex,

      sizeSeed: 0.45 + Math.random() * 2.1,

      scatterX: (Math.random() - 0.5) * 520,
scatterY: (Math.random() - 0.5) * 380,

      shapeA: 38 + Math.random() * 24,
shapeB: 42 + Math.random() * 22,
shapeC: 36 + Math.random() * 26,
shapeD: 40 + Math.random() * 24
    };

    window.Zone01Memory.addPoint(memory);
    trimMemoryIfNeeded();

    rebuildRecomposition();
    updateMemoryCSS();

    showMessage("fragment prélevé", 1300);

    viewer.classList.add("archive-pulse");
    setTimeout(() => viewer.classList.remove("archive-pulse"), 750);
  }

  function updateMemoryCSS() {
    const memories = window.Zone01Memory.all();
    const totalStrength = memories.reduce((sum, m) => sum + m.strength, 0);
    const ratio = clamp(totalStrength / 7, 0, 1);
    viewer.style.setProperty("--memory", ratio.toFixed(3));
  }

  function updateHolding(cam) {
    if (!localTrace) return;

    const point = pointerToImage(cam);
    const screen = imagePointToScreen(point, cam);

    let dwellRatio = 0;

    const canRecord =
      pointerDown &&
      !pointerHasRecorded &&
      !pointerMovedTooMuch &&
      cam.depth >= CONFIG.minDepthToRecord;

    if (canRecord) {
      dwellRatio = clamp(
        (performance.now() - pointerStartedAt) / CONFIG.holdToRecord,
        0,
        1
      );
    }

    localTrace.style.transform = `
      translate(-50%, -50%)
      translate3d(${screen.x}px, ${screen.y}px, 0)
      scale(${0.75 + dwellRatio * 1.05 + cam.depth * 0.35})
    `;

    localTrace.style.opacity = canRecord ? 0.18 + dwellRatio * 0.82 : 0;
    localTrace.style.setProperty("--dwell", dwellRatio.toFixed(3));

    if (dwellRatio >= 1 && canRecord) {
      registerAttention(point, performance.now() - pointerStartedAt, cam.depth);
      playMemoryBirth(point, cam);
      pointerHasRecorded = true;
    }
  }

  function createMark(memory) {
    if (memoryMarks.has(memory.id)) return;

    const mark = document.createElement("div");
    mark.className = "memory-recomposition-mark";
    mark.dataset.memoryId = memory.id;

    const crop = document.createElement("div");
    crop.className = "memory-recomposition-crop";
    crop.setAttribute("aria-hidden", "true");
    crop.style.backgroundImage = `url("${img.currentSrc || img.src}")`;

    mark.appendChild(crop);
    recompositionLayer.appendChild(mark);

    memoryMarks.set(memory.id, {
      id: memory.id,
      el: mark,
      crop
    });
  }

  function rebuildRecomposition() {
    if (!recompositionLayer) return;

    const memories = window.Zone01Memory.all();
    memories.forEach(createMark);

    for (const [id, mark] of memoryMarks.entries()) {
      if (!memories.some(memory => memory.id === id)) {
        mark.el.remove();
        memoryMarks.delete(id);
      }
    }
  }

  function returnVisibility(depth) {
    return 1 - smoothstep(
      CONFIG.recompositionFullDepth,
      CONFIG.recompositionStartDepth,
      depth
    );
  }

  function updateRecomposition(cam) {
    const memories = window.Zone01Memory.all();
    const visible = returnVisibility(cam.depth);
    const deepReturn = 1 - smoothstep(0.05, 0.22, cam.depth);
    const finalStrate = 1 - smoothstep(0.0, 0.24, cam.depth);
    const isSurface = finalStrate > 0.92;
    const active = memories.length > 0 && visible > 0.01;

    recompositionLayer.classList.toggle("is-visible", active);
    viewer.classList.toggle("is-return-blur", active);

    if (!active) return;

    const rect = viewer.getBoundingClientRect();

    memories.forEach((memory, index) => {
      const mark = memoryMarks.get(memory.id);
      if (!mark) return;

      const strength = clamp(memory.strength, 0.2, 1);
      const zoomIndex = memory.zoomIndex ?? 1;

      const memoryPull = 0.28;
const archiveDrift = visible * (1.8 + deepReturn * 1.2);
      const rememberedX = rect.width * memory.x - rect.width / 2;
      const rememberedY = rect.height * memory.y - rect.height / 2;

      const bubbleX = rememberedX * memoryPull + memory.scatterX * archiveDrift;
      const bubbleY = rememberedY * memoryPull + memory.scatterY * archiveDrift;

      const fullX =
        (index - memories.length / 2) *
        rect.width *
        (0.11 + zoomIndex * 0.05);

      const fullY =
        Math.sin(index * 1.7) *
        rect.height *
        0.04;

      const baseX = bubbleX * (1 - finalStrate) + fullX * finalStrate;
      const baseY = bubbleY * (1 - finalStrate) + fullY * finalStrate;

      const bubbleSize =
        memory.sizeSeed *
        (0.45 + visible * 0.85 + strength * 0.35);

      const fullPageSize =
        10 +
        zoomIndex * 4 +
        index * 0.8;

      const size =
        bubbleSize * (1 - finalStrate) +
        fullPageSize * finalStrate;

      mark.el.style.opacity =
        visible > 0.04 ? 0.78 + finalStrate * 0.22 : 0;

      mark.el.style.mixBlendMode =
        finalStrate > 0.45
          ? ["multiply", "screen", "overlay", "soft-light"][index % 4]
          : "normal";

      mark.el.style.filter =
        finalStrate > 0.35
          ? `
            contrast(${1.05 + index * 0.04})
            brightness(${0.72 + (index % 3) * 0.12})
            saturate(${0.65 + (index % 4) * 0.18})
            blur(${index % 2 === 0 ? 0 : 1.2}px)
          `
          : "";

      mark.el.style.transform = `
        translate3d(${baseX}px, ${baseY}px, 0)
        rotate(${finalStrate * (index * 4 - 6)}deg)
        scale(${size})
      `;

      const organicRadius = `
        ${memory.shapeA}% ${100 - memory.shapeA}%
        ${memory.shapeB}% ${100 - memory.shapeB}% /
        ${memory.shapeC}% ${100 - memory.shapeC}%
        ${memory.shapeD}% ${100 - memory.shapeD}%
      `;

mark.el.style.borderRadius = isSurface
  ? "0"
  : organicRadius;

mark.el.style.overflow = isSurface
  ? "visible"
  : "hidden";

mark.crop.style.inset = isSurface
  ? "-160%"
  : "0";
      mark.el.style.setProperty("--strength", strength.toFixed(3));

      const faithfulZoom =
        160 +
        Math.pow(memory.captureDepth, 1.9) * 2600 +
        zoomIndex * 420;

      mark.crop.style.backgroundSize = `${faithfulZoom}% auto`;
      mark.crop.style.backgroundPosition = `
        ${clamp(memory.x * 100, 0, 100)}%
        ${clamp(memory.y * 100, 0, 100)}%
      `;
    });
  }

  function updateReturnMessage(cam) {
    const inReturn =
      cam.depth < CONFIG.returnMessageDepth &&
      window.Zone01Memory.count() > 0;

    if (inReturn && !wasReturning) {
      showMessage("les fragments prélevés reviennent", 1600);
    }

    wasReturning = inReturn;
  }

  function bindEvents() {
    viewer.addEventListener("pointerdown", event => {
      if (event.pointerType === "mouse" && event.button !== 0) return;

      pointerDown = true;
      pointerStartedAt = performance.now();
      pointerHasRecorded = false;
      pointerMovedTooMuch = false;

      lastPointerX = event.clientX;
      lastPointerY = event.clientY;

      if (event.pointerType === "touch") {
        const now = performance.now();
        const isDoubleTap = now - lastTouchTapTime < 360;
        lastTouchTapTime = now;

        if (isDoubleTap) {
          const cam = window.Zone01Camera?.getState();
          if (!cam || cam.depth < CONFIG.minDepthToRecord) return;

          const point = pointerToImage(cam);
          registerAttention(point, CONFIG.holdToRecord, cam.depth);
          playMemoryBirth(point, cam);

          pointerHasRecorded = true;
          pointerDown = false;
        }
      }
    });

    viewer.addEventListener("pointermove", event => {
      if (!pointerDown) return;

      const d = Math.hypot(
        event.clientX - lastPointerX,
        event.clientY - lastPointerY
      );

      if (d > 22) pointerMovedTooMuch = true;
    });

    function endPointer() {
      pointerDown = false;
      pointerStartedAt = 0;
      pointerHasRecorded = false;
      pointerMovedTooMuch = false;

      if (localTrace) localTrace.style.opacity = 0;
    }

    viewer.addEventListener("pointerup", endPointer);
    viewer.addEventListener("pointercancel", endPointer);
    viewer.addEventListener("pointerleave", endPointer);
  }

  function init() {
    createInterface();
    bindEvents();
    rebuildRecomposition();
    updateMemoryCSS();
    showMessage("zoomer, maintenir, relâcher, revenir", 3200);
  }

  function update(time, cam) {
    updateHolding(cam);
    updateRecomposition(cam, time);
    updateReturnMessage(cam);
    updateMessage();
  }

  return {
    init,
    update
  };
})();