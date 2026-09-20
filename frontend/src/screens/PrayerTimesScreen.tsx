import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { getPrayerTimes, calculateNextPrayer, formatRemainingTime } from '../services/prayerService';
import { PrayerTimings, NextPrayerInfo } from '../types/quran';
import { PrayerTimesScreenProps } from '../navigation/types';

export const PrayerTimesScreen: React.FC<PrayerTimesScreenProps> = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const [timings, setTimings] = useState<PrayerTimings | null>(null);
  const [nextPrayer, setNextPrayer] = useState<NextPrayerInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!timings) return;
    const interval = setInterval(() => {
      const np = calculateNextPrayer(timings);
      setNextPrayer(np);
    }, 1000);
    return () => clearInterval(interval);
  }, [timings]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await getPrayerTimes();
      setTimings(data);
      const np = calculateNextPrayer(data);
      setNextPrayer(np);
    } catch (e) {
      console.error('Erreur chargement prières:', e);
    } finally {
      setLoading(false);
    }
  };

  const prayersList = timings
    ? [
        { name: 'Fajr (الفجر)', time: timings.Fajr, icon: 'weather-sunset-up' },
        { name: 'Lever du Soleil (الشروق)', time: timings.Sunrise, icon: 'sunny' },
        { name: 'Dhuhr (الظهر)', time: timings.Dhuhr, icon: 'sun' },
        { name: 'Asr (العصر)', time: timings.Asr, icon: 'partly-sunny' },
        { name: 'Maghrib (المغرب)', time: timings.Maghrib, icon: 'weather-sunset-down' },
        { name: 'Isha (العشاء)', time: timings.Isha, icon: 'moon' },
      ]
    : [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bgPrimary} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>SÉNÉGAL • TOUBA AL KHAIR</Text>
        </View>

        <Text style={[styles.title, { color: colors.gold }]}>HEURES DE PRIÈRE</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Calculé selon la méthode des horaires du Sénégal
        </Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Calcul des heures de prière en cours...
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Carte Prochaine Prière */}
          {nextPrayer && (
            <View style={[styles.nextPrayerCard, { backgroundColor: '#1B6B4A', borderColor: colors.gold }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="time" size={22} color={colors.gold} style={{ marginRight: 8 }} />
                <Text style={styles.nextPrayerLabel}>PROCHAINE PRIÈRE</Text>
              </View>

              <Text style={styles.nextPrayerName}>{nextPrayer.name}</Text>
              <Text style={styles.nextPrayerTime}>{nextPrayer.time}</Text>

              <View style={styles.timerBadge}>
                <Text style={styles.timerLabel}>Temps restant :</Text>
                <Text style={styles.timerValue}>{nextPrayer.formattedRemaining}</Text>
              </View>

              <View style={styles.warshFooter}>
                <Text style={styles.warshText}>Riwaya Warsh 'an Nafi' (ورش عن نافع)</Text>
              </View>
            </View>
          )}

          {/* Tableau des 5 Prières */}
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Horaires du Jour</Text>

          <View style={styles.prayersContainer}>
            {prayersList.map((item, index) => {
              const isNext = nextPrayer?.name.includes(item.name.split(' ')[0]);

              return (
                <View
                  key={index}
                  style={[
                    styles.prayerItem,
                    {
                      backgroundColor: isNext ? 'rgba(212, 175, 55, 0.15)' : colors.bgCard,
                      borderColor: isNext ? colors.gold : colors.border,
                    },
                  ]}
                >
                  <View style={styles.prayerLeft}>
                    <View
                      style={[
                        styles.prayerIconBox,
                        { backgroundColor: isNext ? colors.gold : colors.bgSecondary },
                      ]}
                    >
                      <Ionicons
                        name={item.icon as any}
                        size={18}
                        color={isNext ? '#0F172A' : colors.gold}
                      />
                    </View>
                    <Text
                      style={[
                        styles.prayerNameText,
                        { color: isNext ? colors.gold : colors.textPrimary, fontWeight: isNext ? 'bold' : '600' },
                      ]}
                    >
                      {item.name}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.prayerTimeText,
                      { color: isNext ? colors.gold : colors.textPrimary, fontWeight: 'bold' },
                    ]}
                  >
                    {item.time}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  badgeContainer: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 6,
  },
  badgeText: {
    color: '#D4AF37',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 110,
  },
  nextPrayerCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    marginBottom: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  nextPrayerLabel: {
    color: '#D4AF37',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  nextPrayerName: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: 'bold',
  },
  nextPrayerTime: {
    color: '#D4AF37',
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 4,
  },
  timerBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    marginRight: 6,
  },
  timerValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  warshFooter: {
    marginTop: 14,
  },
  warshText: {
    color: '#94A3B8',
    fontSize: 11,
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  prayersContainer: {
    gap: 10,
  },
  prayerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  prayerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prayerIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  prayerNameText: {
    fontSize: 15,
  },
  prayerTimeText: {
    fontSize: 16,
  },
});
