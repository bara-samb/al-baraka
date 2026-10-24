import { Platform } from 'react-native';

// Dans la police Warsh du KFGQPC, les chiffres arabes sont dessinés comme des fins de verset
// ornées : les numéros affichés au milieu du texte Warsh utilisent donc la police du système.
export const DIGITS_FONT = Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui, sans-serif' });

// Palette propre au Mushaf : papier ivoire, encre, vert profond et or (clair),
// ou nuit verte et or (sombre). Indépendante du thème général pour garder l'aspect "livre".
export interface MushafPalette {
  screen: string;
  page: string;
  ink: string;
  title: string;
  muted: string;
  gold: string;
  goldSoft: string;
  green: string;
  greenDeep: string;
  onGreen: string;
  ribbon: string;
  selected: string;
  playing: string;
  chrome: string;
  chromeBorder: string;
}

export const mushafLight: MushafPalette = {
  screen: '#EAE2CC',
  page: '#FBF7EA',
  ink: '#1F1A12',
  title: '#145C45',
  muted: '#7C705A',
  gold: '#B0832C',
  goldSoft: '#E4C985',
  green: '#145C45',
  greenDeep: '#0B3A2B',
  onGreen: '#F6E7B8',
  ribbon: '#A9342B',
  selected: 'rgba(176, 131, 44, 0.20)',
  playing: 'rgba(20, 92, 69, 0.22)',
  chrome: '#FFFDF6',
  chromeBorder: '#E3D6B4',
};

// Mêmes fonds que le thème sombre de l'app (ThemeContext), pour un passage sans rupture.
export const mushafDark: MushafPalette = {
  screen: '#0E1110',
  page: '#151A18',
  ink: '#EFE8D6',
  title: '#E0BE6A',
  muted: '#A39D8C',
  gold: '#D8B566',
  goldSoft: '#9C824A',
  green: '#1D6B52',
  greenDeep: '#173A2E',
  onGreen: '#F3DE9E',
  ribbon: '#C2473C',
  selected: 'rgba(216, 181, 102, 0.22)',
  playing: 'rgba(91, 191, 151, 0.26)',
  chrome: '#161B19',
  chromeBorder: '#2A322E',
};
