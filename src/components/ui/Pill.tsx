import type { ReactNode } from 'react';
import styles from './Pill.module.css';

export type PillVariant = 'up' | 'down' | 'neutral';

export interface PillProps {
  variant: PillVariant;
  children: ReactNode;
  className?: string;
}

/** Small rounded label, e.g. the 24 h change pill (SPEC §8 "ChangePill"). */
export function Pill({ variant, children, className }: PillProps) {
  const classes = [styles.pill, styles[variant], className].filter(Boolean).join(' ');
  return <span className={classes}>{children}</span>;
}
