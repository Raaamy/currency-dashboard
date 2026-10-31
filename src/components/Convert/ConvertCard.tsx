import { useEffect, useId, type Ref, type RefObject } from 'react';
import { AddButton } from '@/components/ui/AddButton';
import { EditButton } from '@/components/ui/EditButton';
import { ItemBadge } from '@/components/ui/ItemBadge';
import { useT } from '@/i18n';
import { getItem, inputDecimals, itemTitles, rateLabel } from '@/lib/assets';
import { useSettings } from '@/state/SettingsContext';
import { AmountInput } from './AmountInput';
import styles from './ConvertCard.module.css';

export interface ConvertCardProps {
  /** Narrow form: one row with the input inline; Edit and Add live by the results instead. */
  compact: boolean;
  editing: boolean;
  onToggleEdit: () => void;
  editButtonRef?: Ref<HTMLButtonElement>;
  onAdd: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
}

/**
 * Convert card (SPEC §13 "Convert card"): the base item and the amount input. Wide: "CONVERT
 * FROM" + Edit, base row, "Amount in …" label, the big input, the click hint and "Add currency
 * or asset". Narrow: badge, title/name and the input in one row.
 */
export function ConvertCard({
  compact,
  editing,
  onToggleEdit,
  editButtonRef,
  onAdd,
  inputRef,
}: ConvertCardProps) {
  const t = useT();
  const { base, amount, metalUnit, setAmount } = useSettings();
  const titleId = useId();
  const inputId = useId();
  const { title, subtitle } = itemTitles(base);
  const isMetal = getItem(base).kind === 'metal';
  const amountLabel = t('amountIn', { unit: rateLabel(base, metalUnit) });

  // SPEC §7.1: focus the amount on open only where a keyboard will not pop up (mouse devices).
  useEffect(() => {
    if (window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) {
      inputRef.current?.focus();
    }
  }, [inputRef]);

  const input = (
    <AmountInput
      id={inputId}
      className={styles.input}
      value={amount}
      decimals={inputDecimals(base, metalUnit)}
      onValueChange={setAmount}
      inputRef={inputRef}
      aria-label={compact ? amountLabel : undefined}
    />
  );

  if (compact) {
    return (
      <section className={`${styles.card} ${styles.compact}`} aria-label={t('convertFrom')}>
        <div className={styles.row}>
          <ItemBadge code={base} size={44} />
          <span className={styles.texts}>
            <label htmlFor={inputId} className={styles.title}>
              {isMetal ? t('nameUnit', { name: title, unit: t(`unit.${metalUnit}`) }) : title}
            </label>
            <span className={styles.subtitle}>{subtitle}</span>
          </span>
          {input}
        </div>
      </section>
    );
  }

  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <div className={styles.header}>
        <h2 id={titleId} className={styles.heading}>
          {t('convertFrom')}
        </h2>
        <EditButton editing={editing} onToggle={onToggleEdit} buttonRef={editButtonRef} />
      </div>
      <div className={styles.base}>
        <ItemBadge code={base} size={52} />
        <span className={styles.texts}>
          <span className={styles.title}>{title}</span>
          <span className={styles.subtitle}>{subtitle}</span>
        </span>
      </div>
      <label htmlFor={inputId} className={styles.label}>
        {amountLabel}
      </label>
      {input}
      <p className={styles.hint}>{t('clickHint')}</p>
      <AddButton label={t('addItem')} onClick={onAdd} size="lg" />
    </section>
  );
}
