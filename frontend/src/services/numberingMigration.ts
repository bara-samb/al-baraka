import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWarshAyahs, hafsToWarsh } from './warshMushafService';

// Jusqu'à cette version, les versets étaient numérotés à la Hafs. Les données enregistrées
// (versets favoris, position « Reprendre la lecture ») sont converties une seule fois vers la
// numérotation du Mushaf Warsh.
const MIGRATION_KEY = '@albaraka_numbering';
const FAVORITE_AYAHS_KEY = '@albaraka_fav_ayahs';
const LAST_READ_KEY = '@albaraka_last_read_bookmark';
const OLD_SURAH_CACHE_PREFIX = '@albaraka_surah_warsh_v2_';

let migration: Promise<void> | null = null;

async function migrate(): Promise<void> {
  if ((await AsyncStorage.getItem(MIGRATION_KEY)) === 'warsh') return;

  const favJson = await AsyncStorage.getItem(FAVORITE_AYAHS_KEY);
  if (favJson) {
    const seen = new Set<number>();
    const migrated = (JSON.parse(favJson) as any[]).flatMap((item) => {
      const warshAyah = getWarshAyahs(item.surahNumber)[hafsToWarsh(item.surahNumber, item.ayah.numberInSurah) - 1];
      if (!warshAyah || seen.has(warshAyah.number)) return [];
      seen.add(warshAyah.number);
      return [{ ...item, ayah: { ...warshAyah, translation: item.ayah.translation } }];
    });
    await AsyncStorage.setItem(FAVORITE_AYAHS_KEY, JSON.stringify(migrated));
  }

  const lastReadJson = await AsyncStorage.getItem(LAST_READ_KEY);
  if (lastReadJson) {
    const lastRead = JSON.parse(lastReadJson);
    lastRead.verseNumber = hafsToWarsh(lastRead.surahNumber, lastRead.verseNumber || 1);
    await AsyncStorage.setItem(LAST_READ_KEY, JSON.stringify(lastRead));
  }

  // Anciennes sourates mises en cache avec la numérotation Hafs : devenues inutiles.
  const keys = await AsyncStorage.getAllKeys();
  const stale = keys.filter((k) => k.startsWith(OLD_SURAH_CACHE_PREFIX));
  if (stale.length > 0) await AsyncStorage.multiRemove(stale);

  await AsyncStorage.setItem(MIGRATION_KEY, 'warsh');
}

/** À attendre avant de lire des données numérotées ; ne s'exécute réellement qu'une fois. */
export const ensureWarshNumbering = (): Promise<void> => {
  if (!migration) {
    migration = migrate().catch((e) => {
      console.error('Erreur migration numérotation Warsh:', e);
    });
  }
  return migration;
};
