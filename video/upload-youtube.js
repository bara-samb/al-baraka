/**
 * Envoie sur YouTube les vidéos générées par render.js, programmées à l'avance (publishAt).
 *
 *   node upload-youtube.js setup       autorise l'accès à la chaîne et crée les playlists (une seule fois)
 *   node upload-youtube.js long|shorts [--start AAAA-MM-JJ] [--hours 18] [--limit 6]
 *
 * --start   premier jour de publication (demain par défaut)
 * --hours   heures de publication dans la journée, ex. "12,19" pour deux vidéos par jour
 * --now     publie tout de suite, sans programmation
 * --limit   nombre d'envois pour cette fois : un envoi coûte 1 600 unités sur les 10 000 du quota
 *           quotidien gratuit de l'API, donc 6 par jour au maximum
 *
 * Chaque vidéo est rangée dans sa playlist : « Coran complet » (et « Juz' Amma » à partir de la
 * sourate 78) pour les vidéos longues, « Un verset par jour » pour les clips.
 *
 * Les vidéos déjà envoyées sont notées dans out/youtube-uploaded.json : on peut relancer la
 * commande chaque jour, elle reprend où elle s'était arrêtée et continue le calendrier.
 *
 * Une seule fois : placer le fichier d'identifiants OAuth (application de bureau) dans
 * secrets/client_secret.json. Au premier lancement, une page Google s'ouvre pour autoriser
 * l'accès à la chaîne ; le jeton est gardé dans secrets/token.json.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');
const { google } = require('googleapis');

const SECRETS_DIR = path.join(__dirname, 'secrets');
const CLIENT_FILE = path.join(SECRETS_DIR, 'client_secret.json');
const TOKEN_FILE = path.join(SECRETS_DIR, 'token.json');
const OUT_DIR = path.join(__dirname, 'out');
const STATE_FILE = path.join(OUT_DIR, 'youtube-uploaded.json');
const SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube'];
const SOURCES = { long: path.join(OUT_DIR, 'youtube'), shorts: path.join(OUT_DIR, 'shorts') };
const PLAYLISTS_FILE = path.join(OUT_DIR, 'youtube-playlists.json');
const PLAYLISTS = {
  complete: { title: 'Coran complet en Warsh · Serigne Aboul Baraka Mbacké', description: 'Les 114 sourates, récitées en riwaya Warsh, avec le texte du Mushaf et la traduction française.' },
  amma: { title: "Juz' Amma (sourates 78 à 114) · Warsh", description: "Les sourates du Juz' Amma, les plus apprises et les plus récitées." },
  shorts: { title: 'Un verset par jour', description: 'Quelques versets récités chaque jour par Serigne Aboul Baraka Mbacké.' },
};

function arg(args, name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
}

function openInBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd);
}

/** Autorisation OAuth « application de bureau » : Google renvoie le code sur un port local. */
async function authorize() {
  if (!fs.existsSync(CLIENT_FILE)) {
    throw new Error(`identifiants introuvables : placez le fichier OAuth dans ${CLIENT_FILE} (voir video/README.md).`);
  }
  const { client_id, client_secret } = JSON.parse(fs.readFileSync(CLIENT_FILE, 'utf8')).installed;
  if (fs.existsSync(TOKEN_FILE)) {
    const auth = new google.auth.OAuth2(client_id, client_secret);
    auth.setCredentials(JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')));
    return auth;
  }

  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const redirect = `http://127.0.0.1:${server.address().port}`;
  const auth = new google.auth.OAuth2(client_id, client_secret, redirect);
  const url = auth.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPES });
  console.log(`Autorisez l'accès à la chaîne dans la page qui s'ouvre (sinon ouvrez ce lien) :\n${url}\n`);
  openInBrowser(url);

  const code = await new Promise((resolve, reject) => {
    server.on('request', (req, res) => {
      const params = new URL(req.url, redirect).searchParams;
      res.end(params.get('code') ? 'AL BARAKA : autorisation reçue, vous pouvez fermer cette page.' : 'Autorisation refusée.');
      server.close();
      params.get('code') ? resolve(params.get('code')) : reject(new Error(params.get('error') || 'autorisation refusée'));
    });
  });
  const { tokens } = await auth.getToken(code);
  auth.setCredentials(tokens);
  fs.mkdirSync(SECRETS_DIR, { recursive: true });
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
  return auth;
}

/** Date de publication du n-ième créneau : un jour par tour des heures choisies. */
function slotDate(start, hours, n) {
  const d = new Date(`${start}T00:00:00`);
  d.setDate(d.getDate() + Math.floor(n / hours.length));
  d.setHours(hours[n % hours.length], 0, 0, 0);
  return d;
}

/** Playlists de la chaîne, créées au premier besoin et notées dans out/youtube-playlists.json. */
async function ensurePlaylists(youtube) {
  const ids = fs.existsSync(PLAYLISTS_FILE) ? JSON.parse(fs.readFileSync(PLAYLISTS_FILE, 'utf8')) : {};
  for (const [key, { title, description }] of Object.entries(PLAYLISTS)) {
    if (ids[key]) continue;
    const res = await youtube.playlists.insert({
      part: ['snippet', 'status'],
      requestBody: { snippet: { title, description, defaultLanguage: 'fr' }, status: { privacyStatus: 'public' } },
    });
    ids[key] = res.data.id;
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(PLAYLISTS_FILE, JSON.stringify(ids, null, 2));
    console.log(`Playlist créée : ${title}`);
  }
  return ids;
}

function playlistsFor(kind, file, ids) {
  if (kind === 'shorts') return [ids.shorts];
  return Number(file.slice(0, 3)) >= 78 ? [ids.complete, ids.amma] : [ids.complete];
}

async function main() {
  const [kind, ...args] = process.argv.slice(2);
  if (kind === 'setup') {
    const youtube = google.youtube({ version: 'v3', auth: await authorize() });
    const channel = await youtube.channels.list({ part: ['snippet'], mine: true });
    console.log(`Chaîne autorisée : ${channel.data.items?.[0]?.snippet?.title}`);
    await ensurePlaylists(youtube);
    return;
  }
  if (!SOURCES[kind]) {
    console.log('Usage : node upload-youtube.js setup | long|shorts [--start AAAA-MM-JJ] [--hours 18] [--limit 6]');
    process.exit(1);
  }
  const tomorrow = new Date(Date.now() + 86400000);
  const start = arg(args, 'start', `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`);
  const hours = arg(args, 'hours', '18').split(',').map(Number);
  const limit = Number(arg(args, 'limit', 6));
  const now = args.includes('--now');

  const state = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {};
  const done = Object.values(state).filter((s) => s.kind === kind);
  const todo = (fs.existsSync(SOURCES[kind]) ? fs.readdirSync(SOURCES[kind]) : [])
    // Une vidéo n'est prête que si son .json existe (écrit en dernier par render.js).
    .filter((f) => f.endsWith('.mp4') && !f.endsWith('.partiel.mp4') && !state[f] && fs.existsSync(path.join(SOURCES[kind], f.replace(/\.mp4$/, '.json'))))
    .sort();
  if (!todo.length) return console.log('Rien à envoyer : toutes les vidéos de ce dossier sont déjà sur YouTube.');

  const youtube = google.youtube({ version: 'v3', auth: await authorize() });
  const playlists = await ensurePlaylists(youtube);
  // Premier créneau libre : après la dernière vidéo déjà programmée, et au moins dans une heure.
  const after = Math.max(Date.now() + 3600000, ...done.map((s) => Date.parse(s.publishAt)));
  let slot = 0;
  while (slotDate(start, hours, slot).getTime() <= after) slot++;
  for (const file of todo.slice(0, limit)) {
    const meta = JSON.parse(fs.readFileSync(path.join(SOURCES[kind], file.replace(/\.mp4$/, '.json')), 'utf8'));
    const publishAt = now ? new Date() : slotDate(start, hours, slot);

    process.stdout.write(`${file} → ${publishAt.toLocaleString('fr-FR')} … `);
    try {
      const res = await youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: { title: meta.title, description: meta.description, tags: meta.tags, categoryId: meta.categoryId, defaultLanguage: 'fr', defaultAudioLanguage: 'ar' },
          status: now
            ? { privacyStatus: 'public', selfDeclaredMadeForKids: false }
            : { privacyStatus: 'private', publishAt: publishAt.toISOString(), selfDeclaredMadeForKids: false },
        },
        media: { body: fs.createReadStream(path.join(SOURCES[kind], file)) },
      });
      for (const playlistId of playlistsFor(kind, file, playlists)) {
        await youtube.playlistItems.insert({ part: ['snippet'], requestBody: { snippet: { playlistId, resourceId: { kind: 'youtube#video', videoId: res.data.id } } } });
      }
      state[file] = { kind, videoId: res.data.id, publishAt: publishAt.toISOString() };
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
      console.log(`✓ https://youtu.be/${res.data.id}`);
      slot++;
    } catch (err) {
      const reason = err.errors?.[0]?.reason || err.message;
      console.log(`✗ ${reason}`);
      if (/quota/i.test(reason)) return console.log('Quota du jour atteint : relancez la commande demain.');
      throw err;
    }
  }
  console.log(`\n${todo.length - Math.min(limit, todo.length)} vidéo(s) restante(s) pour un prochain envoi.`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
