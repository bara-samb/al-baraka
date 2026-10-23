/**
 * Construit frontend/src/data/warshMushaf.json : le Mushaf Warsh du Complexe Roi Fahd
 * (KFGQPC, warshData_v10) — numérotation Warsh (6214 versets), pagination (604 pages),
 * Juz' et huitièmes de Hizb (الأثمان, marqués ۞ dans le texte).
 *
 * Les marques ۞ sont omises par le Mushaf quand un huitième commence en début de sourate :
 * ces huitièmes sont reconstitués en choisissant, dans chaque Juz' (16 huitièmes), les débuts
 * de sourate qui rendent les huitièmes les plus réguliers en longueur de texte.
 *
 * Usage : node build-warsh-mushaf.js [chemin_warshData_v10.json]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const SOURCE_URL = 'https://raw.githubusercontent.com/thetruetruth/quran-data-kfgqpc/main/warsh/data/warshData_v10.json';
const OUTPUT_PATH = path.join(__dirname, '..', '..', 'frontend', 'src', 'data', 'warshMushaf.json');

const EIGHTHS_PER_JUZ = 16;
// Un huitième hors début de sourate n'est retenu qu'en dernier recours (marque absente des données).
const NON_SURAH_START_PENALTY = 1e8;

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

const letterCount = (text) => text.replace(/[^ء-يٱ]/g, '').length;
const hasEighthMark = (text) => text.trim().startsWith('۞') || text.includes(' ۞');

/** Retire le numéro de verset final (chiffres arabes) ajouté par la source. */
const cleanText = (text) => text.replace(/[\s‏]*[٠-٩]+[\s‏]*$/, '').trim();

/** Indices (dans `verses`) des 16 débuts de huitième d'un Juz'. */
function eighthStartsOfJuz(verses, idxs) {
  const first = idxs[0];
  const pts = idxs.map((i) => {
    const fixed = i === first || hasEighthMark(verses[i].aya_text);
    return { i, fixed, penalty: verses[i].aya_no === 1 ? 0 : NON_SURAH_START_PENALTY };
  });
  const k = EIGHTHS_PER_JUZ - pts.filter((p) => p.fixed).length;

  const cum = {};
  let acc = 0;
  idxs.forEach((i) => {
    cum[i] = acc;
    acc += letterCount(verses[i].aya_text);
  });
  const total = acc;

  // dp[a][c] : coût minimal avec un huitième commençant en pts[a] et c huitièmes ajoutés.
  const n = pts.length;
  const dp = Array.from({ length: n }, () => new Array(k + 1).fill(Infinity));
  const back = Array.from({ length: n }, () => new Array(k + 1).fill(-1));
  dp[0][0] = 0;
  for (let a = 1; a < n; a++) {
    for (let c = 0; c <= k; c++) {
      const prevC = pts[a].fixed ? c : c - 1;
      if (prevC < 0) continue;
      for (let b = a - 1; b >= 0; b--) {
        if (dp[b][prevC] < Infinity) {
          const span = cum[pts[a].i] - cum[pts[b].i];
          const v = dp[b][prevC] + span * span + (pts[a].fixed ? 0 : pts[a].penalty);
          if (v < dp[a][c]) {
            dp[a][c] = v;
            back[a][c] = b;
          }
        }
        if (pts[b].fixed) break; // un huitième marqué ne peut pas être sauté
      }
    }
  }

  let best = Infinity;
  let last = -1;
  for (let a = n - 1; a >= 0; a--) {
    const span = total - cum[pts[a].i];
    if (dp[a][k] + span * span < best) {
      best = dp[a][k] + span * span;
      last = a;
    }
    if (pts[a].fixed) break;
  }

  const chosen = [];
  let a = last;
  let c = k;
  while (a >= 0) {
    chosen.push(pts[a].i);
    const prev = back[a][c];
    if (!pts[a].fixed) c--;
    a = prev;
  }
  return chosen.reverse();
}

async function main() {
  const sourcePath = process.argv[2];
  const verses = sourcePath ? JSON.parse(fs.readFileSync(sourcePath, 'utf8')) : await fetchJson(SOURCE_URL);
  console.log(`${verses.length} versets chargés.`);

  const eighths = [];
  for (let juz = 1; juz <= 30; juz++) {
    const idxs = verses.map((_, i) => i).filter((i) => verses[i].jozz === juz);
    const starts = eighthStartsOfJuz(verses, idxs);
    if (starts.length !== EIGHTHS_PER_JUZ) throw new Error(`Juz' ${juz} : ${starts.length} huitièmes`);
    const marked = starts.filter((i) => i === idxs[0] || hasEighthMark(verses[i].aya_text)).length;
    if (marked < EIGHTHS_PER_JUZ) {
      const added = starts.filter((i) => i !== idxs[0] && !hasEighthMark(verses[i].aya_text));
      console.log(`Juz' ${juz} : huitièmes reconstitués à ${added.map((i) => `${verses[i].sura_no}:${verses[i].aya_no}`).join(', ')}`);
    }
    eighths.push(...starts.map((i) => [verses[i].sura_no, verses[i].aya_no]));
  }

  const surahs = [];
  verses.forEach((v) => {
    if (!surahs[v.sura_no - 1]) surahs[v.sura_no - 1] = [v.sura_name_ar.trim(), v.sura_name_en.trim()];
  });

  const output = {
    source: 'KFGQPC warshData_v10 (Mushaf al-Madina, riwaya Warsh ʿan Nāfiʿ)',
    // [sourate, verset, page, juz, texte]
    verses: verses.map((v) => [v.sura_no, v.aya_no, parseInt(String(v.page), 10), v.jozz, cleanText(v.aya_text)]),
    // [sourate, verset] du début de chacun des 480 huitièmes de Hizb
    eighths,
    // [nom arabe, nom translittéré]
    surahs,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output), 'utf8');
  console.log(`Écrit : ${OUTPUT_PATH} (${(fs.statSync(OUTPUT_PATH).size / 1024).toFixed(0)} Ko)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
