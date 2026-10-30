/**
 * Currency registry (SPEC §11 "Model"): any ISO 4217 code is described on demand from
 * `Intl`, with hand-tuned symbols and tints for EUR, USD, GBP and AED. Pure, no React/DOM.
 */

/** An ISO 4217 code (upper-case); validated against the rates table where it matters. */
export type CurrencyCode = string;

/**
 * Suffix of the `--tint-*` token used for the currency badge background: the four named
 * tints, or one of the six generic `--tint-1` … `--tint-6`.
 */
export type CurrencyTint = 'eur' | 'usd' | 'gbp' | 'aed' | '1' | '2' | '3' | '4' | '5' | '6';

export interface Currency {
  code: CurrencyCode;
  symbol: string;
  /** English name from `Intl.DisplayNames`, e.g. "Swiss Franc"; the code when unknown. */
  name: string;
  /** Minor-unit digits: JPY 0, EUR 2, KWD 3. */
  decimals: number;
  tint: CurrencyTint;
}

/** Shown first in the picker (SPEC §11). */
export const POPULAR: readonly string[] = [
  'EUR',
  'USD',
  'GBP',
  'AED',
  'CHF',
  'JPY',
  'CNY',
  'CAD',
  'AUD',
  'TRY',
  'SAR',
  'INR',
  'SEK',
  'NOK',
  'DKK',
  'PLN',
  'THB',
  'SGD',
  'HKD',
  'ZAR',
];

/** The chosen currencies of a new user. */
export const DEFAULT_CURRENCIES = ['EUR', 'USD'] as const;

/** The fixed four of settings before version 4; migrated users get these. */
export const LEGACY_CURRENCIES = ['EUR', 'USD', 'GBP', 'AED'] as const;

/** Hand-tuned symbol, tint and short name (Chrome's ICU says "United Arab Emirates Dirham"). */
const OVERRIDES: Readonly<Record<string, { symbol: string; tint: CurrencyTint; name: string }>> = {
  EUR: { symbol: '€', tint: 'eur', name: 'Euro' },
  USD: { symbol: '$', tint: 'usd', name: 'US Dollar' },
  GBP: { symbol: '£', tint: 'gbp', name: 'British Pound' },
  AED: { symbol: 'د.إ', tint: 'aed', name: 'UAE Dirham' },
};

const GENERIC_TINTS = ['1', '2', '3', '4', '5', '6'] as const;
const DEFAULT_DECIMALS = 2;
/** Same locale as `NUMBER_LOCALE` in `money.ts` (not imported: money.ts imports this file). */
const SYMBOL_LOCALE = 'nl-NL';

/** Badge tint: the named tint for EUR/USD/GBP/AED, else sum of char codes mod 6 -> `1`…`6`. */
export function tintFor(code: string): CurrencyTint {
  const upper = code.trim().toUpperCase();
  const override = OVERRIDES[upper];
  if (override) return override.tint;
  let sum = 0;
  for (let i = 0; i < upper.length; i++) sum += upper.charCodeAt(i);
  return GENERIC_TINTS[sum % GENERIC_TINTS.length];
}

let displayNames: Intl.DisplayNames | null | undefined;

function englishName(code: string): string {
  try {
    displayNames ??= new Intl.DisplayNames(['en'], { type: 'currency', fallback: 'code' });
    return displayNames.of(code) || code;
  } catch {
    // Malformed codes throw a RangeError; very old engines lack DisplayNames.
    return code;
  }
}

function symbolAndDecimals(code: string): { symbol: string; decimals: number } {
  try {
    const formatter = new Intl.NumberFormat(SYMBOL_LOCALE, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
    });
    const symbol = formatter.formatToParts(1).find((p) => p.type === 'currency')?.value;
    const decimals = formatter.resolvedOptions().maximumFractionDigits;
    return {
      symbol: symbol || code,
      decimals: typeof decimals === 'number' ? decimals : DEFAULT_DECIMALS,
    };
  } catch {
    // Codes that are not well-formed (RangeError) fall back to the code itself.
    return { symbol: code, decimals: DEFAULT_DECIMALS };
  }
}

const cache = new Map<string, Currency>();

/** Describes any currency code (case-insensitive); memoised per upper-case code; never throws. */
export function getCurrency(code: string): Currency {
  const upper = code.trim().toUpperCase();
  const hit = cache.get(upper);
  if (hit) return hit;
  const { symbol, decimals } = symbolAndDecimals(upper);
  const currency: Currency = {
    code: upper,
    symbol: OVERRIDES[upper]?.symbol ?? symbol,
    name: OVERRIDES[upper]?.name ?? englishName(upper),
    decimals,
    tint: tintFor(upper),
  };
  cache.set(upper, currency);
  return currency;
}

/** Sort comparator by English name (`localeCompare('en')`). */
export function compareByName(a: string, b: string): number {
  return getCurrency(a).name.localeCompare(getCurrency(b).name, 'en');
}
