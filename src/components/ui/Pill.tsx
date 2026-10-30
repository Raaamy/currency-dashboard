import type { ReactNode } from 'react';
import styles from './Pill.module.css';

export type PillVariant = 'up' | 'down' | 'neutral';

export interface PillProps {
  variant: PillVariant;
  children: ReactNode;
  className?: string;
  title?: string;
  'aria-label'?: string;
}

/** Small rounded label, e.g. the 24 h change pill (SPEC §8 "ChangePill"). */
export function Pill({ variant, children, className, title, 'aria-label': ariaLabel }: PillProps) {
  const classes = [styles.pill, styles[variant], className].filter(Boolean).join(' ');
  return (
    <span className={classes} title={title} aria-label={ariaLabel}>
      {children}
    </span>
  );
}
