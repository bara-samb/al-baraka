import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const MAX_TARGET = 99999;

interface CustomTargetModalProps {
  visible: boolean;
  /** Objectif actuel ; 0 = sans limite. Pré-rempli seulement s'il est déjà sur mesure. */
  currentTarget: number;
  isCustomTarget: boolean;
  onClose: () => void;
  /** 0 = compter sans limite. */
  onSaveTarget: (target: number) => void;
}

export const CustomTargetModal: React.FC<CustomTargetModalProps> = ({
  visible,
  currentTarget,
  isCustomTarget,
  onClose,
  onSaveTarget,
}) => {
  const { colors } = useTheme();
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  // À chaque ouverture : champ vide, sauf si un objectif sur mesure est déjà choisi.
  useEffect(() => {
    if (!visible) return;
    setInputValue(isCustomTarget && currentTarget > 0 ? String(currentTarget) : '');
    setError(null);
  }, [visible, isCustomTarget, currentTarget]);

  const choose = (target: number) => {
    onSaveTarget(target);
    onClose();
  };

  const handleSave = () => {
    const parsed = parseInt(inputValue, 10);
    if (!parsed || parsed < 1 || parsed > MAX_TARGET) {
      setError(`Entrez un nombre entre 1 et ${MAX_TARGET}.`);
      return;
    }
    choose(parsed);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Fond : un appui à côté de la fenêtre la ferme. Il est derrière la fenêtre (et non
            autour d'elle), pour qu'un appui dans la fenêtre — sur le champ — ne la ferme pas. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer" />

        <View style={[styles.modalBox, { backgroundColor: colors.modalBg, borderColor: colors.border }]}>
          <View style={styles.header}>
            <Ionicons name="options-outline" size={24} color={colors.gold} />
            <Text style={[styles.title, { color: colors.textPrimary }]}>Objectif libre</Text>
          </View>

          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Entrez le nombre de zikrs à accomplir (ex : 500), ou comptez sans limite.
          </Text>

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.bgPrimary,
                color: colors.textPrimary,
                borderColor: error ? '#EF4444' : colors.border,
              },
            ]}
            keyboardType="number-pad"
            inputMode="numeric"
            value={inputValue}
            onChangeText={(t) => {
              setInputValue(t.replace(/[^0-9]/g, '').slice(0, 5));
              setError(null);
            }}
            onSubmitEditing={handleSave}
            returnKeyType="done"
            placeholder="Ex : 500"
            placeholderTextColor={colors.textSecondary}
            autoFocus
          />
          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.btn, styles.cancelBtn, { borderColor: colors.border }]} onPress={onClose}>
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Annuler</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.btn, styles.saveBtn, { backgroundColor: colors.gold }]} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Valider l'objectif</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.unlimitedBtn, { borderColor: colors.gold }]} onPress={() => choose(0)}>
            <Ionicons name="infinite" size={18} color={colors.gold} style={{ marginRight: 8 }} />
            <Text style={[styles.unlimitedText, { color: colors.gold }]}>Compter sans limite</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    maxWidth: 420,
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
    marginBottom: 8,
  },
  error: {
    color: '#EF4444',
    fontSize: 12,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
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
  unlimitedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
  },
  unlimitedText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
});
