import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { DIGITS_FONT, MushafPalette } from './mushafTheme';
import { BookmarkRibbon, OrnamentDivider, PageFrame, SurahBanner } from './Ornaments';
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

const MIN_SCALE = 0.3;

// Échelle retenue pour chaque page à une taille donnée : revenir sur une page déjà vue
// l'affiche aussitôt, sans la remesurer.
const fittedScales = new Map<string, number>();

/** Numéro de verset : simple pastille (sans SVG, bien plus légère à afficher par dizaines). */
const VerseMarker: React.FC<{ number: number; size: number; palette: MushafPalette }> = ({ number, size, palette }) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: 1,
      borderColor: palette.gold,
      alignItems: 'center',
      justifyContent: 'center',
      transform: [{ translateY: size * 0.18 }],
    }}
  >
    <Text
      allowFontScaling={false}
      style={{ fontFamily: DIGITS_FONT, color: palette.title, fontSize: size * (number > 99 ? 0.38 : 0.48), fontWeight: 'bold' }}
    >
      {toArabicDigits(number)}
    </Text>
  </View>
);

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
  // Échelle du texte, réduite jusqu'à ce que la page tienne entièrement à l'écran : la
  // lecture se fait page par page, en glissant horizontalement, sans jamais défiler vers le bas.
  const [areaHeight, setAreaHeight] = useState(0);
  const fitKey = `${page}:${fontSize}:${width}:${areaHeight}`;
  const [fit, setFit] = useState<{ key: string; scale: number; done: boolean }>({ key: '', scale: 1, done: false });
  const cached = fittedScales.get(fitKey);
  const current = cached !== undefined ? { scale: cached, done: true } : fit.key === fitKey ? fit : { scale: 1, done: false };
  const scale = current.scale;

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
  const markerSize = Math.round(size * 0.95);
  const isOpeningPage = page <= 2;

  const handleContentLayout = (contentHeight: number) => {
    if (!areaHeight || current.done) return;
    if (contentHeight <= areaHeight || scale <= MIN_SCALE) {
      fittedScales.set(fitKey, scale);
      setFit({ key: fitKey, scale, done: true });
      return;
    }
    // La surface du texte varie comme le carré de la taille de police.
    const next = Math.max(MIN_SCALE, scale * Math.sqrt(areaHeight / contentHeight) * 0.97);
    setFit({ key: fitKey, scale: next, done: false });
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

        <View style={styles.area} onLayout={(e) => setAreaHeight(Math.floor(e.nativeEvent.layout.height))}>
          <View
            key={`${fitKey}:${scale}`}
            style={[styles.areaContent, isOpeningPage && styles.areaContentCentered, { opacity: current.done ? 1 : 0 }]}
            onLayout={(e) => handleContentLayout(e.nativeEvent.layout.height)}
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
                    const style =
                      key === selectedKey
                        ? { backgroundColor: p.selected }
                        : key === recitedKey
                          ? // Verset récité : surligné et souligné d'or.
                            { backgroundColor: p.playing, textDecorationLine: 'underline' as const, textDecorationColor: p.gold }
                          : undefined;
                    return (
                      <Text key={key} onPress={() => onVersePress(v)} style={style}>
                        {v.text}{' '}
                        <VerseMarker number={v.ayah} size={markerSize} palette={p} />{' '}
                      </Text>
                    );
                  })}
                </Text>
              )
            )}
          </View>
        </View>

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
    overflow: 'hidden',
    justifyContent: 'center',
  },
  areaContent: {
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
