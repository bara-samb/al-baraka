import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiResponse, Ayah, Surah, SurahDetail, SearchOccurrenceStats, SearchOccurrenceItem } from '../types/quran';
import {
  MUSHAF_VERSES,
  WARSH_BASMALA,
  getWarshAyahs,
  hafsToWarsh,
  surahNameAr,
  surahNameLatin,
  surahVerseCount,
  warshToHafs,
} from './warshMushafService';

const BASE_URL = 'https://api.alquran.cloud/v1';

// Le texte arabe ET la numérotation des versets sont ceux du Mushaf Warsh du Complexe Roi Fahd
// (embarqué, voir warshMushafService) : aucune édition Warsh n'existe sur l'API alquran.cloud.
// L'API ne sert qu'aux traductions (numérotées à la Hafs, rattachées via warshToHafs) et aux
// métadonnées des sourates.
export { WARSH_BASMALA };

/**
 * Indique si la Basmala décorative doit être affichée au-dessus des versets : en Warsh elle
 * n'est jamais un verset numéroté (pas même dans Al-Fatiha), donc toujours, sauf pour
 * At-Tawbah (sourate 9), seule sourate du Coran sans Basmala.
 */
export const shouldShowBasmalaHeader = (surahNumber: number): boolean => surahNumber !== 9;

// In-Memory Cache pour des performances ultra-rapides
let cachedSurahList: Surah[] | null = null;
const cachedSurahDetailsMap = new Map<string, SurahDetail>();

/** Remplace le nombre de versets (Hafs côté API) par celui du Mushaf Warsh. */
const withWarshCounts = (list: Surah[]): Surah[] => list.map((s) => ({ ...s, numberOfAyahs: surahVerseCount(s.number) }));

/** Liste minimale construite depuis le Mushaf embarqué (si l'API est injoignable). */
const offlineSurahList = (): Surah[] =>
  Array.from({ length: 114 }, (_, i) => ({
    number: i + 1,
    name: `سورة ${surahNameAr(i + 1)}`,
    englishName: surahNameLatin(i + 1),
    englishNameTranslation: '',
    numberOfAyahs: surahVerseCount(i + 1),
    revelationType: 'Meccan' as const,
  }));

/**
 * Récupère la liste globale des 114 sourates (avec Cache Ultra-Rapide).
 */
export const getSurahList = async (): Promise<Surah[]> => {
  if (cachedSurahList && cachedSurahList.length > 0) {
    return cachedSurahList;
  }

  try {
    const local = await AsyncStorage.getItem('@albaraka_surah_list');
    if (local) {
      cachedSurahList = withWarshCounts(JSON.parse(local));
      return cachedSurahList;
    }
  } catch {
    // Ignorer si pas de cache local
  }

  try {
    const response = await fetch(`${BASE_URL}/surah`);
    if (!response.ok) {
      throw new Error(`Erreur lors de la récupération des sourates: ${response.status}`);
    }
    const json: ApiResponse<Surah[]> = await response.json();
    cachedSurahList = withWarshCounts(json.data);
    AsyncStorage.setItem('@albaraka_surah_list', JSON.stringify(json.data)).catch(() => {});
    return cachedSurahList;
  } catch (error) {
    console.warn('quranService.getSurahList : API injoignable, liste hors ligne utilisée.', error);
    return offlineSurahList();
  }
};

/**
 * Rattache à chaque verset Warsh la traduction des versets Hafs correspondants. Quand un verset
 * Hafs est coupé en plusieurs versets Warsh, sa traduction est donnée au premier, et les
 * suivants y renvoient.
 */
const attachTranslations = (surahNumber: number, ayahs: Ayah[], hafsTranslations: string[]): Ayah[] => {
  let lastHafsGiven = 0;
  let lastWarshWithIt = 0;
  return ayahs.map((ayah) => {
    const [first, last] = warshToHafs(surahNumber, ayah.numberInSurah);
    const from = Math.max(first, lastHafsGiven + 1);
    let translation: string | undefined;
    if (from <= last) {
      translation = hafsTranslations.slice(from - 1, last).join(' ');
      lastHafsGiven = last;
      lastWarshWithIt = ayah.numberInSurah;
    } else if (hafsTranslations.length > 0) {
      translation = `(Traduction réunie avec le verset ${lastWarshWithIt}.)`;
    }
    return { ...ayah, translation };
  });
};

/**
 * Récupère les versets d'une sourate en riwaya WARSH (ورش عن نافع), numérotation du Mushaf Warsh,
 * avec leur traduction (français ou anglais) si l'API est joignable.
 * @param surahNumber Numéro de la sourate (1 à 114)
 * @param lang Langue de la traduction ('fr' | 'en')
 */
export const getSurahDetails = async (
  surahNumber: number,
  lang: 'fr' | 'en' = 'fr'
): Promise<SurahDetail> => {
  // "v3" : numérotation Warsh (les caches v2 étaient numérotés à la Hafs).
  const cacheKey = `warsh_v3_${surahNumber}_${lang}`;

  if (cachedSurahDetailsMap.has(cacheKey)) {
    return cachedSurahDetailsMap.get(cacheKey)!;
  }

  try {
    const local = await AsyncStorage.getItem(`@albaraka_surah_${cacheKey}`);
    if (local) {
      const parsed: SurahDetail = JSON.parse(local);
      cachedSurahDetailsMap.set(cacheKey, parsed);
      return parsed;
    }
  } catch {
    // Ignorer si pas de cache
  }

  const warshAyahs = getWarshAyahs(surahNumber);
  try {
    const translationEdition = lang === 'en' ? 'en.sahih' : 'fr.hamidullah';
    const response = await fetch(`${BASE_URL}/surah/${surahNumber}/${translationEdition}`);
    if (!response.ok) {
      throw new Error(`Erreur lors de la récupération de la sourate ${surahNumber}: ${response.status}`);
    }
    const json: ApiResponse<SurahDetail> = await response.json();
    const { ayahs: hafsAyahs, ...meta } = json.data;

    const result: SurahDetail = {
      ...meta,
      numberOfAyahs: warshAyahs.length,
      ayahs: attachTranslations(surahNumber, warshAyahs, hafsAyahs.map((a) => a.text)),
    };

    cachedSurahDetailsMap.set(cacheKey, result);
    AsyncStorage.setItem(`@albaraka_surah_${cacheKey}`, JSON.stringify(result)).catch(() => {});
    return result;
  } catch (error) {
    // Hors ligne : le texte Warsh est embarqué, on l'affiche sans traduction (non mis en cache).
    console.warn(`quranService.getSurahDetails : traduction indisponible (sourate ${surahNumber}).`, error);
    const meta = (await getSurahList()).find((s) => s.number === surahNumber) ?? offlineSurahList()[surahNumber - 1];
    return { ...meta, numberOfAyahs: warshAyahs.length, ayahs: warshAyahs };
  }
};

/**
 * Retire les diacritiques (tashkeel) et normalise les variantes de lettres arabes,
 * pour permettre une recherche insensible aux voyelles courtes (ex: rechercher "\u0627\u0644\u0631\u062D\u0645\u0646"
 * sans avoir \u00E0 taper les diacritiques du texte Warsh embarqu\u00E9).
 */
const normalizeArabic = (text: string): string =>
  text
    .replace(/\p{Mn}/gu, '') // diacritiques / signes combinants (tashkeel, marques Warsh)
    .replace(/\u0640/g, '') // tatwil
    .replace(/[\u0625\u0623\u0622\u0671]/g, '\u0627')
    .replace(/\u0649/g, '\u064A')
    .replace(/\u0629/g, '\u0647');

/**
 * Recherche locale dans le texte Warsh embarqu\u00E9 (aucune \u00E9dition "ar.warsh" n'existe c\u00F4t\u00E9 API).
 */
const searchArabicLocally = async (query: string): Promise<SearchOccurrenceStats> => {
  const normalizedQuery = normalizeArabic(query);
  const surahList = await getSurahList();
  const surahMap = new Map(surahList.map((s) => [s.number, s]));

  const results: SearchOccurrenceItem[] = [];
  const uniqueSurahs = new Set<number>();

  MUSHAF_VERSES.forEach((verse) => {
    if (!normalizeArabic(verse.text).includes(normalizedQuery)) return;
    const surahInfo = surahMap.get(verse.surah);
    uniqueSurahs.add(verse.surah);
    results.push({
      surahNumber: verse.surah,
      surahName: surahInfo?.name || '',
      englishName: surahInfo?.englishName || '',
      numberInSurah: verse.ayah,
      text: verse.text,
    });
  });

  results.sort((a, b) => a.surahNumber - b.surahNumber || a.numberInSurah - b.numberInSurah);

  return {
    query,
    totalOccurrences: results.length,
    totalSurahs: uniqueSurahs.size,
    results,
  };
};

/**
 * Recherche de mots ou expressions dans tout le Coran avec statistiques (Riwaya Warsh / Traduction)
 */
export const searchQuranOccurrences = async (query: string): Promise<SearchOccurrenceStats> => {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      query: '',
      totalOccurrences: 0,
      totalSurahs: 0,
      results: [],
    };
  }

  const isArabic = /[\u0600-\u06FF]/.test(trimmed);
  if (isArabic) {
    return searchArabicLocally(trimmed);
  }

  try {
    const response = await fetch(`${BASE_URL}/search/${encodeURIComponent(trimmed)}/all/fr.hamidullah`);
    if (!response.ok) {
      const fallbackResp = await fetch(`${BASE_URL}/search/${encodeURIComponent(trimmed)}/all/en.sahih`);
      if (!fallbackResp.ok) {
        return { query: trimmed, totalOccurrences: 0, totalSurahs: 0, results: [] };
      }
      const fallbackJson = await fallbackResp.json();
      return formatSearchResults(trimmed, fallbackJson.data);
    }

    const json = await response.json();
    return formatSearchResults(trimmed, json.data);
  } catch (error) {
    console.error('Erreur searchQuranOccurrences:', error);
    return {
      query: trimmed,
      totalOccurrences: 0,
      totalSurahs: 0,
      results: [],
    };
  }
};

const formatSearchResults = (query: string, data: any): SearchOccurrenceStats => {
  if (!data || !data.matches || !Array.isArray(data.matches)) {
    return { query, totalOccurrences: 0, totalSurahs: 0, results: [] };
  }

  const matches = data.matches;
  const uniqueSurahs = new Set<number>();
  const results: SearchOccurrenceItem[] = matches.map((m: any) => {
    if (m.surah && m.surah.number) {
      uniqueSurahs.add(m.surah.number);
    }
    return {
      surahNumber: m.surah?.number || 1,
      surahName: m.surah?.name || 'سورة',
      englishName: m.surah?.englishName || 'Surah',
      // Résultat de l'API numéroté à la Hafs : converti vers la numérotation Warsh.
      numberInSurah: hafsToWarsh(m.surah?.number || 1, m.numberInSurah || 1),
      text: m.text || '',
      translation: m.edition?.language === 'fr' || m.edition?.language === 'en' ? m.text : undefined,
    };
  });

  return {
    query,
    totalOccurrences: data.count || matches.length,
    totalSurahs: uniqueSurahs.size,
    results,
  };
};
