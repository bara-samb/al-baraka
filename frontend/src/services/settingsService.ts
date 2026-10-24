import AsyncStorage from '@react-native-async-storage/async-storage';

const ARABIC_FONT_SIZE_KEY = '@albaraka_arabic_font_size';

export const DEFAULT_ARABIC_FONT_SIZE = 28;
export const MIN_ARABIC_FONT_SIZE = 18;
export const MAX_ARABIC_FONT_SIZE = 38;

let listeners: Array<(size: number) => void> = [];

export const subscribeFontSizeChange = (callback: (size: number) => void) => {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((cb) => cb !== callback);
  };
};

const notifyListeners = (size: number) => {
  listeners.forEach((cb) => cb(size));
};

/**
 * Récupère la taille de la police de caractères arabes
 */
export const getArabicFontSize = async (): Promise<number> => {
  try {
    const val = await AsyncStorage.getItem(ARABIC_FONT_SIZE_KEY);
    if (val !== null) {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed) && parsed >= MIN_ARABIC_FONT_SIZE && parsed <= MAX_ARABIC_FONT_SIZE) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Erreur getArabicFontSize:', e);
  }
  return DEFAULT_ARABIC_FONT_SIZE;
};

/**
 * Définit la taille de la police de caractères arabes
 */
export const setArabicFontSize = async (newSize: number): Promise<number> => {
  const clampedSize = Math.max(MIN_ARABIC_FONT_SIZE, Math.min(MAX_ARABIC_FONT_SIZE, newSize));
  try {
    await AsyncStorage.setItem(ARABIC_FONT_SIZE_KEY, clampedSize.toString());
    notifyListeners(clampedSize);
  } catch (e) {
    console.error('Erreur setArabicFontSize:', e);
  }
  return clampedSize;
};
