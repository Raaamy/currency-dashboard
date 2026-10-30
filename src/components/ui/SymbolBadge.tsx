import type { CurrencyTint } from '@/lib/currencies';
import styles from './SymbolBadge.module.css';

export type BadgeTint = CurrencyTint | 'btc' | 'gold' | 'silver';

export type BadgeSize = 18 | 28 | 32 | 36 | 38 | 40;

export interface SymbolBadgeProps {
  tint: BadgeTint;
  /** Glyph in the circle; omit for the plain metallic gold/silver badges. */
  symbol?: string;
  size?: BadgeSize;
  /**
   * Smaller glyph for long symbols; defaults to `symbol.length > 2` (AED `د.إ`). Symbols longer
   * than 3 characters and 3-letter code fallbacks (`CHF`) always use the tiny 11 px glyph.
   */
  small?: boolean;
  className?: string;
}

const SIZE_CLASS: Record<BadgeSize, string | undefined> = {
  18: styles.s18,
  28: styles.s28,
  32: styles.s32,
  36: styles.s36,
  38: styles.s38,
  40: styles.s40,
};

/** CSS class names cannot start with a digit: `--tint-1` is the `.tint1` class. */
const tintClass = (tint: BadgeTint): string | undefined =>
  /^\d$/.test(tint) ? styles[`tint${tint}`] : styles[tint];

const isCodeFallback = (symbol: string): boolean => /^[A-Z]{3}$/.test(symbol);

/** Tinted circle with a currency/asset glyph. Decorative: the row names the currency. */
export function SymbolBadge({ tint, symbol, size = 40, small, className }: SymbolBadgeProps) {
  // An 18 px badge cannot hold a 3-letter code: show its first letter (CHF -> C).
  const glyph = size === 18 && symbol !== undefined && isCodeFallback(symbol) ? symbol[0] : symbol;
  const isTiny =
    glyph !== undefined && glyph.length > 1 && (glyph.length > 3 || isCodeFallback(glyph));
  const isSmall = !isTiny && (small ?? (symbol !== undefined && symbol.length > 2));
  const classes = [
    styles.badge,
    tintClass(tint),
    SIZE_CLASS[size],
    isTiny ? styles.tiny : isSmall ? styles.small : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={classes} aria-hidden="true">
      {glyph}
    </span>
  );
}
