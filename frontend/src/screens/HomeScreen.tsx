import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import {
  getLastReadPosition,
  subscribeBookmarkChange,
  LastReadBookmark,
} from '../services/bookmarkService';
import { getTodayFormattedDates } from '../services/hijriService';
import { getArabicFontSize, setArabicFontSize, subscribeFontSizeChange } from '../services/settingsService';
import { MUSHAF_VERSES, MushafVerse, surahNameAr, surahNameLatin } from '../services/warshMushafService';
import { playAyahOnly, stopAudioTrack, subscribeAudioStatus } from '../services/audioService';
import { getEffectiveAudioUrl } from '../services/downloadService';
import { SettingsModal } from '../components/SettingsModal';
import { ContactModal } from '../components/ContactModal';
import { SadaqahModal } from '../components/SadaqahModal';

// Verset du jour : un verset de longueur moyenne (ni lettres isolées, ni passage trop long
// pour une carte), le même pour tout le monde pendant une journée.
const DAILY_CANDIDATES = MUSHAF_VERSES.filter((v) => v.text.length >= 60 && v.text.length <= 200);
const verseOfTheDay = (): MushafVerse => {
  const now = new Date();
  const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
  // Grand nombre premier : les versets de deux jours voisins sont éloignés dans le Coran.
  return DAILY_CANDIDATES[(day * 7919) % DAILY_CANDIDATES.length];
};

export const HomeScreen: React.FC<any> = ({ navigation }) => {
  const { colors, isDark, toggleTheme } = useTheme();

  const [lastBookmark, setLastBookmark] = useState<LastReadBookmark | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isContactOpen, setIsContactOpen] = useState<boolean>(false);
  const [isSadaqahOpen, setIsSadaqahOpen] = useState<boolean>(false);
  const [arabicFontSize, setArabicFontSizeState] = useState<number>(24);
  // Le verset du jour est en cours de lecture (lancé depuis cette carte).
  const [dailyPlaying, setDailyPlaying] = useState<boolean>(false);

  const todayDates = getTodayFormattedDates();
  const daily = verseOfTheDay();

  useEffect(() => {
    getLastReadPosition().then(setLastBookmark);
    getArabicFontSize().then(setArabicFontSizeState);
    const unsub = subscribeBookmarkChange(setLastBookmark);
    const unsubFont = subscribeFontSizeChange(setArabicFontSizeState);
    const unsubAudio = subscribeAudioStatus((status) => {
      if (!status.isPlaying) setDailyPlaying(false);
    });
    return () => {
      unsub();
      unsubFont();
      unsubAudio();
    };
  }, []);

  // Sans historique, « Reprendre » propose de commencer par Al-Fatiha.
  const resumeSurah = lastBookmark?.surahNumber ?? 1;
  const resumeAyah = lastBookmark?.verseNumber ?? 1;

  const listen = (surah: number, ayah: number) =>
    navigation.navigate('AudioTab', { surah, ayah, at: Date.now() });
  const read = (surah: number, ayah: number) =>
    navigation.navigate('MushafTab', { surah, ayah, at: Date.now() });

  const toggleDailyVerse = async () => {
    if (dailyPlaying) {
      await stopAudioTrack();
      setDailyPlaying(false);
      return;
    }
    const url = await getEffectiveAudioUrl(daily.surah);
    const ok = await playAyahOnly(url, daily.surah, daily.ayah);
    setDailyPlaying(ok);
  };

  const handleFontChange = async (delta: number) => {
    const nextSize = await setArabicFontSize(arabicFontSize + delta);
    setArabicFontSizeState(nextSize);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bgPrimary} />

      {/* Barre de titre */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>AL BARAKA</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            Récitation de Serigne Aboul Baraka Mbacké
          </Text>
        </View>
        {[
          { icon: 'call-outline' as const, onPress: () => setIsContactOpen(true), label: 'Contact' },
          { icon: 'settings-outline' as const, onPress: () => setIsSettingsOpen(true), label: 'Paramètres' },
          { icon: isDark ? ('sunny-outline' as const) : ('moon-outline' as const), onPress: toggleTheme, label: 'Thème' },
        ].map((b) => (
          <TouchableOpacity
            key={b.label}
            accessibilityLabel={b.label}
            style={[styles.iconTopBtn, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}
            onPress={b.onPress}
          >
            <Ionicons name={b.icon} size={18} color={colors.gold} />
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Basmala et date */}
        <View style={[styles.dateCard, { backgroundColor: colors.accentBg }]}>
          <Text style={[styles.basmalaText, { color: colors.accentText }]}>{todayDates.basmalaText}</Text>
          <View style={styles.dateRow}>
            <Text style={[styles.hijriText, { color: colors.accentText }]}>{todayDates.hijriFormatted}</Text>
            <Text style={[styles.gregorianText, { color: colors.accentSub }]}>{todayDates.gregorianFormatted}</Text>
          </View>
        </View>

        {/* Reprendre */}
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.gold }]}>{lastBookmark ? 'REPRENDRE' : 'COMMENCER'}</Text>
          <View style={styles.resumeRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.resumeTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {surahNameLatin(resumeSurah)}
              </Text>
              <Text style={[styles.resumeSub, { color: colors.textSecondary }]}>
                Sourate {resumeSurah} · verset {resumeAyah}
              </Text>
            </View>
            <Text style={[styles.resumeArabic, { color: colors.emerald }]} numberOfLines={1}>
              {surahNameAr(resumeSurah)}
            </Text>
          </View>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.gold }]}
              onPress={() => listen(resumeSurah, resumeAyah)}
              activeOpacity={0.85}
            >
              <Ionicons name="play" size={16} color={colors.onGold} />
              <Text style={[styles.btnText, { color: colors.onGold }]}>Écouter</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: colors.gold }]}
              onPress={() => read(resumeSurah, resumeAyah)}
              activeOpacity={0.85}
            >
              <Ionicons name="book-outline" size={16} color={colors.gold} />
              <Text style={[styles.btnText, { color: colors.gold }]}>Lire</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Verset du jour */}
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.gold }]}>VERSET DU JOUR</Text>
          <Text
            style={[
              styles.dailyArabic,
              { color: colors.textPrimary, fontSize: arabicFontSize, lineHeight: arabicFontSize * 1.9 },
            ]}
          >
            {daily.text}
          </Text>
          <View style={styles.dailyFooter}>
            <Text style={[styles.dailyRef, { color: colors.textSecondary }]} numberOfLines={1}>
              {surahNameLatin(daily.surah)} · {daily.surah}:{daily.ayah}
            </Text>
            <TouchableOpacity
              accessibilityLabel={dailyPlaying ? 'Arrêter le verset' : 'Écouter le verset'}
              style={[styles.roundBtn, { backgroundColor: colors.goldTint }]}
              onPress={toggleDailyVerse}
            >
              <Ionicons name={dailyPlaying ? 'stop' : 'play'} size={16} color={colors.gold} />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel="Lire dans le Mushaf"
              style={[styles.roundBtn, { backgroundColor: colors.goldTint }]}
              onPress={() => read(daily.surah, daily.ayah)}
            >
              <Ionicons name="book-outline" size={16} color={colors.gold} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Raccourci absent de la barre d'onglets */}
        <TouchableOpacity
          style={[styles.rowCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
          onPress={() => navigation.navigate('Favorites')}
          activeOpacity={0.8}
        >
          <View style={[styles.rowIcon, { backgroundColor: colors.goldTint }]}>
            <Ionicons name="heart" size={18} color={colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Mes favoris</Text>
            <Text style={[styles.rowSub, { color: colors.textSecondary }]}>Sourates et versets enregistrés</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Sadaqah, discret : l'onglet du bas reste l'accès principal */}
        <TouchableOpacity style={styles.sadaqahLink} onPress={() => setIsSadaqahOpen(true)} activeOpacity={0.7}>
          <Ionicons name="heart-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.sadaqahText, { color: colors.textSecondary }]}>
            Application gratuite ·{' '}
            <Text style={{ color: colors.gold, fontWeight: 'bold' }}>Soutenir par une Sadaqah</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <SettingsModal
        visible={isSettingsOpen}
        fontSize={arabicFontSize}
        onClose={() => setIsSettingsOpen(false)}
        onChangeFontSize={handleFontChange}
      />
      <ContactModal visible={isContactOpen} onClose={() => setIsContactOpen(false)} />
      <SadaqahModal visible={isSadaqahOpen} onClose={() => setIsSadaqahOpen(false)} />
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
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  iconTopBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 120,
    gap: 12,
  },
  dateCard: {
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  basmalaText: {
    fontFamily: 'KFGQPC_Warsh',
    fontSize: 24,
    lineHeight: 42,
    textAlign: 'center',
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 6,
  },
  hijriText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  gregorianText: {
    fontSize: 11,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  cardLabel: {
    fontSize: 10.5,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  resumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  resumeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  resumeSub: {
    fontSize: 12,
    marginTop: 2,
  },
  resumeArabic: {
    fontFamily: 'KFGQPC_Warsh',
    fontSize: 26,
    lineHeight: 44,
    marginLeft: 10,
    maxWidth: '45%',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 12,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  btnText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  dailyArabic: {
    fontFamily: 'KFGQPC_Warsh',
    textAlign: 'center',
    writingDirection: 'rtl',
    marginTop: 10,
  },
  dailyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  dailyRef: {
    flex: 1,
    fontSize: 12,
  },
  roundBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  rowSub: {
    fontSize: 11.5,
    marginTop: 1,
  },
  sadaqahLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  sadaqahText: {
    fontSize: 12,
    textAlign: 'center',
    flexShrink: 1,
  },
});
