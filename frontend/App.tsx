import React, { useEffect } from 'react';
import { AppNavigator } from './src/navigation/AppNavigator';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { View, ActivityIndicator } from 'react-native';
import { startAzanWatcher } from './src/services/azanService';

export default function App() {
  // fontError : sur le web, certains navigateurs (sanitizer de police Chrome) peuvent
  // rejeter ce fichier .otf personnalisé. Dans ce cas on ne bloque pas l'app indéfiniment
  // (fontsLoaded ne deviendrait jamais true) : on démarre quand même, avec un repli sur
  // la police système pour le texte arabe sur cette plateforme.
  const [fontsLoaded, fontError] = useFonts({
    'KFGQPC_Warsh': require('./assets/fonts/KFGQPC_Warsh.otf'),
  });

  useEffect(() => {
    const stopWatcher = startAzanWatcher();
    return stopWatcher;
  }, []);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#A8E6C1' }}>
        <ActivityIndicator size="large" color="#0F4C2E" />
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
