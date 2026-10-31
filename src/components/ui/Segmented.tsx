import { useRef, type KeyboardEvent } from 'react';
import styles from './Segmented.module.css';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name of the group ("Metals in"). */
  label: string;
  /** `md` = wide top bar (52 x 36), `sm` = narrow hint line (44 x 30); both 44 px tall to tap. */
  size?: 'md' | 'sm';
  className?: string;
}

const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown']);
const PREV_KEYS = new Set(['ArrowLeft', 'ArrowUp']);

/**
 * Segmented control with radio-group semantics (SPEC §13 `g | oz | kg`): one tab stop (the
 * checked segment), arrow keys move and select, Home/End jump. Active segment `--seg-active`.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
  className,
}: SegmentedProps<T>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    buttons.current[index]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const n = options.length;
    let next: number | null = null;
    if (NEXT_KEYS.has(event.key)) next = (index + 1) % n;
    else if (PREV_KEYS.has(event.key)) next = (index - 1 + n) % n;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = n - 1;
    if (next === null) return;
    event.preventDefault();
    select(next);
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={[styles.track, styles[size], className].filter(Boolean).join(' ')}
    >
      {options.map((option, index) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              buttons.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            className={checked ? `${styles.item} ${styles.checked}` : styles.item}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
