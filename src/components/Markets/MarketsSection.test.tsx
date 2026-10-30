import { act, render, screen, within } from '@testing-library/react';
import type { InitialData } from '@/state/DataContext';
import { AppProviders } from '@/state/AppProviders';
import type { Settings } from '@/state/SettingsContext';
import { t } from '@/i18n';
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
      initialSettings={{ language: 'nl', base: 'EUR', amount: '1250', ...settings }}
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

describe('MarketsSection', () => {
  it('shows quantities, unit prices and the change pill for 1250 EUR', () => {
    const { container } = renderSection();
    expect(screen.getByRole('heading', { name: t('nl', 'markets') })).toBeInTheDocument();

    const btc = text(tile(container, 'BTC'));
    expect(btc).toContain('0,020833 BTC');
    expect(btc).toContain('60.000');
    expect(btc).toContain('per bitcoin');
    expect(btc).toContain('−3,1');

    const gold = text(tile(container, 'XAU'));
    expect(gold).toContain('10,69 g');
    expect(gold).toContain('≈ 0,344 oz');
    expect(gold).toContain('per gram');
    expect(gold).toContain('per troy ounce');

    // 855.35 g: SPEC §8 formats grams >= 100 with 0 decimals.
    expect(text(tile(container, 'XAG'))).toContain('855 g');
    expect(text(tile(container, 'XAG'))).toContain('≈ 27,50 oz');
    expect(text(container)).toContain('live · 0 s geleden');
  });

  it('shows zero quantities for an empty amount', () => {
    const { container } = renderSection({ amount: '' });
    expect(text(tile(container, 'BTC'))).toContain('0 BTC');
    expect(text(tile(container, 'XAU'))).toContain('0 g');
    expect(text(tile(container, 'XAG'))).toContain('0 g');
  });

  it('shows the offline caption when stale', () => {
    renderSection({}, { marketsStatus: 'stale' });
    expect(screen.getByText(t('nl', 'offline'))).toBeInTheDocument();
  });

  it('shows dashes for a missing quote', () => {
    const { container } = renderSection({}, { quotes: {}, marketsStatus: 'idle' });
    const btc = tile(container, 'BTC');
    expect(within(btc).getByText('Bitcoin')).toBeInTheDocument();
    expect(text(btc)).toContain('—');
  });

  it('shows 1 EUR in the other currencies on the rates tile', () => {
    const { container } = renderSection();
    const rates = tile(container, 'RATES');
    expect(within(rates).getByRole('heading', { name: '1 EUR' })).toBeInTheDocument();
    expect(text(rates)).toContain(t('nl', 'exchangeRate'));
    const lines = Array.from(rates.querySelectorAll('p'))
      .map(text)
      .filter((l) => l !== t('nl', 'exchangeRate'));
    expect(lines).toEqual(['1,1000 USD', '0,8500 GBP', '4,0000 AED']);
  });

  it('follows the base currency on the rates tile', () => {
    const { container } = renderSection({ base: 'USD' });
    const rates = tile(container, 'RATES');
    expect(within(rates).getByRole('heading', { name: '1 USD' })).toBeInTheDocument();
    const lines = Array.from(rates.querySelectorAll('p'))
      .map(text)
      .filter((l) => l !== t('nl', 'exchangeRate'));
    expect(lines).toEqual(['0,9091 EUR', '0,7727 GBP', '3,6364 AED']);
  });

  it('shows dashes and shimmer on the rates tile without rates', () => {
    const { container } = renderSection({}, { rates: null });
    const rates = tile(container, 'RATES');
    expect(rates).toHaveAttribute('aria-busy', 'true');
    expect(text(rates).split('—')).toHaveLength(4);
  });

  it('ticks the "ago" caption every 10 s', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    try {
      vi.setSystemTime(now);
      const { container } = renderSection();
      act(() => {
        vi.advanceTimersByTime(20_000);
      });
      expect(text(container)).toContain('live · 20 s geleden');
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(text(container)).toContain('live · 1 min geleden');
    } finally {
      vi.useRealTimers();
    }
  });
});
