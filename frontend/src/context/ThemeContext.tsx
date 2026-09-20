import React, { createContext, useContext, useState, useEffect } from 'react';
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
}

export const darkColors: ThemeColors = {
  bgPrimary: '#0F172A',
  bgSecondary: '#1E293B',
  bgCard: '#1E293B',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  gold: '#F59E0B',
  goldLight: '#FBBF24',
  emerald: '#10B981',
  border: '#334155',
  modalBg: '#1E293B',
  cardShadow: 'rgba(0, 0, 0, 0.4)',
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

  return (
    <ThemeContext.Provider value={{ isDark, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
