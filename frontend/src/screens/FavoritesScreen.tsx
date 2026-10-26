import React, { useState, useEffect, useRef } from 'react';
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
import { Surah } from '../types/quran';
import { SurahCard } from '../components/SurahCard';
import { FavoritesScreenProps, MushafPlayRequest } from '../navigation/types';

export const FavoritesScreen: React.FC<FavoritesScreenProps> = ({ navigation }) => {
  const { colors, isDark, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'surahs' | 'ayahs'>('surahs');
  const [favSurahs, setFavSurahs] = useState<Surah[]>([]);
  const [favAyahs, setFavAyahs] = useState<FavoriteAyahItem[]>([]);

  useEffect(() => {
    loadFavorites();
    const unsubscribe = subscribeFavoritesChange(() => {
      loadFavorites();
    });
    return () => unsubscribe();
  }, []);

  // Premier chargement : l'onglet Versets s'ouvre d'emblée s'il n'y a que des versets.
  const firstLoadRef = useRef(true);

  const loadFavorites = async () => {
    const s = await getFavoriteSurahs();
    const a = await getFavoriteAyahs();
    setFavSurahs(s);
    setFavAyahs(a);
    if (firstLoadRef.current && s.length === 0 && a.length > 0) setActiveTab('ayahs');
    firstLoadRef.current = false;
  };

  // Une sourate s'ouvre dans le Mushaf, à son premier verset.
  const handleSelectSurah = (surah: Surah) => openInMushaf(surah.number, 1);

  /**
   * Ouvre le Mushaf au verset (ou au début de la sourate) et, avec `play`, lance la récitation
   * là-bas : le verset récité y est surligné, on écoute et on lit en même temps.
   */
  const openInMushaf = (surah: number, ayah: number, play?: MushafPlayRequest) => {
    navigation.navigate('MainTabs', {
      screen: 'MushafTab',
      params: { surah, ayah, at: Date.now(), highlight: false, play },
    });
  };

  /** Boutons « Écouter » et « En boucle » d'une sourate ou d'un verset. */
  const renderPlayButtons = (onPlay: (loop: boolean) => void) => (
    <View style={styles.playRow}>
      {([false, true] as const).map((loop) => (
        <TouchableOpacity
          key={String(loop)}
          style={[styles.playBtn, { borderColor: colors.gold }]}
          onPress={() => onPlay(loop)}
          activeOpacity={0.8}
        >
          <Ionicons name={loop ? 'repeat' : 'play'} size={14} color={colors.gold} />
          <Text style={[styles.playBtnText, { color: colors.gold }]}>{loop ? 'En boucle' : 'Écouter'}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const handleRemoveSurah = async (surah: Surah) => {
    await toggleFavoriteSurah(surah);
  };

  const handleRemoveAyah = async (item: FavoriteAyahItem) => {
    await toggleFavoriteAyah(item);
  };

  // Un verset s'ouvre sur sa page : texte entier, traductions, partage.
  const handleAyahPress = (item: FavoriteAyahItem) => {
    navigation.navigate('Verse', { surah: item.surahNumber, ayah: item.ayah.numberInSurah, title: 'Verset favori' });
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
            <View>
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
              <View style={styles.surahPlay}>{renderPlayButtons((loop) => openInMushaf(item.number, 1, loop ? 'surahLoop' : 'surah'))}</View>
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
                Dans le Lecteur, touchez le cœur d'une sourate pour l'ajouter ici.
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={favAyahs}
          keyExtractor={(item) => `${item.surahNumber}:${item.ayah.numberInSurah}`}
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
                  {item.englishName} · verset {item.ayah.numberInSurah}
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
              {renderPlayButtons((loop) => openInMushaf(item.surahNumber, item.ayah.numberInSurah, loop ? 'verseLoop' : 'verse'))}
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listPadding}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="heart-outline" size={54} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                Aucun verset favori
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Dans le Mushaf, touchez un verset puis « Ajouter aux favoris ».
              </Text>
            </View>
          }
        />
      )}
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
  playRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  playBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  surahPlay: {
    paddingHorizontal: 16,
    marginTop: -4,
    marginBottom: 10,
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
