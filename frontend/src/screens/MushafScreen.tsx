import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Animated,
  Modal,
  Pressable,
  Share,
  NativeScrollEvent,
  NativeSyntheticEvent,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../context/ThemeContext';
import { getSurahList } from '../services/quranService';
import { getArabicFontSize, setArabicFontSize, subscribeFontSizeChange } from '../services/settingsService';
import {
  playAyahOnly,
  playAudioFromAyah,
  togglePlayPause,
  stopAudioTrack,
  subscribeAudioStatus,
  getAyahAtPosition,
} from '../services/audioService';
import { getEffectiveAudioUrl } from '../services/downloadService';
import {
  saveLastReadPosition,
  getLastReadPosition,
  getMushafBookmark,
  saveMushafBookmark,
  clearMushafBookmark,
  getMushafLastPage,
  saveMushafLastPage,
  MushafBookmark,
} from '../services/bookmarkService';
import {
  MUSHAF_PAGES,
  MUSHAF_PAGE_COUNT,
  MushafVerse,
  getMushafVerse,
  hizbLabelAr,
  juzNameAr,
  pageOfVerse,
  surahNameAr,
  surahNameLatin,
  surahVerseCount,
  toArabicDigits,
} from '../services/warshMushafService';
import { SettingsModal } from '../components/SettingsModal';
import { MushafIndexModal, MushafIndexTab } from '../components/mushaf/MushafIndexModal';
import { MushafPage } from '../components/mushaf/MushafPage';
import { MushafSearchModal } from '../components/mushaf/MushafSearchModal';
import { DIGITS_FONT, MushafPalette, mushafDark, mushafLight } from '../components/mushaf/mushafTheme';
import { MushafTabScreenProps } from '../navigation/types';

// Sens de lecture arabe : la dernière page est à gauche, la page 1 tout à droite. La liste
// est construite dans cet ordre plutôt qu'avec `inverted`, dont le retournement par
// transformations rend le défilement instable sur le web.
const PAGE_NUMBERS = Array.from({ length: MUSHAF_PAGE_COUNT }, (_, i) => MUSHAF_PAGE_COUNT - i);
const indexOfPage = (page: number) => MUSHAF_PAGE_COUNT - page;
// Barre d'onglets flottante (bottom 12 + hauteur 68) : le Mushaf s'arrête au-dessus.
const TAB_BAR_SPACE = 84;

const verseKey = (v: { surah: number; ayah: number }) => `${v.surah}:${v.ayah}`;

export const MushafScreen: React.FC<MushafTabScreenProps> = ({ route }) => {
  const { isDark } = useTheme();
  const p = isDark ? mushafDark : mushafLight;
  const { width } = useWindowDimensions();

  const [page, setPage] = useState<number | null>(null);
  const [pageHeight, setPageHeight] = useState(0);
  const [fontSize, setFontSize] = useState(24);
  const [revelationTypes, setRevelationTypes] = useState<Record<number, 'Meccan' | 'Medinan'>>({});
  const [bookmark, setBookmark] = useState<MushafBookmark | null>(null);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [indexVisible, setIndexVisible] = useState(false);
  const [indexTab, setIndexTab] = useState<MushafIndexTab>('surahs');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sheetVerse, setSheetVerse] = useState<MushafVerse | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  // Verset ouvert depuis la recherche : surligné sur sa page.
  const [foundVerse, setFoundVerse] = useState<MushafVerse | null>(null);

  // Récitation lancée depuis le Mushaf : sourate jouée + verset en cours (surligné).
  const [playbackSurah, setPlaybackSurah] = useState<number | null>(null);
  const [recitedAyah, setRecitedAyah] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const playbackSurahRef = useRef<number | null>(null);
  // « Écouter ce verset » : le verset reste celui choisi. Sans cela, la position de lecture
  // (0 au chargement, début du verset suivant à l'arrêt) ferait surligner un autre verset.
  const singleVerseRef = useRef(false);

  const [toast, setToast] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chromeAnim = useRef(new Animated.Value(1)).current;

  const listRef = useRef<FlatList<number>>(null);
  const pageRef = useRef<number | null>(null);

  // ---------- Chargement ----------

  // Page d'ouverture, avant que la liste des pages ne soit affichée.
  const openAt = (target: number) => {
    pageRef.current = target;
    setPage(target);
  };

  useEffect(() => {
    (async () => {
      getArabicFontSize().then(setFontSize);
      getMushafBookmark().then(setBookmark);
      getSurahList()
        .then((list) => setRevelationTypes(Object.fromEntries(list.map((s) => [s.number, s.revelationType]))))
        .catch(() => {});
      // Verset demandé depuis l'accueil, sinon la dernière page lue (ou le début de la
      // dernière sourate lue).
      const requested = route.params && getMushafVerse(route.params.surah, route.params.ayah);
      if (requested) {
        setFoundVerse(requested);
        openAt(requested.page);
        return;
      }
      const lastPage = await getMushafLastPage();
      if (lastPage) {
        openAt(lastPage);
        return;
      }
      const lastRead = await getLastReadPosition();
      openAt(lastRead ? pageOfVerse(lastRead.surahNumber, 1) : 1);
    })();
  }, []);

  // Verset demandé depuis l'accueil (« Reprendre », « Verset du jour ») alors que le Mushaf
  // est déjà ouvert.
  useEffect(() => {
    if (!route.params || pageRef.current === null) return;
    const v = getMushafVerse(route.params.surah, route.params.ayah);
    if (!v) return;
    setFoundVerse(v);
    goToPage(v.page);
  }, [route.params?.at]);

  // Taille du texte changée depuis les paramètres de l'accueil.
  useEffect(() => subscribeFontSizeChange(setFontSize), []);

  useEffect(() => {
    Animated.timing(chromeAnim, { toValue: chromeVisible ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [chromeVisible, chromeAnim]);

  const showToast = useCallback(
    (text: string) => {
      setToast(text);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      Animated.timing(toastAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      toastTimer.current = setTimeout(() => {
        Animated.timing(toastAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start();
      }, 1800);
    },
    [toastAnim]
  );

  // ---------- Pages ----------

  const onPageVisible = useRef((visible: number) => {
    if (visible === pageRef.current) return;
    const previous = pageRef.current;
    pageRef.current = visible;
    setPage(visible);
    saveMushafLastPage(visible);
    const first = MUSHAF_PAGES[visible - 1][0];
    saveLastReadPosition(first.surah, surahNameAr(first.surah), surahNameLatin(first.surah), first.ayah);
    if (previous !== null) {
      setChromeVisible(false);
      const before = MUSHAF_PAGES[previous - 1][0];
      if (before.juz !== first.juz || hizbLabelAr(before.eighth) !== hizbLabelAr(first.eighth)) {
        showToast(`${juzNameAr(first.juz)}  ·  ${hizbLabelAr(first.eighth)}`);
      }
    }
  }).current;

  // Page voisine : défilement animé. Saut plus lointain (index, récitation) : la liste est
  // recréée directement sur la page visée ; sur le web, défiler vers des pages pas encore
  // affichées laisse le magnétisme du défilement ramener la liste vers les pages chargées.
  const [listKey, setListKey] = useState(0);
  const goToPage = useCallback(
    (target: number, animated = false) => {
      const clamped = Math.max(1, Math.min(MUSHAF_PAGE_COUNT, target));
      if (clamped === pageRef.current) return;
      if (animated && pageRef.current !== null && Math.abs(clamped - pageRef.current) === 1) {
        listRef.current?.scrollToIndex({ index: indexOfPage(clamped), animated: true });
        return;
      }
      onPageVisible(clamped);
      setListKey((k) => k + 1);
    },
    [onPageVisible]
  );

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(e.nativeEvent.contentOffset.x / width);
      const visible = PAGE_NUMBERS[index];
      if (visible) onPageVisible(visible);
    },
    [width, onPageVisible]
  );

  // ---------- Récitation ----------

  useEffect(() => {
    return subscribeAudioStatus((status) => {
      const surah = playbackSurahRef.current;
      if (surah === null) return;
      setIsPlaying(status.isPlaying);
      if (!status.isLoaded || singleVerseRef.current) return;
      const ayah = getAyahAtPosition(surah, status.position);
      setRecitedAyah((prev) => (prev === ayah ? prev : ayah));
    });
  }, []);

  // Suit la récitation : tourne la page quand le verset récité passe sur la page suivante.
  useEffect(() => {
    if (!isPlaying || playbackSurah === null || recitedAyah === null) return;
    const target = pageOfVerse(playbackSurah, recitedAyah);
    if (target !== pageRef.current) goToPage(target, true);
  }, [recitedAyah, isPlaying, playbackSurah, goToPage]);

  const stopRecitation = () => {
    singleVerseRef.current = false;
    playbackSurahRef.current = null;
    setPlaybackSurah(null);
    setRecitedAyah(null);
    setIsPlaying(false);
  };

  const reciteFrom = async (surah: number, ayah: number) => {
    const url = await getEffectiveAudioUrl(surah);
    singleVerseRef.current = false;
    playbackSurahRef.current = surah;
    setPlaybackSurah(surah);
    setRecitedAyah(ayah);
    const ok = await playAudioFromAyah(url, surah, ayah, surahVerseCount(surah));
    if (!ok) {
      stopRecitation();
      showToast('Audio indisponible');
    }
  };

  const handleListenPress = async () => {
    if (page === null) return;
    if (playbackSurah !== null && recitedAyah !== null) {
      // Reprise après un verset écouté seul : la récitation continue, le surlignage la suit.
      if (!isPlaying) singleVerseRef.current = false;
      await togglePlayPause();
      return;
    }
    const first = MUSHAF_PAGES[page - 1][0];
    await reciteFrom(first.surah, first.ayah);
  };

  const handleStopPress = async () => {
    await stopAudioTrack();
    stopRecitation();
  };

  const playSingleVerse = async (v: MushafVerse) => {
    const url = await getEffectiveAudioUrl(v.surah);
    singleVerseRef.current = true;
    playbackSurahRef.current = v.surah;
    setPlaybackSurah(v.surah);
    setRecitedAyah(v.ayah);
    const ok = await playAyahOnly(url, v.surah, v.ayah);
    if (!ok) {
      stopRecitation();
      showToast('Audio indisponible');
    }
  };

  // ---------- Signet / actions sur un verset ----------

  const placeBookmark = async (v: MushafVerse) => {
    setBookmark(await saveMushafBookmark(v.surah, v.ayah, v.page));
    showToast(`Signet placé · ${surahNameLatin(v.surah)} ${v.ayah}`);
  };

  const handleBookmarkPress = async () => {
    if (page === null) return;
    if (bookmark?.page === page) {
      await clearMushafBookmark();
      setBookmark(null);
      showToast('Signet retiré');
      return;
    }
    await placeBookmark(MUSHAF_PAGES[page - 1][0]);
  };

  const verseReference = (v: MushafVerse) =>
    `${surahNameLatin(v.surah)} (${surahNameAr(v.surah)}) · verset ${v.ayah} — Mushaf Warsh, page ${v.page}`;

  const handleCopy = async (v: MushafVerse) => {
    await Clipboard.setStringAsync(`${v.text.replace(/۞\s*/g, '')}\n\n${verseReference(v)}`);
    showToast('Verset copié');
  };

  const handleShare = (v: MushafVerse) => {
    Share.share({ message: `${v.text.replace(/۞\s*/g, '')}\n\n${verseReference(v)}\n\nAL BARAKA` }).catch(() => {});
  };

  const handleVersePress = useCallback((v: MushafVerse) => setSheetVerse(v), []);
  const handleBackgroundPress = useCallback(() => setChromeVisible((visible) => !visible), []);

  const handleFontChange = async (delta: number) => {
    setFontSize(await setArabicFontSize(fontSize + delta));
  };

  const runSheetAction = (action: (v: MushafVerse) => void) => {
    if (!sheetVerse) return;
    action(sheetVerse);
    setSheetVerse(null);
  };

  // ---------- Rendu ----------

  const pageVerses = page ? MUSHAF_PAGES[page - 1] : [];
  const firstVerse = pageVerses[0];
  const highlighted = sheetVerse ?? foundVerse;
  const selectedKey = highlighted ? verseKey(highlighted) : null;
  const recitedKey = playbackSurah !== null && recitedAyah !== null ? `${playbackSurah}:${recitedAyah}` : null;
  const recitedPage = playbackSurah !== null && recitedAyah !== null ? getMushafVerse(playbackSurah, recitedAyah)?.page : undefined;
  const selectedPage = highlighted?.page;

  const renderPage = useCallback(
    ({ item }: { item: number }) => (
      <MushafPage
        page={item}
        width={width}
        height={pageHeight}
        palette={p}
        fontSize={fontSize}
        selectedKey={item === selectedPage ? selectedKey : null}
        recitedKey={item === recitedPage ? recitedKey : null}
        bookmarked={bookmark?.page === item}
        revelationTypes={revelationTypes}
        onVersePress={handleVersePress}
        onBackgroundPress={handleBackgroundPress}
      />
    ),
    [width, pageHeight, p, fontSize, selectedPage, selectedKey, recitedPage, recitedKey, bookmark, revelationTypes, handleVersePress, handleBackgroundPress]
  );

  const pageSurahs = useMemo(() => [...new Set(pageVerses.map((v) => v.surah))], [pageVerses]);
  const chromeTranslateTop = chromeAnim.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] });
  const chromeTranslateBottom = chromeAnim.interpolate({ inputRange: [0, 1], outputRange: [120, 0] });
  const reciting = playbackSurah !== null && recitedAyah !== null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: p.screen }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={p.screen} />

      <View style={[styles.pagesArea, { marginBottom: TAB_BAR_SPACE }]} onLayout={(e) => setPageHeight(e.nativeEvent.layout.height)}>
        {page !== null && pageHeight > 0 && (
          <FlatList
            key={listKey}
            ref={listRef}
            data={PAGE_NUMBERS}
            keyExtractor={(n) => String(n)}
            renderItem={renderPage}
            extraData={renderPage}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            initialScrollIndex={indexOfPage(page)}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            windowSize={3}
            onScroll={handleScroll}
            scrollEventThrottle={32}
            onScrollToIndexFailed={({ index }) => setTimeout(() => listRef.current?.scrollToIndex({ index, animated: false }), 50)}
          />
        )}
      </View>

      {/* En-tête (masqué en lecture, réapparaît d'une touche sur la page) */}
      {firstVerse && (
        <Animated.View
          pointerEvents={chromeVisible ? 'auto' : 'none'}
          style={[
            styles.topBar,
            { backgroundColor: p.chrome, borderColor: p.goldSoft, opacity: chromeAnim, transform: [{ translateY: chromeTranslateTop }] },
          ]}
        >
          <TouchableOpacity
            style={styles.topSide}
            onPress={() => {
              setIndexTab('juz');
              setIndexVisible(true);
            }}
          >
            <Text style={[styles.topSideText, { color: p.title }]} numberOfLines={1}>
              {juzNameAr(firstVerse.juz)}
            </Text>
            <Text style={[styles.topSideSub, { color: p.muted }]} numberOfLines={1}>
              {hizbLabelAr(firstVerse.eighth)}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.topCenter}
            onPress={() => {
              setIndexTab('surahs');
              setIndexVisible(true);
            }}
          >
            <Text style={[styles.topTitle, { color: p.ink }]} numberOfLines={1}>
              سورة {pageSurahs.map(surahNameAr).join(' · ')}
            </Text>
            <View style={styles.topSubRow}>
              <Text style={[styles.topSub, { color: p.muted }]} numberOfLines={1}>
                {pageSurahs.map(surahNameLatin).join(' · ')}
              </Text>
              <Ionicons name="chevron-down" size={11} color={p.muted} style={{ marginLeft: 3 }} />
            </View>
          </TouchableOpacity>
          <View style={[styles.topSide, { alignItems: 'flex-end' }]}>
            <Text style={[styles.topPage, { color: p.gold }]}>{toArabicDigits(page ?? 1)}</Text>
            <Text style={[styles.topSideSub, { color: p.muted }]}>Page {page}</Text>
          </View>
        </Animated.View>
      )}

      {/* Bulle Juz' / Hizb / messages */}
      <Animated.View pointerEvents="none" style={[styles.toast, { backgroundColor: p.greenDeep, borderColor: p.gold, opacity: toastAnim }]}>
        <Text style={[styles.toastText, { color: p.onGreen }]}>{toast}</Text>
      </Animated.View>

      {/* Barre d'outils */}
      <Animated.View
        pointerEvents={chromeVisible ? 'auto' : 'none'}
        style={[
          styles.toolbar,
          { backgroundColor: p.greenDeep, borderColor: p.gold, opacity: chromeAnim, transform: [{ translateY: chromeTranslateBottom }] },
        ]}
      >
        <ToolbarButton
          icon="list"
          label="Index"
          color={p.onGreen}
          onPress={() => {
            setIndexTab('surahs');
            setIndexVisible(true);
          }}
        />
        <ToolbarButton icon="search" label="Recherche" color={p.onGreen} onPress={() => setSearchOpen(true)} />
        <TouchableOpacity
          style={[styles.listenBtn, { backgroundColor: p.gold }]}
          onPress={handleListenPress}
          onLongPress={handleStopPress}
          activeOpacity={0.85}
        >
          <Ionicons
            name={reciting && isPlaying ? 'pause' : 'play'}
            size={24}
            color={p.greenDeep}
            style={reciting && isPlaying ? undefined : { marginLeft: 3 }}
          />
        </TouchableOpacity>
        <ToolbarButton
          icon={bookmark?.page === page ? 'bookmark' : 'bookmark-outline'}
          label="Signet"
          color={p.onGreen}
          onPress={handleBookmarkPress}
        />
        <ToolbarButton icon="text-outline" label="Affichage" color={p.onGreen} onPress={() => setSettingsOpen(true)} />
      </Animated.View>

      {reciting && (
        <View style={[styles.nowPlaying, { backgroundColor: p.chrome, borderColor: p.goldSoft }]}>
          <Ionicons name={isPlaying ? 'volume-medium' : 'volume-mute'} size={13} color={p.title} />
          <Text style={[styles.nowPlayingText, { color: p.ink }]}>
            {surahNameLatin(playbackSurah!)} · verset {recitedAyah}
          </Text>
          <TouchableOpacity onPress={() => goToPage(pageOfVerse(playbackSurah!, recitedAyah!), true)} hitSlop={8}>
            <Ionicons name="locate" size={14} color={p.gold} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleStopPress} hitSlop={8}>
            <Ionicons name="close" size={14} color={p.muted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Actions sur un verset */}
      <Modal visible={!!sheetVerse} transparent animationType="fade" onRequestClose={() => setSheetVerse(null)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setSheetVerse(null)}>
          {sheetVerse && (
            <Pressable style={[styles.sheet, { backgroundColor: p.page, borderColor: p.gold }]}>
              <Text style={[styles.sheetTitle, { color: p.title }]}>
                سورة {surahNameAr(sheetVerse.surah)} · <Text style={{ fontFamily: DIGITS_FONT }}>{toArabicDigits(sheetVerse.ayah)}</Text>
              </Text>
              <Text style={[styles.sheetSub, { color: p.muted }]}>
                {surahNameLatin(sheetVerse.surah)} · verset {sheetVerse.ayah} · page {sheetVerse.page}
              </Text>
              <Text style={[styles.sheetVerse, { color: p.ink }]} numberOfLines={6}>
                {sheetVerse.text}
              </Text>
              <View style={styles.sheetActions}>
                <SheetAction icon="play-circle-outline" label="Écouter ce verset" palette={p} onPress={() => runSheetAction(playSingleVerse)} />
                <SheetAction
                  icon="play-forward-outline"
                  label="Réciter à partir d'ici"
                  palette={p}
                  onPress={() => runSheetAction((v) => reciteFrom(v.surah, v.ayah))}
                />
                <SheetAction icon="bookmark-outline" label="Placer le signet ici" palette={p} onPress={() => runSheetAction(placeBookmark)} />
                <SheetAction icon="copy-outline" label="Copier" palette={p} onPress={() => runSheetAction(handleCopy)} />
                <SheetAction icon="share-social-outline" label="Partager" palette={p} onPress={() => runSheetAction(handleShare)} />
              </View>
            </Pressable>
          )}
        </Pressable>
      </Modal>

      <MushafIndexModal
        visible={indexVisible}
        initialTab={indexTab}
        currentSurah={firstVerse?.surah ?? 1}
        currentEighth={firstVerse?.eighth ?? 1}
        bookmark={bookmark}
        revelationTypes={revelationTypes}
        palette={p}
        onClose={() => setIndexVisible(false)}
        onSelectPage={(target) => goToPage(target)}
      />

      <MushafSearchModal
        visible={searchOpen}
        palette={p}
        onClose={() => setSearchOpen(false)}
        onSelectVerse={(v) => {
          setFoundVerse(v);
          goToPage(v.page);
        }}
      />

      <SettingsModal
        visible={settingsOpen}
        fontSize={fontSize}
        onClose={() => setSettingsOpen(false)}
        onChangeFontSize={handleFontChange}
      />
    </SafeAreaView>
  );
};

const ToolbarButton: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}> = ({ icon, label, color, onPress }) => (
  <TouchableOpacity style={styles.toolBtn} onPress={onPress} activeOpacity={0.7}>
    <Ionicons name={icon} size={20} color={color} />
    <Text style={[styles.toolLabel, { color }]}>{label}</Text>
  </TouchableOpacity>
);

const SheetAction: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  palette: MushafPalette;
  onPress: () => void;
}> = ({ icon, label, palette: p, onPress }) => (
  <TouchableOpacity style={[styles.sheetAction, { borderColor: p.chromeBorder }]} onPress={onPress} activeOpacity={0.7}>
    <Ionicons name={icon} size={20} color={p.gold} />
    <Text style={[styles.sheetActionLabel, { color: p.ink }]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pagesArea: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
  },
  topSide: {
    width: 100,
  },
  topSideText: {
    fontFamily: 'KFGQPC_Warsh',
    fontSize: 15,
    lineHeight: 24,
  },
  topSideSub: {
    fontSize: 10,
    marginTop: -2,
  },
  topCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  topTitle: {
    fontFamily: 'KFGQPC_Warsh',
    fontSize: 19,
    lineHeight: 34,
    paddingTop: 2,
    // La police Warsh déborde légèrement de sa boîte : évite de rogner la première lettre.
    paddingHorizontal: 6,
  },
  topSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -4,
  },
  topSub: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
  topPage: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  toast: {
    position: 'absolute',
    top: 78,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
  },
  toastText: {
    // Police du système : le libellé contient le numéro du Hizb (voir DIGITS_FONT).
    fontFamily: DIGITS_FONT,
    fontSize: 15,
    lineHeight: 26,
    textAlign: 'center',
  },
  toolbar: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: TAB_BAR_SPACE + 8,
    height: 58,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  toolBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 58,
  },
  toolLabel: {
    fontSize: 9.5,
    marginTop: 2,
    fontWeight: '600',
  },
  listenBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  nowPlaying: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  nowPlayingText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 30,
  },
  sheetTitle: {
    fontFamily: 'KFGQPC_Warsh',
    fontSize: 20,
    lineHeight: 34,
    textAlign: 'center',
  },
  sheetSub: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: -2,
  },
  sheetVerse: {
    fontFamily: 'KFGQPC_Warsh',
    fontSize: 20,
    lineHeight: 40,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginVertical: 12,
  },
  sheetActions: {
    gap: 8,
  },
  sheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
  },
  sheetActionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
