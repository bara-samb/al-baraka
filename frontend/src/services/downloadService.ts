import * as FileSystem from 'expo-file-system';
import { getAudioUrlForSurah } from '../config/audioConfig';

const AUDIO_DIR = `${(FileSystem as any).documentDirectory || ''}audios/`;


let listeners: Array<() => void> = [];

export const subscribeDownloadChange = (callback: () => void) => {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((cb) => cb !== callback);
  };
};

const notifyListeners = () => {
  listeners.forEach((cb) => cb());
};

const ensureDirExists = async () => {
  const dirInfo = await FileSystem.getInfoAsync(AUDIO_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(AUDIO_DIR, { intermediates: true });
  }
};

const getLocalFilePath = (surahNumber: number): string => {
  const padded = String(surahNumber).padStart(3, '0');
  return `${AUDIO_DIR}${padded}.mp3`;
};

/**
 * Vérifie si une sourate est téléchargée localement dans le téléphone
 */
export const isSurahDownloaded = async (surahNumber: number): Promise<boolean> => {
  try {
    const fileUri = getLocalFilePath(surahNumber);
    const info = await FileSystem.getInfoAsync(fileUri);
    return info.exists && !info.isDirectory;
  } catch (e) {
    return false;
  }
};

/**
 * Retourne l'URI locale si la sourate est téléchargée, sinon l'URL réseau
 */
export const getEffectiveAudioUrl = async (surahNumber: number): Promise<string> => {
  const downloaded = await isSurahDownloaded(surahNumber);
  if (downloaded) {
    return getLocalFilePath(surahNumber);
  }
  return getAudioUrlForSurah(surahNumber);
};

/**
 * Télécharge l'audio de la sourate pour une écoute 100% hors-ligne
 */
export const downloadSurahAudio = async (
  surahNumber: number,
  onProgress?: (progress: number) => void
): Promise<boolean> => {
  try {
    await ensureDirExists();
    const remoteUrl = getAudioUrlForSurah(surahNumber);
    const localUri = getLocalFilePath(surahNumber);

    const downloadResumable = FileSystem.createDownloadResumable(
      remoteUrl,
      localUri,
      {},
      (downloadProgress) => {
        const progress =
          downloadProgress.totalBytesWritten /
          downloadProgress.totalBytesExpectedToWrite;
        if (onProgress) onProgress(Math.max(0, Math.min(1, progress)));
      }
    );

    const result = await downloadResumable.downloadAsync();
    if (result && result.status === 200) {
      notifyListeners();
      return true;
    }
  } catch (e) {
    console.error(`Erreur téléchargement sourate ${surahNumber}:`, e);
  }
  return false;
};

/**
 * Supprime le fichier audio local d'une sourate
 */
export const deleteDownloadedSurah = async (surahNumber: number): Promise<boolean> => {
  try {
    const localUri = getLocalFilePath(surahNumber);
    const info = await FileSystem.getInfoAsync(localUri);
    if (info.exists) {
      await FileSystem.deleteAsync(localUri);
      notifyListeners();
      return true;
    }
  } catch (e) {
    console.error(`Erreur suppression sourate ${surahNumber}:`, e);
  }
  return false;
};
