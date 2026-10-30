import { act, render, waitFor } from '@testing-library/react';
import { saveQuotes } from '@/data/markets';
import { RATES_MAX_AGE_MS, saveRates, type Rates } from '@/data/rates';
import { ER_API_BODY, mockFetch } from '@/test/mockFetch';
import { AppProviders } from './AppProviders';
import type { History } from '@/data/history';
import {
  useHistory,
  useMarkets,
  useRates,
  useRefreshAll,
  type HistoryApi,
  type MarketsApi,
  type RatesApi,
} from './DataContext';

let rates: RatesApi;
let markets: MarketsApi;
let history: HistoryApi;
let refreshAll: () => Promise<void>;
function Probe() {
  rates = useRates();
  markets = useMarkets();
  history = useHistory();
  refreshAll = useRefreshAll();
  return null;
}

const SOURCE_ROUTES = {
  'open.er-api.com': { body: ER_API_BODY },
  coingecko: { body: { bitcoin: { usd: 67000, usd_24h_change: 1.5 } } },
  '/XAU': { body: { price: 4000, updatedAt: '2026-10-29T11:59:00Z' } },
  '/XAG': { body: { price: 48, updatedAt: '2026-10-29T11:59:00Z' } },
};

const ROUTES = {
  ...SOURCE_ROUTES,
  '@latest': { body: { date: '2026-10-28', eur: { usd: 1.112, gbp: 0.8365 } } },
  '@2026-10-27': { body: { date: '2026-10-27', eur: { usd: 1.1, gbp: 0.8365 } } },
};

const HISTORY: History = {
  today: { date: '2026-10-28', rates: { eur: 1, usd: 1.112 } },
  previous: { date: '2026-10-27', rates: { eur: 1, usd: 1.1 } },
  fetchedAt: 1,
};

const isHistoryUrl = (url: string) => url.includes('currency-api');

const cached = (ageMs: number): Rates => ({
  base: 'EUR',
  rates: { EUR: 1, USD: 1.1, GBP: 0.9, AED: 4 },
  fetchedAt: Date.now() - ageMs,
  publishedAt: Date.now() - ageMs,
});

const calledUrls = (fn: ReturnType<typeof mockFetch>) => fn.mock.calls.map((c) => c[0]);

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('DataProvider', () => {
  it('with initialData: exposes it and never fetches', async () => {
    const fetchMock = mockFetch(ROUTES);
    vi.stubGlobal('fetch', fetchMock);
    const fixed = cached(0);
    render(
      <AppProviders
        initialData={{ rates: fixed, quotes: { XAU: { id: 'XAU', priceUsd: 4000, updatedAt: 1 } } }}
      >
        <Probe />
      </AppProviders>,
    );
    expect(rates).toMatchObject({ data: fixed, status: 'ok', error: null });
    expect(markets.data.XAU?.priceUsd).toBe(4000);
    expect(markets.status).toBe('ok');
    await act(() => refreshAll());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('cold start without cache: fetches rates and markets, then status ok', async () => {
    const fetchMock = mockFetch(ROUTES);
    vi.stubGlobal('fetch', fetchMock);
    render(
      <AppProviders>
        <Probe />
      </AppProviders>,
    );
    expect(rates.data).toBeNull();
    await waitFor(() => expect(rates.status).toBe('ok'));
    await waitFor(() => expect(markets.status).toBe('ok'));
    expect(rates.data?.rates.USD).toBe(1.1638);
    expect(Object.keys(markets.data).sort()).toEqual(['BTC', 'XAG', 'XAU']);
    expect(markets.lastRefresh).not.toBeNull();
    expect(localStorage.getItem('wissel.rates')).not.toBeNull();
    expect(localStorage.getItem('wissel.markets')).not.toBeNull();
    expect(calledUrls(fetchMock).filter((u) => !isHistoryUrl(u))).toHaveLength(4);
    await waitFor(() => expect(history.status).toBe('ok'));
    expect(history.data?.previous.rates.usd).toBe(1.1);
    expect(localStorage.getItem('wissel.history')).not.toBeNull();
  });

  it('warm fresh rates cache: rates are not fetched on load, status ok immediately', async () => {
    saveRates(cached(60_000));
    const fetchMock = mockFetch(ROUTES);
    vi.stubGlobal('fetch', fetchMock);
    render(
      <AppProviders>
        <Probe />
      </AppProviders>,
    );
    expect(rates.status).toBe('ok');
    expect(rates.data?.rates.USD).toBe(1.1);
    await waitFor(() => expect(markets.status).toBe('ok'));
    expect(calledUrls(fetchMock).some((u) => u.includes('er-api'))).toBe(false);

    await act(() => rates.refresh());
    expect(calledUrls(fetchMock).filter((u) => u.includes('er-api'))).toHaveLength(1);
    expect(rates.data?.rates.USD).toBe(1.1638);
  });

  it('stale caches + failing network: keeps old data, status stale with an error', async () => {
    const old = cached(RATES_MAX_AGE_MS + 1);
    saveRates(old);
    saveQuotes({ BTC: { id: 'BTC', priceUsd: 60000, updatedAt: 1 } });
    vi.stubGlobal('fetch', mockFetch({}));
    render(
      <AppProviders>
        <Probe />
      </AppProviders>,
    );
    expect(rates.status === 'stale' || rates.status === 'loading').toBe(true);
    expect(rates.data).toEqual(old);
    await waitFor(() => expect(rates.status).toBe('stale'));
    await waitFor(() => expect(markets.status).toBe('stale'));
    expect(rates.data).toEqual(old);
    expect(rates.error).toBeTruthy();
    expect(markets.data.BTC?.priceUsd).toBe(60000);
    expect(markets.error).toMatch(/All market sources failed/);
  });

  it('no cache + failing network: status idle with an error', async () => {
    vi.stubGlobal('fetch', mockFetch({}));
    render(
      <AppProviders>
        <Probe />
      </AppProviders>,
    );
    await waitFor(() => expect(rates.error).toBeTruthy());
    await waitFor(() => expect(markets.error).toBeTruthy());
    expect(rates).toMatchObject({ data: null, status: 'idle' });
    expect(markets).toMatchObject({ data: {}, status: 'idle' });
  });

  it('partial markets failure: merges with cache and reports stale', async () => {
    saveRates(cached(0));
    saveQuotes({ XAG: { id: 'XAG', priceUsd: 40, updatedAt: 1 } });
    vi.stubGlobal('fetch', mockFetch({ ...ROUTES, '/XAG': { status: 500 } }));
    render(
      <AppProviders>
        <Probe />
      </AppProviders>,
    );
    await waitFor(() => expect(markets.lastRefresh).not.toBeNull());
    expect(markets.status).toBe('stale');
    expect(markets.data.XAG?.priceUsd).toBe(40);
    expect(markets.data.XAU?.priceUsd).toBe(4000);
  });

  it('refreshAll refetches rates even when fresh', async () => {
    saveRates(cached(0));
    const fetchMock = mockFetch(ROUTES);
    vi.stubGlobal('fetch', fetchMock);
    render(
      <AppProviders>
        <Probe />
      </AppProviders>,
    );
    await waitFor(() => expect(markets.status).toBe('ok'));
    await act(() => refreshAll());
    expect(calledUrls(fetchMock).filter((u) => u.includes('er-api'))).toHaveLength(1);
    expect(calledUrls(fetchMock).filter((u) => u.includes('coingecko'))).toHaveLength(2);
    expect(calledUrls(fetchMock).filter((u) => u.includes('@latest'))).toHaveLength(2);
  });

  it('with initialData: exposes history', () => {
    render(
      <AppProviders initialData={{ rates: cached(0), history: HISTORY }}>
        <Probe />
      </AppProviders>,
    );
    expect(history).toMatchObject({ data: HISTORY, status: 'ok', error: null, lastRefresh: 1 });
  });

  it('a failed history fetch leaves rates untouched', async () => {
    const fetchMock = mockFetch(SOURCE_ROUTES);
    vi.stubGlobal('fetch', fetchMock);
    render(
      <AppProviders>
        <Probe />
      </AppProviders>,
    );
    await waitFor(() => expect(history.error).toBeTruthy());
    await waitFor(() => expect(rates.status).toBe('ok'));
    expect(history).toMatchObject({ data: null, status: 'idle' });
    expect(rates.error).toBeNull();
    expect(rates.data?.rates.USD).toBe(1.1638);
    expect(calledUrls(fetchMock).filter(isHistoryUrl)).toHaveLength(2);
  });
});
