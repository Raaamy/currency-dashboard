import { act, fireEvent, render, screen } from '@testing-library/react';
import type { Rates } from '@/data';
import { AppProviders } from '@/state/AppProviders';
import type { InitialData } from '@/state/DataContext';
import { TopBar } from './TopBar';

const refreshAll = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock('@/data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data')>()),
  useRefreshAll: () => refreshAll,
}));

const rates: Rates = {
  base: 'EUR',
  rates: { EUR: 1, USD: 1.1, GBP: 0.85, AED: 4 },
  fetchedAt: 0,
  // Local time, so the caption does not depend on the test machine's time zone.
  publishedAt: new Date(2026, 9, 29, 1, 2).getTime(),
};

function renderBar(data: InitialData, compact = false) {
  return render(
    <AppProviders initialData={data}>
      <TopBar compact={compact} unitToggle={<span>toggle</span>} />
    </AppProviders>,
  );
}

afterEach(() => {
  refreshAll.mockClear();
  vi.useRealTimers();
});

describe('TopBar', () => {
  it('shows the "Rates updated" caption with the published time (wide)', () => {
    renderBar({ rates });
    expect(screen.getByText('Rates updated 29 Oct, 01:02')).toBeInTheDocument();
    expect(screen.getByText('Metals in')).toBeInTheDocument();
    expect(screen.getByText('toggle')).toBeInTheDocument();
  });

  it('narrow: "Updated …", "Live" and no unit toggle', () => {
    renderBar({ rates, marketsStatus: 'ok', lastMarketsRefresh: Date.now() }, true);
    expect(screen.getByText('Updated 29 Oct, 01:02')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.queryByText('Metals in')).toBeNull();
    expect(screen.queryByText('toggle')).toBeNull();
  });

  it('shows a dash when there are no rates', () => {
    renderBar({});
    expect(screen.getByText('Rates updated —')).toBeInTheDocument();
  });

  it('has one refresh button, and it calls refresh', async () => {
    renderBar({ rates });
    expect(screen.getAllByRole('button')).toHaveLength(1);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    });
    expect(refreshAll).toHaveBeenCalledTimes(1);
  });

  it('ticks the "ago" caption every 10 s', () => {
    vi.useFakeTimers();
    const start = Date.now();
    renderBar({ rates, marketsStatus: 'ok', lastMarketsRefresh: start });
    expect(screen.getByText('Live · 0s ago')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(20_000));
    expect(screen.getByText('Live · 20s ago')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByText('Live · 1 min ago')).toBeInTheDocument();
  });

  it('shows "Offline" when the rates or markets are stale, or a refresh failed', () => {
    const { unmount } = renderBar({ rates, marketsStatus: 'stale' });
    expect(screen.getByText('Offline')).toBeInTheDocument();
    unmount();
    renderBar({ rates, ratesStatus: 'loading', ratesError: 'timeout', lastMarketsRefresh: 1 });
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('shows no status before any market data', () => {
    renderBar({ rates });
    expect(screen.queryByText(/^Live/)).toBeNull();
    expect(screen.queryByText('Offline')).toBeNull();
  });
});
