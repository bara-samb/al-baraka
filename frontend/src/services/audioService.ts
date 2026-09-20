import { Audio, AVPlaybackStatus } from 'expo-av';
import ayahTimingsData from '../data/ayahTimings.json';

interface AyahTimingEntry {
  totalDuration: number;
  startSeconds: number[];
}

// Timestamps par verset générés par détection automatique des pauses du récitateur
// (voir backend/scripts/generate-ayah-timings.js). Clé = numéro de sourate (string).
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
  totalAyahsInSurah: number
): number => {
  const timing = AYAH_TIMINGS[String(surahNumber)];
  const preciseStart = timing?.startSeconds?.[numberInSurah - 1];
  if (timing && preciseStart !== undefined && timing.totalDuration > 0) {
    return Math.max(0, Math.min(1, preciseStart / timing.totalDuration));
  }
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
    notifyListeners({
      isPlaying: status.isPlaying,
      position: status.positionMillis / 1000,
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
  if (currentSound) {
    try {
      await currentSound.stopAsync();
      await currentSound.unloadAsync();
    } catch {}
    currentSound = null;
    notifyListeners({ isPlaying: false, position: 0, duration: 0, isLoaded: false });
  }
};

