import type { Ref } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ItemBadge } from '@/components/ui/ItemBadge';
import { Pill } from '@/components/ui/Pill';
import styles from './EditList.module.css';

/** dnd-kit's sortable transition option (`{ duration, easing }`, `null` for none). */
export type SortTransition = Parameters<typeof useSortable>[0]['transition'];

export interface EditRowProps {
  code: string;
  title: string;
  subtitle: string;
  /** Text of the "From" pill on the base item; omitted for the others. */
  fromLabel?: string;
  /** Shows the remove button when given (hidden at the minimum count). */
  onRemove?: () => void;
  /** Accessible name of the remove button ("Remove USD"). */
  removeLabel: string;
  removeRef?: Ref<HTMLButtonElement>;
  /** Accessible name of the drag handle ("Reorder USD"). */
  reorderLabel: string;
  sortTransition?: SortTransition;
}

function MinusIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.4"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 12h14" />
    </svg>
  );
}

/** Six dots, 2 columns x 3 rows (SPEC §12 drag handle). */
function GripIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="6.5" cy="4" r="1.6" />
      <circle cx="11.5" cy="4" r="1.6" />
      <circle cx="6.5" cy="9" r="1.6" />
      <circle cx="11.5" cy="9" r="1.6" />
      <circle cx="6.5" cy="14" r="1.6" />
      <circle cx="11.5" cy="14" r="1.6" />
    </svg>
  );
}

/**
 * One row of the edit list (SPEC §13 "Edit mode", §12 reordering): remove button, badge,
 * title + name, the "From" pill on the base, drag handle. Only the handle starts a drag.
 */
export function EditRow({
  code,
  title,
  subtitle,
  fromLabel,
  onRemove,
  removeLabel,
  removeRef,
  reorderLabel,
  sortTransition,
}: EditRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: code, transition: sortTransition });

  return (
    <li
      ref={setNodeRef}
      className={isDragging ? `${styles.row} ${styles.dragging}` : styles.row}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      aria-current={fromLabel ? 'true' : undefined}
    >
      {onRemove ? (
        <button
          ref={removeRef}
          type="button"
          className={styles.remove}
          aria-label={removeLabel}
          onClick={onRemove}
        >
          <span className={styles.removeCircle}>
            <MinusIcon />
          </span>
        </button>
      ) : null}
      <ItemBadge code={code} size={40} />
      <span className={styles.texts}>
        <span className={styles.title}>{title}</span>
        <span className={styles.subtitle}>{subtitle}</span>
      </span>
      {fromLabel ? (
        <Pill variant="neutral" size="sm" className={styles.from}>
          {fromLabel}
        </Pill>
      ) : null}
      <button
        ref={setActivatorNodeRef}
        type="button"
        className={styles.handle}
        {...attributes}
        {...listeners}
        aria-label={reorderLabel}
      >
        <GripIcon />
      </button>
    </li>
  );
}
