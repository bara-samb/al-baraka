import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { MainTabParamList } from './types';
import { HomeScreen } from '../screens/HomeScreen';
import { AudioPlayerScreen } from '../screens/AudioPlayerScreen';
import { MushafScreen } from '../screens/MushafScreen';
import { TasbihScreen } from '../screens/TasbihScreen';
import { SadaqahModal } from '../components/SadaqahModal';

const Tab = createBottomTabNavigator<MainTabParamList>();

// Composant d'écran pour l'onglet Sadaqah (Ouvre directement la modal)
const DummySadaqahScreen: React.FC = () => {
  const [modalVisible, setModalVisible] = useState<boolean>(true);

  return (
    <View style={{ flex: 1, backgroundColor: '#A8E6C1' }}>
      <SadaqahModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </View>
  );
};

// Custom Bottom Tab Bar Floating Design Elevé (Surelevé en bas)
const CustomBottomTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const [sadaqahModalVisible, setSadaqahModalVisible] = useState<boolean>(false);

  return (
    <>
      <View style={styles.tabBarContainer}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          let iconName: keyof typeof Ionicons.glyphMap = 'book-outline';
          let isMaterialIcon = false;
          let label = 'Accueil';

          if (route.name === 'HomeTab') {
            iconName = isFocused ? 'home' : 'home-outline';
            label = 'Accueil';
          } else if (route.name === 'AudioTab') {
            iconName = isFocused ? 'headset' : 'headset-outline';
            label = 'Lecteur';
          } else if (route.name === 'MushafTab') {
            iconName = isFocused ? 'book' : 'book-outline';
            label = 'Mushaf';
          } else if (route.name === 'TasbihTab') {
            iconName = isFocused ? 'disc' : 'disc-outline';
            label = 'Chapelet';
          } else if (route.name === 'SadaqahTab') {
            iconName = isFocused ? 'heart' : 'heart-outline';
            label = 'Sadaqah';
          }

          const onPress = () => {
            if (route.name === 'SadaqahTab') {
              setSadaqahModalVisible(true);
              return;
            }

            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              style={styles.tabItem}
              activeOpacity={0.8}
            >
              {/* Pilule verte uniquement autour de l'icône active */}
              <View style={[styles.iconPill, isFocused && styles.activePill]}>
                {isMaterialIcon ? (
                  <MaterialCommunityIcons
                    name={isFocused ? 'hand-heart' : 'hand-heart-outline'}
                    size={20}
                    color={isFocused ? '#114232' : '#64748B'}
                  />
                ) : (
                  <Ionicons
                    name={iconName}
                    size={20}
                    color={isFocused ? '#114232' : '#64748B'}
                  />
                )}
              </View>

              {/* Texte sous la pilule */}
              <Text
                style={[
                  styles.tabLabel,
                  { color: isFocused ? '#114232' : '#64748B', fontWeight: isFocused ? 'bold' : '500' },
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Modal Sadaqah ouverte au clic sur l'onglet Sadaqah */}
      <SadaqahModal
        visible={sadaqahModalVisible}
        onClose={() => setSadaqahModalVisible(false)}
      />
    </>
  );
};

export const BottomTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      tabBar={(props) => <CustomBottomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} />
      <Tab.Screen name="AudioTab" component={AudioPlayerScreen} />
      <Tab.Screen name="MushafTab" component={MushafScreen} />
      <Tab.Screen name="TasbihTab" component={TasbihScreen} />
      <Tab.Screen name="SadaqahTab" component={DummySadaqahScreen} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 12, // Rehaussé légèrement par rapport au bas de l'écran
    left: 12,
    right: 12,
    height: 68,
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  iconPill: {
    width: 36,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  activePill: {
    backgroundColor: '#E8F5E9',
  },
  tabLabel: {
    fontSize: 9.5,
    marginTop: 2,
    textAlign: 'center',
  },
});
