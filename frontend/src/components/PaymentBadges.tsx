import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

export const WAVE_LOGO = require('../assets/logo-wave.png');
export const ORANGE_MONEY_LOGO = require('../assets/logo-orange-money.png');

/** Moyens de paiement acceptés pour la Sadaqah : logos Wave et Orange Money. */
export const PaymentBadges: React.FC<{ color: string }> = ({ color }) => (
  <View style={styles.row}>
    <View style={styles.item}>
      <Image source={WAVE_LOGO} style={styles.logo} accessibilityLabel="Wave" />
      <Text style={[styles.text, { color }]}>Wave</Text>
    </View>
    <View style={styles.item}>
      <Image source={ORANGE_MONEY_LOGO} style={[styles.logo, styles.logoLight]} accessibilityLabel="Orange Money" />
      <Text style={[styles.text, { color }]}>Orange Money</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logo: {
    width: 30,
    height: 30,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  // Logo sur fond blanc : un fond blanc garde son carré net sur la bannière verte.
  logoLight: {
    backgroundColor: '#FFFFFF',
    resizeMode: 'contain',
  },
  text: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});
