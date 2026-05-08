/* =========================
   EC@RT — UNITY MOBILE FIX
   Version 1.1

   Appelé automatiquement par ECARTLoader après Unity ready.

   Si tu as besoin de l'appeler manuellement :
   ECARTUnityMobileFix(document.getElementById("unity-canvas"));
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

  /* ── Stabilisation au changement d'orientation ──
     Sur iPad/iPhone, la rotation provoque un resize en deux temps.
     On attend la fin du redimensionnement avant de refocaliser
     pour éviter d'interrompre le re-layout du navigateur. */
  let orientationTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(orientationTimer);
    orientationTimer = setTimeout(() => {
      focusCanvas();
    }, 150);
  });

  focusCanvas();
  console.log("[ECARTUnityMobileFix] activé.");
};
