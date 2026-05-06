/* =========================
   EC@RT — JOYSTICK VIRTUEL
   Version 1.3

   FIXES v1.3 :
   ─────────────────────────────
   v1.2 utilisait les Pointer Events. Sur iOS Safari, Unity WebGL
   appelle preventDefault() sur touchstart/touchmove du canvas, ce qui
   supprime les Pointer Events générés à partir de ce touch.
   Résultat : pointerdown ne tire jamais → knob immobile.

   Solution : utiliser directement les Touch Events (touchstart /
   touchmove / touchend), enregistrés sur window en phase CAPTURE avec
   { passive: false }. Les Touch Events sont la couche native — ils
   ne peuvent pas être supprimés par les Pointer Events du canvas.
   On utilise stopImmediatePropagation() (pas juste stopPropagation)
   pour bloquer tous les autres listeners window-level.

   RAPPEL IMPORTANT :
   ─────────────────────────────
   Dans zone-XX.html, le script doit s'appeler exactement comme le
   fichier sur le serveur. Vérifier que :
     <script src="../ecart-joystick.js"></script>
   correspond bien au nom du fichier déployé.

   USAGE :
   ─────────────────────────────
   ECARTJoystick.init({
     gameObject : "Main Camera",    // nom exact du GO Unity
     method     : "ReceiveJoystick",
     sendRate   : 60,
     deadzone   : 0.08,
     onInput    : (x, y) => {}
   });
   ========================= */

window.ECARTJoystick = (() => {

  const state = {
    active:   false,
    touchId:  null,   // touch.identifier (Touch Events)
    centerX:  0,
    centerY:  0,
    radius:   0,
    x:        0,
    y:        0,
    lastSend: 0
  };

  let cfg = {};

  /* ─────────────────────────────
     Envoi Unity
     ───────────────────────────── */

  function sendToUnity(x, y) {
    const instance = window.unityInstance;
    if (!instance) return;
    try {
      instance.SendMessage(
        cfg.gameObject,
        cfg.method,
        `${x.toFixed(4)},${y.toFixed(4)}`
      );
    } catch (_) { /* Unity pas encore prêt */ }
  }

  /* ─────────────────────────────
     Vérifie si un point est dans le joystick
     ───────────────────────────── */

  function isInJoystickBounds(clientX, clientY) {
    const el = document.getElementById("ecartJoystickTouch");
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return clientX >= r.left && clientX <= r.right &&
           clientY >= r.top  && clientY <= r.bottom;
  }

  /* ─────────────────────────────
     Mise à jour visuelle du knob
     ───────────────────────────── */

  function updateKnob(clientX, clientY) {
    const dx      = clientX - state.centerX;
    const dy      = clientY - state.centerY;
    const dist    = Math.hypot(dx, dy);
    const maxDist = state.radius;

    if (maxDist <= 0) return;

    const ratio    = Math.min(dist / maxDist, 1);
    const angle    = Math.atan2(dy, dx);
    const clampedX = Math.cos(angle) * ratio * maxDist;
    const clampedY = Math.sin(angle) * ratio * maxDist;

    const knob = document.getElementById("ecartJoystickKnob");
    if (knob) {
      knob.style.transform =
        `translate(calc(-50% + ${clampedX}px), calc(-50% + ${clampedY}px))`;
    }

    let nx = clampedX / maxDist;
    let ny = clampedY / maxDist;
    if (Math.abs(nx) < cfg.deadzone) nx = 0;
    if (Math.abs(ny) < cfg.deadzone) ny = 0;

    state.x = nx;
    state.y = -ny; // haut = positif

    if (typeof cfg.onInput === "function") cfg.onInput(state.x, state.y);
  }

  /* ─────────────────────────────
     Boucle d'envoi rate-limited
     ───────────────────────────── */

  function loop(now) {
    requestAnimationFrame(loop);
    if (!state.active) return;
    const interval = 1000 / cfg.sendRate;
    if (now - state.lastSend >= interval) {
      sendToUnity(state.x, state.y);
      state.lastSend = now;
    }
  }

  /* ─────────────────────────────
     Reset
     ───────────────────────────── */

  function reset() {
    state.active  = false;
    state.touchId = null;
    state.x       = 0;
    state.y       = 0;

    const knob  = document.getElementById("ecartJoystickKnob");
    const touch = document.getElementById("ecartJoystickTouch");
    if (knob)  knob.style.transform = "translate(-50%, -50%)";
    if (touch) touch.classList.remove("is-active");

    sendToUnity(0, 0);
    if (typeof cfg.onInput === "function") cfg.onInput(0, 0);
  }

  /* ─────────────────────────────
     TOUCH EVENTS — phase CAPTURE sur window
     Pourquoi Touch Events et pas Pointer Events :
     Unity WebGL appelle preventDefault() sur touchstart/touchmove
     du canvas, ce qui supprime les Pointer Events sur iOS Safari.
     Les Touch Events sont la couche native et ne peuvent pas être
     supprimés par le système Pointer Events.
     ───────────────────────────── */

  function onTouchStart(e) {
    // Cherche un touch dans la zone joystick parmi les nouveaux contacts
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (!isInJoystickBounds(t.clientX, t.clientY)) continue;

      // Ce touch est dans le joystick — on le prend en charge
      // stopImmediatePropagation : bloque TOUS les autres listeners
      // sur window (y compris Unity framework.js en capture)
      e.stopImmediatePropagation();
      e.preventDefault();

      // Reset si état bloqué (touchcancel manqué)
      if (state.active) reset();

      const el = document.getElementById("ecartJoystickTouch");
      if (!el) return;

      const rect = el.getBoundingClientRect();
      if (rect.width === 0) return;

      state.active  = true;
      state.touchId = t.identifier;
      state.centerX = rect.left + rect.width  / 2;
      state.centerY = rect.top  + rect.height / 2;
      state.radius  = rect.width * 0.42;

      el.classList.add("is-active");
      updateKnob(t.clientX, t.clientY);
      break;
    }
  }

  function onTouchMove(e) {
    if (!state.active) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier !== state.touchId) continue;

      e.stopImmediatePropagation();
      e.preventDefault();
      updateKnob(t.clientX, t.clientY);
      break;
    }
  }

  function onTouchEnd(e) {
    if (!state.active) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === state.touchId) {
        reset();
        break;
      }
    }
  }

  /* ─────────────────────────────
     Masquage panel
     ───────────────────────────── */

  function bindPanelEvents() {
    const wrap = document.getElementById("ecartJoystick");
    if (!wrap) return;

    document.addEventListener("ecart:panel-open", () => {
      wrap.classList.add("is-hidden");
      reset();
    });
    document.addEventListener("ecart:panel-close-others", () => {
      setTimeout(() => {
        const anyOpen = document.querySelector(
          "#infoPanel.is-open, #soundPanel.is-open, #mobileMapOverlay.is-open"
        );
        if (!anyOpen) wrap.classList.remove("is-hidden");
      }, 300);
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape")
        setTimeout(() => wrap.classList.remove("is-hidden"), 300);
    });
  }

  /* ─────────────────────────────
     Init
     ───────────────────────────── */

  function init(config = {}) {
    cfg = {
      gameObject : config.gameObject ?? "Main Camera",
      method     : config.method     ?? "ReceiveJoystick",
      sendRate   : config.sendRate   ?? 60,
      deadzone   : config.deadzone   ?? 0.08,
      onInput    : config.onInput    ?? null
    };

    // Uniquement sur appareils touch
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (!isTouch) {
      console.log("[ECARTJoystick] Non-touch — désactivé.");
      return;
    }

    const el = document.getElementById("ecartJoystickTouch");
    if (!el) {
      console.warn("[ECARTJoystick] #ecartJoystickTouch introuvable.");
      return;
    }

    // Touch Events en capture, passive:false pour pouvoir appeler
    // preventDefault() et stopImmediatePropagation()
    window.addEventListener("touchstart",  onTouchStart, { capture: true, passive: false });
    window.addEventListener("touchmove",   onTouchMove,  { capture: true, passive: false });
    window.addEventListener("touchend",    onTouchEnd,   { capture: true });
    window.addEventListener("touchcancel", onTouchEnd,   { capture: true });

    bindPanelEvents();
    requestAnimationFrame(loop);

    console.log("[ECARTJoystick] v1.3 initialisé →", cfg.gameObject, "/", cfg.method);
  }

  return { init, getInput: () => ({ x: state.x, y: state.y }), reset };

})();
