/**
 * Clips verticaux « verset + installation de l'appli », un par semaine (le vendredi à 14 h).
 *
 *   node installer.js [--start AAAA-MM-JJ] [--weeks 8]
 *
 * Chaque clip : la récitation d'un verset (texte Warsh et traduction), puis les gestes pour
 * installer AL BARAKA sur Android et sur iPhone, pendant que la récitation continue. Le verset est
 * celui que l'application montre ce jour-là en « Verset du jour » (même calcul que HomeScreen.tsx),
 * ou le suivant de la liste s'il est trop long pour un clip.
 *
 * --start  premier vendredi (le prochain par défaut) ; --weeks  nombre de clips.
 *
 * Les clips arrivent dans out/installer/ avec leur .json (titre YouTube, date de publication) et leur
 * .txt (légende TikTok). upload-youtube.js installer les envoie une semaine à l'avance, programmés à
 * leur date ; plan.js les ajoute au calendrier TikTok.
 */

const fs = require('fs');
const path = require('path');
const {
  FORMATS, Renderer, ayahScreens, frenchOf, segmentsOf, encode, versesOf,
  MUSHAF, AUDIO_DIR, CACHE_DIR, OUT_DIR, SITE, HASHTAGS, pad, slug, surahNameAr, surahNameLatin,
} = require('./render');

const DIR = path.join(OUT_DIR, 'installer');
const HOUR = 14;
// Le verset seul ne dépasse pas 30 s : avec les 15 s d'installation, le clip reste sous la minute.
const VERSE_MAX_SEC = 30;
const FADE_SEC = 1.5;

// Mêmes candidats que le « Verset du jour » de l'application (HomeScreen.tsx).
const CANDIDATES = MUSHAF.verses.filter((v) => v[4].length >= 50).map(([surah, ayah]) => ({ surah, ayah }));

const SCREENS = [
  { duration: 3, kind: 'card', title: 'Tout le Coran, verset par verset', subtitle: "récité par Serigne Aboul Baraka Mbacké\ndans l'application gratuite AL BARAKA" },
  {
    duration: 4.5, kind: 'steps', badge: 'ANDROID', title: 'Installez en 3 gestes',
    steps: [['Ouvrez Chrome', `allez sur ${SITE}`], ['Touchez ⋮', 'les 3 points en haut à droite'], ["« Installer l'application »", "ou « Ajouter à l'écran d'accueil »"]],
  },
  {
    duration: 4.5, kind: 'steps', badge: 'IPHONE', title: 'Installez en 3 gestes',
    steps: [['Ouvrez Safari', `allez sur ${SITE}`], ['Touchez Partager', 'le carré avec la flèche ↑'], ["« Sur l'écran d'accueil »", 'puis « Ajouter »']],
  },
  { duration: 3, kind: 'card', title: 'AL BARAKA', subtitle: 'Gratuit · Sans publicité · Fonctionne hors ligne', pill: SITE },
];
const SCREENS_SEC = SCREENS.reduce((s, x) => s + x.duration, 0);

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function nextFriday() {
  const d = new Date();
  d.setDate(d.getDate() + (((5 - d.getDay() + 7) % 7) || 7));
  return ymd(d);
}

/** Verset du jour de l'application à cette date, ou le suivant de la liste s'il est trop long. */
async function verseFor(date, used) {
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  for (let k = 0; k < CANDIDATES.length; k++) {
    const { surah, ayah } = CANDIDATES[((day * 7919) % CANDIDATES.length + k) % CANDIDATES.length];
    if (used.has(`${surah}:${ayah}`)) continue;
    try {
      const segments = await segmentsOf(surah, versesOf(surah));
      const seg = segments[ayah - 1];
      if (seg.end - seg.start <= VERSE_MAX_SEC) return { surah, seg, surahEnd: segments[segments.length - 1].end };
    } catch {
      // Sourate sans minutages : on passe au verset suivant de la liste.
    }
  }
  throw new Error('aucun verset assez court');
}

function meta(surah, ayah, publishAt) {
  const latin = surahNameLatin(surah);
  const caption = [
    `${latin} (${surahNameAr(surah)}) · verset ${ayah}`,
    'Écoutez tout le Coran en Warsh, récité par Serigne Aboul Baraka Mbacké.',
    `📲 Installez AL BARAKA gratuitement, sur Android comme sur iPhone, sans passer par un store : ${SITE}`,
  ].join('\n');
  return {
    title: `${latin} · verset ${ayah} | Installez AL BARAKA gratuitement #Shorts`.slice(0, 100),
    description: `${caption}\n\n${HASHTAGS.join(' ')} #Shorts`,
    tags: ['Coran', 'Quran', 'Warsh', 'Serigne Aboul Baraka Mbacké', 'AL BARAKA', 'application Coran', `Sourate ${latin}`],
    categoryId: '22',
    publishAt: publishAt.toISOString(),
    tiktokCaption: `${caption}\n\n${HASHTAGS.join(' ')} #fyp`,
  };
}

async function renderOne(renderer, date, used) {
  const { surah, seg, surahEnd } = await verseFor(date, used);
  used.add(`${surah}:${seg.ayah}`);
  const name = `${ymd(date)}-${pad(surah)}-${pad(seg.ayah)}-${slug(surahNameLatin(surah))}`;
  const out = path.join(DIR, `${name}.mp4`);
  if (fs.existsSync(out)) return console.log(`  déjà fait : ${name}.mp4`);

  const dir = path.join(CACHE_DIR, 'frames', `installer-${name}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const fr = await frenchOf(surah);
  const frames = await ayahScreens(renderer, { surahAr: surahNameAr(surah), ref: `Verset du vendredi · ${surahNameLatin(surah)} ${seg.ayah}` }, seg, fr[seg.ayah - 1], dir);
  for (const [i, screen] of SCREENS.entries()) {
    const file = path.join(dir, `installer-${i}.png`);
    await renderer.shot({ ...screen, force: true }, file);
    frames.push({ file, duration: screen.duration });
  }
  // La récitation continue sous les écrans d'installation, puis s'efface ; après la fin de la
  // sourate, encode() complète par du silence.
  const to = Math.min(seg.end + SCREENS_SEC, surahEnd);
  await encode(frames, path.join(AUDIO_DIR, `${pad(surah)}.mp3`), seg.start, to, out, seg.end + SCREENS_SEC - to, FADE_SEC);

  const publishAt = new Date(date);
  publishAt.setHours(HOUR, 0, 0, 0);
  const m = meta(surah, seg.ayah, publishAt);
  fs.writeFileSync(out.replace(/\.mp4$/, '.json'), JSON.stringify(m, null, 2));
  fs.writeFileSync(out.replace(/\.mp4$/, '.txt'), m.tiktokCaption);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`  ✓ ${name}.mp4`);
}

async function main() {
  const start = arg('start', nextFriday());
  const weeks = Number(arg('weeks', 8));
  fs.mkdirSync(DIR, { recursive: true });
  const renderer = new Renderer();
  await renderer.open(FORMATS.shorts);
  const used = new Set();
  try {
    for (let w = 0; w < weeks; w++) {
      const date = new Date(`${start}T00:00:00`);
      date.setDate(date.getDate() + 7 * w);
      console.log(`[${ymd(date)}]`);
      try {
        await renderOne(renderer, date, used);
      } catch (err) {
        console.error(`  ✗ ${err.message}`);
      }
    }
  } finally {
    await renderer.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
