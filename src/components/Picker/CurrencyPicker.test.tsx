import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ConverterCard } from '@/components/Converter/ConverterCard';
import type { Rates } from '@/data';
import { getCurrency, POPULAR } from '@/lib/currencies';
import { AppProviders } from '@/state/AppProviders';
import type { Settings } from '@/state/SettingsContext';
import { installDialogPolyfill } from './testDialog';

const RATES: Rates = {
  base: 'EUR',
  rates: {
    EUR: 1,
    USD: 1.1,
    GBP: 0.85,
    AED: 4.0,
    CHF: 0.95,
    JPY: 170,
    CAD: 1.5,
    BAM: 1.96,
    ISK: 150,
    SEK: 11.4,
  },
  fetchedAt: Date.now(),
  publishedAt: Date.now(),
};

beforeAll(() => {
  installDialogPolyfill();
});

function renderCard(settings: Partial<Settings> = {}, rates: Rates | null = RATES) {
  return render(
    <AppProviders
      initialSettings={{ items: ['EUR', 'USD'], base: 'EUR', amount: '', ...settings }}
      initialData={{ rates }}
    >
      <ConverterCard />
    </AppProviders>,
  );
}

const label = (code: string) => `${code} ${getCurrency(code).name}`;

const dialogElement = () => document.querySelector('dialog') as HTMLDialogElement;

/** Codes of the converter's own rows (the dialog has lists too); the add row has no label. */
function converterRows(): string[] {
  const section = screen.getByRole('heading', { name: 'Convert' }).closest('section')!;
  const list = section.querySelector(':scope > ul')!;
  return Array.from(list.querySelectorAll(':scope > li'))
    .map((li) => li.querySelector('[aria-label]')?.getAttribute('aria-label')?.slice(0, 3) ?? '')
    .filter(Boolean);
}

function openPicker() {
  fireEvent.click(screen.getByRole('button', { name: 'Add currency' }));
  return screen.getByRole('dialog', { name: 'Add currency' });
}

/** Ends the exit transition (jsdom never fires `transitionend` on its own). */
const endTransition = () => fireEvent.transitionEnd(dialogElement());

const item = (dialog: HTMLElement, code: string) =>
  within(dialog).getByRole('button', { name: label(code) });

describe('CurrencyPicker', () => {
  it('opens from "Add currency" and adds a currency; the sheet stays open', () => {
    renderCard();
    const dialog = openPicker();
    expect(dialogElement()).toHaveAttribute('open');
    expect(within(dialog).getByRole('heading', { name: 'Add currency' })).toBeInTheDocument();

    const chf = item(dialog, 'CHF');
    expect(chf).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(chf);

    expect(converterRows()).toEqual(['EUR', 'USD', 'CHF']);
    expect(item(dialog, 'CHF')).toHaveAttribute('aria-pressed', 'true');
    expect(dialogElement()).toHaveAttribute('open');

    fireEvent.click(item(dialog, 'JPY'));
    expect(converterRows()).toEqual(['EUR', 'USD', 'CHF', 'JPY']);
  });

  it('shows the popular codes the rates table has, then the rest sorted by name', () => {
    renderCard();
    const dialog = openPicker();
    const popular = within(dialog).getByRole('region', { name: 'Popular' });
    const all = within(dialog).getByRole('region', { name: 'All currencies' });
    const codes = (region: HTMLElement) =>
      within(region)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')?.slice(0, 3));
    expect(codes(popular)).toEqual(['EUR', 'USD', 'GBP', 'AED', 'CHF', 'JPY', 'CAD', 'SEK']);
    // Bosnia-Herzegovina Convertible Mark, Icelandic Króna
    expect(codes(all)).toEqual(['BAM', 'ISK']);
  });

  it('falls back to the popular list without rates', () => {
    renderCard({}, null);
    const dialog = openPicker();
    const popular = within(dialog).getByRole('region', { name: 'Popular' });
    expect(within(popular).getAllByRole('button')).toHaveLength(POPULAR.length);
    expect(within(dialog).queryByRole('region', { name: 'All currencies' })).toBeNull();
  });

  it('marks chosen currencies with aria-pressed', () => {
    renderCard();
    const dialog = openPicker();
    expect(item(dialog, 'EUR')).toHaveAttribute('aria-pressed', 'true');
    expect(item(dialog, 'USD')).toHaveAttribute('aria-pressed', 'true');
    expect(item(dialog, 'GBP')).toHaveAttribute('aria-pressed', 'false');
  });

  it('removes a chosen currency when more than two are chosen', () => {
    renderCard({ items: ['EUR', 'USD', 'GBP'] });
    const dialog = openPicker();
    expect(item(dialog, 'GBP')).not.toHaveAttribute('aria-disabled');
    fireEvent.click(item(dialog, 'GBP'));
    expect(converterRows()).toEqual(['EUR', 'USD']);
    expect(item(dialog, 'GBP')).toHaveAttribute('aria-pressed', 'false');
  });

  it('does not remove when only two are chosen', () => {
    renderCard();
    const dialog = openPicker();
    const usd = item(dialog, 'USD');
    expect(usd).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(usd);
    expect(converterRows()).toEqual(['EUR', 'USD']);
    expect(item(dialog, 'USD')).toHaveAttribute('aria-pressed', 'true');
    expect(item(dialog, 'GBP')).not.toHaveAttribute('aria-disabled');
  });

  it('filters by code or name, case- and accent-insensitive', () => {
    renderCard();
    const dialog = openPicker();
    const search = within(dialog).getByRole('searchbox', { name: 'Search currency' });
    expect(search).toHaveAttribute('enterkeyhint', 'search');
    expect(search).toHaveAttribute('placeholder', 'Search currency');

    fireEvent.change(search, { target: { value: 'swiss' } });
    expect(within(dialog).queryByRole('region')).toBeNull();
    expect(within(dialog).getAllByRole('button', { name: /^[A-Z]{3} / })).toEqual([
      item(dialog, 'CHF'),
    ]);

    fireEvent.change(search, { target: { value: 'gbp' } });
    expect(within(dialog).getAllByRole('button', { name: /^[A-Z]{3} / })).toEqual([
      item(dialog, 'GBP'),
    ]);

    // ICU names ISK "Icelandic Króna" (SEK is "Swedish Krona"): the folded query finds both,
    // popular first.
    expect(getCurrency('ISK').name).toMatch(/Króna/);
    fireEvent.change(search, { target: { value: 'KRONA' } });
    expect(within(dialog).getAllByRole('button', { name: /^[A-Z]{3} / })).toEqual([
      item(dialog, 'SEK'),
      item(dialog, 'ISK'),
    ]);
    fireEvent.change(search, { target: { value: 'króna' } });
    expect(within(dialog).getAllByRole('button', { name: /^[A-Z]{3} / })).toHaveLength(2);

    fireEvent.change(search, { target: { value: 'zz' } });
    expect(within(dialog).getByText('No currencies found')).toBeInTheDocument();
    expect(within(dialog).queryAllByRole('button', { name: /^[A-Z]{3} / })).toHaveLength(0);
  });

  it('clears the search when it opens again', () => {
    renderCard();
    let dialog = openPicker();
    fireEvent.change(within(dialog).getByRole('searchbox'), { target: { value: 'swiss' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    endTransition();
    dialog = openPicker();
    expect(within(dialog).getByRole('searchbox')).toHaveValue('');
    expect(within(dialog).getByRole('region', { name: 'Popular' })).toBeInTheDocument();
  });

  it('focuses the close button on open without a fine pointer (jsdom)', () => {
    renderCard();
    const dialog = openPicker();
    expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('locks body scroll while open', () => {
    renderCard();
    const dialog = openPicker();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(document.body.style.overflow).toBe('');
  });

  it('closes via the close button, Escape and the native close event, and reopens', () => {
    renderCard();
    const closers: Array<[string, () => void]> = [
      [
        'close button',
        () => {
          fireEvent.click(within(dialogElement()).getByRole('button', { name: 'Close' }));
          endTransition();
        },
      ],
      [
        'Escape (cancel)',
        () => {
          const cancel = new Event('cancel', { cancelable: true });
          fireEvent(dialogElement(), cancel);
          expect(cancel.defaultPrevented).toBe(true);
          endTransition();
        },
      ],
      ['native close', () => act(() => dialogElement().close())],
      [
        'backdrop',
        () => {
          fireEvent.pointerDown(dialogElement());
          fireEvent.click(dialogElement());
          endTransition();
        },
      ],
    ];
    for (const [, close] of closers) {
      for (let i = 0; i < 3; i++) {
        openPicker();
        expect(dialogElement()).toHaveAttribute('open');
        close();
        expect(dialogElement()).not.toHaveAttribute('open');
        expect(screen.queryByRole('dialog')).toBeNull();
      }
    }
  });

  it('does not close on a click inside the sheet', () => {
    renderCard();
    const dialog = openPicker();
    fireEvent.pointerDown(within(dialog).getByRole('heading', { name: 'Add currency' }));
    fireEvent.click(dialogElement());
    expect(dialogElement()).toHaveAttribute('open');
  });

  it('closes after the fallback timeout when no transitionend arrives', async () => {
    renderCard();
    const dialog = openPicker();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(dialogElement()).not.toHaveAttribute('open'));
    openPicker();
    expect(dialogElement()).toHaveAttribute('open');
  });
});
