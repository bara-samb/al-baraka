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
}

// Mode sombre : nuit verte et or doux, comme le Mushaf en mode sombre.
export const darkColors: ThemeColors = {
  bgPrimary: '#08130F',
  bgSecondary: '#0F201A',
  bgCard: '#11241D',
  textPrimary: '#F2EBD9',
  textSecondary: '#9FB2A7',
  gold: '#D6B158',
  goldLight: '#E8CC80',
  emerald: '#3FBF8F',
  border: '#21382E',
  modalBg: '#0F201A',
  cardShadow: 'rgba(0, 0, 0, 0.5)',
  accentBg: '#0F3327',
  accentText: '#F1DFA8',
  accentSub: '#A9C7B6',
  tabBarBg: '#0F201A',
  tabBarBorder: '#2A4337',
  tabActive: '#E8CC80',
  tabActivePill: 'rgba(214, 177, 88, 0.16)',
  tabInactive: '#7F9488',
};

export const lightColors: ThemeColors = {
  bgPrimary: '#F1F5F9',
  bgSecondary: '#FFFFFF',
  bgCard: '#FFFFFF',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  gold: '#D97706',
  goldLight: '#F59E0B',
  emerald: '#059669',
  border: '#E2E8F0',
  modalBg: '#FFFFFF',
  cardShadow: 'rgba(0, 0, 0, 0.08)',
  accentBg: '#A8E6C1',
  accentText: '#0F4C2E',
  accentSub: '#3D7A5C',
  tabBarBg: '#FFFFFF',
  tabBarBorder: '#E2E8F0',
  tabActive: '#114232',
  tabActivePill: '#E8F5E9',
  tabInactive: '#64748B',
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
