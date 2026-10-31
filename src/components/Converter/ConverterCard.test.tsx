import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/App';
import type { Rates } from '@/data';
import { getCurrency, LEGACY_CURRENCIES } from '@/lib/currencies';
import type { Settings } from '@/state/SettingsContext';
import { AppProviders } from '@/state/AppProviders';
import { ConverterCard } from './ConverterCard';

const RATES: Rates = {
  base: 'EUR',
  rates: { EUR: 1, USD: 1.1, GBP: 0.85, AED: 4.0 },
  fetchedAt: Date.now(),
  publishedAt: Date.now(),
};

function renderCard(settings: Partial<Settings> = {}, rates: Rates | null = RATES) {
  return render(
    <AppProviders
      initialSettings={{ items: [...LEGACY_CURRENCIES], base: 'EUR', amount: '', ...settings }}
      initialData={{ rates }}
    >
      <ConverterCard />
    </AppProviders>,
  );
}

/** Accessible name of a row: code + English name from the registry. */
const label = (code: string) => `${code} ${getCurrency(code).name}`;

const normalise = (text: string | null | undefined) => (text ?? '').replace(/\u00a0/g, ' ');

/** The converted amount shown on an inactive row (its button's accessible description). */
function rowAmount(name: string): string {
  const button = screen.getByRole('button', { name });
  const id = button.getAttribute('aria-describedby');
  return normalise(id ? document.getElementById(id)?.textContent : null);
}

const typeInto = (input: HTMLElement, value: string) =>
  fireEvent.change(input, { target: { value } });

describe('ConverterCard', () => {
  it('renders one row per chosen currency, in settings order', () => {
    renderCard({ items: ['USD', 'EUR'], base: 'EUR' });
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('USD');
    expect(rows[1]).toHaveTextContent('EUR');
    expect(within(rows[2]).getByRole('button', { name: 'Add currency' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: label('EUR') })).toBeInTheDocument();
  });

  it('shows a dash for a chosen code missing from the rates table', () => {
    renderCard({ items: ['EUR', 'USD', 'CHF'], amount: '10' });
    expect(rowAmount(label('USD'))).toBe('11,00');
    expect(rowAmount(label('CHF'))).toBe('—');
  });

  it('formats currencies without minor units without decimals (JPY)', () => {
    const rates = { ...RATES, rates: { ...RATES.rates, JPY: 170 } };
    renderCard({ items: ['EUR', 'JPY'], amount: '12,34' }, rates);
    expect(rowAmount(label('JPY'))).toBe('2.098');
  });

  it('converts the typed amount into the other three currencies (Dutch notation)', () => {
    renderCard();
    expect(screen.getByRole('heading', { name: 'Convert' })).toBeInTheDocument();
    typeInto(screen.getByRole('textbox', { name: label('EUR') }), '1.234,56');

    expect(rowAmount(label('USD'))).toBe('1.358,02');
    expect(rowAmount(label('GBP'))).toBe('1.049,38');
    expect(rowAmount(label('AED'))).toBe('4.938,24');
  });

  it('makes a tapped row the active one and keeps the typed text', () => {
    renderCard();
    typeInto(screen.getByRole('textbox', { name: label('EUR') }), '1.234,56');
    fireEvent.click(screen.getByRole('button', { name: label('USD') }));

    const usd = screen.getByRole('textbox', { name: label('USD') });
    expect(usd).toHaveValue('1.234,56');
    expect(usd.closest('li')).toHaveAttribute('aria-current', 'true');
    expect(screen.queryByRole('textbox', { name: label('EUR') })).not.toBeInTheDocument();
    expect(rowAmount(label('EUR'))).toBe('1.122,33');
  });

  it('accepts English-style input but always shows Dutch notation', () => {
    renderCard();
    const input = screen.getByRole('textbox', { name: label('EUR') });
    typeInto(input, '1,234.56');
    expect(input).toHaveValue('1.234,56');
    expect(rowAmount(label('USD'))).toBe('1.358,02');
    typeInto(input, '1234.56');
    expect(input).toHaveValue('1.234,56');
    expect(rowAmount(label('USD'))).toBe('1.358,02');
  });

  it('shows a dash on the inactive rows when there are no rates', () => {
    renderCard({}, null);
    expect(rowAmount(label('USD'))).toBe('—');
    expect(rowAmount(label('GBP'))).toBe('—');
    expect(rowAmount(label('AED'))).toBe('—');
    const input = screen.getByRole('textbox', { name: label('EUR') });
    typeInto(input, '12');
    expect(input).toHaveValue('12');
  });

  it('shows 0 on the other rows for empty input', () => {
    renderCard();
    expect(rowAmount(label('USD'))).toBe('0,00');
  });

  it('has the input attributes for a decimal keypad', () => {
    renderCard();
    const input = screen.getByRole('textbox', { name: label('EUR') });
    expect(input).toHaveAttribute('inputmode', 'decimal');
    expect(input).toHaveAttribute('enterkeyhint', 'done');
    expect(input).toHaveAttribute('autocomplete', 'off');
  });

  it('blurs the input on Enter', () => {
    renderCard();
    const input = screen.getByRole('textbox', { name: label('EUR') });
    input.focus();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input).not.toHaveFocus();
  });

  it('keeps focus on the new input when the input was focused at the tap', () => {
    renderCard({ amount: '5' });
    screen.getByRole('textbox', { name: label('EUR') }).focus();
    const gbp = screen.getByRole('button', { name: label('GBP') });
    fireEvent.pointerDown(gbp);
    fireEvent.click(gbp, { detail: 1 });
    expect(screen.getByRole('textbox', { name: label('GBP') })).toHaveFocus();
  });

  it('does not focus the input on a tap while the input was not focused', () => {
    renderCard({ amount: '5' });
    const gbp = screen.getByRole('button', { name: label('GBP') });
    fireEvent.pointerDown(gbp);
    fireEvent.click(gbp, { detail: 1 });
    expect(screen.getByRole('textbox', { name: label('GBP') })).not.toHaveFocus();
  });

  it('focuses the new input after keyboard activation', () => {
    renderCard({ amount: '5' });
    const gbp = screen.getByRole('button', { name: label('GBP') });
    gbp.focus();
    fireEvent.click(gbp, { detail: 0 });
    expect(screen.getByRole('textbox', { name: label('GBP') })).toHaveFocus();
  });

  describe('edit mode', () => {
    const editButton = () => screen.getByRole('button', { name: /^(Edit|Done)$/ });
    const removeButtons = () => screen.queryAllByRole('button', { name: /^Remove / });
    const currencyRows = () =>
      screen.getAllByRole('listitem').filter((li) => !within(li).queryByText('Add currency'));

    it('toggles with Edit/Done and shows badge, code and name only', () => {
      renderCard({ items: ['EUR', 'USD', 'GBP'], amount: '10' });
      expect(editButton()).toHaveTextContent('Edit');
      expect(editButton()).toHaveAttribute('aria-pressed', 'false');

      fireEvent.click(editButton());
      expect(editButton()).toHaveTextContent('Done');
      expect(editButton()).toHaveAttribute('aria-pressed', 'true');
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: label('USD') })).not.toBeInTheDocument();
      expect(screen.queryByText('11,00')).not.toBeInTheDocument();
      expect(removeButtons().map((b) => b.getAttribute('aria-label'))).toEqual([
        'Remove EUR',
        'Remove USD',
        'Remove GBP',
      ]);
      expect(screen.getByRole('button', { name: 'Add currency' })).toBeInTheDocument();

      fireEvent.click(editButton());
      expect(screen.getByRole('textbox', { name: label('EUR') })).toBeInTheDocument();
      expect(rowAmount(label('USD'))).toBe('11,00');
      expect(removeButtons()).toHaveLength(0);
    });

    it('removes a currency; the remove buttons disappear at two', () => {
      renderCard({ items: ['EUR', 'USD', 'GBP'] });
      fireEvent.click(editButton());
      fireEvent.click(screen.getByRole('button', { name: 'Remove USD' }));

      const rows = currencyRows();
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveTextContent('EUR');
      expect(rows[1]).toHaveTextContent('GBP');
      expect(removeButtons()).toHaveLength(0);
      // Focus is not dropped to <body>: it lands on Done.
      expect(editButton()).toHaveFocus();
    });

    it('moves focus to the next remove button (or the previous one for the last row)', () => {
      renderCard({ items: ['EUR', 'USD', 'GBP', 'AED', 'CHF'] });
      fireEvent.click(editButton());
      fireEvent.click(screen.getByRole('button', { name: 'Remove USD' }));
      expect(screen.getByRole('button', { name: 'Remove GBP' })).toHaveFocus();
      fireEvent.click(screen.getByRole('button', { name: 'Remove CHF' }));
      expect(screen.getByRole('button', { name: 'Remove AED' })).toHaveFocus();
    });

    it('does not switch the base when a row is tapped', () => {
      renderCard({ items: ['EUR', 'USD', 'GBP'] });
      fireEvent.click(editButton());
      fireEvent.click(screen.getByText('USD'));
      fireEvent.click(editButton());
      expect(screen.getByRole('textbox', { name: label('EUR') })).toBeInTheDocument();
    });

    it('removing the base makes the first remaining currency the active row', () => {
      renderCard({ items: ['EUR', 'USD', 'GBP'], base: 'EUR', amount: '5' });
      fireEvent.click(editButton());
      fireEvent.click(screen.getByRole('button', { name: 'Remove EUR' }));
      expect(currencyRows()[0]).toHaveAttribute('aria-current', 'true');
      expect(currencyRows()[0]).toHaveTextContent('USD');

      fireEvent.click(editButton());
      const usd = screen.getByRole('textbox', { name: label('USD') });
      expect(usd).toHaveValue('5');
      expect(usd.closest('li')).toHaveAttribute('aria-current', 'true');
    });
  });
});

describe('ConverterCard live amount formatting (SPEC §12)', () => {
  const input = (code = 'EUR') =>
    screen.getByRole('textbox', { name: label(code) }) as HTMLInputElement;

  it('groups thousands while typing and converts', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.type(input(), '10000');
    expect(input()).toHaveValue('10.000');
    expect(input().selectionStart).toBe(6);
    expect(rowAmount(label('USD'))).toBe('11.000,00');
  });

  it('keeps a typed decimal comma and the fraction', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.type(input(), '1234,5');
    expect(input()).toHaveValue('1.234,5');
    expect(rowAmount(label('USD'))).toBe('1.357,95');
  });

  it('reads a typed dot at the end as the decimal separator', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.type(input(), '12.5');
    expect(input()).toHaveValue('12,5');
  });

  it('drops extra decimals and stray characters', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.type(input(), '1a2,345');
    expect(input()).toHaveValue('12,34');
    expect(input().selectionStart).toBe(5);
  });

  it('keeps the caret between the same digits when typing in the middle', async () => {
    const user = userEvent.setup();
    renderCard({ amount: '1.234' });
    // '1.2|34' + '9' -> '12.9|34'
    await user.type(input(), '9', { initialSelectionStart: 3, initialSelectionEnd: 3 });
    expect(input()).toHaveValue('12.934');
    expect(input().selectionStart).toBe(4);
  });

  it('Backspace right after a group dot deletes the digit before it', async () => {
    const user = userEvent.setup();
    renderCard({ amount: '1.234' });
    await user.type(input(), '{Backspace}', { initialSelectionStart: 2, initialSelectionEnd: 2 });
    expect(input()).toHaveValue('234');
    expect(input().selectionStart).toBe(0);
  });

  it('with base JPY (0 decimals) ignores the separator while typing', async () => {
    const user = userEvent.setup();
    const rates = { ...RATES, rates: { ...RATES.rates, JPY: 170 } };
    renderCard({ items: ['JPY', 'EUR'], base: 'JPY' }, rates);
    await user.type(input('JPY'), '12,5');
    expect(input('JPY')).toHaveValue('125');
    expect(rowAmount(label('EUR'))).toBe('0,74');
  });

  it('re-formats the amount when the base switches to a currency with other decimals', () => {
    const rates = { ...RATES, rates: { ...RATES.rates, JPY: 170 } };
    renderCard({ items: ['EUR', 'JPY'], amount: '12,50' }, rates);
    fireEvent.click(screen.getByRole('button', { name: label('JPY') }));
    expect(input('JPY')).toHaveValue('12');
    expect(rowAmount(label('EUR'))).toBe('0,07');
  });
});

describe('ConverterCard reordering (SPEC §12)', () => {
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

  const renderApp = () =>
    render(
      <AppProviders
        initialSettings={{ items: ['EUR', 'USD', 'GBP'], base: 'EUR', amount: '10' }}
        initialData={{
          rates: RATES,
          quotes: {
            BTC: { id: 'BTC', priceUsd: 66000, change24hPct: 1, updatedAt: Date.now() },
            XAU: { id: 'XAU', priceUsd: 4000, updatedAt: Date.now() },
            XAG: { id: 'XAG', priceUsd: 50, updatedAt: Date.now() },
          },
          marketsStatus: 'ok',
          lastMarketsRefresh: Date.now(),
        }}
      >
        <App />
      </AppProviders>,
    );

  const converter = () => screen.getByRole('region', { name: 'Convert' });
  /** dnd-kit's live region (the announcements). */
  const liveRegion = () => within(converter()).getByRole('status');
  const rowCodes = () =>
    within(converter())
      .getAllByRole('listitem')
      .filter((li) => !within(li).queryByText('Add currency'))
      .map((li) => li.textContent?.match(/[A-Z]{3}/)?.[0]);
  const chipCodes = () =>
    Array.from(document.querySelectorAll('[data-asset="RATES"] li')).map(
      (li) => li.getAttribute('aria-label')?.split(' ')[4],
    );

  it('shows a reorder handle per currency in edit mode only; the Add row has none', async () => {
    const user = userEvent.setup();
    renderApp();
    expect(screen.queryAllByRole('button', { name: /^Reorder / })).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const handles = screen.getAllByRole('button', { name: /^Reorder / });
    expect(handles.map((h) => h.getAttribute('aria-label'))).toEqual([
      'Reorder EUR',
      'Reorder USD',
      'Reorder GBP',
    ]);
    const addRow = screen.getByRole('button', { name: 'Add currency' }).closest('li');
    expect(addRow).not.toBeNull();
    expect(within(addRow as HTMLElement).queryByRole('button', { name: /^Reorder / })).toBeNull();
    expect(addRow?.querySelector('[aria-roledescription]')).toBeNull();
  });

  it('moves USD below GBP with the keyboard; the rows and the rate chips follow', async () => {
    const user = userEvent.setup();
    renderApp();
    expect(rowCodes()).toEqual(['EUR', 'USD', 'GBP']);
    expect(chipCodes()).toEqual(['USD', 'GBP']);

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    screen.getByRole('button', { name: 'Reorder USD' }).focus();
    await user.keyboard(' ');
    await waitFor(() => expect(liveRegion()).toHaveTextContent('Picked up USD.'));
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(liveRegion()).toHaveTextContent('USD moved to position 3 of 3.'));
    await user.keyboard(' ');
    await waitFor(() => expect(rowCodes()).toEqual(['EUR', 'GBP', 'USD']));
    expect(liveRegion()).toHaveTextContent('USD dropped at position 3 of 3.');
    expect(chipCodes()).toEqual(['GBP', 'USD']);
    expect(localStorage.getItem('wissel.settings')).toContain('"items":["EUR","GBP","USD"]');

    // The base stays the base; leaving edit mode shows the input on EUR again.
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('textbox', { name: label('EUR') })).toHaveValue('10');
  });

  it('Escape cancels a keyboard move', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    screen.getByRole('button', { name: 'Reorder EUR' }).focus();
    await user.keyboard(' ');
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(liveRegion()).toHaveTextContent('Reordering cancelled. EUR returned to position 1.'),
    );
    expect(rowCodes()).toEqual(['EUR', 'USD', 'GBP']);
  });

  it('keeps the remove buttons working next to the handles', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Remove USD' }));
    expect(rowCodes()).toEqual(['EUR', 'GBP']);
    expect(screen.getByRole('button', { name: 'Done' })).toHaveFocus();
  });
});
