import { useLayoutEffect, useRef, type ChangeEvent, type KeyboardEvent, type Ref } from 'react';
import { formatAmountInput } from '@/lib/amountInput';

export interface AmountInputProps {
  id?: string;
  className?: string;
  /** The formatted input text (SPEC §12); edits are re-formatted with `decimals`. */
  value: string;
  /** Fraction digits the base accepts (`inputDecimals(base, metalUnit)`). */
  decimals: number;
  onValueChange: (value: string) => void;
  inputRef?: Ref<HTMLInputElement>;
  /** Accessible name when no `<label for>` names the input. */
  'aria-label'?: string;
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

/**
 * Amount input with live nl-NL formatting (SPEC §12): every edit goes through
 * `formatAmountInput` and the caret is restored in a layout effect after the re-render.
 */
export function AmountInput({
  id,
  className,
  value,
  decimals,
  onValueChange,
  inputRef,
  'aria-label': ariaLabel,
}: AmountInputProps) {
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
      decimals,
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

  return (
    <input
      ref={inputRef}
      id={id}
      className={className}
      type="text"
      inputMode="decimal"
      enterKeyHint="done"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      placeholder="0"
      aria-label={ariaLabel}
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
    />
  );
}
