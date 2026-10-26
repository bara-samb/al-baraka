import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { getAudioUrlForSurah } from '../config/audioConfig';

// Sur le web (PWA), les sourates téléchargées sont gardées dans le stockage du navigateur
// (Cache Storage). Le service worker (public/sw.js) les sert ensuite depuis ce cache, même
// hors ligne : l'adresse de lecture reste la même. Le nom doit rester celui de sw.js.
const WEB_AUDIO_CACHE = 'albaraka-audio';
const useWebCache = (): boolean => Platform.OS === 'web' && typeof caches !== 'undefined';

const webIsDownloaded = async (surahNumber: number): Promise<boolean> => {
  const cache = await caches.open(WEB_AUDIO_CACHE);
  return !!(await cache.match(getAudioUrlForSurah(surahNumber)));
};

const webDownload = async (surahNumber: number, onProgress?: (progress: number) => void): Promise<boolean> => {
  const url = getAudioUrlForSurah(surahNumber);
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok || !response.body) return false;
  const total = Number(response.headers.get('content-length')) || 0;
  let received = 0;
  // Le fichier passe directement du réseau au cache (sans être gardé en mémoire), en comptant
  // les octets pour la progression.
  const counted = response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        received += chunk.byteLength;
        if (total && onProgress) onProgress(Math.min(1, received / total));
        controller.enqueue(chunk);
      },
    })
  );
  const headers = new Headers({ 'Content-Type': response.headers.get('content-type') || 'audio/mpeg' });
  if (total) headers.set('Content-Length', String(total));
  // Demande au navigateur de ne pas effacer ces fichiers quand l'espace manque.
  navigator.storage?.persist?.().catch(() => {});
  const cache = await caches.open(WEB_AUDIO_CACHE);
  await cache.put(url, new Response(counted, { headers }));
  if (total && received !== total) {
    await cache.delete(url);
    return false;
  }
  return true;
};

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
    if (useWebCache()) return await webIsDownloaded(surahNumber);
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
  // Web : même adresse, le service worker la sert depuis le cache si la sourate est téléchargée.
  if (useWebCache()) return getAudioUrlForSurah(surahNumber);
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
    if (useWebCache()) {
      const ok = await webDownload(surahNumber, onProgress);
      if (ok) notifyListeners();
      return ok;
    }
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
    if (useWebCache()) {
      const removed = await (await caches.open(WEB_AUDIO_CACHE)).delete(getAudioUrlForSurah(surahNumber));
      if (removed) notifyListeners();
      return removed;
    }
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
