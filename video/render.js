/**
 * Génère les vidéos des récitations à partir des MP3, du texte Warsh et des minutages par verset.
 *
 *   node render.js long <sourates>     vidéos YouTube 16:9, une par sourate
 *   node render.js shorts <sourates>   clips verticaux 9:16 (YouTube Shorts, TikTok), quelques versets chacun
 *   node render.js combo 108,103 112-114   un clip vertical par groupe de sourates courtes (out/regroupes/)
 *
 * <sourates> : "1", "1-10", "78-114" ou "all".
 * Options : --max <s> durée maximale d'un clip (60 par défaut), --no-fr sans traduction française.
 *
 * Chaque vidéo est accompagnée d'un .json (titre, description, mots-clés) lu par upload-youtube.js,
 * et chaque clip vertical d'un .txt (légende prête à coller sur TikTok).
 *
 * Prérequis : les MP3 001..114 dans backend/uploads/audios/serigne-aboul-baraka-mbacke/,
 * Google Chrome installé (ou CHROME_PATH), `npm install` dans ce dossier.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const puppeteer = require('puppeteer-core');
const FFMPEG = require('ffmpeg-static');

process.env.FFMPEG_BIN = process.env.FFMPEG_BIN || FFMPEG;
const { analyzeSurah } = require('../backend/scripts/lib/silenceSegmenter');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'frontend', 'src', 'data');
const AUDIO_DIR = path.join(ROOT, 'backend', 'uploads', 'audios', 'serigne-aboul-baraka-mbacke');
const FONT_PATH = path.join(ROOT, 'frontend', 'assets', 'fonts', 'KFGQPC_Warsh.ttf');
const ICON_PATH = path.join(ROOT, 'frontend', 'public', 'icons', 'app-badge-256.png');
const CACHE_DIR = path.join(__dirname, 'cache');
const OUT_DIR = path.join(__dirname, 'out');

const SITE = 'al-baraka-app.pages.dev';
const BASMALA = 'بِسْمِ اِ۬للَّهِ اِ۬لرَّحْمَٰنِ اِ۬لرَّحِيمِ';
const OUTRO_SEC = 5;
// L'image ne change qu'à chaque verset : 6 images/s suffisent et l'encodage va bien plus vite.
const FPS = 6;

const FORMATS = {
  long: { width: 1920, height: 1080, outer: 28, inner: '44px 90px 40px', maxSize: 88, minSize: 54 },
  // Marges larges en haut et en bas : TikTok et Shorts y superposent leurs boutons et la légende.
  shorts: { width: 1080, height: 1920, outer: 28, inner: '170px 70px 330px', maxSize: 84, minSize: 50 },
};

const MUSHAF = require(path.join(DATA_DIR, 'warshMushaf.json'));
const TIMINGS = require(path.join(DATA_DIR, 'ayahTimings.json'));
const WARSH_HAFS = require(path.join(DATA_DIR, 'warshHafsMap.json'));

const surahNameAr = (n) => MUSHAF.surahs[n - 1][0];
const surahNameLatin = (n) => MUSHAF.surahs[n - 1][1];
const pad = (n) => String(n).padStart(3, '0');
const slug = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
// Dans la police Warsh, les chiffres arabes sont dessinés comme des fins de verset ornées.
const toArabicDigits = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

function versesOf(surah) {
  return MUSHAF.verses.filter((v) => v[0] === surah).map(([, ayah, page, , text]) => ({ ayah, page, text: text.replace(/۞\s*/g, '').trim() }));
}

/** Traduction Hamidullah (numérotation Hafs) ramenée aux versets Warsh, mise en cache sur disque. */
async function frenchOf(surah) {
  const file = path.join(CACHE_DIR, `fr-${pad(surah)}.json`);
  if (!fs.existsSync(file)) {
    const res = await fetch(`https://api.alquran.cloud/v1/surah/${surah}/fr.hamidullah`);
    if (!res.ok) throw new Error(`traduction ${surah} : HTTP ${res.status}`);
    const json = await res.json();
    fs.writeFileSync(file, JSON.stringify(json.data.ayahs.map((a) => a.text)));
  }
  const hafs = JSON.parse(fs.readFileSync(file, 'utf8'));
  return (WARSH_HAFS[String(surah)] || []).map((entry) => {
    const [first, last] = Array.isArray(entry) ? entry : [entry, entry];
    return hafs.slice(first - 1, last).join(' ');
  });
}

/** Fin de la basmala (ou de l'isti'adha) en tête d'enregistrement, mise en cache sur disque. */
async function preludeEndOf(surah, verses) {
  const file = path.join(CACHE_DIR, `prelude-${pad(surah)}.json`);
  if (!fs.existsSync(file)) {
    const result = await analyzeSurah(path.join(AUDIO_DIR, `${pad(surah)}.mp3`), verses.map((v) => v.text), surah);
    fs.writeFileSync(file, JSON.stringify({ preludeEndSec: result.preludeEndSec || 0 }));
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')).preludeEndSec;
}

/** Début et fin de chaque verset dans le MP3 ; le verset 1 commence après le prélude. */
async function segmentsOf(surah, verses) {
  const t = TIMINGS[String(surah)];
  if (!t || t.startSeconds.length !== verses.length) throw new Error(`minutages absents ou incomplets pour la sourate ${surah}`);
  const preludeEnd = await preludeEndOf(surah, verses);
  return verses.map((v, i) => ({
    ...v,
    start: i === 0 && preludeEnd < (t.startSeconds[1] ?? t.totalDuration) ? preludeEnd : t.startSeconds[i],
    end: t.startSeconds[i + 1] ?? t.totalDuration,
  }));
}

function run(bin, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    // Priorité basse : l'ordinateur reste utilisable pendant les longs encodages.
    try { os.setPriority(p.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch {}
    let err = '';
    p.stderr.on('data', (d) => { err = (err + d).slice(-4000); });
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg (${code}) : ${err}`))));
  });
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
  ];
  const found = candidates.find((c) => c && fs.existsSync(c));
  if (!found) throw new Error('Chrome introuvable : indiquez son chemin dans CHROME_PATH.');
  return found;
}

class Renderer {
  async open(format) {
    this.format = format;
    const html = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8').replace('__WARSH_FONT__', pathToFileURL(FONT_PATH).href)
      .replace(/__APP_ICON__/g, pathToFileURL(ICON_PATH).href);
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const file = path.join(CACHE_DIR, 'template.html');
    fs.writeFileSync(file, html);
    this.browser = await puppeteer.launch({ executablePath: findChrome(), args: ['--allow-file-access-from-files'] });
    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: format.width, height: format.height });
    await this.page.goto(pathToFileURL(file).href);
  }

  /** Dessine un écran dans `file` ; renvoie false si le texte ne tient pas, même au plus petit. */
  async shot(screen, file) {
    const f = this.format;
    const fits = await this.page.evaluate((s) => window.draw(s), { outer: f.outer, inner: f.inner, maxSize: f.maxSize, minSize: f.minSize, site: SITE, ...screen });
    if (fits || screen.force) await this.page.screenshot({ path: file, type: 'png' });
    return fits;
  }

  close() { return this.browser?.close(); }
}

/**
 * Écrans d'un verset. Un verset trop long pour un seul écran est coupé en parties (texte arabe
 * et traduction coupés au même rapport), chacune affichée un temps proportionnel à sa longueur.
 */
async function ayahScreens(renderer, base, verse, fr, dir, parts = 1) {
  const words = verse.text.split(/\s+/);
  const frWords = fr ? fr.split(/\s+/) : [];
  const shots = [];
  for (let i = 0; i < parts; i++) {
    const a = words.slice(Math.round((i * words.length) / parts), Math.round(((i + 1) * words.length) / parts)).join(' ');
    const t = frWords.slice(Math.round((i * frWords.length) / parts), Math.round(((i + 1) * frWords.length) / parts)).join(' ');
    const last = i === parts - 1;
    const file = path.join(dir, `${pad(verse.ayah)}-${i}.png`);
    const ok = await renderer.shot({
      ...base, kind: 'ayah',
      ayah: last ? `${a} ${toArabicDigits(verse.ayah)}` : `${a} …`,
      fr: t ? (i > 0 ? '… ' : '') + t + (last ? '' : ' …') : '',
      force: parts >= 6,
    }, file);
    if (!ok && parts < 6) return ayahScreens(renderer, base, verse, fr, dir, parts + 1);
    shots.push({ file, weight: a.length });
  }
  const total = shots.reduce((s, x) => s + x.weight, 0);
  const duration = verse.end - verse.start;
  return shots.map((s) => ({ file: s.file, duration: (duration * s.weight) / total }));
}

/** Assemble les images (avec leur durée) et l'extrait audio [from, to] en MP4. */
async function encode(frames, audioFile, from, to, outFile, outroSec, fadeSec = 0) {
  const list = path.join(path.dirname(frames[0].file), 'frames.txt');
  const lines = frames.flatMap((f) => [`file '${f.file.replace(/\\/g, '/')}'`, `duration ${f.duration.toFixed(3)}`]);
  lines.push(`file '${frames[frames.length - 1].file.replace(/\\/g, '/')}'`);
  fs.writeFileSync(list, lines.join('\n'));
  const total = to - from + outroSec;
  // Écrit sous un nom provisoire : une vidéo interrompue n'est jamais prise pour une vidéo finie.
  const partial = outFile.replace(/\.mp4$/, '.partiel.mp4');
  await run(FFMPEG, [
    '-y', '-loglevel', 'error',
    '-f', 'concat', '-safe', '0', '-i', list,
    '-ss', from.toFixed(3), '-to', to.toFixed(3), '-i', audioFile,
    '-map', '0:v', '-map', '1:a',
    '-vf', `fps=${FPS},format=yuv420p`, '-c:v', 'libx264', '-tune', 'stillimage', '-preset', 'veryfast', '-crf', '20',
    '-af', `apad=whole_dur=${total.toFixed(3)}` + (fadeSec ? `,afade=t=out:st=${(total - fadeSec).toFixed(3)}:d=${fadeSec}` : ''), '-c:a', 'aac', '-b:a', '192k',
    '-t', total.toFixed(3), '-movflags', '+faststart', partial,
  ]);
  fs.renameSync(partial, outFile);
}

const HASHTAGS = ['#Coran', '#Quran', '#Warsh', '#SerigneAboulBaraka', '#AlBaraka', '#Sénégal'];

function longMeta(surah, count, part, parts, first, last) {
  const latin = surahNameLatin(surah);
  const range = `versets ${first}-${last}`;
  const head = parts > 1 ? `Sourate ${latin} · partie ${part}/${parts} (${range})` : `Sourate ${latin} (${surahNameAr(surah)})`;
  return {
    title: `${head} | Coran Warsh | Serigne Aboul Baraka Mbacké`.slice(0, 100),
    description: [
      `Sourate ${surah} · ${latin} (${surahNameAr(surah)}) · ${count} versets` + (parts > 1 ? ` · partie ${part}/${parts}, ${range}` : ''),
      'Récitation en riwaya Warsh par Serigne Aboul Baraka Mbacké, texte du Mushaf Warsh et traduction française (Muhammad Hamidullah).',
      '',
      `📖 Lisez et écoutez verset par verset dans l'application gratuite AL BARAKA : https://${SITE}`,
      '',
      HASHTAGS.join(' '),
    ].join('\n'),
    tags: ['Coran', 'Quran', 'Warsh', 'Serigne Aboul Baraka Mbacké', 'AL BARAKA', `Sourate ${latin}`, 'récitation', 'Sénégal'],
    categoryId: '22',
  };
}

function shortMeta(surah, first, last) {
  const latin = surahNameLatin(surah);
  const range = first === last ? `verset ${first}` : `versets ${first}-${last}`;
  const caption = `${latin} (${surahNameAr(surah)}) · ${range}\nRécitation Warsh de Serigne Aboul Baraka Mbacké\n📖 Application gratuite : ${SITE}`;
  return {
    title: `${latin} · ${range} | Serigne Aboul Baraka Mbacké #Shorts`.slice(0, 100),
    description: `${caption}\n\n${HASHTAGS.join(' ')} #Shorts`,
    tags: ['Coran', 'Quran', 'Warsh', 'Serigne Aboul Baraka Mbacké', 'AL BARAKA', `Sourate ${latin}`],
    categoryId: '22',
    tiktokCaption: `${caption}\n\n${HASHTAGS.join(' ')} #fyp`,
  };
}

/** Regroupe les versets consécutifs en clips d'au plus `maxSec` secondes. */
function groupClips(segments, maxSec) {
  const clips = [];
  let cur = [];
  for (const s of segments) {
    if (cur.length && s.end - cur[0].start > maxSec) { clips.push(cur); cur = []; }
    cur.push(s);
  }
  if (cur.length) clips.push(cur);
  return clips;
}

// Une chaîne YouTube non vérifiée par téléphone refuse les vidéos de plus de 15 minutes : les
// longues sourates sont découpées en parties de taille voisine, coupées entre deux versets.
const PART_MAX_SEC = 14 * 60;

function splitParts(segments) {
  const total = segments[segments.length - 1].end;
  const count = Math.ceil(total / PART_MAX_SEC);
  return groupClips(segments, Math.min(PART_MAX_SEC, (total / count) * 1.1));
}

async function renderLong(renderer, surah, { withFr }) {
  const name = `${pad(surah)}-${slug(surahNameLatin(surah))}`;
  const verses = versesOf(surah);
  const segments = await segmentsOf(surah, verses);
  const parts = splitParts(segments);
  const fr = withFr ? await frenchOf(surah) : [];
  const base = { surahAr: surahNameAr(surah) };

  for (const [p, part] of parts.entries()) {
    const out = path.join(OUT_DIR, 'youtube', parts.length > 1 ? `${name}-p${String(p + 1).padStart(2, '0')}.mp4` : `${name}.mp4`);
    if (fs.existsSync(out)) { console.log(`  déjà fait : ${path.basename(out)}`); continue; }
    const dir = path.join(CACHE_DIR, 'frames', `long-${pad(surah)}-${p}`);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const first = part[0];
    const last = part[part.length - 1];
    const label = parts.length > 1 ? ` · partie ${p + 1}/${parts.length}` : '';
    const frames = [];

    if (p === 0) {
      // Écran titre pendant la basmala (au moins 1 s, même sans basmala détectée).
      const introSec = first.start;
      const intro = { kind: 'intro', basmala: surah === 9 ? '' : BASMALA, title: `Sourate ${surahNameLatin(surah)}`, subtitle: `${verses.length} versets · riwaya Warsh${label}` };
      await renderer.shot({ ...base, ...intro, force: true }, path.join(dir, 'intro.png'));
      frames.push({ file: path.join(dir, 'intro.png'), duration: Math.max(introSec, 1) });
      if (introSec < 1) part[0] = { ...first, start: 1 };
    }
    for (const seg of part) {
      frames.push(...await ayahScreens(renderer, { ...base, ref: `${surahNameLatin(surah)} · verset ${seg.ayah}${label}` }, seg, fr[seg.ayah - 1], dir));
    }
    const final = p === parts.length - 1;
    await renderer.shot({
      ...base, kind: 'outro', force: true,
      title: final ? 'صَدَقَ اللَّهُ الْعَظِيمُ' : `La suite : partie ${p + 2}/${parts.length}`,
      subtitle: `Lisez et écoutez verset par verset\ndans l'application gratuite AL BARAKA`,
    }, path.join(dir, 'outro.png'));
    frames.push({ file: path.join(dir, 'outro.png'), duration: OUTRO_SEC });

    fs.mkdirSync(path.dirname(out), { recursive: true });
    await encode(frames, path.join(AUDIO_DIR, `${pad(surah)}.mp3`), p === 0 ? 0 : first.start, last.end, out, OUTRO_SEC);
    fs.writeFileSync(out.replace(/\.mp4$/, '.json'), JSON.stringify(longMeta(surah, verses.length, p + 1, parts.length, first.ayah, last.ayah), null, 2));
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`  ✓ ${path.basename(out)}`);
  }
}

async function renderShorts(renderer, surah, { withFr, maxSec }) {
  const verses = versesOf(surah);
  const segments = await segmentsOf(surah, verses);
  const fr = withFr ? await frenchOf(surah) : [];
  const outDir = path.join(OUT_DIR, 'shorts');
  fs.mkdirSync(outDir, { recursive: true });

  for (const clip of groupClips(segments, maxSec)) {
    const first = clip[0].ayah;
    const last = clip[clip.length - 1].ayah;
    const name = `${pad(surah)}-${pad(first)}-${pad(last)}-${slug(surahNameLatin(surah))}`;
    const out = path.join(outDir, `${name}.mp4`);
    if (fs.existsSync(out)) continue;
    if (clip[clip.length - 1].end - clip[0].start > 180) {
      console.warn(`  ⚠ ${name} dépasse 3 min (limite des Shorts), ignoré.`);
      continue;
    }
    const dir = path.join(CACHE_DIR, 'frames', `short-${name}`);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const frames = [];
    for (const seg of clip) {
      frames.push(...await ayahScreens(renderer, { surahAr: surahNameAr(surah), ref: `${surahNameLatin(surah)} · verset ${seg.ayah}` }, seg, fr[seg.ayah - 1], dir));
    }
    await renderer.shot({ kind: 'outro', title: 'AL BARAKA', subtitle: `Le Coran en Warsh, verset par verset\n${SITE}`, force: true }, path.join(dir, 'outro.png'));
    frames.push({ file: path.join(dir, 'outro.png'), duration: 2 });
    await encode(frames, path.join(AUDIO_DIR, `${pad(surah)}.mp3`), clip[0].start, clip[clip.length - 1].end, out, 2);
    const meta = shortMeta(surah, first, last);
    fs.writeFileSync(out.replace(/\.mp4$/, '.json'), JSON.stringify(meta, null, 2));
    fs.writeFileSync(out.replace(/\.mp4$/, '.txt'), meta.tiktokCaption);
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`  ✓ ${name}.mp4`);
  }
}

/**
 * Clip vertical regroupant plusieurs sourates courtes, à la suite (ex. Al-Ikhlāṣ, Al-Falaq et
 * An-Nās) : seules, elles font des clips de 15 à 25 s que TikTok montre peu. Chaque sourate est
 * encodée à part (son MP3, sans la basmala, comme les clips d'une sourate), puis les morceaux sont
 * mis bout à bout. Les clips arrivent dans out/regroupes/ : ils ne partent pas dans la file des
 * Shorts YouTube, qui contient déjà ces sourates une par une.
 */
async function renderCombo(renderer, surahs, { withFr }) {
  const latins = surahs.map(surahNameLatin);
  const name = `${surahs.map(pad).join('-')}-${surahs.map((s) => slug(surahNameLatin(s))).join('-')}`;
  const outDir = path.join(OUT_DIR, 'regroupes');
  const out = path.join(outDir, `${name}.mp4`);
  if (fs.existsSync(out)) return console.log(`  déjà fait : ${name}.mp4`);
  const dir = path.join(CACHE_DIR, 'frames', `combo-${name}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  const parts = [];
  for (const [i, surah] of surahs.entries()) {
    const segments = await segmentsOf(surah, versesOf(surah));
    const fr = withFr ? await frenchOf(surah) : [];
    const surahDir = path.join(dir, pad(surah));
    fs.mkdirSync(surahDir, { recursive: true });
    const frames = [];
    for (const seg of segments) {
      frames.push(...await ayahScreens(renderer, { surahAr: surahNameAr(surah), ref: `${surahNameLatin(surah)} · verset ${seg.ayah}` }, seg, fr[seg.ayah - 1], surahDir));
    }
    const last = i === surahs.length - 1;
    if (last) {
      await renderer.shot({ kind: 'outro', title: 'AL BARAKA', subtitle: `Le Coran en Warsh, verset par verset\n${SITE}`, force: true }, path.join(surahDir, 'outro.png'));
      frames.push({ file: path.join(surahDir, 'outro.png'), duration: 2 });
    }
    const part = path.join(dir, `${pad(surah)}.mp4`);
    await encode(frames, path.join(AUDIO_DIR, `${pad(surah)}.mp3`), segments[0].start, segments[segments.length - 1].end, part, last ? 2 : 0);
    parts.push(part);
  }

  // Morceaux encodés pareil (images, son) : ils se mettent bout à bout sans réencodage.
  const list = path.join(dir, 'parts.txt');
  fs.writeFileSync(list, parts.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'));
  const partial = out.replace(/\.mp4$/, '.partiel.mp4');
  await run(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', partial]);
  fs.renameSync(partial, out);

  const title = latins.length > 1 ? `${latins.slice(0, -1).join(', ')} et ${latins[latins.length - 1]}` : latins[0];
  const caption = `${title} · ${surahs.map(surahNameAr).join(' · ')}\nRécitation Warsh de Serigne Aboul Baraka Mbacké\n📖 Application gratuite : ${SITE}`;
  const meta = {
    title: `${title} | Serigne Aboul Baraka Mbacké #Shorts`.slice(0, 100),
    description: `${caption}\n\n${HASHTAGS.join(' ')} #Shorts`,
    tags: ['Coran', 'Quran', 'Warsh', 'Serigne Aboul Baraka Mbacké', 'AL BARAKA', ...latins.map((l) => `Sourate ${l}`)],
    categoryId: '22',
    tiktokCaption: `${caption}\n\n${HASHTAGS.join(' ')} #fyp`,
  };
  fs.writeFileSync(out.replace(/\.mp4$/, '.json'), JSON.stringify(meta, null, 2));
  fs.writeFileSync(out.replace(/\.mp4$/, '.txt'), meta.tiktokCaption);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`  ✓ ${name}.mp4`);
}

function parseSurahs(arg) {
  if (!arg || arg === 'all') return Array.from({ length: 114 }, (_, i) => i + 1);
  return arg.split(',').flatMap((part) => {
    const [a, b] = part.split('-').map(Number);
    if (!(a >= 1 && a <= 114) || (b !== undefined && !(b >= a && b <= 114))) throw new Error(`sourates invalides : ${part}`);
    return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i);
  });
}

async function main() {
  const [mode, list, ...rest] = process.argv.slice(2);
  if (mode === 'combo') {
    // node render.js combo 108,103 112,113,114 : un clip par groupe de sourates.
    const groups = [list, ...rest.filter((a) => !a.startsWith('--'))].filter(Boolean).map(parseSurahs);
    const renderer = new Renderer();
    await renderer.open(FORMATS.shorts);
    try {
      for (const group of groups) {
        console.log(`[${group.map(pad).join('+')}] ${group.map(surahNameLatin).join(' + ')}`);
        try {
          await renderCombo(renderer, group, { withFr: !rest.includes('--no-fr') });
        } catch (err) {
          console.error(`  ✗ ${err.message}`);
        }
      }
    } finally {
      await renderer.close();
    }
    return;
  }
  if (!FORMATS[mode]) {
    console.log('Usage : node render.js long|shorts <sourates> [--max 60] [--no-fr]\n        node render.js combo <sourates> [<sourates>…]   ex. combo 108,103 112-114');
    process.exit(1);
  }
  const maxIdx = rest.indexOf('--max');
  const options = { withFr: !rest.includes('--no-fr'), maxSec: maxIdx >= 0 ? Number(rest[maxIdx + 1]) : 60 };
  const surahs = parseSurahs(list);

  const renderer = new Renderer();
  await renderer.open(FORMATS[mode]);
  try {
    for (const surah of surahs) {
      console.log(`[${pad(surah)}] ${surahNameLatin(surah)}`);
      try {
        await (mode === 'long' ? renderLong : renderShorts)(renderer, surah, options);
      } catch (err) {
        console.error(`  ✗ ${err.message}`);
      }
    }
  } finally {
    await renderer.close();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  FORMATS, Renderer, ayahScreens, versesOf, frenchOf, segmentsOf, encode,
  MUSHAF, AUDIO_DIR, CACHE_DIR, OUT_DIR, SITE, HASHTAGS, pad, slug, surahNameAr, surahNameLatin,
};
