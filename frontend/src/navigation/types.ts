import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NavigatorScreenParams } from '@react-navigation/native';

// Récitation à lancer en ouvrant le Mushaf (depuis les favoris) : le verset seul, une fois ou en
// boucle, ou toute la sourate, une fois ou en boucle.
export type MushafPlayRequest = 'verse' | 'verseLoop' | 'surah' | 'surahLoop';

export type MainTabParamList = {
  HomeTab: undefined;
  // Sourate et verset à reprendre (« Reprendre la lecture ») ; `at` distingue deux demandes identiques.
  AudioTab: { surah: number; ayah: number; at?: number } | undefined;
  // Verset à afficher en ouvrant le Mushaf (surligné sauf `highlight: false`, pour reprendre
  // la lecture) ; `at` distingue deux demandes identiques.
  MushafTab: { surah: number; ayah: number; at?: number; highlight?: boolean; play?: MushafPlayRequest } | undefined;
  TasbihTab: undefined;
  SadaqahTab: undefined;
};

export type RootStackParamList = {
  // Un onglet précis peut être ouvert depuis une page de la pile (ex. une sourate favorite dans le Mushaf).
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Surah: {
    surahNumber: number;
    surahName: string;
    englishName: string;
    initialVerseNumber?: number;
  };
  Search: undefined;
  Favorites: undefined;
  // Page d'un verset (verset du jour) : texte, traductions, écoute et partage.
  Verse: { surah: number; ayah: number; title?: string };
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
export type VerseScreenProps = NativeStackScreenProps<RootStackParamList, 'Verse'>;
