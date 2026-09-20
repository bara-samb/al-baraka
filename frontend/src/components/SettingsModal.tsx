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
import { MushafPageOrientation, TranslationLanguage } from '../types/quran';

interface SettingsModalProps {
  visible: boolean;
  orientation: MushafPageOrientation;
  fontSize: number;
  translationLang: TranslationLanguage;
  onClose: () => void;
  onToggleOrientation: (orientation: MushafPageOrientation) => void;
  onChangeFontSize: (delta: number) => void;
  onChangeTranslationLang: (lang: TranslationLanguage) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  orientation,
  fontSize,
  translationLang,
  onClose,
  onToggleOrientation,
  onChangeFontSize,
  onChangeTranslationLang,
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

            {/* Section 1: Orientation du Mushaf */}
            <View style={[styles.settingSection, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Sens de défilement des pages du Mushaf
              </Text>
              <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
                Choisissez le mode d'enfilage des pages
              </Text>

              <View style={styles.orientationOptionRow}>
                {/* Mode Vertical */}
                <TouchableOpacity
                  style={[
                    styles.orientationOptionBtn,
                    {
                      backgroundColor: orientation === 'vertical' ? colors.gold : colors.bgPrimary,
                      borderColor: orientation === 'vertical' ? colors.gold : colors.border,
                    },
                  ]}
                  onPress={() => onToggleOrientation('vertical')}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="swap-vertical"
                    size={22}
                    color={orientation === 'vertical' ? '#0F172A' : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.optionLabel,
                      { color: orientation === 'vertical' ? '#0F172A' : colors.textPrimary },
                    ]}
                  >
                    Vertical ↕
                  </Text>
                  <Text
                    style={[
                      styles.optionSubLabel,
                      { color: orientation === 'vertical' ? '#0F172A' : colors.textSecondary },
                    ]}
                  >
                    Défilement continu
                  </Text>
                </TouchableOpacity>

                {/* Mode Horizontal */}
                <TouchableOpacity
                  style={[
                    styles.orientationOptionBtn,
                    {
                      backgroundColor: orientation === 'horizontal' ? colors.gold : colors.bgPrimary,
                      borderColor: orientation === 'horizontal' ? colors.gold : colors.border,
                    },
                  ]}
                  onPress={() => onToggleOrientation('horizontal')}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="swap-horizontal"
                    size={22}
                    color={orientation === 'horizontal' ? '#0F172A' : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.optionLabel,
                      { color: orientation === 'horizontal' ? '#0F172A' : colors.textPrimary },
                    ]}
                  >
                    Horizontal ↔
                  </Text>
                  <Text
                    style={[
                      styles.optionSubLabel,
                      { color: orientation === 'horizontal' ? '#0F172A' : colors.textSecondary },
                    ]}
                  >
                    Mode Livre (Swipe)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Section 2: Langue de Traduction */}
            <View style={[styles.settingSection, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Langue de Traduction</Text>
              <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
                Choisissez la langue de traduction sous le texte arabe
              </Text>

              <View style={styles.langOptionRow}>
                {/* Français */}
                <TouchableOpacity
                  style={[
                    styles.langBtn,
                    {
                      backgroundColor: translationLang === 'fr' ? colors.gold : colors.bgPrimary,
                      borderColor: translationLang === 'fr' ? colors.gold : colors.border,
                    },
                  ]}
                  onPress={() => onChangeTranslationLang('fr')}
                >
                  <Text
                    style={[
                      styles.langBtnText,
                      { color: translationLang === 'fr' ? '#0F172A' : colors.textPrimary },
                    ]}
                  >
                    🇫🇷 Français
                  </Text>
                </TouchableOpacity>

                {/* Anglais */}
                <TouchableOpacity
                  style={[
                    styles.langBtn,
                    {
                      backgroundColor: translationLang === 'en' ? colors.gold : colors.bgPrimary,
                      borderColor: translationLang === 'en' ? colors.gold : colors.border,
                    },
                  ]}
                  onPress={() => onChangeTranslationLang('en')}
                >
                  <Text
                    style={[
                      styles.langBtnText,
                      { color: translationLang === 'en' ? '#0F172A' : colors.textPrimary },
                    ]}
                  >
                    🇬🇧 English
                  </Text>
                </TouchableOpacity>

                {/* Désactivé */}
                <TouchableOpacity
                  style={[
                    styles.langBtn,
                    {
                      backgroundColor: translationLang === 'none' ? colors.gold : colors.bgPrimary,
                      borderColor: translationLang === 'none' ? colors.gold : colors.border,
                    },
                  ]}
                  onPress={() => onChangeTranslationLang('none')}
                >
                  <Text
                    style={[
                      styles.langBtnText,
                      { color: translationLang === 'none' ? '#0F172A' : colors.textPrimary },
                    ]}
                  >
                    🚫 Aucune
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Section 3: Taille du texte Arabe */}
            <View style={[styles.settingSection, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Taille de la police Arabe</Text>
              <View style={styles.fontControlsRow}>
                <TouchableOpacity
                  style={[styles.fontBtn, { backgroundColor: colors.bgPrimary, borderColor: colors.border }]}
                  onPress={() => onChangeFontSize(-2)}
                >
                  <Text style={[styles.fontBtnText, { color: colors.textPrimary }]}>A-</Text>
                </TouchableOpacity>

                <Text style={[styles.fontSizeVal, { color: colors.gold }]}>{fontSize} pt</Text>

                <TouchableOpacity
                  style={[styles.fontBtn, { backgroundColor: colors.bgPrimary, borderColor: colors.border }]}
                  onPress={() => onChangeFontSize(2)}
                >
                  <Text style={[styles.fontBtnText, { color: colors.textPrimary }]}>A+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Section 4: Mode Sombre */}
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
  orientationOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 10,
  },
  orientationOptionBtn: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 6,
  },
  optionSubLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  langOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 6,
  },
  langBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
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
