'use strict';

/* ═══════════════════════════════════════════════════════════
   EC@RT — no-zoom.js
   Bloque le zoom navigateur (pinch iOS/iPadOS/Android)
   sur toutes les zones. À inclure en premier <script>.
   ═══════════════════════════════════════════════════════════ */

(function () {

  /* 1. Forcer le viewport via JS (rattrape les meta mal définis) */
  var meta = document.querySelector('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'viewport';
    document.head.appendChild(meta);
  }
  meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';

  /* 2. Bloquer gesturestart / gesturechange (Safari iOS/iPadOS) */
  document.addEventListener('gesturestart',  function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturechange', function (e) { e.preventDefault(); }, { passive: false });

  /* 3. Bloquer touchmove à 2+ doigts (pinch Chrome Android + Safari) */
  window.addEventListener('touchmove', function (e) {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });

})();