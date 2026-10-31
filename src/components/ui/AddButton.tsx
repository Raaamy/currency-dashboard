import styles from './AddButton.module.css';

export interface AddButtonProps {
  label: string;
  onClick: () => void;
  /** `lg` = inside the wide convert card (48 px circle), `md` = below the narrow list (40 px). */
  size?: 'lg' | 'md';
}

/** "Add currency or asset" (SPEC §13): dashed accent circle with a plus, accent label. */
export function AddButton({ label, onClick, size = 'lg' }: AddButtonProps) {
  const icon = size === 'lg' ? 20 : 18;
  return (
    <button type="button" className={`${styles.button} ${styles[size]}`} onClick={onClick}>
      <span className={styles.circle} aria-hidden="true">
        <svg
          width={icon}
          height={icon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          focusable="false"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </span>
      <span className={styles.label}>{label}</span>
    </button>
  );
}
