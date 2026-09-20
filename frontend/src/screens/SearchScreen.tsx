import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { searchQuranOccurrences } from '../services/quranService';
import { SearchOccurrenceStats, SearchOccurrenceItem } from '../types/quran';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

interface SearchScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList>;
}

export const SearchScreen: React.FC<SearchScreenProps> = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [stats, setStats] = useState<SearchOccurrenceStats | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    try {
      setLoading(true);
      const res = await searchQuranOccurrences(query.trim());
      setStats(res);
    } catch (e) {
      console.error('Erreur recherche occurrences:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectVerse = (item: SearchOccurrenceItem) => {
    navigation.navigate('Surah', {
      surahNumber: item.surahNumber,
      surahName: item.surahName,
      englishName: item.englishName,
    });
  };

  const renderOccurrenceItem = ({ item }: { item: SearchOccurrenceItem }) => (
    <TouchableOpacity
      style={[styles.resultCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
      onPress={() => handleSelectVerse(item)}
      activeOpacity={0.8}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.surahBadge, { backgroundColor: colors.gold }]}>
          <Text style={styles.surahBadgeText}>
            Sourate {item.surahNumber} • Verset {item.numberInSurah}
          </Text>
        </View>
        <Text style={[styles.surahNameText, { color: colors.gold }]}>{item.englishName} ({item.surahName})</Text>
      </View>

      <Text style={[styles.arabicVerseText, { color: colors.textPrimary }]}>{item.text}</Text>

      {item.translation ? (
        <Text style={[styles.translationText, { color: colors.textSecondary }]}>"{item.translation}"</Text>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bgPrimary} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.gold }]}>RECHERCHE GLOBALE</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Moteur de recherche par mots et occurrences dans le Saint Coran
        </Text>

        {/* Search Bar Input */}
        <View style={[styles.searchBar, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={20} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Rechercher un mot (ex: Sabr, ﺻﺒﺮ, Paix, Rahmah)..."
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setStats(null); }} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.searchActionBtn, { backgroundColor: colors.gold }]}
            onPress={handleSearch}
          >
            <Ionicons name="arrow-forward" size={18} color="#0F172A" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Analyse des occurrences dans le Coran...
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Bandeau Statistiques */}
          {stats && stats.query ? (
            <View style={[styles.statsBanner, { backgroundColor: 'rgba(212, 175, 55, 0.12)', borderColor: colors.gold }]}>
              <Ionicons name="analytics-outline" size={20} color={colors.gold} style={{ marginRight: 8 }} />
              <Text style={[styles.statsText, { color: colors.textPrimary }]}>
                Le mot <Text style={{ fontWeight: 'bold', color: colors.gold }}>"{stats.query}"</Text> apparaît{' '}
                <Text style={{ fontWeight: 'bold', color: colors.gold }}>{stats.totalOccurrences} fois</Text> dans{' '}
                <Text style={{ fontWeight: 'bold', color: colors.gold }}>{stats.totalSurahs} sourates</Text>.
              </Text>
            </View>
          ) : null}

          {/* Liste des résultats */}
          {stats ? (
            <FlatList
              data={stats.results}
              keyExtractor={(item, idx) => `${item.surahNumber}_${item.numberInSurah}_${idx}`}
              renderItem={renderOccurrenceItem}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.centered}>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    Aucune occurrence trouvée pour "{stats.query}"
                  </Text>
                </View>
              }
            />
          ) : (
            <View style={styles.placeholderContainer}>
              <Ionicons name="search" size={50} color={colors.border} />
              <Text style={[styles.placeholderTitle, { color: colors.textSecondary }]}>
                Recherchez par mot ou expression
              </Text>
              <Text style={[styles.placeholderSub, { color: colors.textSecondary }]}>
                Tapez un mot en Arabe ou en Français pour visualiser son nombre d'apparitions exact dans les sourates.
              </Text>
            </View>
          )}
        </View>
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
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  clearBtn: {
    padding: 4,
    marginRight: 6,
  },
  searchActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  statsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  statsText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 110,
  },
  resultCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  surahBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  surahBadgeText: {
    color: '#0F172A',
    fontWeight: 'bold',
    fontSize: 11,
  },
  surahNameText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  arabicVerseText: {
    fontSize: 17,
    textAlign: 'right',
    lineHeight: 28,
    marginTop: 4,
  },
  translationText: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 6,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 30,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 12,
  },
  placeholderSub: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
});
