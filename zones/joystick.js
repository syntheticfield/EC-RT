/* =========================
   EC@RT — JOYSTICK VIRTUEL
   Version 1.2

   FIX PRINCIPAL v1.2 :
   Le canvas Unity WebGL intercepte tous les events touch/pointer
   avant qu'ils n'atteignent les éléments HTML au-dessus (même à
   z-index élevé). Correction : les listeners sont enregistrés sur
   `window` en phase de CAPTURE ({ capture: true }), ce qui s'exécute
   avant que le canvas ne reçoive quoi que ce soit. Quand le doigt est
   dans la zone joystick, on appelle stopPropagation() + preventDefault()
   pour bloquer Unity sur ce touch précis.

   USAGE :
   ─────────────────────────────
   ECARTJoystick.init({
     gameObject : "Main Camera",
     method     : "ReceiveJoystick",
     sendRate   : 60,
     deadzone   : 0.08,
     onInput    : (x, y) => {}
   });
   ========================= */

window.ECARTJoystick = (() => {

  const state = {
    active:    false,
    pointerId: null,
    centerX:   0,
    centerY:   0,
    radius:    0,
    x:         0,
    y:         0,
    lastSend:  0
  };

  let cfg = {};

  /* ─────────────────────────────
     Helpers
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

  // Retourne true si le point (clientX, clientY) est dans le joystick
  function isInJoystickBounds(clientX, clientY) {
    const el = document.getElementById("ecartJoystickTouch");
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return clientX >= r.left && clientX <= r.right &&
           clientY >= r.top  && clientY <= r.bottom;
  }

  /* ─────────────────────────────
     Mise à jour knob
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
    state.y = -ny;

    if (typeof cfg.onInput === "function") cfg.onInput(state.x, state.y);
  }

  /* ─────────────────────────────
     Boucle d'envoi
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
    state.active    = false;
    state.pointerId = null;
    state.x         = 0;
    state.y         = 0;

    const knob  = document.getElementById("ecartJoystickKnob");
    const touch = document.getElementById("ecartJoystickTouch");
    if (knob)  knob.style.transform = "translate(-50%, -50%)";
    if (touch) touch.classList.remove("is-active");

    sendToUnity(0, 0);
    if (typeof cfg.onInput === "function") cfg.onInput(0, 0);
  }

  /* ─────────────────────────────
     Handlers — phase CAPTURE sur window
     ───────────────────────────── */

  function onPointerDown(e) {
    // On ne réagit que si le doigt est dans le joystick
    if (!isInJoystickBounds(e.clientX, e.clientY)) return;

    // Bloquer ce touch côté Unity canvas
    e.stopPropagation();
    e.preventDefault();

    // Si état bloqué (pointercancel manqué), reset propre
    if (state.active) reset();

    const touch = document.getElementById("ecartJoystickTouch");
    if (!touch) return;

    const rect = touch.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    state.active    = true;
    state.pointerId = e.pointerId;
    state.centerX   = rect.left + rect.width  / 2;
    state.centerY   = rect.top  + rect.height / 2;
    state.radius    = rect.width * 0.42;

    touch.classList.add("is-active");

    // setPointerCapture optionnel — dans try/catch car peut échouer
    // si le canvas a déjà capturé le pointer
    try { touch.setPointerCapture(e.pointerId); }
    catch (_) {}

    updateKnob(e.clientX, e.clientY);
  }

  function onPointerMove(e) {
    if (!state.active || e.pointerId !== state.pointerId) return;
    // Bloquer ce touch pour Unity pendant le drag joystick
    e.stopPropagation();
    e.preventDefault();
    updateKnob(e.clientX, e.clientY);
  }

  function onPointerUp(e) {
    if (!state.active || e.pointerId !== state.pointerId) return;
    reset();
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
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape")
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

    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (!isTouch) {
      console.log("[ECARTJoystick] Non-touch — joystick désactivé.");
      return;
    }

    const touch = document.getElementById("ecartJoystickTouch");
    if (!touch) {
      console.warn("[ECARTJoystick] #ecartJoystickTouch introuvable.");
      return;
    }

    // ── FIX PRINCIPAL ─────────────────────────────────────────────
    // On écoute sur `window` en phase de CAPTURE.
    // Cela s'exécute AVANT que le canvas Unity ne reçoive l'event,
    // peu importe son z-index ou ses propres listeners.
    // { passive: false } est nécessaire pour pouvoir appeler
    // preventDefault() et bloquer le canvas sur les touches joystick.
    // ───────────────────────────────────────────────────────────────
    window.addEventListener("pointerdown",   onPointerDown, { capture: true, passive: false });
    window.addEventListener("pointermove",   onPointerMove, { capture: true, passive: false });
    window.addEventListener("pointerup",     onPointerUp,   { capture: true });
    window.addEventListener("pointercancel", onPointerUp,   { capture: true });

    bindPanelEvents();
    requestAnimationFrame(loop);

    console.log("[ECARTJoystick] Initialisé →", cfg.gameObject, "/", cfg.method);
  }

  return { init, getInput: () => ({ x: state.x, y: state.y }), reset };

})();
