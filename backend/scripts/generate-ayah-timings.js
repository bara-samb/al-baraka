/**
 * Génère les timestamps par verset (pauses audio alignées sur le texte des versets) pour les
 * 114 sourates, versets du Mushaf Warsh (numérotation madani, warshMushaf.json), et écrit le
 * résultat dans frontend/src/data/ayahTimings.json.
 *
 * Prérequis : les 114 fichiers 001.mp3..114.mp3 doivent exister dans
 * backend/uploads/audios/serigne-aboul-baraka-mbacke/.
 *
 * Usage : node generate-ayah-timings.js
 */

const fs = require('fs');
const path = require('path');
const { analyzeSurah } = require('./lib/silenceSegmenter');

const DATA_DIR = path.join(__dirname, '..', '..', 'frontend', 'src', 'data');
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'audios', 'serigne-aboul-baraka-mbacke');
const OUTPUT_PATH = path.join(DATA_DIR, 'ayahTimings.json');

/** Texte des versets par sourate (marques de huitième ۞ retirées). */
function loadVerseTexts() {
  const texts = {};
  require(path.join(DATA_DIR, 'warshMushaf.json')).verses.forEach(([surah, , , , text]) => {
    (texts[surah] = texts[surah] || []).push(text.replace(/۞/g, '').trim());
  });
  return texts;
}

async function main() {
  const verseTexts = loadVerseTexts();
  const output = {};
  const problems = [];
  const startedAt = Date.now();

  for (let surahNumber = 1; surahNumber <= 114; surahNumber++) {
    const padded = String(surahNumber).padStart(3, '0');
    const filePath = path.join(UPLOAD_DIR, `${padded}.mp3`);
    const verses = verseTexts[surahNumber];

    if (!fs.existsSync(filePath)) {
      console.warn(`[${padded}] fichier manquant, ignoré.`);
      problems.push({ surah: surahNumber, reason: 'missing_file' });
      continue;
    }
    if (!verses) {
      console.warn(`[${padded}] texte des versets introuvable, ignoré.`);
      problems.push({ surah: surahNumber, reason: 'missing_text' });
      continue;
    }

    process.stdout.write(`[${padded}] analyse (${verses.length} versets)... `);
    try {
      const result = await analyzeSurah(filePath, verses, surahNumber);
      output[surahNumber] = {
        totalDuration: Number(result.totalDuration.toFixed(2)),
        startSeconds: result.segments.map((s) => s.startSec),
      };
      const prelude = result.prelude.length ? ` [prélude: ${result.prelude.join(' + ')}]` : '';
      if (result.incomplete) {
        console.log(`⚠️ incomplet (pauses insuffisantes)${prelude}`);
        problems.push({ surah: surahNumber, reason: 'incomplete_silences' });
      } else if (result.anomalies.length) {
        console.log(`ok${prelude}, ${result.anomalies.length} verset(s) à vérifier`);
        problems.push({ surah: surahNumber, reason: `à vérifier: versets ${result.anomalies.map((a) => a.ayah).join(', ')}` });
      } else {
        console.log(`ok${prelude}`);
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
