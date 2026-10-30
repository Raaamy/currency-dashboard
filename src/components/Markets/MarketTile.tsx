import type { ReactNode } from 'react';
import type { AssetId } from '@/data';
import { useHistory, useMarkets, useRates } from '@/data';
import { useT } from '@/i18n';
import {
  convert,
  formatMoney,
  formatPercent,
  formatQuantity,
  OZ_IN_GRAMS,
  ozToGram,
  parseAmount,
  quantityFor,
  rateChangePct,
  roundTo,
} from '@/lib/money';
import { useSettings } from '@/state/SettingsContext';
import { Pill, type PillVariant } from '@/components/ui/Pill';
import tileStyles from './tile.module.css';
import styles from './MarketTile.module.css';

export interface MarketTileProps {
  id: AssetId;
  /** Last refresh failed: numbers dim to 70 %. */
  stale?: boolean;
}

const DASH = '—';

/** Variant of the change as displayed (1 decimal), so `0,0%` stays neutral. */
const pillVariant = (pct: number): PillVariant => {
  const shown = roundTo(pct, 1);
  return shown > 0 ? 'up' : shown < 0 ? 'down' : 'neutral';
};

/** One asset row: badge, name + unit price captions, quantity the typed amount buys. */
export function MarketTile({ id, stale = false }: MarketTileProps) {
  const t = useT();
  const { base, amount } = useSettings();
  const { data: rates } = useRates();
  const { data: quotes } = useMarkets();
  const { data: history } = useHistory();
  const quote = quotes[id];
  const ready = rates !== null && quote !== undefined;

  const parsed = parseAmount(amount);
  const empty = parsed === null || parsed === 0;
  const value = parsed ?? 0;
  const isBtc = id === 'BTC';

  const captions: string[] = [];
  let quantity = DASH;
  let below: ReactNode = null;

  // Daily-snapshot change of the asset's price in the base currency (SPEC §6 "Daily change").
  const snapshotChange = history
    ? rateChangePct(history.today.rates, history.previous.rates, id, base)
    : null;
  const changePill = (pct: number | null | undefined): ReactNode =>
    pct === null || pct === undefined ? null : (
      <Pill
        variant={pillVariant(pct)}
        className={stale ? styles.dim : undefined}
        title={t('sinceYesterday')}
        aria-label={`${formatPercent(pct)} ${t('sinceYesterday')}`}
      >
        {formatPercent(pct)}
      </Pill>
    );

  if (ready) {
    const priceInBase = convert(quote.priceUsd, 'USD', base, rates.rates);
    const qty = quantityFor(value, base, quote.priceUsd, rates.rates);
    if (isBtc) {
      captions.push(`${formatMoney(priceInBase, base, { decimals: 0 })} ${t('perBitcoin')}`);
      quantity = `${formatQuantity(qty, 'btc')} BTC`;
      below = changePill(quote.change24hPct ?? snapshotChange);
    } else {
      const perOunce = priceInBase;
      const perGram = perOunce / OZ_IN_GRAMS;
      captions.push(`${formatMoney(perGram, base)} ${t('perGram')}`);
      captions.push(`${formatMoney(perOunce, base)} ${t('perOunce')}`);
      quantity = `${formatQuantity(ozToGram(qty), 'gram')} g`;
      below = (
        <div className={styles.metalRow}>
          <span className={stale ? `${styles.caption} ${styles.dim}` : styles.caption}>
            {t('approxOz', { n: formatQuantity(qty, 'oz') })}
          </span>
          {changePill(snapshotChange)}
        </div>
      );
    }
  } else {
    captions.push(DASH);
    if (!isBtc) captions.push(DASH);
    below = <span className={styles.caption}>{DASH}</span>;
  }

  const tileClass = ready ? tileStyles.tile : `${tileStyles.tile} ${tileStyles.loading}`;
  const numberClass = [
    styles.quantity,
    ready && empty ? styles.muted : '',
    ready && stale ? styles.dim : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article className={tileClass} data-asset={id} aria-busy={!ready || undefined}>
      <span className={`${styles.badge} ${styles[`badge${id}`]}`} aria-hidden="true">
        {isBtc ? '₿' : null}
      </span>
      <div className={styles.texts}>
        <h3 className={styles.name}>{t(`asset.${id}`)}</h3>
        {captions.map((caption, i) => (
          <p
            key={i}
            className={stale && ready ? `${styles.caption} ${styles.dim}` : styles.caption}
          >
            {caption}
          </p>
        ))}
      </div>
      <div className={styles.numbers}>
        <p className={numberClass}>{quantity}</p>
        {below}
      </div>
    </article>
  );
}
