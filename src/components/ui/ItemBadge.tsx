import { getItem } from '@/lib/assets';
import { SymbolBadge, type BadgeSize } from './SymbolBadge';

export interface ItemBadgeProps {
  /** Fiat code or `XAU` / `XAG` / `BTC`. */
  code: string;
  size?: BadgeSize;
  className?: string;
}

/** The badge of any item: currency tint and symbol, metallic gold/silver, `₿` for Bitcoin. */
export function ItemBadge({ code, size = 40, className }: ItemBadgeProps) {
  const { tint, symbol } = getItem(code);
  return <SymbolBadge tint={tint} symbol={symbol} size={size} className={className} />;
}
