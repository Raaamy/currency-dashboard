/** Bitcoin (CoinGecko -> Coinbase fallback) and gold/silver (gold-api) quotes in USD (SPEC §6). */
import { readJSON, writeJSON } from '@/lib/storage';
import { FetchError, fetchJson, isPositiveNumber, isRecord, type FetchLike } from './http';

export type AssetId = 'BTC' | 'XAU' | 'XAG';

export interface MarketQuote {
  id: AssetId;
  /** USD; per troy ounce for the metals. */
  priceUsd: number;
  /** Only BTC from CoinGecko has it. */
  change24hPct?: number;
  updatedAt: number;
}

export type Quotes = Record<AssetId, MarketQuote>;

export const ASSET_IDS: readonly AssetId[] = ['BTC', 'XAU', 'XAG'];
export const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true';
export const COINBASE_URL = 'https://api.coinbase.com/v2/prices/BTC-USD/spot';
export const goldApiUrl = (symbol: 'XAU' | 'XAG'): string =>
  `https://api.gold-api.com/price/${symbol}`;
export const MARKETS_POLL_MS = 60_000;
const STORAGE_KEY = 'markets';

async function fetchCoinGecko(fetchImpl?: FetchLike): Promise<MarketQuote> {
  const body = await fetchJson(COINGECKO_URL, { fetchImpl });
  const btc = isRecord(body) ? body.bitcoin : undefined;
  if (!isRecord(btc) || !isPositiveNumber(btc.usd)) {
    throw new FetchError('shape', COINGECKO_URL, 'Unexpected CoinGecko response');
  }
  const change = btc.usd_24h_change;
  return {
    id: 'BTC',
    priceUsd: btc.usd,
    ...(typeof change === 'number' && Number.isFinite(change) ? { change24hPct: change } : {}),
    updatedAt: Date.now(),
  };
}

async function fetchCoinbase(fetchImpl?: FetchLike): Promise<MarketQuote> {
  const body = await fetchJson(COINBASE_URL, { fetchImpl });
  const data = isRecord(body) ? body.data : undefined;
  const amount = isRecord(data) && typeof data.amount === 'string' ? Number(data.amount) : NaN;
  if (!isPositiveNumber(amount)) {
    throw new FetchError('shape', COINBASE_URL, 'Unexpected Coinbase response');
  }
  return { id: 'BTC', priceUsd: amount, updatedAt: Date.now() };
}

/** CoinGecko first; on any failure Coinbase spot (no 24 h change). Throws if both fail. */
export async function fetchBitcoin(fetchImpl?: FetchLike): Promise<MarketQuote> {
  try {
    return await fetchCoinGecko(fetchImpl);
  } catch {
    return fetchCoinbase(fetchImpl);
  }
}

/** One gold-api metal: `price` is USD per troy ounce, `updatedAt` is ISO. */
export async function fetchMetal(
  symbol: 'XAU' | 'XAG',
  fetchImpl?: FetchLike,
): Promise<MarketQuote> {
  const url = goldApiUrl(symbol);
  const body = await fetchJson(url, { fetchImpl });
  if (!isRecord(body) || !isPositiveNumber(body.price)) {
    throw new FetchError('shape', url, 'Unexpected gold-api response');
  }
  const parsed = typeof body.updatedAt === 'string' ? Date.parse(body.updatedAt) : NaN;
  return {
    id: symbol,
    priceUsd: body.price,
    updatedAt: Number.isFinite(parsed) ? parsed : Date.now(),
  };
}

/** Gold and silver in parallel; returns whichever succeeded. */
export async function fetchMetals(
  fetchImpl?: FetchLike,
): Promise<Partial<Pick<Quotes, 'XAU' | 'XAG'>>> {
  const [xau, xag] = await Promise.allSettled([
    fetchMetal('XAU', fetchImpl),
    fetchMetal('XAG', fetchImpl),
  ]);
  return {
    ...(xau.status === 'fulfilled' ? { XAU: xau.value } : {}),
    ...(xag.status === 'fulfilled' ? { XAG: xag.value } : {}),
  };
}

/** All three assets; returns whatever succeeded. Throws only when all three fail. */
export async function fetchMarkets(fetchImpl?: FetchLike): Promise<Partial<Quotes>> {
  const results = await Promise.allSettled([
    fetchBitcoin(fetchImpl),
    fetchMetal('XAU', fetchImpl),
    fetchMetal('XAG', fetchImpl),
  ]);
  const quotes: Partial<Quotes> = {};
  const reasons: string[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') quotes[result.value.id] = result.value;
    else reasons.push(result.reason instanceof Error ? result.reason.message : 'unknown');
  }
  if (Object.keys(quotes).length === 0) {
    throw new Error(`All market sources failed (${reasons.join('; ')})`);
  }
  return quotes;
}

function isQuote(value: unknown, id: AssetId): value is MarketQuote {
  return (
    isRecord(value) &&
    value.id === id &&
    isPositiveNumber(value.priceUsd) &&
    typeof value.updatedAt === 'number' &&
    (value.change24hPct === undefined || typeof value.change24hPct === 'number')
  );
}

/** Cached quotes; invalid entries are dropped. */
export function loadCachedQuotes(): Partial<Quotes> {
  const cached = readJSON<unknown>(STORAGE_KEY, null);
  const quotes: Partial<Quotes> = {};
  if (!isRecord(cached)) return quotes;
  for (const id of ASSET_IDS) {
    const quote = cached[id];
    if (isQuote(quote, id)) quotes[id] = quote;
  }
  return quotes;
}

export function saveQuotes(q: Partial<Quotes>): void {
  writeJSON(STORAGE_KEY, q);
}
