import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Surah } from '../types/quran';
import { isSurahFavorite, toggleFavoriteSurah } from '../services/favoritesService';
import { isSurahDownloaded, subscribeDownloadChange } from '../services/downloadService';
import { useTheme } from '../context/ThemeContext';

interface SurahCardProps {
  surah: Surah;
  onPress: (surah: Surah) => void;
}

export const SurahCard: React.FC<SurahCardProps> = ({ surah, onPress }) => {
  const { colors } = useTheme();
  const [isFav, setIsFav] = useState<boolean>(false);
  const [isDownloaded, setIsDownloaded] = useState<boolean>(false);

  useEffect(() => {
    checkStatus();
    const unsub = subscribeDownloadChange(() => {
      checkStatus();
    });
    return () => unsub();
  }, [surah.number]);

  const checkStatus = async () => {
    const fav = await isSurahFavorite(surah.number);
    const dl = await isSurahDownloaded(surah.number);
    setIsFav(fav);
    setIsDownloaded(dl);
  };

  const handleToggleFav = async (e: any) => {
    e.stopPropagation();
    const newStatus = await toggleFavoriteSurah(surah);
    setIsFav(newStatus);
  };

  return (
    <TouchableOpacity
      style={[
        styles.cardContainer,
        {
          backgroundColor: colors.bgCard,
          borderColor: colors.border,
          shadowColor: colors.cardShadow,
        },
      ]}
      onPress={() => onPress(surah)}
      activeOpacity={0.7}
    >
      <View style={[styles.numberBadge, { backgroundColor: colors.bgPrimary, borderColor: colors.gold }]}>
        <Text style={[styles.numberText, { color: colors.gold }]}>{surah.number}</Text>
      </View>

      <View style={styles.infoContainer}>
        <View style={styles.nameRow}>
          <Text style={[styles.englishName, { color: colors.textPrimary }]}>{surah.englishName}</Text>
          {isDownloaded && (
            <Ionicons
              name="checkmark-circle"
              size={15}
              color={colors.emerald}
              style={{ marginLeft: 6 }}
            />
          )}
        </View>
        <Text style={[styles.translationText, { color: colors.textSecondary }]}>
          {surah.englishNameTranslation} • {surah.numberOfAyahs} Versets
        </Text>
      </View>

      <View style={styles.rightContainer}>
        <TouchableOpacity style={styles.favBtn} onPress={handleToggleFav}>
          <Ionicons
            name={isFav ? 'heart' : 'heart-outline'}
            size={22}
            color={isFav ? '#EF4444' : colors.textSecondary}
          />
        </TouchableOpacity>
        <Text style={[styles.arabicName, { color: colors.gold }]}>{surah.name}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  numberBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 1,
  },
  numberText: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  infoContainer: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  englishName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  translationText: {
    fontSize: 12,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arabicName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  favBtn: {
    padding: 6,
  },
});
