import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  TextInput,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { getSurahList, getSurahDetails } from '../services/quranService';
import { getArabicFontSize, setArabicFontSize } from '../services/settingsService';
import { Surah, SurahDetail, Ayah, MushafPageOrientation, TranslationLanguage } from '../types/quran';
import { ShareVerseModal } from '../components/ShareVerseModal';
import { SettingsModal } from '../components/SettingsModal';

// Point de départ réel (sourate, verset) de chacun des 30 Juz' du Coran
const JUZ_START_POINTS: Array<{ surah: number; ayah: number }> = [
  { surah: 1, ayah: 1 },
  { surah: 2, ayah: 142 },
  { surah: 2, ayah: 253 },
  { surah: 3, ayah: 92 },
  { surah: 4, ayah: 24 },
  { surah: 4, ayah: 148 },
  { surah: 5, ayah: 82 },
  { surah: 6, ayah: 111 },
  { surah: 7, ayah: 88 },
  { surah: 8, ayah: 41 },
  { surah: 9, ayah: 93 },
  { surah: 11, ayah: 6 },
  { surah: 12, ayah: 53 },
  { surah: 15, ayah: 1 },
  { surah: 17, ayah: 1 },
  { surah: 18, ayah: 75 },
  { surah: 21, ayah: 1 },
  { surah: 23, ayah: 1 },
  { surah: 25, ayah: 21 },
  { surah: 27, ayah: 56 },
  { surah: 29, ayah: 46 },
  { surah: 33, ayah: 31 },
  { surah: 36, ayah: 28 },
  { surah: 39, ayah: 32 },
  { surah: 41, ayah: 47 },
  { surah: 46, ayah: 1 },
  { surah: 51, ayah: 31 },
  { surah: 58, ayah: 1 },
  { surah: 67, ayah: 1 },
  { surah: 78, ayah: 1 },
];

const JUZ_LIST = Array.from({ length: 30 }, (_, i) => ({
  juzNumber: i + 1,
  titleFr: `Juz' ${i + 1}`,
  titleAr: `الجزء ${i + 1}`,
  startSurah: JUZ_START_POINTS[i].surah,
  startAyah: JUZ_START_POINTS[i].ayah,
}));

export const MushafScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [currentSurahNumber, setCurrentSurahNumber] = useState<number>(1);
  const [surahDetail, setSurahDetail] = useState<SurahDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [arabicFontSize, setArabicFontSizeState] = useState<number>(24);
  const [translationLang, setTranslationLang] = useState<TranslationLanguage>('fr');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'sourates' | 'juz'>('sourates');

  // Parameter for Vertical vs Horizontal paging mode!
  const [orientation, setOrientation] = useState<MushafPageOrientation>('vertical');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  const [selectedAyah, setSelectedAyah] = useState<Ayah | null>(null);
  const [shareModalVisible, setShareModalVisible] = useState<boolean>(false);

  const ayahListRef = useRef<FlatList>(null);
  const pendingScrollAyahRef = useRef<number | null>(null);

  useEffect(() => {
    fetchSurahList();
    loadFontSize();
  }, []);

  useEffect(() => {
    loadSurahContent(currentSurahNumber, translationLang);
  }, [currentSurahNumber, translationLang]);

  const loadFontSize = async () => {
    const size = await getArabicFontSize();
    setArabicFontSizeState(size);
  };

  const fetchSurahList = async () => {
    try {
      const list = await getSurahList();
      setSurahs(list);
    } catch (e) {
      console.error('Erreur chargement liste sourates:', e);
    }
  };

  const loadSurahContent = async (num: number, lang: TranslationLanguage) => {
    try {
      setLoading(true);
      const fetchLang = lang === 'en' ? 'en' : 'fr';
      const detail = await getSurahDetails(num, fetchLang);
      setSurahDetail(detail);

      const targetAyah = pendingScrollAyahRef.current;
      pendingScrollAyahRef.current = null;
      if (targetAyah && targetAyah > 1 && detail.ayahs && detail.ayahs[targetAyah - 1]) {
        setTimeout(() => {
          ayahListRef.current?.scrollToIndex({
            index: targetAyah - 1,
            animated: true,
            viewPosition: 0.1,
          });
        }, 300);
      }
    } catch (e) {
      console.error('Erreur chargement sourate Warsh:', e);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Navigue vers le début exact d'un Juz' (sourate + verset), et fait défiler
   * la liste des versets jusqu'au verset de départ une fois le contenu chargé.
   */
  const handleJuzPress = (juz: { startSurah: number; startAyah: number }) => {
    pendingScrollAyahRef.current = juz.startAyah;
    if (juz.startSurah === currentSurahNumber) {
      // Même sourate déjà chargée : déclenche le défilement immédiatement.
      loadSurahContent(currentSurahNumber, translationLang);
    } else {
      setCurrentSurahNumber(juz.startSurah);
    }
  };

  const handleFontChange = async (delta: number) => {
    const nextSize = await setArabicFontSize(arabicFontSize + delta);
    setArabicFontSizeState(nextSize);
  };

  const handleNextSurah = () => {
    if (currentSurahNumber < 114) {
      setCurrentSurahNumber((prev) => prev + 1);
    }
  };

  const handlePrevSurah = () => {
    if (currentSurahNumber > 1) {
      setCurrentSurahNumber((prev) => prev - 1);
    }
  };

  const handleAyahPress = (ayah: Ayah) => {
    setSelectedAyah(ayah);
    setShareModalVisible(true);
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

  const filteredJuz = JUZ_LIST.filter((j) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return j.juzNumber.toString().includes(q) || j.titleFr.toLowerCase().includes(q);
  });

  const screenWidth = Dimensions.get('window').width;

  const renderAyahItem = ({ item }: { item: Ayah }) => {
    if (orientation === 'horizontal') {
      return (
        <View
          style={[
            styles.horizontalPageCard,
            {
              width: screenWidth - 36,
              backgroundColor: colors.bgCard,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.pageHeader}>
            <View style={[styles.badge, { backgroundColor: colors.gold }]}>
              <Text style={styles.badgeText}>Verset {item.numberInSurah}</Text>
            </View>
            <Text style={[styles.surahHeaderTitle, { color: colors.gold }]}>
              {surahDetail?.englishName} ({surahDetail?.name})
            </Text>
          </View>

          <Text
            style={[
              styles.arabicTextHorizontal,
              { color: colors.textPrimary, fontSize: arabicFontSize + 2, lineHeight: (arabicFontSize + 2) * 1.8 },
            ]}
          >
            {item.text}
          </Text>

          {translationLang !== 'none' && item.translation ? (
            <Text style={[styles.translationText, { color: colors.textSecondary }]}>
              "{item.translation}"
            </Text>
          ) : null}

          <TouchableOpacity
            style={[styles.shareActionBtn, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}
            onPress={() => handleAyahPress(item)}
          >
            <Ionicons name="share-social-outline" size={16} color={colors.gold} style={{ marginRight: 6 }} />
            <Text style={[styles.shareBtnLabel, { color: colors.gold }]}>Partager verset</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.verticalAyahCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
        onPress={() => handleAyahPress(item)}
        activeOpacity={0.8}
      >
        <View style={styles.cardTop}>
          <View style={[styles.badge, { backgroundColor: colors.gold }]}>
            <Text style={styles.badgeText}>{item.numberInSurah}</Text>
          </View>
        </View>

        <Text
          style={[
            styles.arabicTextVertical,
            { color: colors.textPrimary, fontSize: arabicFontSize, lineHeight: arabicFontSize * 1.8 },
          ]}
        >
          {item.text}
        </Text>

        {translationLang !== 'none' && item.translation ? (
          <Text style={[styles.translationText, { color: colors.textSecondary }]}>
            {item.translation}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bgPrimary} />

      {/* Barre de Recherche Integrée dans le Mushaf */}
      <View style={[styles.searchContainer, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Rechercher une sourate ou un Juz'..."
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

      {/* Sélecteur d'Onglets: Sourates vs Juz' */}
      <View style={[styles.tabSegmentContainer, { backgroundColor: colors.bgSecondary }]}>
        <TouchableOpacity
          style={[
            styles.tabSegmentBtn,
            activeTab === 'sourates' && { backgroundColor: colors.gold },
          ]}
          onPress={() => setActiveTab('sourates')}
        >
          <Text
            style={[
              styles.tabSegmentText,
              { color: activeTab === 'sourates' ? '#0F172A' : colors.textSecondary },
            ]}
          >
            📖 Sourates (114)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabSegmentBtn,
            activeTab === 'juz' && { backgroundColor: colors.gold },
          ]}
          onPress={() => setActiveTab('juz')}
        >
          <Text
            style={[
              styles.tabSegmentText,
              { color: activeTab === 'juz' ? '#0F172A' : colors.textSecondary },
            ]}
          >
            📜 Juz' (30)
          </Text>
        </TouchableOpacity>
      </View>

      {/* Carrousel de sélection rapide par Sourate ou Juz' */}
      <View style={{ maxHeight: 44, marginVertical: 6 }}>
        {activeTab === 'sourates' ? (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={filteredSurahs}
            keyExtractor={(item) => item.number.toString()}
            contentContainerStyle={{ paddingHorizontal: 12 }}
            renderItem={({ item }) => {
              const isSelected = item.number === currentSurahNumber;
              return (
                <TouchableOpacity
                  style={[
                    styles.chipBtn,
                    {
                      backgroundColor: isSelected ? colors.gold : colors.bgSecondary,
                      borderColor: isSelected ? colors.gold : colors.border,
                    },
                  ]}
                  onPress={() => setCurrentSurahNumber(item.number)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: isSelected ? '#0F172A' : colors.textPrimary },
                    ]}
                  >
                    {item.number}. {item.englishName}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        ) : (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={filteredJuz}
            keyExtractor={(item) => item.juzNumber.toString()}
            contentContainerStyle={{ paddingHorizontal: 12 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.chipBtn,
                  {
                    backgroundColor: colors.bgSecondary,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => handleJuzPress(item)}
              >
                <Text style={[styles.chipText, { color: colors.gold }]}>
                  {item.titleFr} ({item.titleAr})
                </Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      {/* Control Toolbar Header */}
      <View style={[styles.toolbar, { backgroundColor: colors.bgSecondary, borderBottomColor: colors.border }]}>
        {/* Prev / Next Surah */}
        <View style={styles.surahNavControls}>
          <TouchableOpacity
            onPress={handlePrevSurah}
            disabled={currentSurahNumber <= 1}
            style={[styles.navBtn, { opacity: currentSurahNumber <= 1 ? 0.3 : 1 }]}
          >
            <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.surahInfoBox}>
            <Text style={[styles.surahTitle, { color: colors.gold }]} numberOfLines={1}>
              {surahDetail?.englishName || `Sourate ${currentSurahNumber}`}
            </Text>
            <Text style={[styles.surahSubTitle, { color: colors.textSecondary }]}>
              Warsh (ورش) • N°{currentSurahNumber}/114
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleNextSurah}
            disabled={currentSurahNumber >= 114}
            style={[styles.navBtn, { opacity: currentSurahNumber >= 114 ? 0.3 : 1 }]}
          >
            <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Action Controls: Font size + Settings Modal Trigger Button */}
        <View style={styles.rightControls}>
          {/* Orientation Toggle Quick Button */}
          <TouchableOpacity
            style={[
              styles.orientationBtn,
              {
                backgroundColor: orientation === 'horizontal' ? colors.gold : colors.bgPrimary,
                borderColor: colors.border,
              },
            ]}
            onPress={() => setOrientation(orientation === 'vertical' ? 'horizontal' : 'vertical')}
            activeOpacity={0.8}
          >
            <Ionicons
              name={orientation === 'horizontal' ? 'swap-horizontal' : 'swap-vertical'}
              size={16}
              color={orientation === 'horizontal' ? '#0F172A' : colors.gold}
            />
            <Text
              style={[
                styles.orientationLabel,
                { color: orientation === 'horizontal' ? '#0F172A' : colors.textPrimary },
              ]}
            >
              {orientation === 'horizontal' ? 'Horiz. (RTL)' : 'Vert.'}
            </Text>
          </TouchableOpacity>

          {/* Bouton Paramètres ⚙️ */}
          <TouchableOpacity
            style={[styles.settingsBtn, { backgroundColor: colors.gold }]}
            onPress={() => setIsSettingsOpen(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="settings-sharp" size={18} color="#0F172A" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Chargement des versets Warsh...
          </Text>
        </View>
      ) : (
        <FlatList
          ref={ayahListRef}
          key={orientation} // force re-render on orientation change
          data={surahDetail?.ayahs}
          onScrollToIndexFailed={() => {}}
          horizontal={orientation === 'horizontal'}
          inverted={orientation === 'horizontal'} // Sens de défilement de Droite à Gauche (RTL) pour l'Arabe
          pagingEnabled={orientation === 'horizontal'}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.number.toString()}
          renderItem={renderAyahItem}
          contentContainerStyle={
            orientation === 'horizontal' ? styles.horizontalListContent : styles.verticalListContent
          }
        />
      )}

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

      {/* Share Modal */}
      {surahDetail && (
        <ShareVerseModal
          visible={shareModalVisible}
          ayah={selectedAyah}
          surahName={surahDetail.englishName}
          surahNumber={surahDetail.number}
          onClose={() => setShareModalVisible(false)}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
  },
  tabSegmentContainer: {
    flexDirection: 'row',
    marginHorizontal: 12,
    borderRadius: 12,
    padding: 3,
  },
  tabSegmentBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabSegmentText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  chipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    marginRight: 6,
  },
  chipText: {
    fontSize: 11.5,
    fontWeight: 'bold',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  surahNavControls: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  navBtn: {
    padding: 6,
  },
  surahInfoBox: {
    marginHorizontal: 8,
    flex: 1,
  },
  surahTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  surahSubTitle: {
    fontSize: 10,
    marginTop: 1,
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orientationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 6,
  },
  orientationLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  settingsBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
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
  verticalListContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 130,
  },
  horizontalListContent: {
    paddingHorizontal: 18,
    paddingVertical: 20,
    alignItems: 'center',
  },
  verticalAyahCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  horizontalPageCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    marginRight: 18,
    justifyContent: 'space-between',
    minHeight: Dimensions.get('window').height * 0.65,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  surahHeaderTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: {
    color: '#0F172A',
    fontWeight: 'bold',
    fontSize: 11,
  },
  arabicTextVertical: {
    textAlign: 'right',
  },
  arabicTextHorizontal: {
    textAlign: 'center',
    marginVertical: 10,
  },
  translationText: {
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12,
    fontStyle: 'italic',
  },
  shareActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
  },
  shareBtnLabel: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});
