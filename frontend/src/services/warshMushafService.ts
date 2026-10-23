import warshMushafData from '../data/warshMushaf.json';
import warshHafsMapData from '../data/warshHafsMap.json';
import { Ayah } from '../types/quran';

// Mushaf Warsh du Complexe Roi Fahd (KFGQPC) : numérotation Warsh (madani, 6214 versets),
// 604 pages, Juz' et huitièmes de Hizb. Généré par backend/scripts/build-warsh-mushaf.js.
const DATA = warshMushafData as unknown as {
  verses: [number, number, number, number, string][];
  eighths: [number, number][];
  surahs: [string, string][];
};

// Pour chaque verset Warsh : verset(s) Hafs correspondant(s), n ou [premier, dernier]
// (généré par backend/scripts/build-hafs-mapping.js). Sert à rattacher les traductions de
// l'API, numérotées à la Hafs.
const WARSH_HAFS_MAP = warshHafsMapData as unknown as Record<string, (number | [number, number])[]>;

export const MUSHAF_PAGE_COUNT = 604;

// Basmala en tête de sourate (non numérotée en Warsh, y compris pour Al-Fatiha).
export const WARSH_BASMALA = 'بِسْمِ اِ۬للَّهِ اِ۬لرَّحْمَٰنِ اِ۬لرَّحِيمِ';

export interface MushafVerse {
  surah: number;
  ayah: number;
  page: number;
  juz: number;
  /** Huitième de Hizb (1 à 480) auquel appartient le verset. */
  eighth: number;
  /** Vrai si un huitième de Hizb commence à ce verset. */
  opensEighth: boolean;
  text: string;
}

export const MUSHAF_VERSES: MushafVerse[] = (() => {
  let eighth = 0;
  return DATA.verses.map(([surah, ayah, page, juz, text]) => {
    const next = DATA.eighths[eighth];
    const opensEighth = !!next && next[0] === surah && next[1] === ayah;
    if (opensEighth) eighth++;
    return { surah, ayah, page, juz, eighth, opensEighth, text };
  });
})();

/** Versets de chaque page (index 0 = page 1), dans l'ordre du Mushaf. */
export const MUSHAF_PAGES: MushafVerse[][] = (() => {
  const pages: MushafVerse[][] = Array.from({ length: MUSHAF_PAGE_COUNT }, () => []);
  MUSHAF_VERSES.forEach((v) => pages[v.page - 1].push(v));
  return pages;
})();

const SURAH_VERSES: MushafVerse[][] = (() => {
  const bySurah: MushafVerse[][] = Array.from({ length: 114 }, () => []);
  MUSHAF_VERSES.forEach((v) => bySurah[v.surah - 1].push(v));
  return bySurah;
})();

const VERSE_INDEX = new Map(MUSHAF_VERSES.map((v) => [`${v.surah}:${v.ayah}`, v]));

export const getMushafVerse = (surah: number, ayah: number): MushafVerse | undefined => VERSE_INDEX.get(`${surah}:${ayah}`);

export const surahVerseCount = (surah: number): number => SURAH_VERSES[surah - 1]?.length ?? 0;

export const surahNameAr = (surah: number): string => DATA.surahs[surah - 1]?.[0] ?? '';
export const surahNameLatin = (surah: number): string => DATA.surahs[surah - 1]?.[1] ?? '';

export const pageOfVerse = (surah: number, ayah: number): number => getMushafVerse(surah, ayah)?.page ?? 1;

/** Début (sourate, verset, page) de chaque huitième de Hizb (index 0 = huitième 1). */
export const EIGHTH_STARTS = DATA.eighths.map(([surah, ayah]) => ({ surah, ayah, page: pageOfVerse(surah, ayah) }));

/** Page de début de chacun des 30 Juz'. */
export const JUZ_START_PAGES = Array.from({ length: 30 }, (_, i) => EIGHTH_STARTS[i * 16].page);

const JUZ_ORDINALS_AR = [
  'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر',
  'الحادي عشر', 'الثاني عشر', 'الثالث عشر', 'الرابع عشر', 'الخامس عشر', 'السادس عشر', 'السابع عشر',
  'الثامن عشر', 'التاسع عشر', 'العشرون', 'الحادي والعشرون', 'الثاني والعشرون', 'الثالث والعشرون',
  'الرابع والعشرون', 'الخامس والعشرون', 'السادس والعشرون', 'السابع والعشرون', 'الثامن والعشرون',
  'التاسع والعشرون', 'الثلاثون',
];

export const juzNameAr = (juz: number): string => `الجزء ${JUZ_ORDINALS_AR[juz - 1] ?? juz}`;

export const toArabicDigits = (num: number): string =>
  num
    .toString()
    .split('')
    .map((d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d, 10)])
    .join('');

const QUARTER_PREFIX_AR = ['', 'ربع ', 'نصف ', 'ثلاثة أرباع '];

/** Ex. huitième 37 → "ربع الحزب ٥" (le huitième est rattaché au quart qui le contient). */
export const hizbLabelAr = (eighth: number): string => {
  const hizb = Math.ceil(eighth / 8);
  const quarter = Math.floor(((eighth - 1) % 8) / 2);
  return `${QUARTER_PREFIX_AR[quarter]}الحزب ${toArabicDigits(hizb)}`;
};

const GLOBAL_NUMBER = new Map(MUSHAF_VERSES.map((v, i) => [v, i + 1]));

/** Versets Hafs [premier, dernier] correspondant à un verset Warsh. */
export const warshToHafs = (surah: number, ayah: number): [number, number] => {
  const entry = WARSH_HAFS_MAP[String(surah)]?.[ayah - 1];
  if (entry === undefined) return [ayah, ayah];
  return Array.isArray(entry) ? entry : [entry, entry];
};

/** Verset Warsh contenant le début d'un verset numéroté à la Hafs. */
export const hafsToWarsh = (surah: number, hafsAyah: number): number => {
  const entries = WARSH_HAFS_MAP[String(surah)];
  if (!entries) return hafsAyah;
  for (let i = 0; i < entries.length; i++) {
    const [first, last] = warshToHafs(surah, i + 1);
    if (hafsAyah >= first && hafsAyah <= last) return i + 1;
    if (first > hafsAyah) return Math.max(1, i);
  }
  return entries.length;
};

/** Versets d'une sourate au format de l'app (numérotation Warsh, sans traduction). */
export const getWarshAyahs = (surah: number): Ayah[] =>
  (SURAH_VERSES[surah - 1] ?? []).map((v) => ({
    number: GLOBAL_NUMBER.get(v) ?? 0,
    text: v.text,
    numberInSurah: v.ayah,
    juz: v.juz,
    manzil: 0,
    page: v.page,
    ruku: 0,
    hizbQuarter: Math.ceil(v.eighth / 2),
    sajda: v.text.includes('۩'),
  }));
