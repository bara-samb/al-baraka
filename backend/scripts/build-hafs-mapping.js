/**
 * Construit frontend/src/data/warshHafsMap.json : correspondance entre les versets du Mushaf
 * Warsh (numérotation madani) et la numérotation Hafs, utilisée par l'API pour les traductions.
 *
 * Les deux découpages portent sur le même texte : on aligne les positions cumulées (en lettres)
 * des versets de chaque découpage. Pour chaque verset Warsh : [premier, dernier] verset Hafs
 * qui le recouvrent (un nombre seul si un seul verset).
 *
 * Source Hafs : data/warshTextHafsSplit.json (texte Warsh découpé aux versets Hafs).
 * Usage : node build-hafs-mapping.js
 */

const fs = require('fs');
const path = require('path');

const hafsSplit = require('./data/warshTextHafsSplit.json');
const { verses } = require('../../frontend/src/data/warshMushaf.json');
const OUTPUT_PATH = path.join(__dirname, '..', '..', 'frontend', 'src', 'data', 'warshHafsMap.json');

const letters = (t) => t.replace(/[^ء-غف-يٱ]/g, '').length;

/** Intervalles [début, fin) en lettres cumulées. */
function intervals(lengths) {
  let acc = 0;
  return lengths.map((len) => {
    const start = acc;
    acc += len;
    return [start, acc];
  });
}

const overlap = ([a, b], [c, d]) => Math.max(0, Math.min(b, d) - Math.max(a, c));

const output = {};
for (let surah = 1; surah <= 114; surah++) {
  const warsh = intervals(verses.filter((v) => v[0] === surah).map((v) => letters(v[4])));
  // Al-Fatiha : la basmala (verset 1 Hafs) n'est pas un verset Warsh, elle ne recouvre rien.
  const hafsLengths = hafsSplit[surah].map(letters);
  if (surah === 1) hafsLengths[0] = 0;
  const hafs = intervals(hafsLengths);

  output[surah] = warsh.map((w) => {
    // Versets Hafs dont une part significative (≥ 30 %) tombe dans ce verset Warsh.
    const matched = [];
    hafs.forEach((h, i) => {
      const len = h[1] - h[0];
      if (len > 0 && overlap(w, h) >= 0.3 * len) matched.push(i + 1);
    });
    if (matched.length === 0) {
      let best = 0;
      hafs.forEach((h, i) => {
        if (overlap(w, h) > overlap(w, hafs[best])) best = i;
      });
      matched.push(best + 1);
    }
    const first = matched[0];
    const last = matched[matched.length - 1];
    return first === last ? first : [first, last];
  });
}

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output), 'utf8');
const diffs = Object.values(output).flat().filter((x, i, arr) => Array.isArray(x)).length;
console.log(`Écrit : ${OUTPUT_PATH} (${diffs} versets Warsh recouvrant plusieurs versets Hafs)`);
