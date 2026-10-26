import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { VerseScreenProps } from '../navigation/types';
import { getMushafVerse, surahNameAr, surahNameLatin, toArabicDigits } from '../services/warshMushafService';
import { getFrenchVerseTranslation } from '../services/quranService';
import { playAyahOnly, stopAudioTrack, subscribeAudioStatus } from '../services/audioService';
import { getEffectiveAudioUrl } from '../services/downloadService';
import { VerseShareSheet } from '../components/VerseShareSheet';
import { DIGITS_FONT } from '../components/mushaf/mushafTheme';

/** Page d'un verset (verset du jour) : texte Warsh, traductions, écoute et partage. */
export const VerseScreen: React.FC<VerseScreenProps> = ({ route, navigation }) => {
  const { colors } = useTheme();
  const { surah, ayah, title = 'Verset du jour' } = route.params;
  const verse = getMushafVerse(surah, ayah);

  // undefined : chargement ; null : traduction indisponible (hors ligne).
  const [french, setFrench] = useState<string | null | undefined>(undefined);
  const [playing, setPlaying] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    getFrenchVerseTranslation(surah, ayah).then(setFrench);
    const unsub = subscribeAudioStatus((status) => {
      if (!status.isPlaying) setPlaying(false);
    });
    return () => unsub();
  }, [surah, ayah]);

  const togglePlay = async () => {
    if (playing) {
      await stopAudioTrack();
      setPlaying(false);
      return;
    }
    const ok = await playAyahOnly(await getEffectiveAudioUrl(surah), surah, ayah);
    setPlaying(ok);
  };

  if (!verse) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityLabel="Retour"
          style={[styles.backBtn, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={20} color={colors.gold} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{title}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Bandeau de la sourate */}
        <View style={[styles.banner, { backgroundColor: colors.accentBg }]}>
          <Text style={[styles.bannerArabic, { color: colors.accentText }]}>سورة {surahNameAr(surah)}</Text>
          <Text style={[styles.bannerLatin, { color: colors.accentSub }]}>
            {surahNameLatin(surah)} · verset {ayah} · page {verse.page}
          </Text>
        </View>

        {/* Texte Warsh */}
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.arabic, { color: colors.textPrimary }]}>
            {verse.text.replace(/۞\s*/g, '')} {toArabicDigits(ayah)}
          </Text>
        </View>

        {/* Écouter / Partager */}
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.gold }]} onPress={togglePlay} activeOpacity={0.85}>
            <Ionicons name={playing ? 'stop' : 'play'} size={16} color={colors.onGold} />
            <Text style={[styles.btnText, { color: colors.onGold }]}>{playing ? 'Arrêter' : 'Écouter'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: colors.gold }]}
            onPress={() => setSharing(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="share-social-outline" size={16} color={colors.gold} />
            <Text style={[styles.btnText, { color: colors.gold }]}>Partager</Text>
          </TouchableOpacity>
        </View>

        {/* Traductions */}
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.gold }]}>FRANÇAIS</Text>
          {french === undefined ? (
            <ActivityIndicator color={colors.gold} style={{ marginTop: 10 }} />
          ) : (
            <Text style={[styles.translation, { color: colors.textPrimary }]}>
              {french ?? 'Traduction indisponible hors connexion.'}
            </Text>
          )}
          <Text style={[styles.source, { color: colors.textSecondary }]}>Traduction de Muhammad Hamidullah</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.gold }]}>WOLOF</Text>
          <Text style={[styles.translation, { color: colors.textSecondary, fontStyle: 'italic' }]}>
            La traduction en wolof sera bientôt disponible.
          </Text>
        </View>
      </ScrollView>

      <VerseShareSheet verse={sharing ? { surah, ayah } : null} onClose={() => setSharing(false)} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 12,
  },
  banner: {
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
  },
  bannerArabic: {
    fontFamily: 'KFGQPC_Warsh',
    fontSize: 28,
    lineHeight: 46,
  },
  bannerLatin: {
    fontSize: 12,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  arabic: {
    fontFamily: 'KFGQPC_Warsh',
    fontSize: 28,
    lineHeight: 52,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 46,
    borderRadius: 12,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  btnText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 10.5,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  translation: {
    fontFamily: DIGITS_FONT,
    fontSize: 15,
    lineHeight: 24,
    marginTop: 8,
  },
  source: {
    fontSize: 11,
    marginTop: 10,
  },
});
