/**
 * Service worker AL BARAKA (PWA) : rend l'app installable et utilisable hors ligne.
 *
 *  - Pages : réseau d'abord, repli sur la page en cache hors ligne.
 *  - Fichiers de l'app (bundles hachés, polices, icônes) : cache d'abord.
 *  - Traductions / liste des sourates (api.alquran.cloud) : cache immédiat, mis à jour en
 *    arrière-plan. Le texte arabe Warsh est déjà embarqué dans l'app.
 *  - Audio des récitations : jamais mis en cache ici (fichiers volumineux, lus par plages ;
 *    le téléchargement hors ligne passe par l'app elle-même).
 *
 * Incrémenter CACHE_VERSION pour purger les anciens caches.
 */
const CACHE_VERSION = 'v1';
const APP_CACHE = `albaraka-app-${CACHE_VERSION}`;
const API_CACHE = `albaraka-api-${CACHE_VERSION}`;

const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/favicon-48.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('albaraka-') && ![APP_CACHE, API_CACHE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isAudio = (url) => /\.(mp3|m4a|aac|ogg|wav)$/i.test(url.pathname) || url.pathname.startsWith('/audios/');

async function networkFirst(request) {
  const cache = await caches.open(APP_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put('/', response.clone());
    return response;
  } catch (e) {
    return (await cache.match('/')) || Response.error();
  }
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

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url);
  if (isAudio(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
  } else if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, APP_CACHE));
  } else if (url.hostname === 'api.alquran.cloud') {
    event.respondWith(staleWhileRevalidate(request));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, API_CACHE));
  }
});
