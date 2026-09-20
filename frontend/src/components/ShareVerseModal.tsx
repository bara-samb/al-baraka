import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Ayah } from '../types/quran';
import { useTheme } from '../context/ThemeContext';
import { playAudioTrack } from '../services/audioService';
import { getEffectiveAudioUrl } from '../services/downloadService';

interface ShareVerseModalProps {
  visible: boolean;
  ayah: Ayah | null;
  surahName: string;
  surahNumber: number;
  onClose: () => void;
}

export const ShareVerseModal: React.FC<ShareVerseModalProps> = ({
  visible,
  ayah,
  surahName,
  surahNumber,
  onClose,
}) => {
  const { colors } = useTheme();

  if (!ayah) return null;

  const handlePlayRecitation = async () => {
    try {
      const audioUrl = await getEffectiveAudioUrl(surahNumber);
      await playAudioTrack(audioUrl);
      onClose();
    } catch (e) {
      console.error('Erreur ecoute verset:', e);
    }
  };

  const performShare = async (content: string, title: string) => {
    try {
      await Share.share({
        message: content,
        title: title,
      });
      onClose();
    } catch (error) {
      console.error('Erreur partage verset:', error);
    }
  };

  const shareArabicOnly = () => {
    const text = `${ayah.text}\n\n[AL BARAKA - ${surahName}, Verset ${ayah.numberInSurah} • Serigne Aboul Baraka Mbacké]`;
    performShare(text, `Verset Arabe ${ayah.numberInSurah}`);
  };

  const shareFrenchOnly = () => {
    const text = `"${ayah.translation || 'Traduction non disponible'}"\n\n[AL BARAKA - Sourate ${surahName}, Verset ${ayah.numberInSurah} • Serigne Aboul Baraka Mbacké]`;
    performShare(text, `Verset Français ${ayah.numberInSurah}`);
  };

  const shareEnglishOnly = () => {
    const text = `"${ayah.translation || 'Translation unavailable'}"\n\n[AL BARAKA - Surah ${surahName}, Verse ${ayah.numberInSurah} • Serigne Aboul Baraka Mbacké]`;
    performShare(text, `Verse English ${ayah.numberInSurah}`);
  };

  const shareBilingual = () => {
    let text = `${ayah.text}\n\n"${ayah.translation || ''}"\n\n[AL BARAKA - ${surahName}, Verset ${ayah.numberInSurah} • Récitation Serigne Aboul Baraka Mbacké]`;
    performShare(text, `Verset Bilingue ${ayah.numberInSurah}`);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View
          style={[styles.modalCard, { backgroundColor: colors.modalBg, borderColor: colors.border }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.header}>
            <Ionicons name="book-outline" size={22} color={colors.gold} style={{ marginRight: 8 }} />
            <Text style={[styles.headerTitle, { color: colors.gold }]}>
              Verset {ayah.numberInSurah} ({surahName})
            </Text>
          </View>

          <Text style={[styles.previewArabic, { color: colors.textPrimary }]} numberOfLines={3}>
            {ayah.text}
          </Text>

          {/* Bouton d'écoute audio Serigne Aboul Baraka Mbacké */}
          <TouchableOpacity
            style={[styles.playAudioBtn, { backgroundColor: '#1B6B4A', borderColor: colors.gold }]}
            onPress={handlePlayRecitation}
            activeOpacity={0.85}
          >
            <Ionicons name="play-circle" size={22} color="#D4AF37" style={{ marginRight: 8 }} />
            <Text style={styles.playAudioText}>
              Écouter la récitation de Serigne Aboul Baraka
            </Text>
          </TouchableOpacity>

          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Options de partage du verset :
          </Text>

          {/* Option 1: Bilingue */}
          <TouchableOpacity
            style={[styles.shareBtn, { backgroundColor: colors.gold }]}
            onPress={shareBilingual}
          >
            <Ionicons name="documents-outline" size={18} color="#0F172A" style={{ marginRight: 8 }} />
            <Text style={styles.shareBtnTextDark}>Partage Bilingue (Arabe + Traduction)</Text>
          </TouchableOpacity>

          {/* Option 2: Arabe uniquement */}
          <TouchableOpacity
            style={[styles.shareBtn, { backgroundColor: colors.emerald }]}
            onPress={shareArabicOnly}
          >
            <Ionicons name="language-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.shareBtnTextLight}>Arabe uniquement (عربي)</Text>
          </TouchableOpacity>

          {/* Option 3: Français uniquement */}
          <TouchableOpacity
            style={[styles.shareBtn, { backgroundColor: colors.bgSecondary, borderColor: colors.border, borderWidth: 1 }]}
            onPress={shareFrenchOnly}
          >
            <Ionicons name="text-outline" size={18} color={colors.textPrimary} style={{ marginRight: 8 }} />
            <Text style={[styles.shareBtnText, { color: colors.textPrimary }]}>Français uniquement</Text>
          </TouchableOpacity>

          {/* Option 4: Anglais uniquement */}
          <TouchableOpacity
            style={[styles.shareBtn, { backgroundColor: colors.bgSecondary, borderColor: colors.border, borderWidth: 1 }]}
            onPress={shareEnglishOnly}
          >
            <Ionicons name="globe-outline" size={18} color={colors.textPrimary} style={{ marginRight: 8 }} />
            <Text style={[styles.shareBtnText, { color: colors.textPrimary }]}>English only</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '90%',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  previewArabic: {
    fontSize: 26,
    textAlign: 'right',
    lineHeight: 50,
    marginVertical: 4,
    fontFamily: 'KFGQPC_Warsh',
  },
  playAudioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  playAudioText: {
    color: '#F7F1E5',
    fontWeight: 'bold',
    fontSize: 13,
  },
  subtitle: {
    fontSize: 12,
    marginBottom: 10,
    fontWeight: '500',
  },
  shareBtn: {
    height: 42,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  shareBtnTextDark: {
    color: '#0F172A',
    fontWeight: 'bold',
    fontSize: 13,
  },
  shareBtnTextLight: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  shareBtnText: {
    fontWeight: 'bold',
    fontSize: 13,
  },
  closeBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
});
