import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * URL de base de production (CDN / hébergement distant des audios), définie via variable
 * d'environnement Expo publique (ex: fichier .env → EXPO_PUBLIC_AUDIO_BASE_URL=https://cdn.example.com/audios/serigne-aboul-baraka-mbacke/).
 * Voir https://docs.expo.dev/guides/environment-variables/
 *
 * Tant qu'aucune valeur de production n'est fournie, l'app retombe sur la détection
 * automatique du serveur de développement local (Expo Go / émulateur) ci-dessous.
 */
const PRODUCTION_AUDIO_BASE_URL = process.env.EXPO_PUBLIC_AUDIO_BASE_URL;

/**
 * Détermine dynamiquement l'adresse IP / Hôte du serveur Backend Audio EN DÉVELOPPEMENT :
 * - Web : http://localhost:4000
 * - Expo Go (Vrai téléphone sur le même Wi-Fi) : Détecte automatiquement l'IP du PC !
 * - Émulateur Android : http://10.0.2.2:4000
 */
const getBackendHost = (): string => {
  if (Platform.OS === 'web') {
    return 'localhost';
  }

  // Détection automatique de l'IP du PC de dev via Expo Go
  const hostUri =
    (Constants as any).expoConfig?.hostUri ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any).hostUri;

  if (hostUri && typeof hostUri === 'string') {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return ip;
    }
  }

  // Fallback par défaut pour émulateur Android
  return '10.0.2.2';
};

const BACKEND_PORT = 4000;
const SERVER_ROOT_URL = PRODUCTION_AUDIO_BASE_URL
  ? PRODUCTION_AUDIO_BASE_URL.replace(/\/audios\/serigne-aboul-baraka-mbacke\/?$/, '')
  : `http://${getBackendHost()}:${BACKEND_PORT}`;

export const AUDIO_BASE_URL = PRODUCTION_AUDIO_BASE_URL || `${SERVER_ROOT_URL}/audios/serigne-aboul-baraka-mbacke/`;

/**
 * Formate un numéro de sourate en chaîne à 3 chiffres (ex: 1 -> "001.mp3", 114 -> "114.mp3")
 */
export const getAudioUrlForSurah = (surahNumber: number): string => {
  const paddedNumber = String(surahNumber).padStart(3, '0');
  return `${AUDIO_BASE_URL}${paddedNumber}.mp3`;
};
