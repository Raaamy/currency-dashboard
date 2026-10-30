/** Fiat rates from open.er-api (EUR base) with a localStorage cache (SPEC §6). */
import type { RateTable } from '@/lib/money';
import { readJSON, writeJSON } from '@/lib/storage';
import {
  errorMessage,
  FetchError,
  fetchJson,
  isPositiveNumber,
  isRecord,
  type FetchLike,
} from './http';

export { FETCH_TIMEOUT_MS } from './http';

export interface Rates {
  base: 'EUR';
  rates: RateTable;
  fetchedAt: number;
  publishedAt: number;
}

export const RATES_URL = 'https://open.er-api.com/v6/latest/EUR';
export const RATES_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const STORAGE_KEY = 'rates';
const CODE_RE = /^[A-Z]{3}$/;

/**
 * Every 3-letter code with a positive number (SPEC §11 "Model"), EUR forced to 1. `null`
 * without USD, which the markets need (asset prices are in USD).
 */
function pickRates(source: Record<string, unknown>): RateTable | null {
  const table: RateTable = { EUR: 1 };
  for (const [code, value] of Object.entries(source)) {
    if (code !== 'EUR' && CODE_RE.test(code) && isPositiveNumber(value)) table[code] = value;
  }
  return isPositiveNumber(table.USD) ? table : null;
}

/** The codes in the rates table (EUR included), alphabetical. */
export function availableCodes(r: Rates): string[] {
  return Object.keys(r.rates).sort();
}

export async function fetchRates(fetchImpl?: FetchLike): Promise<Rates> {
  const body = await fetchJson(RATES_URL, { fetchImpl });
  if (!isRecord(body) || body.result !== 'success' || !isRecord(body.rates)) {
    throw new FetchError('shape', RATES_URL, 'Unexpected rates response');
  }
  const rates = pickRates(body.rates);
  const published = body.time_last_update_unix;
  if (!rates || typeof published !== 'number' || !Number.isFinite(published)) {
    throw new FetchError('shape', RATES_URL, 'Unexpected rates response');
  }
  return { base: 'EUR', rates, fetchedAt: Date.now(), publishedAt: published * 1000 };
}

function isRates(value: unknown): value is Rates {
  if (!isRecord(value) || value.base !== 'EUR' || !isRecord(value.rates)) return false;
  if (typeof value.fetchedAt !== 'number' || typeof value.publishedAt !== 'number') return false;
  // Any number of codes; at least EUR (= 1) and USD.
  const rates = value.rates;
  return (
    rates.EUR === 1 &&
    isPositiveNumber(rates.USD) &&
    Object.entries(rates).every(([code, rate]) => CODE_RE.test(code) && isPositiveNumber(rate))
  );
}

export function loadCachedRates(): Rates | null {
  const cached = readJSON<unknown>(STORAGE_KEY, null);
  return isRates(cached) ? cached : null;
}

export function saveRates(r: Rates): void {
  writeJSON(STORAGE_KEY, r);
}

/** Caches written before user-chosen currencies held only 4 codes: refetch those at once. */
export const MIN_FRESH_CODES = 10;

export function isFresh(r: Rates, now: number = Date.now()): boolean {
  return Object.keys(r.rates).length >= MIN_FRESH_CODES && now - r.fetchedAt < RATES_MAX_AGE_MS;
}

export interface RatesResult {
  /** Best available rates: fresh from the network, else the cached copy, else null. */
  data: Rates | null;
  source: 'network' | 'cache' | 'none';
  /** True when `data` is a cached copy that could not be refreshed. */
  stale: boolean;
  error: string | null;
}

/**
 * Cache-aware load: a fresh cache is returned without fetching (unless `force`); otherwise
 * fetches, saves and returns; on failure falls back to the cached copy (marked stale).
 * `now` is the moment freshness is judged at (pass a later time to refresh a bit early);
 * `cached` overrides the stored copy (the provider passes its in-memory rates).
 */
export async function getRates(
  opts: { fetchImpl?: FetchLike; force?: boolean; now?: number; cached?: Rates | null } = {},
): Promise<RatesResult> {
  const cached = opts.cached !== undefined ? opts.cached : loadCachedRates();
  if (!opts.force && cached && isFresh(cached, opts.now ?? Date.now())) {
    return { data: cached, source: 'cache', stale: false, error: null };
  }
  try {
    const fresh = await fetchRates(opts.fetchImpl);
    saveRates(fresh);
    return { data: fresh, source: 'network', stale: false, error: null };
  } catch (err) {
    return cached
      ? { data: cached, source: 'cache', stale: true, error: errorMessage(err) }
      : { data: null, source: 'none', stale: false, error: errorMessage(err) };
  }
}
