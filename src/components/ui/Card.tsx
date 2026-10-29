import type { ReactNode } from 'react';
import styles from './Card.module.css';

export interface CardProps {
  className?: string;
  children: ReactNode;
  'aria-labelledby'?: string;
}

/** White rounded surface (SPEC §8 "Converter card"). Adds no outer margin; the layout places it. */
export function Card({ className, children, 'aria-labelledby': labelledBy }: CardProps) {
  return (
    <section
      className={className ? `${styles.card} ${className}` : styles.card}
      aria-labelledby={labelledBy}
    >
      {children}
    </section>
  );
}
