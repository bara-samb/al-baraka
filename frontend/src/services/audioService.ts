import { Audio, AVPlaybackStatus } from 'expo-av';
import ayahTimingsData from '../data/ayahTimings.json';

interface AyahTimingEntry {
  totalDuration: number;
  startSeconds: number[];
}

// Timestamps par verset (numérotation du Mushaf Warsh) générés par détection des pauses du
// récitateur alignée sur le texte (voir backend/scripts/generate-ayah-timings.js).
// Clé = numéro de sourate (string).
const AYAH_TIMINGS = ayahTimingsData as Record<string, AyahTimingEntry>;

export interface SoundStatus {
  isPlaying: boolean;
  position: number; // en secondes
  duration: number; // en secondes
  isLoaded: boolean;
  error?: string;
}

let currentSound: Audio.Sound | null = null;
let currentListeners: Array<(status: SoundStatus) => void> = [];
// Position (s) à laquelle mettre en pause automatiquement, pour confiner la lecture à un
// seul verset (voir playAyahOnly). null = lecture normale, sans limite.
let stopAtSeconds: number | null = null;

/**
 * Bornes précises (en secondes) d'un verset au sein du fichier audio de sa sourate,
 * d'après les timestamps générés par détection de pause. Retourne null si la sourate
 * n'a pas (encore) de données précises.
 */
export const getAyahBoundsSeconds = (
  surahNumber: number,
  numberInSurah: number
): { startSec: number; endSec: number } | null => {
  const timing = AYAH_TIMINGS[String(surahNumber)];
  const startSec = timing?.startSeconds?.[numberInSurah - 1];
  if (!timing || startSec === undefined) return null;
  const endSec = timing.startSeconds[numberInSurah] ?? timing.totalDuration;
  return { startSec, endSec };
};

/**
 * Numéro du verset en cours de récitation à une position donnée du fichier de la sourate
 * (pour surligner le verset pendant la lecture). null si pas de minutage pour la sourate.
 */
export const getAyahAtPosition = (
  surahNumber: number,
  positionSec: number
): number | null => {
  const starts = AYAH_TIMINGS[String(surahNumber)]?.startSeconds;
  if (!starts || starts.length === 0) return null;
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= positionSec) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
};

/**
 * Estime la fraction (0 à 1) de la durée totale d'une sourate à laquelle commence
 * un verset donné, en répartissant la durée uniformément sur le nombre de versets.
 * Approximation grossière utilisée en dernier recours (sourate absente de AYAH_TIMINGS).
 */
export const estimateAyahStartRatio = (numberInSurah: number, totalAyahsInSurah: number): number => {
  if (totalAyahsInSurah <= 1) return 0;
  return Math.max(0, Math.min(1, (numberInSurah - 1) / totalAyahsInSurah));
};

/**
 * Fraction (0 à 1) de la durée totale à laquelle commence un verset donné.
 * Utilise en priorité les timestamps générés par détection de pause (précis, voir
 * backend/scripts/generate-ayah-timings.js) ; retombe sur une estimation linéaire
 * uniquement si la sourate n'a pas encore été traitée.
 */
export const getAyahStartRatio = (
  surahNumber: number,
  numberInSurah: number,
  totalAyahsInSurah?: number
): number => {
  const timing = AYAH_TIMINGS[String(surahNumber)];
  const preciseStart = timing?.startSeconds?.[numberInSurah - 1];
  if (timing && preciseStart !== undefined && timing.totalDuration > 0) {
    return Math.max(0, Math.min(1, preciseStart / timing.totalDuration));
  }
  if (!totalAyahsInSurah) return 0;
  return estimateAyahStartRatio(numberInSurah, totalAyahsInSurah);
};

/**
 * Initialise les paramètres audio d'arrière-plan pour Expo
 */
export const initAudioMode = async (): Promise<void> => {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch (error) {
    console.error('Erreur initAudioMode Expo AV:', error);
  }
};

/**
 * S'abonne aux mises à jour de statut de la lecture audio
 */
export const subscribeAudioStatus = (callback: (status: SoundStatus) => void) => {
  currentListeners.push(callback);
  return () => {
    currentListeners = currentListeners.filter((cb) => cb !== callback);
  };
};

const notifyListeners = (status: SoundStatus) => {
  currentListeners.forEach((cb) => cb(status));
};

/**
 * Charge et joue un fichier audio distant via une URL MP3.
 * @param startRatio Position de départ en fraction de la durée totale (0 à 1). Permet de
 * démarrer la lecture d'un fichier audio de sourate complète à un instant estimé
 * (ex: pour cibler approximativement un verset précis, faute de fichiers audio
 * segmentés par verset).
 * Retourne true en cas de succès, false si le fichier n'a pas pu être chargé (ex: 404).
 */
export const playAudioTrack = async (url: string, startRatio: number = 0): Promise<boolean> => {
  stopAtSeconds = null; // lecture normale : pas de limite de fin
  try {
    await stopAudioTrack();
    await initAudioMode();

    const { sound, status } = await Audio.Sound.createAsync(
      { uri: url },
      { shouldPlay: true },
      onPlaybackStatusUpdate
    );

    currentSound = sound;

    if (startRatio > 0 && status.isLoaded && status.durationMillis) {
      const clampedRatio = Math.max(0, Math.min(startRatio, 1));
      await sound.setPositionAsync(status.durationMillis * clampedRatio);
    }

    return true;
  } catch (error: any) {
    console.warn(`Audio non disponible ou introuvable : ${url}`);
    notifyListeners({
      isPlaying: false,
      position: 0,
      duration: 0,
      isLoaded: false,
      error: 'Audio indisponible (Vérifiez le serveur backend)',
    });
    return false;
  }
};

/**
 * Joue UN SEUL verset : démarre à son instant de départ précis et se met en pause
 * automatiquement à son instant de fin, sans déborder sur le verset précédent ou suivant.
 * Retourne true en cas de succès, false si le fichier n'a pas pu être chargé ou si aucune
 * donnée de minutage n'est disponible pour ce verset.
 */
export const playAyahOnly = async (
  url: string,
  surahNumber: number,
  numberInSurah: number
): Promise<boolean> => {
  const bounds = getAyahBoundsSeconds(surahNumber, numberInSurah);
  if (!bounds) {
    // Pas de données précises pour cette sourate : on ne peut pas garantir une limite
    // fiable, donc on ne joue pas à l'aveugle (mieux vaut échouer explicitement).
    return false;
  }

  try {
    await stopAudioTrack();
    await initAudioMode();

    const { sound } = await Audio.Sound.createAsync(
      { uri: url },
      { shouldPlay: true, positionMillis: Math.max(0, bounds.startSec * 1000) },
      onPlaybackStatusUpdate
    );

    currentSound = sound;
    stopAtSeconds = bounds.endSec;

    return true;
  } catch (error: any) {
    console.warn(`Audio non disponible ou introuvable : ${url}`);
    notifyListeners({
      isPlaying: false,
      position: 0,
      duration: 0,
      isLoaded: false,
      error: 'Audio indisponible (Vérifiez le serveur backend)',
    });
    return false;
  }
};

let finishListeners: Array<() => void> = [];

export const subscribeTrackFinish = (callback: () => void) => {
  finishListeners.push(callback);
  return () => {
    finishListeners = finishListeners.filter((cb) => cb !== callback);
  };
};

const notifyFinishListeners = () => {
  finishListeners.forEach((cb) => cb());
};

export const setIsLoopingTrack = async (isLooping: boolean): Promise<void> => {
  if (!currentSound) return;
  try {
    await currentSound.setIsLoopingAsync(isLooping);
  } catch (error) {
    console.error('Erreur setIsLoopingTrack:', error);
  }
};

const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
  if (status.isLoaded) {
    const positionSec = status.positionMillis / 1000;

    if (stopAtSeconds !== null && status.isPlaying && positionSec >= stopAtSeconds) {
      const boundary = stopAtSeconds;
      stopAtSeconds = null;
      currentSound?.pauseAsync().catch(() => {});
      notifyListeners({
        isPlaying: false,
        position: boundary,
        duration: (status.durationMillis || 0) / 1000,
        isLoaded: true,
      });
      return;
    }

    notifyListeners({
      isPlaying: status.isPlaying,
      position: positionSec,
      duration: (status.durationMillis || 0) / 1000,
      isLoaded: true,
    });

    if (status.didJustFinish && !status.isLooping) {
      notifyFinishListeners();
    }
  } else if ('error' in status && status.error) {
    console.warn('Erreur statut audio:', status.error);
    notifyListeners({
      isPlaying: false,
      position: 0,
      duration: 0,
      isLoaded: false,
      error: status.error,
    });
  }
};


/**
 * Alterne entre Lecture et Pause
 */
export const togglePlayPause = async (): Promise<void> => {
  if (!currentSound) return;
  try {
    const status = await currentSound.getStatusAsync();
    if (status.isLoaded) {
      if (status.isPlaying) {
        await currentSound.pauseAsync();
      } else {
        await currentSound.playAsync();
      }
    }
  } catch (error) {
    console.error('Erreur togglePlayPause:', error);
  }
};

/**
 * Avance ou recule la lecture de X secondes
 */
export const seekBy = async (secondsDelta: number): Promise<void> => {
  if (!currentSound) return;
  stopAtSeconds = null; // un seek manuel sort du mode "verset unique"
  try {
    const status = await currentSound.getStatusAsync();
    if (status.isLoaded) {
      const newPos = Math.max(0, Math.min(status.positionMillis + secondsDelta * 1000, status.durationMillis || 0));
      await currentSound.setPositionAsync(newPos);
    }
  } catch (error) {
    console.error('Erreur seekBy:', error);
  }
};

/**
 * Se déplace à une position exacte (en secondes)
 */
export const seekToPosition = async (seconds: number): Promise<void> => {
  if (!currentSound) return;
  stopAtSeconds = null; // un seek manuel sort du mode "verset unique"
  try {
    const status = await currentSound.getStatusAsync();
    if (status.isLoaded) {
      const newPos = Math.max(0, Math.min(seconds * 1000, status.durationMillis || 0));
      await currentSound.setPositionAsync(newPos);
    }
  } catch (error) {
    console.error('Erreur seekToPosition:', error);
  }
};

/**
 * Modifie la vitesse de lecture (ex: 0.5, 1.0, 1.25, 1.5, 2.0)
 */
export const setPlaybackRate = async (rate: number): Promise<void> => {
  if (!currentSound) return;
  try {
    await currentSound.setRateAsync(rate, true);
  } catch (error) {
    console.error('Erreur setPlaybackRate:', error);
  }
};

/**
 * Arrête et décharge la piste audio actuelle
 */
export const stopAudioTrack = async (): Promise<void> => {
  stopAtSeconds = null;
  if (currentSound) {
    try {
      await currentSound.stopAsync();
      await currentSound.unloadAsync();
    } catch {}
    currentSound = null;
    notifyListeners({ isPlaying: false, position: 0, duration: 0, isLoaded: false });
  }
};

