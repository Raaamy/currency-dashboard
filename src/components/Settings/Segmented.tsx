import type { CSSProperties } from 'react';
import styles from './Segmented.module.css';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  name: string;
  ariaLabel: string;
}

/** Pill-shaped radio group with a sliding thumb; arrow keys work natively. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  name,
  ariaLabel,
}: SegmentedProps<T>) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const vars = { '--n': options.length, '--i': index } as CSSProperties;

  return (
    <div role="radiogroup" aria-label={ariaLabel} className={styles.track} style={vars}>
      <span className={styles.thumb} aria-hidden="true" />
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <label
            key={option.value}
            className={checked ? `${styles.option} ${styles.active}` : styles.option}
          >
            <input
              type="radio"
              className={styles.input}
              name={name}
              value={option.value}
              checked={checked}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
}
