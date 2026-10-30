import {
  fetchHistory,
  fetchSnapshot,
  getHistory,
  isHistoryFresh,
  loadCachedHistory,
  previousDates,
  saveHistory,
  snapshotUrl,
  type History,
} from './history';
import { RATES_MAX_AGE_MS } from './rates';
import { mockFetch } from '@/test/mockFetch';

const NOW = Date.UTC(2026, 9, 30, 12, 0, 0);

const body = (date: string, usd = 1.112) => ({
  date,
  eur: {
    eur: 1,
    usd,
    gbp: 0.8365,
    aed: 4.0845,
    xau: 0.00027556,
    xag: 0.02064,
    btc: 1.376e-5,
    jpy: 170,
    chf: 0.93,
    '1inch': 4.2,
    usdt: 1.1,
    bad: 0,
  },
});

const rates = (usd: number) => ({
  eur: 1,
  usd,
  gbp: 0.8365,
  aed: 4.0845,
  xau: 0.00027556,
  xag: 0.02064,
  btc: 1.376e-5,
  jpy: 170,
  chf: 0.93,
});

const cachedHistory = (ageMs: number): History => ({
  // Ten codes, so the cache counts as a current (post-v4) snapshot.
  today: { date: '2026-10-28', rates: { ...rates(1.112), cad: 1.5 } },
  previous: { date: '2026-10-27', rates: { ...rates(1.1), cad: 1.5 } },
  fetchedAt: NOW - ageMs,
});

const calledUrls = (fn: ReturnType<typeof mockFetch>) => fn.mock.calls.map((c) => c[0]);

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('snapshotUrl', () => {
  it('builds the jsDelivr and pages.dev URLs', () => {
    expect(snapshotUrl('latest', 'cdn')).toBe(
      'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.min.json',
    );
    expect(snapshotUrl('2026-10-28', 'pages')).toBe(
      'https://2026-10-28.currency-api.pages.dev/v1/currencies/eur.min.json',
    );
  });
});

describe('previousDates', () => {
  it('returns the calendar days before, nearest first, across month and year ends', () => {
    expect(previousDates('2026-10-28')).toEqual(['2026-10-27', '2026-10-26', '2026-10-25']);
    expect(previousDates('2026-03-01', 2)).toEqual(['2026-02-28', '2026-02-27']);
    expect(previousDates('2027-01-01', 1)).toEqual(['2026-12-31']);
    // DST change in Europe (2026-10-25) must not shift the dates.
    expect(previousDates('2026-10-26', 2)).toEqual(['2026-10-25', '2026-10-24']);
  });
});

describe('fetchSnapshot', () => {
  it('keeps every 3-letter key with a positive number plus eur = 1', async () => {
    const fetchImpl = mockFetch({ '@latest': { body: body('2026-10-28') } });
    const snap = await fetchSnapshot('latest', fetchImpl);
    expect(snap).toEqual({ date: '2026-10-28', rates: rates(1.112) });
    expect(snap.rates).toMatchObject({ chf: 0.93, jpy: 170 });
    expect(snap.rates).not.toHaveProperty('usdt');
    expect(snap.rates).not.toHaveProperty('1inch');
    expect(snap.rates).not.toHaveProperty('bad');
    expect(calledUrls(fetchImpl)).toEqual([snapshotUrl('latest', 'cdn')]);
  });

  it('falls back from the CDN to pages.dev', async () => {
    const fetchImpl = mockFetch({
      '@latest': { status: 503 },
      'latest.currency-api.pages.dev': { body: body('2026-10-28') },
    });
    const snap = await fetchSnapshot('latest', fetchImpl);
    expect(snap.date).toBe('2026-10-28');
    expect(calledUrls(fetchImpl)).toEqual([
      snapshotUrl('latest', 'cdn'),
      snapshotUrl('latest', 'pages'),
    ]);
  });

  it('falls back on a bad shape and throws a FetchError when both fail', async () => {
    await expect(
      fetchSnapshot(
        'latest',
        mockFetch({
          '@latest': { body: { date: '28-10-2026', eur: {} } },
          'pages.dev': { status: 404 },
        }),
      ),
    ).rejects.toMatchObject({ name: 'FetchError', kind: 'http' });
    await expect(
      fetchSnapshot('latest', mockFetch({ 'currency-api': { body: { date: '2026-10-28' } } })),
    ).rejects.toMatchObject({ name: 'FetchError', kind: 'shape' });
  });
});

describe('fetchHistory', () => {
  it('fetches latest and the day before', async () => {
    const fetchImpl = mockFetch({
      '@latest': { body: body('2026-10-28') },
      '@2026-10-27': { body: body('2026-10-27', 1.1) },
    });
    const history = await fetchHistory(fetchImpl);
    expect(history).toEqual({
      today: { date: '2026-10-28', rates: rates(1.112) },
      previous: { date: '2026-10-27', rates: rates(1.1) },
      fetchedAt: NOW,
    });
    expect(calledUrls(fetchImpl)).toEqual([
      snapshotUrl('latest', 'cdn'),
      snapshotUrl('2026-10-27', 'cdn'),
    ]);
  });

  it('falls back to two days before when the previous day 404s on both hosts', async () => {
    const fetchImpl = mockFetch({
      '@latest': { body: body('2026-10-28') },
      '@2026-10-27': { status: 404 },
      '2026-10-27.currency-api': { status: 404 },
      '@2026-10-26': { body: body('2026-10-26', 1.1) },
    });
    const history = await fetchHistory(fetchImpl);
    expect(history.previous.date).toBe('2026-10-26');
    expect(calledUrls(fetchImpl)).toEqual([
      snapshotUrl('latest', 'cdn'),
      snapshotUrl('2026-10-27', 'cdn'),
      snapshotUrl('2026-10-27', 'pages'),
      snapshotUrl('2026-10-26', 'cdn'),
    ]);
  });

  it('throws when no previous snapshot is found within 3 days', async () => {
    const fetchImpl = mockFetch({ '@latest': { body: body('2026-10-28') } });
    await expect(fetchHistory(fetchImpl)).rejects.toMatchObject({ name: 'FetchError' });
    expect(fetchImpl).toHaveBeenCalledTimes(7);
  });

  it('throws when latest fails on both hosts', async () => {
    const fetchImpl = mockFetch({});
    await expect(fetchHistory(fetchImpl)).rejects.toMatchObject({ kind: 'network' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('history cache', () => {
  it('round-trips through wissel.history and rejects junk', () => {
    expect(loadCachedHistory()).toBeNull();
    saveHistory(cachedHistory(0));
    expect(localStorage.getItem('wissel.history')).not.toBeNull();
    expect(loadCachedHistory()).toEqual(cachedHistory(0));
    localStorage.setItem('wissel.history', JSON.stringify({ today: 1 }));
    expect(loadCachedHistory()).toBeNull();
  });

  it('treats a pre-v4 snapshot cache with only a few codes as stale', () => {
    const thin: History = {
      ...cachedHistory(0),
      today: { date: '2026-10-28', rates: { eur: 1, usd: 1.1, gbp: 0.8 } },
    };
    expect(isHistoryFresh(thin, NOW)).toBe(false);
  });

  it('is fresh for 6 h', () => {
    expect(isHistoryFresh(cachedHistory(RATES_MAX_AGE_MS - 1), NOW)).toBe(true);
    expect(isHistoryFresh(cachedHistory(RATES_MAX_AGE_MS), NOW)).toBe(false);
  });

  it('getHistory: fresh cache skips the network; failure keeps the cache as stale', async () => {
    saveHistory(cachedHistory(0));
    const none = mockFetch({});
    await expect(getHistory({ fetchImpl: none })).resolves.toMatchObject({ source: 'cache' });
    expect(none).not.toHaveBeenCalled();

    const result = await getHistory({ fetchImpl: none, force: true });
    expect(result).toMatchObject({ source: 'cache', stale: true, data: cachedHistory(0) });
    expect(result.error).toBeTruthy();
  });

  it('getHistory: fetches and saves when the cache is old', async () => {
    saveHistory(cachedHistory(RATES_MAX_AGE_MS + 1));
    const fetchImpl = mockFetch({
      '@latest': { body: body('2026-10-29', 1.2) },
      '@2026-10-28': { body: body('2026-10-28') },
    });
    const result = await getHistory({ fetchImpl });
    expect(result.source).toBe('network');
    expect(result.data?.today.rates.usd).toBe(1.2);
    expect(loadCachedHistory()?.today.date).toBe('2026-10-29');
  });
});
