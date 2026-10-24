/**
 * Récitations servies depuis Cloudflare R2 (espace « al-baraka-audio », lien AUDIO dans
 * wrangler.toml) : /audio/serigne-aboul-baraka-mbacke/NNN.mp3 → audios/serigne-aboul-baraka-mbacke/NNN.mp3.
 *
 * Les lectures par plages (en-tête Range) sont gérées : le lecteur peut démarrer au milieu
 * d'une longue sourate (verset choisi) sans télécharger le début du fichier.
 */
export async function onRequest({ request, env, params }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  }

  const key = `audios/${[].concat(params.path).join('/')}`;
  const object =
    request.method === 'HEAD'
      ? await env.AUDIO.head(key)
      : await env.AUDIO.get(key, { range: request.headers, onlyIf: request.headers });
  if (!object) return new Response('Fichier audio introuvable', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers); // Content-Type, Cache-Control enregistrés à l'envoi
  headers.set('ETag', object.httpEtag);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Access-Control-Allow-Origin', '*'); // application Android

  // HEAD, ou condition If-None-Match / If-Modified-Since remplie (pas de corps) :
  if (!('body' in object) || !object.body) {
    headers.set('Content-Length', String(object.size));
    return new Response(null, { status: request.method === 'HEAD' ? 200 : 304, headers });
  }

  if (request.headers.has('Range') && object.range) {
    const { offset, length, suffix } = object.range;
    const start = suffix !== undefined ? object.size - suffix : offset ?? 0;
    const size = suffix !== undefined ? suffix : length ?? object.size - start;
    headers.set('Content-Range', `bytes ${start}-${start + size - 1}/${object.size}`);
    headers.set('Content-Length', String(size));
    return new Response(object.body, { status: 206, headers });
  }

  headers.set('Content-Length', String(object.size));
  return new Response(object.body, { status: 200, headers });
}
