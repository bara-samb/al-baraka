import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { getSurahDetails } from '../services/quranService';
import { playAudioTrack, stopAudioTrack, getAyahStartRatio } from '../services/audioService';
import { isSurahFavorite, toggleFavoriteSurah } from '../services/favoritesService';
import { saveLastReadPosition } from '../services/bookmarkService';
import { getArabicFontSize, setArabicFontSize } from '../services/settingsService';
import {
  isSurahDownloaded,
  getEffectiveAudioUrl,
  downloadSurahAudio,
  deleteDownloadedSurah,
} from '../services/downloadService';
import { SurahDetail, Ayah, TranslationLanguage } from '../types/quran';
import { AudioPlayerBar } from '../components/AudioPlayerBar';
import { VerseModal } from '../components/VerseModal';
import { SurahScreenProps } from '../navigation/types';

export const SurahScreen: React.FC<SurahScreenProps> = ({ route }) => {
  const { colors, isDark } = useTheme();
  const { surahNumber, surahName, englishName, initialVerseNumber } = route.params as any;

  const [surahDetail, setSurahDetail] = useState<SurahDetail | null>(null);
  const [loadingText, setLoadingText] = useState<boolean>(true);
  const [selectedAyah, setSelectedAyah] = useState<Ayah | null>(null);
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [translationLang, setTranslationLang] = useState<TranslationLanguage>('fr');
  const [isFav, setIsFav] = useState<boolean>(false);
  const [isDownloaded, setIsDownloaded] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [, setDownloadProgress] = useState<number>(0);
  const [arabicFontSize, setArabicFontSizeState] = useState<number>(24);

  const flatListRef = useRef<FlatList>(null);

  const [activePlaybackInfo, setActivePlaybackInfo] = useState<{
    title: string;
    reciter: string;
  }>({
    title: `Sourate ${englishName}`,
    reciter: 'Serigne Aboul Baraka Mbacké',
  });

  useEffect(() => {
    loadSurahContent(translationLang);
    setupAudioTrack();
    checkFavAndDownloadStatus();
    loadFontSize();
    saveLastReadPosition(surahNumber, surahName, englishName, initialVerseNumber || 1);

    return () => {
      stopAudioTrack();
    };
  }, [surahNumber]);

  useEffect(() => {
    if (surahDetail && initialVerseNumber && initialVerseNumber > 1) {
      const idx = initialVerseNumber - 1;
      if (surahDetail.ayahs && surahDetail.ayahs[idx]) {
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index: idx,
            animated: true,
            viewPosition: 0.3,
          });
        }, 600);
      }
    }
  }, [surahDetail, initialVerseNumber]);

  const loadFontSize = async () => {
    const size = await getArabicFontSize();
    setArabicFontSizeState(size);
  };

  const handleChangeFontSize = async (delta: number) => {
    const nextSize = await setArabicFontSize(arabicFontSize + delta);
    setArabicFontSizeState(nextSize);
  };

  const checkFavAndDownloadStatus = async () => {
    const fav = await isSurahFavorite(surahNumber);
    const dl = await isSurahDownloaded(surahNumber);
    setIsFav(fav);
    setIsDownloaded(dl);
  };

  const handleToggleFav = async () => {
    if (surahDetail) {
      const status = await toggleFavoriteSurah(surahDetail);
      setIsFav(status);
    }
  };

  const handleDownloadToggle = async () => {
    if (isDownloaded) {
      Alert.alert(
        'Supprimer l\'audio local',
        `Voulez-vous supprimer le fichier audio hors-ligne de la Sourate ${englishName} ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Supprimer',
            style: 'destructive',
            onPress: async () => {
              await deleteDownloadedSurah(surahNumber);
              setIsDownloaded(false);
            },
          },
        ]
      );
    } else {
      setIsDownloading(true);
      setDownloadProgress(0);
      const success = await downloadSurahAudio(surahNumber, (progress) => {
        setDownloadProgress(progress);
      });
      setIsDownloading(false);
      if (success) {
        setIsDownloaded(true);
        Alert.alert('Succès', `La Sourate ${englishName} est désormais disponible hors-ligne !`);
      } else {
        Alert.alert('Erreur', 'Impossible de télécharger le fichier audio. Vérifiez le serveur backend.');
      }
    }
  };

  const loadSurahContent = async (lang: TranslationLanguage) => {
    try {
      setLoadingText(true);
      const fetchLang = lang === 'en' ? 'en' : 'fr';
      const detail = await getSurahDetails(surahNumber, fetchLang);
      setSurahDetail(detail);
    } catch (error) {
      console.error('Erreur lors du chargement des versets Warsh:', error);
    } finally {
      setLoadingText(false);
    }
  };

  const handleCycleTranslation = () => {
    let nextLang: TranslationLanguage = 'fr';
    if (translationLang === 'fr') nextLang = 'en';
    else if (translationLang === 'en') nextLang = 'none';
    else nextLang = 'fr';

    setTranslationLang(nextLang);
    if (nextLang !== 'none') {
      loadSurahContent(nextLang);
    }
  };

  const setupAudioTrack = async () => {
    const audioUrl = await getEffectiveAudioUrl(surahNumber);
    const success = await playAudioTrack(audioUrl);

    if (success) {
      setActivePlaybackInfo({
        title: `Sourate ${englishName}`,
        reciter: 'Serigne Aboul Baraka Mbacké',
      });
    } else {
      setActivePlaybackInfo({
        title: `Sourate ${englishName} (Audio non disponible)`,
        reciter: 'Serigne Aboul Baraka Mbacké',
      });
    }
  };

  const handlePlayVerse = async (verse: Ayah) => {
    saveLastReadPosition(surahNumber, surahName, englishName, verse.numberInSurah);
    const surahAudioUrl = await getEffectiveAudioUrl(surahNumber);
    const totalAyahs = surahDetail?.numberOfAyahs || surahDetail?.ayahs.length || 1;
    const startRatio = getAyahStartRatio(surahNumber, verse.numberInSurah, totalAyahs);
    const success = await playAudioTrack(surahAudioUrl, startRatio);

    if (success) {
      setActivePlaybackInfo({
        title: `${englishName} - Verset ${verse.numberInSurah}`,
        reciter: 'Serigne Aboul Baraka Mbacké',
      });
    } else {
      Alert.alert(
        'Audio indisponible',
        `L'audio de Serigne Aboul Baraka Mbacké pour la Sourate ${englishName} n'est pas disponible.`
      );
    }
  };

  const handleAyahPress = (ayah: Ayah) => {
    setSelectedAyah(ayah);
    setIsModalVisible(true);
    saveLastReadPosition(surahNumber, surahName, englishName, ayah.numberInSurah);
  };

  const toArabicDigits = (num: number): string => {
    const digits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return num.toString().split('').map(d => digits[parseInt(d, 10)]).join('');
  };

  const renderSurahBannerHeader = () => (
    <View style={styles.surahBannerFrame}>
      <Text style={styles.surahBannerArabic}>{surahName}</Text>
      <Text style={styles.surahBannerMeta}>
        {englishName} • {surahDetail?.numberOfAyahs || 0} Versets • Riwaya Warsh (ورش)
      </Text>
    </View>
  );

  const renderAyahItem = ({ item }: { item: Ayah }) => (
    <TouchableOpacity
      style={[
        styles.ayahContainer,
        {
          backgroundColor: isDark ? colors.bgCard : '#FDFBF7', // Texture papier crème léger
          borderColor: isDark ? colors.border : '#E2D8C3',
        },
      ]}
      onPress={() => handleAyahPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.ayahHeaderRow}>
        <View style={[styles.ayahMedallion, { backgroundColor: colors.gold }]}>
          <Text style={styles.ayahMedallionText}>﴿{toArabicDigits(item.numberInSurah)}﴾</Text>
        </View>
        <Text style={[styles.verseLabelText, { color: colors.textSecondary }]}>Verset {item.numberInSurah}</Text>
      </View>

      <Text
        style={[
          styles.arabicText,
          { fontSize: arabicFontSize, lineHeight: arabicFontSize * 2.2, color: colors.textPrimary, fontFamily: 'KFGQPC_Warsh' }
        ]}
      >
        {item.text}
      </Text>

      {translationLang !== 'none' && item.translation ? (
        <Text style={[styles.translationText, { color: isDark ? colors.textSecondary : '#555555' }]}>
          {item.translation}
        </Text>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? colors.bgPrimary : '#FDFBF7' }]}>
      <View style={[styles.topBar, { backgroundColor: isDark ? colors.bgSecondary : '#F4EFE6', borderBottomColor: colors.border }]}>
        <View style={styles.topLeft}>
          <Text style={[styles.topTitle, { color: colors.textPrimary }]}>{englishName}</Text>
          <Text style={[styles.topSubTitle, { color: colors.textSecondary }]}>
            {surahDetail?.numberOfAyahs || 0} versets • Warsh (ورش)
          </Text>
        </View>

        <View style={styles.fontSizeControls}>
          <TouchableOpacity
            style={[styles.fontBtn, { backgroundColor: colors.bgPrimary, borderColor: colors.border }]}
            onPress={() => handleChangeFontSize(-2)}
          >
            <Text style={[styles.fontBtnText, { color: colors.textPrimary }]}>A-</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.fontBtn, { backgroundColor: colors.bgPrimary, borderColor: colors.border }]}
            onPress={() => handleChangeFontSize(2)}
          >
            <Text style={[styles.fontBtnText, { color: colors.textPrimary }]}>A+</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.iconHeaderBtn} onPress={handleDownloadToggle}>
          {isDownloading ? (
            <ActivityIndicator size="small" color={colors.gold} />
          ) : (
            <Ionicons
              name={isDownloaded ? 'cloud-done' : 'cloud-download-outline'}
              size={22}
              color={isDownloaded ? colors.emerald : colors.textSecondary}
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleButton,
            {
              backgroundColor: translationLang !== 'none' ? colors.gold : colors.bgPrimary,
              borderColor: colors.border,
            },
          ]}
          onPress={handleCycleTranslation}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.toggleButtonText,
              { color: translationLang !== 'none' ? '#0F172A' : colors.textSecondary },
            ]}
          >
            {translationLang === 'fr' ? 'FR 🇫🇷' : translationLang === 'en' ? 'EN 🇬🇧' : 'OFF 🚫'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconHeaderBtn} onPress={handleToggleFav}>
          <Ionicons
            name={isFav ? 'heart' : 'heart-outline'}
            size={22}
            color={isFav ? '#EF4444' : colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {loadingText ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={[styles.loadingMessage, { color: colors.textSecondary }]}>
            Chargement des versets en version Warsh ({translationLang.toUpperCase()})...
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={surahDetail?.ayahs}
          ListHeaderComponent={renderSurahBannerHeader}
          keyExtractor={(item: Ayah) => item.number.toString()}
          renderItem={renderAyahItem}
          contentContainerStyle={styles.listContent}
          onScrollToIndexFailed={(info) => {
            flatListRef.current?.scrollToOffset({
              offset: info.highestMeasuredFrameIndex * 120,
              animated: true,
            });
          }}
        />
      )}

      <VerseModal
        visible={isModalVisible}
        ayah={selectedAyah}
        surahName={englishName}
        surahNumber={surahNumber}
        onClose={() => setIsModalVisible(false)}
        onPlayVerse={handlePlayVerse}
      />

      <AudioPlayerBar
        surahTitle={activePlaybackInfo.title}
        reciterName={activePlaybackInfo.reciter}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  topLeft: {
    flex: 1,
  },
  topTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  topSubTitle: {
    fontSize: 10,
    marginTop: 1,
  },
  fontSizeControls: {
    flexDirection: 'row',
    marginHorizontal: 4,
  },
  fontBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  fontBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  iconHeaderBtn: {
    padding: 6,
  },
  toggleButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 4,
  },
  toggleButtonText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  surahBannerFrame: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#114232',
    borderWidth: 1.5,
    borderColor: '#D4AF37',
    alignItems: 'center',
  },
  surahBannerArabic: {
    color: '#D4AF37',
    fontSize: 32,
    fontFamily: 'KFGQPC_Warsh',
  },
  surahBannerMeta: {
    color: '#E2E8F0',
    fontSize: 12,
    marginTop: 4,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingMessage: {
    marginTop: 10,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 130,
  },
  ayahContainer: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    elevation: 1,
  },
  ayahHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  ayahMedallion: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ayahMedallionText: {
    color: '#0F172A',
    fontWeight: 'bold',
    fontSize: 13,
  },
  verseLabelText: {
    fontSize: 11,
  },
  arabicText: {
    textAlign: 'right',
  },
  translationText: {
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12,
    fontStyle: 'italic',
  },
});
