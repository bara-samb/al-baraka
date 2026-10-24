/**
 * Envoie les récitations (backend/uploads/audios/serigne-aboul-baraka-mbacke/NNN.mp3) dans
 * l'espace Cloudflare R2 « al-baraka-audio », sous audios/serigne-aboul-baraka-mbacke/NNN.mp3.
 * Le site les sert ensuite à l'adresse /audio/… (functions/audio/[[path]].js).
 *
 * Usage (depuis frontend/, connecté avec `npx wrangler login`) : npm run audio:upload:r2
 * Relançable sans risque : les fichiers déjà envoyés (notés dans
 * backend/uploads/.r2-uploaded.txt avec leur taille) sont ignorés. En cas de coupure
 * réseau passagère, chaque fichier est retenté jusqu'à 5 fois.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const BUCKET = 'al-baraka-audio';
const UPLOADS = path.join(__dirname, '..', '..', 'backend', 'uploads');
const SOURCE_DIR = path.join(UPLOADS, 'audios', 'serigne-aboul-baraka-mbacke');
const KEY_PREFIX = 'audios/serigne-aboul-baraka-mbacke/';
const DONE_FILE = path.join(UPLOADS, '.r2-uploaded.txt');
const WRANGLER = path.join(__dirname, '..', 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const ATTEMPTS = 5;
const RETRY_DELAY_MS = 15000;

const upload = (file) =>
  spawnSync(
    process.execPath,
    [
      WRANGLER,
      'r2',
      'object',
      'put',
      `${BUCKET}/${KEY_PREFIX}${file}`,
      '--file',
      path.join(SOURCE_DIR, file),
      '--content-type',
      'audio/mpeg',
      '--cache-control',
      'public, max-age=604800',
      '--remote',
    ],
    { encoding: 'utf8' }
  );

const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const done = new Set(fs.existsSync(DONE_FILE) ? fs.readFileSync(DONE_FILE, 'utf8').split('\n').filter(Boolean) : []);
const files = fs.readdirSync(SOURCE_DIR).filter((f) => /^\d{3}\.mp3$/.test(f)).sort();

let sent = 0;
for (const [i, file] of files.entries()) {
  const size = fs.statSync(path.join(SOURCE_DIR, file)).size;
  const entry = `${KEY_PREFIX}${file} ${size}`;
  if (done.has(entry)) continue;

  console.log(`[${i + 1}/${files.length}] ${file} (${(size / 2 ** 20).toFixed(1)} Mo)…`);
  let result = upload(file);
  for (let attempt = 2; result.status !== 0 && attempt <= ATTEMPTS; attempt++) {
    console.warn(`  échec, nouvel essai (${attempt}/${ATTEMPTS}) dans ${RETRY_DELAY_MS / 1000} s…`);
    pause(RETRY_DELAY_MS);
    result = upload(file);
  }
  if (result.status !== 0) {
    console.error(`Échec pour ${file} :\n${result.stderr || result.stdout}`);
    process.exit(1);
  }
  fs.appendFileSync(DONE_FILE, `${entry}\n`);
  sent++;
}
console.log(`Terminé : ${sent} fichier(s) envoyé(s), ${files.length - sent} déjà en ligne.`);
