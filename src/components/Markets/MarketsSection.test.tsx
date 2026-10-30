import { act, render, screen, within } from '@testing-library/react';
import type { History } from '@/data';
import { LEGACY_CURRENCIES } from '@/lib/currencies';
import type { InitialData } from '@/state/DataContext';
import { AppProviders } from '@/state/AppProviders';
import type { Settings } from '@/state/SettingsContext';
import { t } from '@/i18n';
import { formatRate } from '@/lib/money';
import { MarketsSection } from './MarketsSection';

const now = Date.now();

const fixture = (overrides: Partial<InitialData> = {}): InitialData => ({
  rates: {
    base: 'EUR',
    rates: { EUR: 1, USD: 1.1, GBP: 0.85, AED: 4 },
    fetchedAt: now,
    publishedAt: now,
  },
  quotes: {
    BTC: { id: 'BTC', priceUsd: 66000, change24hPct: -3.1, updatedAt: now },
    XAU: { id: 'XAU', priceUsd: 4000, updatedAt: now },
    XAG: { id: 'XAG', priceUsd: 50, updatedAt: now },
  },
  marketsStatus: 'ok',
  lastMarketsRefresh: now,
  ...overrides,
});

function renderSection(settings: Partial<Settings> = {}, data: Partial<InitialData> = {}) {
  return render(
    <AppProviders
      initialSettings={{
        currencies: [...LEGACY_CURRENCIES],
        base: 'EUR',
        amount: '1250',
        ...settings,
      }}
      initialData={fixture(data)}
    >
      <MarketsSection />
    </AppProviders>,
  );
}

const NBSP = String.fromCharCode(0xa0);
const text = (el: Element): string => (el.textContent ?? '').split(NBSP).join(' ');
const tile = (container: HTMLElement, id: string): HTMLElement => {
  const el = container.querySelector<HTMLElement>(`[data-asset="${id}"]`);
  if (!el) throw new Error(`tile ${id} not found`);
  return el;
};

const MINUS = '−';
/** Plain spaces and an ASCII minus, so expectations can be typed. */
const plain = (el: Element): string => text(el).split(MINUS).join('-');

const HISTORY: History = {
  today: {
    date: '2026-10-28',
    rates: { eur: 1, usd: 1.1, gbp: 0.85, aed: 4, xau: 0.00025, xag: 0.02, btc: 0.00001 },
  },
  previous: {
    date: '2026-10-27',
    rates: { eur: 1, usd: 1.0, gbp: 0.85, aed: 4.2, xau: 0.0002, xag: 0.02, btc: 0.00002 },
  },
  fetchedAt: now,
};

const changeSpans = (el: HTMLElement) =>
  Array.from(el.querySelectorAll<HTMLElement>('span[data-dir]')).map((s) => ({
    text: plain(s),
    dir: s.dataset.dir,
    title: s.title,
  }));

describe('MarketsSection', () => {
  it('shows quantities, unit prices and the change pill for 1250 EUR', () => {
    const { container } = renderSection();
    expect(screen.getByRole('region', { name: t('markets') })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: t('markets') })).toBeNull();

    const btc = text(tile(container, 'BTC'));
    expect(btc).toContain('0,020833 BTC');
    expect(btc).toContain('60.000');
    expect(btc).toContain('per bitcoin');
    expect(btc).toContain('−3,1');

    const gold = text(tile(container, 'XAU'));
    expect(gold).toContain('10,69 g');
    expect(gold).toContain('≈ 0,344 oz');
    expect(gold).toContain('per gram');
    expect(gold).toContain('per troy oz');

    // 855.35 g: SPEC §8 formats grams >= 100 with 0 decimals.
    expect(text(tile(container, 'XAG'))).toContain('855 g');
    expect(text(tile(container, 'XAG'))).toContain('≈ 27,50 oz');
    expect(text(container)).toContain('live · 0s ago');
  });

  it('renders every tile name and caption in both layouts (one DOM for row and stacked)', () => {
    const { container } = renderSection({ amount: '10000' });
    const expected: Record<string, string[]> = {
      RATES: ['1 EUR', t('exchangeRate')],
      BTC: [t('asset.BTC'), t('perBitcoin'), '0,16667 BTC'],
      XAU: [t('asset.XAU'), t('perGram'), t('perOunce'), '≈ 2,750 oz'],
      XAG: [t('asset.XAG'), t('perGram'), t('perOunce'), '≈ 220,00 oz'],
    };
    for (const [id, parts] of Object.entries(expected)) {
      const el = tile(container, id);
      expect(within(el).getByRole('heading', { name: parts[0] })).toBeInTheDocument();
      for (const part of parts.slice(1)) expect(text(el)).toContain(part);
    }
  });

  it('shows zero quantities for an empty amount', () => {
    const { container } = renderSection({ amount: '' });
    expect(text(tile(container, 'BTC'))).toContain('0 BTC');
    expect(text(tile(container, 'XAU'))).toContain('0 g');
    expect(text(tile(container, 'XAG'))).toContain('0 g');
  });

  it('shows the offline caption when stale', () => {
    renderSection({}, { marketsStatus: 'stale' });
    expect(screen.getByText(t('offline'))).toBeInTheDocument();
  });

  it('shows dashes for a missing quote', () => {
    const { container } = renderSection({}, { quotes: {}, marketsStatus: 'idle' });
    const btc = tile(container, 'BTC');
    expect(within(btc).getByText('Bitcoin')).toBeInTheDocument();
    expect(text(btc)).toContain('—');
  });

  it('renders the rates tile before the market tiles', () => {
    const { container } = renderSection();
    const order = Array.from(container.querySelectorAll<HTMLElement>('[data-asset]')).map(
      (el) => el.dataset.asset,
    );
    expect(order).toEqual(['RATES', 'BTC', 'XAU', 'XAG']);
  });

  describe('rates tile (chip grid)', () => {
    const CHOSEN = ['EUR', 'USD', 'GBP', 'JPY', 'CHF'];
    const RATES = { EUR: 1, USD: 1.1162, GBP: 0.8358, JPY: 169.421, CHF: 0.9304, AED: 4.1 };
    const CHIP_HISTORY: History = {
      today: {
        date: '2026-10-28',
        rates: { eur: 1, usd: 1.1162, gbp: 0.8358, jpy: 169.421, chf: 0.9304 },
      },
      previous: {
        date: '2026-10-27',
        rates: { eur: 1, usd: 1.114, gbp: 0.8358, jpy: 171.0, chf: 0.93042 },
      },
      fetchedAt: now,
    };
    const chipData = (data: Partial<InitialData> = {}): Partial<InitialData> => ({
      rates: { base: 'EUR', rates: RATES, fetchedAt: now, publishedAt: now },
      ...data,
    });
    const chips = (container: HTMLElement) =>
      Array.from(tile(container, 'RATES').querySelectorAll<HTMLElement>('li'));
    /** [code, value, change?]; the code is the head's last child (after the decorative badge). */
    const chipParts = (li: HTMLElement) =>
      Array.from(li.children).map((el, i) => plain(i === 0 ? (el.lastElementChild ?? el) : el));

    it('shows the base header and one chip per other chosen currency, in order', () => {
      const { container } = renderSection({ currencies: CHOSEN }, chipData());
      const rates = tile(container, 'RATES');
      expect(within(rates).getByRole('heading', { name: '1 EUR' })).toBeInTheDocument();
      expect(text(rates)).toContain(t('exchangeRate'));
      expect(chips(container).map(chipParts)).toEqual([
        ['USD', '1,1162'],
        ['GBP', '0,8358'],
        ['JPY', '169,42'],
        ['CHF', '0,9304'],
      ]);
    });

    it('colours the daily change by direction and labels each chip', () => {
      const { container } = renderSection(
        { currencies: CHOSEN },
        chipData({ history: CHIP_HISTORY }),
      );
      const changes = chips(container).map((li) => {
        const span = li.querySelector<HTMLElement>('[data-dir]');
        return span ? { text: plain(span), dir: span.dataset.dir } : null;
      });
      // CHF: -0,002 % rounds to 0,0 % and stays flat.
      expect(changes).toEqual([
        { text: '+0,2%', dir: 'up' },
        { text: '0,0%', dir: 'flat' },
        { text: '-0,9%', dir: 'down' },
        { text: '0,0%', dir: 'flat' },
      ]);
      const usd = chips(container)[0];
      const label = `1 EUR = 1,1162 USD, +0,2% ${t('sinceYesterday')}`;
      expect(usd).toHaveAttribute('aria-label', label);
      expect(usd).toHaveAttribute('title', label);
    });

    it('omits the change without snapshots', () => {
      const { container } = renderSection({ currencies: CHOSEN }, chipData({ history: null }));
      expect(tile(container, 'RATES').querySelectorAll('[data-dir]')).toHaveLength(0);
      expect(chips(container)[0]).toHaveAttribute('aria-label', '1 EUR = 1,1162 USD');
    });

    it('follows the base currency', () => {
      const { container } = renderSection({ currencies: CHOSEN, base: 'USD' }, chipData());
      const rates = tile(container, 'RATES');
      expect(within(rates).getByRole('heading', { name: '1 USD' })).toBeInTheDocument();
      expect(chipParts(chips(container)[0])).toEqual(['EUR', formatRate(1 / 1.1162)]);
      expect(chips(container).map((li) => chipParts(li)[0])).toEqual(['EUR', 'GBP', 'JPY', 'CHF']);
    });

    it('shows exactly one chip with the default two currencies', () => {
      const { container } = renderSection({ currencies: ['EUR', 'USD'] }, chipData());
      expect(chips(container).map(chipParts)).toEqual([['USD', '1,1162']]);
    });

    it('shows a dash for a currency missing from the rates table', () => {
      const { container } = renderSection({ currencies: ['EUR', 'SEK', 'USD'] }, chipData());
      expect(chips(container).map(chipParts)).toEqual([
        ['SEK', '—'],
        ['USD', '1,1162'],
      ]);
    });

    it('shows dashes and shimmer without rates', () => {
      const { container } = renderSection({ currencies: CHOSEN }, { rates: null });
      const rates = tile(container, 'RATES');
      expect(rates).toHaveAttribute('aria-busy', 'true');
      expect(rates.querySelector('[class*="loading"]')).not.toBeNull();
      expect(chips(container).map((li) => chipParts(li)[1])).toEqual(['—', '—', '—', '—']);
    });
  });

  it('shows daily change pills for gold and silver and falls back to it for BTC', () => {
    const { container } = renderSection(
      {},
      {
        history: HISTORY,
        quotes: {
          BTC: { id: 'BTC', priceUsd: 66000, updatedAt: now },
          XAU: { id: 'XAU', priceUsd: 4000, updatedAt: now },
          XAG: { id: 'XAG', priceUsd: 50, updatedAt: now },
        },
      },
    );
    const title = t('sinceYesterday');
    const pill = (id: string) => {
      const el = within(tile(container, id)).getByTitle(title);
      return {
        text: plain(el),
        label: (el.getAttribute('aria-label') ?? '').split(MINUS).join('-'),
      };
    };
    // Gold in EUR: 1 / 0.0002 = 5000 -> 1 / 0.00025 = 4000.
    expect(pill('XAU')).toEqual({ text: '-20,0%', label: `-20,0% ${title}` });
    expect(pill('XAG')).toEqual({ text: '0,0%', label: `0,0% ${title}` });
    // BTC in EUR: 50.000 -> 100.000, used because CoinGecko gave no 24 h change.
    expect(pill('BTC')).toEqual({ text: '+100,0%', label: `+100,0% ${title}` });
    expect(within(tile(container, 'XAG')).getByTitle(title).className).toMatch(/neutral/);
    expect(within(tile(container, 'XAU')).getByTitle(title).className).toMatch(/down/);
    expect(plain(tile(container, 'XAU'))).toContain('≈ 0,344 oz');
  });

  it('prefers the CoinGecko change for BTC over the snapshot', () => {
    const { container } = renderSection({}, { history: HISTORY });
    const pill = within(tile(container, 'BTC')).getByTitle(t('sinceYesterday'));
    expect(plain(pill)).toBe('-3,1%');
  });

  it('without snapshots: no change texts or metal pills, BTC keeps CoinGecko', () => {
    const { container } = renderSection({}, { history: null });
    const title = t('sinceYesterday');
    expect(changeSpans(tile(container, 'RATES'))).toEqual([]);
    expect(within(tile(container, 'XAU')).queryByTitle(title)).toBeNull();
    expect(within(tile(container, 'XAG')).queryByTitle(title)).toBeNull();
    expect(plain(within(tile(container, 'BTC')).getByTitle(title))).toBe('-3,1%');
  });

  it('without snapshots and without a CoinGecko change: no BTC pill', () => {
    const { container } = renderSection(
      {},
      { quotes: { BTC: { id: 'BTC', priceUsd: 66000, updatedAt: now } } },
    );
    expect(within(tile(container, 'BTC')).queryByTitle(t('sinceYesterday'))).toBeNull();
  });

  it('ticks the "ago" caption every 10 s', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    try {
      vi.setSystemTime(now);
      const { container } = renderSection();
      act(() => {
        vi.advanceTimersByTime(20_000);
      });
      expect(text(container)).toContain('live · 20s ago');
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(text(container)).toContain('live · 1 min ago');
    } finally {
      vi.useRealTimers();
    }
  });
});
