import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiResponse, Ayah, Surah, SurahDetail, SearchOccurrenceStats, SearchOccurrenceItem } from '../types/quran';
import {
  MUSHAF_VERSES,
  WARSH_BASMALA,
  getMushafVerse,
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

/** Vrai si le navigateur se sait hors ligne : inutile alors d'attendre le réseau. */
const isOffline = (): boolean => typeof navigator !== 'undefined' && navigator.onLine === false;

/**
 * fetch abandonné au bout de `ms` millisecondes : avec une connexion très faible, l'app
 * retombe vite sur le hors-ligne au lieu de rester bloquée sur un chargement.
 */
const fetchWithTimeout = async (url: string, ms = 6000): Promise<Response> => {
  if (isOffline()) throw new Error('Hors ligne');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

// Traduction complète du Coran gardée sur l'appareil (téléchargée une fois, ~400 Ko) :
// sourates, partage et recherche en français fonctionnent alors hors ligne et sans attente.
// Pour chaque sourate, les versets numérotés à la Hafs (index 0 = sourate 1).
type TranslationStore = string[][];
const STORE_KEY = (lang: 'fr' | 'en') => `@albaraka_translation_${lang}`;
const EDITION = { fr: 'fr.hamidullah', en: 'en.sahih' } as const;
const translationStores = new Map<'fr' | 'en', Promise<TranslationStore | null>>();

const loadTranslationStore = (lang: 'fr' | 'en'): Promise<TranslationStore | null> => {
  let pending = translationStores.get(lang);
  if (!pending) {
    pending = AsyncStorage.getItem(STORE_KEY(lang))
      .then((raw) => (raw ? (JSON.parse(raw) as TranslationStore) : null))
      .catch(() => null);
    translationStores.set(lang, pending);
  }
  return pending;
};

/**
 * Télécharge et garde la traduction complète si elle manque. Appelé au démarrage, en tâche
 * de fond ; sans effet hors ligne (nouvel essai au prochain lancement).
 */
export const ensureOfflineTranslation = async (lang: 'fr' | 'en' = 'fr'): Promise<void> => {
  if (await loadTranslationStore(lang)) return;
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/quran/${EDITION[lang]}`, 60000);
    if (!response.ok) return;
    const json: ApiResponse<{ surahs: { ayahs: { text: string }[] }[] }> = await response.json();
    const store: TranslationStore = json.data.surahs.map((s) => s.ayahs.map((a) => a.text));
    if (store.length !== 114) return;
    // Les anciens caches sourate par sourate (texte arabe compris) deviennent inutiles :
    // ils sont retirés pour laisser la place (stockage du navigateur limité).
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(`@albaraka_surah_warsh_v3_`) && k.endsWith(`_${lang}`)));
    await AsyncStorage.setItem(STORE_KEY(lang), JSON.stringify(store));
    translationStores.set(lang, Promise.resolve(store));
  } catch (e) {
    console.warn(`ensureOfflineTranslation(${lang}) : non téléchargée pour l'instant.`, e);
  }
};

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
    const response = await fetchWithTimeout(`${BASE_URL}/surah`);
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

  // Traduction complète déjà sur l'appareil : rien à télécharger.
  const store = await loadTranslationStore(lang);
  if (store?.[surahNumber - 1]) {
    const warsh = getWarshAyahs(surahNumber);
    const meta = (await getSurahList()).find((s) => s.number === surahNumber) ?? offlineSurahList()[surahNumber - 1];
    const result: SurahDetail = {
      ...meta,
      numberOfAyahs: warsh.length,
      ayahs: attachTranslations(surahNumber, warsh, store[surahNumber - 1]),
    };
    cachedSurahDetailsMap.set(cacheKey, result);
    return result;
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
    const response = await fetchWithTimeout(`${BASE_URL}/surah/${surahNumber}/${translationEdition}`);
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

// Texte Warsh normalisé, calculé à la première recherche puis réutilisé.
let normalizedVerses: string[] | null = null;

/** Minuscules sans accents, pour une recherche française tolérante. */
const normalizeLatin = (text: string): string => text.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase();

/**
 * Recherche dans la traduction gardée sur l'appareil (hors ligne, instantanée). Les versets
 * trouvés (numérotés à la Hafs) sont présentés avec le texte Warsh qui les contient.
 */
const searchTranslationLocally = async (query: string, store: TranslationStore): Promise<SearchOccurrenceStats> => {
  const needle = normalizeLatin(query);
  const surahMap = new Map((await getSurahList()).map((s) => [s.number, s]));
  const results: SearchOccurrenceItem[] = [];
  const uniqueSurahs = new Set<number>();
  store.forEach((ayahs, i) => {
    const surah = i + 1;
    ayahs.forEach((translation, j) => {
      if (!normalizeLatin(translation).includes(needle)) return;
      const ayah = hafsToWarsh(surah, j + 1);
      uniqueSurahs.add(surah);
      results.push({
        surahNumber: surah,
        surahName: surahMap.get(surah)?.name || '',
        englishName: surahMap.get(surah)?.englishName || '',
        numberInSurah: ayah,
        text: getMushafVerse(surah, ayah)?.text || '',
        translation,
      });
    });
  });
  return { query, totalOccurrences: results.length, totalSurahs: uniqueSurahs.size, results };
};

/**
 * Recherche locale dans le texte Warsh embarqu\u00E9 (aucune \u00E9dition "ar.warsh" n'existe c\u00F4t\u00E9 API).
 */
const searchArabicLocally = async (query: string): Promise<SearchOccurrenceStats> => {
  const normalizedQuery = normalizeArabic(query);
  const surahList = await getSurahList();
  const surahMap = new Map(surahList.map((s) => [s.number, s]));

  const results: SearchOccurrenceItem[] = [];
  const uniqueSurahs = new Set<number>();

  normalizedVerses ??= MUSHAF_VERSES.map((v) => normalizeArabic(v.text));
  const texts = normalizedVerses;
  MUSHAF_VERSES.forEach((verse, i) => {
    if (!texts[i].includes(normalizedQuery)) return;
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

  const store = await loadTranslationStore('fr');
  if (store) {
    return searchTranslationLocally(trimmed, store);
  }

  try {
    const response = await fetchWithTimeout(`${BASE_URL}/search/${encodeURIComponent(trimmed)}/all/fr.hamidullah`);
    if (!response.ok) {
      const fallbackResp = await fetchWithTimeout(`${BASE_URL}/search/${encodeURIComponent(trimmed)}/all/en.sahih`);
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

/**
 * Traduction française (Hamidullah) d'un verset Warsh : les versets Hafs correspondants,
 * réunis. null si l'API est injoignable.
 */
export const getFrenchVerseTranslation = async (surahNumber: number, warshAyah: number): Promise<string | null> => {
  const [first, last] = warshToHafs(surahNumber, warshAyah);
  const store = await loadTranslationStore('fr');
  const stored = store?.[surahNumber - 1]?.slice(first - 1, last);
  if (stored?.length) return stored.join(' ');
  try {
    const parts = await Promise.all(
      Array.from({ length: last - first + 1 }, (_, i) =>
        fetchWithTimeout(`${BASE_URL}/ayah/${surahNumber}:${first + i}/fr.hamidullah`)
          .then((r) => r.json())
          .then((json: ApiResponse<{ text: string }>) => json.data.text)
      )
    );
    return parts.join(' ');
  } catch (e) {
    console.warn('getFrenchVerseTranslation : API injoignable.', e);
    return null;
  }
};
