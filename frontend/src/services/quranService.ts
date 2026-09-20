import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiResponse, Surah, SurahDetail, SearchOccurrenceStats, SearchOccurrenceItem } from '../types/quran';
import warshTextData from '../data/warshText.json';

const BASE_URL = 'https://api.alquran.cloud/v1';

// Texte réel en riwaya Warsh (source : King Fahd Quran Complex, via qurancomplex.gov.sa),
// embarqué localement car aucune édition "ar.warsh" n'existe réellement sur l'API
// alquran.cloud (elle y retombait silencieusement sur le texte Hafs/Uthmani par défaut).
// Indexé par numéro de sourate (string) -> tableau de versets (index 0 = verset 1).
const WARSH_TEXT: Record<string, string[]> = warshTextData as Record<string, string[]>;

// La Basmala en calligraphie Warsh = le verset 1 d'Al-Fatiha (même formule, même graphie).
export const WARSH_BASMALA = WARSH_TEXT['1'][0];

/**
 * Indique si l'en-tête décoratif "Bismillah" doit être affiché au-dessus des versets
 * d'une sourate : oui pour toutes les sourates SAUF Al-Fatiha (où la Basmala est déjà
 * le verset 1 lui-même) et At-Tawbah/Sourate 9 (seule sourate du Coran sans Basmala,
 * exception bien connue liée à son contexte de révélation).
 */
export const shouldShowBasmalaHeader = (surahNumber: number): boolean =>
  surahNumber !== 1 && surahNumber !== 9;

// In-Memory Cache pour des performances ultra-rapides
let cachedSurahList: Surah[] | null = null;
const cachedSurahDetailsMap = new Map<string, SurahDetail>();

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
      cachedSurahList = JSON.parse(local);
      return cachedSurahList!;
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
    cachedSurahList = json.data;
    AsyncStorage.setItem('@albaraka_surah_list', JSON.stringify(json.data)).catch(() => {});
    return json.data;
  } catch (error) {
    console.error('quranService.getSurahList error:', error);
    throw error;
  }
};

/**
 * Récupère les détails et versets en version WARSH (ورش عن نافع) et leur traduction (français ou anglais).
 * @param surahNumber Numéro de la sourate (1 à 114)
 * @param lang Langue de la traduction ('fr' | 'en')
 */
export const getSurahDetails = async (
  surahNumber: number,
  lang: 'fr' | 'en' = 'fr'
): Promise<SurahDetail> => {
  // "v2" invalide le cache local des utilisateurs ayant déjà l'ancien texte Hafs
  // (l'édition "ar.warsh" utilisée avant n'existait pas réellement côté API).
  const cacheKey = `warsh_v2_${surahNumber}_${lang}`;

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

  try {
    // On récupère la traduction + toutes les métadonnées par verset (juz, page, sajda...)
    // via l'API, mais le TEXTE ARABE vient du jeu de données Warsh embarqué localement.
    const translationEdition = lang === 'en' ? 'en.sahih' : 'fr.hamidullah';
    const response = await fetch(`${BASE_URL}/surah/${surahNumber}/${translationEdition}`);
    if (!response.ok) {
      throw new Error(`Erreur lors de la récupération de la sourate ${surahNumber}: ${response.status}`);
    }
    const json: ApiResponse<SurahDetail> = await response.json();
    const translationData = json.data;
    const warshVerses = WARSH_TEXT[String(surahNumber)];

    const combinedAyahs = translationData.ayahs.map((ayah, index) => ({
      ...ayah,
      text: warshVerses?.[index] || ayah.text,
      translation: ayah.text,
    }));

    const result: SurahDetail = {
      ...translationData,
      ayahs: combinedAyahs,
    };

    cachedSurahDetailsMap.set(cacheKey, result);
    AsyncStorage.setItem(`@albaraka_surah_${cacheKey}`, JSON.stringify(result)).catch(() => {});
    return result;
  } catch (error) {
    console.error(`quranService.getSurahDetails (Warsh) error (Surah ${surahNumber}):`, error);
    throw error;
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

  for (const [surahNumStr, verses] of Object.entries(WARSH_TEXT)) {
    const surahNumber = parseInt(surahNumStr, 10);
    const surahInfo = surahMap.get(surahNumber);
    verses.forEach((verseText, idx) => {
      if (normalizeArabic(verseText).includes(normalizedQuery)) {
        uniqueSurahs.add(surahNumber);
        results.push({
          surahNumber,
          surahName: surahInfo?.name || '',
          englishName: surahInfo?.englishName || '',
          numberInSurah: idx + 1,
          text: verseText,
        });
      }
    });
  }

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
      numberInSurah: m.numberInSurah || 1,
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
