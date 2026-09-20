import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import {
  getLastReadPosition,
  subscribeBookmarkChange,
  LastReadBookmark,
} from '../services/bookmarkService';
import { getTodayFormattedDates } from '../services/hijriService';
import { getArabicFontSize, setArabicFontSize } from '../services/settingsService';
import { MushafPageOrientation, TranslationLanguage } from '../types/quran';
import { SadaqahBanner } from '../components/SadaqahBanner';
import { SettingsModal } from '../components/SettingsModal';
import { ContactModal } from '../components/ContactModal';
import { SadaqahModal } from '../components/SadaqahModal';

export const HomeScreen: React.FC<any> = ({ navigation }) => {
  const { colors, isDark, toggleTheme } = useTheme();
  const { width } = useWindowDimensions();

  const [lastBookmark, setLastBookmark] = useState<LastReadBookmark | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isContactOpen, setIsContactOpen] = useState<boolean>(false);
  const [isSadaqahOpen, setIsSadaqahOpen] = useState<boolean>(false);

  const [orientation, setOrientation] = useState<MushafPageOrientation>('vertical');
  const [arabicFontSize, setArabicFontSizeState] = useState<number>(24);
  const [translationLang, setTranslationLang] = useState<TranslationLanguage>('fr');

  const todayDates = getTodayFormattedDates();

  // Responsivité dynamique du quadrillage des cartes
  const numColumns = width >= 600 ? 6 : width < 340 ? 2 : 3;
  const paddingHorizontal = 14;
  const gap = 8;
  const availableWidth = width - (paddingHorizontal * 2) - (gap * (numColumns - 1));
  const cardWidth = Math.floor(availableWidth / numColumns);

  useEffect(() => {
    loadBookmark();
    loadSettings();

    const unsub = subscribeBookmarkChange((bookmark) => {
      setLastBookmark(bookmark);
    });
    return () => unsub();
  }, []);

  const loadSettings = async () => {
    const size = await getArabicFontSize();
    setArabicFontSizeState(size);
  };

  const loadBookmark = async () => {
    const b = await getLastReadPosition();
    setLastBookmark(b);
  };

  const handleResumeReading = () => {
    if (lastBookmark) {
      navigation.navigate('Surah', {
        surahNumber: lastBookmark.surahNumber,
        surahName: lastBookmark.surahName,
        englishName: lastBookmark.englishName,
        initialVerseNumber: lastBookmark.verseNumber,
      });
    }
  };

  const handleFontChange = async (delta: number) => {
    const nextSize = await setArabicFontSize(arabicFontSize + delta);
    setArabicFontSizeState(nextSize);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bgPrimary}
      />

      {/* Barre de Titre App */}
      <View style={[styles.topBar, { backgroundColor: colors.bgPrimary, borderBottomColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.gold }]}>AL BARAKA</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            Récitation de Serigne Aboul Baraka Mbacké
          </Text>
        </View>

        <View style={styles.topRightBtns}>
          {/* Bouton Contact 📞 */}
          <TouchableOpacity
            style={[styles.iconTopBtn, { backgroundColor: colors.bgSecondary, borderColor: colors.border, marginRight: 6 }]}
            onPress={() => setIsContactOpen(true)}
          >
            <Ionicons name="call-outline" size={18} color={colors.gold} />
          </TouchableOpacity>

          {/* Bouton Paramètres ⚙️ */}
          <TouchableOpacity
            style={[styles.iconTopBtn, { backgroundColor: colors.bgSecondary, borderColor: colors.border, marginRight: 6 }]}
            onPress={() => setIsSettingsOpen(true)}
          >
            <Ionicons name="settings-outline" size={18} color={colors.gold} />
          </TouchableOpacity>

          {/* Bouton Thème */}
          <TouchableOpacity
            style={[styles.iconTopBtn, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}
            onPress={toggleTheme}
          >
            <Ionicons
              name={isDark ? 'sunny' : 'moon'}
              size={18}
              color={isDark ? colors.gold : colors.textPrimary}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Carte En-tête Hégirienne & Basmala */}
        <View style={[styles.dateCard, { backgroundColor: '#A8E6C1', borderColor: colors.gold }]}>
          <Text style={styles.basmalaText}>{todayDates.basmalaText}</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateBox}>
              <Ionicons name="calendar-outline" size={14} color="#0F4C2E" style={{ marginRight: 6 }} />
              <Text style={styles.hijriText}>{todayDates.hijriFormatted}</Text>
            </View>
            <Text style={styles.gregorianText}>{todayDates.gregorianFormatted}</Text>
          </View>
        </View>

        {/* Grille de 6 cartes Responsives */}
        <View style={[styles.featureGrid, { gap }]}>
          {/* 1. Écouter Coran MP3 */}
          <TouchableOpacity
            style={[
              styles.gridCard,
              { width: cardWidth, backgroundColor: colors.bgCard, borderColor: colors.border },
            ]}
            onPress={() => navigation.navigate('AudioTab')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIconBadge, { backgroundColor: 'rgba(212, 175, 55, 0.15)' }]}>
              <Ionicons name="headset" size={22} color={colors.gold} />
            </View>
            <Text style={[styles.gridCardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              Écouter MP3
            </Text>
            <Text style={[styles.gridCardSub, { color: colors.textSecondary }]} numberOfLines={1}>
              Serigne Aboul Baraka
            </Text>
          </TouchableOpacity>

          {/* 2. Mushaf (Lecture) */}
          <TouchableOpacity
            style={[
              styles.gridCard,
              { width: cardWidth, backgroundColor: colors.bgCard, borderColor: colors.border },
            ]}
            onPress={() => navigation.navigate('MushafTab')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIconBadge, { backgroundColor: 'rgba(212, 175, 55, 0.15)' }]}>
              <Ionicons name="book" size={22} color={colors.gold} />
            </View>
            <Text style={[styles.gridCardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              Mushaf (Lecture)
            </Text>
            <Text style={[styles.gridCardSub, { color: colors.textSecondary }]} numberOfLines={1}>
              Riwaya Warsh
            </Text>
          </TouchableOpacity>


          {/* 4. Chapelet (Tasbih) */}
          <TouchableOpacity
            style={[
              styles.gridCard,
              { width: cardWidth, backgroundColor: colors.bgCard, borderColor: colors.border },
            ]}
            onPress={() => navigation.navigate('TasbihTab')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIconBadge, { backgroundColor: 'rgba(212, 175, 55, 0.15)' }]}>
              <Ionicons name="disc" size={22} color={colors.gold} />
            </View>
            <Text style={[styles.gridCardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              Chapelet
            </Text>
            <Text style={[styles.gridCardSub, { color: colors.textSecondary }]} numberOfLines={1}>
              Tasbih / Zikr
            </Text>
          </TouchableOpacity>

          {/* 6. Favoris */}
          <TouchableOpacity
            style={[
              styles.gridCard,
              { width: cardWidth, backgroundColor: colors.bgCard, borderColor: colors.border },
            ]}
            onPress={() => navigation.navigate('Favorites')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIconBadge, { backgroundColor: 'rgba(212, 175, 55, 0.15)' }]}>
              <Ionicons name="heart" size={22} color={colors.gold} />
            </View>
            <Text style={[styles.gridCardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              Favoris
            </Text>
            <Text style={[styles.gridCardSub, { color: colors.textSecondary }]} numberOfLines={1}>
              Sourates et versets
            </Text>
          </TouchableOpacity>

          {/* 7. Hadiya / Don - Ouvre directement la modal */}
          <TouchableOpacity
            style={[
              styles.gridCard,
              { width: cardWidth, backgroundColor: colors.bgCard, borderColor: colors.border },
            ]}
            onPress={() => setIsSadaqahOpen(true)}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIconBadge, { backgroundColor: 'rgba(212, 175, 55, 0.15)' }]}>
              <Ionicons name="heart" size={22} color={colors.gold} />
            </View>
            <Text style={[styles.gridCardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              Hadiya / Don
            </Text>
            <Text style={[styles.gridCardSub, { color: colors.textSecondary }]} numberOfLines={1}>
              Sadaqah Jariyah
            </Text>
          </TouchableOpacity>
        </View>

        {/* Carte Reprendre la lecture (Signet / Marque-page) */}
        {lastBookmark && (
          <TouchableOpacity
            style={[
              styles.bookmarkCard,
              { backgroundColor: colors.bgSecondary, borderColor: colors.gold },
            ]}
            onPress={handleResumeReading}
            activeOpacity={0.8}
          >
            <View style={styles.bookmarkLeft}>
              <Ionicons name="bookmark" size={22} color={colors.gold} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.bookmarkLabel, { color: colors.gold }]}>REPRENDRE LA LECTURE</Text>
                <Text style={[styles.bookmarkTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {lastBookmark.englishName} ({lastBookmark.surahName}) • Verset {lastBookmark.verseNumber}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.gold} />
          </TouchableOpacity>
        )}

        {/* Bannière Sadaqah Don */}
        <TouchableOpacity onPress={() => setIsSadaqahOpen(true)} activeOpacity={0.95}>
          <SadaqahBanner />
        </TouchableOpacity>
      </ScrollView>

      {/* Settings Modal */}
      <SettingsModal
        visible={isSettingsOpen}
        orientation={orientation}
        fontSize={arabicFontSize}
        translationLang={translationLang}
        onClose={() => setIsSettingsOpen(false)}
        onToggleOrientation={(mode) => setOrientation(mode)}
        onChangeFontSize={handleFontChange}
        onChangeTranslationLang={(lang) => setTranslationLang(lang)}
      />

      {/* Contact Modal */}
      <ContactModal
        visible={isContactOpen}
        onClose={() => setIsContactOpen(false)}
      />

      {/* Sadaqah Modal */}
      <SadaqahModal
        visible={isSadaqahOpen}
        onClose={() => setIsSadaqahOpen(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  topRightBtns: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconTopBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingTop: 14,
    paddingBottom: 120,
  },
  dateCard: {
    marginHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 14,
    alignItems: 'center',
  },
  basmalaText: {
    color: '#0F4C2E',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 4,
  },
  dateBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hijriText: {
    color: '#0F4C2E',
    fontSize: 12,
    fontWeight: 'bold',
  },
  gregorianText: {
    color: '#3D7A5C',
    fontSize: 11,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  gridCard: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  gridIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  gridCardTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  gridCardSub: {
    fontSize: 9.5,
    marginTop: 2,
    textAlign: 'center',
  },
  bookmarkCard: {
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bookmarkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  bookmarkLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  bookmarkTitle: {
    fontSize: 12.5,
    fontWeight: 'bold',
    marginTop: 2,
  },
});
