import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface ContactModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ContactModal: React.FC<ContactModalProps> = ({ visible, onClose }) => {
  const { colors } = useTheme();

  const handleWhatsApp = () => {
    const message = encodeURIComponent("Bonjour, je vous contacte au sujet de l'application AL BARAKA (Serigne Aboul Baraka Mbacké).");
    const url = `https://wa.me/221780171688?text=${message}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL('https://whatsapp.com');
    });
  };

  const handleCall = () => {
    Linking.openURL('tel:+221780171688');
  };

  const handleEmail = () => {
    Linking.openURL('mailto:mamebara08@gmail.com?subject=Contact%20AL%20BARAKA');
  };

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.modalBg, borderColor: colors.border }]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Header avec bouton fermer */}
            <View style={styles.header}>
              <View style={styles.titleBadge}>
                <Ionicons name="chatbubbles" size={18} color={colors.gold} style={{ marginRight: 6 }} />
                <Text style={[styles.badgeText, { color: colors.gold }]}>CONTACT & SUPPORT</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Titre principal */}
            <Text style={[styles.mainTitle, { color: colors.gold }]}>Nous Contacter (تواصل معنا)</Text>

            {/* Explication */}
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              Pour toute question, suggestion d'amélioration ou assistance concernant l'application <Text style={{ color: colors.textPrimary, fontWeight: 'bold' }}>AL BARAKA</Text> et les récitations de <Text style={{ color: colors.gold, fontWeight: 'bold' }}>Serigne Aboul Baraka Mbacké</Text>, contactez-nous directement via les moyens ci-dessous :
            </Text>

            {/* Options de contact */}
            <View style={styles.contactButtonsContainer}>
              {/* WhatsApp Direct */}
              <TouchableOpacity
                style={[styles.contactBtn, styles.waBtn]}
                onPress={handleWhatsApp}
                activeOpacity={0.85}
              >
                <Ionicons name="logo-whatsapp" size={24} color="#FFFFFF" style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactBtnTitle}>Contacter sur WhatsApp</Text>
                  <Text style={styles.contactBtnSub}>+221 78 017 16 88 • Message instantané</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
              </TouchableOpacity>

              {/* Appel Direct */}
              <TouchableOpacity
                style={[styles.contactBtn, { backgroundColor: colors.bgSecondary, borderColor: colors.gold, borderWidth: 1.5 }]}
                onPress={handleCall}
                activeOpacity={0.85}
              >
                <Ionicons name="call" size={22} color={colors.gold} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.contactBtnTitle, { color: colors.textPrimary }]}>Appel Téléphonique Direct</Text>
                  <Text style={[styles.contactBtnSub, { color: colors.textSecondary }]}>+221 78 017 16 88</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.gold} />
              </TouchableOpacity>

              {/* Email Support */}
              <TouchableOpacity
                style={[styles.contactBtn, styles.emailBtn]}
                onPress={handleEmail}
                activeOpacity={0.85}
              >
                <Ionicons name="mail" size={22} color="#FFFFFF" style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactBtnTitle}>Envoyer un Email</Text>
                  <Text style={styles.contactBtnSub}>mamebara08@gmail.com</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Note spirituelle */}
            <Text style={[styles.footerNote, { color: colors.gold }]}>
              Jazakum Allahu Khayran pour votre soutien et vos douas.
            </Text>

            {/* Bouton Fermer */}
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Fermer</Text>
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
    maxHeight: '88%',
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
  titleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  closeBtn: {
    padding: 4,
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 14,
    textAlign: 'center',
  },
  description: {
    fontSize: 13.5,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  contactButtonsContainer: {
    gap: 12,
    marginBottom: 18,
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  waBtn: {
    backgroundColor: '#25D366',
  },
  emailBtn: {
    backgroundColor: '#3B82F6',
  },
  contactBtnTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  contactBtnSub: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    marginTop: 1,
  },
  footerNote: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 14,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
