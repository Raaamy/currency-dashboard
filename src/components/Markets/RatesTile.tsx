import { useRates } from '@/data';
import { useT } from '@/i18n';
import { CURRENCIES } from '@/lib/currencies';
import { convert, formatNumber } from '@/lib/money';
import { useSettings } from '@/state/SettingsContext';
import { SymbolBadge } from '@/components/ui/SymbolBadge';
import tileStyles from './tile.module.css';
import styles from './RatesTile.module.css';

const DASH = '—';

/** Fourth markets tile (SPEC §8 "Rates tile"): 1 unit of the base currency in the other three. */
export function RatesTile() {
  const t = useT();
  const { language, base } = useSettings();
  const { data: rates } = useRates();
  const baseCurrency = CURRENCIES.find((c) => c.code === base) ?? CURRENCIES[0];
  const others = CURRENCIES.filter((c) => c.code !== base);
  const ready = rates !== null;
  const tileClass = ready ? tileStyles.tile : `${tileStyles.tile} ${tileStyles.loading}`;

  return (
    <article className={tileClass} data-asset="RATES" aria-busy={!ready || undefined}>
      <SymbolBadge tint={baseCurrency.tint} symbol={baseCurrency.symbol} size={38} />
      <div className={styles.texts}>
        <h3 className={styles.name}>1 {base}</h3>
        <p className={styles.caption}>{t('exchangeRate')}</p>
      </div>
      <div className={styles.lines}>
        {others.map(({ code }) => (
          <p key={code} className={styles.line}>
            {ready ? (
              <>
                <span className={styles.value}>
                  {formatNumber(convert(1, base, code, rates.rates), language, {
                    minDecimals: 4,
                    maxDecimals: 4,
                  })}
                </span>{' '}
                <span className={styles.code}>{code}</span>
              </>
            ) : (
              <span className={styles.value}>{DASH}</span>
            )}
          </p>
        ))}
      </div>
    </article>
  );
}
