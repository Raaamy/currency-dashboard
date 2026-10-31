import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Rates } from '@/data';
import { getCurrency, POPULAR } from '@/lib/currencies';
import { AppProviders } from '@/state/AppProviders';
import { useSettings, type Settings } from '@/state/SettingsContext';
import { ItemPicker } from './ItemPicker';
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

/** The picker with an opener and the current item list (`data-testid="items"`). */
function Harness() {
  const [open, setOpen] = useState(false);
  const { items } = useSettings();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Add currency or asset
      </button>
      <output data-testid="items">{items.join(',')}</output>
      <ItemPicker open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function renderCard(settings: Partial<Settings> = {}, rates: Rates | null = RATES) {
  return render(
    <AppProviders
      initialSettings={{ items: ['EUR', 'USD'], base: 'EUR', amount: '', ...settings }}
      initialData={{ rates }}
    >
      <Harness />
    </AppProviders>,
  );
}

const label = (code: string) => `${code} ${getCurrency(code).name}`;

const dialogElement = () => document.querySelector('dialog') as HTMLDialogElement;

/** The chosen items, in order. */
const converterRows = (): string[] => screen.getByTestId('items').textContent!.split(',');

function openPicker() {
  fireEvent.click(screen.getByRole('button', { name: 'Add currency or asset' }));
  return screen.getByRole('dialog', { name: 'Add currency or asset' });
}

/** Ends the exit transition (jsdom never fires `transitionend` on its own). */
const endTransition = () => fireEvent.transitionEnd(dialogElement());

const item = (dialog: HTMLElement, code: string) =>
  within(dialog).getByRole('button', { name: label(code) });

describe('ItemPicker', () => {
  it('opens from "Add currency or asset" and adds a currency; the sheet stays open', () => {
    renderCard();
    const dialog = openPicker();
    expect(dialogElement()).toHaveAttribute('open');
    expect(
      within(dialog).getByRole('heading', { name: 'Add currency or asset' }),
    ).toBeInTheDocument();

    const chf = item(dialog, 'CHF');
    expect(chf).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(chf);

    expect(converterRows()).toEqual(['EUR', 'USD', 'CHF']);
    expect(item(dialog, 'CHF')).toHaveAttribute('aria-pressed', 'true');
    expect(dialogElement()).toHaveAttribute('open');

    fireEvent.click(item(dialog, 'JPY'));
    expect(converterRows()).toEqual(['EUR', 'USD', 'CHF', 'JPY']);
  });

  it('lists Gold, Silver and Bitcoin first in an Assets section and adds or removes them', () => {
    renderCard({ items: ['EUR', 'USD', 'XAU'] });
    const dialog = openPicker();
    const regions = within(dialog).getAllByRole('region');
    expect(regions.map((r) => r.querySelector('h3')?.textContent)).toEqual([
      'Assets',
      'Popular',
      'All currencies',
    ]);
    const assets = within(dialog).getByRole('region', { name: 'Assets' });
    expect(
      within(assets)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Gold XAU', 'Silver XAG', 'Bitcoin BTC']);
    expect(within(assets).getByRole('button', { name: 'Gold XAU' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(within(assets).getByRole('button', { name: 'Bitcoin BTC' }));
    expect(converterRows()).toEqual(['EUR', 'USD', 'XAU', 'BTC']);
    fireEvent.click(within(assets).getByRole('button', { name: 'Gold XAU' }));
    expect(converterRows()).toEqual(['EUR', 'USD', 'BTC']);
  });

  it('finds assets by name and code in the search', () => {
    renderCard();
    const dialog = openPicker();
    const search = within(dialog).getByRole('searchbox', { name: 'Search currency' });
    fireEvent.change(search, { target: { value: 'gold' } });
    expect(
      within(dialog)
        .getAllByRole('button', { name: / / })
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Gold XAU']);
    fireEvent.change(search, { target: { value: 'btc' } });
    expect(within(dialog).getByRole('button', { name: 'Bitcoin BTC' })).toBeInTheDocument();
  });

  it('never lists an asset id among the currencies', () => {
    renderCard({}, { ...RATES, rates: { ...RATES.rates, XAU: 0.0003 } });
    const dialog = openPicker();
    expect(within(dialog).getAllByRole('button', { name: /XAU/ })).toHaveLength(1);
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
    fireEvent.pointerDown(within(dialog).getByRole('heading', { name: 'Add currency or asset' }));
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
