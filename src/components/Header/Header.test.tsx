import { act, fireEvent, render, screen } from '@testing-library/react';
import type { Rates } from '@/data';
import { AppProviders } from '@/state/AppProviders';
import type { InitialData } from '@/state/DataContext';
import { Header } from './Header';

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

function renderHeader(data: InitialData) {
  return render(
    <AppProviders initialData={data}>
      <Header />
    </AppProviders>,
  );
}

const caption = () => screen.getByRole('banner').querySelector('p') as HTMLElement;

afterEach(() => {
  refreshAll.mockClear();
});

describe('Header', () => {
  it('shows the English "updated" caption with the published time', () => {
    renderHeader({ rates });
    expect(caption()).toHaveTextContent('Rates updated 29 Oct, 01:02');
  });

  it('has only the refresh button, and it calls refresh', async () => {
    renderHeader({ rates });
    expect(screen.getAllByRole('button')).toHaveLength(1);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    });
    expect(refreshAll).toHaveBeenCalledTimes(1);
  });

  it('shows a dash when there are no rates', () => {
    renderHeader({});
    expect(caption()).toHaveTextContent('Rates updated —');
  });
});
