/**
 * Calendrier de publication des clips verticaux, pour TikTok (ou YouTube Studio à la main) :
 * une ligne par clip avec la date, l'heure, le fichier et la légende prête à coller.
 *
 *   node plan.js [--start AAAA-MM-JJ] [--hours 12,19]
 *
 * Écrit out/calendrier-tiktok.csv (s'ouvre dans Excel).
 */

const fs = require('fs');
const path = require('path');

const SHORTS_DIR = path.join(__dirname, 'out', 'shorts');
const INSTALLER_DIR = path.join(__dirname, 'out', 'installer');
const OUT_FILE = path.join(__dirname, 'out', 'calendrier-tiktok.csv');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const tomorrow = new Date(Date.now() + 86400000);
const start = arg('start', tomorrow.toISOString().slice(0, 10));
const hours = arg('hours', '12,19').split(',').map(Number);
const cell = (v) => `"${String(v).replace(/"/g, '""')}"`;

/** Légende TikTok (.txt), ou à défaut la description du .json (vidéos de présentation). */
function captionOf(mp4) {
  const txt = mp4.replace(/\.mp4$/, '.txt');
  if (fs.existsSync(txt)) return fs.readFileSync(txt, 'utf8');
  const json = mp4.replace(/\.mp4$/, '.json');
  return fs.existsSync(json) ? JSON.parse(fs.readFileSync(json, 'utf8')).description.replace(/ #Shorts$/, '') : '';
}

const clips = fs.existsSync(SHORTS_DIR) ? fs.readdirSync(SHORTS_DIR).filter((f) => f.endsWith('.mp4')).sort() : [];
if (!clips.length) {
  console.log('Aucun clip : lancez d\'abord « node render.js shorts <sourates> ».');
  process.exit(1);
}

const entries = clips.map((file, n) => {
  const d = new Date(`${start}T00:00:00`);
  d.setDate(d.getDate() + Math.floor(n / hours.length));
  d.setHours(hours[n % hours.length]);
  return { date: d, file, caption: captionOf(path.join(SHORTS_DIR, file)) };
});
// Les clips d'installation (installer.js) gardent leur propre date, en plus des clips du jour.
const installers = fs.existsSync(INSTALLER_DIR) ? fs.readdirSync(INSTALLER_DIR).filter((f) => f.endsWith('.json')) : [];
for (const json of installers) {
  const date = new Date(JSON.parse(fs.readFileSync(path.join(INSTALLER_DIR, json), 'utf8')).publishAt);
  if (date < new Date(`${start}T00:00:00`)) continue;
  entries.push({ date, file: `installer/${json.replace(/\.json$/, '.mp4')}`, caption: captionOf(path.join(INSTALLER_DIR, json.replace(/\.json$/, '.mp4'))) });
}
entries.sort((a, b) => a.date - b.date);

const rows = [['Date', 'Heure', 'Fichier', 'Légende'].map(cell).join(';')];
for (const { date, file, caption } of entries) {
  rows.push([date.toLocaleDateString('fr-FR'), `${date.getHours()}:00`, file, caption].map(cell).join(';'));
}

// BOM et point-virgule : Excel en français ouvre le fichier directement, accents compris.
fs.writeFileSync(OUT_FILE, '﻿' + rows.join('\r\n'));
console.log(`${entries.length} clips planifiés (dont ${entries.length - clips.length} d'installation) → ${OUT_FILE}`);
