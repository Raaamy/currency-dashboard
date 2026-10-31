import type { MouseEvent } from 'react';
import { ItemBadge } from '@/components/ui/ItemBadge';
import { Pill } from '@/components/ui/Pill';
import type { ChangeVariant } from '@/lib/assets';
import styles from './Results.module.css';

export interface ResultItemProps {
  code: string;
  title: string;
  subtitle: string;
  amountText: string;
  unitText: string;
  rateText: string;
  badge: { text: string; variant: ChangeVariant } | null;
  /** Accessible name: "Gold, 88,69 g, 1 g gold = 112,25 EUR, −0,9% vs yesterday". */
  label: string;
  onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
}

/**
 * One result (SPEC §13 "Results"), a `<button>` that makes the item the base. One DOM for both
 * forms: the `results` container query lays it out as a card (>= 560 px) or a list row.
 */
export function ResultItem({
  code,
  title,
  subtitle,
  amountText,
  unitText,
  rateText,
  badge,
  label,
  onSelect,
}: ResultItemProps) {
  return (
    <li className={styles.cell}>
      <button type="button" className={styles.item} aria-label={label} onClick={onSelect}>
        <ItemBadge code={code} size={44} className={styles.icon} />
        <span className={styles.title}>{title}</span>
        <span className={styles.name}>{subtitle}</span>
        {badge ? (
          <Pill variant={badge.variant} className={styles.badge}>
            {badge.text}
          </Pill>
        ) : null}
        <span className={styles.amount}>
          <span className={styles.value}>{amountText}</span>{' '}
          <span className={styles.unit}>{unitText}</span>
        </span>
        <span className={styles.rate}>{rateText}</span>
      </button>
    </li>
  );
}
