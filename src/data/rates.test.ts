import { FetchError, fetchJson } from './http';
import {
  availableCodes,
  FETCH_TIMEOUT_MS,
  fetchRates,
  getRates,
  isFresh,
  loadCachedRates,
  RATES_MAX_AGE_MS,
  RATES_URL,
  saveRates,
  type Rates,
} from './rates';
import { ER_API_BODY, mockFetch } from '@/test/mockFetch';

const NOW = Date.UTC(2026, 9, 29, 12, 0, 0);

const cachedRates = (ageMs: number): Rates => ({
  base: 'EUR',
  rates: {
    EUR: 1,
    USD: 1.1,
    GBP: 0.9,
    AED: 4,
    CHF: 0.93,
    JPY: 170,
    CAD: 1.5,
    AUD: 1.7,
    SEK: 11.5,
    NOK: 11.8,
  },
  fetchedAt: NOW - ageMs,
  publishedAt: NOW - ageMs - 1000,
});

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('fetchRates', () => {
  it('requests open.er-api EUR and keeps every currency code', async () => {
    const fetchImpl = mockFetch({ 'open.er-api.com': { body: ER_API_BODY } });
    const rates = await fetchRates(fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith(
      RATES_URL,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(RATES_URL).toBe('https://open.er-api.com/v6/latest/EUR');
    expect(rates).toEqual({
      base: 'EUR',
      rates: { EUR: 1, USD: 1.1638, GBP: 0.8787, AED: 4.2741, JPY: 176.9 },
      fetchedAt: NOW,
      publishedAt: 1761696001000,
    });
  });

  it('drops codes without a positive number and keys that are not 3-letter codes', async () => {
    const body = {
      ...ER_API_BODY,
      rates: { EUR: 1, USD: 1.1, CHF: 0.93, KWD: 0.357, BAD: 0, NEG: -1, XX: 2, ABC: 'x' },
    };
    const rates = await fetchRates(mockFetch({ 'er-api': { body } }));
    expect(rates.rates).toEqual({ EUR: 1, USD: 1.1, CHF: 0.93, KWD: 0.357 });
    expect(availableCodes(rates)).toEqual(['CHF', 'EUR', 'KWD', 'USD']);
  });

  it('forces EUR to 1', async () => {
    const body = { ...ER_API_BODY, rates: { ...ER_API_BODY.rates, EUR: 0.99 } };
    const rates = await fetchRates(mockFetch({ 'er-api': { body } }));
    expect(rates.rates.EUR).toBe(1);
  });

  it('throws on result !== success, missing currencies, HTTP errors', async () => {
    await expect(
      fetchRates(mockFetch({ 'er-api': { body: { ...ER_API_BODY, result: 'error' } } })),
    ).rejects.toMatchObject({ kind: 'shape' });
    const noUsd = { ...ER_API_BODY, rates: { EUR: 1, GBP: 0.8, AED: 4.2 } };
    await expect(fetchRates(mockFetch({ 'er-api': { body: noUsd } }))).rejects.toBeInstanceOf(
      FetchError,
    );
    await expect(fetchRates(mockFetch({ 'er-api': { status: 503 } }))).rejects.toMatchObject({
      kind: 'http',
    });
    await expect(
      fetchRates(mockFetch({ 'er-api': new TypeError('Failed to fetch') })),
    ).rejects.toMatchObject({
      kind: 'network',
    });
  });

  it('times out after 8 s and aborts the request', async () => {
    expect(FETCH_TIMEOUT_MS).toBe(8000);
    const fetchImpl = mockFetch({ 'er-api': 'hang' });
    const promise = fetchRates(fetchImpl);
    const assertion = expect(promise).rejects.toMatchObject({ kind: 'timeout' });
    await vi.advanceTimersByTimeAsync(7999);
    const signal = fetchImpl.mock.calls[0][1]?.signal;
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    expect(signal?.aborted).toBe(true);
  });

  it('times out even when the fetch ignores the abort signal', async () => {
    const fetchImpl = vi.fn(() => new Promise<never>(() => undefined));
    const assertion = expect(fetchJson('https://x.test', { fetchImpl })).rejects.toMatchObject({
      kind: 'timeout',
    });
    await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS);
    await assertion;
  });
});

describe('isFresh', () => {
  it('treats a pre-v4 cache with only the four fixed currencies as stale', () => {
    const legacy: Rates = { ...cachedRates(0), rates: { EUR: 1, USD: 1.1, GBP: 0.9, AED: 4 } };
    expect(isFresh(legacy)).toBe(false);
  });

  it('is true within 6 hours of fetchedAt', () => {
    expect(RATES_MAX_AGE_MS).toBe(6 * 60 * 60 * 1000);
    expect(isFresh(cachedRates(0))).toBe(true);
    expect(isFresh(cachedRates(RATES_MAX_AGE_MS - 1))).toBe(true);
    expect(isFresh(cachedRates(RATES_MAX_AGE_MS))).toBe(false);
    expect(isFresh(cachedRates(0), NOW + RATES_MAX_AGE_MS)).toBe(false);
  });
});

describe('cache', () => {
  it('round-trips through wissel.rates and ignores invalid data', () => {
    expect(loadCachedRates()).toBeNull();
    saveRates(cachedRates(10));
    expect(localStorage.getItem('wissel.rates')).not.toBeNull();
    expect(loadCachedRates()).toEqual(cachedRates(10));
    localStorage.setItem('wissel.rates', JSON.stringify({ base: 'EUR', rates: { USD: 'x' } }));
    expect(loadCachedRates()).toBeNull();
  });

  it('accepts any number of codes but requires EUR = 1 and USD', () => {
    const codes = Array.from({ length: 160 }, (_, i) =>
      String.fromCharCode(65 + (Math.floor(i / 26) % 26), 65 + (i % 26), 81),
    );
    const many: Rates = {
      ...cachedRates(10),
      rates: Object.fromEntries([
        ...codes.map((c, i) => [c, 1 + i / 10]),
        ['EUR', 1],
        ['USD', 1.1],
      ]),
    };
    expect(Object.keys(many.rates).length).toBeGreaterThanOrEqual(160);
    saveRates(many);
    expect(loadCachedRates()).toEqual(many);
    expect(availableCodes(many)).toHaveLength(Object.keys(many.rates).length);

    const minimal: Rates = { ...cachedRates(10), rates: { EUR: 1, USD: 1.1 } };
    saveRates(minimal);
    expect(loadCachedRates()).toEqual(minimal);

    saveRates({ ...cachedRates(10), rates: { EUR: 1, GBP: 0.9 } });
    expect(loadCachedRates()).toBeNull();
    saveRates({ ...cachedRates(10), rates: { EUR: 1.01, USD: 1.1 } });
    expect(loadCachedRates()).toBeNull();
    saveRates({ ...cachedRates(10), rates: { EUR: 1, USD: 1.1, CHF: 0 } });
    expect(loadCachedRates()).toBeNull();
  });
});

describe('getRates (cache + stale logic)', () => {
  it('fresh: no cache -> fetches, saves, returns network data', async () => {
    const fetchImpl = mockFetch({ 'er-api': { body: ER_API_BODY } });
    const result = await getRates({ fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ source: 'network', stale: false, error: null });
    expect(result.data?.rates.USD).toBe(1.1638);
    expect(loadCachedRates()?.rates.USD).toBe(1.1638);
  });

  it('cached-fresh: returns the cache without fetching', async () => {
    saveRates(cachedRates(60 * 60 * 1000));
    const fetchImpl = mockFetch({ 'er-api': { body: ER_API_BODY } });
    const result = await getRates({ fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual({
      data: cachedRates(60 * 60 * 1000),
      source: 'cache',
      stale: false,
      error: null,
    });
  });

  it('cached-fresh but force: fetches anyway', async () => {
    saveRates(cachedRates(60 * 1000));
    const fetchImpl = mockFetch({ 'er-api': { body: ER_API_BODY } });
    const result = await getRates({ fetchImpl, force: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.source).toBe('network');
  });

  it('cached-stale then fetch succeeds: replaces the cache', async () => {
    saveRates(cachedRates(RATES_MAX_AGE_MS + 1));
    const result = await getRates({ fetchImpl: mockFetch({ 'er-api': { body: ER_API_BODY } }) });
    expect(result).toMatchObject({ source: 'network', stale: false });
    expect(loadCachedRates()?.fetchedAt).toBe(NOW);
  });

  it('cached-stale then fetch fails: keeps the cached copy, marked stale', async () => {
    const old = cachedRates(RATES_MAX_AGE_MS + 1);
    saveRates(old);
    const result = await getRates({ fetchImpl: mockFetch({ 'er-api': { status: 500 } }) });
    expect(result).toEqual({ data: old, source: 'cache', stale: true, error: 'HTTP 500' });
    expect(loadCachedRates()).toEqual(old);
  });

  it('no cache and fetch fails: no data, error set', async () => {
    const result = await getRates({ fetchImpl: mockFetch({ 'er-api': new TypeError('offline') }) });
    expect(result).toEqual({ data: null, source: 'none', stale: false, error: 'offline' });
  });

  it('timeout with a stale cache: returns the cache after 8 s', async () => {
    const old = cachedRates(RATES_MAX_AGE_MS * 2);
    saveRates(old);
    const promise = getRates({ fetchImpl: mockFetch({ 'er-api': 'hang' }) });
    await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS);
    const result = await promise;
    expect(result).toMatchObject({ data: old, source: 'cache', stale: true });
    expect(result.error).toMatch(/Timed out/);
  });

  it('`now` and `cached` options override the clock and the stored copy', async () => {
    const fetchImpl = mockFetch({ 'er-api': { body: ER_API_BODY } });
    const inMemory = cachedRates(RATES_MAX_AGE_MS - 60_000);
    expect((await getRates({ fetchImpl, cached: inMemory })).source).toBe('cache');
    expect(fetchImpl).not.toHaveBeenCalled();
    const early = await getRates({ fetchImpl, cached: inMemory, now: NOW + 5 * 60_000 });
    expect(early.source).toBe('network');
  });
});
