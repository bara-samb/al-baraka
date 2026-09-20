import AsyncStorage from '@react-native-async-storage/async-storage';

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
  try {
    const json = await AsyncStorage.getItem(BOOKMARK_KEY);
    return json ? JSON.parse(json) : null;
  } catch (e) {
    console.error('Erreur getLastReadPosition:', e);
    return null;
  }
};
