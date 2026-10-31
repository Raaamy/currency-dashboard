/** Pure conversion math and number parsing/formatting (SPEC §5, §7.2, §8). No React, no DOM. */
import { getCurrency, type CurrencyCode } from './currencies';

/** Every number in the UI uses Dutch notation (`1.234,56`); the copy stays English. */
export const NUMBER_LOCALE = 'nl-NL';
/** Dates follow the English copy (`29 Oct, 01:02`). */
export const DATE_LOCALE = 'en-GB';

export const OZ_IN_GRAMS = 31.1034768;

/** Units of each currency per 1 EUR (EUR = 1), keyed by upper-case ISO code. */
export type RateTable = Record<string, number>;

/** Shown wherever a number is missing (no rates, or a code the rates table lacks). */
export const DASH = '—';

/** `NaN` when either rate is missing or not positive (callers render `—`). */
export function convert(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: RateTable,
): number {
  const fromRate = rates[from];
  const toRate = rates[to];
  if (!(fromRate > 0) || !(toRate > 0)) return NaN;
  return (amount / fromRate) * toRate;
}

/**
 * Parses user input such as `1.234,56`, `1,234.56`, `1234.56`, `€ 12,50`.
 * - Spaces, currency symbols and letters are stripped.
 * - Both `,` and `.` present: the last one in the string is the decimal separator, the
 *   other is a thousands separator (the decimal one may then appear only once).
 * - Only one kind, appearing once: a `,` is always the decimal separator (Dutch notation,
 *   matching what the amount input shows: `1,234` = 1.234, `28,805` = 28.805). A `.` is a
 *   thousands separator when it is preceded by 1 to 3 digits with a non-zero value and
 *   followed by exactly 3 digits (`1.234` = 1234, `12.500` = 12500); otherwise the decimal
 *   separator (`0.500` = 0.5, `1234.567` = 1234.567, `1.23` = 1.23). `,500` = 0.5.
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
    const grouped = /^(\d{1,3})\.\d{3}$/.exec(cleaned);
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

/**
 * Amount in any ISO currency; `decimals` defaults to the currency's minor units (JPY 0,
 * KWD 3). Non-finite values (a missing rate) format as `—`.
 */
export function formatMoney(
  value: number,
  code: CurrencyCode,
  opts: { decimals?: number; symbol?: boolean } = {},
): string {
  if (!Number.isFinite(value)) return DASH;
  const decimals = opts.decimals ?? getCurrency(code).decimals;
  const digits = { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
  const plain = () =>
    new Intl.NumberFormat(NUMBER_LOCALE, { style: 'decimal', ...digits }).format(
      noNegativeZero(value),
    );
  if (!(opts.symbol ?? true)) return plain();
  try {
    return new Intl.NumberFormat(NUMBER_LOCALE, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
      ...digits,
    }).format(noNegativeZero(value));
  } catch {
    // Not a well-formed ISO code: show the code before the number instead of throwing.
    return `${code}\u00a0${plain()}`;
  }
}

/**
 * Exchange rate (SPEC §11 "Rates tile"): 4 decimals below 10, 3 below 100, 2 from 100
 * (`1,1162`, `38,215`, `169,42`). Non-finite values format as `—`.
 */
export function formatRate(value: number): string {
  if (!Number.isFinite(value)) return DASH;
  const abs = Math.abs(value);
  const decimals = abs < 10 ? 4 : abs < 100 ? 3 : 2;
  return formatNumber(value, { minDecimals: decimals, maxDecimals: decimals });
}

/** Dutch-notation number; defaults to 0..2 decimals (`maxDecimals` never below `minDecimals`). */
export function formatNumber(
  value: number,
  opts: { minDecimals?: number; maxDecimals?: number } = {},
): string {
  const min = opts.minDecimals ?? 0;
  const max = Math.max(opts.maxDecimals ?? Math.max(min, 2), min);
  return new Intl.NumberFormat(NUMBER_LOCALE, {
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
export function formatQuantity(value: number, kind: 'btc' | 'gram' | 'oz'): string {
  if (value === 0 || !Number.isFinite(value)) return formatNumber(0, { maxDecimals: 0 });
  if (kind === 'btc') {
    const magnitude = Math.floor(Math.log10(Math.abs(value)));
    const decimals = Math.min(8, Math.max(0, 4 - magnitude));
    return formatNumber(value, { minDecimals: 0, maxDecimals: decimals });
  }
  const decimals = kind === 'gram' ? (value < 100 ? 2 : 0) : value < 10 ? 3 : 2;
  return formatNumber(value, { minDecimals: decimals, maxDecimals: decimals });
}

/** e.g. `29 Oct, 02:02` (English, local time, 24 h). */
export function formatTimestamp(ms: number): string {
  const parts = new Intl.DateTimeFormat(DATE_LOCALE, {
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

/** Signed percentage with 1 decimal, Dutch notation and a real minus sign: `−3,1%`, `+3,1%`. */
export function formatPercent(value: number): string {
  return new Intl.NumberFormat(NUMBER_LOCALE, {
    style: 'percent',
    signDisplay: 'exceptZero',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
    .format(noNegativeZero(value) / 100)
    .replace(/-/g, '\u2212');
}

/** Daily snapshot rates: lower-case codes, units per 1 EUR (`eur` = 1 when missing). */
export type SnapshotRates = Record<string, number>;

const snapshotRate = (rates: SnapshotRates, code: string): number | undefined => {
  const key = code.toLowerCase();
  const value = rates[key];
  if (value === undefined && key === 'eur') return 1;
  return value;
};

/**
 * Change in % of "units of `to` per 1 `from`" between two daily snapshots (SPEC §6
 * "Daily change"). Codes are case-insensitive; `null` when a needed rate is missing or
 * not positive.
 */
export function rateChangePct(
  today: SnapshotRates,
  previous: SnapshotRates,
  from: string,
  to: string,
): number | null {
  const values = [
    snapshotRate(today, to),
    snapshotRate(today, from),
    snapshotRate(previous, to),
    snapshotRate(previous, from),
  ];
  if (!values.every((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0)) {
    return null;
  }
  const [todayTo, todayFrom, prevTo, prevFrom] = values;
  return (todayTo / todayFrom / (prevTo / prevFrom) - 1) * 100;
}
