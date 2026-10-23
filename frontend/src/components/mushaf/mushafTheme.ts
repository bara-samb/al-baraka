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

export const mushafDark: MushafPalette = {
  screen: '#070E0B',
  page: '#101915',
  ink: '#EEE6D1',
  title: '#E0BE6A',
  muted: '#9C927A',
  gold: '#D6B158',
  goldSoft: '#A88C4A',
  green: '#1D6B52',
  greenDeep: '#0D2E23',
  onGreen: '#F3DE9E',
  ribbon: '#C2473C',
  selected: 'rgba(214, 177, 88, 0.22)',
  playing: 'rgba(76, 190, 148, 0.28)',
  chrome: '#0F1814',
  chromeBorder: '#24342C',
};
