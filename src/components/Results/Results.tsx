import { useMemo, type MouseEvent, type Ref } from 'react';
import { EditList } from '@/components/Edit/EditList';
import { AddButton } from '@/components/ui/AddButton';
import { EditButton } from '@/components/ui/EditButton';
import { useHistory, useMarkets, useRates } from '@/data';
import { useT } from '@/i18n';
import {
  amountTextFor,
  changeBadge,
  convertItem,
  formatItemAmount,
  getItem,
  itemChangePct,
  itemTitles,
  rateLine,
  unitLabel,
  type PriceInputs,
} from '@/lib/assets';
import { parseAmount } from '@/lib/money';
import { useSettings } from '@/state/SettingsContext';
import { ResultItem } from './ResultItem';
import styles from './Results.module.css';

export interface ResultsProps {
  /** Narrow form: Edit in a small header above the list, "Add currency or asset" below it. */
  compact: boolean;
  editing: boolean;
  onToggleEdit: () => void;
  editButtonRef?: Ref<HTMLButtonElement>;
  /** The Edit/Done button, wherever it is rendered: focus target after removals. */
  doneButton: () => HTMLButtonElement | null;
  onAdd: () => void;
  /** After a result became the base; `fromKeyboard` when activated without a pointer. */
  onConverted?: (fromKeyboard: boolean) => void;
}

/**
 * Results (SPEC §13 "Results"): every item but the base, in list order, as card grid or list
 * (by the `results` container width). Tapping one makes it the base with its value as the
 * amount. In edit mode the area shows the sortable list of all items instead.
 */
export function Results({
  compact,
  editing,
  onToggleEdit,
  editButtonRef,
  doneButton,
  onAdd,
  onConverted,
}: ResultsProps) {
  const t = useT();
  const { items, base, amount, metalUnit, setBase, setAmount } = useSettings();
  const { data: rates } = useRates();
  const { data: quotes } = useMarkets();
  const { data: history } = useHistory();

  const prices = useMemo<PriceInputs>(
    () => ({ rates: rates?.rates ?? null, quotes }),
    [rates, quotes],
  );
  const parsed = parseAmount(amount);
  const value = parsed ?? 0;

  const results = items
    .filter((code) => code !== base)
    .map((code) => {
      const converted = convertItem(value, base, code, metalUnit, prices);
      const amountText = formatItemAmount(converted, code, metalUnit);
      const unitText = unitLabel(code, metalUnit);
      const line = rateLine(base, code, metalUnit, prices);
      const pct = history
        ? itemChangePct(line.from, line.to, history.today.rates, history.previous.rates)
        : null;
      const badge = pct === null ? null : changeBadge(pct);
      const { title, subtitle } = itemTitles(code);
      const name = getItem(code).kind === 'fiat' ? `${title} ${subtitle}` : title;
      const label = [
        name,
        `${amountText} ${unitText}`,
        line.text,
        badge ? `${badge.text} ${t('sinceYesterday')}` : null,
      ]
        .filter(Boolean)
        .join(', ');
      return { code, converted, amountText, unitText, line, badge, title, subtitle, label };
    });

  const select = (code: string, converted: number, event: MouseEvent<HTMLButtonElement>) => {
    setBase(code);
    // An empty input stays empty; without data (`—`) the amount text is kept as it is.
    const text = parsed === null ? '' : amountTextFor(converted, code, metalUnit);
    if (text) setAmount(text);
    onConverted?.(event.detail === 0);
  };

  return (
    <div className={styles.results}>
      {editing ? (
        <EditList doneButton={doneButton} />
      ) : (
        <ul className={styles.list}>
          {results.map((r) => (
            <ResultItem
              key={r.code}
              code={r.code}
              title={r.title}
              subtitle={r.subtitle}
              amountText={r.amountText}
              unitText={r.unitText}
              rateText={r.line.text}
              badge={r.badge}
              label={r.label}
              onSelect={(event) => select(r.code, r.converted, event)}
            />
          ))}
        </ul>
      )}
      {compact ? (
        // Narrow: the list-management actions share one line below the list.
        <div className={styles.foot}>
          <AddButton label={t('addItem')} onClick={onAdd} size="md" />
          <EditButton editing={editing} onToggle={onToggleEdit} buttonRef={editButtonRef} />
        </div>
      ) : null}
    </div>
  );
}
