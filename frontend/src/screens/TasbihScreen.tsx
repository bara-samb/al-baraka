import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  Vibration,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { CustomTargetModal } from '../components/CustomTargetModal';
import { TargetReachedModal } from '../components/TargetReachedModal';
import {
  getTasbihStats,
  saveTasbihIncrement,
  resetTasbihStats,
  TasbihStats,
} from '../services/tasbihService';

const TARGET_PRESETS = [11, 33, 99, 100, 129, 313, 1000];

export const TasbihScreen: React.FC = () => {
  const { colors, isDark, toggleTheme } = useTheme();
  const [count, setCount] = useState<number>(0);
  const [target, setTarget] = useState<number>(33);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState<boolean>(false);
  const [isReachedModalOpen, setIsReachedModalOpen] = useState<boolean>(false);

  const [stats, setStats] = useState<TasbihStats>({
    totalCount: 0,
    completedRounds: 0,
    dhikrCounts: {},
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const s = await getTasbihStats();
    setStats(s);
  };

  const handleTap = async () => {
    const nextCount = count + 1;
    const isRoundComplete = target > 0 && nextCount === target;

    setCount(nextCount);

    if (isRoundComplete) {
      // Déclencher la vibration/son immédiatement AVANT la modal
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        Vibration.vibrate([0, 200, 100, 300]);
      }
      setTimeout(() => {
        setIsReachedModalOpen(true);
      }, 100);
    } else {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        Vibration.vibrate(30);
      }
    }

    const updatedStats = await saveTasbihIncrement('tasbih_main', isRoundComplete);
    setStats(updatedStats);
  };

  const handleResetCount = () => {
    Alert.alert(
      'Réinitialiser le compteur',
      'Remettre à zéro le compteur de Zikr ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          style: 'destructive',
          onPress: () => setCount(0),
        },
      ]
    );
  };

  const handleResetAllStats = () => {
    Alert.alert(
      'Effacer les statistiques',
      'Voulez-vous vraiment réinitialiser vos statistiques globales de zikr ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Tout Effacer',
          style: 'destructive',
          onPress: async () => {
            await resetTasbihStats();
            setCount(0);
            await loadStats();
          },
        },
      ]
    );
  };

  const progressPercent = target > 0 ? Math.min(100, (count / target) * 100) : 100;
  const beads = Array.from({ length: 12 }, (_, i) => i);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* En-tête avec basculement de Thème */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View>
            <Text style={[styles.title, { color: colors.gold }]}>CHAPELET ÉLECTRONIQUE</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Compteur de Zikr • AL BARAKA
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.themeBtn, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}
            onPress={toggleTheme}
          >
            <Ionicons
              name={isDark ? 'sunny' : 'moon'}
              size={20}
              color={isDark ? colors.gold : colors.textPrimary}
            />
          </TouchableOpacity>
        </View>

        {/* Sélecteur de Nombres Cibles (11, 33, 99, 100, 129, 313, 1000, Custom) */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.bgSecondary,
              borderColor: colors.border,
              shadowColor: colors.cardShadow,
            },
          ]}
        >
          <Text style={[styles.targetLabelTitle, { color: colors.gold }]}>CHOISIR L'OBJECTIF DU ZIKR</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.targetRowScroll}
          >
            {TARGET_PRESETS.map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.targetBtn,
                  {
                    backgroundColor: target === t ? colors.gold : colors.bgPrimary,
                    borderColor: target === t ? colors.gold : colors.border,
                  },
                ]}
                onPress={() => {
                  setTarget(t);
                  setCount(0);
                }}
              >
                <Text
                  style={[
                    styles.targetBtnText,
                    { color: target === t ? '#0F172A' : colors.textPrimary },
                  ]}
                >
                  {t}
                </Text>
              </TouchableOpacity>
            ))}

            {/* Bouton Personnalisé (Sur Mesure) */}
            <TouchableOpacity
              style={[
                styles.targetBtn,
                {
                  backgroundColor:
                    !TARGET_PRESETS.includes(target) && target > 0
                      ? colors.gold
                      : colors.bgPrimary,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => setIsCustomModalOpen(true)}
            >
              <Ionicons
                name="create-outline"
                size={14}
                color={
                  !TARGET_PRESETS.includes(target) && target > 0
                    ? '#0F172A'
                    : colors.gold
                }
              />
              <Text
                style={[
                  styles.targetBtnText,
                  {
                    marginLeft: 4,
                    color:
                      !TARGET_PRESETS.includes(target) && target > 0
                        ? '#0F172A'
                        : colors.textSecondary,
                  },
                ]}
              >
                {!TARGET_PRESETS.includes(target) && target > 0 ? target : 'Libre'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Bouton Compteur Principal avec Chapelet à billes vert/doré */}
        <View style={styles.counterContainer}>
          <View style={styles.beadsRingWrapper}>
            {/* Perles du chapelet circulaires */}
            {beads.map((bIndex) => {
              const angle = (bIndex * 360) / beads.length;
              const radius = 118;
              const x = radius * Math.cos((angle * Math.PI) / 180);
              const y = radius * Math.sin((angle * Math.PI) / 180);
              const isPassed = count % beads.length > bIndex;

              return (
                <View
                  key={bIndex}
                  style={[
                    styles.beadItem,
                    {
                      transform: [{ translateX: x }, { translateY: y }],
                      backgroundColor: isPassed ? colors.emerald : colors.gold,
                    },
                  ]}
                />
              );
            })}

            <TouchableOpacity
              style={[styles.counterCircle, { backgroundColor: colors.gold }]}
              onPress={handleTap}
              activeOpacity={0.85}
            >
              <View
                style={[
                  styles.counterCircleInner,
                  { backgroundColor: colors.bgPrimary, borderColor: colors.gold },
                ]}
              >
                <Text style={[styles.countNumber, { color: colors.gold }]}>{count}</Text>
                {target > 0 ? (
                  <Text style={[styles.targetSubText, { color: colors.textSecondary }]}>
                    Objectif : {target}
                  </Text>
                ) : (
                  <Text style={[styles.targetSubText, { color: colors.textSecondary }]}>
                    Sans limite
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          </View>

          {/* Barre de progression */}
          {target > 0 && (
            <View style={styles.progressContainer}>
              <View style={[styles.progressBackground, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progressPercent}%`, backgroundColor: colors.emerald },
                  ]}
                />
              </View>
              <Text style={[styles.progressText, { color: colors.emerald }]}>
                Progression : {Math.round(progressPercent)}%
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.resetBtn,
              { backgroundColor: colors.bgSecondary, borderColor: colors.border },
            ]}
            onPress={handleResetCount}
          >
            <Ionicons name="reload-outline" size={16} color={colors.textSecondary} style={{ marginRight: 6 }} />
            <Text style={[styles.resetBtnText, { color: colors.textSecondary }]}>
              Remettre à zéro
            </Text>
          </TouchableOpacity>
        </View>

        {/* Carte des Statistiques */}
        <View
          style={[
            styles.statsCard,
            { backgroundColor: colors.bgSecondary, borderColor: colors.border },
          ]}
        >
          <View style={styles.statsHeader}>
            <MaterialCommunityIcons name="finance" size={20} color={colors.gold} />
            <Text style={[styles.statsTitle, { color: colors.textPrimary }]}>
              Statistiques Cumulées
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: colors.gold }]}>
                {stats.totalCount}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Répétitions</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: colors.emerald }]}>
                {stats.completedRounds}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Tours Complétés</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.clearStatsBtn} onPress={handleResetAllStats}>
            <Text style={styles.clearStatsText}>Réinitialiser les stats</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modales */}
      <CustomTargetModal
        visible={isCustomModalOpen}
        currentTarget={target}
        onClose={() => setIsCustomModalOpen(false)}
        onSaveTarget={(t) => {
          setTarget(t);
          setCount(0);
        }}
      />

      <TargetReachedModal
        visible={isReachedModalOpen}
        targetCount={target}
        dhikrName="Zikr"
        onClose={() => setIsReachedModalOpen(false)}
        onReset={() => {
          setCount(0);
          setIsReachedModalOpen(false);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 130,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 1.2,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  themeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  targetLabelTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 10,
  },
  targetRowScroll: {
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  targetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    marginHorizontal: 4,
    borderWidth: 1.5,
  },
  targetBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  counterContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  beadsRingWrapper: {
    width: 270,
    height: 270,
    justifyContent: 'center',
    alignItems: 'center',
  },
  beadItem: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  counterCircle: {
    width: 190,
    height: 190,
    borderRadius: 95,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
  },
  counterCircleInner: {
    width: 168,
    height: 168,
    borderRadius: 84,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
  },
  countNumber: {
    fontSize: 52,
    fontWeight: 'bold',
  },
  targetSubText: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: 'bold',
  },
  progressContainer: {
    width: '80%',
    marginTop: 18,
    alignItems: 'center',
  },
  progressBackground: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  progressText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 6,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  resetBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statsCard: {
    marginHorizontal: 16,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statsTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
    padding: 10,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  clearStatsBtn: {
    marginTop: 12,
    alignSelf: 'center',
  },
  clearStatsText: {
    color: '#EF4444',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
});
