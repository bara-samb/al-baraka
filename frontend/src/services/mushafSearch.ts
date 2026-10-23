import { MUSHAF_VERSES, MushafVerse } from './warshMushafService';

/**
 * Recherche d'un mot (en arabe) dans le texte du Mushaf Warsh.
 *
 * Le texte est comparé sans voyelles ni signes de lecture, et quelques graphies sont
 * unifiées (أ إ آ ٱ → ا, ى ے → ي, ة → ه). L'alif suscrit (ٰ) se lit tantôt comme un alif
 * (ٱلْعَٰلَمِينَ = « العالمين ») tantôt non (هَٰذَا = « هذا ») : chaque verset est donc
 * comparé sous les deux formes. Dans la seconde, « وٰ » se lit aussi « ا »
 * (ٱلصَّلَوٰةَ = « الصلاة », ٱلزَّكَوٰةَ = « الزكاة »).
 */

// Voyelles, signes coraniques, tatwil et marques de direction : ignorés.
const IGNORED = /[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED\u08D3-\u08FF\u0640\u200E\u200F]/;
const LETTERS: Record<string, string> = {
  'أ': 'ا',
  'إ': 'ا',
  'آ': 'ا',
  'ٱ': 'ا',
  'ى': 'ي',
  'ے': 'ي',
  'ی': 'ي',
  'ة': 'ه',
  '\u00A0': ' ',
};
const DAGGER_ALEF = '\u0670';

interface Normalized {
  text: string;
  /** Pour chaque caractère de `text`, sa position dans le texte original. */
  map: number[];
}

const normalize = (source: string, daggerAsAlef: boolean): Normalized => {
  let text = '';
  const map: number[] = [];
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === DAGGER_ALEF) {
      if (daggerAsAlef && text.endsWith('و')) {
        text = text.slice(0, -1) + 'ا';
      } else if (daggerAsAlef) {
        text += 'ا';
        map.push(i);
      }
      continue;
    }
    if (IGNORED.test(ch)) continue;
    const mapped = LETTERS[ch] ?? ch;
    // Espaces multiples réduits à un seul.
    if (mapped === ' ' && text.endsWith(' ')) continue;
    text += mapped;
    map.push(i);
  }
  return { text, map };
};

/** Forme de la requête : mêmes règles, l'alif suscrit éventuellement tapé est un alif. */
export const normalizeQuery = (query: string): string => normalize(query.trim(), true).text.trim();

let index: Array<[Normalized, Normalized]> | null = null;
const getIndex = () => {
  if (!index) index = MUSHAF_VERSES.map((v) => [normalize(v.text, false), normalize(v.text, true)]);
  return index;
};

/** Plage [début, fin[ du texte original à surligner. */
export type MatchRange = [number, number];

export interface VerseMatch {
  verse: MushafVerse;
  ranges: MatchRange[];
}

export interface SearchResult {
  query: string;
  /** Nombre total d'occurrences dans le Coran. */
  occurrences: number;
  matches: VerseMatch[];
}

const findRanges = (n: Normalized, original: string, q: string): MatchRange[] => {
  const ranges: MatchRange[] = [];
  let from = 0;
  for (;;) {
    const at = n.text.indexOf(q, from);
    if (at < 0) break;
    const start = n.map[at];
    let end = n.map[at + q.length - 1] + 1;
    // Inclut les voyelles et signes qui suivent la dernière lettre.
    while (end < original.length && (IGNORED.test(original[end]) || original[end] === DAGGER_ALEF)) end++;
    ranges.push([start, end]);
    from = at + q.length;
  }
  return ranges;
};

export const searchMushaf = (query: string): SearchResult => {
  const q = normalizeQuery(query);
  const result: SearchResult = { query: q, occurrences: 0, matches: [] };
  if (q.length < 2) return result;
  getIndex().forEach(([withoutDagger, withDagger], i) => {
    const verse = MUSHAF_VERSES[i];
    const a = findRanges(withoutDagger, verse.text, q);
    const b = findRanges(withDagger, verse.text, q);
    const ranges = b.length > a.length ? b : a;
    if (ranges.length === 0) return;
    result.occurrences += ranges.length;
    result.matches.push({ verse, ranges });
  });
  return result;
};
