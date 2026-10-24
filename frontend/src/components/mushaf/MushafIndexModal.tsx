import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput, SafeAreaView } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { MushafPalette } from './mushafTheme';
import { AyahRosette, OrnamentDivider } from './Ornaments';
import {
  EIGHTH_STARTS,
  JUZ_START_PAGES,
  MUSHAF_PAGE_COUNT,
  juzNameAr,
  pageOfVerse,
  surahNameAr,
  surahNameLatin,
  surahVerseCount,
  toArabicDigits,
} from '../../services/warshMushafService';
import { MushafBookmark } from '../../services/bookmarkService';

export type MushafIndexTab = 'surahs' | 'juz';

interface MushafIndexModalProps {
  visible: boolean;
  initialTab: MushafIndexTab;
  currentSurah: number;
  currentEighth: number;
  bookmark: MushafBookmark | null;
  revelationTypes: Record<number, 'Meccan' | 'Medinan'>;
  palette: MushafPalette;
  onClose: () => void;
  onSelectPage: (page: number) => void;
}

// Les huitièmes pairs (0, 2, 4, 6) d'un Hizb ouvrent ses quarts.
const QUARTER_LABELS = ['الحزب', 'ربع', 'نصف', 'ثلاثة أرباع'];

const SURAH_ROWS = Array.from({ length: 114 }, (_, i) => ({
  number: i + 1,
  nameAr: surahNameAr(i + 1),
  nameLatin: surahNameLatin(i + 1),
  verses: surahVerseCount(i + 1),
  page: pageOfVerse(i + 1, 1),
}));

const normalizeLatin = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const MushafIndexModal: React.FC<MushafIndexModalProps> = ({
  visible,
  initialTab,
  currentSurah,
  currentEighth,
  bookmark,
  revelationTypes,
  palette: p,
  onClose,
  onSelectPage,
}) => {
  const [tab, setTab] = useState<MushafIndexTab>(initialTab);
  const [query, setQuery] = useState('');
  const [pageInput, setPageInput] = useState('');
  const juzListRef = useRef<FlatList<number>>(null);

  useEffect(() => {
    if (visible) {
      setTab(initialTab);
      setQuery('');
      setPageInput('');
    }
  }, [visible, initialTab]);

  const filteredSurahs = useMemo(() => {
    const q = normalizeLatin(query.trim());
    if (!q) return SURAH_ROWS;
    return SURAH_ROWS.filter((s) => String(s.number) === q || normalizeLatin(s.nameLatin).includes(q) || s.nameAr.includes(query.trim()));
  }, [query]);

  const select = (page: number) => {
    onSelectPage(page);
    onClose();
  };

  const submitPage = () => {
    const page = parseInt(pageInput, 10);
    if (page >= 1 && page <= MUSHAF_PAGE_COUNT) select(page);
  };

  const currentJuz = Math.ceil(currentEighth / 16) || 1;

  const renderSurah = ({ item }: { item: (typeof SURAH_ROWS)[number] }) => {
    const active = item.number === currentSurah;
    const meccan = (revelationTypes[item.number] ?? 'Meccan') === 'Meccan';
    return (
      <TouchableOpacity
        style={[styles.surahRow, { borderBottomColor: p.chromeBorder }, active && { backgroundColor: p.selected }]}
        onPress={() => select(item.page)}
        activeOpacity={0.7}
      >
        <AyahRosette number={item.number} size={38} palette={p} />
        <View style={styles.surahInfo}>
          <Text style={[styles.surahLatin, { color: p.ink }]}>{item.nameLatin}</Text>
          <View style={styles.surahMetaRow}>
            <MaterialCommunityIcons name={meccan ? 'cube' : 'mosque'} size={12} color={p.gold} style={{ marginRight: 4 }} />
            <Text style={[styles.surahMeta, { color: p.muted }]}>
              {meccan ? 'Mecquoise' : 'Médinoise'} · {item.verses} versets
            </Text>
          </View>
        </View>
        <Text style={[styles.surahArabic, { color: p.title }]} numberOfLines={1}>
          {item.nameAr}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderJuz = ({ item: juz }: { item: number }) => {
    const active = juz === currentJuz;
    return (
      <View style={[styles.juzCard, { backgroundColor: p.page, borderColor: active ? p.gold : p.chromeBorder }]}>
        <TouchableOpacity
          style={[styles.juzHeader, { borderBottomColor: p.chromeBorder }]}
          onPress={() => select(JUZ_START_PAGES[juz - 1])}
        >
          <View style={styles.juzLatinRow}>
            <Text style={[styles.juzLatin, { color: p.muted }]}>Juz' {juz}</Text>
            <Text style={[styles.juzPage, { color: p.gold }]}>p. {JUZ_START_PAGES[juz - 1]}</Text>
          </View>
          <Text style={[styles.juzArabic, { color: p.title }]}>{juzNameAr(juz)}</Text>
        </TouchableOpacity>
        {[0, 1].map((h) => {
          const hizb = (juz - 1) * 2 + h + 1;
          return (
            <View key={hizb} style={styles.hizbRow}>
              {[0, 1, 2, 3].map((q) => {
                const eighth = (hizb - 1) * 8 + q * 2 + 1;
                const start = EIGHTH_STARTS[eighth - 1];
                const isCurrent = currentEighth === eighth || currentEighth === eighth + 1;
                const isHizbCell = q === 0;
                return (
                  <TouchableOpacity
                    key={eighth}
                    style={[
                      styles.quarterCell,
                      { borderColor: p.chromeBorder },
                      isHizbCell && { backgroundColor: p.green, borderColor: p.green },
                      isCurrent && { borderColor: p.gold, borderWidth: 1.5 },
                    ]}
                    onPress={() => select(start.page)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.quarterLabel, { color: isHizbCell ? p.onGreen : p.ink }]}>
                      {isHizbCell ? `${QUARTER_LABELS[0]} ${toArabicDigits(hizb)}` : QUARTER_LABELS[q]}
                    </Text>
                    <Text style={[styles.quarterRef, { color: isHizbCell ? p.onGreen : p.muted, opacity: isHizbCell ? 0.75 : 1 }]}>
                      p. {start.page} · {start.surah}:{start.ayah}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: p.screen }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { borderColor: p.chromeBorder, backgroundColor: p.chrome }]}>
            <Ionicons name="close" size={20} color={p.ink} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={[styles.headerArabic, { color: p.title }]}>الفهرس</Text>
            <Text style={[styles.headerLatin, { color: p.muted }]}>MUSHAF WARSH</Text>
          </View>
          <View style={[styles.pageJump, { borderColor: p.chromeBorder, backgroundColor: p.chrome }]}>
            <TextInput
              style={[styles.pageJumpInput, { color: p.ink }]}
              placeholder="Page"
              placeholderTextColor={p.muted}
              keyboardType="number-pad"
              value={pageInput}
              onChangeText={(t) => setPageInput(t.replace(/[^0-9]/g, '').slice(0, 3))}
              onSubmitEditing={submitPage}
              returnKeyType="go"
            />
            <TouchableOpacity onPress={submitPage} hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}>
              <Ionicons name="arrow-forward-circle" size={20} color={p.gold} />
            </TouchableOpacity>
          </View>
        </View>
        <OrnamentDivider palette={p} />

        {bookmark && (
          <TouchableOpacity style={[styles.bookmarkCard, { backgroundColor: p.green }]} onPress={() => select(bookmark.page)} activeOpacity={0.85}>
            <Ionicons name="bookmark" size={18} color={p.onGreen} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.bookmarkTitle, { color: p.onGreen }]}>Aller au signet</Text>
              <Text style={[styles.bookmarkSub, { color: p.onGreen, opacity: 0.75 }]}>
                {surahNameLatin(bookmark.surahNumber)} · verset {bookmark.verseNumber} · page {bookmark.page}
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={p.onGreen} />
          </TouchableOpacity>
        )}

        <View style={[styles.tabs, { backgroundColor: p.chrome, borderColor: p.chromeBorder }]}>
          {(['surahs', 'juz'] as MushafIndexTab[]).map((t) => (
            <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && { backgroundColor: p.green }]} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, { color: tab === t ? p.onGreen : p.muted }]}>
                {t === 'surahs' ? 'Sourates · السور' : "Juz' & Hizb · الأجزاء"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'surahs' ? (
          <>
            <View style={[styles.search, { backgroundColor: p.chrome, borderColor: p.chromeBorder }]}>
              <Ionicons name="search" size={16} color={p.muted} />
              <TextInput
                style={[styles.searchInput, { color: p.ink }]}
                placeholder="Nom ou numéro de sourate"
                placeholderTextColor={p.muted}
                value={query}
                onChangeText={setQuery}
              />
            </View>
            <FlatList
              data={filteredSurahs}
              keyExtractor={(s) => String(s.number)}
              renderItem={renderSurah}
              getItemLayout={(_, index) => ({ length: SURAH_ROW_HEIGHT, offset: SURAH_ROW_HEIGHT * index, index })}
              initialScrollIndex={!query && currentSurah > 3 ? currentSurah - 3 : undefined}
              style={[styles.listCard, { backgroundColor: p.page, borderColor: p.chromeBorder }]}
              keyboardShouldPersistTaps="handled"
            />
          </>
        ) : (
          <FlatList
            ref={juzListRef}
            data={Array.from({ length: 30 }, (_, i) => i + 1)}
            keyExtractor={(j) => String(j)}
            renderItem={renderJuz}
            contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 30 }}
            initialNumToRender={30}
            onLayout={() => {
              if (currentJuz > 1) {
                setTimeout(() => juzListRef.current?.scrollToIndex({ index: currentJuz - 1, animated: false }), 0);
              }
            }}
            onScrollToIndexFailed={() => {}}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

const SURAH_ROW_HEIGHT = 62;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerArabic: {
    fontFamily: 'KFGQPC_Warsh',
    fontSize: 26,
    lineHeight: 40,
  },
  headerLatin: {
    fontSize: 10,
    letterSpacing: 2,
    marginTop: -4,
  },
  pageJump: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 18,
    paddingLeft: 10,
    paddingRight: 6,
    height: 36,
  },
  pageJumpInput: {
    width: 42,
    fontSize: 13,
  },
  bookmarkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  bookmarkTitle: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  bookmarkSub: {
    fontSize: 11,
    marginTop: 1,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 14,
    padding: 3,
    borderRadius: 14,
    borderWidth: 1,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 11,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginTop: 10,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
  },
  listCard: {
    flex: 1,
    margin: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  surahRow: {
    height: SURAH_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  surahInfo: {
    flex: 1,
    marginLeft: 12,
  },
  surahLatin: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  surahMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  surahMeta: {
    fontSize: 11,
  },
  surahArabic: {
    fontFamily: 'KFGQPC_Warsh',
    fontSize: 22,
    lineHeight: 36,
    maxWidth: '38%',
  },
  juzCard: {
    borderWidth: 1,
    borderRadius: 16,
    marginTop: 12,
    padding: 10,
  },
  juzHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 4,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  juzLatinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  juzLatin: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  juzPage: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  juzArabic: {
    fontFamily: 'KFGQPC_Warsh',
    fontSize: 22,
    lineHeight: 36,
  },
  hizbRow: {
    flexDirection: 'row-reverse',
    marginTop: 6,
  },
  quarterCell: {
    flex: 1,
    marginHorizontal: 3,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  quarterLabel: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  quarterRef: {
    fontSize: 9,
    marginTop: 2,
  },
});
