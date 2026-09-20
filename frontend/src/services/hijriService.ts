/**
 * Service de formatage des dates Hégirienne et Grégorienne
 */

const HIJRI_MONTHS_FR = [
  'Muharram',
  'Safar',
  'Rabi al-Awwal',
  'Rabi al-Thani',
  'Jumada al-Awwal',
  'Jumada al-Thani',
  'Rajab',
  'Sha\'ban',
  'Ramadan',
  'Shawwal',
  'Dhu al-Qi\'dah',
  'Dhu al-Hijjah',
];

const HIJRI_MONTHS_AR = [
  'محرم',
  'صفر',
  'ربيع الأول',
  'ربيع الثاني',
  'جمادى الأولى',
  'جمادى الآخرة',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذو القعدة',
  'ذو الحجة',
];

export interface FormattedDateInfo {
  gregorianFormatted: string;
  hijriFormatted: string;
  hijriArabicFormatted: string;
  basmalaText: string;
}

interface HijriDate {
  day: number;
  month: number; // 1 = Muharram ... 12 = Dhu al-Hijjah
  year: number;
}

/**
 * Convertit une date grégorienne en nombre de jour julien (JDN).
 */
const gregorianToJulianDay = (year: number, month: number, day: number): number => {
  const a = Math.floor((month - 14) / 12);
  return (
    Math.floor((1461 * (year + 4800 + a)) / 4) +
    Math.floor((367 * (month - 2 - 12 * a)) / 12) -
    Math.floor((3 * Math.floor((year + 4900 + a) / 100)) / 4) +
    day -
    32075
  );
};

/**
 * Convertit un nombre de jour julien en date du calendrier hégirien tabulaire
 * (algorithme dit "koweïtien", couramment utilisé comme approximation civile
 * du calendrier islamique en l'absence d'annonce officielle d'observation lunaire).
 */
const julianDayToHijri = (jd: number): HijriDate => {
  let l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j =
    Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) +
    Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l =
    l -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;
  const month = Math.floor((24 * l) / 709);
  const day = l - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return { day, month, year };
};

/**
 * Calcule la date hégirienne correspondant à une date donnée (par défaut aujourd'hui).
 * Approximation civile (tabulaire) : peut différer d'un jour de l'annonce officielle
 * basée sur l'observation locale de la lune.
 */
export const gregorianToHijriDate = (date: Date = new Date()): HijriDate => {
  const jd = gregorianToJulianDay(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return julianDayToHijri(jd);
};

export const getTodayFormattedDates = (): FormattedDateInfo => {
  const today = new Date();

  // Date grégorienne en français
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  };
  const gregorianStr = today.toLocaleDateString('fr-FR', options);
  const gregorianCapitalized = gregorianStr.charAt(0).toUpperCase() + gregorianStr.slice(1);

  // Date hégirienne calculée dynamiquement pour aujourd'hui
  const hijri = gregorianToHijriDate(today);
  const hijriMonthIndex = hijri.month - 1;

  const hijriFr = `${hijri.day} ${HIJRI_MONTHS_FR[hijriMonthIndex]} ${hijri.year} AH`;
  const hijriAr = `${hijri.day} ${HIJRI_MONTHS_AR[hijriMonthIndex]} ${hijri.year} هـ`;

  return {
    gregorianFormatted: gregorianCapitalized,
    hijriFormatted: hijriFr,
    hijriArabicFormatted: hijriAr,
    basmalaText: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
  };
};
