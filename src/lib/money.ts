/** Pure conversion math and number parsing/formatting (SPEC §5, §7.2, §8). No React, no DOM. */
import { localeFor, type Language } from '@/i18n/locale';
import type { CurrencyCode } from './currencies';

export const OZ_IN_GRAMS = 31.1034768;

/** Units of each currency per 1 EUR (EUR = 1). */
export type RateTable = Record<CurrencyCode, number>;

export function convert(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: RateTable,
): number {
  return (amount / rates[from]) * rates[to];
}

/**
 * Parses user input such as `1.234,56`, `1,234.56`, `1234.56`, `€ 12,50`.
 * - Spaces, currency symbols and letters are stripped.
 * - Both `,` and `.` present: the last one in the string is the decimal separator, the
 *   other is a thousands separator (the decimal one may then appear only once).
 * - Only one kind, appearing once: a thousands separator when it is preceded by 1 to 3
 *   digits with a non-zero value and followed by exactly 3 digits (`1.234` = 1234,
 *   `1,234` = 1234, `12.500` = 12500, `999,000` = 999000); otherwise the decimal
 *   separator (`1,5` = 1.5, `0.500` = 0.5, `1234.567` = 1234.567, `1,2345` = 1.2345,
 *   `,500` = 0.5). Nobody types three decimals into a currency amount.
 * - Only one kind, appearing more than once: thousands separator (`1.234.567` = 1234567).
 * - Trailing (`12,`) and leading (`,5`) separators are allowed.
 * Returns `null` for empty, non-numeric or negative input.
 */
export function parseAmount(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  if (/[-\u2212]/.test(trimmed)) return null;
  const cleaned = trimmed.replace(/[^\d.,]/g, '');
  if (!/\d/.test(cleaned)) return null;

  const commas = cleaned.split(',').length - 1;
  const dots = cleaned.split('.').length - 1;
  let normalised: string;
  if (commas > 0 && dots > 0) {
    const decimal = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.') ? ',' : '.';
    const thousands = decimal === ',' ? '.' : ',';
    if ((decimal === ',' ? commas : dots) > 1) return null;
    normalised = cleaned.split(thousands).join('').replace(decimal, '.');
  } else if (commas + dots === 1) {
    const grouped = /^(\d{1,3})[.,]\d{3}$/.exec(cleaned);
    normalised =
      grouped && Number(grouped[1]) !== 0 ? cleaned.replace(/[.,]/, '') : cleaned.replace(',', '.');
  } else {
    normalised = cleaned.replace(/[.,]/g, '');
  }

  if (!/^\d*\.?\d*$/.test(normalised)) return null;
  const value = Number(normalised);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** Rounds half away from zero to `decimals` places, robust to binary artefacts (1.005 -> 1.01). */
export function roundTo(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** decimals;
  const rounded =
    (Math.sign(value) * Math.round(Math.abs(value) * factor * (1 + Number.EPSILON))) / factor;
  return rounded === 0 ? 0 : rounded;
}

const noNegativeZero = (value: number): number => (value === 0 ? 0 : value);

export function formatMoney(
  value: number,
  code: CurrencyCode,
  language: Language,
  opts: { decimals?: number; symbol?: boolean } = {},
): string {
  const decimals = opts.decimals ?? 2;
  const symbol = opts.symbol ?? true;
  return new Intl.NumberFormat(localeFor(language), {
    ...(symbol ? { style: 'currency', currency: code } : { style: 'decimal' }),
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(noNegativeZero(value));
}

/** Locale number; defaults to 0..2 decimals (`maxDecimals` never below `minDecimals`). */
export function formatNumber(
  value: number,
  language: Language,
  opts: { minDecimals?: number; maxDecimals?: number } = {},
): string {
  const min = opts.minDecimals ?? 0;
  const max = Math.max(opts.maxDecimals ?? Math.max(min, 2), min);
  return new Intl.NumberFormat(localeFor(language), {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  }).format(noNegativeZero(value));
}

export const ozToGram = (oz: number): number => oz * OZ_IN_GRAMS;
export const gramToOz = (g: number): number => g / OZ_IN_GRAMS;

/** How many units of an asset priced `priceUsd` the `amount` in `base` buys (BTC or troy oz). */
export function quantityFor(
  amount: number,
  base: CurrencyCode,
  priceUsd: number,
  rates: RateTable,
): number {
  if (!(priceUsd > 0)) return 0;
  return convert(amount, base, 'USD', rates) / priceUsd;
}

/**
 * Quantity number only, no unit suffix (SPEC §8 "Markets section"):
 * - btc: up to 5 significant digits, max 8 decimals, trailing zeros stripped.
 * - gram: 2 decimals below 100, else 0.  oz: 3 decimals below 10, else 2.
 * - zero is always `0`.
 */
export function formatQuantity(
  value: number,
  kind: 'btc' | 'gram' | 'oz',
  language: Language,
): string {
  if (value === 0 || !Number.isFinite(value)) return formatNumber(0, language, { maxDecimals: 0 });
  if (kind === 'btc') {
    const magnitude = Math.floor(Math.log10(Math.abs(value)));
    const decimals = Math.min(8, Math.max(0, 4 - magnitude));
    return formatNumber(value, language, { minDecimals: 0, maxDecimals: decimals });
  }
  const decimals = kind === 'gram' ? (value < 100 ? 2 : 0) : value < 10 ? 3 : 2;
  return formatNumber(value, language, { minDecimals: decimals, maxDecimals: decimals });
}

/** e.g. nl `29 okt, 02:02`, en `29 Oct, 02:02` (local time, 24 h). */
export function formatTimestamp(ms: number, language: Language): string {
  const parts = new Intl.DateTimeFormat(localeFor(language), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(ms));
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';
  const month = part('month').replace(/\.$/, '');
  return `${part('day')} ${month}, ${part('hour')}:${part('minute')}`;
}

/** Signed percentage with 1 decimal, real minus sign: nl `−3,1%`-style, en `+3.1%`. */
export function formatPercent(value: number, language: Language): string {
  return new Intl.NumberFormat(localeFor(language), {
    style: 'percent',
    signDisplay: 'exceptZero',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
    .format(noNegativeZero(value) / 100)
    .replace(/-/g, '\u2212');
}
