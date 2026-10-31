import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/App';
import { installDialogPolyfill } from '@/components/Picker/testDialog';
import type { History, Rates } from '@/data';
import type { InitialData } from '@/state/DataContext';
import { AppProviders } from '@/state/AppProviders';
import type { Settings } from '@/state/SettingsContext';

const now = Date.now();

const RATES: Rates = {
  base: 'EUR',
  rates: { EUR: 1, USD: 1.1162, GBP: 0.8358, CHF: 0.93, JPY: 170, AED: 4.0991 },
  fetchedAt: now,
  publishedAt: now,
};

const HISTORY: History = {
  today: {
    date: '2026-10-30',
    rates: { eur: 1, usd: 1.1162, gbp: 0.8358, xau: 0.000277, xag: 0.0221, btc: 0.00001445 },
  },
  previous: {
    date: '2026-10-29',
    rates: { eur: 1, usd: 1.12, gbp: 0.8358, xau: 0.000275, xag: 0.0223, btc: 0.0000139 },
  },
  fetchedAt: now,
};

const DATA: InitialData = {
  rates: RATES,
  quotes: {
    BTC: { id: 'BTC', priceUsd: 77260, change24hPct: 1, updatedAt: now },
    XAU: { id: 'XAU', priceUsd: 4020, updatedAt: now },
    XAG: { id: 'XAG', priceUsd: 50.3, updatedAt: now },
  },
  history: HISTORY,
  marketsStatus: 'ok',
  lastMarketsRefresh: now,
};

const SETTINGS: Partial<Settings> = {
  items: ['EUR', 'USD', 'GBP', 'XAU', 'XAG', 'BTC'],
  base: 'EUR',
  amount: '100.000',
  metalUnit: 'g',
};

function renderApp(settings: Partial<Settings> = {}, data: Partial<InitialData> = {}) {
  return render(
    <AppProviders initialSettings={{ ...SETTINGS, ...settings }} initialData={{ ...DATA, ...data }}>
      <App />
    </AppProviders>,
  );
}

beforeAll(() => {
  installDialogPolyfill();
});

const MINUS = String.fromCharCode(0x2212);
const NBSP = new RegExp(String.fromCharCode(0xa0), 'g');

/** Accessible names of the result buttons, in display order. */
const resultLabels = () =>
  screen
    .queryAllByRole('button')
    .map((b) => (b.getAttribute('aria-label') ?? '').replace(NBSP, ' '))
    .filter((label) => label.includes(' = '));

/** Result button by the start of its label ("Gold", "USD US Dollar"). */
const result = (name: string) =>
  screen.getByRole('button', { name: (label) => label.startsWith(`${name},`) });

const amountInput = () => screen.getByRole('textbox', { name: /^Amount in / }) as HTMLInputElement;

/** nl-NL text to a number (`99.999,49` -> 99999.49). */
const nl = (text: string) => Number(text.replace(/\./g, '').replace(',', '.'));

describe('App results (SPEC §13)', () => {
  it('shows every item but the base in list order, with amount, unit, rate line and badge', () => {
    renderApp();
    expect(resultLabels()).toEqual([
      `USD US Dollar, 111.620,00 USD, 1 EUR = 1,1162 USD, ${MINUS}0,3% vs yesterday`,
      'GBP British Pound, 83.580,00 GBP, 1 EUR = 0,8358 GBP, 0,0% vs yesterday',
      `Gold, 864 g, 1 g gold = 115,79 EUR, ${MINUS}0,7% vs yesterday`,
      'Silver, 69.021 g, 1 g silver = 1,4488 EUR, +0,9% vs yesterday',
      `Bitcoin, 1,4447 BTC, 1 BTC = 69.217 EUR, ${MINUS}3,8% vs yesterday`,
    ]);
    const gold = result('Gold');
    expect(within(gold).getByText('864')).toBeInTheDocument();
    expect(within(gold).getByText('g')).toBeInTheDocument();
    expect(within(gold).getByText('1 g gold = 115,79 EUR')).toBeInTheDocument();
    expect(within(gold).getByText(`${MINUS}0,7%`)).toHaveAttribute('data-dir', 'down');
    expect(within(result('Silver')).getByText('+0,9%')).toHaveAttribute('data-dir', 'up');
    expect(within(result('GBP British Pound')).getByText('0,0%')).toHaveAttribute(
      'data-dir',
      'neutral',
    );
  });

  it('shows Bitcoin with 6 decimals below 1 and omits badges without snapshots', () => {
    renderApp({ amount: '10.000' }, { history: null });
    expect(resultLabels()).toContain('Bitcoin, 0,144473 BTC, 1 BTC = 69.217 EUR');
    expect(resultLabels().some((l) => l.includes('vs yesterday'))).toBe(false);
  });

  it('shows dashes without rates', () => {
    renderApp({}, { rates: null });
    expect(resultLabels()[0]).toMatch(/^USD US Dollar, — USD, 1 EUR = — USD/);
  });

  it('labels the input "Amount in …" and shows the base in the card', () => {
    renderApp();
    const card = screen.getByRole('region', { name: 'Convert from' });
    expect(within(card).getByText('EUR')).toBeInTheDocument();
    expect(amountInput()).toHaveValue('100.000');
    expect(amountInput()).toHaveAttribute('inputmode', 'decimal');
    expect(within(card).getByText('Click any result to convert from that currency or metal.'));
  });

  it('tapping Gold makes Gold the base with the gold amount; EUR shows ~100.000,00', () => {
    renderApp();
    fireEvent.click(result('Gold'), { detail: 1 });

    expect(screen.getByRole('textbox', { name: 'Amount in g gold' })).toHaveValue('863,62');
    const card = screen.getByRole('region', { name: 'Convert from' });
    expect(within(card).getByText('Gold')).toBeInTheDocument();
    expect(within(card).getByText('XAU')).toBeInTheDocument();
    expect(resultLabels().some((l) => l.startsWith('Gold,'))).toBe(false);

    const eur = resultLabels().find((l) => l.startsWith('EUR Euro,'));
    expect(eur).toMatch(/^EUR Euro, 99\.999,49 EUR, 1 g gold = 115,79 EUR/);
    // Within the rounding of the input's 2 decimals (0,005 g x 115,79 EUR).
    expect(Math.abs(nl(eur!.split(', ')[1].split(' ')[0]) - 100000)).toBeLessThan(0.6);
    expect(localStorage.getItem('wissel.settings')).toContain('"base":"XAU"');
  });

  it('keeps an empty input empty when a result is tapped', () => {
    renderApp({ amount: '' });
    expect(resultLabels()[0]).toMatch(/^USD US Dollar, 0,00 USD/);
    fireEvent.click(result('USD US Dollar'));
    expect(screen.getByRole('textbox', { name: 'Amount in USD' })).toHaveValue('');
  });

  it('focuses the amount after a keyboard activation of a result', () => {
    renderApp();
    const usd = result('USD US Dollar');
    usd.focus();
    fireEvent.click(usd, { detail: 0 });
    expect(screen.getByRole('textbox', { name: 'Amount in USD' })).toHaveFocus();
    expect(amountInput()).toHaveValue('111.620,00');
  });
});

describe('App metal unit toggle', () => {
  it('switches the metal amounts and rate lines between g, oz and kg', async () => {
    const user = userEvent.setup();
    renderApp();
    const group = screen.getByRole('radiogroup', { name: 'Metals in' });
    expect(within(group).getByRole('radio', { name: 'g' })).toHaveAttribute('aria-checked', 'true');

    await user.click(within(group).getByRole('radio', { name: 'oz' }));
    expect(within(group).getByRole('radio', { name: 'oz' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(resultLabels()).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^Gold, 27,77 oz, 1 oz gold = 3\.601,51 EUR/),
        expect.stringMatching(/^Silver, 2\.219,09 oz, 1 oz silver = 45,06 EUR/),
        expect.stringMatching(/^USD US Dollar, 111\.620,00 USD/),
      ]),
    );

    // Arrow keys move the selection (radio group).
    await user.keyboard('{ArrowRight}');
    expect(within(group).getByRole('radio', { name: 'kg' })).toHaveFocus();
    expect(resultLabels()).toContainEqual(
      expect.stringMatching(/^Gold, 0,864 kg, 1 kg gold = 115\.791 EUR/),
    );
    expect(localStorage.getItem('wissel.settings')).toContain('"metalUnit":"kg"');
  });

  it('re-labels a metal base and converts its quantity (10 g -> 0,322 oz)', async () => {
    const user = userEvent.setup();
    renderApp({ base: 'XAU', amount: '10' });
    expect(amountInput()).toHaveAccessibleName('Amount in g gold');
    await user.click(screen.getByRole('radio', { name: 'oz' }));
    expect(amountInput()).toHaveAccessibleName('Amount in oz gold');
    expect(amountInput()).toHaveValue('0,322');
    expect(resultLabels()[0]).toMatch(/^EUR Euro, 1\.159,68 EUR, 1 oz gold = 3\.601,51 EUR/);
  });

  it('is absent when no metal is listed', () => {
    renderApp({ items: ['EUR', 'USD', 'BTC'] });
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.queryByText('Metals in')).toBeNull();
  });
});

describe('App amount input formatting (SPEC §12)', () => {
  it('groups thousands while typing and converts', async () => {
    const user = userEvent.setup();
    renderApp({ amount: '' });
    await user.type(amountInput(), '10000');
    expect(amountInput()).toHaveValue('10.000');
    expect(amountInput().selectionStart).toBe(6);
    expect(resultLabels()[0]).toMatch(/^USD US Dollar, 11\.162,00 USD/);
  });

  it('keeps a typed decimal comma, reads a final dot as decimal, drops extras', async () => {
    const user = userEvent.setup();
    renderApp({ amount: '' });
    await user.type(amountInput(), '1234,5');
    expect(amountInput()).toHaveValue('1.234,5');
    await user.clear(amountInput());
    await user.type(amountInput(), '12.5');
    expect(amountInput()).toHaveValue('12,5');
    await user.clear(amountInput());
    await user.type(amountInput(), '1a2,345');
    expect(amountInput()).toHaveValue('12,34');
    expect(amountInput().selectionStart).toBe(5);
  });

  it('accepts English-style paste but shows Dutch notation', () => {
    renderApp({ amount: '' });
    fireEvent.change(amountInput(), { target: { value: '1,234.56' } });
    expect(amountInput()).toHaveValue('1.234,56');
  });

  it('keeps the caret between the same digits when typing in the middle', async () => {
    const user = userEvent.setup();
    renderApp({ amount: '1.234' });
    await user.type(amountInput(), '9', { initialSelectionStart: 3, initialSelectionEnd: 3 });
    expect(amountInput()).toHaveValue('12.934');
    expect(amountInput().selectionStart).toBe(4);
  });

  it('Backspace right after a group dot deletes the digit before it', async () => {
    const user = userEvent.setup();
    renderApp({ amount: '1.234' });
    await user.type(amountInput(), '{Backspace}', {
      initialSelectionStart: 2,
      initialSelectionEnd: 2,
    });
    expect(amountInput()).toHaveValue('234');
    expect(amountInput().selectionStart).toBe(0);
  });

  it('uses the base input decimals (JPY 0, BTC 8)', async () => {
    const user = userEvent.setup();
    renderApp({ items: ['JPY', 'EUR', 'BTC'], base: 'JPY', amount: '' });
    await user.type(amountInput(), '12,5');
    expect(amountInput()).toHaveValue('125');
    fireEvent.click(result('Bitcoin'));
    await user.clear(amountInput());
    await user.type(amountInput(), '0,123456789');
    expect(amountInput()).toHaveValue('0,12345678');
  });

  it('blurs the input on Enter', () => {
    renderApp();
    amountInput().focus();
    fireEvent.keyDown(amountInput(), { key: 'Enter' });
    expect(amountInput()).not.toHaveFocus();
  });
});

describe('App live status', () => {
  it('shows "Live · ns ago" while the data is fresh', () => {
    renderApp();
    expect(screen.getByText(/^Live · \d+s ago$/)).toBeInTheDocument();
  });

  it('shows "Offline" when the markets or the rates are stale', () => {
    const { unmount } = renderApp({}, { marketsStatus: 'stale' });
    expect(screen.getByText('Offline')).toBeInTheDocument();
    unmount();
    renderApp({}, { ratesStatus: 'stale' });
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });
});

describe('App edit mode (SPEC §13 "Edit mode")', () => {
  const editButton = () => screen.getByRole('button', { name: /^(Edit|Done)$/ });
  const removeButtons = () =>
    screen.queryAllByRole('button', { name: /^Remove / }).map((b) => b.getAttribute('aria-label'));

  it('lists all items with remove buttons and the base marked "From"', async () => {
    const user = userEvent.setup();
    renderApp();
    expect(editButton()).toHaveAttribute('aria-pressed', 'false');
    await user.click(editButton());
    expect(editButton()).toHaveTextContent('Done');
    expect(resultLabels()).toEqual([]);
    expect(removeButtons()).toEqual([
      'Remove EUR',
      'Remove USD',
      'Remove GBP',
      'Remove Gold',
      'Remove Silver',
      'Remove Bitcoin',
    ]);
    const eurRow = screen.getByRole('button', { name: 'Remove EUR' }).closest('li')!;
    expect(eurRow).toHaveAttribute('aria-current', 'true');
    expect(within(eurRow).getByText('From')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add currency or asset' })).toBeInTheDocument();
  });

  it('removes USD; focus moves to the next remove button; results follow after Done', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(editButton());
    await user.click(screen.getByRole('button', { name: 'Remove USD' }));
    expect(screen.getByRole('button', { name: 'Remove GBP' })).toHaveFocus();
    await user.click(editButton());
    expect(resultLabels().map((l) => l.split(',')[0])).toEqual([
      'GBP British Pound',
      'Gold',
      'Silver',
      'Bitcoin',
    ]);
  });

  it('hides the remove buttons at two items and focuses Done', async () => {
    const user = userEvent.setup();
    renderApp({ items: ['EUR', 'USD', 'XAU'] });
    await user.click(editButton());
    await user.click(screen.getByRole('button', { name: 'Remove Gold' }));
    expect(removeButtons()).toEqual([]);
    expect(editButton()).toHaveFocus();
    expect(screen.getAllByRole('button', { name: /^Reorder / })).toHaveLength(2);
  });

  it('removing the base makes the first remaining item the base', async () => {
    const user = userEvent.setup();
    renderApp({ items: ['EUR', 'USD', 'GBP'], amount: '5' });
    await user.click(editButton());
    await user.click(screen.getByRole('button', { name: 'Remove EUR' }));
    const usdRow = screen.getByRole('button', { name: 'Reorder USD' }).closest('li')!;
    expect(within(usdRow).getByText('From')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Amount in USD' })).toHaveValue('5');
  });
});

describe('App reordering (SPEC §12)', () => {
  const ROW_HEIGHT = 72;
  let restoreLayout: () => void;

  beforeEach(() => {
    // jsdom has no layout: stack the list items (and size the list around them, it is the
    // parent element the drag is restricted to) so dnd-kit can measure.
    const rect = Element.prototype.getBoundingClientRect;
    const scroll = Element.prototype.scrollIntoView;
    Element.prototype.getBoundingClientRect = function (this: Element) {
      const li = this.closest('li');
      const index = li?.parentElement ? Array.from(li.parentElement.children).indexOf(li) : 0;
      const top = index * ROW_HEIGHT;
      const height = this.tagName === 'UL' ? this.children.length * ROW_HEIGHT : 64;
      return {
        x: 0,
        y: top,
        top,
        left: 0,
        width: 320,
        height,
        right: 320,
        bottom: top + height,
        toJSON: () => ({}),
      } as DOMRect;
    };
    Element.prototype.scrollIntoView = () => undefined;
    restoreLayout = () => {
      Element.prototype.getBoundingClientRect = rect;
      Element.prototype.scrollIntoView = scroll;
    };
  });

  afterEach(() => restoreLayout());

  /** dnd-kit's live region (the announcements). */
  const liveRegion = () =>
    screen.getAllByRole('status').find((el) => el.id.startsWith('DndLiveRegion'))!;
  const handles = () =>
    screen.getAllByRole('button', { name: /^Reorder / }).map((h) => h.getAttribute('aria-label'));

  it('moves USD below GBP with the keyboard; the results follow', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(handles()).toEqual([
      'Reorder EUR',
      'Reorder USD',
      'Reorder GBP',
      'Reorder Gold',
      'Reorder Silver',
      'Reorder Bitcoin',
    ]);
    screen.getByRole('button', { name: 'Reorder USD' }).focus();
    await user.keyboard(' ');
    await waitFor(() => expect(liveRegion()).toHaveTextContent('Picked up USD.'));
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(liveRegion()).toHaveTextContent('USD moved to position 3 of 6.'));
    await user.keyboard(' ');
    await waitFor(() => expect(handles()[1]).toBe('Reorder GBP'));
    expect(liveRegion()).toHaveTextContent('USD dropped at position 3 of 6.');
    expect(localStorage.getItem('wissel.settings')).toContain(
      '"items":["EUR","GBP","USD","XAU","XAG","BTC"]',
    );

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(resultLabels().map((l) => l.split(',')[0])).toEqual([
      'GBP British Pound',
      'USD US Dollar',
      'Gold',
      'Silver',
      'Bitcoin',
    ]);
    expect(amountInput()).toHaveValue('100.000');
  });

  it('Escape cancels a keyboard move', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    screen.getByRole('button', { name: 'Reorder Bitcoin' }).focus();
    await user.keyboard(' ');
    await user.keyboard('{ArrowUp}');
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(liveRegion()).toHaveTextContent(
        'Reordering cancelled. Bitcoin returned to position 6.',
      ),
    );
    expect(handles()[5]).toBe('Reorder Bitcoin');
  });
});

describe('App picker (SPEC §13 "Picker")', () => {
  it('adds Bitcoin back after it was removed', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Remove Bitcoin' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(resultLabels().some((l) => l.startsWith('Bitcoin,'))).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Add currency or asset' }));
    const dialog = screen.getByRole('dialog', { name: 'Add currency or asset' });
    const assets = within(dialog).getByRole('region', { name: 'Assets' });
    const bitcoin = within(assets).getByRole('button', { name: 'Bitcoin BTC' });
    expect(bitcoin).toHaveAttribute('aria-pressed', 'false');
    await user.click(bitcoin);
    expect(bitcoin).toHaveAttribute('aria-pressed', 'true');
    expect(resultLabels().at(-1)).toMatch(/^Bitcoin, 1,4447 BTC/);
  });
});

describe('App narrow form (convert column < 400 px)', () => {
  let restore: () => void;

  beforeEach(() => {
    const rect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      return { width: 358, height: 0, top: 0, left: 0, right: 358, bottom: 0 } as DOMRect;
    };
    class FakeResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    restore = () => {
      Element.prototype.getBoundingClientRect = rect;
      vi.unstubAllGlobals();
    };
  });

  afterEach(() => restore());

  it('puts the input inline, the hint and the unit toggle below the card, Edit by the list', () => {
    renderApp({ base: 'XAU', amount: '10' });
    const card = screen.getByRole('region', { name: 'Convert from' });
    expect(within(card).getByText('Gold (g)')).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(within(card).getByRole('textbox', { name: 'Amount in g gold' })).toHaveValue('10');
    expect(screen.getByText('Tap a row to convert from it')).toBeInTheDocument();
    expect(screen.getAllByRole('radiogroup', { name: 'Metals in' })).toHaveLength(1);
    expect(screen.queryByText('Metals in')).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add currency or asset' })).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText(/^Updated /)).toBeInTheDocument();
  });
});
