/**
 * Outil manuel : analyse UNE sourate et affiche le découpage par verset estimé.
 * Usage : node detect-ayah-pauses.js <numero_sourate> [chemin_mp3]
 * (par défaut : uploads/audios/serigne-aboul-baraka-mbacke/<NNN>.mp3)
 */

const path = require('path');
const { analyzeSurah } = require('./lib/silenceSegmenter');
const { verses: mushafVerses } = require('../../frontend/src/data/warshMushaf.json');

const warshText = {};
mushafVerses.forEach(([surah, , , , text]) => (warshText[surah] = warshText[surah] || []).push(text.replace(/۞/g, '').trim()));

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'audios', 'serigne-aboul-baraka-mbacke');

async function main() {
  const [, , surahArg, fileArg] = process.argv;
  const surahNumber = parseInt(surahArg, 10);
  if (!surahNumber || !warshText[surahNumber]) {
    console.error('Usage: node detect-ayah-pauses.js <numero_sourate> [chemin_mp3]');
    process.exit(1);
  }
  const filePath = fileArg || path.join(UPLOAD_DIR, `${String(surahNumber).padStart(3, '0')}.mp3`);
  const verses = warshText[surahNumber];
  const result = await analyzeSurah(filePath, verses, surahNumber);

  console.log(`\n=== Sourate ${surahNumber} — ${path.basename(filePath)} ===`);
  console.log(`Durée totale : ${result.totalDuration.toFixed(2)}s, ${verses.length} versets`);
  console.log(`Prélude détecté : ${result.prelude.length ? result.prelude.join(' + ') : 'aucun'}`);
  if (result.incomplete) console.warn('⚠️  Pas assez de pauses : découpage proportionnel au texte.');

  console.log('\nSegments estimés :');
  result.segments.forEach((s) => {
    const words = verses[s.ayah - 1].split(' ');
    const preview = words.length > 4 ? `${words.slice(0, 2).join(' ')} … ${words.slice(-2).join(' ')}` : words.join(' ');
    console.log(`  ${String(s.ayah).padStart(3)}  ${s.startSec.toFixed(2).padStart(8)}s → ${s.endSec.toFixed(2).padStart(8)}s  (${(s.endSec - s.startSec).toFixed(1)}s)  ${preview}`);
  });
  if (result.anomalies.length) {
    console.log('\n⚠️ Versets à vérifier (durée inhabituelle par rapport au texte) :');
    result.anomalies.forEach((a) => console.log(`  - verset ${a.ayah} (rapport ${a.ratio})`));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
