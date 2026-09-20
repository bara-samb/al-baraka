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
 * Choisit, pour chacune des (expectedAyahCount - 1) frontières attendues, la pause la
 * PLUS LONGUE dans une zone bornée autour de la position attendue (plutôt que la pause
 * la plus proche de cette position). Une respiration à l'intérieur d'un verset est en
 * général plus courte que la vraie pause de fin de verset ; si on choisit par simple
 * proximité, une respiration interne légèrement plus proche de la position attendue peut
 * "voler" la place de la vraie frontière, ce qui fait démarrer la lecture d'un verset en
 * réalité encore dans la fin du verset précédent. La borne de zone (position attendue de
 * la frontière SUIVANTE) évite par ailleurs qu'un choix isolé ne "saute" trop loin en
 * avant et ne prive les frontières suivantes de tout candidat (effondrement en cascade).
 */
function buildAyahSegments(silences, expectedAyahCount, totalDuration) {
  const neededBoundaries = expectedAyahCount - 1;
  const available = [...silences];
  const boundaries = [];
  let minStart = 0;

  for (let i = 1; i <= neededBoundaries; i++) {
    const expectedPos = (totalDuration * i) / expectedAyahCount;
    const nextExpectedPos = i < neededBoundaries ? (totalDuration * (i + 1)) / expectedAyahCount : totalDuration;

    let bestIdx = -1;
    let bestDuration = -1;
    available.forEach((s, idx) => {
      const mid = (s.start + s.end) / 2;
      if (mid <= minStart || mid >= nextExpectedPos) return;
      if (s.duration > bestDuration) {
        bestDuration = s.duration;
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
      // On se cale vers la FIN du silence (70%) plutôt que son milieu : la reprise de la
      // récitation (donc le vrai début du prochain verset) est plus proche de la fin de la
      // pause que de son milieu, ce qui réduit le risque de démarrer encore un peu avant.
      boundary = chosen.start + (chosen.end - chosen.start) * 0.7;
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
