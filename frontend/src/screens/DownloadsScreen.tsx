import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Image,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { getSurahList } from '../services/quranService';
import {
  getCurrentSurahNumber,
  playAudioFromAyah,
  subscribeAudioStatus,
  togglePlayPause,
  SoundStatus,
} from '../services/audioService';
import {
  deleteDownloadedSurah,
  getDownloadedSurahNumbers,
  getEffectiveAudioUrl,
  subscribeDownloadChange,
} from '../services/downloadService';
import { Surah } from '../types/quran';
import { FullAudioPlayer, RepeatMode } from '../components/FullAudioPlayer';
import { Toast, useToast } from '../components/Toast';
import { DownloadsTabScreenProps } from '../navigation/types';

const reciterPhoto = require('../assets/serigne_abdou_bara.jpg');

export const DownloadsScreen: React.FC<DownloadsTabScreenProps> = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const [allSurahs, setAllSurahs] = useState<Surah[]>([]);
  const [downloadedSurahs, setDownloadedSurahs] = useState<Surah[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentSurah, setCurrentSurah] = useState<Surah | null>(null);
  const [fullPlayerVisible, setFullPlayerVisible] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const toast = useToast();

  const [audioStatus, setAudioStatus] = useState<SoundStatus>({
    isPlaying: false,
    position: 0,
    duration: 0,
    isLoaded: false,
  });

  useEffect(() => {
    loadData();
    const unsubAudio = subscribeAudioStatus((status) => {
      setAudioStatus(status);
    });
    const unsubDownloads = subscribeDownloadChange(() => {
      loadDownloadedSurahs(allSurahs);
    });
    return () => {
      unsubAudio();
      unsubDownloads();
    };
  }, [allSurahs]);

  const loadData = async () => {
    try {
      setLoading(true);
      const list = await getSurahList();
      setAllSurahs(list);
      await loadDownloadedSurahs(list);
    } catch (e) {
      console.error('Erreur chargement données téléchargements:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadDownloadedSurahs = async (list: Surah[]) => {
    try {
      const numbers = await getDownloadedSurahNumbers();
      const numSet = new Set(numbers);
      const downloaded = list.filter((s) => numSet.has(s.number));
      setDownloadedSurahs(downloaded);

      // Si aucune sourate sélectionnée, on prend la sourate en cours d'écoute ou la 1ère téléchargée
      const playing = getCurrentSurahNumber();
      if (playing) {
        const found = downloaded.find((s) => s.number === playing);
        if (found) setCurrentSurah(found);
      } else if (downloaded.length > 0 && !currentSurah) {
        setCurrentSurah(downloaded[0]);
      }
    } catch (e) {
      console.error('Erreur lecture sourates téléchargées:', e);
    }
  };

  // Suivi de l'audio en cours de lecture
  useEffect(() => {
    const playing = getCurrentSurahNumber();
    if (playing && playing !== currentSurah?.number) {
      const s = downloadedSurahs.find((item) => item.number === playing);
      if (s) setCurrentSurah(s);
    }
  }, [audioStatus.isLoaded, downloadedSurahs]);

  const handlePlaySurah = async (surah: Surah, ayah = 1) => {
    setCurrentSurah(surah);
    const audioUrl = await getEffectiveAudioUrl(surah.number);
    await playAudioFromAyah(audioUrl, surah.number, ayah, surah.numberOfAyahs);
  };

  const handleRowPress = (surah: Surah) => {
    if (currentSurah?.number === surah.number && audioStatus.isLoaded) {
      togglePlayPause();
    } else {
      handlePlaySurah(surah);
    }
  };

  const handleDeleteDownload = async (surah: Surah) => {
    const removed = await deleteDownloadedSurah(surah.number);
    if (removed) {
      toast.show(`${surah.englishName} supprimée des téléchargements`);
      await loadDownloadedSurahs(allSurahs);
    }
  };

  const handleNextTrack = () => {
    if (!currentSurah || downloadedSurahs.length === 0) return;
    if (isShuffle) {
      const randomIndex = Math.floor(Math.random() * downloadedSurahs.length);
      handlePlaySurah(downloadedSurahs[randomIndex]);
      return;
    }
    const currentIndex = downloadedSurahs.findIndex((s) => s.number === currentSurah.number);
    const nextIndex = (currentIndex + 1) % downloadedSurahs.length;
    handlePlaySurah(downloadedSurahs[nextIndex]);
  };

  const handlePrevTrack = () => {
    if (!currentSurah || downloadedSurahs.length === 0) return;
    if (isShuffle) {
      const randomIndex = Math.floor(Math.random() * downloadedSurahs.length);
      handlePlaySurah(downloadedSurahs[randomIndex]);
      return;
    }
    const currentIndex = downloadedSurahs.findIndex((s) => s.number === currentSurah.number);
    const prevIndex = (currentIndex - 1 + downloadedSurahs.length) % downloadedSurahs.length;
    handlePlaySurah(downloadedSurahs[prevIndex]);
  };

  const filteredSurahs = downloadedSurahs.filter((s) => {
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
            backgroundColor: isSelected ? colors.goldTint : colors.bgCard,
            borderColor: isSelected ? colors.gold : colors.border,
          },
        ]}
        onPress={() => handleRowPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.itemLeft}>
          <View style={[styles.numberBadge, { backgroundColor: isSelected ? colors.gold : colors.bgSecondary }]}>
            {isPlayingThis ? (
              <Ionicons name="volume-high" size={16} color={isSelected ? colors.onGold : colors.gold} />
            ) : (
              <Text style={[styles.numberText, { color: isSelected ? colors.onGold : colors.textPrimary }]}>
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
          <TouchableOpacity
            accessibilityLabel={`Supprimer ${item.englishName} des téléchargements`}
            onPress={() => handleDeleteDownload(item)}
            style={styles.actionBtnSmall}
            hitSlop={6}
          >
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleRowPress(item)} style={styles.playBtnSmall}>
            <Ionicons
              name={isPlayingThis ? 'pause-circle' : 'play-circle'}
              size={32}
              color={colors.gold}
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bgPrimary} />

      {/* En-tête */}
      <View style={[styles.header, { backgroundColor: colors.bgPrimary, borderBottomColor: colors.border }]}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="cloud-download" size={24} color={colors.gold} style={{ marginRight: 8 }} />
          <Text style={[styles.title, { color: colors.textPrimary }]}>Téléchargements</Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Audios disponibles hors-ligne • Serigne Aboul Baraka Mbacké
        </Text>
      </View>

      {/* Barre de Recherche */}
      {downloadedSurahs.length > 0 && (
        <View style={[styles.searchContainer, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Rechercher une sourate téléchargée..."
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
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Chargement de vos audios hors-ligne...
          </Text>
        </View>
      ) : downloadedSurahs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.goldTint }]}>
            <Ionicons name="cloud-download-outline" size={44} color={colors.gold} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Aucun audio téléchargé</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Téléchargez vos sourates préférées depuis le Lecteur audio pour pouvoir les écouter partout, sans connexion
            Internet.
          </Text>
          <TouchableOpacity
            style={[styles.goToAudioBtn, { backgroundColor: colors.gold }]}
            onPress={() => navigation.navigate('AudioTab')}
            activeOpacity={0.8}
          >
            <Ionicons name="headset" size={18} color={colors.onGold} style={{ marginRight: 8 }} />
            <Text style={[styles.goToAudioText, { color: colors.onGold }]}>Aller au Lecteur audio</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredSurahs}
          keyExtractor={(item) => item.number.toString()}
          renderItem={renderSurahItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.listHeaderBadge}>
              <Text style={[styles.badgeCountText, { color: colors.textSecondary }]}>
                {downloadedSurahs.length} sourate{downloadedSurahs.length > 1 ? 's' : ''} prête
                {downloadedSurahs.length > 1 ? 's' : ''} pour l'écoute 100% hors-ligne
              </Text>
            </View>
          }
        />
      )}

      {/* Mini-Lecteur Flottant en bas */}
      {currentSurah && downloadedSurahs.length > 0 && (
        <TouchableOpacity
          style={[styles.floatingBar, { backgroundColor: colors.bgCard, borderColor: colors.gold }]}
          onPress={() => setFullPlayerVisible(true)}
          activeOpacity={0.9}
        >
          <View style={styles.barLeft}>
            <View style={[styles.discIconFrame, { borderColor: colors.gold }]}>
              <Image source={reciterPhoto} style={styles.discPhoto} resizeMode="cover" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.barTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {currentSurah.englishName}
              </Text>
              <Text style={[styles.barSub, { color: colors.textSecondary }]} numberOfLines={1}>
                {currentSurah.name} • Hors-ligne
              </Text>
            </View>
          </View>

          <TouchableOpacity onPress={() => handleRowPress(currentSurah)} style={styles.playBtnSmall}>
            <Ionicons
              name={audioStatus.isPlaying ? 'pause-circle' : 'play-circle'}
              size={42}
              color={colors.gold}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* Lecteur Plein Écran Modal */}
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
          onToggleRepeat={() => {
            setRepeatMode((prev) => (prev === 'off' ? 'one' : prev === 'one' ? 'all' : 'off'));
          }}
          onToggleShuffle={() => setIsShuffle((prev) => !prev)}
        />
      )}

      <Toast
        text={toast.text}
        opacity={toast.opacity}
        background={colors.accentBg}
        border={colors.gold}
        color={colors.accentText}
        top={70}
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
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 6,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 36,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  goToAudioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  goToAudioText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  listHeaderBadge: {
    paddingVertical: 8,
    marginBottom: 4,
  },
  badgeCountText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
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
  actionBtnSmall: {
    padding: 4,
    marginHorizontal: 4,
  },
  playBtnSmall: {
    padding: 2,
    marginLeft: 6,
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
  },
});
