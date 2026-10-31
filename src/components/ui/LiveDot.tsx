import styles from './LiveDot.module.css';

export interface LiveDotProps {
  /** Grey and still (offline / stale). */
  muted?: boolean;
}

/** 8 px status dot (`--live`) with a soft pulse while live. Decorative. */
export function LiveDot({ muted = false }: LiveDotProps) {
  return (
    <span className={muted ? `${styles.dot} ${styles.muted}` : styles.dot} aria-hidden="true" />
  );
}
