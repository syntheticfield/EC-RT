window.Zone01Camera = (() => {
  const viewer = document.getElementById("imageViewer");
  const img = document.getElementById("zoomImage");

  if (!viewer || !img) return null;

  const CONFIG = {
    maxZoomMultiplier: 36,
    zoomSpeed: 0.0022,
    pinchSpeed: 1.1,
    zoomSmooth: 0.18,
    panSmooth: 0.18
  };

  const state = {
    scale: 1,
    targetScale: 1,
    minScale: 1,
    maxScale: 1,

    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,

    pointerX: 0,
    pointerY: 0,

    dragging: false,
    dragStartX: 0,
    dragStartY: 0,

    lastTime: 0
  };

  const pointers = new Map();
  let lastPinchDistance = null;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function computeScales() {
    const rect = viewer.getBoundingClientRect();

    if (!img.naturalWidth || !img.naturalHeight) return;

    state.minScale = Math.min(
      rect.width / img.naturalWidth,
      rect.height / img.naturalHeight
    );

    state.maxScale = state.minScale * CONFIG.maxZoomMultiplier;
  }

  function depth() {
    if (state.maxScale === state.minScale) return 0;

    return clamp(
      Math.log(state.scale / state.minScale) /
        Math.log(state.maxScale / state.minScale),
      0,
      1
    );
  }

  function getBounds(scale = state.targetScale) {
    const rect = viewer.getBoundingClientRect();

    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;

    return {
      maxX: Math.max(0, (w - rect.width) / 2),
      maxY: Math.max(0, (h - rect.height) / 2)
    };
  }

  function clampPosition() {
    const bounds = getBounds();

    state.targetX = clamp(state.targetX, -bounds.maxX, bounds.maxX);
    state.targetY = clamp(state.targetY, -bounds.maxY, bounds.maxY);

   if (state.targetScale <= state.minScale) {
  // visuellement bloqué
  state.targetX = 0;
  state.targetY = 0;
}
  }

  function applyTransform() {
    img.style.transform = `
      translate(-50%, -50%)
      translate3d(${state.x}px, ${state.y}px, 0)
      scale(${Math.max(state.scale, state.minScale)})
    `;
  }

  function zoomAt(clientX, clientY, factor) {
    const rect = viewer.getBoundingClientRect();

    const localX = clientX - rect.left - rect.width / 2;
    const localY = clientY - rect.top - rect.height / 2;

    const oldScale = state.targetScale;

  const nextScale = state.targetScale * factor;

// autorise un léger dépassement sous minScale
const minSoft = state.minScale * 0.85;

state.targetScale = clamp(
  nextScale,
  minSoft,
  state.maxScale
);

    const ratio = state.targetScale / oldScale;

    state.targetX = localX - (localX - state.targetX) * ratio;
    state.targetY = localY - (localY - state.targetY) * ratio;

    state.pointerX = localX;
    state.pointerY = localY;

    clampPosition();
  }

  function reset() {
    state.scale = state.minScale;
    state.targetScale = state.minScale;

    state.x = 0;
    state.y = 0;
    state.targetX = 0;
    state.targetY = 0;
  }

  function update(time) {
    const dt = state.lastTime
      ? Math.min(1.8, (time - state.lastTime) / 16.666)
      : 1;

    state.lastTime = time;

    state.scale += (state.targetScale - state.scale) * CONFIG.zoomSmooth * dt;
    state.x += (state.targetX - state.x) * CONFIG.panSmooth * dt;
    state.y += (state.targetY - state.y) * CONFIG.panSmooth * dt;

    clampPosition();
    applyTransform();
  }

  viewer.addEventListener(
    "wheel",
    event => {
      event.preventDefault();

      const factor = Math.exp(-event.deltaY * CONFIG.zoomSpeed);
      zoomAt(event.clientX, event.clientY, factor);
    },
    { passive: false }
  );

  viewer.addEventListener("pointerdown", event => {
    pointers.set(event.pointerId, event);

    const rect = viewer.getBoundingClientRect();

    state.pointerX = event.clientX - rect.left - rect.width / 2;
    state.pointerY = event.clientY - rect.top - rect.height / 2;

    viewer.setPointerCapture(event.pointerId);

    if (pointers.size === 1) {
      state.dragging = true;
      viewer.classList.add("is-dragging");

      state.dragStartX = event.clientX - state.targetX;
      state.dragStartY = event.clientY - state.targetY;
    }

    if (pointers.size === 2) {
      state.dragging = false;
      viewer.classList.remove("is-dragging");

      const pts = [...pointers.values()];
      lastPinchDistance = Math.hypot(
        pts[0].clientX - pts[1].clientX,
        pts[0].clientY - pts[1].clientY
      );
    }
  });

  viewer.addEventListener("pointermove", event => {
    if (!pointers.has(event.pointerId)) return;

    pointers.set(event.pointerId, event);

    const rect = viewer.getBoundingClientRect();

    state.pointerX = event.clientX - rect.left - rect.width / 2;
    state.pointerY = event.clientY - rect.top - rect.height / 2;

    if (pointers.size === 1 && state.dragging) {
      state.targetX = event.clientX - state.dragStartX;
      state.targetY = event.clientY - state.dragStartY;
      clampPosition();
      return;
    }

    if (pointers.size === 2) {
      const pts = [...pointers.values()];

      const a = pts[0];
      const b = pts[1];

      const distance = Math.hypot(
        a.clientX - b.clientX,
        a.clientY - b.clientY
      );

      if (!lastPinchDistance) {
        lastPinchDistance = distance;
        return;
      }

      const centerX = (a.clientX + b.clientX) / 2;
      const centerY = (a.clientY + b.clientY) / 2;

      const factor = Math.pow(distance / lastPinchDistance, CONFIG.pinchSpeed);

      zoomAt(centerX, centerY, factor);

      lastPinchDistance = distance;
    }
  });

  function endPointer(event) {
    pointers.delete(event.pointerId);

    if (viewer.hasPointerCapture(event.pointerId)) {
      viewer.releasePointerCapture(event.pointerId);
    }

    if (pointers.size === 0) {
      state.dragging = false;
      viewer.classList.remove("is-dragging");
      lastPinchDistance = null;
    }

    if (pointers.size === 1) {
      const remaining = [...pointers.values()][0];

      state.dragging = true;
      state.dragStartX = remaining.clientX - state.targetX;
      state.dragStartY = remaining.clientY - state.targetY;

      lastPinchDistance = null;
    }
  }

  viewer.addEventListener("pointerup", endPointer);
  viewer.addEventListener("pointercancel", endPointer);
  viewer.addEventListener("pointerleave", endPointer);

  viewer.addEventListener("dblclick", reset);

  window.addEventListener("resize", () => {
    const d = depth();

    computeScales();

    state.targetScale =
      state.minScale * Math.pow(state.maxScale / state.minScale, d);

    state.scale = state.targetScale;

    clampPosition();
  });

  function init() {
    computeScales();
    reset();
  }

  return {
    init,
    update,
    reset,
    getState() {
      return {
        scale: state.scale,
        minScale: state.minScale,
        maxScale: state.maxScale,
        x: state.x,
        y: state.y,
        pointerX: state.pointerX,
        pointerY: state.pointerY,
        depth: depth()
      };
    }
  };
})();