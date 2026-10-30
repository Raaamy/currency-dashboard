/** Pure language helpers (no React), shared by `lib/money.ts` and the i18n hook. */
export type Language = 'nl' | 'en';

export const LANGUAGES: readonly Language[] = ['nl', 'en'];

export const localeFor = (l: Language): string => (l === 'nl' ? 'nl-NL' : 'en-GB');

export const isLanguage = (value: unknown): value is Language => value === 'nl' || value === 'en';

/**
 * Default language for a first visit: always `en`, whatever the browser language
 * (Dutch is opt-in from Settings). Kept as a function so callers stay unchanged.
 */
export const detectLanguage = (): Language => 'en';
