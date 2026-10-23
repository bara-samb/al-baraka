import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { MushafPalette } from './mushafTheme';
import { AyahRosette, BookmarkRibbon, OrnamentDivider, PageFrame, SurahBanner } from './Ornaments';
import {
  MUSHAF_PAGES,
  MushafVerse,
  juzNameAr,
  surahNameAr,
  surahNameLatin,
  surahVerseCount,
  toArabicDigits,
  WARSH_BASMALA,
} from '../../services/warshMushafService';

interface MushafPageProps {
  page: number;
  width: number;
  height: number;
  palette: MushafPalette;
  fontSize: number;
  /** "sourate:verset" du verset surligné (sélectionné ou en cours de récitation), s'il est sur cette page. */
  selectedKey: string | null;
  recitedKey: string | null;
  bookmarked: boolean;
  revelationTypes: Record<number, 'Meccan' | 'Medinan'>;
  onVersePress: (verse: MushafVerse) => void;
  onBackgroundPress: () => void;
}

// Un groupe = soit un en-tête de sourate (bandeau + basmala), soit un paragraphe continu
// de versets d'une même sourate.
type PageGroup = { kind: 'header'; surah: number } | { kind: 'text'; verses: MushafVerse[] };

const MIN_SCALE = 0.55;

const MushafPageComponent: React.FC<MushafPageProps> = ({
  page,
  width,
  height,
  palette: p,
  fontSize,
  selectedKey,
  recitedKey,
  bookmarked,
  revelationTypes,
  onVersePress,
  onBackgroundPress,
}) => {
  const verses = MUSHAF_PAGES[page - 1];
  // Échelle du texte, réduite jusqu'à ce que la page tienne entièrement à l'écran.
  const [scale, setScale] = useState(1);
  const [areaHeight, setAreaHeight] = useState(0);

  useEffect(() => setScale(1), [fontSize, areaHeight]);

  const groups = useMemo<PageGroup[]>(() => {
    const result: PageGroup[] = [];
    verses.forEach((v) => {
      if (v.ayah === 1) result.push({ kind: 'header', surah: v.surah });
      const last = result[result.length - 1];
      if (last && last.kind === 'text' && last.verses[0].surah === v.surah) last.verses.push(v);
      else result.push({ kind: 'text', verses: [v] });
    });
    return result;
  }, [verses]);

  const first = verses[0];
  const size = fontSize * scale;
  const rosetteSize = Math.round(size * 1.15);
  const isOpeningPage = page <= 2;

  const handleContentSize = (_: number, contentHeight: number) => {
    if (!areaHeight || contentHeight <= areaHeight || scale <= MIN_SCALE) return;
    // La surface du texte varie comme le carré de la taille de police.
    const next = Math.max(MIN_SCALE, scale * Math.sqrt(areaHeight / contentHeight) * 0.97);
    if (scale - next > 0.01) setScale(next);
  };

  return (
    <View style={{ width, height, paddingHorizontal: 8, paddingVertical: 8 }}>
      <Pressable style={[styles.page, { backgroundColor: p.page }]} onPress={onBackgroundPress}>
        <PageFrame palette={p} />
        {bookmarked && <BookmarkRibbon palette={p} style={styles.ribbon} />}

        <View style={styles.pageHeader}>
          <Text style={[styles.pageHeaderText, { color: p.title }]} numberOfLines={1}>
            {juzNameAr(first.juz)}
          </Text>
          <Text style={[styles.pageHeaderText, { color: p.title }]} numberOfLines={1}>
            سورة {surahNameAr(first.surah)}
          </Text>
        </View>

        <ScrollView
          style={styles.area}
          contentContainerStyle={[styles.areaContent, isOpeningPage && styles.areaContentCentered]}
          onLayout={(e) => setAreaHeight(e.nativeEvent.layout.height)}
          onContentSizeChange={handleContentSize}
          showsVerticalScrollIndicator={false}
        >
          {groups.map((g) =>
            g.kind === 'header' ? (
              <View key={`h${g.surah}`} style={{ marginTop: 4 }}>
                <SurahBanner
                  name={`سورة ${surahNameAr(g.surah)}`}
                  subtitle={surahNameLatin(g.surah).toUpperCase()}
                  ayahCount={surahVerseCount(g.surah)}
                  revelationType={revelationTypes[g.surah] ?? 'Meccan'}
                  palette={p}
                />
                {g.surah !== 9 && (
                  <Text style={[styles.basmala, { color: p.title, fontSize: size, lineHeight: size * 1.9 }]}>
                    {WARSH_BASMALA}
                  </Text>
                )}
              </View>
            ) : (
              <Text
                key={`t${g.verses[0].surah}:${g.verses[0].ayah}`}
                style={[styles.arabic, { color: p.ink, fontSize: size, lineHeight: size * 2.05 }, isOpeningPage && styles.arabicCentered]}
              >
                {g.verses.map((v) => {
                  const key = `${v.surah}:${v.ayah}`;
                  const highlight = key === selectedKey ? p.selected : key === recitedKey ? p.playing : undefined;
                  return (
                    <Text key={key} onPress={() => onVersePress(v)} style={highlight ? { backgroundColor: highlight } : undefined}>
                      {v.text}{' '}
                      <AyahRosette number={v.ayah} size={rosetteSize} palette={p} />{' '}
                    </Text>
                  );
                })}
              </Text>
            )
          )}
        </ScrollView>

        <View style={styles.pageFooter}>
          <OrnamentDivider palette={p} width={44} />
          <Text style={[styles.pageNumber, { color: p.gold }]}>{toArabicDigits(page)}</Text>
          <OrnamentDivider palette={p} width={44} />
        </View>
      </Pressable>
    </View>
  );
};

export const MushafPage = React.memo(MushafPageComponent);

const styles = StyleSheet.create({
  page: {
    flex: 1,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  ribbon: {
    position: 'absolute',
    top: -4,
    left: 26,
    zIndex: 2,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  pageHeaderText: {
    fontFamily: 'KFGQPC_Warsh',
    fontSize: 14,
    lineHeight: 24,
  },
  area: {
    flex: 1,
  },
  areaContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  areaContentCentered: {
    paddingHorizontal: 12,
  },
  basmala: {
    fontFamily: 'KFGQPC_Warsh',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  arabic: {
    fontFamily: 'KFGQPC_Warsh',
    textAlign: 'justify',
    writingDirection: 'rtl',
  },
  arabicCentered: {
    textAlign: 'center',
  },
  pageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pageNumber: {
    fontSize: 13,
    fontWeight: 'bold',
  },
});
