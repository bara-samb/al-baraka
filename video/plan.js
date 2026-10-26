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
const OUT_FILE = path.join(__dirname, 'out', 'calendrier-tiktok.csv');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const tomorrow = new Date(Date.now() + 86400000);
const start = arg('start', tomorrow.toISOString().slice(0, 10));
const hours = arg('hours', '12,19').split(',').map(Number);
const cell = (v) => `"${String(v).replace(/"/g, '""')}"`;

const clips = fs.existsSync(SHORTS_DIR) ? fs.readdirSync(SHORTS_DIR).filter((f) => f.endsWith('.mp4')).sort() : [];
if (!clips.length) {
  console.log('Aucun clip : lancez d\'abord « node render.js shorts <sourates> ».');
  process.exit(1);
}

const rows = [['Date', 'Heure', 'Fichier', 'Légende'].map(cell).join(';')];
clips.forEach((file, n) => {
  const d = new Date(`${start}T00:00:00`);
  d.setDate(d.getDate() + Math.floor(n / hours.length));
  const caption = fs.readFileSync(path.join(SHORTS_DIR, file.replace(/\.mp4$/, '.txt')), 'utf8');
  rows.push([d.toLocaleDateString('fr-FR'), `${hours[n % hours.length]}:00`, file, caption].map(cell).join(';'));
});

// BOM et point-virgule : Excel en français ouvre le fichier directement, accents compris.
fs.writeFileSync(OUT_FILE, '﻿' + rows.join('\r\n'));
console.log(`${clips.length} clips planifiés sur ${Math.ceil(clips.length / hours.length)} jours → ${OUT_FILE}`);
