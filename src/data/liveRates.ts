/**
 * Live fiat rates from CoinGecko's exchange_rates (every currency's price of 1 BTC), turned
 * into an EUR table and laid over the daily open.er-api table (SPEC §14).
 */
import { readJSON, writeJSON } from '@/lib/storage';
import type { RateTable } from '@/lib/money';
import { FetchError, fetchJson, isPositiveNumber, isRecord, type FetchLike } from './http';
import { isRates, type Rates } from './rates';

export const LIVE_RATES_URL = 'https://api.coingecko.com/api/v3/exchange_rates';
const STORAGE_KEY = 'liveRates';
const CODE_RE = /^[A-Z]{3}$/;
/** A live rate further than this from the daily one is ignored as a glitch. */
export const MAX_LIVE_DEVIATION = 0.1;

/** CoinGecko gives no timestamp, so `publishedAt` is the fetch time. */
export async function fetchLiveRates(fetchImpl?: FetchLike): Promise<Rates> {
  const body = await fetchJson(LIVE_RATES_URL, { fetchImpl });
  const source = isRecord(body) && isRecord(body.rates) ? body.rates : null;
  const eur = source && isRecord(source.eur) ? source.eur.value : undefined;
  if (!source || !isPositiveNumber(eur)) {
    throw new FetchError('shape', LIVE_RATES_URL, 'Unexpected exchange_rates response');
  }
  const rates: RateTable = { EUR: 1 };
  for (const [key, entry] of Object.entries(source)) {
    const code = key.toUpperCase();
    const fiat = isRecord(entry) && entry.type === 'fiat' ? entry.value : undefined;
    if (code !== 'EUR' && CODE_RE.test(code) && isPositiveNumber(fiat)) rates[code] = fiat / eur;
  }
  if (!isPositiveNumber(rates.USD)) {
    throw new FetchError('shape', LIVE_RATES_URL, 'Unexpected exchange_rates response');
  }
  const now = Date.now();
  return { base: 'EUR', rates, fetchedAt: now, publishedAt: now };
}

export function loadCachedLiveRates(): Rates | null {
  const cached = readJSON<unknown>(STORAGE_KEY, null);
  return isRates(cached) ? cached : null;
}

export function saveLiveRates(r: Rates): void {
  writeJSON(STORAGE_KEY, r);
}

/**
 * The daily table with the live rates laid over it. Live rates count only when they are newer
 * than the daily publication, only for codes the daily table has, and only within
 * MAX_LIVE_DEVIATION of the daily rate. Without a daily table the live one stands alone.
 */
export function mergeRates(daily: Rates | null, live: Rates | null): Rates | null {
  if (!live) return daily;
  if (!daily) return live;
  if (live.publishedAt <= daily.publishedAt) return daily;
  const rates: RateTable = { ...daily.rates };
  for (const [code, rate] of Object.entries(live.rates)) {
    const base = daily.rates[code];
    if (base !== undefined && Math.abs(rate / base - 1) <= MAX_LIVE_DEVIATION) rates[code] = rate;
  }
  return {
    base: 'EUR',
    rates,
    fetchedAt: Math.max(daily.fetchedAt, live.fetchedAt),
    publishedAt: live.publishedAt,
  };
}
