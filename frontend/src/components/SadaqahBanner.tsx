import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SadaqahModal } from './SadaqahModal';

export const SadaqahBanner: React.FC = () => {
  const [modalVisible, setModalVisible] = useState<boolean>(false);

  return (
    <>
      <TouchableOpacity
        style={styles.bannerContainer}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.88}
      >
        <View style={styles.leftIconContainer}>
          <Ionicons name="heart" size={20} color="#D4AF37" />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.bannerTitle}>Sadaqah Jariyah (صدقة جارية)</Text>
          <Text style={styles.bannerSubtitle} numberOfLines={1}>
            Soutenez l'hébergement des récitations de Serigne Aboul Baraka Mbacké

          </Text>
        </View>

        <View style={styles.actionBtn}>
          <Text style={styles.actionBtnText}>Faire un Don</Text>
          <Ionicons name="chevron-forward" size={14} color="#114232" style={{ marginLeft: 2 }} />
        </View>
      </TouchableOpacity>

      <SadaqahModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </>
  );
};

const styles = StyleSheet.create({
  bannerContainer: {
    backgroundColor: '#114232',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D4AF37',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  leftIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
    paddingRight: 6,
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#D4AF37',
  },
  bannerSubtitle: {
    fontSize: 11,
    color: '#F7F1E5',
    marginTop: 2,
  },
  actionBtn: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#114232',
    fontSize: 11.5,
    fontWeight: 'bold',
  },
});
