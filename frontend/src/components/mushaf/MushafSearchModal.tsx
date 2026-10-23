import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput, SafeAreaView, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DIGITS_FONT, MushafPalette } from './mushafTheme';
import { OrnamentDivider } from './Ornaments';
import { ArabicKeyboard } from './ArabicKeyboard';
import { MushafVerse, surahNameAr, surahNameLatin, toArabicDigits } from '../../services/warshMushafService';
import { SearchResult, VerseMatch, searchMushaf } from '../../services/mushafSearch';

interface MushafSearchModalProps {
  visible: boolean;
  palette: MushafPalette;
  onClose: () => void;
  onSelectVerse: (verse: MushafVerse) => void;
}

const SEARCH_DELAY_MS = 300;

// Clavier arabe à l'écran ouvert d'office sur ordinateur (souris) ; sur téléphone, le
// clavier du système suffit et le nôtre s'ouvre à la demande.
const hasMouse = () =>
  Platform.OS === 'web' && typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: fine)').matches;

/** Recherche d'un mot arabe dans tout le Coran : versets trouvés (mot surligné) et nombre d'occurrences. */
export const MushafSearchModal: React.FC<MushafSearchModalProps> = ({ visible, palette: p, onClose, onSelectVerse }) => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(hasMouse);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResult(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      setResult(searchMushaf(q));
      setSearching(false);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const select = (verse: MushafVerse) => {
    onSelectVerse(verse);
    onClose();
  };

  const summary = useMemo(() => {
    if (!query.trim()) return null;
    if (searching || !result) return null;
    if (result.query.length < 2) return 'Tapez au moins deux lettres.';
    if (result.occurrences === 0) return 'Aucun verset ne contient ce mot.';
    const verses = result.matches.length === 1 ? 'verset' : 'versets';
    return `${result.occurrences} fois dans le Coran · ${result.matches.length} ${verses}`;
  }, [query, result, searching]);

  const renderMatch = ({ item }: { item: VerseMatch }) => {
    const { verse, ranges } = item;
    const parts: Array<{ text: string; hit: boolean }> = [];
    let cursor = 0;
    ranges.forEach(([start, end]) => {
      if (start > cursor) parts.push({ text: verse.text.slice(cursor, start), hit: false });
      parts.push({ text: verse.text.slice(start, end), hit: true });
      cursor = end;
    });
    if (cursor < verse.text.length) parts.push({ text: verse.text.slice(cursor), hit: false });

    return (
      <TouchableOpacity
        style={[styles.matchCard, { backgroundColor: p.page, borderColor: p.chromeBorder }]}
        onPress={() => select(verse)}
        activeOpacity={0.75}
      >
        <View style={styles.matchHeader}>
          <Text style={[styles.matchRef, { color: p.muted }]}>
            {surahNameLatin(verse.surah)} · verset {verse.ayah} · page {verse.page}
          </Text>
          <Text style={[styles.matchSurah, { color: p.title }]} numberOfLines={1}>
            سورة {surahNameAr(verse.surah)} · <Text style={{ fontFamily: DIGITS_FONT }}>{toArabicDigits(verse.ayah)}</Text>
          </Text>
        </View>
        <Text style={[styles.matchVerse, { color: p.ink }]}>
          {parts.map((part, i) =>
            part.hit ? (
              <Text key={i} style={{ backgroundColor: p.selected, color: p.title }}>
                {part.text}
              </Text>
            ) : (
              part.text
            )
          )}
        </Text>
      </TouchableOpacity>
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
            <Text style={[styles.headerArabic, { color: p.title }]}>البحث</Text>
            <Text style={[styles.headerLatin, { color: p.muted }]}>RECHERCHE DANS LE CORAN</Text>
          </View>
          <View style={styles.closeBtnSpacer} />
        </View>
        <OrnamentDivider palette={p} />

        <View style={[styles.searchBox, { backgroundColor: p.chrome, borderColor: p.goldSoft }]}>
          <TouchableOpacity
            onPress={() => setKeyboardOpen((open) => !open)}
            hitSlop={8}
            accessibilityLabel={keyboardOpen ? 'Masquer le clavier arabe' : 'Afficher le clavier arabe'}
          >
            <Ionicons name={keyboardOpen ? 'keypad' : 'keypad-outline'} size={19} color={keyboardOpen ? p.gold : p.muted} />
          </TouchableOpacity>
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={p.muted} />
            </TouchableOpacity>
          ) : null}
          <TextInput
            style={[styles.searchInput, { color: p.ink }]}
            placeholder="اكتب كلمة… مثال : الرحمن"
            placeholderTextColor={p.muted}
            value={query}
            onChangeText={setQuery}
            autoFocus={!keyboardOpen}
            // Clavier à l'écran ouvert : le clavier du téléphone ne s'affiche pas par-dessus.
            showSoftInputOnFocus={!keyboardOpen}
            inputMode={keyboardOpen ? 'none' : 'text'}
            autoCorrect={false}
            returnKeyType="search"
          />
          <Ionicons name="search" size={18} color={p.gold} />
        </View>

        <View style={styles.summaryRow}>
          {searching ? (
            <ActivityIndicator size="small" color={p.gold} />
          ) : summary ? (
            <Text style={[styles.summary, { color: result?.occurrences ? p.title : p.muted }]}>{summary}</Text>
          ) : (
            <Text style={[styles.hint, { color: p.muted }]}>
              Écrivez un mot en arabe, avec ou sans voyelles : chaque verset qui le contient s'affiche, le mot en évidence.
            </Text>
          )}
        </View>

        <FlatList
          data={searching ? [] : result?.matches ?? []}
          keyExtractor={(m) => `${m.verse.surah}:${m.verse.ayah}`}
          renderItem={renderMatch}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={8}
          windowSize={7}
        />

        {keyboardOpen && (
          <ArabicKeyboard
            palette={p}
            onKey={(letter) => setQuery((q) => q + letter)}
            onBackspace={() => setQuery((q) => q.slice(0, -1))}
            onClear={() => setQuery('')}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

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
  closeBtnSpacer: {
    width: 36,
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginTop: 4,
    paddingHorizontal: 12,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'KFGQPC_Warsh',
    fontSize: 20,
    textAlign: 'right',
    writingDirection: 'rtl',
    paddingVertical: 0,
  },
  summaryRow: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  summary: {
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  list: {
    paddingHorizontal: 14,
    paddingBottom: 30,
    gap: 10,
  },
  matchCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  matchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  matchRef: {
    fontSize: 11,
    flexShrink: 1,
  },
  matchSurah: {
    fontFamily: 'KFGQPC_Warsh',
    fontSize: 15,
    lineHeight: 26,
  },
  matchVerse: {
    fontFamily: 'KFGQPC_Warsh',
    fontSize: 20,
    lineHeight: 40,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: 4,
  },
});
