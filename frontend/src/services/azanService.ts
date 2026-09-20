import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPrayerTimes } from './prayerService';
import { stopAudioTrack } from './audioService';
import { getAzanAudioUrl } from '../config/audioConfig';
import { PrayerTimings } from '../types/quran';

const AZAN_ENABLED_KEY = '@albaraka_azan_enabled';

// Les 5 prières où l'azan doit sonner (hors lever du soleil, qui n'est pas un appel à la prière).
const AZAN_PRAYER_KEYS: Array<keyof PrayerTimings> = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

export const getAzanEnabled = async (): Promise<boolean> => {
  try {
    const val = await AsyncStorage.getItem(AZAN_ENABLED_KEY);
    return val === 'true';
  } catch {
    return false;
  }
};

export const setAzanEnabled = async (enabled: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(AZAN_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch (e) {
    console.error('Erreur setAzanEnabled:', e);
  }
};

let azanSound: Audio.Sound | null = null;

/**
 * Joue le fichier audio de l'azan (mis en pause si une récitation du Coran est en cours).
 * Retourne false si le fichier n'est pas disponible côté serveur (pas encore téléversé).
 */
export const playAzan = async (): Promise<boolean> => {
  try {
    await stopAudioTrack(); // ne pas superposer à une récitation en cours
    if (azanSound) {
      await azanSound.unloadAsync().catch(() => {});
      azanSound = null;
    }
    const { sound } = await Audio.Sound.createAsync(
      { uri: getAzanAudioUrl() },
      { shouldPlay: true }
    );
    azanSound = sound;
    return true;
  } catch (error) {
    console.warn('Azan indisponible (fichier non téléversé sur le serveur ?) :', error);
    return false;
  }
};

// Clé du dernier créneau de prière pour lequel l'azan a déjà sonné aujourd'hui
// (évite de le rejouer en boucle tant qu'on reste dans la même minute/le même jour).
let lastTriggeredSlot: string | null = null;
let cachedTimings: PrayerTimings | null = null;
let cachedTimingsDate: string | null = null;

const todayKey = (): string => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

const getTodayTimings = async (): Promise<PrayerTimings> => {
  const today = todayKey();
  if (cachedTimings && cachedTimingsDate === today) {
    return cachedTimings;
  }
  cachedTimings = await getPrayerTimes();
  cachedTimingsDate = today;
  return cachedTimings;
};

/**
 * Vérifie si l'heure actuelle correspond (à la minute près) à l'une des 5 prières,
 * et déclenche l'azan une seule fois par créneau.
 */
const checkAndTriggerAzan = async (): Promise<void> => {
  const enabled = await getAzanEnabled();
  if (!enabled) return;

  const timings = await getTodayTimings();
  const now = new Date();
  const nowHM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  for (const key of AZAN_PRAYER_KEYS) {
    const timeStr = (timings[key] || '').split(' ')[0];
    if (timeStr !== nowHM) continue;

    const slot = `${todayKey()}_${key}`;
    if (lastTriggeredSlot === slot) continue; // déjà déclenché pour ce créneau

    lastTriggeredSlot = slot;
    playAzan();
    break;
  }
};

let watcherInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Démarre la surveillance périodique des heures de prière pour déclencher l'azan
 * automatiquement. À appeler une fois au niveau racine de l'app (voir App.tsx).
 */
export const startAzanWatcher = (): (() => void) => {
  if (watcherInterval) return () => {};
  checkAndTriggerAzan();
  watcherInterval = setInterval(checkAndTriggerAzan, 20 * 1000);
  return () => {
    if (watcherInterval) {
      clearInterval(watcherInterval);
      watcherInterval = null;
    }
  };
};
