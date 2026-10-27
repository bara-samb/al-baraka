import React, { useEffect } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { BottomTabNavigator } from './BottomTabNavigator';
import { SurahScreen } from '../screens/SurahScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { VerseScreen } from '../screens/VerseScreen';
import { RootStackParamList } from './types';
import { installWebBackButton } from './webBackButton';

const Stack = createNativeStackNavigator<RootStackParamList>();

const NavigationWrapper = () => {
  const { colors } = useTheme();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

  useEffect(() => installWebBackButton(navigationRef), [navigationRef]);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName="MainTabs"
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.bgPrimary,
          },
          headerTintColor: colors.gold,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen
          name="MainTabs"
          component={BottomTabNavigator}
          options={{ headerShown: false }}
        />
        {/* Ces écrans gèrent leur propre en-tête (avec bouton retour) en interne,
            donc on masque l'en-tête natif pour éviter une double barre de titre. */}
        <Stack.Screen name="Surah" component={SurahScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Search" component={SearchScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Verse" component={VerseScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export const AppNavigator: React.FC = () => {
  return (
    <ThemeProvider>
      <NavigationWrapper />
    </ThemeProvider>
  );
};

