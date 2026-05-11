/* =========================
   EC@RT — SERVICE WORKER
   ecart-sw.js — à placer à la RACINE du site (même niveau que index.html)
   Version 1.0

   Stratégies par type de fichier :
   ─────────────────────────────────
   • .unityweb / .loader.js   → Cache-first (assets Unity immuables)
   • images / fonts / css     → Stale-while-revalidate
   • HTML                     → Network-first (toujours à jour)

   Le cache Unity survit aux rechargements de page.
   Sur un iPad, le rechargement d'une zone déjà visitée
   prend ~300ms au lieu de 30–90s.

   Mise à jour du cache : changer CACHE_VERSION
   ========================= */

const CACHE_VERSION    = 'v1';
const CACHE_UNITY      = `ecart-unity-${CACHE_VERSION}`;
const CACHE_STATIC     = `ecart-static-${CACHE_VERSION}`;

/* Extensions considérées comme assets Unity (immuables) */
const UNITY_EXTS = ['.unityweb', '.loader.js'];

/* Extensions pour le cache statique (stale-while-revalidate) */
const STATIC_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.svg', '.woff2', '.woff', '.css'];

/* ─────────────────────────────
   INSTALL — skip waiting immédiatement
   pour que le SW prenne le contrôle dès le premier chargement
   ───────────────────────────── */
self.addEventListener('install', () => {
  self.skipWaiting();
});

/* ─────────────────────────────
   ACTIVATE — nettoyage des vieux caches + prise de contrôle immédiate
   ───────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k.startsWith('ecart-') && k !== CACHE_UNITY && k !== CACHE_STATIC)
          .map(k => {
            console.log(`[ECARTsw] Suppression ancien cache : ${k}`);
            return caches.delete(k);
          })
      ))
      .then(() => self.clients.claim()) // contrôle immédiat de la page courante
  );
});

/* ─────────────────────────────
   FETCH — interception et stratégies de cache
   ───────────────────────────── */
self.addEventListener('fetch', event => {
  const req = event.request;

  /* Ignorer les requêtes non-GET, les requêtes cross-origin sans CORS,
     et les extensions Chrome */
  if (req.method !== 'GET') return;
  if (!req.url.startsWith('http')) return;

  const url      = new URL(req.url);
  const pathname = url.pathname.toLowerCase();

  /* ── Assets Unity → Cache-first ── */
  if (UNITY_EXTS.some(ext => pathname.endsWith(ext))) {
    event.respondWith(unityAssetStrategy(req));
    return;
  }

  /* ── Assets statiques → Stale-while-revalidate ── */
  if (STATIC_EXTS.some(ext => pathname.endsWith(ext))) {
    event.respondWith(staleWhileRevalidate(req, CACHE_STATIC));
    return;
  }

  /* Tout le reste (HTML, API) → réseau normal, pas de cache SW */
});

/* ─────────────────────────────
   Cache-first pour Unity
   Si en cache → réponse immédiate.
   Sinon → réseau → mis en cache.
   Gère les Range requests : si la réponse complète est en cache,
   le navigateur construit lui-même la réponse partielle.
   ───────────────────────────── */
async function unityAssetStrategy(request) {
  /* Les Range requests d'Unity sont servies par le navigateur
     à partir de la réponse complète mise en cache. */
  const cacheKey = stripRangeHeaders(request);

  try {
    const cache  = await caches.open(CACHE_UNITY);
    const cached = await cache.match(cacheKey, { ignoreSearch: true });

    if (cached) {
      return handleRangeResponse(request, cached);
    }

    const response = await fetch(request.url); // requête sans Range pour mettre en cache la réponse complète
    if (response.ok) {
      try {
        await cache.put(cacheKey, response.clone());
      } catch (quotaErr) {
        /* Storage quota dépassé — on log et on continue sans cache */
        console.warn('[ECARTsw] Quota dépassé, cache ignoré pour', request.url);
      }
    }
    return response;

  } catch (err) {
    /* Réseau indisponible et pas de cache → erreur attendue */
    return new Response('Asset Unity non disponible hors ligne.', { status: 503 });
  }
}

/* ─────────────────────────────
   Stale-while-revalidate
   ───────────────────────────── */
async function staleWhileRevalidate(request, cacheName) {
  const cache      = await caches.open(cacheName);
  const cached     = await cache.match(request);
  const fetchPromise = fetch(request)
    .then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached || fetchPromise;
}

/* ─────────────────────────────
   Helpers Range Request
   Chrome/Safari envoient des Range requests pour les gros fichiers.
   Si on a la réponse complète en cache, on reconstruit la réponse partielle.
   ───────────────────────────── */
function stripRangeHeaders(request) {
  const headers = new Headers(request.headers);
  headers.delete('range');
  return new Request(request.url, {
    method:  request.method,
    headers,
    mode:    'cors',
    credentials: request.credentials,
  });
}

async function handleRangeResponse(request, cachedResponse) {
  const rangeHeader = request.headers.get('range');
  if (!rangeHeader) return cachedResponse;

  /* Extraire les bornes de la Range request */
  const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
  if (!match) return cachedResponse;

  const buffer = await cachedResponse.clone().arrayBuffer();
  const total  = buffer.byteLength;
  const start  = match[1] ? parseInt(match[1]) : 0;
  const end    = match[2] ? parseInt(match[2]) : total - 1;

  const sliced = buffer.slice(start, end + 1);
  const headers = new Headers(cachedResponse.headers);
  headers.set('Content-Range',  `bytes ${start}-${end}/${total}`);
  headers.set('Content-Length', String(end - start + 1));

  return new Response(sliced, {
    status: 206,
    statusText: 'Partial Content',
    headers,
  });
}

/* ─────────────────────────────
   MESSAGE — PRECACHE
   Déclenché par ECARTPreloader pour précharger un asset depuis
   le thread principal. Le SW fait le fetch et le cache côté worker,
   sans jamais charger le fichier en mémoire principale.

   Format :
   navigator.serviceWorker.controller.postMessage(
     { type: 'PRECACHE', url: '...' },
     [messageChannel.port2]
   );
   ───────────────────────────── */
self.addEventListener('message', async event => {
  if (event.data?.type !== 'PRECACHE') return;

  const { url }  = event.data;
  const port     = event.ports[0];
  const cacheName = url.toLowerCase().match(/\.(unityweb|loader\.js)$/)
    ? CACHE_UNITY
    : CACHE_STATIC;

  try {
    const cache  = await caches.open(cacheName);
    const cached = await cache.match(url, { ignoreSearch: true });

    if (cached) {
      port?.postMessage({ ok: true, cached: true });
      return;
    }

    /* Fetch complet (pas de Range) pour stocker la réponse entière */
    const response = await fetch(url, { credentials: 'same-origin' });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} pour ${url}`);
    }

    try {
      await cache.put(url, response);
      port?.postMessage({ ok: true, cached: false });
    } catch (quotaErr) {
      port?.postMessage({ ok: true, cached: false, warning: 'quota' });
    }

  } catch (err) {
    port?.postMessage({ ok: false, error: err.message });
  }
});
