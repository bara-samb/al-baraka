export interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: 'Meccan' | 'Medinan';
}

export interface Ayah {
  number: number;
  text: string;
  translation?: string;
  numberInSurah: number;
  juz: number;
  manzil: number;
  page: number;
  ruku: number;
  hizbQuarter: number;
  sajda: boolean | object;
}

export interface SurahDetail extends Surah {
  ayahs: Ayah[];
}

export interface ApiResponse<T> {
  code: number;
  status: string;
  data: T;
}

export interface SearchOccurrenceItem {
  surahNumber: number;
  surahName: string;
  englishName: string;
  numberInSurah: number;
  text: string;
  translation?: string;
}

export interface SearchOccurrenceStats {
  query: string;
  totalOccurrences: number;
  totalSurahs: number;
  results: SearchOccurrenceItem[];
}

export type TranslationLanguage = 'fr' | 'en' | 'none';


