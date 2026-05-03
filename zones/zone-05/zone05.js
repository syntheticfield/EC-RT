(() => {
  const zone = document.querySelector(".bad-zone");
  const blurTable = document.getElementById("badBlurTable");
  const lens = document.getElementById("badLens");
  const lensTable = document.getElementById("badLensTable");

  if (!zone || !blurTable || !lens || !lensTable) return;

  const SCANS = [
    "./BAD-img/BAD_01.png",
    "./BAD-img/BAD_02.png",
    "./BAD-img/BAD_03.png",
    "./BAD-img/BAD_04.png",
  ];

  let zoom = 1;
  const minZoom = 1;
  const maxZoom = 3;

  let lensZoom = 1;

  let originX = 50;
  let originY = 50;

  let panX = 0;
  let panY = 0;

  let lensX = 0;
  let lensY = 0;

  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let panStartX = 0;
  let panStartY = 0;

  let lastTapTime = 0;
  let touchMode = null;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchPanStartX = 0;
  let touchPanStartY = 0;

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function isTouchDevice() {
    return window.matchMedia("(pointer: coarse)").matches;
  }

  function createPaper(src, data) {
    const img = document.createElement("img");
    img.src = src;
    img.className = "bad-paper";

    img.style.left = `${data.x}%`;
    img.style.top = `${data.y}%`;
    img.style.zIndex = data.z;
    img.style.opacity = data.opacity;
    img.style.transform = `rotate(${data.rot}deg) scale(${data.scale})`;

    return img;
  }

  function createScene() {
    blurTable.innerHTML = "";
    lensTable.innerHTML = "";

    SCANS.forEach((src) => {
      const data = {
        x: rand(2, 62),
        y: rand(2, 58),
        rot: rand(-24, 24),
        scale: rand(1.0, 1.45),
        z: Math.floor(rand(1, 40)),
        opacity: rand(0.82, 0.98),
      };

      blurTable.appendChild(createPaper(src, data));
      lensTable.appendChild(createPaper(src, data));
    });

    applyTransform();
  }

  function applyTransform() {
    blurTable.style.transformOrigin = `${originX}% ${originY}%`;
    blurTable.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;

    if (lensX && lensY) {
      moveLens(lensX, lensY);
    }
  }

  function updateOrigin(clientX, clientY) {
    const rect = zone.getBoundingClientRect();

    originX = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
    originY = clamp(((clientY - rect.top) / rect.height) * 100, 0, 100);
  }

  function moveLens(clientX, clientY) {
    lensX = clientX;
    lensY = clientY;

    const zoneRect = zone.getBoundingClientRect();
    const radius = lens.offsetWidth / 2;

    lens.style.left = `${clientX}px`;
    lens.style.top = `${clientY}px`;
    lens.style.opacity = "1";

    lensTable.style.width = `${zoneRect.width}px`;
    lensTable.style.height = `${zoneRect.height}px`;

    lensTable.style.left = `${zoneRect.left - clientX + radius}px`;
    lensTable.style.top = `${zoneRect.top - clientY + radius}px`;

    lensTable.style.transformOrigin = `${originX}% ${originY}%`;
    lensTable.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom * lensZoom})`;
  }

  function isInsideLens(clientX, clientY) {
    const dx = clientX - lensX;
    const dy = clientY - lensY;
    const radius = lens.offsetWidth / 2;
    return Math.sqrt(dx * dx + dy * dy) <= radius;
  }

  // ── PC / TRACKPAD ──

  zone.addEventListener(
    "wheel",
    (e) => {
      const rect = zone.getBoundingClientRect();

      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      if (!inside) return;

      e.preventDefault();
      updateOrigin(e.clientX, e.clientY);

      const isTrackpad = Math.abs(e.deltaX) > 0 || Math.abs(e.deltaY) < 40;

      if (e.ctrlKey || !isTrackpad) {
        const delta = -e.deltaY * 0.0012;
        zoom = clamp(zoom + delta, minZoom, maxZoom);
      } else {
        panX -= e.deltaX;
        panY -= e.deltaY;
      }

      applyTransform();
      moveLens(e.clientX, e.clientY);
    },
    { passive: false }
  );

  zone.addEventListener("mousemove", (e) => {
    if (!isDragging) moveLens(e.clientX, e.clientY);
  });

  zone.addEventListener("mouseenter", (e) => {
    moveLens(e.clientX, e.clientY);
  });

  zone.addEventListener("mouseleave", () => {
    if (!isDragging && !isTouchDevice()) lens.style.opacity = "0";
  });

  zone.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;

    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    panStartX = panX;
    panStartY = panY;

    zone.classList.add("is-dragging");
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    panX = panStartX + (e.clientX - dragStartX);
    panY = panStartY + (e.clientY - dragStartY);

    applyTransform();
    moveLens(e.clientX, e.clientY);
  });

  window.addEventListener("mouseup", () => {
    if (!isDragging) return;

    isDragging = false;
    zone.classList.remove("is-dragging");
  });

  // ── MOBILE / TABLETTE ──

  zone.addEventListener(
    "touchstart",
    (e) => {
      const touch = e.touches[0];
      if (!touch) return;

      const now = Date.now();
      const isDoubleTap = now - lastTapTime < 300;

      if (isDoubleTap) {
        lensZoom = lensZoom > 1 ? 1 : 2;
        moveLens(lensX || touch.clientX, lensY || touch.clientY);
        lastTapTime = 0;
        return;
      }

      lastTapTime = now;

      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchPanStartX = panX;
      touchPanStartY = panY;

      touchMode = isInsideLens(touch.clientX, touch.clientY) ? "lens" : "pan";

      lens.style.opacity = "1";
    },
    { passive: false }
  );

  zone.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();

      const touch = e.touches[0];
      if (!touch) return;

      if (touchMode === "lens") {
        moveLens(touch.clientX, touch.clientY);
        return;
      }

      if (touchMode === "pan") {
        panX = touchPanStartX + (touch.clientX - touchStartX);
        panY = touchPanStartY + (touch.clientY - touchStartY);

        applyTransform();
        moveLens(lensX, lensY);
      }
    },
    { passive: false }
  );

  zone.addEventListener(
    "touchend",
    () => {
      touchMode = null;
      lens.style.opacity = "1";
    },
    { passive: false }
  );

  createScene();

  requestAnimationFrame(() => {
    const rect = zone.getBoundingClientRect();
    moveLens(rect.left + rect.width / 2, rect.top + rect.height / 2);

    if (!isTouchDevice()) {
      lens.style.opacity = "0";
    }
  });

  window.addEventListener("resize", () => {
    applyTransform();
    moveLens(lensX, lensY);
  });
})();
