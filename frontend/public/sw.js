/**
 * Service worker AL BARAKA (PWA) : rend l'app installable, rapide et utilisable hors ligne.
 *
 *  - Pages : la version en cache s'affiche tout de suite (sans attendre le réseau, même avec
 *    une connexion faible) ; la nouvelle version est récupérée en arrière-plan et sert au
 *    lancement suivant.
 *  - Fichiers de l'app (bundles hachés, polices, icônes) : cache d'abord. Le bundle de la page
 *    est mis en cache dès l'installation, pour que l'app s'ouvre hors ligne dès la 2e visite.
 *  - Traductions / liste des sourates (api.alquran.cloud) : cache immédiat, mis à jour en
 *    arrière-plan. Le texte arabe Warsh est déjà embarqué dans l'app.
 *  - Audio : les sourates téléchargées par l'app (cache AUDIO_CACHE, rempli par
 *    src/services/downloadService.ts) sont servies depuis l'appareil, plages d'octets
 *    comprises (avance rapide, iPhone). Les autres passent par le réseau, sans mise en cache.
 *
 * Incrémenter CACHE_VERSION pour purger les anciens caches (jamais celui de l'audio).
 */
const CACHE_VERSION = 'v5';
const APP_CACHE = `albaraka-app-${CACHE_VERSION}`;
const API_CACHE = `albaraka-api-${CACHE_VERSION}`;
const AUDIO_CACHE = 'albaraka-audio';

const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/favicon-48.png',
  '/icons/app-badge-256.png',
  '/icons/apple-touch-icon.png',
];

/** Scripts et feuilles de style référencés par la page (bundles Expo). */
const pageAssets = (html) =>
  [...html.matchAll(/(?:src|href)="(\/_expo\/[^"]+)"/g)].map((m) => m[1]);

// Polices d'icônes réellement utilisées par l'app (le bundle les référence toutes).
const ICON_FONTS = /\/Fonts\/(Ionicons|MaterialCommunityIcons)\./;

/** Polices et images référencées par un bundle, à garder pour le hors-ligne. */
const bundleAssets = (code) =>
  [...new Set([...code.matchAll(/"(\/assets\/[^"]+\.(?:ttf|otf|png|jpe?g))"/g)].map((m) => m[1]))].filter(
    (path) => !path.includes('/vector-icons/') || ICON_FONTS.test(path)
  );

/**
 * Met la page en cache avec ses bundles, polices et images (l'app s'ouvre alors complète hors
 * ligne), et oublie les bundles des versions précédentes.
 */
async function cachePage(cache, response) {
  const html = await response.clone().text();
  const assets = pageAssets(html);
  await cache.addAll(assets);
  const extra = [];
  for (const path of assets.filter((p) => p.endsWith('.js'))) {
    extra.push(...bundleAssets(await (await cache.match(path)).text()));
  }
  const missing = [];
  for (const path of extra) if (!(await cache.match(path))) missing.push(path);
  await cache.addAll(missing);
  await cache.put('/', response);
  const keep = new Set(assets);
  for (const request of await cache.keys()) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/_expo/') && !keep.has(path)) await cache.delete(request);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_CACHE);
      await cache.addAll(APP_SHELL.filter((p) => p !== '/'));
      const page = await fetch('/', { cache: 'no-store' });
      if (page.ok) await cachePage(cache, page);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('albaraka-') && ![APP_CACHE, API_CACHE, AUDIO_CACHE].includes(k))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

const isAudio = (url) => /\.(mp3|m4a|aac|ogg|wav)$/i.test(url.pathname) || url.pathname.startsWith('/audios/');

/** Page : cache d'abord (ouverture instantanée), mise à jour en arrière-plan. */
async function navigate(event) {
  const cache = await caches.open(APP_CACHE);
  const cached = await cache.match('/');
  const update = fetch(event.request)
    .then(async (response) => {
      if (response.ok) await cachePage(cache, response.clone());
      return response;
    })
    .catch(() => cached || Response.error());
  if (cached) {
    event.waitUntil(update.catch(() => {}));
    return cached;
  }
  return update;
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(API_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached || Response.error());
  return cached || network;
}

/** Audio téléchargé : servi depuis l'appareil, avec les plages d'octets demandées. */
async function downloadedAudio(request) {
  const cache = await caches.open(AUDIO_CACHE);
  const cached = await cache.match(request.url);
  if (!cached) return fetch(request);
  const range = request.headers.get('range');
  if (!range) return cached;
  const blob = await cached.blob();
  const match = /bytes=(\d*)-(\d*)/.exec(range);
  let start = match && match[1] ? Number(match[1]) : 0;
  let end = match && match[2] ? Number(match[2]) : blob.size - 1;
  if (match && !match[1] && match[2]) {
    start = Math.max(0, blob.size - Number(match[2]));
    end = blob.size - 1;
  }
  end = Math.min(end, blob.size - 1);
  if (start > end) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${blob.size}` } });
  }
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': cached.headers.get('content-type') || 'audio/mpeg',
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${blob.size}`,
      'Accept-Ranges': 'bytes',
    },
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (isAudio(url)) {
    event.respondWith(downloadedAudio(request));
    return;
  }
  if (request.headers.has('range')) return;

  if (request.mode === 'navigate') {
    // Pages à part (confidentialité) : servies normalement par le réseau.
    if (url.pathname.startsWith('/confidentialite')) return;
    event.respondWith(navigate(event));
  } else if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, APP_CACHE));
  } else if (url.hostname === 'api.alquran.cloud') {
    event.respondWith(staleWhileRevalidate(request));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, API_CACHE));
  }
});
