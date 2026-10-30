/** Daily EUR snapshots from fawazahmed0/currency-api for "change since yesterday" (SPEC §6). */
import type { SnapshotRates } from '@/lib/money';
import { readJSON, writeJSON } from '@/lib/storage';
import {
  errorMessage,
  FetchError,
  fetchJson,
  isPositiveNumber,
  isRecord,
  type FetchLike,
} from './http';
import { RATES_MAX_AGE_MS } from './rates';

export interface DailySnapshot {
  /** `YYYY-MM-DD` of the snapshot as reported by the source. */
  date: string;
  /** Lower-case codes, units per 1 EUR, `eur` = 1. */
  rates: SnapshotRates;
}

export interface History {
  today: DailySnapshot;
  previous: DailySnapshot;
  fetchedAt: number;
}

export type SnapshotHost = 'cdn' | 'pages';

const STORAGE_KEY = 'history';
const HOSTS: readonly SnapshotHost[] = ['cdn', 'pages'];
/** Every lower-case 3-letter key: all fiat codes plus xau, xag and btc. */
const SNAPSHOT_KEY_RE = /^[a-z]{3}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** `ref` is `latest` or a `YYYY-MM-DD` date. */
export function snapshotUrl(ref: 'latest' | string, host: SnapshotHost): string {
  return host === 'cdn'
    ? `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${ref}/v1/currencies/eur.min.json`
    : `https://${ref}.currency-api.pages.dev/v1/currencies/eur.min.json`;
}

function parseSnapshot(body: unknown, url: string): DailySnapshot {
  if (!isRecord(body) || typeof body.date !== 'string' || !DATE_RE.test(body.date)) {
    throw new FetchError('shape', url, 'Unexpected snapshot response');
  }
  const source = body.eur;
  if (!isRecord(source)) throw new FetchError('shape', url, 'Unexpected snapshot response');
  const rates: SnapshotRates = { eur: 1 };
  for (const [code, value] of Object.entries(source)) {
    if (code !== 'eur' && SNAPSHOT_KEY_RE.test(code) && isPositiveNumber(value)) {
      rates[code] = value;
    }
  }
  return { date: body.date, rates };
}

/** One snapshot: jsDelivr first, then the pages.dev mirror. Throws the last error. */
export async function fetchSnapshot(
  ref: 'latest' | string,
  fetchImpl?: FetchLike,
): Promise<DailySnapshot> {
  let lastError: unknown = null;
  for (const host of HOSTS) {
    const url = snapshotUrl(ref, host);
    try {
      return parseSnapshot(await fetchJson(url, { fetchImpl }), url);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof FetchError
    ? lastError
    : new FetchError('network', snapshotUrl(ref, 'pages'), errorMessage(lastError));
}

/** The `n` calendar days before `date` (`YYYY-MM-DD`, UTC arithmetic), nearest first. */
export function previousDates(date: string, n = 3): string[] {
  const [y, m, d] = date.split('-').map(Number);
  const start = Date.UTC(y, m - 1, d);
  return Array.from({ length: n }, (_, i) =>
    new Date(start - (i + 1) * DAY_MS).toISOString().slice(0, 10),
  );
}

/** `latest`, then the first available of the 3 days before its date. */
export async function fetchHistory(fetchImpl?: FetchLike): Promise<History> {
  const today = await fetchSnapshot('latest', fetchImpl);
  let lastError: unknown = null;
  for (const date of previousDates(today.date)) {
    try {
      const previous = await fetchSnapshot(date, fetchImpl);
      return { today, previous, fetchedAt: Date.now() };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof FetchError
    ? lastError
    : new FetchError('network', snapshotUrl(today.date, 'cdn'), errorMessage(lastError));
}

function isSnapshot(value: unknown): value is DailySnapshot {
  if (!isRecord(value) || typeof value.date !== 'string' || !DATE_RE.test(value.date)) {
    return false;
  }
  const rates = value.rates;
  return isRecord(rates) && Object.values(rates).every(isPositiveNumber);
}

function isHistory(value: unknown): value is History {
  return (
    isRecord(value) &&
    typeof value.fetchedAt === 'number' &&
    isSnapshot(value.today) &&
    isSnapshot(value.previous)
  );
}

export function loadCachedHistory(): History | null {
  const cached = readJSON<unknown>(STORAGE_KEY, null);
  return isHistory(cached) ? cached : null;
}

export function saveHistory(h: History): void {
  writeJSON(STORAGE_KEY, h);
}

/** Snapshots cached before user-chosen currencies held only six codes: refetch those. */
export const MIN_FRESH_SNAPSHOT_CODES = 10;

export function isHistoryFresh(h: History, now: number = Date.now()): boolean {
  return (
    Object.keys(h.today.rates).length >= MIN_FRESH_SNAPSHOT_CODES &&
    now - h.fetchedAt < RATES_MAX_AGE_MS
  );
}

export interface HistoryResult {
  data: History | null;
  source: 'network' | 'cache' | 'none';
  stale: boolean;
  error: string | null;
}

/** Cache-aware load, same contract as `getRates`. */
export async function getHistory(
  opts: { fetchImpl?: FetchLike; force?: boolean; now?: number; cached?: History | null } = {},
): Promise<HistoryResult> {
  const cached = opts.cached !== undefined ? opts.cached : loadCachedHistory();
  if (!opts.force && cached && isHistoryFresh(cached, opts.now ?? Date.now())) {
    return { data: cached, source: 'cache', stale: false, error: null };
  }
  try {
    const fresh = await fetchHistory(opts.fetchImpl);
    saveHistory(fresh);
    return { data: fresh, source: 'network', stale: false, error: null };
  } catch (err) {
    return cached
      ? { data: cached, source: 'cache', stale: true, error: errorMessage(err) }
      : { data: null, source: 'none', stale: false, error: errorMessage(err) };
  }
}
