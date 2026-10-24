import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  bgCard: string;
  textPrimary: string;
  textSecondary: string;
  gold: string;
  goldLight: string;
  emerald: string;
  border: string;
  modalBg: string;
  cardShadow: string;
  /** Cartes mises en avant de l'accueil (date / basmala, bannière Sadaqah). */
  accentBg: string;
  accentText: string;
  accentSub: string;
  /** Barre d'onglets flottante. */
  tabBarBg: string;
  tabBarBorder: string;
  tabActive: string;
  tabActivePill: string;
  tabInactive: string;
  /** Texte et icônes posés sur un fond or (boutons, pastilles actives). */
  onGold: string;
  /** Fond teinté or (pastilles d'icônes, sélection). */
  goldTint: string;
  /** Suppression, favori actif, erreur. */
  danger: string;
  /** Voile derrière les fenêtres. */
  overlay: string;
}

// Mode sombre : nuit chaude presque noire, cartes nettement détachées du fond, vert et or
// réservés aux accents (le vert sur toutes les surfaces rendait l'ensemble terne).
export const darkColors: ThemeColors = {
  bgPrimary: '#0E1110',
  bgSecondary: '#161B19',
  bgCard: '#1A201D',
  textPrimary: '#EFE8D6',
  textSecondary: '#A39D8C',
  gold: '#D8B566',
  goldLight: '#E9CD87',
  emerald: '#5BBF97',
  border: '#2A322E',
  modalBg: '#161B19',
  cardShadow: 'rgba(0, 0, 0, 0.6)',
  accentBg: '#173A2E',
  accentText: '#F1DFA8',
  accentSub: '#B9CBBE',
  tabBarBg: '#161B19',
  tabBarBorder: '#2A322E',
  tabActive: '#E9CD87',
  tabActivePill: 'rgba(216, 181, 102, 0.14)',
  tabInactive: '#7F877F',
  onGold: '#14110A',
  goldTint: 'rgba(216, 181, 102, 0.14)',
  danger: '#E06A5E',
  overlay: 'rgba(0, 0, 0, 0.7)',
};

// Mode clair : celui du Mushaf (papier ivoire, encre, vert profond et or).
export const lightColors: ThemeColors = {
  bgPrimary: '#F3EEDF',
  bgSecondary: '#FFFDF6',
  bgCard: '#FBF7EA',
  textPrimary: '#1F1A12',
  textSecondary: '#7C705A',
  gold: '#B0832C',
  goldLight: '#C99A3E',
  emerald: '#145C45',
  border: '#E3D6B4',
  modalBg: '#FFFDF6',
  cardShadow: 'rgba(80, 60, 20, 0.10)',
  accentBg: '#145C45',
  accentText: '#F6E7B8',
  accentSub: '#CFE0D6',
  tabBarBg: '#FFFDF6',
  tabBarBorder: '#E3D6B4',
  tabActive: '#145C45',
  tabActivePill: 'rgba(20, 92, 69, 0.12)',
  tabInactive: '#8A7E66',
  onGold: '#1F1A12',
  goldTint: 'rgba(176, 131, 44, 0.14)',
  danger: '#B4382E',
  overlay: 'rgba(31, 26, 18, 0.55)',
};

interface ThemeContextType {
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: true,
  colors: darkColors,
  toggleTheme: () => {},
});

const THEME_KEY = '@albaraka_theme_mode';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState<boolean>(true);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_KEY);
      if (savedTheme !== null) {
        setIsDark(savedTheme === 'dark');
      }
    } catch (e) {
      console.error('Erreur chargement thème:', e);
    }
  };

  const toggleTheme = async () => {
    const nextMode = !isDark;
    setIsDark(nextMode);
    try {
      await AsyncStorage.setItem(THEME_KEY, nextMode ? 'dark' : 'light');
    } catch (e) {
      console.error('Erreur sauvegarde thème:', e);
    }
  };

  const colors = isDark ? darkColors : lightColors;

  // Web : le navigateur suit le thème de l'app, jamais celui du téléphone ou du PC
  // (« only » empêche le mode sombre forcé de repeindre les couleurs de l'app).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const scheme = isDark ? 'only dark' : 'only light';
    document.documentElement.style.colorScheme = scheme;
    document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', scheme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', colors.bgPrimary);
  }, [isDark, colors.bgPrimary]);

  return (
    <ThemeContext.Provider value={{ isDark, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
