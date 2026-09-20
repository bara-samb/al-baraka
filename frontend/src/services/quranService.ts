import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiResponse, Surah, SurahDetail, SearchOccurrenceStats, SearchOccurrenceItem } from '../types/quran';

const BASE_URL = 'https://api.alquran.cloud/v1';

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
  const cacheKey = `warsh_${surahNumber}_${lang}`;

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
    const translationEdition = lang === 'en' ? 'en.sahih' : 'fr.hamidullah';
    const response = await fetch(`${BASE_URL}/surah/${surahNumber}/editions/ar.warsh,${translationEdition}`);
    if (response.ok) {
      const json: ApiResponse<SurahDetail[]> = await response.json();
      if (Array.isArray(json.data) && json.data.length >= 2) {
        const warshData = json.data[0];
        const translationData = json.data[1];

        const combinedAyahs = warshData.ayahs.map((ayah, index) => ({
          ...ayah,
          translation: translationData.ayahs[index]?.text || '',
        }));

        const result: SurahDetail = {
          ...warshData,
          ayahs: combinedAyahs,
        };

        cachedSurahDetailsMap.set(cacheKey, result);
        AsyncStorage.setItem(`@albaraka_surah_${cacheKey}`, JSON.stringify(result)).catch(() => {});
        return result;
      }
    }

    // Fallback si l'édition combinée rencontre un souci
    const fallbackResponse = await fetch(`${BASE_URL}/surah/${surahNumber}/ar.warsh`);
    if (!fallbackResponse.ok) {
      throw new Error(`Erreur lors de la récupération Warsh de la sourate ${surahNumber}`);
    }
    const fallbackJson: ApiResponse<SurahDetail> = await fallbackResponse.json();
    cachedSurahDetailsMap.set(cacheKey, fallbackJson.data);
    return fallbackJson.data;
  } catch (error) {
    console.error(`quranService.getSurahDetails (Warsh) error (Surah ${surahNumber}):`, error);
    throw error;
  }
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

  try {
    const isArabic = /[\u0600-\u06FF]/.test(trimmed);
    const edition = isArabic ? 'ar.warsh' : 'fr.hamidullah';

    const response = await fetch(`${BASE_URL}/search/${encodeURIComponent(trimmed)}/all/${edition}`);
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
