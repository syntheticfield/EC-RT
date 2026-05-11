/* =========================
   EC@RT — LOADER UNITY UNIFIÉ
   Version 1.2

   USAGE dans chaque zone Unity :
   ─────────────────────────────
   window.addEventListener("load", () => {
     ECARTLoader.init({
       buildPath: "../../unity/zone02-V2/Build",
       buildName: "build-mamco_compress"
     });
   });

   OPTIONS COMPLÈTES :
   ─────────────────────────────
   ECARTLoader.init({
     buildPath  : "../../unity/zone02-V2/Build",  // REQUIS
     buildName  : "build-mamco_compress",          // défaut: "build-mamco_compress"
     canvasId   : "unity-canvas",                  // défaut: "unity-canvas"
     loaderId   : "ecartLoader",                   // défaut: "ecartLoader"
     barId      : "ecartLoaderBar",                // défaut: "ecartLoaderBar"
     statusId   : "ecartLoaderStatus",             // défaut: "ecartLoaderStatus"
     percentId  : "ecartLoaderPercent",            // défaut: "ecartLoaderPercent"
     warningId  : "ecartUnityWarning",             // défaut: "ecartUnityWarning"
     onReady    : (instance) => {}                 // callback optionnel
   });

   CHANGELOG v1.2 :
   ─────────────────────────────
   - Resize handler centralisé ici (supprimé de unity-mobile-fix.js)
   - Debounce augmenté à 250ms pour absorber les 2 resize successifs iOS
   - Listener orientationchange ajouté : verrouille les resize parasites
     pendant la rotation (iOS envoie des dimensions intermédiaires
     incorrectes avant de stabiliser)
   - webglcontextlost renforcé : timer de récupération automatique
     si le contexte n'est pas restauré dans 3s
   - visibilitychange ajouté : refocus canvas au retour en premier plan
   ========================= */

window.ECARTLoader = (() => {

  /* Messages affichés selon la progression */
  const STATUS_MESSAGES = [
    { at:  0, text: "Initialisation de l'environnement numérique." },
    { at: 20, text: "Chargement des ressources de la scène."       },
    { at: 60, text: "Assemblage de l'espace interactif."           },
    { at: 92, text: "Presque prêt."                                }
  ];

  /* ─────────────────────────────
     Sélection du message courant
     ───────────────────────────── */
  function resolveStatus(pct) {
    let msg = STATUS_MESSAGES[0].text;
    for (const m of STATUS_MESSAGES) {
      if (pct >= m.at) msg = m.text;
    }
    return msg;
  }

  /* ─────────────────────────────
     Point d'entrée public
     ───────────────────────────── */
  function init(config = {}) {
    const {
      buildPath,
      buildName  = "build-mamco_compress",
      canvasId   = "unity-canvas",
      loaderId   = "ecartLoader",
      barId      = "ecartLoaderBar",
      statusId   = "ecartLoaderStatus",
      percentId  = "ecartLoaderPercent",
      warningId  = "ecartUnityWarning",
      onReady    = null
    } = config;

    /* ── Validation ── */
    if (!buildPath) {
      console.error("[ECARTLoader] buildPath manquant.");
      return;
    }

    /* ── Éléments DOM ── */
    const canvas  = document.getElementById(canvasId);
    const loader  = document.getElementById(loaderId);
    const bar     = document.getElementById(barId);
    const status  = document.getElementById(statusId);
    const percent = document.getElementById(percentId);
    const warning = document.getElementById(warningId);

    if (!canvas) {
      console.error(`[ECARTLoader] Canvas introuvable : #${canvasId}`);
      return;
    }

    /* ── Config Unity ── */
    const unityConfig = {
      dataUrl:            `${buildPath}/${buildName}.data.unityweb`,
      frameworkUrl:       `${buildPath}/${buildName}.framework.js.unityweb`,
      codeUrl:            `${buildPath}/${buildName}.wasm.unityweb`,
      streamingAssetsUrl: "StreamingAssets",
      companyName:        "DefaultCompany",
      productName:        "MAMCO",
      productVersion:     "1.0"
    };

    const loaderUrl = `${buildPath}/${buildName}.loader.js`;

    /* ── État progression ── */
    let realProgress   = 0;   // progression réelle signalée par Unity (0→1)
    let visualProgress = 0;   // progression lissée affichée (0→1)
    let isReady        = false;
    let progressTimer  = null;

    /* ── Verrou orientation ──
       iOS envoie orientationchange PUIS 1 ou 2 resize avec des
       dimensions intermédiaires incorrectes avant de stabiliser.
       On bloque ensureCanvasSize pendant cette fenêtre. */
    let orientationChanging = false;
    let orientationTimer    = null;

    /* ─────────────────────────────
       Helpers DOM
       ───────────────────────────── */

    function setBar(v) {
      if (bar)     bar.style.width     = `${Math.round(v * 100)}%`;
      if (percent) percent.textContent = `${Math.round(v * 100)}%`;
      if (status)  status.textContent  = resolveStatus(Math.round(v * 100));
    }

    function showWarning(msg) {
      console.error(`[ECARTLoader] ${msg}`);
      if (!warning) return;
      warning.textContent = msg;
      warning.classList.add("is-visible");
    }

    function hideLoader() {
      if (!loader) return;
      loader.classList.add("is-hidden");
      /* Suppression du DOM après la transition (0.85s dans le CSS) */
      setTimeout(() => {
        if (loader.parentNode) loader.remove();
      }, 1000);
    }

    function ensureCanvasSize() {
      /* Ne rien faire si une rotation est en cours — les dimensions
         seraient transitoires et incorrectes */
      if (orientationChanging) return;

      canvas.style.width  = "100%";
      canvas.style.height = "100%";
    }

    /* ─────────────────────────────
       Boucle de progression lissée
       Unity bloque souvent à ~90% pendant la compilation WASM.
       On interpole visuellement vers 98% même si ça stagne,
       puis on saute à 100% quand Unity confirme.
       ───────────────────────────── */
    function startProgressLoop() {
      if (progressTimer) return;

      progressTimer = window.setInterval(() => {
        let target;

        if (isReady) {
          target = 1;
        } else {
          /* Unity peut bloquer à 0.9 → on cap à 0.92 pour la progression réelle,
             puis on dérive doucement jusqu'à 0.98 */
          const capped = Math.min(realProgress, 0.92);
          target = capped + (0.98 - capped) * 0.10;
        }

        visualProgress += (target - visualProgress) * 0.055;

        setBar(visualProgress);

        if (isReady && visualProgress > 0.998) {
          clearInterval(progressTimer);
          progressTimer = null;
        }
      }, 40);
    }

    function stopProgressLoop() {
      if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
      }
    }

    /* ── Callback Unity progression (0→1) ── */
    function onProgress(p) {
      realProgress = p;
    }

    /* ─────────────────────────────
       Gestionnaire resize/orientation — CENTRALISÉ ICI
       unity-mobile-fix.js ne gère plus le resize.

       Stratégie :
       1. orientationchange pose le verrou immédiatement
       2. Le verrou est levé 350ms après le dernier resize reçu
          (iOS envoie resize 1 puis resize 2 dans les ~200ms qui suivent)
       3. ensureCanvasSize s'exécute une seule fois après stabilisation
       ───────────────────────────── */
    let resizeTimer = null;

    window.addEventListener("orientationchange", () => {
      orientationChanging = true;
      clearTimeout(orientationTimer);
      clearTimeout(resizeTimer);
      console.log("[ECARTLoader] orientationchange — resize bloqué.");
    });

    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        /* Levée du verrou orientation si actif */
        if (orientationChanging) {
          orientationChanging = false;
          console.log("[ECARTLoader] Dimensions stables après rotation.");
        }
        ensureCanvasSize();
      }, 250); // 250ms absorbe les 2 resize successifs d'iOS
    });

    /* ── Refocus canvas au retour en premier plan ──
       Évite un état "zombie" où Unity ne reçoit plus les inputs
       après un aller-retour vers une autre app. */
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && isReady) {
        setTimeout(() => canvas.focus({ preventScroll: true }), 100);
      }
    });

    /* ─────────────────────────────
       Chargement du loader Unity
       ───────────────────────────── */
    function loadScript() {
      const script   = document.createElement("script");
      script.src     = loaderUrl;
      script.async   = true;

      script.onload  = onScriptLoaded;
      script.onerror = onScriptError;

      document.body.appendChild(script);
    }

    function onScriptLoaded() {
      if (typeof createUnityInstance !== "function") {
        showWarning("createUnityInstance introuvable après chargement du loader.");
        return;
      }

      /* ── Garde WebGL contre les pertes de contexte ──
         e.preventDefault() signale au navigateur que l'app gère la
         récupération elle-même. On ajoute un timer de sécurité : si le
         contexte n'est pas restauré en 3s (cas iOS agressif), on affiche
         une instruction pour que l'utilisateur recharge manuellement
         plutôt qu'une page blanche inexpliquée. */
      let contextLostTimer = null;

      canvas.addEventListener("webglcontextlost", (e) => {
        e.preventDefault();
        console.warn("[ECARTLoader] WebGL context lost — récupération en cours…");

        contextLostTimer = setTimeout(() => {
          console.error("[ECARTLoader] WebGL context non restauré après 3s.");
          showWarning(
            "La connexion à la scène 3D a été interrompue. " +
            "Veuillez recharger la page pour continuer."
          );
        }, 3000);
      }, false);

      canvas.addEventListener("webglcontextrestored", () => {
        clearTimeout(contextLostTimer);
        console.log("[ECARTLoader] WebGL context restored.");
        ensureCanvasSize();
      }, false);

      createUnityInstance(canvas, unityConfig, onProgress)
        .then(onUnityReady)
        .catch(onUnityError);
    }

    function onScriptError() {
      showWarning(`Loader Unity introuvable : ${loaderUrl}`);
      if (status) status.textContent = "Loader introuvable.";
      stopProgressLoop();
    }

    function onUnityReady(instance) {
      window.unityInstance = instance;

      isReady      = true;
      realProgress = 1;

      ensureCanvasSize();

      /* Laisse la barre atteindre 100% visuellement, puis cache */
      setTimeout(hideLoader, 500);

      /* Input mobile — appelé ici (après Unity ready) et nulle part ailleurs */
      if (typeof window.ECARTUnityMobileFix === "function") {
        window.ECARTUnityMobileFix(canvas);
      }

      if (typeof onReady === "function") {
        onReady(instance);
      }
    }

    function onUnityError(err) {
      console.error("[ECARTLoader]", err);
      showWarning("Impossible de charger la scène Unity.");
      if (status) status.textContent = "Le chargement a échoué.";
      stopProgressLoop();
    }

    /* ── Démarrage ── */
    ensureCanvasSize();
    startProgressLoop();
    loadScript();
  }

  /* ─────────────────────────────
     API publique
     ───────────────────────────── */
  return { init };

})();
