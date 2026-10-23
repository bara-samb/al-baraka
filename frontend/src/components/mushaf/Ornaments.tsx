import React, { useState } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Path, Circle, Rect, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import { MushafPalette } from './mushafTheme';
import { toArabicDigits } from '../../services/warshMushafService';

/** Étoile à huit branches (rosette) contenant le numéro du verset, insérée dans le texte. */
export const AyahRosette: React.FC<{ number: number; size: number; palette: MushafPalette }> = ({ number, size, palette }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <Svg width={size} height={size} viewBox="0 0 40 40" style={StyleSheet.absoluteFill}>
      <Rect x={8} y={8} width={24} height={24} fill={palette.page} stroke={palette.gold} strokeWidth={1.6} />
      <Path d="M20 3.03 L36.97 20 L20 36.97 L3.03 20 Z" fill={palette.page} stroke={palette.gold} strokeWidth={1.6} />
      <Circle cx={20} cy={20} r={10.5} fill="none" stroke={palette.gold} strokeWidth={0.8} />
    </Svg>
    <Text
      allowFontScaling={false}
      style={{ color: palette.title, fontSize: size * (number > 99 ? 0.3 : 0.38), fontWeight: 'bold', lineHeight: size * 0.5 }}
    >
      {toArabicDigits(number)}
    </Text>
  </View>
);

/** Ornement d'angle du cadre de page (orienté via `corner`). */
export const CornerOrnament: React.FC<{ corner: 'tl' | 'tr' | 'bl' | 'br'; palette: MushafPalette; size?: number }> = ({
  corner,
  palette,
  size = 30,
}) => {
  const position: ViewStyle = {
    position: 'absolute',
    [corner[0] === 't' ? 'top' : 'bottom']: -1,
    [corner[1] === 'l' ? 'left' : 'right']: -1,
    transform: [{ scaleX: corner[1] === 'r' ? -1 : 1 }, { scaleY: corner[0] === 'b' ? -1 : 1 }],
  };
  return (
    <View pointerEvents="none" style={position}>
      <Svg width={size} height={size} viewBox="0 0 30 30">
        <Path d="M0 0 H16 Q7 7 0 16 Z" fill={palette.gold} />
        <Path d="M2 26 Q2 2 26 2" fill="none" stroke={palette.gold} strokeWidth={1} />
        <Path d="M11 7 L13 11 L11 15 L9 11 Z" fill={palette.gold} opacity={0.85} transform="rotate(-45 11 11)" />
        <Circle cx={4.5} cy={4.5} r={1.6} fill={palette.page} />
      </Svg>
    </View>
  );
};

/** Cadre de page : double filet doré + ornements d'angle. À placer dans un parent `relative`. */
export const PageFrame: React.FC<{ palette: MushafPalette }> = ({ palette }) => (
  <>
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.frameOuter, { borderColor: palette.gold }]} />
    <View pointerEvents="none" style={[styles.frameInner, { borderColor: palette.goldSoft }]} />
    <CornerOrnament corner="tl" palette={palette} />
    <CornerOrnament corner="tr" palette={palette} />
    <CornerOrnament corner="bl" palette={palette} />
    <CornerOrnament corner="br" palette={palette} />
  </>
);

/** Cartouche de titre de sourate : bannière à extrémités en accolade, médaillons latéraux. */
export const SurahBanner: React.FC<{
  name: string;
  subtitle: string;
  ayahCount: number;
  revelationType: 'Meccan' | 'Medinan';
  palette: MushafPalette;
}> = ({ name, subtitle, ayahCount, revelationType, palette }) => {
  const [w, setW] = useState(0);
  const h = 70;
  const m = h / 2;
  const outline = (inset: number) => {
    const l = 4 + inset;
    const r = w - 4 - inset;
    const t = 4 + inset;
    const b = h - 4 - inset;
    return `M${l + 20} ${t} H${r - 20} C${r - 10} ${t} ${r - 9} ${m - 9} ${r} ${m} C${r - 9} ${m + 9} ${r - 10} ${b} ${r - 20} ${b} H${l + 20} C${l + 10} ${b} ${l + 9} ${m + 9} ${l} ${m} C${l + 9} ${m - 9} ${l + 10} ${t} ${l + 20} ${t} Z`;
  };
  return (
    <View style={{ height: h, marginBottom: 6 }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="bannerFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={palette.green} />
              <Stop offset="1" stopColor={palette.greenDeep} />
            </LinearGradient>
          </Defs>
          <Path d={outline(0)} fill="url(#bannerFill)" stroke={palette.gold} strokeWidth={2} />
          <Path d={outline(5)} fill="none" stroke={palette.goldSoft} strokeWidth={0.8} />
          <G>
            <Circle cx={46} cy={m} r={20} fill={palette.greenDeep} stroke={palette.gold} strokeWidth={1.2} />
            <Circle cx={w - 46} cy={m} r={20} fill={palette.greenDeep} stroke={palette.gold} strokeWidth={1.2} />
          </G>
        </Svg>
      )}
      <View style={styles.bannerContent}>
        <View style={styles.medallion}>
          <Text style={[styles.medallionValue, { color: palette.onGreen }]}>{toArabicDigits(ayahCount)}</Text>
          <Text style={[styles.medallionLabel, { color: palette.goldSoft }]}>آية</Text>
        </View>
        <View style={styles.bannerCenter}>
          <Text style={[styles.bannerTitle, { color: palette.onGreen }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.bannerSubtitle, { color: palette.goldSoft }]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <View style={styles.medallion}>
          <Text style={[styles.medallionType, { color: palette.onGreen }]}>{revelationType === 'Meccan' ? 'مكية' : 'مدنية'}</Text>
        </View>
      </View>
    </View>
  );
};

/** Filet décoratif (trait – losange – trait). */
export const OrnamentDivider: React.FC<{ palette: MushafPalette; width?: number }> = ({ palette, width = 150 }) => (
  <View style={{ alignItems: 'center', marginVertical: 6 }}>
    <Svg width={width} height={12} viewBox={`0 0 ${width} 12`}>
      <Path d={`M4 6 H${width / 2 - 12}`} stroke={palette.gold} strokeWidth={0.8} />
      <Path d={`M${width / 2 + 12} 6 H${width - 4}`} stroke={palette.gold} strokeWidth={0.8} />
      <Path d={`M${width / 2} 1 L${width / 2 + 7} 6 L${width / 2} 11 L${width / 2 - 7} 6 Z`} fill={palette.gold} />
      <Circle cx={width / 2 - 15} cy={6} r={1.5} fill={palette.gold} />
      <Circle cx={width / 2 + 15} cy={6} r={1.5} fill={palette.gold} />
    </Svg>
  </View>
);

/** Ruban de signet (marque-page) suspendu au bord de la page. */
export const BookmarkRibbon: React.FC<{ palette: MushafPalette; style?: ViewStyle }> = ({ palette, style }) => (
  <View pointerEvents="none" style={style}>
    <Svg width={18} height={38} viewBox="0 0 18 38">
      <Path d="M0 0 H18 V38 L9 29 L0 38 Z" fill={palette.ribbon} />
      <Path d="M3 0 V31" stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
    </Svg>
  </View>
);

const styles = StyleSheet.create({
  frameOuter: {
    borderWidth: 1.5,
    borderRadius: 4,
  },
  frameInner: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: 5,
    bottom: 5,
    borderWidth: 0.75,
    borderRadius: 2,
  },
  bannerContent: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 26,
  },
  medallion: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medallionValue: {
    fontSize: 13,
    fontWeight: 'bold',
    lineHeight: 15,
  },
  medallionLabel: {
    fontSize: 9,
    lineHeight: 11,
  },
  medallionType: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  bannerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  bannerTitle: {
    fontFamily: 'KFGQPC_Warsh',
    fontSize: 24,
    lineHeight: 34,
    writingDirection: 'rtl',
  },
  bannerSubtitle: {
    fontSize: 10,
    letterSpacing: 1,
    marginTop: -2,
  },
});
