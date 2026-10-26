/**
 * Découpage des versets guidé par le TEXTE et par l'énergie audio.
 *
 * Principe :
 *  1. On décode l'audio (ffmpeg → PCM mono) et on calcule l'énergie par trame de 10 ms.
 *     Toutes les zones de faible énergie sont des pauses candidates, chacune avec une
 *     "force" : une fin de verset est un arrêt plus COMPLET (plus long et plus silencieux)
 *     qu'une petite respiration à l'intérieur du verset.
 *  2. On "lit" les versets : chaque verset reçoit un poids proportionnel à sa durée de
 *     récitation attendue (nombre de lettres, voyelles longues, madd lazim ٓ).
 *  3. Une programmation dynamique choisit GLOBALEMENT les N-1 pauses qui donnent à chaque
 *     verset une durée cohérente avec son texte tout en privilégiant les arrêts complets.
 *     Une petite pause juste avant la fin d'un verset ne peut donc plus "voler" la place de
 *     la vraie fin : le choix est fait pour toute la sourate à la fois, pas verset par verset.
 *  4. Le prélude (isti'adha, basmala) présent en début de fichier est détecté
 *     automatiquement et rattaché au verset 1.
 *  5. Second passage avec un tempo local (lissé sur les versets voisins) pour suivre les
 *     variations de rythme du récitateur dans les longues sourates.
 */

const { spawn, spawnSync } = require('child_process');

const FFMPEG_BIN = process.env.FFMPEG_BIN || 'ffmpeg';
const FFPROBE_BIN = process.env.FFPROBE_BIN || 'ffprobe';

const SAMPLE_RATE = 8000;
const FRAME_SEC = 0.01;
const FRAME_LEN = SAMPLE_RATE * FRAME_SEC;

const MIN_PAUSE_SEC = 0.12;
// Deux zones silencieuses séparées par un bref éclat (clic, souffle) forment une seule pause.
const MAX_BLIP_SEC = 0.06;
const EDGE_GUARD_SEC = 0.5;

// Écart-type (en log) toléré entre la durée réelle d'un verset et sa durée attendue.
const DURATION_SIGMA = 0.45;
const DURATION_WEIGHT = 1 / (2 * DURATION_SIGMA * DURATION_SIGMA);
// Bornes dures du rapport durée réelle / durée attendue (élague la programmation dynamique).
const RATIO_BOUNDS = [0.2, 5];
const RELAXED_RATIO_BOUNDS = [0.05, 20];

const ISTIADHA_TEXT = 'أعوذ بالله من الشيطان الرجيم';
const BASMALA_TEXT = 'بسم الله الرحمن الرحيم';

const LETTER_RE = /[ء-غف-يٱ-ۓ]/g;
const MADDAH_RE = /ٓ/g; // madd lazim / muqatta'at (6 temps)
const DAGGER_ALIF_RE = /ٰ/g; // alif suscrit = voyelle longue

// Sourates dont le verset 1 s'ouvre par des lettres isolées (الم، حم عسق، كهيعص…).
const MUQATTAAT_SURAHS = new Set([
  2, 3, 7, 10, 11, 12, 13, 14, 15, 19, 20, 26, 27, 28, 29, 30, 31, 32, 36, 38, 40, 41, 42, 43, 44, 45, 46, 50, 68,
]);
// Chaque lettre isolée se récite par son NOM avec un madd long (« alif, lām, mīm ») :
// bien plus long qu'une lettre ordinaire.
const MUQATTAA_LETTER_WEIGHT = 8;

/** Durée de récitation attendue d'un texte, en unités arbitraires ("lettres"). */
function verseWeight(text, opensWithMuqattaat = false) {
  let body = text;
  let extra = 0;
  if (opensWithMuqattaat) {
    const words = text.split(' ');
    // Le premier mot, puis les mots courts portant un madd (ex. « حمٓ عٓسٓقٓ »).
    let n = 1;
    while (n < words.length && words[n].includes('ٓ') && (words[n].match(LETTER_RE) || []).length <= 5) n++;
    extra = words.slice(0, n).reduce((acc, w) => acc + (w.match(LETTER_RE) || []).length, 0) * MUQATTAA_LETTER_WEIGHT;
    body = words.slice(n).join(' ');
  }
  const letters = (body.match(LETTER_RE) || []).length;
  const maddah = (body.match(MADDAH_RE) || []).length;
  const dagger = (body.match(DAGGER_ALIF_RE) || []).length;
  return extra + letters + dagger + 4 * maddah + 3;
}

function getAudioDuration(filePath) {
  const result = spawnSync(FFPROBE_BIN, [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath,
  ], { encoding: 'utf8' });
  if (result.error) throw result.error;
  return parseFloat(result.stdout.trim());
}

/** Décode le fichier et renvoie l'énergie (dB) de chaque trame de 10 ms. */
function computeFrameEnergy(filePath) {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_BIN, ['-v', 'error', '-i', filePath, '-ac', '1', '-ar', String(SAMPLE_RATE), '-f', 's16le', '-']);
    const energies = [];
    let acc = 0;
    let count = 0;
    let carry = null;
    proc.stdout.on('data', (chunk) => {
      let buf = carry ? Buffer.concat([carry, chunk]) : chunk;
      carry = null;
      const usable = buf.length - (buf.length % 2);
      if (usable < buf.length) carry = buf.subarray(usable);
      for (let i = 0; i < usable; i += 2) {
        const s = buf.readInt16LE(i) / 32768;
        acc += s * s;
        if (++count === FRAME_LEN) {
          energies.push(10 * Math.log10(acc / FRAME_LEN + 1e-12));
          acc = 0;
          count = 0;
        }
      }
    });
    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(`ffmpeg a échoué (${code}): ${stderr.trim()}`));
      else resolve(Float32Array.from(energies));
    });
  });
}

function quantile(sorted, q) {
  return sorted[Math.floor(q * (sorted.length - 1))];
}

/**
 * Repère les pauses : zones dont l'énergie passe sous un seuil adapté au fichier
 * (entre le bruit de fond et le niveau de la voix). Chaque pause reçoit une force
 * dans [0, 1] combinant sa durée et sa profondeur.
 */
function detectPauses(energies) {
  const sorted = Float32Array.from(energies).sort();
  const floor = quantile(sorted, 0.05);
  const speech = quantile(sorted, 0.9);
  const threshold = floor + (speech - floor) * 0.3;

  const runs = [];
  let i = 0;
  while (i < energies.length) {
    if (energies[i] >= threshold) { i++; continue; }
    let j = i;
    while (j < energies.length && energies[j] < threshold) j++;
    runs.push({ startFrame: i, endFrame: j });
    i = j;
  }

  const maxBlipFrames = Math.round(MAX_BLIP_SEC / FRAME_SEC);
  const merged = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    if (last && run.startFrame - last.endFrame <= maxBlipFrames) last.endFrame = run.endFrame;
    else merged.push({ ...run });
  }

  const totalDuration = energies.length * FRAME_SEC;
  const pauses = [];
  for (const { startFrame, endFrame } of merged) {
    const start = startFrame * FRAME_SEC;
    const end = endFrame * FRAME_SEC;
    const duration = end - start;
    if (duration < MIN_PAUSE_SEC) continue;
    if (start < EDGE_GUARD_SEC || end > totalDuration - EDGE_GUARD_SEC) continue;

    let sum = 0;
    for (let f = startFrame; f < endFrame; f++) sum += Math.max(energies[f], floor - 10);
    const meanDb = sum / (endFrame - startFrame);
    const depth = Math.min(1, Math.max(0, (threshold - meanDb) / Math.max(1, threshold - floor)));
    const lengthScore = 1 - Math.exp(-duration / 0.5);
    pauses.push({
      start,
      end,
      duration,
      meanDb,
      strength: 0.75 * lengthScore + 0.25 * depth,
      // Point de coupe : juste avant la reprise de la voix (début du verset suivant).
      cut: Math.max(start, end - Math.min(0.15, duration * 0.3)),
      mid: (start + end) / 2,
    });
  }
  return { pauses, threshold, floor, speech };
}

/**
 * Choisit globalement les frontières (programmation dynamique).
 * @param segments  [{ weight, expectedSec }] — prélude éventuel puis versets
 * @returns {{ cost:number, chosen:number[] } | null} indices des pauses choisies
 */
function alignSegments(pauses, segments, totalDuration, ratioBounds) {
  const M = segments.length;
  const C = pauses.length;
  if (M === 1) return { cost: segmentCost(totalDuration, segments[0].expectedSec), chosen: [] };
  if (C < M - 1) return null;

  const [minRatio, maxRatio] = ratioBounds;
  const t = pauses.map((p) => p.mid);
  const boundaryCost = pauses.map((p) => 1 - p.strength);

  let prev = new Float64Array(C).fill(Infinity);
  const back = [];

  // Segment 0 : de 0 à la pause c.
  for (let c = 0; c < C; c++) {
    const ratio = t[c] / segments[0].expectedSec;
    if (ratio < minRatio || ratio > maxRatio) continue;
    prev[c] = segmentCost(t[c], segments[0].expectedSec) + boundaryCost[c];
  }
  back.push(null);

  for (let j = 1; j <= M - 2; j++) {
    const cur = new Float64Array(C).fill(Infinity);
    const bp = new Int32Array(C).fill(-1);
    const exp = segments[j].expectedSec;
    let lo = 0;
    for (let c = j; c < C; c++) {
      // Fenêtre glissante sur c' : durée du segment j dans [minRatio, maxRatio] × attendu.
      while (lo < c && t[c] - t[lo] > maxRatio * exp) lo++;
      let best = Infinity;
      let bestIdx = -1;
      for (let cp = c - 1; cp >= lo; cp--) {
        if (prev[cp] === Infinity) continue;
        const dur = t[c] - t[cp];
        if (dur < minRatio * exp) continue;
        const v = prev[cp] + segmentCost(dur, exp);
        if (v < best) { best = v; bestIdx = cp; }
      }
      if (bestIdx !== -1) {
        cur[c] = best + boundaryCost[c];
        bp[c] = bestIdx;
      }
    }
    back.push(bp);
    prev = cur;
  }

  const lastExp = segments[M - 1].expectedSec;
  let best = Infinity;
  let bestIdx = -1;
  for (let c = 0; c < C; c++) {
    if (prev[c] === Infinity) continue;
    const dur = totalDuration - t[c];
    const ratio = dur / lastExp;
    if (ratio < minRatio || ratio > maxRatio) continue;
    const v = prev[c] + segmentCost(dur, lastExp);
    if (v < best) { best = v; bestIdx = c; }
  }
  if (bestIdx === -1) return null;

  const chosen = new Array(M - 1);
  let c = bestIdx;
  for (let j = M - 2; j >= 0; j--) {
    chosen[j] = c;
    if (j > 0) c = back[j][c];
  }
  return { cost: best, chosen };
}

function segmentCost(durationSec, expectedSec) {
  const r = Math.log(Math.max(durationSec, 0.01) / expectedSec);
  return DURATION_WEIGHT * r * r;
}

/** Variantes de prélude possibles en début de fichier, selon la sourate. */
function preludeVariants(surahNumber) {
  const isti = { label: 'isti\'adha', weight: verseWeight(ISTIADHA_TEXT) };
  const basm = { label: 'basmala', weight: verseWeight(BASMALA_TEXT) };
  // At-Tawba : pas de basmala. (En Warsh, la basmala n'est jamais un verset numéroté.)
  if (surahNumber === 9) return [[], [isti]];
  return [[], [basm], [isti, basm], [isti]];
}

function buildSegments(prelude, verseWeights, secPerUnit) {
  const units = [...prelude.map((p) => p.weight), ...verseWeights];
  return units.map((w, i) => ({ weight: w, expectedSec: w * (Array.isArray(secPerUnit) ? secPerUnit[i] : secPerUnit) }));
}

/** Tempo local par segment : médiane glissante du rapport durée réelle / attendue. */
function localTempo(pauses, chosen, segments, totalDuration, globalSecPerUnit, radius = 8) {
  const bounds = [0, ...chosen.map((c) => pauses[c].mid), totalDuration];
  const ratios = segments.map((s, i) => (bounds[i + 1] - bounds[i]) / s.expectedSec);
  return segments.map((_, i) => {
    const win = ratios.slice(Math.max(0, i - radius), i + radius + 1).sort((a, b) => a - b);
    const med = win[Math.floor(win.length / 2)];
    return globalSecPerUnit * Math.min(2, Math.max(0.5, med));
  });
}

function runAlignment(pauses, segments, totalDuration) {
  return alignSegments(pauses, segments, totalDuration, RATIO_BOUNDS)
    || alignSegments(pauses, segments, totalDuration, RELAXED_RATIO_BOUNDS);
}

/**
 * Analyse un fichier audio de sourate et retourne le découpage par verset.
 * @param {string} filePath
 * @param {string[]} verseTexts  texte de chaque verset, numérotation du Mushaf Warsh (dans l'ordre)
 * @param {number} surahNumber
 */
async function analyzeSurah(filePath, verseTexts, surahNumber) {
  const energies = await computeFrameEnergy(filePath);
  const totalDuration = energies.length * FRAME_SEC;
  const { pauses } = detectPauses(energies);
  const verseWeights = verseTexts.map((text, i) => verseWeight(text, i === 0 && MUQATTAAT_SURAHS.has(surahNumber)));
  const ayahCount = verseTexts.length;

  let best = null;
  for (const prelude of preludeVariants(surahNumber)) {
    const totalWeight = [...prelude.map((p) => p.weight), ...verseWeights].reduce((a, b) => a + b, 0);
    const secPerUnit = totalDuration / totalWeight;
    let segments = buildSegments(prelude, verseWeights, secPerUnit);
    let result = runAlignment(pauses, segments, totalDuration);
    if (!result) continue;
    if (segments.length > 2) {
      segments = buildSegments(prelude, verseWeights, localTempo(pauses, result.chosen, segments, totalDuration, secPerUnit));
      result = runAlignment(pauses, segments, totalDuration) || result;
    }
    // Les variantes n'ont pas le même nombre de frontières : on compte en plus chaque arrêt
    // complet laissé À L'INTÉRIEUR d'un segment (une variante sans prélude qui ignore l'arrêt
    // net après la basmala est ainsi pénalisée), ce qui rend les coûts totaux comparables.
    const chosenSet = new Set(result.chosen);
    const missedStops = pauses.reduce((acc, pz, i) => (chosenSet.has(i) ? acc : acc + pz.strength * pz.strength), 0);
    const score = result.cost + missedStops;
    if (!best || score < best.score) best = { score, result, prelude, segments };
  }

  if (!best) {
    // Pas assez de pauses exploitables : découpage proportionnel au texte.
    const totalWeight = verseWeights.reduce((a, b) => a + b, 0);
    let acc = 0;
    const segments = verseWeights.map((w, i) => {
      const startSec = (acc / totalWeight) * totalDuration;
      acc += w;
      return { ayah: i + 1, startSec: Number(startSec.toFixed(2)), endSec: Number(((acc / totalWeight) * totalDuration).toFixed(2)) };
    });
    return { totalDuration, segments, prelude: [], incomplete: true, anomalies: [] };
  }

  const { result, prelude, segments: alignedSegments } = best;
  // Les frontières du prélude sont absorbées par le verset 1 (qui commence à 0).
  const verseCuts = result.chosen.slice(prelude.length).map((c) => pauses[c].cut);
  const segments = [];
  for (let i = 0; i < ayahCount; i++) {
    const start = i === 0 ? 0 : verseCuts[i - 1];
    const end = i < verseCuts.length ? verseCuts[i] : totalDuration;
    segments.push({ ayah: i + 1, startSec: Number(start.toFixed(2)), endSec: Number(end.toFixed(2)) });
  }

  // Versets dont la durée s'écarte fortement du texte : à vérifier à l'oreille.
  const bounds = [0, ...result.chosen.map((c) => pauses[c].mid), totalDuration];
  const anomalies = [];
  alignedSegments.forEach((s, idx) => {
    const ayah = idx - prelude.length + 1;
    if (ayah < 1) return;
    const ratio = (bounds[idx + 1] - bounds[idx]) / s.expectedSec;
    if (ratio < 0.4 || ratio > 2.5) anomalies.push({ ayah, ratio: Number(ratio.toFixed(2)) });
  });

  return {
    totalDuration,
    segments,
    prelude: prelude.map((p) => p.label),
    // Fin du prélude (isti'adha, basmala) : début réel de la récitation du verset 1.
    preludeEndSec: prelude.length ? Number(pauses[result.chosen[prelude.length - 1]].cut.toFixed(2)) : 0,
    incomplete: false,
    anomalies,
  };
}

module.exports = {
  analyzeSurah,
  getAudioDuration,
  verseWeight,
  computeFrameEnergy,
  detectPauses,
};
