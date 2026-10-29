import styles from './SymbolBadge.module.css';

export type BadgeTint = 'eur' | 'usd' | 'gbp' | 'aed' | 'btc' | 'gold' | 'silver';

export interface SymbolBadgeProps {
  tint: BadgeTint;
  /** Glyph in the circle; omit for the plain metallic gold/silver badges. */
  symbol?: string;
  size?: 36 | 38 | 40;
  /** Smaller glyph for multi-character symbols; defaults to `symbol.length > 1` (AED `د.إ`). */
  small?: boolean;
  className?: string;
}

const SIZE_CLASS = { 36: styles.s36, 38: styles.s38, 40: styles.s40 } as const;

/** Tinted circle with a currency/asset glyph. Decorative: the row names the currency. */
export function SymbolBadge({ tint, symbol, size = 40, small, className }: SymbolBadgeProps) {
  const isSmall = small ?? (symbol !== undefined && symbol.length > 1);
  const classes = [
    styles.badge,
    styles[tint],
    SIZE_CLASS[size],
    isSmall ? styles.small : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={classes} aria-hidden="true">
      {symbol}
    </span>
  );
}
