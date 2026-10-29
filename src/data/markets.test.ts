import {
  COINBASE_URL,
  COINGECKO_URL,
  fetchBitcoin,
  fetchMarkets,
  fetchMetal,
  fetchMetals,
  goldApiUrl,
  loadCachedQuotes,
  saveQuotes,
} from './markets';
import { FETCH_TIMEOUT_MS } from './http';
import { mockFetch } from '@/test/mockFetch';

const NOW = Date.UTC(2026, 9, 29, 12, 0, 0);
const GECKO = { bitcoin: { usd: 67812.5, usd_24h_change: -3.12 } };
const COINBASE = { data: { amount: '67790.01', base: 'BTC', currency: 'USD' } };
const GOLD = { name: 'Gold', price: 3990.4, symbol: 'XAU', updatedAt: '2026-10-29T11:59:00Z' };
const SILVER = { name: 'Silver', price: 47.85, symbol: 'XAG', updatedAt: '2026-10-29T11:58:00Z' };

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('fetchBitcoin', () => {
  it('uses CoinGecko with the 24 h change', async () => {
    const fetchImpl = mockFetch({ coingecko: { body: GECKO } });
    const quote = await fetchBitcoin(fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe(COINGECKO_URL);
    expect(COINGECKO_URL).toContain('vs_currencies=usd&include_24hr_change=true');
    expect(quote).toEqual({ id: 'BTC', priceUsd: 67812.5, change24hPct: -3.12, updatedAt: NOW });
  });

  it('falls back to Coinbase when CoinGecko fails (no change %)', async () => {
    const fetchImpl = mockFetch({ coingecko: { status: 429 }, coinbase: { body: COINBASE } });
    const quote = await fetchBitcoin(fetchImpl);
    expect(fetchImpl.mock.calls.map((c) => c[0])).toEqual([COINGECKO_URL, COINBASE_URL]);
    expect(quote).toEqual({ id: 'BTC', priceUsd: 67790.01, updatedAt: NOW });
    expect(quote).not.toHaveProperty('change24hPct');
  });

  it('falls back on a bad CoinGecko shape and on a CoinGecko timeout', async () => {
    const bad = mockFetch({ coingecko: { body: { bitcoin: {} } }, coinbase: { body: COINBASE } });
    expect((await fetchBitcoin(bad)).priceUsd).toBe(67790.01);

    const slow = mockFetch({ coingecko: 'hang', coinbase: { body: COINBASE } });
    const promise = fetchBitcoin(slow);
    await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS);
    expect((await promise).priceUsd).toBe(67790.01);
  });

  it('throws when both providers fail', async () => {
    const fetchImpl = mockFetch({ coingecko: { status: 500 }, coinbase: { body: { data: {} } } });
    await expect(fetchBitcoin(fetchImpl)).rejects.toThrow();
  });
});

describe('fetchMetal / fetchMetals', () => {
  it('reads gold-api price (USD/oz) and updatedAt', async () => {
    const fetchImpl = mockFetch({ '/XAU': { body: GOLD }, '/XAG': { body: SILVER } });
    expect(await fetchMetal('XAU', fetchImpl)).toEqual({
      id: 'XAU',
      priceUsd: 3990.4,
      updatedAt: Date.parse('2026-10-29T11:59:00Z'),
    });
    expect(goldApiUrl('XAG')).toBe('https://api.gold-api.com/price/XAG');
    const both = await fetchMetals(fetchImpl);
    expect(both.XAU?.priceUsd).toBe(3990.4);
    expect(both.XAG?.priceUsd).toBe(47.85);
  });

  it('uses now when updatedAt is missing and returns partial results', async () => {
    const fetchImpl = mockFetch({ '/XAU': { body: { price: 4000 } }, '/XAG': { status: 502 } });
    const metals = await fetchMetals(fetchImpl);
    expect(metals).toEqual({ XAU: { id: 'XAU', priceUsd: 4000, updatedAt: NOW } });
  });
});

describe('fetchMarkets', () => {
  it('returns all three when all succeed', async () => {
    const fetchImpl = mockFetch({
      coingecko: { body: GECKO },
      '/XAU': { body: GOLD },
      '/XAG': { body: SILVER },
    });
    const quotes = await fetchMarkets(fetchImpl);
    expect(Object.keys(quotes).sort()).toEqual(['BTC', 'XAG', 'XAU']);
  });

  it('returns whatever succeeded', async () => {
    const fetchImpl = mockFetch({
      coingecko: new TypeError('offline'),
      coinbase: new TypeError('offline'),
      '/XAU': { body: GOLD },
      '/XAG': { status: 500 },
    });
    const quotes = await fetchMarkets(fetchImpl);
    expect(Object.keys(quotes)).toEqual(['XAU']);
  });

  it('throws only when all three fail', async () => {
    const fetchImpl = mockFetch({});
    await expect(fetchMarkets(fetchImpl)).rejects.toThrow(/All market sources failed/);
  });
});

describe('quotes cache', () => {
  it('round-trips through wissel.markets and drops invalid entries', () => {
    expect(loadCachedQuotes()).toEqual({});
    saveQuotes({ XAU: { id: 'XAU', priceUsd: 4000, updatedAt: NOW } });
    expect(localStorage.getItem('wissel.markets')).not.toBeNull();
    expect(loadCachedQuotes()).toEqual({ XAU: { id: 'XAU', priceUsd: 4000, updatedAt: NOW } });
    localStorage.setItem(
      'wissel.markets',
      JSON.stringify({ BTC: { id: 'BTC', priceUsd: -1, updatedAt: 1 }, XAG: { id: 'XAU' } }),
    );
    expect(loadCachedQuotes()).toEqual({});
  });
});
