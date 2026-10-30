import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import { CurrencyPicker } from '@/components/Picker/CurrencyPicker';
import { Card } from '@/components/ui/Card';
import { useRates } from '@/data';
import { useT } from '@/i18n';
import { getCurrency, type Currency, type CurrencyCode } from '@/lib/currencies';
import { convert, formatMoney, parseAmount } from '@/lib/money';
import { MIN_CURRENCIES, useSettings } from '@/state/SettingsContext';
import styles from './ConverterCard.module.css';
import { CurrencyRow } from './CurrencyRow';

function PlusIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/**
 * Converter card (SPEC §7.2-7.3, §8, §11): one row per chosen currency, in settings order; the active (base) row owns the
 * input, the others show the converted amount and become the base when tapped.
 *
 * Focus on row tap: `pointerdown` on a row button fires before focus leaves the input, so it
 * records whether the input was focused (keyboard open). On `click` the base changes and a
 * layout effect focuses the new row's input only if it was, or if the row was activated from
 * the keyboard (`detail === 0`, otherwise focus would fall to <body> when the button unmounts).
 * A plain tap with the keyboard closed never focuses, so the mobile keyboard does not pop up.
 *
 * Edit mode (SPEC §11): rows show badge, code and name only, plus a remove button while more
 * than `MIN_CURRENCIES` are chosen. After a removal focus moves to the next row's remove
 * button (the previous one for the last row), or to "Done" once the remove buttons are gone.
 * The "Add currency" row opens the picker (a modal dialog, so it can live inside the card).
 */
export function ConverterCard() {
  const { currencies, base, amount, setBase, setAmount, removeCurrency } = useSettings();
  const { data } = useRates();
  const t = useT();
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputFocusedOnPress = useRef(false);
  const focusAfterSwitch = useRef(false);
  const [editing, setEditing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const removeButtons = useRef(new Map<CurrencyCode, HTMLButtonElement>());
  /** After a removal: the code whose remove button gets focus, or `null` for the Done button. */
  const focusAfterRemove = useRef<{ code: CurrencyCode | null } | null>(null);
  const canRemove = currencies.length > MIN_CURRENCIES;

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

  useLayoutEffect(() => {
    const target = focusAfterRemove.current;
    if (!target) return;
    focusAfterRemove.current = null;
    const button = target.code ? removeButtons.current.get(target.code) : undefined;
    (button ?? editButtonRef.current)?.focus();
  }, [currencies]);

  const handleRemove = (code: CurrencyCode) => {
    const index = currencies.indexOf(code);
    const remaining = currencies.filter((c) => c !== code);
    const next =
      remaining.length > MIN_CURRENCIES ? (remaining[index] ?? remaining[index - 1]) : null;
    focusAfterRemove.current = { code: next ?? null };
    removeCurrency(code);
  };

  const removeRef = (code: CurrencyCode) => (button: HTMLButtonElement | null) => {
    if (button) removeButtons.current.set(code, button);
    else removeButtons.current.delete(code);
  };

  const closePicker = useCallback(() => setPickerOpen(false), []);

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
      <div className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          {t('convert')}
        </h2>
        <button
          ref={editButtonRef}
          type="button"
          className={styles.editButton}
          aria-pressed={editing}
          onClick={() => setEditing((e) => !e)}
        >
          {t(editing ? 'done' : 'edit')}
        </button>
      </div>
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
                editing={editing}
                onRemove={canRemove ? () => handleRemove(currency.code) : undefined}
                removeLabel={t('removeCurrency', { code: currency.code })}
                removeRef={removeRef(currency.code)}
              />
            );
          })}
        <li>
          <button type="button" className={styles.addRow} onClick={() => setPickerOpen(true)}>
            <span className={styles.addCircle} aria-hidden="true">
              <PlusIcon />
            </span>
            <span className={styles.addLabel}>{t('addCurrency')}</span>
          </button>
        </li>
      </ul>
      <CurrencyPicker open={pickerOpen} onClose={closePicker} />
    </Card>
  );
}
