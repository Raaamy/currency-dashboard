import { fireEvent, render, screen } from '@testing-library/react';
import type { Rates } from '@/data';
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
      initialSettings={{ language: 'nl', base: 'EUR', amount: '', ...settings }}
      initialData={{ rates }}
    >
      <ConverterCard />
    </AppProviders>,
  );
}

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
  it('converts the typed amount into the other three currencies (nl)', () => {
    renderCard();
    expect(screen.getByRole('heading', { name: 'Omrekenen' })).toBeInTheDocument();
    typeInto(screen.getByRole('textbox', { name: 'EUR Euro' }), '1.234,56');

    expect(rowAmount('USD Amerikaanse dollar')).toBe('1.358,02');
    expect(rowAmount('GBP Britse pond')).toBe('1.049,38');
    expect(rowAmount('AED VAE-dirham')).toBe('4.938,24');
  });

  it('makes a tapped row the active one and keeps the typed text', () => {
    renderCard();
    typeInto(screen.getByRole('textbox', { name: 'EUR Euro' }), '1.234,56');
    fireEvent.click(screen.getByRole('button', { name: 'USD Amerikaanse dollar' }));

    const usd = screen.getByRole('textbox', { name: 'USD Amerikaanse dollar' });
    expect(usd).toHaveValue('1.234,56');
    expect(usd.closest('li')).toHaveAttribute('aria-current', 'true');
    expect(screen.queryByRole('textbox', { name: 'EUR Euro' })).not.toBeInTheDocument();
    expect(rowAmount('EUR Euro')).toBe('1.122,33');
  });

  it('formats per language (en)', () => {
    renderCard({ language: 'en' });
    typeInto(screen.getByRole('textbox', { name: 'EUR Euro' }), '1,234.56');
    expect(rowAmount('USD US dollar')).toBe('1,358.02');
  });

  it('shows a dash on the inactive rows when there are no rates', () => {
    renderCard({}, null);
    expect(rowAmount('USD Amerikaanse dollar')).toBe('—');
    expect(rowAmount('GBP Britse pond')).toBe('—');
    expect(rowAmount('AED VAE-dirham')).toBe('—');
    const input = screen.getByRole('textbox', { name: 'EUR Euro' });
    typeInto(input, '12');
    expect(input).toHaveValue('12');
  });

  it('shows 0 on the other rows for empty input', () => {
    renderCard();
    expect(rowAmount('USD Amerikaanse dollar')).toBe('0,00');
  });

  it('has the input attributes for a decimal keypad', () => {
    renderCard();
    const input = screen.getByRole('textbox', { name: 'EUR Euro' });
    expect(input).toHaveAttribute('inputmode', 'decimal');
    expect(input).toHaveAttribute('enterkeyhint', 'done');
    expect(input).toHaveAttribute('autocomplete', 'off');
  });

  it('blurs the input on Enter', () => {
    renderCard();
    const input = screen.getByRole('textbox', { name: 'EUR Euro' });
    input.focus();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input).not.toHaveFocus();
  });

  it('keeps focus on the new input when the input was focused at the tap', () => {
    renderCard({ amount: '5' });
    screen.getByRole('textbox', { name: 'EUR Euro' }).focus();
    const gbp = screen.getByRole('button', { name: 'GBP Britse pond' });
    fireEvent.pointerDown(gbp);
    fireEvent.click(gbp, { detail: 1 });
    expect(screen.getByRole('textbox', { name: 'GBP Britse pond' })).toHaveFocus();
  });

  it('does not focus the input on a tap while the input was not focused', () => {
    renderCard({ amount: '5' });
    const gbp = screen.getByRole('button', { name: 'GBP Britse pond' });
    fireEvent.pointerDown(gbp);
    fireEvent.click(gbp, { detail: 1 });
    expect(screen.getByRole('textbox', { name: 'GBP Britse pond' })).not.toHaveFocus();
  });

  it('focuses the new input after keyboard activation', () => {
    renderCard({ amount: '5' });
    const gbp = screen.getByRole('button', { name: 'GBP Britse pond' });
    gbp.focus();
    fireEvent.click(gbp, { detail: 0 });
    expect(screen.getByRole('textbox', { name: 'GBP Britse pond' })).toHaveFocus();
  });
});
