/**
 * Découpage automatique des versets par détection de silence (pause du récitateur).
 *
 * Principe : chaque verset est marqué par une petite pause du récitateur. On utilise le
 * filtre `silencedetect` de ffmpeg pour repérer tous les silences du fichier, puis on ne
 * garde que les N-1 pauses les plus marquées (N = nombre de versets attendu de la sourate),
 * ce qui donne N segments = N versets. Le seuil de détection s'assouplit automatiquement
 * si pas assez de pauses ne sont trouvées.
 */

const { spawnSync } = require('child_process');

const FFMPEG_BIN = process.env.FFMPEG_BIN || 'ffmpeg';
const FFPROBE_BIN = process.env.FFPROBE_BIN || 'ffprobe';

// Paliers du plus strict (peu de faux positifs) au plus permissif (capte les pauses
// discrètes dans un enregistrement plus "vivant" ou avec un bruit de fond plus élevé).
const THRESHOLD_LADDER = [
  { silenceDb: -30, silenceMinDur: 0.35 },
  { silenceDb: -28, silenceMinDur: 0.3 },
  { silenceDb: -26, silenceMinDur: 0.25 },
  { silenceDb: -24, silenceMinDur: 0.2 },
  { silenceDb: -22, silenceMinDur: 0.15 },
  { silenceDb: -20, silenceMinDur: 0.12 },
  { silenceDb: -18, silenceMinDur: 0.1 },
];

function runSilenceDetect(filePath, silenceDb, silenceMinDur) {
  const args = [
    '-i', filePath,
    '-af', `silencedetect=noise=${silenceDb}dB:d=${silenceMinDur}`,
    '-f', 'null', '-',
  ];
  const result = spawnSync(FFMPEG_BIN, args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 50 });
  if (result.error) {
    throw result.error;
  }
  return result.stderr || '';
}

function parseSilences(ffmpegOutput) {
  const silences = [];
  const startRegex = /silence_start:\s*(-?[\d.]+)/g;
  const endRegex = /silence_end:\s*(-?[\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/g;

  const starts = [...ffmpegOutput.matchAll(startRegex)].map((m) => parseFloat(m[1]));
  const ends = [...ffmpegOutput.matchAll(endRegex)].map((m) => ({
    end: parseFloat(m[1]),
    duration: parseFloat(m[2]),
  }));

  for (let i = 0; i < Math.min(starts.length, ends.length); i++) {
    silences.push({
      start: starts[i],
      end: ends[i].end,
      duration: ends[i].duration,
    });
  }
  return silences;
}

/**
 * Fusionne les silences très proches dans le temps (ex: un micro-artefact audio qui
 * coupe une même pause perçue en deux intervalles de silence distincts), pour éviter
 * de compter deux fois la même frontière de verset.
 */
function mergeCloseSilences(silences, gapThreshold = 0.6) {
  if (silences.length === 0) return silences;
  const sorted = [...silences].sort((a, b) => a.start - b.start);
  const merged = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const cur = sorted[i];
    if (cur.start - last.end < gapThreshold) {
      last.end = Math.max(last.end, cur.end);
      last.duration = last.end - last.start;
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

/**
 * Écarte les silences trop proches du tout début ou de la toute fin du fichier :
 * ce sont en général du bruit de fond / une marge d'enregistrement, pas une vraie
 * frontière entre deux versets. Sans ce filtre, un silence de fin de piste peut
 * "voler" la place d'une vraie pause inter-versets dans le classement par durée.
 */
function filterEdgeSilences(silences, totalDuration, edgeGuardSec = 1.0) {
  return silences.filter((s) => s.start > edgeGuardSec && s.end < totalDuration - edgeGuardSec);
}

function getAudioDuration(filePath) {
  const result = spawnSync(FFPROBE_BIN, [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath,
  ], { encoding: 'utf8' });
  return parseFloat(result.stdout.trim());
}

/**
 * Choisit, pour chacune des (expectedAyahCount - 1) frontières attendues, le silence le
 * PLUS PROCHE de sa position linéaire attendue (plutôt que les silences les plus longs
 * globalement). Une simple sélection "top N-1 par durée" peut se faire piéger par une
 * pause isolée mal placée (toux, respiration profonde) qui "vole" la place d'une vraie
 * frontière ailleurs dans la sourate, décalant tout un bloc de versets. En ancrant le
 * choix sur la position attendue (durée totale répartie uniformément sur le nombre de
 * versets), on reste robuste à ce genre d'anomalie isolée, tout en favorisant les pauses
 * plus longues en cas d'ambiguïté proche.
 */
function buildAyahSegments(silences, expectedAyahCount, totalDuration) {
  const neededBoundaries = expectedAyahCount - 1;
  const available = [...silences];
  const boundaries = [];
  let minStart = 0;

  for (let i = 1; i <= neededBoundaries; i++) {
    const expectedPos = (totalDuration * i) / expectedAyahCount;
    // Borne haute de la zone de recherche = position attendue de la PROCHAINE frontière.
    // Sans cette borne, un candidat mal choisi ici peut "sauter" trop loin en avant et
    // priver les frontières suivantes de tout candidat valable, ce qui effondre en cascade
    // tous les versets restants à une durée nulle (bug observé en pratique).
    const nextExpectedPos = i < neededBoundaries ? (totalDuration * (i + 1)) / expectedAyahCount : totalDuration;

    let bestIdx = -1;
    let bestScore = Infinity;
    available.forEach((s, idx) => {
      const mid = (s.start + s.end) / 2;
      if (mid <= minStart || mid >= nextExpectedPos) return;
      const distance = Math.abs(mid - expectedPos);
      // Une pause plus longue peut compenser un peu de distance à la position attendue,
      // mais la proximité reste le critère dominant.
      const score = distance - s.duration * 1.5;
      if (score < bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    });

    let boundary;
    if (bestIdx === -1) {
      // Aucun candidat dans la zone attendue : repli sur la position linéaire pure plutôt
      // que de laisser toutes les frontières suivantes s'effondrer.
      boundary = Math.max(minStart + 0.3, Math.min(expectedPos, nextExpectedPos - 0.1));
    } else {
      const chosen = available[bestIdx];
      boundary = (chosen.start + chosen.end) / 2;
      available.splice(bestIdx, 1);
    }
    boundaries.push(boundary);
    minStart = boundary;
  }

  const segments = [];
  let prev = 0;
  for (let i = 0; i < expectedAyahCount; i++) {
    const start = prev;
    const end = i < boundaries.length ? boundaries[i] : totalDuration;
    segments.push({ ayah: i + 1, startSec: Number(start.toFixed(2)), endSec: Number(end.toFixed(2)) });
    prev = end;
  }
  return segments;
}

/**
 * Essaie des seuils de silence de plus en plus permissifs jusqu'à trouver assez de
 * pauses pour découper la sourate en `expectedAyahCount` versets.
 */
function detectSilencesAdaptive(filePath, neededBoundaries, totalDuration) {
  let best = { silences: [], config: THRESHOLD_LADDER[0] };
  for (const config of THRESHOLD_LADDER) {
    const output = runSilenceDetect(filePath, config.silenceDb, config.silenceMinDur);
    const silences = filterEdgeSilences(mergeCloseSilences(parseSilences(output)), totalDuration);
    if (silences.length > best.silences.length) {
      best = { silences, config };
    }
    if (silences.length >= neededBoundaries) {
      return { silences, config, usedFallback: false };
    }
  }
  return { silences: best.silences, config: best.config, usedFallback: true };
}

/**
 * Analyse un fichier audio de sourate et retourne le découpage estimé par verset.
 * @returns {{ totalDuration: number, segments: Array<{ayah:number, startSec:number, endSec:number}>, incomplete: boolean, config: object }}
 */
function analyzeSurah(filePath, expectedAyahCount) {
  const neededBoundaries = expectedAyahCount - 1;
  const totalDuration = getAudioDuration(filePath);
  const { silences, config, usedFallback } = detectSilencesAdaptive(filePath, neededBoundaries, totalDuration);
  const segments = buildAyahSegments(silences, expectedAyahCount, totalDuration);
  return {
    totalDuration,
    segments,
    incomplete: silences.length < neededBoundaries,
    usedFallback,
    config,
  };
}

module.exports = {
  analyzeSurah,
  getAudioDuration,
  detectSilencesAdaptive,
  buildAyahSegments,
};
