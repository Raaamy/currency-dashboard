/** Pure language helpers (no React), shared by `lib/money.ts` and the i18n hook. */
export type Language = 'nl' | 'en';

export const LANGUAGES: readonly Language[] = ['nl', 'en'];

export const localeFor = (l: Language): string => (l === 'nl' ? 'nl-NL' : 'en-GB');

export const isLanguage = (value: unknown): value is Language => value === 'nl' || value === 'en';

/** `nl` when the browser language starts with `nl`, otherwise `en`. Safe without `navigator`. */
export const detectLanguage = (): Language => {
  if (typeof navigator === 'undefined' || typeof navigator.language !== 'string') return 'en';
  return navigator.language.toLowerCase().startsWith('nl') ? 'nl' : 'en';
};
