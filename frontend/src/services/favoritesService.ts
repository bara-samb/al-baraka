import AsyncStorage from '@react-native-async-storage/async-storage';
import { Surah, Ayah } from '../types/quran';
import { ensureWarshNumbering } from './numberingMigration';
import { getWarshAyahs, surahNameAr, surahNameLatin } from './warshMushafService';

export interface FavoriteAyahItem {
  ayah: Ayah;
  surahNumber: number;
  surahName: string;
  englishName: string;
}

const FAVORITE_SURAHS_KEY = '@albaraka_fav_surahs';
const FAVORITE_AYAHS_KEY = '@albaraka_fav_ayahs';

let listeners: Array<() => void> = [];

export const subscribeFavoritesChange = (listener: () => void) => {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
};

const notifyListeners = () => {
  listeners.forEach((l) => l());
};

/**
 * Récupère toutes les sourates favorites
 */
export const getFavoriteSurahs = async (): Promise<Surah[]> => {
  try {
    const json = await AsyncStorage.getItem(FAVORITE_SURAHS_KEY);
    return json ? JSON.parse(json) : [];
  } catch (e) {
    console.error('Erreur getFavoriteSurahs:', e);
    return [];
  }
};

/**
 * Vérifie si une sourate est en favori
 */
export const isSurahFavorite = async (surahNumber: number): Promise<boolean> => {
  const list = await getFavoriteSurahs();
  return list.some((s) => s.number === surahNumber);
};

/**
 * Bascule le statut favori d'une sourate
 */
export const toggleFavoriteSurah = async (surah: Surah): Promise<boolean> => {
  try {
    const list = await getFavoriteSurahs();
    const exists = list.some((s) => s.number === surah.number);
    let updatedList: Surah[];

    if (exists) {
      updatedList = list.filter((s) => s.number !== surah.number);
    } else {
      updatedList = [...list, surah];
    }

    await AsyncStorage.setItem(FAVORITE_SURAHS_KEY, JSON.stringify(updatedList));
    notifyListeners();
    return !exists;
  } catch (e) {
    console.error('Erreur toggleFavoriteSurah:', e);
    return false;
  }
};

/**
 * Récupère tous les versets favoris
 */
export const getFavoriteAyahs = async (): Promise<FavoriteAyahItem[]> => {
  await ensureWarshNumbering();
  try {
    const json = await AsyncStorage.getItem(FAVORITE_AYAHS_KEY);
    return json ? JSON.parse(json) : [];
  } catch (e) {
    console.error('Erreur getFavoriteAyahs:', e);
    return [];
  }
};

/**
 * Vérifie si un verset est en favori
 */
export const isAyahFavorite = async (globalAyahNumber: number): Promise<boolean> => {
  const list = await getFavoriteAyahs();
  return list.some((item) => item.ayah.number === globalAyahNumber);
};

/**
 * Bascule le statut favori d'un verset
 */
export const toggleFavoriteAyah = async (item: FavoriteAyahItem): Promise<boolean> => {
  try {
    const list = await getFavoriteAyahs();
    const exists = list.some((i) => i.ayah.number === item.ayah.number);
    let updatedList: FavoriteAyahItem[];

    if (exists) {
      updatedList = list.filter((i) => i.ayah.number !== item.ayah.number);
    } else {
      updatedList = [...list, item];
    }

    await AsyncStorage.setItem(FAVORITE_AYAHS_KEY, JSON.stringify(updatedList));
    notifyListeners();
    return !exists;
  } catch (e) {
    console.error('Erreur toggleFavoriteAyah:', e);
    return false;
  }
};

/** Le verset (numérotation Warsh) est-il dans les favoris ? */
export const isVerseFavorite = async (surah: number, ayah: number): Promise<boolean> => {
  const list = await getFavoriteAyahs();
  return list.some((i) => i.surahNumber === surah && i.ayah.numberInSurah === ayah);
};

/**
 * Ajoute ou retire un verset du Mushaf (numérotation Warsh) des favoris. La traduction, si on
 * l'a, est gardée pour l'afficher dans la liste. Retourne le nouvel état.
 */
export const toggleFavoriteVerse = async (surah: number, ayah: number, translation?: string | null): Promise<boolean> => {
  const warshAyah = getWarshAyahs(surah)[ayah - 1];
  if (!warshAyah) return false;
  return toggleFavoriteAyah({
    ayah: translation ? { ...warshAyah, translation } : warshAyah,
    surahNumber: surah,
    surahName: surahNameAr(surah),
    englishName: surahNameLatin(surah),
  });
};
