import {
  useId,
  useLayoutEffect,
  useRef,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
  type Ref,
} from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SymbolBadge } from '@/components/ui/SymbolBadge';
import { formatAmountInput } from '@/lib/amountInput';
import type { Currency } from '@/lib/currencies';
import styles from './CurrencyRow.module.css';

/** dnd-kit's sortable transition option (`{ duration, easing }`, `null` for none). */
export type SortTransition = Parameters<typeof useSortable>[0]['transition'];

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
  /** Active row: the formatted input text (SPEC §12); edits are re-formatted with `currency.decimals`. */
  value: string;
  onValueChange: (value: string) => void;
  inputRef: Ref<HTMLInputElement>;
  /** Inactive rows: pointer pressed (fires before focus leaves the input). */
  onPress: () => void;
  /** Inactive rows: activated by tap, click or keyboard. */
  onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
  /** Edit mode: no input, no amount, no base switch; badge, code and name only. */
  editing?: boolean;
  /** Edit mode: shows the remove button when given (hidden at the minimum count). */
  onRemove?: () => void;
  /** Edit mode: accessible name of the remove button ("Remove USD"). */
  removeLabel?: string;
  removeRef?: Ref<HTMLButtonElement>;
  /** Edit mode: accessible name of the drag handle ("Reorder USD"). */
  reorderLabel?: string;
  /** Edit mode: slide transition for the sortable rows; `null` for none (reduced motion). */
  sortTransition?: SortTransition;
}

function MinusIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.4"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 12h14" />
    </svg>
  );
}

/** Six dots, 2 columns x 3 rows (SPEC §12 drag handle). */
function GripIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="6.5" cy="4" r="1.6" />
      <circle cx="11.5" cy="4" r="1.6" />
      <circle cx="6.5" cy="9" r="1.6" />
      <circle cx="11.5" cy="9" r="1.6" />
      <circle cx="6.5" cy="14" r="1.6" />
      <circle cx="11.5" cy="14" r="1.6" />
    </svg>
  );
}

function blurOnEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.currentTarget.blur();
}

/**
 * The key behind an edit, for `formatAmountInput`: the typed character, `Backspace` or
 * `Delete`; undefined for a paste, drop or autocomplete (paste rules). Uses the InputEvent's
 * `inputType`, falling back to the last keydown where the engine does not report it.
 */
function editKey(native: { inputType?: string; data?: string | null }, keyDown?: string) {
  switch (native.inputType) {
    case undefined:
    case '':
      return keyDown;
    case 'deleteContentBackward':
      return 'Backspace';
    case 'deleteContentForward':
      return 'Delete';
    case 'insertText':
      return native.data?.length === 1 ? native.data : undefined;
    default:
      return undefined;
  }
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
  editing = false,
  onRemove,
  removeLabel,
  removeRef,
  reorderLabel,
  sortTransition,
}: CurrencyRowProps) {
  const amountId = useId();
  const label = `${currency.code} ${name}`;
  // Sortable only in edit mode; the drag handle is the only activator (SPEC §12).
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: currency.code, disabled: !editing, transition: sortTransition });
  const rowClass = [
    styles.row,
    active ? styles.active : '',
    loading && !active && !editing ? styles.loading : '',
    isDragging ? styles.dragging : '',
  ]
    .filter(Boolean)
    .join(' ');
  const rowStyle = editing
    ? { transform: CSS.Transform.toString(transform), transition }
    : undefined;

  /** Caret to restore after the re-render that applies a formatted value. */
  const pendingCaret = useRef<{ input: HTMLInputElement; caret: number } | null>(null);
  /** Last keydown, the fallback for `editKey` where `inputType` is missing. */
  const keyDown = useRef<string | undefined>(undefined);

  useLayoutEffect(() => {
    const pending = pendingCaret.current;
    if (!pending) return;
    pendingCaret.current = null;
    if (document.activeElement === pending.input) {
      pending.input.setSelectionRange(pending.caret, pending.caret);
    }
  });

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const key = editKey(event.nativeEvent as Partial<InputEvent>, keyDown.current);
    keyDown.current = undefined;
    const { text, caret } = formatAmountInput(
      input.value,
      input.selectionStart ?? input.value.length,
      currency.decimals,
      key,
    );
    if (text === value) {
      // Nothing changes, so no re-render follows: restore the text and caret directly.
      input.value = text;
      input.setSelectionRange(caret, caret);
      return;
    }
    pendingCaret.current = { input, caret };
    onValueChange(text);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    keyDown.current =
      event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete'
        ? event.key
        : undefined;
    blurOnEnter(event);
  };

  const texts = (
    <>
      <SymbolBadge tint={currency.tint} symbol={currency.symbol} />
      <span className={styles.texts}>
        <span className={styles.code}>{currency.code}</span>
        <span className={styles.name}>{name}</span>
      </span>
    </>
  );

  const editContent = (
    <div className={`${styles.content} ${styles.editing} ${onRemove ? styles.removable : ''}`}>
      {onRemove ? (
        <button
          ref={removeRef}
          type="button"
          className={styles.remove}
          aria-label={removeLabel}
          onClick={onRemove}
        >
          <span className={styles.removeCircle}>
            <MinusIcon />
          </span>
        </button>
      ) : null}
      {texts}
      <button
        ref={setActivatorNodeRef}
        type="button"
        className={styles.handle}
        {...attributes}
        {...listeners}
        aria-label={reorderLabel}
      >
        <GripIcon />
      </button>
    </div>
  );

  // The <li> stays mounted across active/inactive so its background and border transition.
  return (
    <li
      ref={setNodeRef}
      className={rowClass}
      style={rowStyle}
      aria-current={active ? 'true' : undefined}
    >
      {editing ? (
        editContent
      ) : active ? (
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
            onChange={handleChange}
            onKeyDown={handleKeyDown}
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
