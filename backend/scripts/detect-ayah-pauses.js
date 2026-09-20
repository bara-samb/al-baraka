/**
 * Outil manuel : analyse UN fichier MP3 et affiche le découpage par verset estimé.
 * Usage : node detect-ayah-pauses.js <chemin_mp3> <nombre_de_versets>
 */

const path = require('path');
const { analyzeSurah } = require('./lib/silenceSegmenter');

function main() {
  const [, , filePath, ayahCountArg] = process.argv;
  if (!filePath || !ayahCountArg) {
    console.error('Usage: node detect-ayah-pauses.js <mp3> <nombre_de_versets>');
    process.exit(1);
  }

  const expectedAyahCount = parseInt(ayahCountArg, 10);
  const result = analyzeSurah(filePath, expectedAyahCount);

  console.log(`\n=== ${path.basename(filePath)} ===`);
  console.log(`Durée totale : ${result.totalDuration.toFixed(2)}s`);
  console.log(`Versets attendus : ${expectedAyahCount}`);
  console.log(`Seuil utilisé : ${result.config.silenceDb}dB, min ${result.config.silenceMinDur}s`);

  if (result.incomplete) {
    console.warn(`⚠️  Pas assez de silences détectés même au seuil le plus permissif. Segmentation incomplète.`);
  } else if (result.usedFallback) {
    console.warn(`⚠️ Seuil le plus permissif utilisé en dernier recours.`);
  }

  console.log('\nSegments estimés :');
  result.segments.forEach((s) => {
    console.log(`  Verset ${s.ayah}: ${s.startSec}s -> ${s.endSec}s (durée ${(s.endSec - s.startSec).toFixed(2)}s)`);
  });

  console.log('\nJSON:');
  console.log(JSON.stringify({ file: path.basename(filePath), ...result }, null, 2));
}

main();
