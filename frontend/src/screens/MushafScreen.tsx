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
  ScrollView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  useWindowDimensions,
  Image,
  Platform,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../context/ThemeContext';
import { getSurahList } from '../services/quranService';
import { DEFAULT_ARABIC_FONT_SIZE, getArabicFontSize, setArabicFontSize, subscribeFontSizeChange } from '../services/settingsService';
import { setImmersive } from '../services/immersiveMode';
import {
  playAyahOnly,
  playAudioFromAyah,
  togglePlayPause,
  stopAudioTrack,
  subscribeAudioStatus,
  getAyahAtPosition,
  playSurahLoop,
} from '../services/audioService';
import {
  getFavoriteAyahs,
  getFavoriteSurahs,
  subscribeFavoritesChange,
  toggleFavoriteSurah,
  toggleFavoriteVerse,
} from '../services/favoritesService';
import { Surah } from '../types/quran';
import { getFrenchVerseTranslation } from '../services/quranService';
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
import { VerseShareSheet } from '../components/VerseShareSheet';
import { MushafIndexModal, MushafIndexTab } from '../components/mushaf/MushafIndexModal';
import { MushafPage } from '../components/mushaf/MushafPage';
import { MushafSearchModal } from '../components/mushaf/MushafSearchModal';
import { DIGITS_FONT, MushafPalette, mushafDark, mushafLight } from '../components/mushaf/mushafTheme';
import { MushafPlayRequest, MushafTabScreenProps } from '../navigation/types';

// Sens de lecture arabe : la dernière page est à gauche, la page 1 tout à droite. La liste
// est construite dans cet ordre plutôt qu'avec `inverted`, dont le retournement par
// transformations rend le défilement instable sur le web.
const PAGE_NUMBERS = Array.from({ length: MUSHAF_PAGE_COUNT }, (_, i) => MUSHAF_PAGE_COUNT - i);
const indexOfPage = (page: number) => MUSHAF_PAGE_COUNT - page;
// Safari et tous les navigateurs d'iPhone (moteur WebKit) : l'aimantation des pages par le
// navigateur (scroll-snap, utilisé par `pagingEnabled` sur le web) fait glisser la liste toute
// seule de page en page. On y cale donc la page la plus proche nous-mêmes, une fois le
// défilement terminé.
const IS_WEBKIT_WEB = (() => {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return isIOS || (/Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|Android/.test(ua));
})();
const SNAP_DELAY_MS = 120;

// Barre d'onglets flottante (bottom 12 + hauteur 68) : le Mushaf s'arrête au-dessus.
const TAB_BAR_SPACE = 84;

const reciterPhoto = require('../assets/serigne_abdou_bara.jpg');

const verseKey = (v: { surah: number; ayah: number }) => `${v.surah}:${v.ayah}`;

export const MushafScreen: React.FC<MushafTabScreenProps> = ({ route, navigation }) => {
  const { isDark } = useTheme();
  const p = isDark ? mushafDark : mushafLight;
  const { width } = useWindowDimensions();

  const [page, setPage] = useState<number | null>(null);
  const [pageHeight, setPageHeight] = useState(0);
  const [fontSize, setFontSize] = useState(DEFAULT_ARABIC_FONT_SIZE);
  const [revelationTypes, setRevelationTypes] = useState<Record<number, 'Meccan' | 'Medinan'>>({});
  const [bookmark, setBookmark] = useState<MushafBookmark | null>(null);
  // Versets favoris (« sourate:verset »), pour le libellé Ajouter / Retirer des favoris.
  const [favoriteKeys, setFavoriteKeys] = useState<Set<string>>(new Set());
  // Sourates favorites, et la liste des sourates (le favori garde la fiche complète, comme dans le Lecteur).
  const [favoriteSurahs, setFavoriteSurahs] = useState<Set<number>>(new Set());
  const [surahList, setSurahList] = useState<Surah[]>([]);
  const [chromeVisible, setChromeVisible] = useState(true);
  // Hauteur de l'en-tête : la bulle de récitation se place juste en dessous.
  const [topBarHeight, setTopBarHeight] = useState(0);
  const [indexVisible, setIndexVisible] = useState(false);
  const [indexTab, setIndexTab] = useState<MushafIndexTab>('surahs');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sheetVerse, setSheetVerse] = useState<MushafVerse | null>(null);
  const [shareTarget, setShareTarget] = useState<MushafVerse | null>(null);
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
  // « Écouter en boucle » : le verset choisi se répète jusqu'à l'arrêt.
  const [looping, setLooping] = useState(false);

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
        .then((list) => {
          setSurahList(list);
          setRevelationTypes(Object.fromEntries(list.map((s) => [s.number, s.revelationType])));
        })
        .catch(() => {});
      // Verset demandé depuis l'accueil, sinon la dernière page lue (ou le début de la
      // dernière sourate lue).
      const requested = route.params && getMushafVerse(route.params.surah, route.params.ayah);
      if (requested) {
        if (route.params?.highlight !== false) setFoundVerse(requested);
        openAt(requested.page);
        if (route.params?.play) startRequestedPlay(requested, route.params.play);
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
    setFoundVerse(route.params.highlight === false ? null : v);
    goToPage(v.page);
    if (route.params.play) startRequestedPlay(v, route.params.play);
  }, [route.params?.at]);

  useEffect(() => {
    const load = () => {
      getFavoriteAyahs().then((list) => setFavoriteKeys(new Set(list.map((i) => `${i.surahNumber}:${i.ayah.numberInSurah}`))));
      getFavoriteSurahs().then((list) => setFavoriteSurahs(new Set(list.map((s) => s.number))));
    };
    load();
    return subscribeFavoritesChange(load);
  }, []);

  // Taille du texte changée depuis les paramètres de l'accueil.
  useEffect(() => subscribeFontSizeChange(setFontSize), []);

  useEffect(() => {
    Animated.timing(chromeAnim, { toValue: chromeVisible ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [chromeVisible, chromeAnim]);

  // Barres masquées : la barre d'onglets se cache aussi (lecture plein écran), seulement
  // tant que le Mushaf est l'onglet affiché.
  const isFocused = useIsFocused();
  useEffect(() => {
    setImmersive(isFocused && !chromeVisible);
  }, [isFocused, chromeVisible]);
  useEffect(() => () => setImmersive(false), []);

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

  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const index = Math.round(x / width);
      const visible = PAGE_NUMBERS[index];
      if (visible) onPageVisible(visible);
      if (IS_WEBKIT_WEB) {
        if (snapTimer.current) clearTimeout(snapTimer.current);
        snapTimer.current = setTimeout(() => {
          if (Math.abs(x - index * width) > 1) listRef.current?.scrollToOffset({ offset: index * width, animated: true });
        }, SNAP_DELAY_MS);
      }
    },
    [width, onPageVisible]
  );
  useEffect(() => () => { if (snapTimer.current) clearTimeout(snapTimer.current); }, []);

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

  // L'utilisateur quitte la page récitée pendant la lecture : la récitation reprend au début
  // de la page qu'il regarde (après un court délai, pour ne pas relancer à chaque page
  // traversée en feuilletant). Ne dépend que de la page : quand la récitation tourne
  // elle-même la page, celle-ci est déjà la page du verset récité.
  const followTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (followTimer.current) clearTimeout(followTimer.current);
    if (page === null || !isPlaying || singleVerseRef.current || playbackSurah === null || recitedAyah === null) return;
    if (pageOfVerse(playbackSurah, recitedAyah) === page) return;
    followTimer.current = setTimeout(() => {
      if (pageRef.current !== page) return;
      const first = MUSHAF_PAGES[page - 1][0];
      reciteFrom(first.surah, first.ayah);
    }, 700);
  }, [page]);
  useEffect(() => () => { if (followTimer.current) clearTimeout(followTimer.current); }, []);

  const stopRecitation = () => {
    singleVerseRef.current = false;
    setLooping(false);
    playbackSurahRef.current = null;
    setPlaybackSurah(null);
    setRecitedAyah(null);
    setIsPlaying(false);
  };

  // `loop` : toute la sourate, depuis le début, recommence à la fin (écoute en boucle des favoris).
  const reciteFrom = async (surah: number, ayah: number, loop = false) => {
    const url = await getEffectiveAudioUrl(surah);
    singleVerseRef.current = false;
    setLooping(loop);
    playbackSurahRef.current = surah;
    setPlaybackSurah(surah);
    setRecitedAyah(loop ? 1 : ayah);
    const ok = loop ? await playSurahLoop(url) : await playAudioFromAyah(url, surah, ayah, surahVerseCount(surah));
    if (!ok) {
      stopRecitation();
      showToast('Audio indisponible');
    }
  };

  const handleListenPress = async () => {
    if (page === null) return;
    // En lecture : pause. En pause sur la page récitée : reprise. Sinon : lecture de la page affichée.
    if (playbackSurah !== null && recitedAyah !== null && (isPlaying || pageOfVerse(playbackSurah, recitedAyah) === page)) {
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

  const playSingleVerse = async (v: MushafVerse, loop = false) => {
    const url = await getEffectiveAudioUrl(v.surah);
    singleVerseRef.current = true;
    setLooping(loop);
    playbackSurahRef.current = v.surah;
    setPlaybackSurah(v.surah);
    setRecitedAyah(v.ayah);
    const ok = await playAyahOnly(url, v.surah, v.ayah, loop);
    if (!ok) {
      stopRecitation();
      showToast('Audio indisponible');
    } else if (loop) {
      showToast(`En boucle · ${surahNameLatin(v.surah)} ${v.ayah}`);
    }
  };

  // Écoute demandée depuis les favoris : le verset ou la sourate, une fois ou en boucle, surligné ici.
  // À l'ouverture du Mushaf, les deux effets qui lisent la demande la voient : elle n'est lancée
  // qu'une fois (sinon deux sons partent ensemble et l'un échappe à la boucle).
  const playedAtRef = useRef<number | undefined>(undefined);
  const startRequestedPlay = (v: MushafVerse, play: MushafPlayRequest) => {
    if (playedAtRef.current === route.params?.at) return;
    playedAtRef.current = route.params?.at;
    if (play === 'verse' || play === 'verseLoop') playSingleVerse(v, play === 'verseLoop');
    else reciteFrom(v.surah, 1, play === 'surahLoop');
  };

  // ---------- Favoris, marque-page / actions sur un verset ----------

  const handleFavorite = async (v: MushafVerse) => {
    // La traduction est gardée avec le favori, pour l'afficher dans la liste (si on l'a).
    const translation = favoriteKeys.has(verseKey(v)) ? null : await getFrenchVerseTranslation(v.surah, v.ayah);
    const added = await toggleFavoriteVerse(v.surah, v.ayah, translation);
    showToast(added ? `Ajouté aux favoris · ${surahNameLatin(v.surah)} ${v.ayah}` : 'Retiré des favoris');
  };

  // Cœur à côté du nom d'une sourate, dans l'index (qui affiche lui-même le message).
  const handleFavoriteSurah = async (number: number): Promise<boolean | null> => {
    const surah = surahList.find((s) => s.number === number);
    return surah ? toggleFavoriteSurah(surah) : null;
  };

  // Marque-page : l'endroit où l'on s'est arrêté (un seul, ruban sur la page).
  const handleMarker = async (v: MushafVerse) => {
    if (bookmark?.surahNumber === v.surah && bookmark.verseNumber === v.ayah) {
      await clearMushafBookmark();
      setBookmark(null);
      showToast('Marque-page retiré');
      return;
    }
    setBookmark(await saveMushafBookmark(v.surah, v.ayah, v.page));
    showToast(`Marque-page placé · ${surahNameLatin(v.surah)} ${v.ayah}`);
  };

  const verseReference = (v: MushafVerse) =>
    `${surahNameLatin(v.surah)} (${surahNameAr(v.surah)}) · verset ${v.ayah} — Mushaf Warsh, page ${v.page}`;

  const handleCopy = async (v: MushafVerse) => {
    await Clipboard.setStringAsync(`${v.text.replace(/۞\s*/g, '')}\n\n${verseReference(v)}`);
    showToast('Verset copié');
  };

  // Image ou vidéo aux couleurs de l'app (web), texte mis en forme ailleurs : voir VerseShareSheet.
  const handleShare = (v: MushafVerse) => setShareTarget(v);

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

      <View style={styles.pagesArea} onLayout={(e) => setPageHeight(e.nativeEvent.layout.height)}>
        {page !== null && pageHeight > 0 && (
          <FlatList
            key={listKey}
            ref={listRef}
            data={PAGE_NUMBERS}
            keyExtractor={(n) => String(n)}
            renderItem={renderPage}
            extraData={renderPage}
            horizontal
            pagingEnabled={!IS_WEBKIT_WEB}
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
          onLayout={(e) => setTopBarHeight(e.nativeEvent.layout.height)}
          style={[
            styles.topBar,
            { backgroundColor: p.chrome, borderColor: p.goldSoft, opacity: chromeAnim, transform: [{ translateY: chromeTranslateTop }] },
          ]}
        >
          <TouchableOpacity
            style={[styles.topSide, styles.topLeft]}
            onPress={() => {
              setIndexTab('juz');
              setIndexVisible(true);
            }}
          >
            <Image
              source={reciterPhoto}
              style={[styles.topPhoto, { borderColor: p.gold }]}
              accessibilityLabel="Serigne Aboul Baraka Mbacké"
            />
            <View style={styles.topLeftText}>
              <Text style={[styles.topSideText, { color: p.title }]} numberOfLines={1}>
                {juzNameAr(firstVerse.juz)}
              </Text>
              <Text style={[styles.topSideSub, { color: p.muted }]} numberOfLines={1}>
                {hizbLabelAr(firstVerse.eighth)}
              </Text>
            </View>
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
        <ToolbarButton icon="heart-outline" label="Favoris" color={p.onGreen} onPress={() => navigation.navigate('FavoritesTab')} />
        <ToolbarButton icon="text-outline" label="Affichage" color={p.onGreen} onPress={() => setSettingsOpen(true)} />
      </Animated.View>

      {reciting && (
        <View
          style={[
            styles.nowPlaying,
            { backgroundColor: p.chrome, borderColor: p.goldSoft, top: chromeVisible && topBarHeight ? topBarHeight + 6 : 8 },
          ]}
        >
          <Ionicons name={looping ? 'repeat' : isPlaying ? 'volume-medium' : 'volume-mute'} size={13} color={p.title} />
          <Text style={[styles.nowPlayingText, { color: p.ink }]} numberOfLines={1}>
            {surahNameLatin(playbackSurah!)} · verset {recitedAyah}
            {looping ? ' · en boucle' : ''}
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
              {/* Défile sur les petits écrans : un long verset et toutes les actions n'y tiennent pas. */}
              <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetActions} showsVerticalScrollIndicator={false}>
                <SheetAction icon="play-circle-outline" label="Écouter ce verset" palette={p} onPress={() => runSheetAction((v) => playSingleVerse(v))} />
                <SheetAction icon="repeat" label="Écouter en boucle" palette={p} onPress={() => runSheetAction((v) => playSingleVerse(v, true))} />
                <SheetAction
                  icon="play-forward-outline"
                  label="Réciter à partir d'ici"
                  palette={p}
                  onPress={() => runSheetAction((v) => reciteFrom(v.surah, v.ayah))}
                />
                <SheetAction
                  icon={favoriteKeys.has(verseKey(sheetVerse)) ? 'heart' : 'heart-outline'}
                  label={favoriteKeys.has(verseKey(sheetVerse)) ? 'Retirer le verset des favoris' : 'Ajouter le verset aux favoris'}
                  palette={p}
                  onPress={() => runSheetAction(handleFavorite)}
                />
                <SheetAction
                  icon={bookmark?.surahNumber === sheetVerse.surah && bookmark.verseNumber === sheetVerse.ayah ? 'bookmark' : 'bookmark-outline'}
                  label={bookmark?.surahNumber === sheetVerse.surah && bookmark.verseNumber === sheetVerse.ayah ? 'Retirer le marque-page' : 'Marque-page ici'}
                  palette={p}
                  onPress={() => runSheetAction(handleMarker)}
                />
                <SheetAction icon="copy-outline" label="Copier" palette={p} onPress={() => runSheetAction(handleCopy)} />
                <SheetAction icon="share-social-outline" label="Partager" palette={p} onPress={() => runSheetAction(handleShare)} />
              </ScrollView>
            </Pressable>
          )}
        </Pressable>
      </Modal>

      <VerseShareSheet verse={shareTarget} onClose={() => setShareTarget(null)} />

      <MushafIndexModal
        visible={indexVisible}
        initialTab={indexTab}
        currentSurah={firstVerse?.surah ?? 1}
        currentEighth={firstVerse?.eighth ?? 1}
        bookmark={bookmark}
        revelationTypes={revelationTypes}
        palette={p}
        favoriteSurahs={favoriteSurahs}
        onToggleFavoriteSurah={handleFavoriteSurah}
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
  // minWidth 0 + overflow : sur Safari, un texte trop long (plusieurs sourates sur la page,
  // nom du hizb) déborde sinon sur la colonne voisine au lieu d'être coupé.
  topSide: {
    width: 116,
    minWidth: 0,
    overflow: 'hidden',
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  topLeftText: {
    flex: 1,
    minWidth: 0,
  },
  topPhoto: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
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
    minWidth: 0,
    overflow: 'hidden',
    alignItems: 'stretch',
    paddingHorizontal: 6,
  },
  topTitle: {
    fontFamily: 'KFGQPC_Warsh',
    fontSize: 19,
    lineHeight: 34,
    paddingTop: 2,
    // La police Warsh déborde légèrement de sa boîte : évite de rogner la première lettre.
    paddingHorizontal: 6,
    textAlign: 'center',
  },
  topSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -4,
  },
  topSub: {
    flexShrink: 1,
    minWidth: 0,
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
    maxWidth: '86%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  nowPlayingText: {
    flexShrink: 1,
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
    maxHeight: '90%',
  },
  sheetScroll: {
    flexGrow: 0,
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
