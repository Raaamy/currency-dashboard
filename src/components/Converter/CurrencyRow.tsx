import { useId, type ChangeEvent, type KeyboardEvent, type MouseEvent, type Ref } from 'react';
import { SymbolBadge } from '@/components/ui/SymbolBadge';
import type { Currency } from '@/lib/currencies';
import styles from './CurrencyRow.module.css';

export interface CurrencyRowProps {
  currency: Currency;
  /** Localised currency name, e.g. "Amerikaanse dollar". */
  name: string;
  active: boolean;
  /** No rates yet (empty state): inactive rows shimmer. */
  loading: boolean;
  /** Inactive rows: the formatted converted amount (or "—"). */
  amountText: string;
  /** Inactive rows: grey the amount (empty input or no rates). */
  muted: boolean;
  /** Active row: the raw input text. */
  value: string;
  onValueChange: (value: string) => void;
  inputRef: Ref<HTMLInputElement>;
  /** Inactive rows: pointer pressed (fires before focus leaves the input). */
  onPress: () => void;
  /** Inactive rows: activated by tap, click or keyboard. */
  onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
}

function blurOnEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.currentTarget.blur();
}

export function CurrencyRow({
  currency,
  name,
  active,
  loading,
  amountText,
  muted,
  value,
  onValueChange,
  inputRef,
  onPress,
  onSelect,
}: CurrencyRowProps) {
  const amountId = useId();
  const label = `${currency.code} ${name}`;
  const rowClass = [
    styles.row,
    active ? styles.active : '',
    loading && !active ? styles.loading : '',
  ]
    .filter(Boolean)
    .join(' ');

  const texts = (
    <>
      <SymbolBadge tint={currency.tint} symbol={currency.symbol} />
      <span className={styles.texts}>
        <span className={styles.code}>{currency.code}</span>
        <span className={styles.name}>{name}</span>
      </span>
    </>
  );

  // The <li> stays mounted across active/inactive so its background and border transition.
  return (
    <li className={rowClass} aria-current={active ? 'true' : undefined}>
      {active ? (
        // A label so tapping anywhere on the active row focuses the input.
        <label className={styles.content}>
          {texts}
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="0"
            aria-label={label}
            value={value}
            // Fallback width hint where `field-sizing: content` is unsupported.
            size={Math.max(value.length, 1) + 1}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onValueChange(event.target.value)}
            onKeyDown={blurOnEnter}
          />
        </label>
      ) : (
        <button
          type="button"
          className={`${styles.content} ${styles.button}`}
          aria-label={label}
          aria-describedby={amountId}
          onPointerDown={onPress}
          onClick={onSelect}
        >
          {texts}
          <span
            id={amountId}
            className={muted ? `${styles.amount} ${styles.muted}` : styles.amount}
          >
            {amountText}
          </span>
        </button>
      )}
    </li>
  );
}
