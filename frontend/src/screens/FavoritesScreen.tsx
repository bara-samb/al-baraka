import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { surahNameAr, surahNameLatin, surahVerseCount, toArabicDigits } from '../services/warshMushafService';
import { Surah } from '../types/quran';
import { Toast, useToast } from '../components/Toast';
import { FavoritesScreenProps, MushafPlayRequest } from '../navigation/types';

/** Onglet Favoris : sourates et versets enregistrés, à écouter (une fois ou en boucle) dans le Mushaf. */
export const FavoritesScreen: React.FC<FavoritesScreenProps> = ({ navigation }) => {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<'surahs' | 'ayahs'>('surahs');
  const [favSurahs, setFavSurahs] = useState<Surah[]>([]);
  const [favAyahs, setFavAyahs] = useState<FavoriteAyahItem[]>([]);
  const toast = useToast();

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

  useEffect(() => {
    loadFavorites();
    return subscribeFavoritesChange(loadFavorites);
  }, []);

  /**
   * Ouvre le Mushaf au verset (ou au début de la sourate) et, avec `play`, lance la récitation
   * là-bas : le verset récité y est surligné, on écoute et on lit en même temps.
   */
  const openInMushaf = (surah: number, ayah: number, play?: MushafPlayRequest) => {
    navigation.navigate('MushafTab', { surah, ayah, at: Date.now(), highlight: false, play });
  };

  const removeSurah = async (surah: Surah) => {
    await toggleFavoriteSurah(surah);
    toast.show(`${surahNameLatin(surah.number)} retirée des favoris`);
  };

  const removeAyah = async (item: FavoriteAyahItem) => {
    await toggleFavoriteAyah(item);
    toast.show(`${surahNameLatin(item.surahNumber)} ${item.ayah.numberInSurah} retiré des favoris`);
  };

  /** Cœur plein : un toucher retire le favori. */
  const renderHeart = (label: string, onPress: () => void) => (
    <TouchableOpacity
      accessibilityLabel={`Retirer ${label} des favoris`}
      style={[styles.heartBtn, { backgroundColor: colors.goldTint }]}
      onPress={onPress}
      hitSlop={6}
    >
      <Ionicons name="heart" size={17} color={colors.gold} />
    </TouchableOpacity>
  );

  /** Boutons « Écouter » et « En boucle » d'une sourate ou d'un verset. */
  const renderPlayButtons = (onPlay: (loop: boolean) => void) => (
    <View style={styles.playRow}>
      {([false, true] as const).map((loop) => (
        <TouchableOpacity
          key={String(loop)}
          style={[styles.playBtn, loop ? { borderColor: colors.gold } : { backgroundColor: colors.gold, borderColor: colors.gold }]}
          onPress={() => onPlay(loop)}
          activeOpacity={0.8}
        >
          <Ionicons name={loop ? 'repeat' : 'play'} size={14} color={loop ? colors.gold : colors.onGold} />
          <Text style={[styles.playBtnText, { color: loop ? colors.gold : colors.onGold }]}>{loop ? 'En boucle' : 'Écouter'}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderEmpty = (icon: keyof typeof Ionicons.glyphMap, title: string, hint: string) => (
    <View style={styles.centered}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.goldTint }]}>
        <Ionicons name={icon} size={30} color={colors.gold} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>{hint}</Text>
    </View>
  );

  const renderTab = (key: 'surahs' | 'ayahs', label: string) => {
    const active = activeTab === key;
    return (
      <TouchableOpacity style={[styles.tabBtn, active && { backgroundColor: colors.gold }]} onPress={() => setActiveTab(key)}>
        <Text style={[styles.tabBtnText, { color: active ? colors.onGold : colors.textSecondary }]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]} edges={['top', 'left', 'right']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Mes favoris</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Écoutez-les une fois ou en boucle, en suivant le texte dans le Mushaf
        </Text>
        <View style={[styles.tabContainer, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
          {renderTab('surahs', `Sourates (${favSurahs.length})`)}
          {renderTab('ayahs', `Versets (${favAyahs.length})`)}
        </View>
      </View>

      {activeTab === 'surahs' ? (
        <FlatList
          data={favSurahs}
          keyExtractor={(item) => item.number.toString()}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <TouchableOpacity style={styles.surahRow} onPress={() => openInMushaf(item.number, 1)} activeOpacity={0.7}>
                <View style={[styles.numberBadge, { borderColor: colors.gold }]}>
                  <Text style={[styles.numberText, { color: colors.gold }]}>{item.number}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.surahName, { color: colors.textPrimary }]}>{surahNameLatin(item.number)}</Text>
                  <Text style={[styles.surahMeta, { color: colors.textSecondary }]}>
                    {surahVerseCount(item.number)} versets · ouvrir dans le Mushaf
                  </Text>
                </View>
                <Text style={[styles.surahArabic, { color: colors.gold }]}>{surahNameAr(item.number)}</Text>
              </TouchableOpacity>
              <View style={styles.cardFooter}>
                {renderPlayButtons((loop) => openInMushaf(item.number, 1, loop ? 'surahLoop' : 'surah'))}
                {renderHeart(surahNameLatin(item.number), () => removeSurah(item))}
              </View>
            </View>
          )}
          contentContainerStyle={styles.listPadding}
          ListEmptyComponent={renderEmpty(
            'book-outline',
            'Aucune sourate favorite',
            'Touchez le cœur à côté du nom d’une sourate, dans l’Index du Mushaf ou dans le Lecteur.'
          )}
        />
      ) : (
        <FlatList
          data={favAyahs}
          keyExtractor={(item) => `${item.surahNumber}:${item.ayah.numberInSurah}`}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('Verse', { surah: item.surahNumber, ayah: item.ayah.numberInSurah, title: 'Verset favori' })
                }
                activeOpacity={0.7}
              >
                <Text style={[styles.verseRef, { color: colors.gold }]}>
                  {surahNameLatin(item.surahNumber)} · verset {item.ayah.numberInSurah}
                </Text>
                <Text style={[styles.arabicText, { color: colors.textPrimary }]}>
                  {item.ayah.text.replace(/۞\s*/g, '')} {toArabicDigits(item.ayah.numberInSurah)}
                </Text>
                {item.ayah.translation ? (
                  <Text style={[styles.translationText, { color: colors.textSecondary }]}>{item.ayah.translation}</Text>
                ) : null}
              </TouchableOpacity>
              <View style={styles.cardFooter}>
                {renderPlayButtons((loop) => openInMushaf(item.surahNumber, item.ayah.numberInSurah, loop ? 'verseLoop' : 'verse'))}
                {renderHeart(`le verset ${item.ayah.numberInSurah}`, () => removeAyah(item))}
              </View>
            </View>
          )}
          contentContainerStyle={styles.listPadding}
          ListEmptyComponent={renderEmpty(
            'bookmark-outline',
            'Aucun verset favori',
            'Dans le Mushaf, touchez un verset puis « Ajouter le verset aux favoris ».'
          )}
        />
      )}

      <Toast text={toast.text} opacity={toast.opacity} background={colors.accentBg} border={colors.gold} color={colors.accentText} top={70} />
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
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
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  surahRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  numberBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  numberText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  surahName: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  surahMeta: {
    fontSize: 11.5,
    marginTop: 2,
  },
  surahArabic: {
    fontFamily: 'KFGQPC_Warsh',
    fontSize: 22,
    marginLeft: 10,
    writingDirection: 'rtl',
  },
  verseRef: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  arabicText: {
    fontFamily: 'KFGQPC_Warsh',
    fontSize: 22,
    lineHeight: 42,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: 6,
  },
  translationText: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
    fontStyle: 'italic',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  playRow: {
    flexDirection: 'row',
    gap: 8,
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
  heartBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 30,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 6,
  },
});
