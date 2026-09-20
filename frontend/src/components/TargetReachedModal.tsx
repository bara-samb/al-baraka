import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface TargetReachedModalProps {
  visible: boolean;
  targetCount: number;
  dhikrName: string;
  onClose: () => void;
  onReset: () => void;
}

export const TargetReachedModal: React.FC<TargetReachedModalProps> = ({
  visible,
  targetCount,
  dhikrName,
  onClose,
  onReset,
}) => {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[styles.modalBox, { backgroundColor: colors.modalBg, borderColor: colors.gold }]}
        >
          <View style={[styles.iconContainer, { backgroundColor: colors.gold }]}>
            <Ionicons name="checkmark-circle" size={54} color="#0F172A" />
          </View>

          <Text style={[styles.title, { color: colors.gold }]}>Objectif Atteint !</Text>
          <Text style={[styles.subtitle, { color: colors.textPrimary }]}>
            Macha'Allah ! Vous avez accompli vos {targetCount} zikrs pour :
          </Text>

          <Text style={[styles.dhikrText, { color: colors.emerald }]}>"{dhikrName}"</Text>

          <Text style={[styles.blessingText, { color: colors.textSecondary }]}>
            Qu'Allah accepte vos invocations et vous accorde Sa bénédiction (Baraka).
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.gold }]}
              onPress={onReset}
            >
              <Ionicons name="refresh-outline" size={20} color="#0F172A" style={{ marginRight: 6 }} />
              <Text style={styles.btnText}>Recommencer un tour</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.closeBtn, { borderColor: colors.border }]}
              onPress={onClose}
            >
              <Text style={{ color: colors.textSecondary }}>Fermer</Text>
            </TouchableOpacity>
          </View>
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
    paddingHorizontal: 20,
  },
  modalBox: {
    width: '90%',
    borderRadius: 24,
    padding: 24,
    borderWidth: 2,
    alignItems: 'center',
    elevation: 12,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -50,
    marginBottom: 16,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 6,
  },
  dhikrText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  blessingText: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonRow: {
    width: '100%',
    alignItems: 'center',
  },
  btn: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  btnText: {
    color: '#0F172A',
    fontWeight: 'bold',
    fontSize: 15,
  },
  closeBtn: {
    paddingVertical: 8,
  },
});
