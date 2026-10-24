/**
 * Récitations servies depuis Cloudflare R2 (espace « al-baraka-audio », lien AUDIO dans
 * wrangler.toml) : /audio/serigne-aboul-baraka-mbacke/NNN.mp3 → audios/serigne-aboul-baraka-mbacke/NNN.mp3.
 *
 * Les lectures par plages (en-tête Range) sont gérées : le lecteur peut démarrer au milieu
 * d'une longue sourate (verset choisi) sans télécharger le début du fichier.
 *
 * Rapidité : chaque fichier est gardé dans le cache Cloudflare le plus proche de l'auditeur
 * (Dakar, Paris…) dès sa première écoute, au lieu d'être relu à chaque fois depuis R2 ; le
 * navigateur le garde aussi (Cache-Control).
 */
const BROWSER_CACHE = 'public, max-age=2592000'; // 30 jours

export async function onRequest({ request, env, params, waitUntil }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  }

  const key = `audios/${[].concat(params.path).join('/')}`;
  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).origin + '/audio/' + key.slice('audios/'.length));

  // Déjà dans le cache proche : le cache sert lui-même les plages demandées (206).
  if (request.method === 'GET') {
    const cached = await cache.match(new Request(cacheKey.url, { headers: request.headers }));
    if (cached) return cached;
  }

  const object =
    request.method === 'HEAD'
      ? await env.AUDIO.head(key)
      : await env.AUDIO.get(key, { range: request.headers, onlyIf: request.headers });
  if (!object) return new Response('Fichier audio introuvable', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers); // Content-Type enregistré à l'envoi
  headers.set('Cache-Control', BROWSER_CACHE);
  headers.set('ETag', object.httpEtag);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Access-Control-Allow-Origin', '*'); // application Android
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'audio/mpeg');

  // HEAD, ou condition If-None-Match / If-Modified-Since remplie (pas de corps) :
  if (!('body' in object) || !object.body) {
    headers.set('Content-Length', String(object.size));
    return new Response(null, { status: request.method === 'HEAD' ? 200 : 304, headers });
  }

  // Première écoute ici : le fichier entier est copié dans le cache proche en arrière-plan,
  // pendant que l'auditeur reçoit déjà sa plage.
  const fill = async (body) => {
    const full = new Headers(headers);
    full.set('Content-Length', String(object.size));
    await cache.put(cacheKey, new Response(body, { status: 200, headers: full }));
  };

  if (request.headers.has('Range') && object.range) {
    const { offset, length, suffix } = object.range;
    const start = suffix !== undefined ? object.size - suffix : offset ?? 0;
    const size = suffix !== undefined ? suffix : length ?? object.size - start;
    headers.set('Content-Range', `bytes ${start}-${start + size - 1}/${object.size}`);
    headers.set('Content-Length', String(size));
    waitUntil(
      env.AUDIO.get(key)
        .then((whole) => whole && fill(whole.body))
        .catch(() => {})
    );
    return new Response(object.body, { status: 206, headers });
  }

  headers.set('Content-Length', String(object.size));
  const [toClient, toCache] = object.body.tee();
  waitUntil(fill(toCache).catch(() => {}));
  return new Response(toClient, { status: 200, headers });
}
