import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureWarshNumbering } from './numberingMigration';

export interface LastReadBookmark {
  surahNumber: number;
  surahName: string;
  englishName: string;
  verseNumber: number;
  updatedAt: number;
}

const BOOKMARK_KEY = '@albaraka_last_read_bookmark';

let listeners: Array<(bookmark: LastReadBookmark | null) => void> = [];

export const subscribeBookmarkChange = (callback: (bookmark: LastReadBookmark | null) => void) => {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((cb) => cb !== callback);
  };
};

const notifyListeners = (bookmark: LastReadBookmark | null) => {
  listeners.forEach((cb) => cb(bookmark));
};

/**
 * Sauvegarde la dernière position de lecture / écoute de l'utilisateur
 */
export const saveLastReadPosition = async (
  surahNumber: number,
  surahName: string,
  englishName: string,
  verseNumber: number = 1
): Promise<void> => {
  // Sinon, une position déjà en numérotation Warsh serait convertie une seconde fois.
  await ensureWarshNumbering();
  const bookmark: LastReadBookmark = {
    surahNumber,
    surahName,
    englishName,
    verseNumber,
    updatedAt: Date.now(),
  };

  try {
    await AsyncStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmark));
    notifyListeners(bookmark);
  } catch (e) {
    console.error('Erreur saveLastReadPosition:', e);
  }
};

/**
 * Récupère le dernier marque-page enregistré
 */
export const getLastReadPosition = async (): Promise<LastReadBookmark | null> => {
  await ensureWarshNumbering();
  try {
    const json = await AsyncStorage.getItem(BOOKMARK_KEY);
    return json ? JSON.parse(json) : null;
  } catch (e) {
    console.error('Erreur getLastReadPosition:', e);
    return null;
  }
};

/**
 * Signet du Mushaf : posé volontairement par l'utilisateur (ruban), distinct de la
 * position "Reprendre la lecture" qui, elle, suit automatiquement la lecture.
 */
export interface MushafBookmark {
  surahNumber: number;
  /** Numérotation du Mushaf Warsh. */
  verseNumber: number;
  page: number;
  updatedAt: number;
}

const MUSHAF_BOOKMARK_KEY = '@albaraka_mushaf_signet';

export const getMushafBookmark = async (): Promise<MushafBookmark | null> => {
  try {
    const json = await AsyncStorage.getItem(MUSHAF_BOOKMARK_KEY);
    return json ? JSON.parse(json) : null;
  } catch (e) {
    console.error('Erreur getMushafBookmark:', e);
    return null;
  }
};

export const saveMushafBookmark = async (surahNumber: number, verseNumber: number, page: number): Promise<MushafBookmark> => {
  const bookmark: MushafBookmark = { surahNumber, verseNumber, page, updatedAt: Date.now() };
  try {
    await AsyncStorage.setItem(MUSHAF_BOOKMARK_KEY, JSON.stringify(bookmark));
  } catch (e) {
    console.error('Erreur saveMushafBookmark:', e);
  }
  return bookmark;
};

export const clearMushafBookmark = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(MUSHAF_BOOKMARK_KEY);
  } catch (e) {
    console.error('Erreur clearMushafBookmark:', e);
  }
};

const MUSHAF_LAST_PAGE_KEY = '@albaraka_mushaf_last_page';

/** Dernière page ouverte dans le Mushaf (pour le rouvrir exactement au même endroit). */
export const getMushafLastPage = async (): Promise<number | null> => {
  try {
    const value = await AsyncStorage.getItem(MUSHAF_LAST_PAGE_KEY);
    return value ? parseInt(value, 10) : null;
  } catch {
    return null;
  }
};

export const saveMushafLastPage = async (page: number): Promise<void> => {
  try {
    await AsyncStorage.setItem(MUSHAF_LAST_PAGE_KEY, String(page));
  } catch (e) {
    console.error('Erreur saveMushafLastPage:', e);
  }
};
