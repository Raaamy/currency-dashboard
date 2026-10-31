import { useLayoutEffect, useMemo, useRef } from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useT } from '@/i18n';
import { itemTitles } from '@/lib/assets';
import { MIN_ITEMS, useSettings } from '@/state/SettingsContext';
import { EditRow, type SortTransition } from './EditRow';
import styles from './EditList.module.css';

const MODIFIERS = [restrictToVerticalAxis, restrictToParentElement];

/** `--dur` as milliseconds (`200ms`, `.2s`), NaN when unset. */
const toMs = (value: string): number => {
  const v = value.trim();
  return v.endsWith('ms') ? parseFloat(v) : v.endsWith('s') ? parseFloat(v) * 1000 : NaN;
};

/**
 * The rows' slide transition while sorting: the `--dur` / `--ease` tokens, none under
 * `prefers-reduced-motion`, dnd-kit's default when the tokens cannot be read.
 */
function readSortTransition(): SortTransition {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return null;
  const style = getComputedStyle(document.documentElement);
  const duration = toMs(style.getPropertyValue('--dur'));
  const easing = style.getPropertyValue('--ease').trim();
  return Number.isFinite(duration) && easing ? { duration, easing } : undefined;
}

export interface EditListProps {
  /** The Done button: focus target once the remove buttons are gone. */
  doneButton: () => HTMLButtonElement | null;
}

/**
 * Edit mode (SPEC §13 "Edit mode", §12 "Reordering"): one dnd-kit sortable list of ALL items,
 * the base marked "From". Remove buttons while more than `MIN_ITEMS` are listed; after a
 * removal focus moves to the next row's remove button (the previous one for the last row), or
 * to Done once they are gone. Drag by the handle (pointer after 4 px, or keyboard: Space/Enter
 * lifts, arrows move, Space/Enter drops, Escape cancels), English announcements; a drop saves
 * the order via `moveItem`.
 */
export function EditList({ doneButton }: EditListProps) {
  const t = useT();
  const { items, base, removeItem, moveItem } = useSettings();
  const removeButtons = useRef(new Map<string, HTMLButtonElement>());
  /** After a removal: the code whose remove button gets focus, or `null` for Done. */
  const focusAfterRemove = useRef<{ code: string | null } | null>(null);
  const canRemove = items.length > MIN_ITEMS;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  // Read when edit mode opens, so a changed motion preference applies next time.
  const sortTransition = useMemo(() => readSortTransition(), []);

  /** dnd-kit reports the row itself as the first `over` right after pick-up: not announced. */
  const pickedUp = useRef(false);
  const announcements = useMemo<Announcements>(() => {
    const name = (id: UniqueIdentifier) => itemTitles(String(id)).title;
    const position = (id: UniqueIdentifier) => items.indexOf(String(id)) + 1;
    const total = items.length;
    return {
      onDragStart: ({ active }) => {
        pickedUp.current = true;
        return t('dnd.picked', { code: name(active.id) });
      },
      onDragOver: ({ active, over }) => {
        const first = pickedUp.current;
        pickedUp.current = false;
        if (!over || (first && over.id === active.id)) return undefined;
        return t('dnd.moved', { code: name(active.id), pos: position(over.id), total });
      },
      onDragEnd: ({ active, over }) =>
        over
          ? t('dnd.dropped', { code: name(active.id), pos: position(over.id), total })
          : t('dnd.cancelled', { code: name(active.id), pos: position(active.id) }),
      onDragCancel: ({ active }) =>
        t('dnd.cancelled', { code: name(active.id), pos: position(active.id) }),
    };
  }, [items, t]);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) moveItem(String(active.id), String(over.id));
  };

  useLayoutEffect(() => {
    const target = focusAfterRemove.current;
    if (!target) return;
    focusAfterRemove.current = null;
    const button = target.code ? removeButtons.current.get(target.code) : undefined;
    (button ?? doneButton())?.focus();
  }, [items, doneButton]);

  const handleRemove = (code: string) => {
    const index = items.indexOf(code);
    const remaining = items.filter((c) => c !== code);
    const next = remaining.length > MIN_ITEMS ? (remaining[index] ?? remaining[index - 1]) : null;
    focusAfterRemove.current = { code: next ?? null };
    removeItem(code);
  };

  const removeRef = (code: string) => (button: HTMLButtonElement | null) => {
    if (button) removeButtons.current.set(code, button);
    else removeButtons.current.delete(code);
  };

  return (
    // The DndContext renders its hidden instructions and live region after the list.
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={MODIFIERS}
      accessibility={{ announcements }}
      onDragEnd={handleDragEnd}
    >
      <ul className={styles.list}>
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          {items.map((code) => {
            const { title, subtitle } = itemTitles(code);
            return (
              <EditRow
                key={code}
                code={code}
                title={title}
                subtitle={subtitle}
                fromLabel={code === base ? t('fromPill') : undefined}
                onRemove={canRemove ? () => handleRemove(code) : undefined}
                removeLabel={t('removeCurrency', { code: title })}
                removeRef={removeRef(code)}
                reorderLabel={t('reorder', { code: title })}
                sortTransition={sortTransition}
              />
            );
          })}
        </SortableContext>
      </ul>
    </DndContext>
  );
}
