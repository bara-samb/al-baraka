import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

export type MainTabParamList = {
  HomeTab: undefined;
  // Sourate et verset à reprendre (« Reprendre la lecture ») ; `at` distingue deux demandes identiques.
  AudioTab: { surah: number; ayah: number; at?: number } | undefined;
  // Verset à afficher (surligné) en ouvrant le Mushaf ; `at` distingue deux demandes identiques.
  MushafTab: { surah: number; ayah: number; at?: number } | undefined;
  TasbihTab: undefined;
  SadaqahTab: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  Surah: {
    surahNumber: number;
    surahName: string;
    englishName: string;
    initialVerseNumber?: number;
  };
  Search: undefined;
  Favorites: undefined;
};

export type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'MainTabs'>;
export type SurahScreenProps = NativeStackScreenProps<RootStackParamList, 'Surah'>;
export type HomeTabScreenProps = BottomTabScreenProps<MainTabParamList, 'HomeTab'>;
export type AudioTabScreenProps = BottomTabScreenProps<MainTabParamList, 'AudioTab'>;
export type MushafTabScreenProps = BottomTabScreenProps<MainTabParamList, 'MushafTab'>;
export type TasbihTabScreenProps = BottomTabScreenProps<MainTabParamList, 'TasbihTab'>;
export type SadaqahTabScreenProps = BottomTabScreenProps<MainTabParamList, 'SadaqahTab'>;
export type SearchScreenProps = NativeStackScreenProps<RootStackParamList, 'Search'>;
export type FavoritesScreenProps = NativeStackScreenProps<RootStackParamList, 'Favorites'>;
