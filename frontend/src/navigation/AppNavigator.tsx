import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { BottomTabNavigator } from './BottomTabNavigator';
import { SurahScreen } from '../screens/SurahScreen';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const NavigationWrapper = () => {
  const { colors } = useTheme();

  return (
    <NavigationContainer>
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
        <Stack.Screen
          name="Surah"
          component={SurahScreen}
          options={({ route }) => ({
            title: route.params.englishName,
          })}
        />
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

