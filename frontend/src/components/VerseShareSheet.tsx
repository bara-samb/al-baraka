import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { surahNameLatin } from '../services/warshMushafService';
import { VerseCard, buildVerseCard, canDrawCard, shareFile, shareVerseText } from '../services/verseCard';

interface VerseShareSheetProps {
  /** Verset à partager ; null ferme la fenêtre. */
  verse: { surah: number; ayah: number } | null;
  onClose: () => void;
}

/**
 * Fenêtre de partage d'un verset : aperçu de l'image (icône de l'app, verset et traduction
 * française) et partage de cette image. Hors web, partage du texte mis en forme.
 */
export const VerseShareSheet: React.FC<VerseShareSheetProps> = ({ verse, onClose }) => {
  const { colors } = useTheme();
  const [card, setCard] = useState<VerseCard | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const web = canDrawCard();

  // Prépare l'image dès l'ouverture : le partage pourra ainsi suivre immédiatement le toucher
  // (les navigateurs refusent un partage trop éloigné du geste de l'utilisateur).
  useEffect(() => {
    setCard(null);
    setPreview(null);
    if (!verse || !web) return;
    let alive = true;
    let url: string | null = null;
    buildVerseCard(verse.surah, verse.ayah).then((c) => {
      if (!alive || !c) return;
      url = URL.createObjectURL(c.blob);
      setCard(c);
      setPreview(url);
    });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [verse?.surah, verse?.ayah, web]);

  if (!verse) return null;

  const share = async () => {
    if (!web) {
      await shareVerseText(verse.surah, verse.ayah);
      onClose();
      return;
    }
    if (!card) return;
    await shareFile(card.blob, `al-baraka-${card.surah}-${card.ayah}.png`, card.surah, card.ayah);
  };

  const disabled = web && !card;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.modalBg, borderColor: colors.gold }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Partager · {surahNameLatin(verse.surah)}, verset {verse.ayah}
          </Text>

          {web && (
            <View style={[styles.previewBox, { borderColor: colors.border }]}>
              {preview ? (
                <Image source={{ uri: preview }} style={styles.preview} resizeMode="contain" accessibilityLabel="Aperçu de l'image du verset" />
              ) : (
                <ActivityIndicator color={colors.gold} />
              )}
            </View>
          )}

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.gold }, disabled && { opacity: 0.5 }]}
            onPress={share}
            disabled={disabled}
            activeOpacity={0.85}
          >
            <Ionicons name={web ? 'image-outline' : 'share-social-outline'} size={18} color={colors.onGold} />
            <Text style={[styles.btnText, { color: colors.onGold }]}>{web ? "Partager l'image" : 'Partager le verset'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.close} onPress={onClose}>
            <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Fermer</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  previewBox: {
    alignSelf: 'center',
    width: '72%',
    aspectRatio: 1080 / 1350,
    maxHeight: 340,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: {
    width: '100%',
    height: '100%',
  },
  btn: {
    height: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  close: {
    alignItems: 'center',
    paddingVertical: 6,
  },
});
