import React from 'react';
import { AppNavigator } from './src/navigation/AppNavigator';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { View, ActivityIndicator } from 'react-native';

export default function App() {
  // Police officielle du Complexe du Roi Fahd pour le texte Warsh (warshData_v10), voir
  // assets/fonts/KFGQPC_Warsh-LICENSE.txt. Si elle ne se charge pas (fontError), l'app
  // démarre quand même, avec la police arabe du système.
  const [fontsLoaded, fontError] = useFonts({
    'KFGQPC_Warsh': require('./assets/fonts/KFGQPC_Warsh.ttf'),
  });

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0B3A2B' }}>
        <ActivityIndicator size="large" color="#D8B566" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <AppNavigator />
    </>
  );
}
