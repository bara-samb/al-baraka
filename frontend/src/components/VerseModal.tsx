import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { showAlert } from '../services/dialog';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Ayah } from '../types/quran';
import { isAyahFavorite, toggleFavoriteAyah } from '../services/favoritesService';
import { useTheme } from '../context/ThemeContext';
import { ShareVerseModal } from './ShareVerseModal';

interface VerseModalProps {
  visible: boolean;
  ayah: Ayah | null;
  surahName?: string;
  surahNumber?: number;
  onClose: () => void;
  onPlayVerse: (ayah: Ayah) => void;
}

export const VerseModal: React.FC<VerseModalProps> = ({
  visible,
  ayah,
  surahName = '',
  surahNumber = 1,
  onClose,
  onPlayVerse,
}) => {
  const { colors } = useTheme();
  const [isFav, setIsFav] = useState<boolean>(false);
  const [shareModalVisible, setShareModalVisible] = useState<boolean>(false);

  useEffect(() => {
    if (ayah) {
      checkAyahFav();
    }
  }, [ayah?.number]);

  if (!ayah) return null;

  const checkAyahFav = async () => {
    const res = await isAyahFavorite(ayah.number);
    setIsFav(res);
  };

  const handleToggleAyahFav = async () => {
    const status = await toggleFavoriteAyah({
      ayah,
      surahNumber,
      surahName,
      englishName: surahName,
    });
    setIsFav(status);
    showAlert(
      status ? 'Favori ajouté' : 'Favori retiré',
      status
        ? `Le verset ${ayah.numberInSurah} a été ajouté à vos favoris.`
        : `Le verset ${ayah.numberInSurah} a été retiré de vos favoris.`
    );
  };

  const handleOpenShareModal = () => {
    setShareModalVisible(true);
  };

  const handleCopyVerse = async () => {
    let textToCopy = `${ayah.text}`;
    if (ayah.translation) {
      textToCopy += `\n\n"${ayah.translation}"`;
    }
    textToCopy += `\n\n[${surahName} - Verset ${ayah.numberInSurah}]`;
    await Clipboard.setStringAsync(textToCopy);
    onClose();
    showAlert('Succès', 'Le verset a été copié dans le presse-papier !');
  };

  const handlePlaySingleVerse = () => {
    onPlayVerse(ayah);
    onClose();
  };

  return (
    <>
      <Modal
        animationType="fade"
        transparent={true}
        visible={visible && !shareModalVisible}
        onRequestClose={onClose}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={onClose}
        >
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.modalBg, borderColor: colors.border },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.headerTitle, { color: colors.gold }]}>
              {surahName} - Verset {ayah.numberInSurah}
            </Text>

            <Text style={[styles.verseTextPreview, { color: colors.textPrimary }]} numberOfLines={4}>
              {ayah.text}
            </Text>

            {ayah.translation ? (
              <Text style={[styles.translationPreview, { color: colors.textSecondary }]} numberOfLines={3}>
                "{ayah.translation}"
              </Text>
            ) : null}

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Option 1 : Écouter (Serigne Aboul Baraka Mbacké) */}
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.gold }]}
              onPress={handlePlaySingleVerse}
              activeOpacity={0.8}
            >
              <Ionicons name="volume-medium-outline" size={20} color={colors.onGold} style={{ marginRight: 8 }} />
              <Text style={[styles.actionButtonTextDark, { color: colors.onGold }]}>
                Écouter la récitation (Serigne Aboul Baraka)
              </Text>
            </TouchableOpacity>

            {/* Option 2 : Partager le verset (Multilingue) */}
            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: colors.emerald },
              ]}
              onPress={handleOpenShareModal}
              activeOpacity={0.8}
            >
              <Ionicons name="share-social-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>
                Partager le verset (Multilingue)
              </Text>
            </TouchableOpacity>

            {/* Option 3 : Favoris */}
            <TouchableOpacity
              style={[
                styles.actionButton,
                {
                  backgroundColor: isFav ? colors.danger : colors.bgPrimary,
                  borderColor: isFav ? colors.danger : colors.border,
                  borderWidth: 1,
                },
              ]}
              onPress={handleToggleAyahFav}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isFav ? 'heart' : 'heart-outline'}
                size={18}
                color={isFav ? '#FFFFFF' : colors.textSecondary}
                style={{ marginRight: 8 }}
              />
              <Text
                style={[
                  styles.actionButtonText,
                  { color: isFav ? '#FFFFFF' : colors.textPrimary },
                ]}
              >
                {isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              </Text>
            </TouchableOpacity>

            {/* Option 4 : Copier */}
            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: colors.bgPrimary, borderColor: colors.border, borderWidth: 1 },
              ]}
              onPress={handleCopyVerse}
              activeOpacity={0.8}
            >
              <Ionicons name="copy-outline" size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
              <Text style={[styles.actionButtonText, { color: colors.textPrimary }]}>
                Copier le verset
              </Text>
            </TouchableOpacity>

            {/* Bouton Fermer */}
            <TouchableOpacity
              style={[styles.actionButton, styles.closeButton, { borderColor: colors.border }]}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ShareVerseModal pour la sélection de langue */}
      <ShareVerseModal
        visible={shareModalVisible}
        ayah={ayah}
        surahName={surahName}
        surahNumber={surahNumber}
        onClose={() => {
          setShareModalVisible(false);
          onClose();
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    width: '90%',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
  arabicText: {
    fontSize: 26,
    lineHeight: 50,
    textAlign: 'right',
    marginBottom: 16,
    fontFamily: 'KFGQPC_Warsh',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  verseTextPreview: {
    fontSize: 18,
    textAlign: 'right',
    lineHeight: 32,
    marginVertical: 4,
    fontFamily: 'KFGQPC_Warsh',
  },
  translationPreview: {
    fontSize: 13,
    textAlign: 'left',
    lineHeight: 20,
    fontStyle: 'italic',
    marginVertical: 4,
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
  actionButton: {
    height: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionButtonTextDark: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  actionButtonText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  closeButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    marginBottom: 0,
    marginTop: 4,
  },
});
