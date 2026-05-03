/* =========================
   EC@RT — UNITY MOBILE FIX
   Version propre : plus d'auto-init via window.load.
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

  /* Empêche le scroll navigateur sur le canvas (pinch-to-zoom iOS) */
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
  }, { passive: false });

  document.addEventListener("touchmove", (e) => {
    if (e.target === canvas || canvas.contains(e.target)) {
      e.preventDefault();
    }
  }, { passive: false });

  focusCanvas();
  console.log("[ECARTUnityMobileFix] activé.");
};