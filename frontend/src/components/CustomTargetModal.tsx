import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface CustomTargetModalProps {
  visible: boolean;
  currentTarget: number;
  onClose: () => void;
  onSaveTarget: (target: number) => void;
}

export const CustomTargetModal: React.FC<CustomTargetModalProps> = ({
  visible,
  currentTarget,
  onClose,
  onSaveTarget,
}) => {
  const { colors } = useTheme();
  const [inputValue, setInputValue] = useState<string>(
    currentTarget > 0 ? currentTarget.toString() : '100'
  );

  const handleSave = () => {
    const parsed = parseInt(inputValue.trim(), 10);
    if (!isNaN(parsed) && parsed > 0) {
      onSaveTarget(parsed);
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[styles.modalBox, { backgroundColor: colors.modalBg, borderColor: colors.border }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.header}>
            <Ionicons name="options-outline" size={24} color={colors.gold} />
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Définir un Objectif Sur Mesure
            </Text>
          </View>

          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Entrez le nombre exact de zikrs que vous désirez accomplir (ex : 33, 99, 500...) :
          </Text>

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.bgPrimary,
                color: colors.textPrimary,
                borderColor: colors.border,
              },
            ]}
            keyboardType="number-pad"
            value={inputValue}
            onChangeText={setInputValue}
            placeholder="Ex: 500"
            placeholderTextColor={colors.textSecondary}
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.btn, styles.cancelBtn, { borderColor: colors.border }]}
              onPress={onClose}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Annuler</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.saveBtn, { backgroundColor: colors.gold }]}
              onPress={handleSave}
            >
              <Text style={styles.saveBtnText}>Valider l'objectif</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalBox: {
    width: '90%',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  input: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  btn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    borderWidth: 1,
    marginRight: 8,
  },
  saveBtn: {
    marginLeft: 8,
  },
  saveBtnText: {
    color: '#0F172A',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
