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

function buildAyahSegments(silences, expectedAyahCount, totalDuration) {
  // On garde les (expectedAyahCount - 1) silences les PLUS LONGS comme frontières de versets
  // (une pause de fin de verset est en général plus marquée qu'une respiration interne).
  const neededBoundaries = expectedAyahCount - 1;
  const sorted = [...silences].sort((a, b) => b.duration - a.duration);
  const chosen = sorted.slice(0, neededBoundaries);
  // Remettre dans l'ordre chronologique, utiliser le MILIEU du silence comme frontière
  chosen.sort((a, b) => a.start - b.start);
  const boundaries = chosen.map((s) => (s.start + s.end) / 2);

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
