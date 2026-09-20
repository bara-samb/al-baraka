import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  Modal,
  GestureResponderEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import {
  subscribeAudioStatus,
  subscribeTrackFinish,
  togglePlayPause,
  seekBy,
  seekToPosition,
  setPlaybackRate,
  setIsLoopingTrack,
  SoundStatus,
} from '../services/audioService';

const reciterPhoto = require('../assets/serigne_abdou_bara.jpg');

export type RepeatMode = 'off' | 'one' | 'all';

interface FullAudioPlayerProps {
  visible: boolean;
  surahNumber: number;
  surahName: string;
  englishName: string;
  repeatMode?: RepeatMode;
  isShuffle?: boolean;
  onClose: () => void;
  onNextTrack?: () => void;
  onPrevTrack?: () => void;
  onToggleRepeat?: () => void;
  onToggleShuffle?: () => void;
}

const SPEED_OPTIONS = [0.5, 1.0, 1.25, 1.5, 2.0];

export const FullAudioPlayer: React.FC<FullAudioPlayerProps> = ({
  visible,
  surahNumber,
  surahName,
  englishName,
  repeatMode = 'off',
  isShuffle = false,
  onClose,
  onNextTrack,
  onPrevTrack,
  onToggleRepeat,
  onToggleShuffle,
}) => {
  const { colors } = useTheme();
  const [status, setStatus] = useState<SoundStatus>({
    isPlaying: false,
    position: 0,
    duration: 0,
    isLoaded: false,
  });
  const [currentSpeedIndex, setCurrentSpeedIndex] = useState<number>(1); // 1.0x par défaut

  useEffect(() => {
    const unsubscribeStatus = subscribeAudioStatus((s) => {
      setStatus(s);
    });
    const unsubscribeFinish = subscribeTrackFinish(() => {
      if (repeatMode !== 'one' && onNextTrack) {
        onNextTrack();
      }
    });

    return () => {
      unsubscribeStatus();
      unsubscribeFinish();
    };
  }, [repeatMode, onNextTrack]);

  useEffect(() => {
    setIsLoopingTrack(repeatMode === 'one');
  }, [repeatMode]);

  const handleToggleSpeed = () => {
    const nextIdx = (currentSpeedIndex + 1) % SPEED_OPTIONS.length;
    setCurrentSpeedIndex(nextIdx);
    const speed = SPEED_OPTIONS[nextIdx];
    setPlaybackRate(speed);
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSeekBarPress = (evt: GestureResponderEvent) => {
    const touchX = evt.nativeEvent.locationX;
    const barWidth = Dimensions.get('window').width - 48; // padding 24px each side
    if (status.duration > 0 && barWidth > 0) {
      const ratio = Math.max(0, Math.min(1, touchX / barWidth));
      const targetSec = ratio * status.duration;
      seekToPosition(targetSec);
    }
  };

  const progressPercent = status.duration > 0 ? (status.position / status.duration) * 100 : 0;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.downBtn}>
            <Ionicons name="chevron-down" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={[styles.headerSub, { color: colors.gold }]}>SERIGNE ABOUL BARAKA MBACKÉ</Text>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Sourate N°{surahNumber}</Text>
          </View>
          <TouchableOpacity style={styles.menuBtn} onPress={onToggleSpeedPress}>
            <Text style={[styles.speedTextHeader, { color: colors.gold }]}>{SPEED_OPTIONS[currentSpeedIndex]}x</Text>
          </TouchableOpacity>
        </View>

        {/* Photo de Serigne Aboul Baraka Mbacké encadrée */}
        <View style={styles.artworkContainer}>
          <View style={[styles.artworkFrame, { borderColor: colors.gold }]}>
            <Image source={reciterPhoto} style={styles.artistPhoto} resizeMode="cover" />
            {/* Overlay badge avec le nom arabe de la sourate */}
            <View style={styles.arabicBadgeOverlay}>
              <Text style={styles.artworkArabicText}>{surahName}</Text>
            </View>
          </View>
        </View>

        {/* Info Piste */}
        <View style={styles.trackInfo}>
          <Text style={[styles.surahTitleText, { color: colors.textPrimary }]}>{englishName}</Text>
          <Text style={[styles.reciterText, { color: colors.gold }]}>Serigne Aboul Baraka Mbacké (Warsh)</Text>

        </View>

        {/* SeekBar / Barre de progression interactive */}
        <View style={styles.progressContainer}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={handleSeekBarPress}
            style={styles.progressBarTouchArea}
          >
            <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%`, backgroundColor: colors.gold }]} />
              <View style={[styles.progressKnob, { left: `${progressPercent}%`, backgroundColor: colors.gold }]} />
            </View>
          </TouchableOpacity>
          <View style={styles.timeRow}>
            <Text style={[styles.timeText, { color: colors.textSecondary }]}>{formatTime(status.position)}</Text>
            <Text style={[styles.timeText, { color: colors.textSecondary }]}>{formatTime(status.duration)}</Text>
          </View>
        </View>

        {/* Controls de lecture complets */}
        <View style={styles.controlsRow}>
          {/* Bouton Répétition (En boucle / Répéter 1 / Répéter Tout) */}
          <TouchableOpacity onPress={onToggleRepeat} style={styles.optionBtn}>
            <Ionicons
              name={repeatMode === 'off' ? 'repeat-outline' : 'repeat'}
              size={24}
              color={repeatMode !== 'off' ? colors.gold : colors.textSecondary}
            />
            {repeatMode === 'one' && (
              <View style={[styles.modeBadge, { backgroundColor: colors.gold }]}>
                <Text style={styles.modeBadgeText}>1</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Bouton Précédent (Sourate précédente) */}
          <TouchableOpacity onPress={onPrevTrack} style={styles.navBtn}>
            <Ionicons name="play-skip-back" size={26} color={colors.textPrimary} />
          </TouchableOpacity>

          {/* Reculer -10s */}
          <TouchableOpacity onPress={() => seekBy(-10)} style={styles.skipBtn}>
            <Ionicons name="refresh-circle-outline" size={24} color={colors.textSecondary} />
            <Text style={[styles.skipText, { color: colors.textSecondary }]}>-10s</Text>
          </TouchableOpacity>

          {/* Bouton Principal Play / Pause */}
          <TouchableOpacity
            style={[styles.mainPlayBtn, { backgroundColor: colors.gold }]}
            onPress={togglePlayPause}
            activeOpacity={0.85}
          >
            <Ionicons
              name={status.isPlaying ? 'pause' : 'play'}
              size={36}
              color="#0F172A"
              style={{ marginLeft: status.isPlaying ? 0 : 3 }}
            />
          </TouchableOpacity>

          {/* Avancer +10s */}
          <TouchableOpacity onPress={() => seekBy(10)} style={styles.skipBtn}>
            <Ionicons name="time-outline" size={24} color={colors.textSecondary} />
            <Text style={[styles.skipText, { color: colors.textSecondary }]}>+10s</Text>
          </TouchableOpacity>

          {/* Bouton Suivant (Sourate suivante) */}
          <TouchableOpacity onPress={onNextTrack} style={styles.navBtn}>
            <Ionicons name="play-skip-forward" size={26} color={colors.textPrimary} />
          </TouchableOpacity>

          {/* Bouton Aléatoire (Shuffle) */}
          <TouchableOpacity onPress={onToggleShuffle} style={styles.optionBtn}>
            <Ionicons
              name={isShuffle ? 'shuffle' : 'shuffle-outline'}
              size={24}
              color={isShuffle ? colors.gold : colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Footer info / Qualité audio */}
        <View style={styles.footerNote}>
          <Ionicons name="wifi" size={14} color={colors.emerald} style={{ marginRight: 6 }} />
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            Récitation HD • Riwaya Warsh 'an Nafi'
          </Text>
        </View>
      </View>
    </Modal>
  );

  function onToggleSpeedPress() {
    handleToggleSpeed();
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 45,
    paddingBottom: 25,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  downBtn: {
    padding: 6,
  },
  headerTitles: {
    alignItems: 'center',
  },
  headerSub: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 2,
  },
  menuBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
  },
  speedTextHeader: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  artworkContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
  },
  artworkFrame: {
    width: Dimensions.get('window').width * 0.72,
    height: Dimensions.get('window').width * 0.72,
    borderRadius: (Dimensions.get('window').width * 0.72) / 2,
    borderWidth: 3.5,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
    position: 'relative',
  },
  artistPhoto: {
    width: '100%',
    height: '100%',
  },
  arabicBadgeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingVertical: 8,
    alignItems: 'center',
  },
  artworkArabicText: {
    color: '#D4AF37',
    fontSize: 22,
    fontWeight: 'bold',
  },
  trackInfo: {
    alignItems: 'center',
    marginBottom: 6,
  },
  surahTitleText: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  reciterText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  progressContainer: {
    marginVertical: 10,
  },
  progressBarTouchArea: {
    paddingVertical: 8,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    position: 'relative',
    justifyContent: 'center',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressKnob: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    top: -4,
    marginLeft: -7,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: {
    fontSize: 12,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
    paddingHorizontal: 4,
  },
  optionBtn: {
    padding: 8,
    position: 'relative',
  },
  modeBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeBadgeText: {
    color: '#0F172A',
    fontSize: 8,
    fontWeight: 'bold',
  },
  navBtn: {
    padding: 8,
  },
  skipBtn: {
    alignItems: 'center',
    padding: 6,
  },
  skipText: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2,
  },
  mainPlayBtn: {
    width: 66,
    height: 66,
    borderRadius: 33,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  footerNote: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  footerText: {
    fontSize: 12,
  },
});
