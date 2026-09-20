import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DhikrPreset {
  id: string;
  arabic: string;
  transliteration: string;
  translation: string;
  defaultTarget: number;
}

export const DEFAULT_DHIKRS: DhikrPreset[] = [
  {
    id: 'subhanallah',
    arabic: 'سُبْحَانَ اللَّهِ',
    transliteration: 'SubhanAllah',
    translation: 'Gloire à Allah',
    defaultTarget: 33,
  },
  {
    id: 'alhamdulillah',
    arabic: 'الْحَمْدُ لِلَّهِ',
    transliteration: 'Alhamdulillah',
    translation: 'Louange à Allah',
    defaultTarget: 33,
  },
  {
    id: 'allahuakbar',
    arabic: 'اللَّهُ أَكْبَرُ',
    transliteration: 'Allahu Akbar',
    translation: 'Allah est le Plus Grand',
    defaultTarget: 33,
  },
  {
    id: 'astaghfirullah',
    arabic: 'أَسْتَغْفِرُ اللَّهَ',
    transliteration: 'Astaghfirullah',
    translation: 'J’implore le pardon d’Allah',
    defaultTarget: 100,
  },
  {
    id: 'lailahaillallah',
    arabic: 'لَا إِلَهَ إِلَّا اللَّهُ',
    transliteration: 'La ilaha illa Allah',
    translation: 'Il n’y a de divinité qu’Allah',
    defaultTarget: 100,
  },
  {
    id: 'salawat',
    arabic: 'اللَّهُمَّ صَلِّ عَلَى سَيِّدِنَا مُحَمَّدٍ',
    transliteration: 'Allahumma Salli Ala Sayyidina Muhammad',
    translation: 'Que la paix et la bénédiction soient sur notre Prophète',
    defaultTarget: 100,
  },
];

const TASBIH_STATS_KEY = '@albaraka_tasbih_stats';

export interface TasbihStats {
  totalCount: number;
  completedRounds: number;
  dhikrCounts: Record<string, number>;
}

export const getTasbihStats = async (): Promise<TasbihStats> => {
  try {
    const json = await AsyncStorage.getItem(TASBIH_STATS_KEY);
    if (json) return JSON.parse(json);
  } catch (e) {
    console.error('Erreur getTasbihStats:', e);
  }
  return { totalCount: 0, completedRounds: 0, dhikrCounts: {} };
};

export const saveTasbihIncrement = async (dhikrId: string, isRoundComplete: boolean): Promise<TasbihStats> => {
  const stats = await getTasbihStats();
  stats.totalCount += 1;
  stats.dhikrCounts[dhikrId] = (stats.dhikrCounts[dhikrId] || 0) + 1;
  if (isRoundComplete) {
    stats.completedRounds += 1;
  }
  try {
    await AsyncStorage.setItem(TASBIH_STATS_KEY, JSON.stringify(stats));
  } catch (e) {
    console.error('Erreur saveTasbihIncrement:', e);
  }
  return stats;
};

export const resetTasbihStats = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(TASBIH_STATS_KEY);
  } catch (e) {
    console.error('Erreur resetTasbihStats:', e);
  }
};
