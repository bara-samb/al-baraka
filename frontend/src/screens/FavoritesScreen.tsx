import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import {
  getFavoriteSurahs,
  getFavoriteAyahs,
  subscribeFavoritesChange,
  FavoriteAyahItem,
  toggleFavoriteSurah,
  toggleFavoriteAyah,
} from '../services/favoritesService';
import { Surah, Ayah } from '../types/quran';
import { SurahCard } from '../components/SurahCard';
import { VerseModal } from '../components/VerseModal';
import { playAyahOnly } from '../services/audioService';
import { getEffectiveAudioUrl } from '../services/downloadService';
import { FavoritesScreenProps } from '../navigation/types';

export const FavoritesScreen: React.FC<FavoritesScreenProps> = ({ navigation }) => {
  const { colors, isDark, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'surahs' | 'ayahs'>('surahs');
  const [favSurahs, setFavSurahs] = useState<Surah[]>([]);
  const [favAyahs, setFavAyahs] = useState<FavoriteAyahItem[]>([]);
  const [selectedAyah, setSelectedAyah] = useState<Ayah | null>(null);
  const [selectedSurahName, setSelectedSurahName] = useState<string>('');
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);

  useEffect(() => {
    loadFavorites();
    const unsubscribe = subscribeFavoritesChange(() => {
      loadFavorites();
    });
    return () => unsubscribe();
  }, []);

  const loadFavorites = async () => {
    const s = await getFavoriteSurahs();
    const a = await getFavoriteAyahs();
    setFavSurahs(s);
    setFavAyahs(a);
  };

  const handleSelectSurah = (surah: Surah) => {
    navigation.navigate('Surah', {
      surahNumber: surah.number,
      surahName: surah.name,
      englishName: surah.englishName,
    });
  };

  const handleRemoveSurah = async (surah: Surah) => {
    await toggleFavoriteSurah(surah);
  };

  const handleRemoveAyah = async (item: FavoriteAyahItem) => {
    await toggleFavoriteAyah(item);
  };

  const handleAyahPress = (item: FavoriteAyahItem) => {
    setSelectedAyah(item.ayah);
    setSelectedSurahName(item.englishName);
    setIsModalVisible(true);
  };

  const handlePlayVerse = async (verse: Ayah) => {
    const targetItem = favAyahs.find((i) => i.ayah.number === verse.number);
    if (!targetItem) return;
    const url = await getEffectiveAudioUrl(targetItem.surahNumber);
    await playAyahOnly(url, targetItem.surahNumber, verse.numberInSurah);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      {/* En-tête */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.titleRow}>
          <TouchableOpacity
            style={[styles.themeBtn, { backgroundColor: colors.bgSecondary, borderColor: colors.border, marginRight: 10 }]}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.gold }]} numberOfLines={1}>VOS FAVORIS</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
              Sourates et Versets sauvegardés
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.themeBtn, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}
            onPress={toggleTheme}
          >
            <Ionicons
              name={isDark ? 'sunny' : 'moon'}
              size={20}
              color={isDark ? colors.gold : colors.textPrimary}
            />
          </TouchableOpacity>
        </View>

        {/* Onglets */}
        <View style={[styles.tabContainer, { backgroundColor: colors.bgSecondary }]}>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              { backgroundColor: activeTab === 'surahs' ? colors.gold : 'transparent' },
            ]}
            onPress={() => setActiveTab('surahs')}
          >
            <Text
              style={[
                styles.tabBtnText,
                { color: activeTab === 'surahs' ? colors.onGold : colors.textSecondary },
              ]}
            >
              Sourates ({favSurahs.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabBtn,
              { backgroundColor: activeTab === 'ayahs' ? colors.gold : 'transparent' },
            ]}
            onPress={() => setActiveTab('ayahs')}
          >
            <Text
              style={[
                styles.tabBtnText,
                { color: activeTab === 'ayahs' ? colors.onGold : colors.textSecondary },
              ]}
            >
              Versets ({favAyahs.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Contenu principal */}
      {activeTab === 'surahs' ? (
        <FlatList
          data={favSurahs}
          keyExtractor={(item) => item.number.toString()}
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <View style={{ flex: 1 }}>
                <SurahCard surah={item} onPress={handleSelectSurah} />
              </View>
              <TouchableOpacity
                style={[styles.removeBtn, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}
                onPress={() => handleRemoveSurah(item)}
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>
          )}
          contentContainerStyle={styles.listPadding}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="heart-dislike-outline" size={54} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                Aucune sourate favorite
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Cliquez sur l'icône cœur pour ajouter des sourates à vos favoris.
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={favAyahs}
          keyExtractor={(item) => item.ayah.number.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.ayahCard,
                {
                  backgroundColor: colors.bgCard,
                  borderColor: colors.border,
                  shadowColor: colors.cardShadow,
                },
              ]}
              onPress={() => handleAyahPress(item)}
              activeOpacity={0.7}
            >
              <View style={styles.ayahHeader}>
                <Text style={[styles.ayahSurahName, { color: colors.gold }]}>
                  {item.englishName} - Verset {item.ayah.numberInSurah}
                </Text>
                <TouchableOpacity onPress={() => handleRemoveAyah(item)}>
                  <Ionicons name="close" size={20} color={colors.danger} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.arabicText, { color: colors.textPrimary }]}>
                {item.ayah.text}
              </Text>
              {item.ayah.translation ? (
                <Text style={[styles.translationText, { color: colors.textSecondary }]}>
                  {item.ayah.translation}
                </Text>
              ) : null}
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listPadding}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="bookmark-outline" size={54} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                Aucun verset favori
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Enregistrez des versets depuis la lecture d'une sourate.
              </Text>
            </View>
          }
        />
      )}

      {/* Pop-up Modal pour le verset */}
      <VerseModal
        visible={isModalVisible}
        ayah={selectedAyah}
        surahName={selectedSurahName}
        onClose={() => setIsModalVisible(false)}
        onPlayVerse={handlePlayVerse}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 1.2,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  themeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    marginTop: 14,
    borderRadius: 12,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  listPadding: {
    paddingVertical: 12,
    paddingBottom: 130,
  },
  cardWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
  },
  removeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  ayahCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    elevation: 2,
  },
  ayahHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ayahSurahName: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  arabicText: {
    fontSize: 20,
    lineHeight: 38,
    textAlign: 'right',
  },
  translationText: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    fontStyle: 'italic',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
  },
});
