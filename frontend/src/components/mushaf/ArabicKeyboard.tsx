import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MushafPalette } from './mushafTheme';

// Disposition du clavier arabe standard, chaque rangée lue de droite à gauche.
const ROWS = [
  ['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح', 'ج', 'د'],
  ['ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن', 'م', 'ك', 'ط'],
  ['ئ', 'ء', 'ؤ', 'ر', 'ى', 'ة', 'و', 'ز', 'ظ', 'ذ'],
  ['أ', 'إ', 'آ'],
];
const MAX_KEYS = ROWS[0].length;
const GAP = 4;

interface ArabicKeyboardProps {
  palette: MushafPalette;
  onKey: (letter: string) => void;
  onBackspace: () => void;
  onClear: () => void;
}

/** Petit clavier arabe à l'écran, pour chercher un mot sans clavier arabe installé (PC). */
export const ArabicKeyboard: React.FC<ArabicKeyboardProps> = ({ palette: p, onKey, onBackspace, onClear }) => {
  const { width } = useWindowDimensions();
  const available = Math.min(width, 560) - 16;
  const keyWidth = Math.floor((available - GAP * (MAX_KEYS - 1)) / MAX_KEYS);
  const keyStyle = [styles.key, { width: keyWidth, backgroundColor: p.page, borderColor: p.chromeBorder }];

  return (
    <View style={[styles.keyboard, { backgroundColor: p.chrome, borderTopColor: p.chromeBorder }]}>
      {ROWS.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((letter) => (
            <TouchableOpacity key={letter} style={keyStyle} onPress={() => onKey(letter)} activeOpacity={0.6}>
              <Text style={[styles.keyText, { color: p.ink }]}>{letter}</Text>
            </TouchableOpacity>
          ))}
          {r === ROWS.length - 1 && (
            <>
              <TouchableOpacity style={[keyStyle, styles.wideKey]} onPress={() => onKey(' ')} activeOpacity={0.6}>
                <Text style={[styles.spaceText, { color: p.muted }]}>espace</Text>
              </TouchableOpacity>
              <TouchableOpacity style={keyStyle} onPress={onBackspace} onLongPress={onClear} activeOpacity={0.6}>
                {/* Effacement vers la droite : début du mot en arabe. */}
                <Ionicons name="backspace-outline" size={18} color={p.gold} style={{ transform: [{ scaleX: -1 }] }} />
              </TouchableOpacity>
            </>
          )}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  keyboard: {
    borderTopWidth: 1,
    paddingTop: 8,
    paddingBottom: 12,
    gap: GAP + 2,
    alignItems: 'center',
  },
  row: {
    // Première touche de chaque rangée à droite, comme sur un clavier arabe.
    flexDirection: 'row-reverse',
    gap: GAP,
  },
  key: {
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wideKey: {
    width: 120,
  },
  keyText: {
    fontSize: 19,
    fontWeight: '600',
  },
  spaceText: {
    fontSize: 12,
  },
});
