/* eslint-disable react-refresh/only-export-components -- provider and its hooks belong together */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Context,
  type ReactNode,
} from 'react';
import { getHistory, isHistoryFresh, loadCachedHistory, type History } from '@/data/history';
import { errorMessage } from '@/data/http';
import {
  ASSET_IDS,
  fetchMarkets,
  loadCachedQuotes,
  MARKETS_POLL_MS,
  saveQuotes,
  type Quotes,
} from '@/data/markets';
import { getRates, isFresh, loadCachedRates, RATES_MAX_AGE_MS, type Rates } from '@/data/rates';
import { usePolling } from '@/data/usePolling';

export type SourceStatus = 'idle' | 'loading' | 'ok' | 'stale';

interface SourceState<T> {
  data: T;
  status: SourceStatus;
  /** Diagnostic message only; never render it (show `t('offline')` instead). */
  error: string | null;
  /** ms epoch of the last successful network refresh, or null. */
  lastRefresh: number | null;
}

export interface SourceApi<T> extends SourceState<T> {
  refresh: () => Promise<void>;
}

export type RatesApi = SourceApi<Rates | null>;
export type MarketsApi = SourceApi<Partial<Quotes>>;
export type HistoryApi = SourceApi<History | null>;

/** Fixed state for tests/stories. When given, the provider never fetches or polls. */
export interface InitialData {
  rates?: Rates | null;
  quotes?: Partial<Quotes>;
  history?: History | null;
  ratesStatus?: SourceStatus;
  marketsStatus?: SourceStatus;
  historyStatus?: SourceStatus;
  ratesError?: string | null;
  marketsError?: string | null;
  historyError?: string | null;
  lastRatesRefresh?: number | null;
  lastMarketsRefresh?: number | null;
}

/** Rates are refreshed when they would go stale within this window (keeps the 6 h poll on time). */
const RATES_REFRESH_SLACK_MS = 5 * 60 * 1000;

const hasQuotes = (q: Partial<Quotes>): boolean => Object.keys(q).length > 0;

function initialRates(initialData?: InitialData): SourceState<Rates | null> {
  if (initialData) {
    const data = initialData.rates ?? null;
    return {
      data,
      status: initialData.ratesStatus ?? (data ? 'ok' : 'idle'),
      error: initialData.ratesError ?? null,
      lastRefresh: initialData.lastRatesRefresh ?? data?.fetchedAt ?? null,
    };
  }
  const data = loadCachedRates();
  return {
    data,
    status: data ? (isFresh(data) ? 'ok' : 'stale') : 'idle',
    error: null,
    lastRefresh: data?.fetchedAt ?? null,
  };
}

function initialMarkets(initialData?: InitialData): SourceState<Partial<Quotes>> {
  if (initialData) {
    const data = initialData.quotes ?? {};
    return {
      data,
      status: initialData.marketsStatus ?? (hasQuotes(data) ? 'ok' : 'idle'),
      error: initialData.marketsError ?? null,
      lastRefresh: initialData.lastMarketsRefresh ?? null,
    };
  }
  const data = loadCachedQuotes();
  return { data, status: hasQuotes(data) ? 'stale' : 'idle', error: null, lastRefresh: null };
}

function initialHistory(initialData?: InitialData): SourceState<History | null> {
  if (initialData) {
    const data = initialData.history ?? null;
    return {
      data,
      status: initialData.historyStatus ?? (data ? 'ok' : 'idle'),
      error: initialData.historyError ?? null,
      lastRefresh: data?.fetchedAt ?? null,
    };
  }
  const data = loadCachedHistory();
  return {
    data,
    status: data ? (isHistoryFresh(data) ? 'ok' : 'stale') : 'idle',
    error: null,
    lastRefresh: data?.fetchedAt ?? null,
  };
}

const RatesContext = createContext<RatesApi | null>(null);
const MarketsContext = createContext<MarketsApi | null>(null);
const HistoryContext = createContext<HistoryApi | null>(null);
const RefreshAllContext = createContext<(() => Promise<void>) | null>(null);

export interface DataProviderProps {
  children: ReactNode;
  initialData?: InitialData;
}

export function DataProvider({ children, initialData }: DataProviderProps) {
  const [fixed] = useState(() => initialData !== undefined);
  const [rates, setRates] = useState(() => initialRates(initialData));
  const [markets, setMarkets] = useState(() => initialMarkets(initialData));
  const [history, setHistory] = useState(() => initialHistory(initialData));

  const ratesRef = useRef(rates.data);
  const quotesRef = useRef(markets.data);
  useEffect(() => {
    ratesRef.current = rates.data;
  }, [rates.data]);
  useEffect(() => {
    quotesRef.current = markets.data;
  }, [markets.data]);
  const historyRef = useRef(history.data);
  useEffect(() => {
    historyRef.current = history.data;
  }, [history.data]);

  const ratesInFlight = useRef<Promise<void> | null>(null);
  const marketsInFlight = useRef<Promise<void> | null>(null);
  const historyInFlight = useRef<Promise<void> | null>(null);

  const runRates = useCallback(
    (force: boolean): Promise<void> => {
      if (fixed) return Promise.resolve();
      if (ratesInFlight.current) return ratesInFlight.current;
      const now = Date.now() + RATES_REFRESH_SLACK_MS;
      const current = ratesRef.current;
      if (!force && current && isFresh(current, now)) return Promise.resolve();

      setRates((s) => ({ ...s, status: 'loading' }));
      const promise = getRates({ force, now, cached: current })
        .then((result) => {
          if (result.source === 'network' && result.data) {
            const data = result.data;
            ratesRef.current = data;
            setRates({ data, status: 'ok', error: null, lastRefresh: data.fetchedAt });
          } else {
            setRates((s) => ({
              ...s,
              status: s.data ? 'stale' : 'idle',
              error: result.error,
            }));
          }
        })
        .finally(() => {
          ratesInFlight.current = null;
        });
      ratesInFlight.current = promise;
      return promise;
    },
    [fixed],
  );

  const runHistory = useCallback(
    (force: boolean): Promise<void> => {
      if (fixed) return Promise.resolve();
      if (historyInFlight.current) return historyInFlight.current;
      const now = Date.now() + RATES_REFRESH_SLACK_MS;
      const current = historyRef.current;
      if (!force && current && isHistoryFresh(current, now)) return Promise.resolve();

      setHistory((s) => ({ ...s, status: 'loading' }));
      const promise = getHistory({ force, now, cached: current })
        .then((result) => {
          if (result.source === 'network' && result.data) {
            const data = result.data;
            historyRef.current = data;
            setHistory({ data, status: 'ok', error: null, lastRefresh: data.fetchedAt });
          } else {
            setHistory((s) => ({
              ...s,
              status: s.data ? 'stale' : 'idle',
              error: result.error,
            }));
          }
        })
        .finally(() => {
          historyInFlight.current = null;
        });
      historyInFlight.current = promise;
      return promise;
    },
    [fixed],
  );

  const runMarkets = useCallback((): Promise<void> => {
    if (fixed) return Promise.resolve();
    if (marketsInFlight.current) return marketsInFlight.current;

    setMarkets((s) => ({ ...s, status: 'loading' }));
    const promise = fetchMarkets()
      .then((fetched) => {
        const data: Partial<Quotes> = { ...quotesRef.current, ...fetched };
        const missing = ASSET_IDS.filter((id) => !fetched[id]);
        quotesRef.current = data;
        saveQuotes(data);
        setMarkets({
          data,
          status: missing.length === 0 ? 'ok' : 'stale',
          error: missing.length === 0 ? null : `Not refreshed: ${missing.join(', ')}`,
          lastRefresh: Date.now(),
        });
      })
      .catch((err: unknown) => {
        setMarkets((s) => ({
          ...s,
          status: hasQuotes(s.data) ? 'stale' : 'idle',
          error: errorMessage(err),
        }));
      })
      .finally(() => {
        marketsInFlight.current = null;
      });
    marketsInFlight.current = promise;
    return promise;
  }, [fixed]);

  // Rates and daily snapshots: on mount and when visible again only if not fresh (SPEC §6);
  // every 6 h while visible.
  usePolling(
    () => Promise.all([runRates(false), runHistory(false)]).then(() => undefined),
    RATES_MAX_AGE_MS,
    !fixed,
  );
  // Markets: on mount, every 60 s while visible, immediately when visible again.
  usePolling(runMarkets, MARKETS_POLL_MS, !fixed);

  const refreshRates = useCallback(() => runRates(true), [runRates]);
  const refreshAll = useCallback(
    () => Promise.all([runRates(true), runHistory(true), runMarkets()]).then(() => undefined),
    [runRates, runHistory, runMarkets],
  );

  const ratesValue = useMemo<RatesApi>(
    () => ({ ...rates, refresh: refreshRates }),
    [rates, refreshRates],
  );
  const marketsValue = useMemo<MarketsApi>(
    () => ({ ...markets, refresh: runMarkets }),
    [markets, runMarkets],
  );
  const refreshHistory = useCallback(() => runHistory(true), [runHistory]);
  const historyValue = useMemo<HistoryApi>(
    () => ({ ...history, refresh: refreshHistory }),
    [history, refreshHistory],
  );

  return (
    <RefreshAllContext.Provider value={refreshAll}>
      <RatesContext.Provider value={ratesValue}>
        <MarketsContext.Provider value={marketsValue}>
          <HistoryContext.Provider value={historyValue}>{children}</HistoryContext.Provider>
        </MarketsContext.Provider>
      </RatesContext.Provider>
    </RefreshAllContext.Provider>
  );
}

function useRequired<T>(ctx: Context<T | null>, name: string): T {
  const value = useContext(ctx);
  if (value === null) throw new Error(`${name} must be used inside <DataProvider>`);
  return value;
}

/** Fiat rates. `refresh()` fetches now, ignoring freshness. */
export function useRates(): RatesApi {
  return useRequired(RatesContext, 'useRates');
}

/** BTC / gold / silver quotes (any subset may be missing). `refresh()` fetches now. */
export function useMarkets(): MarketsApi {
  return useRequired(MarketsContext, 'useMarkets');
}

/** Daily EUR snapshots (latest + previous day) for "vs yesterday"; `refresh()` fetches now. */
export function useHistory(): HistoryApi {
  return useRequired(HistoryContext, 'useHistory');
}

/** Refreshes rates and daily snapshots (ignoring freshness) and markets together. */
export function useRefreshAll(): () => Promise<void> {
  return useRequired(RefreshAllContext, 'useRefreshAll');
}
