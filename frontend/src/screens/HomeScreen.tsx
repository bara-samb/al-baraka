import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import {
  getLastListenPosition,
  getLastReadPosition,
  subscribeBookmarkChange,
  subscribeListenChange,
  LastListenPosition,
  LastReadBookmark,
} from '../services/bookmarkService';
import { getTodayFormattedDates } from '../services/hijriService';
import { getArabicFontSize, setArabicFontSize, subscribeFontSizeChange } from '../services/settingsService';
import { MUSHAF_VERSES, MushafVerse, pageOfVerse, surahNameLatin } from '../services/warshMushafService';
import { playAyahOnly, stopAudioTrack, subscribeAudioStatus } from '../services/audioService';
import { getEffectiveAudioUrl } from '../services/downloadService';
import { SettingsModal } from '../components/SettingsModal';
import { ContactModal } from '../components/ContactModal';
import { SadaqahModal } from '../components/SadaqahModal';
import { PaymentBadges } from '../components/PaymentBadges';

const reciterPhoto = require('../assets/serigne_abdou_bara.jpg');

// Verset du jour : tout verset sauf les plus brefs (lettres isolées), le même pour tout le
// monde pendant une journée. La carte n'en montre que le début (« Voir plus »).
const DAILY_CANDIDATES = MUSHAF_VERSES.filter((v) => v.text.length >= 50);
const verseOfTheDay = (): MushafVerse => {
  const now = new Date();
  const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
  // Grand nombre premier : les versets de deux jours voisins sont éloignés dans le Coran.
  return DAILY_CANDIDATES[(day * 7919) % DAILY_CANDIDATES.length];
};

export const HomeScreen: React.FC<any> = ({ navigation }) => {
  const { colors, isDark, toggleTheme } = useTheme();

  const [lastRead, setLastRead] = useState<LastReadBookmark | null>(null);
  const [lastListen, setLastListen] = useState<LastListenPosition | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isContactOpen, setIsContactOpen] = useState<boolean>(false);
  const [isSadaqahOpen, setIsSadaqahOpen] = useState<boolean>(false);
  const [arabicFontSize, setArabicFontSizeState] = useState<number>(24);
  // Le verset du jour est en cours de lecture (lancé depuis cette carte).
  const [dailyPlaying, setDailyPlaying] = useState<boolean>(false);

  const todayDates = getTodayFormattedDates();
  const daily = verseOfTheDay();

  useEffect(() => {
    getLastReadPosition().then(setLastRead);
    getLastListenPosition().then(setLastListen);
    getArabicFontSize().then(setArabicFontSizeState);
    const unsub = subscribeBookmarkChange(setLastRead);
    const unsubListen = subscribeListenChange(setLastListen);
    const unsubFont = subscribeFontSizeChange(setArabicFontSizeState);
    const unsubAudio = subscribeAudioStatus((status) => {
      if (!status.isPlaying) setDailyPlaying(false);
    });
    return () => {
      unsub();
      unsubListen();
      unsubFont();
      unsubAudio();
    };
  }, []);

  // Sans historique, « Reprendre » propose de commencer par Al-Fatiha.
  const listen = (surah: number, ayah: number) =>
    navigation.navigate('AudioTab', { surah, ayah, at: Date.now() });
  const read = (surah: number, ayah: number) =>
    navigation.navigate('MushafTab', { surah, ayah, at: Date.now(), highlight: false });

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
        <Image
          source={reciterPhoto}
          style={[styles.photo, { borderColor: colors.gold }]}
          accessibilityLabel="Serigne Aboul Baraka Mbacké"
        />
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

        {/* Reprendre : l'écoute et la lecture du Mushaf ont chacune leur position */}
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.gold }]}>
            {lastListen || lastRead ? 'REPRENDRE' : 'COMMENCER'}
          </Text>
          {[
            {
              key: 'listen',
              icon: 'headset' as const,
              label: "L'écoute",
              surah: lastListen?.surahNumber ?? 1,
              detail: `verset ${lastListen?.verseNumber ?? 1}`,
              action: 'Écouter',
              onPress: () => listen(lastListen?.surahNumber ?? 1, lastListen?.verseNumber ?? 1),
            },
            {
              key: 'read',
              icon: 'book' as const,
              label: 'La lecture',
              surah: lastRead?.surahNumber ?? 1,
              detail: `page ${pageOfVerse(lastRead?.surahNumber ?? 1, lastRead?.verseNumber ?? 1)}`,
              action: 'Lire',
              onPress: () => read(lastRead?.surahNumber ?? 1, lastRead?.verseNumber ?? 1),
            },
          ].map((r, i) => (
            <TouchableOpacity
              key={r.key}
              style={[styles.resumeRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
              onPress={r.onPress}
              activeOpacity={0.8}
            >
              <View style={[styles.rowIcon, { backgroundColor: colors.goldTint }]}>
                <Ionicons name={r.icon} size={18} color={colors.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.resumeSub, { color: colors.textSecondary }]}>{r.label}</Text>
                <Text style={[styles.resumeTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {surahNameLatin(r.surah)} · {r.detail}
                </Text>
              </View>
              <View style={[styles.smallBtn, { backgroundColor: i === 0 ? colors.gold : 'transparent', borderColor: colors.gold }]}>
                <Text style={[styles.smallBtnText, { color: i === 0 ? colors.onGold : colors.gold }]}>{r.action}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Verset du jour : un toucher ouvre sa page (texte entier, traductions, partage) */}
        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
          onPress={() => navigation.navigate('Verse', { surah: daily.surah, ayah: daily.ayah })}
          activeOpacity={0.85}
        >
          <Text style={[styles.cardLabel, { color: colors.gold }]}>VERSET DU JOUR</Text>
          <Text style={[styles.dailyArabic, { color: colors.textPrimary }]} numberOfLines={2}>
            {daily.text}
          </Text>
          <View style={styles.dailyFooter}>
            <Text style={[styles.dailyRef, { color: colors.textSecondary }]} numberOfLines={1}>
              {surahNameLatin(daily.surah)} · {daily.surah}:{daily.ayah}
              <Text style={{ color: colors.gold, fontWeight: 'bold' }}>  ·  Voir plus</Text>
            </Text>
            <TouchableOpacity
              accessibilityLabel={dailyPlaying ? 'Arrêter le verset' : 'Écouter le verset'}
              style={[styles.roundBtn, { backgroundColor: colors.goldTint }]}
              onPress={toggleDailyVerse}
            >
              <Ionicons name={dailyPlaying ? 'stop' : 'play'} size={16} color={colors.gold} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        {/* Sadaqah : bannière en français et en wolof (les favoris ont pris sa place en bas) */}
        <TouchableOpacity
          style={[styles.sadaqahCard, { backgroundColor: colors.accentBg, borderColor: colors.gold }]}
          onPress={() => setIsSadaqahOpen(true)}
          activeOpacity={0.9}
        >
          <View style={styles.sadaqahHead}>
            <MaterialCommunityIcons name="hand-heart" size={20} color={colors.accentText} />
            <Text style={[styles.sadaqahLabel, { color: colors.accentText }]}>SADAQAH · SARAX</Text>
          </View>
          <Text style={[styles.sadaqahTitle, { color: colors.accentText }]}>Soutenez AL BARAKA</Text>
          <Text style={[styles.sadaqahBody, { color: colors.accentText }]}>
            L'application est gratuite et sans publicité. Votre sadaqah paie l'hébergement des récitations de
            Serigne Aboul Baraka Mbacké et permet de les faire écouter à tous. Même un petit don compte.
          </Text>
          <Text style={[styles.sadaqahWolof, { color: colors.accentSub }]}>
            Jàppaleel AL BARAKA. Aplikasioŋ bi amul fay, amul pub. Sa sarax dina dimbali ngir jàngum
            Serigne Aboul Baraka Mbacké agsi ci ñépp. Sarax su tuuti sax am na njariñ.
          </Text>
          <View style={styles.sadaqahFoot}>
            <PaymentBadges color={colors.accentText} />
            <View style={[styles.sadaqahBtn, { backgroundColor: colors.gold }]}>
              <Text style={[styles.sadaqahBtnText, { color: colors.onGold }]}>Faire un don</Text>
            </View>
          </View>
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
  photo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    marginRight: 6,
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
    gap: 12,
    paddingVertical: 10,
  },
  resumeTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 1,
  },
  resumeSub: {
    fontSize: 11.5,
  },
  smallBtn: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  dailyArabic: {
    fontFamily: 'KFGQPC_Warsh',
    fontSize: 20,
    lineHeight: 34,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginTop: 4,
  },
  dailyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
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
  sadaqahCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  sadaqahHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sadaqahLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  sadaqahTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
  },
  sadaqahBody: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  sadaqahWolof: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    fontStyle: 'italic',
  },
  sadaqahFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  sadaqahBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
  },
  sadaqahBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
});
