import { Platform } from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import ayahTimingsData from '../data/ayahTimings.json';
import { surahNameAr, surahNameLatin } from './warshMushafService';
import { saveLastListenPosition } from './bookmarkService';

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
// Dernière piste lancée : « Lecture » la relance une fois le son libéré (fin de sourate).
let lastUrl: string | null = null;
let currentListeners: Array<(status: SoundStatus) => void> = [];
// Position (s) à laquelle mettre en pause automatiquement, pour confiner la lecture à un
// seul verset (voir playAyahOnly). null = lecture normale, sans limite.
let stopAtSeconds: number | null = null;
// Instant de départ demandé, pas encore atteint : certains navigateurs mobiles ignorent la
// position donnée avant le chargement et partent du début de la sourate. Tant que la lecture
// n'y est pas, on l'y replace (voir onPlaybackStatusUpdate).
let pendingStartSeconds: number | null = null;
// Écoute en boucle : un verset (de start à end, en secondes) ou la sourate entière (end null).
// null = pas de boucle.
let loopRange: { start: number; end: number | null } | null = null;

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
 * Web : nom de la sourate en cours sur l'écran de verrouillage, dans la notification du
 * navigateur et sur les écouteurs Bluetooth (Media Session), avec lecture/pause et ±10 s.
 * Le numéro de sourate est lu dans le nom du fichier (NNN.mp3).
 */
// Numéro de sourate d'après le nom du fichier audio (NNN.mp3).
const surahOfUrl = (url: string | null): number => Number(url?.match(/(\d{3})\.mp3(?:\?.*)?$/)?.[1]) || 0;

/** Sourate de la dernière piste lancée (0 si rien n'a encore été écouté). */
export const getCurrentSurahNumber = (): number => surahOfUrl(lastUrl);

// « Reprendre l'écoute » : position notée toutes les 5 s pendant une écoute suivie (pas pour
// un verset écouté seul, comme le verset du jour).
let lastListenSaveAt = 0;
const trackListening = (positionSec: number) => {
  const surah = surahOfUrl(lastUrl);
  if (!surah || stopAtSeconds !== null || loopRange?.end != null || Date.now() - lastListenSaveAt < 5000) return;
  lastListenSaveAt = Date.now();
  saveLastListenPosition(surah, getAyahAtPosition(surah, positionSec) ?? 1);
};

const showNowPlaying = (url: string): void => {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  const surah = surahOfUrl(url);
  if (!surah) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${surah}. ${surahNameLatin(surah)} · ${surahNameAr(surah)}`,
      artist: 'Serigne Aboul Baraka Mbacké',
      album: 'AL BARAKA · Riwaya Warsh',
      artwork: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    });
    navigator.mediaSession.setActionHandler('play', () => { currentSound?.playAsync().catch(() => {}); });
    navigator.mediaSession.setActionHandler('pause', () => { currentSound?.pauseAsync().catch(() => {}); });
    navigator.mediaSession.setActionHandler('seekbackward', () => { seekBy(-10); });
    navigator.mediaSession.setActionHandler('seekforward', () => { seekBy(10); });
  } catch {}
};

// Retire le nom de la sourate de l'écran de verrouillage et de la notification.
const clearNowPlaying = (): void => {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
    for (const action of ['play', 'pause', 'seekbackward', 'seekforward'] as MediaSessionAction[]) {
      navigator.mediaSession.setActionHandler(action, null);
    }
  } catch {}
};

/**
 * Lance la lecture sans l'attendre. Sur le web, `play()` ne rend la main qu'une fois le son
 * réellement parti : l'attendre bloquait l'app (bouton figé, impossible d'arrêter, sons
 * superposés) quand le navigateur tarde. Safari se fige parfois en démarrant loin dans un long
 * fichier (verset au milieu d'une sourate) : si la position reste figée 3 s alors que le son est
 * chargé (ou 10 s en tout), le fichier est rechargé au même instant (jusqu'à 3 fois), ce qui le
 * débloque.
 */
const startPlayback = (sound: Audio.Sound): void => {
  sound.playAsync().catch(() => {});
  const media = (sound as any)._key;
  if (Platform.OS !== 'web' || typeof HTMLMediaElement === 'undefined' || !(media instanceof HTMLMediaElement)) return;
  let last = media.currentTime;
  let stillFor = 0; // secondes sans progrès alors que le son est déjà chargé
  let waitingFor = 0; // secondes sans progrès au total (chargement compris)
  let reloads = 0;
  const timer = setInterval(() => {
    if (currentSound !== sound || reloads >= 3) return clearInterval(timer);
    if (media.paused || Math.abs(media.currentTime - last) > 0.25) {
      if (media.currentTime > last + 2) clearInterval(timer); // la lecture est bien partie
      last = media.currentTime;
      stillFor = waitingFor = 0;
      return;
    }
    // Encore en téléchargement : on laisse faire (jusqu'à 10 s), sinon on interromprait le
    // chargement. Son disponible mais position figée : c'est le blocage de Safari.
    waitingFor++;
    if (media.readyState >= 2) stillFor++;
    if (stillFor < 3 && waitingFor < 10) return;
    stillFor = waitingFor = 0;
    reloads++;
    const at = media.currentTime;
    media.load();
    media.currentTime = at;
    media.play().catch(() => {});
  }, 1000);
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
 * @param startSeconds Instant de départ exact, appliqué dès le chargement.
 * Retourne true en cas de succès, false si le fichier n'a pas pu être chargé (ex: 404).
 */
export const playAudioTrack = async (url: string, startRatio: number = 0, startSeconds: number = 0): Promise<boolean> => {
  stopAtSeconds = null; // lecture normale : pas de limite de fin
  loopRange = null;
  try {
    await stopAudioTrack();
    await initAudioMode();

    // startSeconds : la lecture démarre directement à cet instant (un seul chargement).
    const { sound, status } = await Audio.Sound.createAsync(
      { uri: url },
      { shouldPlay: false, positionMillis: Math.max(0, startSeconds * 1000) },
      onPlaybackStatusUpdate
    );

    currentSound = sound;
    lastUrl = url;
    lastListenSaveAt = 0;
    pendingStartSeconds = startSeconds > 1 ? startSeconds : null;
    showNowPlaying(url);
    startPlayback(sound);

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
 * Lit une sourate à partir d'un verset. Avec le minutage précis, la lecture démarre
 * directement à l'instant du verset ; sans lui, elle démarre au début puis se place à une
 * position estimée (ce qui demande un second chargement).
 */
export const playAudioFromAyah = (
  url: string,
  surahNumber: number,
  numberInSurah: number,
  totalAyahsInSurah: number
): Promise<boolean> => {
  if (numberInSurah <= 1) return playAudioTrack(url);
  const bounds = getAyahBoundsSeconds(surahNumber, numberInSurah);
  if (bounds) return playAudioTrack(url, 0, bounds.startSec);
  return playAudioTrack(url, getAyahStartRatio(surahNumber, numberInSurah, totalAyahsInSurah));
};

/** Lit toute la sourate en boucle : à la fin, elle reprend du début. */
export const playSurahLoop = async (url: string): Promise<boolean> => {
  const ok = await playAudioTrack(url);
  if (ok) loopRange = { start: 0, end: null };
  return ok;
};

/**
 * Joue UN SEUL verset : démarre à son instant de départ précis et se met en pause
 * automatiquement à son instant de fin, sans déborder sur le verset précédent ou suivant.
 * Avec `loop`, il reprend à son début au lieu de s'arrêter, jusqu'à l'arrêt de la lecture.
 * Retourne true en cas de succès, false si le fichier n'a pas pu être chargé ou si aucune
 * donnée de minutage n'est disponible pour ce verset.
 */
export const playAyahOnly = async (
  url: string,
  surahNumber: number,
  numberInSurah: number,
  loop: boolean = false
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
      { shouldPlay: false, positionMillis: Math.max(0, bounds.startSec * 1000) },
      onPlaybackStatusUpdate
    );

    currentSound = sound;
    stopAtSeconds = loop ? null : bounds.endSec;
    loopRange = loop ? { start: bounds.startSec, end: bounds.endSec } : null;
    pendingStartSeconds = bounds.startSec > 1 ? bounds.startSec : null;
    lastUrl = url;
    showNowPlaying(url);
    startPlayback(sound);

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

// Web : expo-av ne considère la lecture « en cours » qu'une fois assez de son chargé. Pendant
// le chargement, le bouton repassait à « Écouter » et un nouvel appui relançait tout : on tient
// compte de l'intention de lecture (élément audio lancé, pas en pause).
const isWebMediaActive = (): boolean => {
  const media = (currentSound as any)?._key;
  return Platform.OS === 'web' && typeof HTMLMediaElement !== 'undefined' && media instanceof HTMLMediaElement && !media.paused && !media.ended;
};

const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
  if (status.isLoaded) {
    const positionSec = status.positionMillis / 1000;
    const isPlaying = status.isPlaying || isWebMediaActive();

    if (pendingStartSeconds !== null && (status.durationMillis || 0) > 0) {
      if (positionSec >= pendingStartSeconds - 1) {
        pendingStartSeconds = null;
      } else {
        currentSound?.setPositionAsync(pendingStartSeconds * 1000).catch(() => {});
        return; // position erronée : ni pause de fin de verset ni affichage
      }
    }

    if (stopAtSeconds !== null && isPlaying && positionSec >= stopAtSeconds) {
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

    // Verset en boucle : arrivé à sa fin, on revient à son début.
    if (loopRange?.end != null && isPlaying && positionSec >= loopRange.end) {
      currentSound?.setPositionAsync(loopRange.start * 1000).catch(() => {});
      return;
    }

    if (isPlaying) trackListening(positionSec);

    notifyListeners({
      isPlaying,
      position: positionSec,
      duration: (status.durationMillis || 0) / 1000,
      isLoaded: true,
    });

    if (status.didJustFinish && loopRange) {
      // Sourate en boucle (ou verset final, dont la fin est celle du fichier) : on recommence.
      const start = loopRange.start * 1000;
      currentSound?.setPositionAsync(start).then(() => currentSound?.playAsync()).catch(() => {});
      return;
    }

    if (status.didJustFinish && !status.isLooping) {
      const finished = currentSound;
      notifyFinishListeners();
      // Personne n'a enchaîné sur une autre piste : on libère le son, ce qui retire aussi le
      // nom de la sourate de l'écran de verrouillage.
      setTimeout(() => {
        if (currentSound === finished) stopAudioTrack();
      }, 1500);
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
  if (!currentSound) {
    if (lastUrl) await playAudioTrack(lastUrl);
    return;
  }
  try {
    const status = await currentSound.getStatusAsync();
    if (status.isLoaded) {
      if (status.isPlaying || isWebMediaActive()) {
        await currentSound.pauseAsync();
      } else {
        currentSound.playAsync().catch(() => {}); // sans attendre : voir startPlayback
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
  if (loopRange?.end != null) loopRange = null; // ... et de la boucle sur un verset
  pendingStartSeconds = null;
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
  if (loopRange?.end != null) loopRange = null; // ... et de la boucle sur un verset
  pendingStartSeconds = null;
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
  loopRange = null;
  pendingStartSeconds = null;
  if (currentSound) {
    try {
      await currentSound.stopAsync();
      await currentSound.unloadAsync();
    } catch {}
    currentSound = null;
    clearNowPlaying();
    notifyListeners({ isPlaying: false, position: 0, duration: 0, isLoaded: false });
  }
};

