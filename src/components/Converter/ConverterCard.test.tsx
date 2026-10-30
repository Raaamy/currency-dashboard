import { fireEvent, render, screen, within } from '@testing-library/react';
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
      initialSettings={{ currencies: [...LEGACY_CURRENCIES], base: 'EUR', amount: '', ...settings }}
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
    renderCard({ currencies: ['USD', 'EUR'], base: 'EUR' });
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('USD');
    expect(rows[1]).toHaveTextContent('EUR');
    expect(within(rows[2]).getByRole('button', { name: 'Add currency' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: label('EUR') })).toBeInTheDocument();
  });

  it('shows a dash for a chosen code missing from the rates table', () => {
    renderCard({ currencies: ['EUR', 'USD', 'CHF'], amount: '10' });
    expect(rowAmount(label('USD'))).toBe('11,00');
    expect(rowAmount(label('CHF'))).toBe('—');
  });

  it('formats currencies without minor units without decimals (JPY)', () => {
    const rates = { ...RATES, rates: { ...RATES.rates, JPY: 170 } };
    renderCard({ currencies: ['EUR', 'JPY'], amount: '12,34' }, rates);
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
    typeInto(screen.getByRole('textbox', { name: label('EUR') }), '1,234.56');
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
      renderCard({ currencies: ['EUR', 'USD', 'GBP'], amount: '10' });
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
      renderCard({ currencies: ['EUR', 'USD', 'GBP'] });
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
      renderCard({ currencies: ['EUR', 'USD', 'GBP', 'AED', 'CHF'] });
      fireEvent.click(editButton());
      fireEvent.click(screen.getByRole('button', { name: 'Remove USD' }));
      expect(screen.getByRole('button', { name: 'Remove GBP' })).toHaveFocus();
      fireEvent.click(screen.getByRole('button', { name: 'Remove CHF' }));
      expect(screen.getByRole('button', { name: 'Remove AED' })).toHaveFocus();
    });

    it('does not switch the base when a row is tapped', () => {
      renderCard({ currencies: ['EUR', 'USD', 'GBP'] });
      fireEvent.click(editButton());
      fireEvent.click(screen.getByText('USD'));
      fireEvent.click(editButton());
      expect(screen.getByRole('textbox', { name: label('EUR') })).toBeInTheDocument();
    });

    it('removing the base makes the first remaining currency the active row', () => {
      renderCard({ currencies: ['EUR', 'USD', 'GBP'], base: 'EUR', amount: '5' });
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
