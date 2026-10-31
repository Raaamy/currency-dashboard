import {
  fetchLiveRates,
  LIVE_RATES_URL,
  loadCachedLiveRates,
  mergeRates,
  saveLiveRates,
} from './liveRates';
import type { Rates } from './rates';
import { EXCHANGE_RATES_BODY, mockFetch } from '@/test/mockFetch';

const NOW = Date.UTC(2026, 9, 31, 14, 0, 0);

const table = (rates: Record<string, number>, publishedAt: number): Rates => ({
  base: 'EUR',
  rates: { EUR: 1, ...rates },
  fetchedAt: publishedAt,
  publishedAt,
});

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('fetchLiveRates', () => {
  it('turns BTC prices into an EUR table of fiat codes only', async () => {
    const fetchImpl = mockFetch({ exchange_rates: { body: EXCHANGE_RATES_BODY } });
    const live = await fetchLiveRates(fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith(LIVE_RATES_URL, expect.anything());
    expect(live).toEqual({
      base: 'EUR',
      rates: { EUR: 1, USD: 70000 / 60000, GBP: 52800 / 60000, AED: 257100 / 60000 },
      fetchedAt: NOW,
      publishedAt: NOW,
    });
  });

  it('throws without EUR or USD, or on HTTP errors', async () => {
    const without = (code: string) =>
      Object.fromEntries(Object.entries(EXCHANGE_RATES_BODY.rates).filter(([k]) => k !== code));
    const noEur = without('eur');
    const noUsd = without('usd');
    for (const reply of [
      { body: { rates: noEur } },
      { body: { rates: noUsd } },
      { body: {} },
      { status: 429 },
    ]) {
      await expect(fetchLiveRates(mockFetch({ exchange_rates: reply }))).rejects.toThrow();
    }
  });
});

describe('cache', () => {
  it('round-trips through wissel.liveRates and ignores invalid data', () => {
    expect(loadCachedLiveRates()).toBeNull();
    const live = table({ USD: 1.12 }, NOW);
    saveLiveRates(live);
    expect(localStorage.getItem('wissel.liveRates')).not.toBeNull();
    expect(loadCachedLiveRates()).toEqual(live);
    localStorage.setItem('wissel.liveRates', JSON.stringify({ base: 'EUR', rates: {} }));
    expect(loadCachedLiveRates()).toBeNull();
  });
});

describe('mergeRates', () => {
  const daily = table({ USD: 1.1166, GBP: 0.88, JPY: 170 }, NOW - 3_600_000);

  it('passes either side through when the other is missing', () => {
    const live = table({ USD: 1.12 }, NOW);
    expect(mergeRates(null, null)).toBeNull();
    expect(mergeRates(daily, null)).toBe(daily);
    expect(mergeRates(null, live)).toBe(live);
  });

  it('lays newer live rates over the daily codes and takes the live time', () => {
    const live = table({ USD: 1.12, GBP: 0.881, VEF: 1e9 }, NOW);
    expect(mergeRates(daily, live)).toEqual({
      base: 'EUR',
      rates: { EUR: 1, USD: 1.12, GBP: 0.881, JPY: 170 },
      fetchedAt: NOW,
      publishedAt: NOW,
    });
  });

  it('ignores live rates older than the daily publication', () => {
    const old = table({ USD: 1.12 }, NOW - 7_200_000);
    expect(mergeRates(daily, old)).toBe(daily);
  });

  it('ignores a live rate more than 10% away from the daily one', () => {
    const live = table({ USD: 1.3, GBP: 0.881 }, NOW);
    expect(mergeRates(daily, live)?.rates).toEqual({ EUR: 1, USD: 1.1166, GBP: 0.881, JPY: 170 });
  });
});
