import type { ReactNode } from 'react';
import styles from './Pill.module.css';

export type PillVariant = 'up' | 'down' | 'neutral';

export interface PillProps {
  variant: PillVariant;
  /** `md` = result card badge (14/700), `sm` = list row badge (12/700). */
  size?: 'md' | 'sm';
  children: ReactNode;
  className?: string;
}

/** Change badge (SPEC §13): up / down / neutral colours, rounded corners, no wrap. */
export function Pill({ variant, size = 'md', children, className }: PillProps) {
  const classes = [styles.pill, styles[size], styles[variant], className].filter(Boolean).join(' ');
  return (
    <span className={classes} data-dir={variant}>
      {children}
    </span>
  );
}
