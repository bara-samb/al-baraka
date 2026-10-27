import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Dimensions,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { ORANGE_MONEY_LOGO, WAVE_LOGO } from './PaymentBadges';

interface SadaqahModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SadaqahModal: React.FC<SadaqahModalProps> = ({ visible, onClose }) => {
  const { colors } = useTheme();
  const handleWaveDonation = async () => {
    const waveUrl = 'https://pay.wave.com/m/M_sn_UGcGdaAUDasK/c/sn/';
    try {
      await Linking.openURL(waveUrl);
    } catch {
      Linking.openURL('https://pay.wave.com/m/M_sn_UGcGdaAUDasK/c/sn/');
    }
  };

  const handleOrangeMoneyDonation = async () => {
    const ussdCode = 'tel:*144*1*780171688%23';
    try {
      await Linking.openURL(ussdCode);
    } catch {
      Linking.openURL('tel:*144%23');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.modalCard, { backgroundColor: colors.modalBg, borderColor: colors.gold }]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Header avec bouton fermer */}
            <View style={styles.header}>
              <View style={[styles.titleBadge, { backgroundColor: colors.goldTint, borderColor: colors.gold }]}>
                <Ionicons name="heart" size={18} color={colors.gold} style={{ marginRight: 6 }} />
                <Text style={[styles.badgeText, { color: colors.gold }]}>HADIYA / DON</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Titre principal */}
            <Text style={[styles.mainTitle, { color: colors.emerald }]}>Sadaqah Jariyah (صدقة جارية)</Text>
            <Text style={[styles.arabicSub, { color: colors.gold }]}>مَا نَقَصَتْ صَدَقَةٌ مِنْ مَالٍ</Text>

            {/* Explication */}
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              L'application <Text style={[styles.bold, { color: colors.textPrimary }]}>AL BARAKA</Text> est 100% gratuite et sans aucune publicité. Vos dons participent directement au soutien et au maintien des serveurs d'écoute fluide des récitations de <Text style={[styles.goldText, { color: colors.gold }]}>Serigne Aboul Baraka Mbacké</Text>.
            </Text>

            {/* Boutons d'action de paiement */}
            <View style={styles.actionSection}>
              {/* Bouton Wave */}
              <TouchableOpacity
                style={[styles.payButton, styles.waveButton]}
                onPress={handleWaveDonation}
                activeOpacity={0.85}
              >
                <Image source={WAVE_LOGO} style={styles.payLogo} accessibilityLabel="Wave" />
                <View>
                  <Text style={styles.payBtnTitle}>Faire un don via Wave</Text>
                  <Text style={styles.payBtnSub}>Lien direct Wave (78 017 16 88)</Text>
                </View>
              </TouchableOpacity>

              {/* Bouton Orange Money */}
              <TouchableOpacity
                style={[styles.payButton, styles.omButton]}
                onPress={handleOrangeMoneyDonation}
                activeOpacity={0.85}
              >
                <Image source={ORANGE_MONEY_LOGO} style={[styles.payLogo, styles.payLogoLight]} accessibilityLabel="Orange Money" />
                <View>
                  <Text style={styles.payBtnTitle}>Faire un don via Orange Money</Text>
                  <Text style={styles.payBtnSub}>Code USSD direct (*144#)</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Note spirituelle de fin */}
            <Text style={[styles.spiritualNote, { color: colors.gold }]}>
              "Ce que vous dépensez de bien, Allah le sait parfaitement."
            </Text>

            {/* Bouton Fermer secondaire */}
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Fermer la fenêtre</Text>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    maxHeight: Dimensions.get('window').height * 0.88,
    borderRadius: 24,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 12,
  },
  scrollContent: {
    padding: 22,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  closeBtn: {
    padding: 6,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 14,
    textAlign: 'center',
  },
  arabicSub: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 22,
  },
  bold: {
    fontWeight: 'bold',
  },
  goldText: {
    fontWeight: 'bold',
  },
  actionSection: {
    gap: 12,
    marginBottom: 20,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  payLogo: {
    width: 36,
    height: 36,
    borderRadius: 9,
    marginRight: 12,
    resizeMode: 'cover',
  },
  payLogoLight: {
    backgroundColor: '#FFFFFF',
    resizeMode: 'contain',
  },
  waveButton: {
    backgroundColor: '#1DC4FF',
  },
  omButton: {
    backgroundColor: '#FF6600',
  },
  payBtnTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  payBtnSub: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    marginTop: 1,
  },
  spiritualNote: {
    fontSize: 12.5,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 16,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
