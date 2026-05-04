/* =========================
   EC@RT — JOYSTICK VIRTUEL
   Version 1.0

   USAGE :
   ─────────────────────────────
   Ajouter dans chaque zone Unity :
   <link rel="stylesheet" href="../ecart-joystick.css" />
   <script src="../ecart-joystick.js"></script>

   ET dans le HTML, avant </body> :
   <div class="ecart-joystick-wrap" id="ecartJoystick">
     <div class="ecart-joystick-touch" id="ecartJoystickTouch">
       <div class="ecart-joystick-base">
         <span class="ecart-joystick-label ecart-joystick-label--n">↑</span>
         <span class="ecart-joystick-label ecart-joystick-label--s">↓</span>
         <span class="ecart-joystick-label ecart-joystick-label--w">←</span>
         <span class="ecart-joystick-label ecart-joystick-label--e">→</span>
       </div>
       <div class="ecart-joystick-knob" id="ecartJoystickKnob"></div>
     </div>
   </div>

   CÔTÉ UNITY (C#) :
   ─────────────────────────────
   Créer un GameObject nommé "JoystickReceiver"
   avec ce script :

   using UnityEngine;
   public class JoystickReceiver : MonoBehaviour {
     public static Vector2 Input { get; private set; }

     public void ReceiveJoystick(string data) {
       // data = "x,y" normalisé entre -1 et 1
       var parts = data.Split(',');
       if (parts.Length == 2 &&
           float.TryParse(parts[0], System.Globalization.NumberStyles.Float,
             System.Globalization.CultureInfo.InvariantCulture, out float x) &&
           float.TryParse(parts[1], System.Globalization.NumberStyles.Float,
             System.Globalization.CultureInfo.InvariantCulture, out float y)) {
         Input = new Vector2(x, y);
       }
     }
   }

   Puis dans ton controller de mouvement :
   var joy = JoystickReceiver.Input;
   transform.Translate(joy.x * speed * Time.deltaTime, 0, joy.y * speed * Time.deltaTime);

   OPTIONS :
   ─────────────────────────────
   ECARTJoystick.init({
     gameObject : "JoystickReceiver",  // nom du GO Unity (défaut)
     method     : "ReceiveJoystick",   // méthode appelée (défaut)
     sendRate   : 60,                  // envois/sec max (défaut: 60)
     deadzone   : 0.08,                // zone morte centrale (défaut: 0.08)
     onInput    : (x, y) => {}        // callback JS optionnel
   });
   ========================= */

window.ECARTJoystick = (() => {

  /* ─────────────────────────────
     État interne
     ───────────────────────────── */
  const state = {
    active:   false,
    pointerId: null,
    centerX:  0,
    centerY:  0,
    radius:   0,
    x:        0,   // normalisé -1 → 1
    y:        0,   // normalisé -1 → 1
    lastSend: 0
  };

  let cfg = {};

  /* ─────────────────────────────
     Helpers
     ───────────────────────────── */

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function sendToUnity(x, y) {
    const instance = window.unityInstance;
    if (!instance) return;

    try {
      instance.SendMessage(
        cfg.gameObject,
        cfg.method,
        `${x.toFixed(4)},${y.toFixed(4)}`
      );
    } catch (e) {
      /* Unity pas encore prêt — silencieux */
    }
  }

  /* ─────────────────────────────
     Mise à jour knob + envoi
     ───────────────────────────── */

  function updateKnob(clientX, clientY) {
    const dx = clientX - state.centerX;
    const dy = clientY - state.centerY;

    const dist    = Math.hypot(dx, dy);
    const maxDist = state.radius;

    const ratio   = Math.min(dist / maxDist, 1);
    const angle   = Math.atan2(dy, dx);

    const clampedX = Math.cos(angle) * ratio * maxDist;
    const clampedY = Math.sin(angle) * ratio * maxDist;

    /* Position visuelle du knob */
    const knob = document.getElementById("ecartJoystickKnob");
    if (knob) {
      knob.style.transform = `translate(
        calc(-50% + ${clampedX}px),
        calc(-50% + ${clampedY}px)
      )`;
    }

    /* Valeurs normalisées avec deadzone */
    let nx = clampedX / maxDist;
    let ny = clampedY / maxDist;

    const deadzone = cfg.deadzone;
    if (Math.abs(nx) < deadzone) nx = 0;
    if (Math.abs(ny) < deadzone) ny = 0;

    state.x = nx;
    state.y = -ny; // Y inversé : haut = positif

    /* Callback JS */
    if (typeof cfg.onInput === "function") {
      cfg.onInput(state.x, state.y);
    }
  }

  /* ─────────────────────────────
     Boucle d'envoi (rate-limited)
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

    if (knob)  knob.style.transform  = "translate(-50%, -50%)";
    if (touch) touch.classList.remove("is-active");

    /* Envoie 0,0 à Unity pour stopper le mouvement */
    sendToUnity(0, 0);

    if (typeof cfg.onInput === "function") cfg.onInput(0, 0);
  }

  /* ─────────────────────────────
     Events
     ───────────────────────────── */

  function onPointerDown(e) {
    if (state.active) return;

    const touch = document.getElementById("ecartJoystickTouch");
    if (!touch) return;

    const rect = touch.getBoundingClientRect();

    state.active    = true;
    state.pointerId = e.pointerId;
    state.centerX   = rect.left + rect.width  / 2;
    state.centerY   = rect.top  + rect.height / 2;
    state.radius    = rect.width * 0.42; // zone de déplacement max

    touch.classList.add("is-active");
    touch.setPointerCapture(e.pointerId);

    updateKnob(e.clientX, e.clientY);
  }

  function onPointerMove(e) {
    if (!state.active || e.pointerId !== state.pointerId) return;
    updateKnob(e.clientX, e.clientY);
  }

  function onPointerUp(e) {
    if (e.pointerId !== state.pointerId) return;
    reset();
  }

  /* ─────────────────────────────
     Panel open → masque joystick
     ───────────────────────────── */

  function bindPanelEvents() {
    const wrap = document.getElementById("ecartJoystick");
    if (!wrap) return;

    document.addEventListener("ecart:panel-open", () => {
      wrap.classList.add("is-hidden");
      reset();
    });

    document.addEventListener("ecart:panel-close-others", () => {
      /* Petit délai pour laisser la transition du panel se faire */
      setTimeout(() => {
        const anyOpen = document.querySelector(
          "#infoPanel.is-open, #soundPanel.is-open, #mobileMapOverlay.is-open"
        );
        if (!anyOpen) wrap.classList.remove("is-hidden");
      }, 300);
    });

    /* Escape remet aussi visible */
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        setTimeout(() => wrap.classList.remove("is-hidden"), 300);
      }
    });
  }

  /* ─────────────────────────────
     Init
     ───────────────────────────── */

  function init(config = {}) {
    cfg = {
      gameObject : config.gameObject  ?? "JoystickReceiver",
      method     : config.method      ?? "ReceiveJoystick",
      sendRate   : config.sendRate    ?? 60,
      deadzone   : config.deadzone    ?? 0.08,
      onInput    : config.onInput     ?? null
    };

    /* Uniquement sur touch */
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (!isTouch) {
      console.log("[ECARTJoystick] Appareil non-touch — joystick désactivé.");
      return;
    }

    const touch = document.getElementById("ecartJoystickTouch");

    if (!touch) {
      console.warn("[ECARTJoystick] #ecartJoystickTouch introuvable.");
      return;
    }

    touch.addEventListener("pointerdown", onPointerDown);
    touch.addEventListener("pointermove", onPointerMove);
    touch.addEventListener("pointerup",   onPointerUp);
    touch.addEventListener("pointercancel", onPointerUp);

    bindPanelEvents();

    /* Démarre la boucle d'envoi */
    requestAnimationFrame(loop);

    console.log("[ECARTJoystick] Initialisé →", cfg.gameObject, "/", cfg.method);
  }

  /* ─────────────────────────────
     API publique
     ───────────────────────────── */
  return {
    init,
    getInput: () => ({ x: state.x, y: state.y }),
    reset
  };

})();
