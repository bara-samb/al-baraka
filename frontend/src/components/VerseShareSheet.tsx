import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { surahNameLatin } from '../services/warshMushafService';
import {
  VerseCard,
  VerseRecording,
  buildVerseCard,
  canDrawCard,
  canRecordVideo,
  recordVerseVideo,
  shareFile,
  shareVerseText,
  videoExtension,
} from '../services/verseCard';

interface VerseShareSheetProps {
  /** Verset à partager ; null ferme la fenêtre. */
  verse: { surah: number; ayah: number } | null;
  onClose: () => void;
}

type Phase = 'idle' | 'recording' | 'ready' | 'error';

/**
 * Fenêtre de partage d'un verset : aperçu de l'image (verset et traduction française), partage
 * de l'image seule, ou d'une vidéo de l'image sur la récitation du verset.
 */
export const VerseShareSheet: React.FC<VerseShareSheetProps> = ({ verse, onClose }) => {
  const { colors } = useTheme();
  const [card, setCard] = useState<VerseCard | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [video, setVideo] = useState<Blob | null>(null);
  const recording = useRef<VerseRecording | null>(null);
  const web = canDrawCard();

  // Prépare l'image dès l'ouverture : le partage pourra ainsi suivre immédiatement le toucher.
  useEffect(() => {
    setCard(null);
    setPreview(null);
    setPhase('idle');
    setProgress(0);
    setVideo(null);
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
      recording.current?.cancel();
      recording.current = null;
    };
  }, [verse?.surah, verse?.ayah, web]);

  if (!verse) return null;

  const close = () => {
    recording.current?.cancel();
    recording.current = null;
    onClose();
  };

  const shareImage = async () => {
    if (!card) return;
    await shareFile(card.blob, `al-baraka-${card.surah}-${card.ayah}.png`, card.surah, card.ayah);
  };

  const startVideo = () => {
    if (!card) return;
    setPhase('recording');
    setProgress(0);
    const rec = recordVerseVideo(card, setProgress);
    recording.current = rec;
    rec.done
      .then((blob) => {
        if (recording.current !== rec) return;
        recording.current = null;
        setVideo(blob);
        setPhase('ready');
      })
      .catch((err) => {
        if (recording.current !== rec) return;
        recording.current = null;
        console.warn('Vidéo du verset impossible :', err);
        setPhase('error');
      });
  };

  const shareVideo = async () => {
    if (!video || !card) return;
    await shareFile(video, `al-baraka-${card.surah}-${card.ayah}.${videoExtension(video)}`, card.surah, card.ayah);
  };

  const button = (icon: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void, primary = false, disabled = false) => (
    <TouchableOpacity
      style={[
        styles.btn,
        primary ? { backgroundColor: colors.gold } : { borderColor: colors.gold, borderWidth: 1.5 },
        disabled && { opacity: 0.5 },
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      <Ionicons name={icon} size={18} color={primary ? colors.onGold : colors.gold} />
      <Text style={[styles.btnText, { color: primary ? colors.onGold : colors.gold }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={close}>
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

          {!web && button('share-social-outline', 'Partager le verset', () => shareVerseText(verse.surah, verse.ayah).then(close), true)}

          {web && phase !== 'recording' && phase !== 'ready' && (
            <>
              {button('image-outline', "Partager l'image", shareImage, true, !card)}
              {canRecordVideo() &&
                button('videocam-outline', 'Vidéo avec la récitation', startVideo, false, !card)}
              {phase === 'error' && (
                <Text style={[styles.note, { color: colors.textSecondary }]}>
                  La vidéo n'a pas pu être créée (connexion ou navigateur). L'image reste disponible.
                </Text>
              )}
            </>
          )}

          {phase === 'recording' && (
            <View style={styles.progressBlock}>
              <Text style={[styles.note, { color: colors.textSecondary }]}>
                Création de la vidéo pendant la récitation… {Math.round(progress * 100)} %
              </Text>
              <View style={[styles.track, { backgroundColor: colors.border }]}>
                <View style={[styles.fill, { backgroundColor: colors.gold, width: `${Math.round(progress * 100)}%` }]} />
              </View>
              {button('close-outline', 'Annuler', () => {
                recording.current?.cancel();
                recording.current = null;
                setPhase('idle');
              })}
            </View>
          )}

          {phase === 'ready' && (
            <>
              {button('share-social-outline', 'Partager la vidéo', shareVideo, true)}
              {button('image-outline', "Partager l'image", shareImage)}
            </>
          )}

          <TouchableOpacity style={styles.close} onPress={close}>
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
  progressBlock: {
    gap: 10,
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  note: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
  },
  close: {
    alignItems: 'center',
    paddingVertical: 6,
  },
});
