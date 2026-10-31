import type { Ref } from 'react';
import { useT } from '@/i18n';
import styles from './EditButton.module.css';

export interface EditButtonProps {
  editing: boolean;
  onToggle: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}

/** "Edit" / "Done" toggle (SPEC §13): accent text 16/700, 44 px hit area, `aria-pressed`. */
export function EditButton({ editing, onToggle, buttonRef }: EditButtonProps) {
  const t = useT();
  return (
    <button
      ref={buttonRef}
      type="button"
      className={styles.button}
      aria-pressed={editing}
      onClick={onToggle}
    >
      {t(editing ? 'done' : 'edit')}
    </button>
  );
}
