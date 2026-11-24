import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AppUpdateInfo {
  latestVersion: string;
  versionCode: number;
  minVersion: string;
  title: string;
  message: string;
  releaseNotes: string[];
  playStoreUrl: string;
  webUrl: string;
}

const UPDATE_DISMISSED_KEY = '@albaraka_last_dismissed_update';
const REMOTE_VERSION_URL = 'https://al-baraka-app.pages.dev/version.json';

// Version actuelle de l'application
export const CURRENT_APP_VERSION = Constants.expoConfig?.version || '1.0.0';
export const CURRENT_VERSION_CODE = (Constants.expoConfig as any)?.android?.versionCode || 5;

/**
 * Compare deux chaînes de version semver (ex: "1.0.1" vs "1.0.0")
 * Retourne true si remote est plus récente que current.
 */
const isNewerVersion = (remote: string, current: string): boolean => {
  const rParts = remote.split('.').map((p) => parseInt(p, 10) || 0);
  const cParts = current.split('.').map((p) => parseInt(p, 10) || 0);
  const maxLen = Math.max(rParts.length, cParts.length);

  for (let i = 0; i < maxLen; i++) {
    const r = rParts[i] || 0;
    const c = cParts[i] || 0;
    if (r > c) return true;
    if (r < c) return false;
  }
  return false;
};

/**
 * Vérifie si une mise à jour est disponible
 */
export const checkForAppUpdate = async (): Promise<{
  available: boolean;
  info: AppUpdateInfo | null;
}> => {
  try {
    const res = await fetch(`${REMOTE_VERSION_URL}?t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!res.ok) return { available: false, info: null };

    const data: AppUpdateInfo = await res.json();
    if (!data || !data.latestVersion) return { available: false, info: null };

    const isCodeHigher = data.versionCode > CURRENT_VERSION_CODE;
    const isVersionHigher = isNewerVersion(data.latestVersion, CURRENT_APP_VERSION);

    if (isCodeHigher || isVersionHigher) {
      // Vérifie si l'utilisateur a déjà reporté cette version aujourd'hui
      const dismissedRaw = await AsyncStorage.getItem(UPDATE_DISMISSED_KEY);
      if (dismissedRaw) {
        try {
          const { version, time } = JSON.parse(dismissedRaw);
          // Si c'est la même version et rejetée il y a moins de 12 heures, on n'importune pas
          if (version === data.latestVersion && Date.now() - time < 12 * 3600 * 1000) {
            return { available: false, info: data };
          }
        } catch {}
      }

      return { available: true, info: data };
    }
  } catch (e) {
    // Si pas de connexion ou erreur réseau, on ignore silencieusement
  }
  return { available: false, info: null };
};

/**
 * Enregistre que l'utilisateur a reporté la mise à jour pour plus tard
 */
export const dismissUpdate = async (version: string) => {
  try {
    await AsyncStorage.setItem(
      UPDATE_DISMISSED_KEY,
      JSON.stringify({ version, time: Date.now() })
    );
  } catch (e) {
    console.error('Erreur dismissUpdate:', e);
  }
};

/**
 * Ouvre directement le Google Play Store ou la page web pour faire la mise à jour
 */
export const openStoreForUpdate = async (info?: AppUpdateInfo | null) => {
  const playStoreUrl = info?.playStoreUrl || 'market://details?id=com.barasamb.albaraka';
  const webUrl = info?.webUrl || 'https://play.google.com/store/apps/details?id=com.barasamb.albaraka';

  if (Platform.OS === 'android') {
    try {
      const supported = await Linking.canOpenURL(playStoreUrl);
      if (supported) {
        await Linking.openURL(playStoreUrl);
        return;
      }
    } catch {}
  }

  // Fallback Web / iOS / Browser
  try {
    await Linking.openURL(webUrl);
  } catch (e) {
    console.error('Impossible d ouvrir le Play Store:', e);
  }
};
