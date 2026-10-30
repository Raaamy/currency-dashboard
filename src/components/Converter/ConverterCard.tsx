import { useEffect, useId, useLayoutEffect, useRef, type MouseEvent } from 'react';
import { Card } from '@/components/ui/Card';
import { useRates } from '@/data';
import { useT } from '@/i18n';
import { getCurrency, type Currency, type CurrencyCode } from '@/lib/currencies';
import { convert, formatMoney, parseAmount } from '@/lib/money';
import { useSettings } from '@/state/SettingsContext';
import styles from './ConverterCard.module.css';
import { CurrencyRow } from './CurrencyRow';

/**
 * Converter card (SPEC §7.2-7.3, §8, §11): one row per chosen currency, in settings order; the active (base) row owns the
 * input, the others show the converted amount and become the base when tapped.
 *
 * Focus on row tap: `pointerdown` on a row button fires before focus leaves the input, so it
 * records whether the input was focused (keyboard open). On `click` the base changes and a
 * layout effect focuses the new row's input only if it was, or if the row was activated from
 * the keyboard (`detail === 0`, otherwise focus would fall to <body> when the button unmounts).
 * A plain tap with the keyboard closed never focuses, so the mobile keyboard does not pop up.
 */
export function ConverterCard() {
  const { currencies, base, amount, setBase, setAmount } = useSettings();
  const { data } = useRates();
  const t = useT();
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputFocusedOnPress = useRef(false);
  const focusAfterSwitch = useRef(false);

  const rates = data?.rates ?? null;
  const parsed = parseAmount(amount);

  // SPEC §7.1: focus the amount on open only where a keyboard will not pop up (mouse devices).
  useEffect(() => {
    if (window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) {
      inputRef.current?.focus();
    }
  }, []);

  useLayoutEffect(() => {
    if (!focusAfterSwitch.current) return;
    focusAfterSwitch.current = false;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    const end = input.value.length;
    input.setSelectionRange(end, end);
  }, [base]);

  const handlePress = () => {
    inputFocusedOnPress.current =
      inputRef.current !== null && document.activeElement === inputRef.current;
  };

  const handleSelect = (code: CurrencyCode, event: MouseEvent<HTMLButtonElement>) => {
    const fromKeyboard = event.detail === 0;
    focusAfterSwitch.current = inputFocusedOnPress.current || fromKeyboard;
    inputFocusedOnPress.current = false;
    setBase(code);
  };

  const display = (currency: Currency): { text: string; muted: boolean } => {
    if (!rates) return { text: '—', muted: true };
    const opts = { symbol: false, decimals: currency.decimals };
    // NaN when the base or this code is missing from the rates table: formats as `—`.
    const value = convert(parsed ?? 0, base, currency.code, rates);
    if (!Number.isFinite(value)) return { text: '—', muted: true };
    return { text: formatMoney(value, currency.code, opts), muted: parsed === null };
  };

  return (
    <Card className={styles.card} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.title}>
        {t('convert')}
      </h2>
      <ul className={styles.list}>
        {currencies
          .map((code) => getCurrency(code))
          .map((currency) => {
            const active = currency.code === base;
            const { text, muted } = active ? { text: '', muted: false } : display(currency);
            return (
              <CurrencyRow
                key={currency.code}
                currency={currency}
                name={currency.name}
                active={active}
                loading={rates === null}
                amountText={text}
                muted={muted}
                value={amount}
                onValueChange={setAmount}
                inputRef={inputRef}
                onPress={handlePress}
                onSelect={(event) => handleSelect(currency.code, event)}
              />
            );
          })}
      </ul>
    </Card>
  );
}
