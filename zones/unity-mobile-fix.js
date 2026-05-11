/* =========================
   EC@RT — UNITY MOBILE FIX
   Version 1.2

   Appelé automatiquement par ECARTLoader après Unity ready.

   Si tu as besoin de l'appeler manuellement :
   ECARTUnityMobileFix(document.getElementById("unity-canvas"));

   CHANGELOG v1.2 :
   ─────────────────────────────
   - Suppression du listener resize (délégué à unity-loader.js
     pour éviter les doubles callbacks non coordonnés à la rotation)
   - Suppression du timer orientationTimer interne (idem — géré
     de façon centralisée dans le loader)
   - Conservation du wheel + touchmove pour bloquer le scroll
     navigateur sur le canvas
   ========================= */

window.ECARTUnityMobileFix = function (canvas) {
  if (!canvas) {
    console.warn("[ECARTUnityMobileFix] canvas introuvable.");
    return;
  }

  /* Focus systématique au tap/clic pour débloquer l'input Unity */
  canvas.tabIndex = 1;

  function focusCanvas() {
    canvas.focus({ preventScroll: true });
  }

  canvas.addEventListener("click",      focusCanvas);
  canvas.addEventListener("touchstart", focusCanvas, { passive: true });

  /* ── Empêche le scroll navigateur sur le canvas ──
     Uniquement si le touch démarre sur le canvas lui-même.
     Utilisation de { passive: false } requis pour pouvoir appeler preventDefault. */
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
  }, { passive: false });

  /* ── Bloque le touchmove sur le canvas uniquement ──
     On vérifie d'abord si le touch cible le canvas avant d'appeler preventDefault,
     afin de ne pas bloquer le scroll sur le reste de la page. */
  document.addEventListener("touchmove", (e) => {
    if (e.target === canvas || canvas.contains(e.target)) {
      e.preventDefault();
    }
  }, { passive: false });

  /* NOTE : le listener resize a été retiré de ce fichier.
     Il est géré de façon centralisée dans unity-loader.js avec :
     - un verrou orientationchange pour ignorer les dimensions transitoires
     - un debounce de 250ms pour absorber les 2 resize successifs iOS
     Avoir deux listeners resize non coordonnés provoquait des appels en
     rafale avec des dimensions intermédiaires, pouvant déclencher 2 restarts
     du renderer Unity au lieu d'un seul (après stabilisation). */

  focusCanvas();
  console.log("[ECARTUnityMobileFix] activé.");
};
