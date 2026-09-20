import { PrayerTimings, NextPrayerInfo } from '../types/quran';

const PRAYER_API_URL = 'https://api.aladhan.com/v1/timingsByCity?city=Touba&country=Senegal&method=3';

export const getPrayerTimes = async (): Promise<PrayerTimings> => {
  try {
    const response = await fetch(PRAYER_API_URL);
    if (!response.ok) {
      throw new Error(`Erreur Aladhan API: ${response.status}`);
    }
    const json = await response.json();
    if (json.data && json.data.timings) {
      return json.data.timings;
    }
    throw new Error('Données Aladhan invalides');
  } catch (error) {
    console.error('Erreur getPrayerTimes:', error);
    // Horaires par défaut fiables pour Touba Sénégal
    return {
      Fajr: '05:28',
      Sunrise: '06:45',
      Dhuhr: '13:12',
      Asr: '16:32',
      Sunset: '19:40',
      Maghrib: '19:40',
      Isha: '20:50',
    };
  }
};

export const calculateNextPrayer = (timings: PrayerTimings): NextPrayerInfo => {
  const now = new Date();
  const prayerKeys: Array<{ key: keyof PrayerTimings; name: string }> = [
    { key: 'Fajr', name: 'Fajr (الفجر)' },
    { key: 'Dhuhr', name: 'Dhuhr (الظهر)' },
    { key: 'Asr', name: 'Asr (العصر)' },
    { key: 'Maghrib', name: 'Maghrib (المغرب)' },
    { key: 'Isha', name: 'Isha (العشاء)' },
  ];

  for (const item of prayerKeys) {
    let timeStr = timings[item.key];
    if (!timeStr) continue;

    // Nettoyer la chaîne pour supprimer les éventuels suffixes d'heure
    timeStr = timeStr.split(' ')[0];

    const [hoursStr, minutesStr] = timeStr.split(':');
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);

    if (isNaN(hours) || isNaN(minutes)) continue;

    const prayerDate = new Date();
    prayerDate.setHours(hours, minutes, 0, 0);

    if (prayerDate.getTime() > now.getTime()) {
      const remainingMs = prayerDate.getTime() - now.getTime();
      return {
        name: item.name,
        time: timeStr,
        remainingMs,
        formattedRemaining: formatRemainingTime(remainingMs),
      };
    }
  }

  // Si toutes les prières d'aujourd'hui sont passées, la prochaine est Fajr de demain
  let fajrStr = timings.Fajr || '05:28';
  fajrStr = fajrStr.split(' ')[0];
  const [fHoursStr, fMinutesStr] = fajrStr.split(':');
  const fHours = parseInt(fHoursStr, 10) || 5;
  const fMinutes = parseInt(fMinutesStr, 10) || 28;

  const tomorrowFajr = new Date();
  tomorrowFajr.setDate(tomorrowFajr.getDate() + 1);
  tomorrowFajr.setHours(fHours, fMinutes, 0, 0);

  const remainingMs = tomorrowFajr.getTime() - now.getTime();
  return {
    name: 'Fajr (الفجر)',
    time: fajrStr,
    remainingMs,
    formattedRemaining: formatRemainingTime(remainingMs),
  };
};

export const formatRemainingTime = (ms: number): string => {
  if (ms <= 0) return '00h 00m 00s';
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
};
