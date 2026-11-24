import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import {
  AppUpdateInfo,
  checkForAppUpdate,
  dismissUpdate,
  openStoreForUpdate,
} from '../services/updateService';

export const UpdateModal: React.FC = () => {
  const { colors } = useTheme();
  const [visible, setVisible] = useState<boolean>(false);
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);

  useEffect(() => {
    // Vérification quelques secondes après l'ouverture de l'application
    const timer = setTimeout(async () => {
      const res = await checkForAppUpdate();
      if (res.available && res.info) {
        setUpdateInfo(res.info);
        setVisible(true);
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  const handleUpdate = async () => {
    await openStoreForUpdate(updateInfo);
    setVisible(false);
  };

  const handleDismiss = async () => {
    if (updateInfo?.latestVersion) {
      await dismissUpdate(updateInfo.latestVersion);
    }
    setVisible(false);
  };

  if (!visible || !updateInfo) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.modalBg,
              borderColor: colors.gold,
            },
          ]}
        >
          {/* Badge Icône Doré */}
          <View style={[styles.iconWrapper, { backgroundColor: colors.goldTint, borderColor: colors.gold }]}>
            <Ionicons name="sparkles" size={32} color={colors.gold} />
          </View>

          {/* Titre */}
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {updateInfo.title || 'Mise à jour disponible'}
          </Text>
          <View style={[styles.versionPill, { backgroundColor: colors.goldTint }]}>
            <Text style={[styles.versionText, { color: colors.gold }]}>
              Version {updateInfo.latestVersion}
            </Text>
          </View>

          {/* Message */}
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            {updateInfo.message}
          </Text>

          {/* Liste des nouveautés */}
          {updateInfo.releaseNotes && updateInfo.releaseNotes.length > 0 && (
            <View style={[styles.notesBox, { backgroundColor: colors.bgPrimary, borderColor: colors.border }]}>
              <Text style={[styles.notesHeader, { color: colors.textPrimary }]}>
                Nouveautés dans cette version :
              </Text>
              <ScrollView style={{ maxHeight: 150 }} showsVerticalScrollIndicator={false}>
                {updateInfo.releaseNotes.map((note, idx) => (
                  <View key={idx} style={styles.noteItem}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.emerald} style={{ marginRight: 8, marginTop: 2 }} />
                    <Text style={[styles.noteText, { color: colors.textPrimary }]}>
                      {note}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Boutons d'action */}
          <TouchableOpacity
            style={[styles.updateButton, { backgroundColor: colors.gold }]}
            onPress={handleUpdate}
            activeOpacity={0.85}
          >
            <Ionicons name="logo-google-playstore" size={20} color={colors.onGold} style={{ marginRight: 8 }} />
            <Text style={[styles.updateButtonText, { color: colors.onGold }]}>
              Mettre à jour maintenant
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.laterButton}
            onPress={handleDismiss}
            activeOpacity={0.7}
          >
            <Text style={[styles.laterButtonText, { color: colors.textSecondary }]}>
              Plus tard
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 6,
  },
  versionPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  versionText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  message: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 14,
  },
  notesBox: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 18,
  },
  notesHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  noteItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  noteText: {
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  updateButton: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  updateButtonText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  laterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  laterButtonText: {
    fontSize: 13,
  },
});
