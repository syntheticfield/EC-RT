document.addEventListener("DOMContentLoaded", () => {
  const viewers = document.querySelectorAll(".glb-viewer");
  const cards   = document.querySelectorAll(".glb-card");

  const isTouch = window.matchMedia("(pointer: coarse)").matches;

  /* ── Camera-controls uniquement sur touch ── */
  viewers.forEach((viewer) => {
    if (isTouch) {
      viewer.setAttribute("camera-controls", "");
    } else {
      viewer.removeAttribute("camera-controls");
    }

    viewer.addEventListener("error", () => {
      console.warn("[VILE] Erreur chargement GLB :", viewer.getAttribute("src"));
    });

    /* Curseur grabbing (touch uniquement — inutile sur desktop sans nav) */
    if (isTouch) {
      viewer.addEventListener("pointerdown", () => viewer.classList.add("is-interacting"));
      window.addEventListener("pointerup",   () => viewer.classList.remove("is-interacting"));
    }

    viewer.addEventListener("click", (e) => e.stopPropagation());
  });

  /* ── Activation ──
     Desktop : hover géré en CSS (pointer: fine)
     Touch   : clic pour activer / désactiver         ── */
  if (isTouch) {
    cards.forEach((card) => {
      card.addEventListener("click", (e) => {
        e.stopPropagation();

        const already = card.classList.contains("is-active");
        cards.forEach((c) => c.classList.remove("is-active"));
        if (!already) card.classList.add("is-active");
      });
    });

    document.addEventListener("click", () => {
      cards.forEach((c) => c.classList.remove("is-active"));
    });
  }
});
