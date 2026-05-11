/* =========================
   EC@RT — MOTEUR DE PRÉCHARGEMENT
   ecart-preloader.js
   Version 1.0

   RÔLE :
   ──────
   Précharge silencieusement les assets Unity des zones AVANT
   que l'utilisateur navigue vers elles. Quand ECARTLoader démarre
   sur la page cible, il lit depuis le cache SW → la barre de
   chargement passe en < 1 seconde.

   NE REMPLACE PAS ECARTLoader — il reste le responsable de
   l'initialisation Unity. ECARTPreloader se contente de remplir
   le cache en avance.

   USAGE MINIMAL (à placer dans chaque page HTML) :
   ────────────────────────────────────────────────
   <script src="/js/ecart-preloader.js"></script>
   <script>
     ECARTPreloader.init({
       zones: [
         { id: 'zone02', buildPath: '/unity/zone02/Build' },
         { id: 'zone03', buildPath: '/unity/zone03/Build', url: '/zone03/' },
         { id: 'zone08', buildPath: '/unity/zone08/Build', url: '/zone08/' },
       ],
       currentZone : 'zone02',       // zone active (skip le préchargement)
       autoPreload : ['zone03'],      // précharger après 4s d'idle
       minimap: {
         selector : '.minimap-zone', // éléments cliquables de la minimap
         zoneAttr : 'data-zone',     // attribut portant l'id de zone
         urlAttr  : 'data-url',      // attribut portant l'URL de destination
       },
     });
   </script>

   OPTIONS COMPLÈTES :
   ────────────────────────────────────────────────
   ECARTPreloader.init({
     zones          : [],            // REQUIS — liste des zones
     currentZone    : null,          // id de la zone courante
     autoPreload    : [],            // zones à précharger automatiquement
     autoPreloadDelay: 4000,         // délai avant auto-preload (ms)
     buildName      : 'build-mamco_compress', // défaut partagé
     minimap        : null,          // config minimap (voir ci-dessus)
     swPath         : '/ecart-sw.js',
     maxConcurrent  : 2,             // max de préchargements simultanés
     onZoneReady    : (zoneId) => {} // callback quand une zone est prête
   });

   API PUBLIQUE :
   ────────────────────────────────────────────────
   ECARTPreloader.prefetch(zoneId)       // force le préchargement d'une zone
   ECARTPreloader.isReady(zoneId)        // true si la zone est dans le cache
   ECARTPreloader.getStatus(zoneId)      // 'idle'|'queued'|'loading'|'ready'|'error'
   ECARTPreloader.navigate(url, zoneId)  // transition + navigation
   ========================= */

window.ECARTPreloader = (() => {

  /* ─────────────────────────────
     ÉTAT INTERNE
     ───────────────────────────── */

  const DEFAULT_BUILD_NAME = 'build-mamco_compress';

  /* Registre des zones : id → { config, status, progress } */
  const zones = new Map();

  /* File de priorité : [{ zoneId, priority }] — trié avant chaque traitement */
  const queue = [];
  let activeFetches = 0;
  let maxConcurrent = 2;

  /* Callbacks globaux */
  let globalOnZoneReady = null;

  /* SW registration */
  let swController = null;

  /* Minimap config */
  let minimapCfg = null;

  /* ─────────────────────────────
     DÉTECTION DE CONNEXION
     Skip le préchargement sur connexion lente ou Data Saver.
     ───────────────────────────── */
  function isConnectionSuitable() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!conn) return true;
    if (conn.saveData) {
      console.log('[ECARTPreloader] Data Saver actif — préchargement suspendu.');
      return false;
    }
    if (['slow-2g', '2g'].includes(conn.effectiveType)) {
      console.log('[ECARTPreloader] Connexion trop lente — préchargement suspendu.');
      return false;
    }
    return true;
  }

  /* ─────────────────────────────
     CONSTRUCTION DES URLS D'ASSETS
     Ordre de préchargement : loader (petit) → framework (moyen)
     → wasm (lourd) → data (très lourd)
     ───────────────────────────── */
  function getAssetSteps(zoneConfig) {
    const { buildPath, buildName = DEFAULT_BUILD_NAME } = zoneConfig;
    return [
      { key: 'loader',    url: `${buildPath}/${buildName}.loader.js`,              weight: 1  },
      { key: 'framework', url: `${buildPath}/${buildName}.framework.js.unityweb`,  weight: 10 },
      { key: 'wasm',      url: `${buildPath}/${buildName}.wasm.unityweb`,           weight: 35 },
      { key: 'data',      url: `${buildPath}/${buildName}.data.unityweb`,           weight: 54 },
    ];
  }

  /* ─────────────────────────────
     ÉVÉNEMENTS CUSTOM
     Permet aux autres scripts (navigator, minimap) de réagir.
     ───────────────────────────── */
  function emit(name, detail = {}) {
    document.dispatchEvent(
      new CustomEvent(`ecart:${name}`, { detail, bubbles: true })
    );
  }

  /* ─────────────────────────────
     PRÉCHARGEMENT VIA SERVICE WORKER
     Le SW fait le fetch et le cache dans son thread.
     La mémoire principale n'est jamais chargée.
     ───────────────────────────── */
  function precacheViaSW(url) {
    return new Promise((resolve, reject) => {
      const controller = navigator.serviceWorker?.controller;
      if (!controller) {
        /* SW pas encore actif — fallback vers fetch direct */
        return precacheDirect(url).then(resolve).catch(reject);
      }

      const channel = new MessageChannel();
      const timeout = setTimeout(() => {
        reject(new Error('SW timeout'));
      }, 30000);

      channel.port1.onmessage = event => {
        clearTimeout(timeout);
        if (event.data.ok) {
          resolve({ url, fromCache: event.data.cached });
        } else {
          reject(new Error(event.data.error));
        }
      };

      controller.postMessage({ type: 'PRECACHE', url }, [channel.port2]);
    });
  }

  /* Fallback : fetch direct quand le SW n'est pas encore actif */
  async function precacheDirect(url) {
    /* On ne consomme pas le body pour éviter de charger des centaines
       de Mo en mémoire principale. Le fetch seul suffit à réchauffer
       le cache HTTP du navigateur pour les assets avec bons en-têtes. */
    const response = await fetch(url, { method: 'GET', cache: 'default' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    /* Consommer le body en arrière-plan via ReadableStream pour que
       le navigateur marque l'asset comme téléchargé */
    if (response.body) {
      const reader = response.body.getReader();
      const drain = () => reader.read().then(({ done }) => { if (!done) drain(); }).catch(() => {});
      drain();
    }
    return { url, fromCache: false };
  }

  /* ─────────────────────────────
     CHARGEMENT D'UNE ZONE (assets dans l'ordre)
     ───────────────────────────── */
  async function loadZoneAssets(zoneId) {
    const zone = zones.get(zoneId);
    if (!zone) return;
    if (zone.status === 'ready' || zone.status === 'loading') return;

    zone.status   = 'loading';
    zone.progress = 0;
    updateDot(zoneId, 'loading');
    emit('preload:start', { zoneId });
    console.log(`[ECARTPreloader] Début préchargement : ${zoneId}`);

    const steps     = getAssetSteps(zone.config);
    const totalW    = steps.reduce((s, st) => s + st.weight, 0);
    let   loadedW   = 0;

    try {
      for (const step of steps) {

        /* Pause si connexion dégradée en cours de route */
        if (!isConnectionSuitable()) {
          zone.status = 'paused';
          updateDot(zoneId, null);
          emit('preload:paused', { zoneId, step: step.key });
          console.log(`[ECARTPreloader] Pause ${zoneId} — connexion.`);
          activeFetches--;
          processQueue();
          return;
        }

        await precacheViaSW(step.url);
        loadedW       += step.weight;
        zone.progress  = loadedW / totalW;
        emit('preload:progress', { zoneId, progress: zone.progress, step: step.key });
      }

      zone.status   = 'ready';
      zone.progress = 1;
      updateDot(zoneId, 'ready');
      emit('preload:ready', { zoneId });

      if (typeof globalOnZoneReady === 'function') globalOnZoneReady(zoneId);
      console.log(`[ECARTPreloader] ✓ Zone prête : ${zoneId}`);

    } catch (err) {
      zone.status = 'error';
      updateDot(zoneId, 'error');
      emit('preload:error', { zoneId, error: err.message });
      console.warn(`[ECARTPreloader] Erreur ${zoneId} :`, err.message);
    }

    activeFetches--;
    processQueue();
  }

  /* ─────────────────────────────
     FILE DE PRIORITÉ
     ───────────────────────────── */
  function processQueue() {
    while (activeFetches < maxConcurrent && queue.length > 0) {
      queue.sort((a, b) => b.priority - a.priority);
      const next = queue.shift();
      const zone = zones.get(next.zoneId);

      if (!zone || zone.status === 'ready' || zone.status === 'loading') continue;

      activeFetches++;
      loadZoneAssets(next.zoneId);
    }
  }

  function enqueue(zoneId, priority = 5) {
    if (!isConnectionSuitable()) return;
    const zone = zones.get(zoneId);
    if (!zone) return;
    if (zone.status === 'ready' || zone.status === 'loading') return;

    /* Mise à jour de priorité si déjà en file */
    const existing = queue.find(q => q.zoneId === zoneId);
    if (existing) {
      existing.priority = Math.max(existing.priority, priority);
      return;
    }

    zone.status = 'queued';
    queue.push({ zoneId, priority });
    processQueue();
  }

  /* ─────────────────────────────
     SERVICE WORKER — enregistrement
     ───────────────────────────── */
  async function registerSW(swPath) {
    if (!('serviceWorker' in navigator)) {
      console.info('[ECARTPreloader] Service Worker non supporté.');
      return;
    }
    try {
      const reg = await navigator.serviceWorker.register(swPath, { scope: '/' });
      swController = reg;
      console.log('[ECARTPreloader] Service Worker enregistré.');

      /* Écouter les mises à jour du SW */
      reg.addEventListener('updatefound', () => {
        console.log('[ECARTPreloader] Nouvelle version du Service Worker détectée.');
      });
    } catch (err) {
      console.warn('[ECARTPreloader] SW indisponible :', err.message);
    }
  }

  /* ─────────────────────────────
     INDICATEURS VISUELS MINIMAP
     Petit dot dans le coin de chaque élément.
     États : loading (pulsant) | ready (blanc plein) | error (caché)
     ───────────────────────────── */
  function addDot(el, zoneId) {
    if (el.querySelector('.ecart-preload-dot')) return;
    const dot = document.createElement('span');
    dot.className = 'ecart-preload-dot';
    dot.setAttribute('aria-hidden', 'true');
    dot.dataset.zone = zoneId;
    /* S'assure que le parent peut accueillir le dot en absolu */
    const pos = getComputedStyle(el).position;
    if (pos === 'static') el.style.position = 'relative';
    el.appendChild(dot);
  }

  function updateDot(zoneId, state) {
    document.querySelectorAll(`.ecart-preload-dot[data-zone="${zoneId}"]`).forEach(dot => {
      dot.classList.remove('is-loading', 'is-ready', 'is-error');
      if (state) dot.classList.add(`is-${state}`);
    });
  }

  /* ─────────────────────────────
     INTÉGRATION MINIMAP
     ───────────────────────────── */
  function hookMinimap(cfg) {
    minimapCfg = cfg;
    const elements = document.querySelectorAll(cfg.selector);

    if (elements.length === 0) {
      console.warn(`[ECARTPreloader] Aucun élément minimap trouvé : "${cfg.selector}"`);
    }

    elements.forEach(el => {
      const zoneId = el.getAttribute(cfg.zoneAttr);
      const url    = el.getAttribute(cfg.urlAttr || 'data-url') || el.getAttribute('href');

      if (!zoneId) return;

      /* Ajouter le dot indicateur uniquement si la zone est connue */
      if (zones.has(zoneId)) {
        addDot(el, zoneId);
        /* Si déjà prête (cache chaud), marquer immédiatement */
        if (zones.get(zoneId).status === 'ready') updateDot(zoneId, 'ready');
      }

      /* ── Survol → démarrage discret (priorité faible) ── */
      el.addEventListener('mouseenter', () => {
        if (zones.has(zoneId)) enqueue(zoneId, 5);
      });
      el.addEventListener('touchstart', () => {
        if (zones.has(zoneId)) enqueue(zoneId, 5);
      }, { passive: true });

      /* ── Simple clic → priorité élevée (le dbl-clic arrive dans ~300ms) ── */
      el.addEventListener('click', () => {
        if (zones.has(zoneId)) enqueue(zoneId, 80);
      });

      /* ── Double clic → navigation avec transition ── */
      el.addEventListener('dblclick', event => {
        if (!url) return;
        event.preventDefault();
        event.stopPropagation();
        navigateTo(url, zoneId);
      });

      /* ── Support tactile double tap ── */
      let lastTap = 0;
      el.addEventListener('touchend', event => {
        const now = Date.now();
        if (now - lastTap < 350 && url) {
          event.preventDefault();
          navigateTo(url, zoneId);
        }
        lastTap = now;
      }, { passive: false });
    });
  }

  /* ─────────────────────────────
     NAVIGATION AVEC TRANSITION
     Fade-to-black avant navigation.
     Si les assets sont déjà en cache → navigation immédiate.
     ───────────────────────────── */
  let transitionOverlay = null;

  function getOverlay() {
    if (transitionOverlay) return transitionOverlay;
    transitionOverlay = document.createElement('div');
    transitionOverlay.className = 'ecart-nav-transition';
    transitionOverlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(transitionOverlay);
    return transitionOverlay;
  }

  function navigateTo(url, zoneId = null) {
    if (!url) return;

    const zone     = zoneId ? zones.get(zoneId) : null;
    const isWarm   = zone?.status === 'ready';
    const overlay  = getOverlay();

    /* Déclencher la transition visuelle */
    overlay.classList.add('is-active');

    /* Si le cache est chaud : courte transition (300ms).
       Sinon : délai légèrement plus long pour laisser le préchargement
       avancer quelques fractions de seconde de plus. */
    const delay = isWarm ? 300 : 450;

    setTimeout(() => {
      window.location.href = url;
    }, delay);
  }

  /* ─────────────────────────────
     POINT D'ENTRÉE PUBLIC
     ───────────────────────────── */
  function init(config = {}) {
    const {
      zones: zoneList    = [],
      currentZone        = null,
      autoPreload        = [],
      autoPreloadDelay   = 4000,
      buildName          = DEFAULT_BUILD_NAME,
      minimap            = null,
      swPath             = '/ecart-sw.js',
      maxConcurrent: mc  = 2,
      onZoneReady        = null,
    } = config;

    maxConcurrent    = mc;
    globalOnZoneReady = onZoneReady;

    /* ── Enregistrement des zones ── */
    zoneList.forEach(zoneConfig => {
      zones.set(zoneConfig.id, {
        config: { buildName, ...zoneConfig }, // buildName global surchargeable par zone
        status:   'idle',
        progress: 0,
      });
    });

    /* ── Zone courante déjà chargée → marquée ready ── */
    if (currentZone && zones.has(currentZone)) {
      const z   = zones.get(currentZone);
      z.status   = 'ready';
      z.progress = 1;
    }

    /* ── Service Worker ── */
    window.addEventListener('load', () => registerSW(swPath));

    /* ── Minimap ── */
    if (minimap) {
      const doHook = () => hookMinimap(minimap);
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', doHook);
      } else {
        doHook();
      }
    }

    /* ── Préchargement automatique différé ──
       On attend que la page courante soit pleinement interactive
       ET qu'un délai configurable soit écoulé pour ne pas concurrencer
       le chargement Unity de la zone courante. */
    if (autoPreload.length > 0) {
      const startAutoPreload = () => {
        autoPreload.forEach((zoneId, i) => {
          /* Décalage de 600ms entre chaque zone pour lisser la bande passante */
          setTimeout(() => enqueue(zoneId, 3 - i), i * 600);
        });
      };

      if (document.readyState === 'complete') {
        setTimeout(startAutoPreload, autoPreloadDelay);
      } else {
        window.addEventListener('load', () => {
          setTimeout(startAutoPreload, autoPreloadDelay);
        });
      }
    }

    console.log(`[ECARTPreloader] Initialisé — ${zoneList.length} zone(s) connue(s).`);
  }

  /* ─────────────────────────────
     API PUBLIQUE
     ───────────────────────────── */
  return {
    init,

    /* Force le préchargement d'une zone (priorité haute) */
    prefetch:  (zoneId)       => enqueue(zoneId, 90),

    /* Navigation manuelle avec transition */
    navigate:  (url, zoneId)  => navigateTo(url, zoneId),

    /* Interrogation d'état */
    isReady:   (zoneId)       => zones.get(zoneId)?.status === 'ready',
    getStatus: (zoneId)       => zones.get(zoneId)?.status ?? 'unknown',
    getProgress:(zoneId)      => zones.get(zoneId)?.progress ?? 0,
  };

})();
