import type { ReactNode } from 'react';
import { useT } from '@/i18n';
import styles from './TapHint.module.css';

export interface TapHintProps {
  /** The narrow unit toggle, right-aligned (only when a metal is listed). */
  unitToggle?: ReactNode;
}

/** Narrow layout, below the convert card: "TAP A ROW TO CONVERT FROM IT" + the unit toggle. */
export function TapHint({ unitToggle }: TapHintProps) {
  const t = useT();
  return (
    <div className={styles.line}>
      <p className={styles.text}>{t('tapHint')}</p>
      {unitToggle}
    </div>
  );
}
