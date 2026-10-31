import type { ItemTint } from '@/lib/assets';
import styles from './SymbolBadge.module.css';

export type BadgeTint = ItemTint;

export type BadgeSize = 32 | 40 | 44 | 52;

export interface SymbolBadgeProps {
  tint: BadgeTint;
  /** Glyph in the circle; omit for the plain metallic gold/silver badges. */
  symbol?: string;
  size?: BadgeSize;
  /**
   * Smaller glyph for long symbols; defaults to `symbol.length > 2` (AED `د.إ`). Symbols longer
   * than 3 characters and 3-letter code fallbacks (`CHF`) always use the tiny glyph.
   */
  small?: boolean;
  className?: string;
}

const SIZE_CLASS: Record<BadgeSize, string | undefined> = {
  32: styles.s32,
  40: styles.s40,
  44: styles.s44,
  52: styles.s52,
};

/** CSS class names cannot start with a digit: `--tint-1` is the `.tint1` class. */
const tintClass = (tint: BadgeTint): string | undefined =>
  /^\d$/.test(tint) ? styles[`tint${tint}`] : styles[tint];

const isCodeFallback = (symbol: string): boolean => /^[A-Z]{3}$/.test(symbol);

/**
 * Tinted circle with a currency/asset glyph (SPEC §13 "Colours": `--tint-x` background with the
 * `--tint-x-fg` glyph colour; radial gold/silver). Decorative: the row names the item.
 */
export function SymbolBadge({ tint, symbol, size = 40, small, className }: SymbolBadgeProps) {
  const glyph = symbol || undefined;
  const isTiny =
    glyph !== undefined && glyph.length > 1 && (glyph.length > 3 || isCodeFallback(glyph));
  const isSmall = !isTiny && (small ?? (glyph !== undefined && glyph.length > 2));
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
