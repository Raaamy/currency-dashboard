/** Test helpers for `data/*` (imported by tests only). */
import type { FetchLike } from '@/data/http';

type Reply = { status?: number; body?: unknown } | Error | 'hang';

/** A fetch mock answering by URL substring; unmatched URLs reject. */
export function mockFetch(routes: Record<string, Reply>) {
  return vi.fn<FetchLike>((url, init) => {
    const key = Object.keys(routes).find((k) => url.includes(k));
    const reply = key === undefined ? new Error(`unmocked ${url}`) : routes[key];
    if (reply === 'hang') {
      return new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        );
      });
    }
    if (reply instanceof Error) return Promise.reject(reply);
    const status = reply.status ?? 200;
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(reply.body),
    });
  });
}

export const ER_API_BODY = {
  result: 'success',
  base_code: 'EUR',
  time_last_update_unix: 1761696001,
  rates: { EUR: 1, USD: 1.1638, GBP: 0.8787, AED: 4.2741, JPY: 176.9 },
};

/** CoinGecko exchange_rates: each entry is that currency's price of 1 BTC. */
export const EXCHANGE_RATES_BODY = {
  rates: {
    btc: { name: 'Bitcoin', unit: 'BTC', value: 1, type: 'crypto' },
    eth: { name: 'Ether', unit: 'ETH', value: 25, type: 'crypto' },
    usd: { name: 'US Dollar', unit: '$', value: 70000, type: 'fiat' },
    eur: { name: 'Euro', unit: '€', value: 60000, type: 'fiat' },
    gbp: { name: 'British Pound Sterling', unit: '£', value: 52800, type: 'fiat' },
    aed: { name: 'United Arab Emirates Dirham', unit: 'DH', value: 257100, type: 'fiat' },
    xau: { name: 'Gold - Troy Ounce', unit: 'XAU', value: 17.5, type: 'commodity' },
  },
};
