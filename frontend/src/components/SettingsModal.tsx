import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface SettingsModalProps {
  visible: boolean;
  fontSize: number;
  onClose: () => void;
  onChangeFontSize: (delta: number) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  fontSize,
  onClose,
  onChangeFontSize,
}) => {
  const { colors, isDark, toggleTheme } = useTheme();
  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.modalBg, borderColor: colors.border }]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <Ionicons name="settings-outline" size={22} color={colors.gold} style={{ marginRight: 8 }} />
                <Text style={[styles.headerTitle, { color: colors.gold }]}>PARAMÈTRES AL BARAKA</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Personnalisez votre expérience de lecture et d'écoute
            </Text>

            {/* Taille du texte arabe */}
            <View style={[styles.settingSection, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Taille du texte arabe</Text>
              <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
                Dans le Mushaf, le texte est réduit si nécessaire pour que toute la page tienne à l'écran.
              </Text>
              <View style={styles.fontControlsRow}>
                <TouchableOpacity
                  style={[styles.fontBtn, { backgroundColor: colors.bgPrimary, borderColor: colors.border }]}
                  onPress={() => onChangeFontSize(-2)}
                >
                  <Text style={[styles.fontBtnText, { color: colors.textPrimary }]}>A-</Text>
                </TouchableOpacity>

                <Text style={[styles.fontSizeVal, { color: colors.gold }]}>{fontSize}</Text>

                <TouchableOpacity
                  style={[styles.fontBtn, { backgroundColor: colors.bgPrimary, borderColor: colors.border }]}
                  onPress={() => onChangeFontSize(2)}
                >
                  <Text style={[styles.fontBtnText, { color: colors.textPrimary }]}>A+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Mode sombre */}
            <View style={[styles.settingSectionRow, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Mode Sombre</Text>
                <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>Thème visuel de l'application</Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.border, true: colors.gold }}
                thumbColor="#FFFFFF"
              />
            </View>

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.gold }]} onPress={onClose}>
              <Text style={styles.saveBtnText}>Valider et Appliquer</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
  },
  scrollContent: {
    paddingBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  closeBtn: {
    padding: 4,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 16,
  },
  settingSection: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  settingSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  sectionSub: {
    fontSize: 11,
    marginTop: 2,
  },
  fontControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  fontBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fontBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  fontSizeVal: {
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 20,
  },
  saveBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: {
    color: '#0F172A',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
