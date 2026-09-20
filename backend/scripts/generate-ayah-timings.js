/**
 * Génère les timestamps par verset (approximation via détection de silence) pour les
 * 114 sourates, et écrit le résultat dans frontend/src/data/ayahTimings.json.
 *
 * Prérequis : les 114 fichiers 001.mp3..114.mp3 doivent exister dans
 * backend/uploads/audios/serigne-aboul-baraka-mbacke/.
 *
 * Usage : node generate-ayah-timings.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { analyzeSurah } = require('./lib/silenceSegmenter');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'audios', 'serigne-aboul-baraka-mbacke');
const OUTPUT_PATH = path.join(__dirname, '..', '..', 'frontend', 'src', 'data', 'ayahTimings.json');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function getAyahCounts() {
  const json = await fetchJson('https://api.alquran.cloud/v1/surah');
  const map = {};
  json.data.forEach((s) => {
    map[s.number] = s.numberOfAyahs;
  });
  return map;
}

async function main() {
  console.log('Récupération du nombre de versets par sourate (API alquran.cloud)...');
  const ayahCounts = await getAyahCounts();

  const output = {};
  const problems = [];
  const startedAt = Date.now();

  for (let surahNumber = 1; surahNumber <= 114; surahNumber++) {
    const padded = String(surahNumber).padStart(3, '0');
    const filePath = path.join(UPLOAD_DIR, `${padded}.mp3`);
    const expectedAyahCount = ayahCounts[surahNumber];

    if (!fs.existsSync(filePath)) {
      console.warn(`[${padded}] fichier manquant, ignoré.`);
      problems.push({ surah: surahNumber, reason: 'missing_file' });
      continue;
    }
    if (!expectedAyahCount) {
      console.warn(`[${padded}] nombre de versets inconnu, ignoré.`);
      problems.push({ surah: surahNumber, reason: 'missing_ayah_count' });
      continue;
    }

    process.stdout.write(`[${padded}] analyse (${expectedAyahCount} versets)... `);
    try {
      const result = analyzeSurah(filePath, expectedAyahCount);
      output[surahNumber] = {
        totalDuration: Number(result.totalDuration.toFixed(2)),
        startSeconds: result.segments.map((s) => s.startSec),
      };
      if (result.incomplete) {
        console.log(`⚠️ incomplet (silences insuffisants)`);
        problems.push({ surah: surahNumber, reason: 'incomplete_silences' });
      } else {
        console.log('ok');
      }
    } catch (e) {
      console.log(`❌ erreur: ${e.message}`);
      problems.push({ surah: surahNumber, reason: 'exception', message: e.message });
    }
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\nTerminé en ${elapsedSec}s. ${Object.keys(output).length}/114 sourates traitées.`);
  console.log(`Fichier écrit : ${OUTPUT_PATH}`);

  if (problems.length > 0) {
    console.log(`\n⚠️ ${problems.length} sourate(s) avec un problème :`);
    problems.forEach((p) => console.log(`  - Sourate ${p.surah}: ${p.reason}${p.message ? ' (' + p.message + ')' : ''}`));
  }
}

main().catch((e) => {
  console.error('Erreur fatale:', e);
  process.exit(1);
});
