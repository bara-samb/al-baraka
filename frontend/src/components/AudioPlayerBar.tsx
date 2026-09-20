import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import {
  togglePlayPause,
  seekBy,
  subscribeAudioStatus,
  SoundStatus,
} from '../services/audioService';

interface AudioPlayerBarProps {
  surahTitle?: string;
  reciterName?: string;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  surahTitle = 'Récitation du Coran (Warsh)',
  reciterName = 'Serigne Aboul Baraka Mbacké',
}) => {
  const { colors, isDark } = useTheme();
  const [status, setStatus] = useState<SoundStatus>({
    isPlaying: false,
    position: 0,
    duration: 0,
    isLoaded: false,
  });

  useEffect(() => {
    const unsubscribe = subscribeAudioStatus((newStatus) => {
      setStatus(newStatus);
    });
    return () => unsubscribe();
  }, []);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progressPercentage =
    status.duration > 0 ? (status.position / status.duration) * 100 : 0;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bgSecondary,
          borderTopColor: colors.border,
          shadowColor: colors.cardShadow,
        },
      ]}
    >
      {/* Barre de progression */}
      <View style={[styles.progressBarBackground, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.progressBarFill,
            { width: `${progressPercentage}%`, backgroundColor: colors.gold },
          ]}
        />
      </View>

      <View style={styles.controlsRow}>
        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <Ionicons name="musical-notes-outline" size={16} color={colors.gold} style={{ marginRight: 6 }} />
            <Text style={[styles.surahTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {surahTitle}
            </Text>
          </View>
          <Text style={[styles.reciterName, { color: colors.gold }]} numberOfLines={1}>
            {reciterName}
          </Text>
          <Text style={[styles.timeText, { color: colors.textSecondary }]}>
            {formatTime(status.position)} / {formatTime(status.duration)}
          </Text>
        </View>

        <View style={styles.buttonsGroup}>
          <TouchableOpacity
            style={[styles.seekButton, { backgroundColor: colors.bgPrimary, borderColor: colors.border }]}
            onPress={() => seekBy(-10)}
            activeOpacity={0.7}
            disabled={!status.isLoaded}
          >
            <Ionicons name="play-back-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.seekButtonText, { color: colors.textSecondary }]}>-10s</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.playButton, { backgroundColor: colors.gold }]}
            onPress={togglePlayPause}
            activeOpacity={0.85}
          >
            <Ionicons
              name={status.isPlaying ? 'pause' : 'play'}
              size={20}
              color="#0F172A"
              style={status.isPlaying ? {} : { marginLeft: 2 }}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.seekButton, { backgroundColor: colors.bgPrimary, borderColor: colors.border }]}
            onPress={() => seekBy(10)}
            activeOpacity={0.7}
            disabled={!status.isLoaded}
          >
            <Text style={[styles.seekButtonText, { color: colors.textSecondary }]}>+10s</Text>
            <Ionicons name="play-forward-outline" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingBottom: 18,
    paddingTop: 4,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 12,
  },
  progressBarBackground: {
    height: 4,
    width: '100%',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
    marginRight: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  surahTitle: {
    fontWeight: 'bold',
    fontSize: 13,
    flex: 1,
  },
  reciterName: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  timeText: {
    fontSize: 11,
    marginTop: 2,
  },
  buttonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seekButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    marginHorizontal: 3,
    borderWidth: 1,
  },
  seekButtonText: {
    fontSize: 11,
    fontWeight: '600',
    marginHorizontal: 2,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
});
