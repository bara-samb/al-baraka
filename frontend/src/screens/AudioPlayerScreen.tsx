import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Image,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { getSurahList } from '../services/quranService';
import { playAudioTrack, subscribeAudioStatus, togglePlayPause, SoundStatus } from '../services/audioService';
import { getEffectiveAudioUrl } from '../services/downloadService';
import { saveLastReadPosition } from '../services/bookmarkService';
import { Surah } from '../types/quran';
import { FullAudioPlayer, RepeatMode } from '../components/FullAudioPlayer';

const reciterPhoto = require('../assets/serigne_abdou_bara.jpg');

export const AudioPlayerScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentSurah, setCurrentSurah] = useState<Surah | null>(null);
  const [fullPlayerVisible, setFullPlayerVisible] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [audioStatus, setAudioStatus] = useState<SoundStatus>({
    isPlaying: false,
    position: 0,
    duration: 0,
    isLoaded: false,
  });

  useEffect(() => {
    fetchSurahs();
    const unsub = subscribeAudioStatus((status) => {
      setAudioStatus(status);
    });
    return () => unsub();
  }, []);

  const fetchSurahs = async () => {
    try {
      setLoading(true);
      const data = await getSurahList();
      setSurahs(data);
      if (data.length > 0) {
        setCurrentSurah(data[0]); // Par défaut Sourate Al-Fatiha
      }
    } catch (e) {
      console.error('Erreur chargement sourates audio:', e);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaySurah = async (surah: Surah) => {
    setCurrentSurah(surah);
    saveLastReadPosition(surah.number, surah.name, surah.englishName, 1);
    const audioUrl = await getEffectiveAudioUrl(surah.number);
    await playAudioTrack(audioUrl);
  };

  const handleNextTrack = () => {
    if (!currentSurah || surahs.length === 0) return;

    if (isShuffle) {
      const randomIndex = Math.floor(Math.random() * surahs.length);
      handlePlaySurah(surahs[randomIndex]);
      return;
    }

    const currentIndex = surahs.findIndex((s) => s.number === currentSurah.number);
    const nextIndex = (currentIndex + 1) % surahs.length;
    handlePlaySurah(surahs[nextIndex]);
  };

  const handlePrevTrack = () => {
    if (!currentSurah || surahs.length === 0) return;

    if (isShuffle) {
      const randomIndex = Math.floor(Math.random() * surahs.length);
      handlePlaySurah(surahs[randomIndex]);
      return;
    }

    const currentIndex = surahs.findIndex((s) => s.number === currentSurah.number);
    const prevIndex = (currentIndex - 1 + surahs.length) % surahs.length;
    handlePlaySurah(surahs[prevIndex]);
  };

  const handleToggleRepeat = () => {
    setRepeatMode((prev) => {
      if (prev === 'off') return 'one';
      if (prev === 'one') return 'all';
      return 'off';
    });
  };

  const handleToggleShuffle = () => {
    setIsShuffle((prev) => !prev);
  };

  const filteredSurahs = surahs.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      s.number.toString().includes(q) ||
      s.englishName.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q)
    );
  });

  const renderSurahItem = ({ item }: { item: Surah }) => {
    const isSelected = currentSurah?.number === item.number;
    const isPlayingThis = isSelected && audioStatus.isPlaying;

    return (
      <TouchableOpacity
        style={[
          styles.surahItem,
          {
            backgroundColor: isSelected ? 'rgba(212, 175, 55, 0.12)' : colors.bgCard,
            borderColor: isSelected ? colors.gold : colors.border,
          },
        ]}
        onPress={() => handlePlaySurah(item)}
        activeOpacity={0.7}
      >
        <View style={styles.itemLeft}>
          <View style={[styles.numberBadge, { backgroundColor: isSelected ? colors.gold : colors.bgSecondary }]}>
            {isPlayingThis ? (
              <Ionicons name="volume-high" size={16} color={isSelected ? '#0F172A' : colors.gold} />
            ) : (
              <Text style={[styles.numberText, { color: isSelected ? '#0F172A' : colors.textPrimary }]}>
                {item.number}
              </Text>
            )}
          </View>
          <View>
            <Text style={[styles.surahName, { color: colors.textPrimary }]}>{item.englishName}</Text>
            <Text style={[styles.surahMeta, { color: colors.textSecondary }]}>
              {item.numberOfAyahs} Versets • {item.revelationType === 'Meccan' ? 'Mecquoise' : 'Médinoise'}
            </Text>
          </View>
        </View>

        <View style={styles.itemRight}>
          <Text style={[styles.arabicName, { color: colors.gold }]}>{item.name}</Text>
          <TouchableOpacity onPress={() => handlePlaySurah(item)} style={styles.playBtnSmall}>
            <Ionicons
              name={isPlayingThis ? 'pause-circle' : 'play-circle'}
              size={32}
              color={isSelected ? colors.gold : colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bgPrimary} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bgPrimary, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.gold }]}>LECTEUR AUDIO</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Récitation intégrale par Serigne Aboul Baraka Mbacké (Warsh)
        </Text>
      </View>

      {/* Barre de Recherche Semi-Guidée */}
      <View style={[styles.searchContainer, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Rechercher une sourate à écouter (ex: Fatiha, 36)..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
            <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Chargement de la bibliothèque audio...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredSurahs}
          keyExtractor={(item) => item.number.toString()}
          renderItem={renderSurahItem}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Lecteur flottant récapitulatif bas de page avec vignette photo */}
      {currentSurah && (
        <TouchableOpacity
          style={[styles.floatingBar, { backgroundColor: colors.bgSecondary, borderColor: colors.gold }]}
          onPress={() => setFullPlayerVisible(true)}
          activeOpacity={0.9}
        >
          <View style={styles.barLeft}>
            <View style={[styles.discIconFrame, { borderColor: colors.gold }]}>
              <Image source={reciterPhoto} style={styles.discPhoto} resizeMode="cover" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.barTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                Sourate {currentSurah.englishName} ({currentSurah.name})
              </Text>
              <Text style={[styles.barSub, { color: colors.gold }]} numberOfLines={1}>
                Serigne Aboul Baraka Mbacké
              </Text>
            </View>
          </View>

          <View style={styles.barControls}>
            <TouchableOpacity onPress={togglePlayPause} style={styles.playPauseIcon}>
              <Ionicons
                name={audioStatus.isPlaying ? 'pause' : 'play'}
                size={26}
                color={colors.gold}
              />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setFullPlayerVisible(true)} style={styles.expandIcon}>
              <Ionicons name="chevron-up" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      {/* Lecteur Fullscreen Modal avec contrôles complets */}
      {currentSurah && (
        <FullAudioPlayer
          visible={fullPlayerVisible}
          surahNumber={currentSurah.number}
          surahName={currentSurah.name}
          englishName={currentSurah.englishName}
          repeatMode={repeatMode}
          isShuffle={isShuffle}
          onClose={() => setFullPlayerVisible(false)}
          onNextTrack={handleNextTrack}
          onPrevTrack={handlePrevTrack}
          onToggleRepeat={handleToggleRepeat}
          onToggleShuffle={handleToggleShuffle}
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
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  searchContainer: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 160,
  },
  surahItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  numberBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  numberText: {
    fontWeight: 'bold',
    fontSize: 13,
  },
  surahName: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  surahMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arabicName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 10,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  playBtnSmall: {
    padding: 2,
  },
  floatingBar: {
    position: 'absolute',
    bottom: 85,
    left: 14,
    right: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  barLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  discIconFrame: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    overflow: 'hidden',
    marginRight: 10,
  },
  discPhoto: {
    width: '100%',
    height: '100%',
  },
  barTitle: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  barSub: {
    fontSize: 11,
    marginTop: 1,
  },
  barControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playPauseIcon: {
    padding: 4,
    marginRight: 8,
  },
  expandIcon: {
    padding: 4,
  },
});
