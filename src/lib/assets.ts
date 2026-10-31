/**
 * Items model (SPEC §13): an item is a fiat code (`EUR`, `USD`, …) or an asset id (`XAU`
 * Gold, `XAG` Silver, `BTC` Bitcoin). Descriptors, value per unit in EUR, conversion, decimals,
 * labels, the rate line and its daily change. Pure, no React/DOM.
 */
import { getCurrency, type CurrencyTint } from './currencies';
import { formatAmountInput } from './amountInput';
import { convert, DASH, formatNumber, formatPercent, OZ_IN_GRAMS, rateChangePct } from './money';

/** Unit the metals are shown and typed in (`settings.metalUnit`). */
export type MetalUnit = 'g' | 'oz' | 'kg';

export const METAL_UNITS: readonly MetalUnit[] = ['g', 'oz', 'kg'];

/** Grams in one unit; the metal quotes are per troy ounce. */
export const GRAMS_PER_UNIT: Record<MetalUnit, number> = {
  g: 1,
  oz: OZ_IN_GRAMS,
  kg: 1000,
};

export type ItemKind = 'fiat' | 'metal' | 'crypto';

export const ASSET_IDS = ['XAU', 'XAG', 'BTC'] as const;

export type AssetId = (typeof ASSET_IDS)[number];

/** The list of a new user (SPEC §13 "Items model"). */
export const DEFAULT_ITEMS: readonly string[] = ['EUR', 'USD', 'XAU', 'XAG', 'BTC'];

/** Badge tint suffix (`--tint-*`): the currency tints plus the three asset tints. */
export type ItemTint = CurrencyTint | 'gold' | 'silver' | 'btc';

export interface ItemInfo {
  /** Upper-case code: an ISO 4217 code or `XAU` / `XAG` / `BTC`. */
  code: string;
  kind: ItemKind;
  /** English name: "Gold", "Bitcoin", or the currency name from the registry. */
  name: string;
  /** Badge glyph; empty for the plain metallic metal badges. */
  symbol: string;
  tint: ItemTint;
}

/** Prices the conversion needs: the EUR rate table and the USD asset quotes. */
export interface PriceInputs {
  /** Units of each currency per 1 EUR (EUR = 1); `null` before the first load. */
  rates: Record<string, number> | null;
  /** USD prices; per troy ounce for the metals. */
  quotes: Partial<Record<AssetId, { priceUsd: number }>>;
}

const ASSETS: Readonly<Record<AssetId, Omit<ItemInfo, 'code'>>> = {
  XAU: { kind: 'metal', name: 'Gold', symbol: '', tint: 'gold' },
  XAG: { kind: 'metal', name: 'Silver', symbol: '', tint: 'silver' },
  BTC: { kind: 'crypto', name: 'Bitcoin', symbol: '₿', tint: 'btc' },
};

const upper = (code: string): string => code.trim().toUpperCase();

const assetOf = (code: string): AssetId | null => {
  const c = upper(code);
  return (ASSET_IDS as readonly string[]).includes(c) ? (c as AssetId) : null;
};

/** `XAU`, `XAG` or `BTC` (case-insensitive). */
export function isAsset(code: string): boolean {
  return assetOf(code) !== null;
}

const isMetal = (code: string): boolean => {
  const asset = assetOf(code);
  return asset !== null && ASSETS[asset].kind === 'metal';
};

/** Describes any item (case-insensitive); fiat codes come from `getCurrency`. Never throws. */
export function getItem(code: string): ItemInfo {
  const asset = assetOf(code);
  if (asset) return { code: asset, ...ASSETS[asset] };
  const { code: c, name, symbol, tint } = getCurrency(code);
  return { code: c, kind: 'fiat', name, symbol, tint };
}

/**
 * Value of one unit of an item in EUR (SPEC §13): fiat `1 / rates[code]`; BTC its USD price in
 * EUR; metals the USD price per troy ounce in EUR per gram times the grams per `unit`. `NaN`
 * when a rate or quote is missing or not positive.
 */
export function eurPer(code: string, unit: MetalUnit, p: PriceInputs): number {
  const rates = p.rates;
  if (!rates) return NaN;
  const asset = assetOf(code);
  if (!asset) {
    const rate = rates[upper(code)];
    return rate > 0 ? 1 / rate : NaN;
  }
  const priceUsd = p.quotes[asset]?.priceUsd;
  if (typeof priceUsd !== 'number' || !(priceUsd > 0)) return NaN;
  const eur = convert(priceUsd, 'USD', 'EUR', rates);
  if (asset === 'BTC') return eur;
  const grams = GRAMS_PER_UNIT[unit];
  return grams > 0 ? (eur / OZ_IN_GRAMS) * grams : NaN;
}

/** `amount` of `from` expressed in `to` (`amount * eurPer(from) / eurPer(to)`); `NaN` without data. */
export function convertItem(
  amount: number,
  from: string,
  to: string,
  unit: MetalUnit,
  p: PriceInputs,
): number {
  return (amount * eurPer(from, unit, p)) / eurPer(to, unit, p);
}

/**
 * Decimals of a converted amount (SPEC §13): fiat the currency decimals (JPY 0); BTC 6 below 1,
 * else 4; metals `g` 2 below 100 else 0, `oz` 2, `kg` 3.
 */
export function displayDecimals(code: string, unit: MetalUnit, value: number): number {
  const asset = assetOf(code);
  if (!asset) return getCurrency(code).decimals;
  const abs = Math.abs(value);
  if (asset === 'BTC') return abs < 1 ? 6 : 4;
  if (unit === 'g') return abs < 100 ? 2 : 0;
  return unit === 'oz' ? 2 : 3;
}

/** Decimals the amount input accepts for a base (SPEC §13): fiat its decimals, BTC 8, g 2, oz/kg 3. */
export function inputDecimals(code: string, unit: MetalUnit): number {
  const asset = assetOf(code);
  if (!asset) return getCurrency(code).decimals;
  if (asset === 'BTC') return 8;
  return unit === 'g' ? 2 : 3;
}

/** Unit after an amount: the fiat code, the metal unit (`g` / `oz` / `kg`), or `BTC`. */
export function unitLabel(code: string, unit: MetalUnit): string {
  return isMetal(code) ? unit : upper(code);
}

/** Item name in the rate line (`L(x)`): the fiat code, `g gold` / `oz silver`, or `BTC`. */
export function rateLabel(code: string, unit: MetalUnit): string {
  return isMetal(code) ? `${unit} ${getItem(code).name.toLowerCase()}` : upper(code);
}

/** Rate decimals (SPEC §13): 0 from 10.000, 2 from 10, 4 from 0,01, else 6. */
export function rateDecimals(r: number): number {
  const abs = Math.abs(r);
  if (abs >= 10_000) return 0;
  if (abs >= 10) return 2;
  if (abs >= 0.01) return 4;
  return 6;
}

export interface RateLine {
  /** The item on the left (`1 {from}`). */
  from: string;
  /** The item the rate is expressed in. */
  to: string;
  /** Units of `to` per 1 `from` (per metal unit); `NaN` without data. */
  rate: number;
  /** e.g. `1 EUR = 1,1162 USD`, `1 g gold = 115,79 EUR`; `—` for the number without data. */
  text: string;
}

/**
 * Rate line of a result (SPEC §13): a fiat target reads `1 {base} = r {target}`, an asset
 * target reads `1 {target} = r {base}`. nl-NL numbers with `rateDecimals`.
 */
export function rateLine(base: string, target: string, unit: MetalUnit, p: PriceInputs): RateLine {
  const [from, to] = isAsset(target) ? [upper(target), upper(base)] : [upper(base), upper(target)];
  const rate = eurPer(from, unit, p) / eurPer(to, unit, p);
  const d = rateDecimals(rate);
  const value = Number.isFinite(rate)
    ? formatNumber(rate, { minDecimals: d, maxDecimals: d })
    : DASH;
  return { from, to, rate, text: `1 ${rateLabel(from, unit)} = ${value} ${rateLabel(to, unit)}` };
}

/**
 * Daily change in % of "units of `to` per 1 `from`" between two snapshots (use the rate line's
 * from/to). The snapshots hold units per EUR for every key, `xau`/`xag`/`btc` included, so the
 * metal unit does not matter. `null` when a needed rate is missing.
 */
export function itemChangePct(
  from: string,
  to: string,
  today: Record<string, number>,
  previous: Record<string, number>,
): number | null {
  return rateChangePct(today, previous, from.trim().toLowerCase(), to.trim().toLowerCase());
}

/** Converted amount without unit, nl-NL with `displayDecimals`; `—` when not finite. */
export function formatItemAmount(value: number, code: string, unit: MetalUnit): string {
  if (!Number.isFinite(value)) return DASH;
  const d = displayDecimals(code, unit, value);
  return formatNumber(value, { minDecimals: d, maxDecimals: d });
}

/**
 * Amount text for the input when a result becomes the base (SPEC §13 "tap to convert"): the
 * value in nl-NL with the new base's `inputDecimals` (fixed), run through `formatAmountInput`
 * so it is exactly what typing it would give. Empty when the value is not finite.
 */
export function amountTextFor(value: number, code: string, unit: MetalUnit): string {
  if (!Number.isFinite(value)) return '';
  const d = inputDecimals(code, unit);
  const text = formatNumber(Math.abs(value), { minDecimals: d, maxDecimals: d });
  return formatAmountInput(text, text.length, d).text;
}

export interface ItemTitles {
  /** Bold line: the code for fiat, the name for assets (`USD`, `Gold`). */
  title: string;
  /** Second line: the name for fiat, the code for assets (`US Dollar`, `XAU`). */
  subtitle: string;
}

/** Title and subtitle of an item (SPEC §13): fiat code over name, assets name over code. */
export function itemTitles(code: string): ItemTitles {
  const item = getItem(code);
  return item.kind === 'fiat'
    ? { title: item.code, subtitle: item.name }
    : { title: item.name, subtitle: item.code };
}

export type ChangeVariant = 'up' | 'down' | 'neutral';

/**
 * Change badge (SPEC §13): the % rounded to 1 decimal, `0,0%` neutral, > 0 up, < 0 down; the
 * text from `formatPercent` of the rounded value (`+1,2%`, `−0,9%`).
 */
export function changeBadge(pct: number): { text: string; variant: ChangeVariant } {
  const r = Math.round(pct * 10) / 10;
  const variant: ChangeVariant = r > 0 ? 'up' : r < 0 ? 'down' : 'neutral';
  return { text: formatPercent(r), variant };
}
