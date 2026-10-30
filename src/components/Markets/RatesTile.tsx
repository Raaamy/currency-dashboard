import { useHistory, useRates } from '@/data';
import { useT } from '@/i18n';
import { CURRENCIES } from '@/lib/currencies';
import { convert, formatNumber, formatPercent, rateChangePct, roundTo } from '@/lib/money';
import { useSettings } from '@/state/SettingsContext';
import { SymbolBadge } from '@/components/ui/SymbolBadge';
import tileStyles from './tile.module.css';
import styles from './RatesTile.module.css';

const DASH = '—';

/** Direction of the change as displayed (1 decimal), so `0,0%` is never coloured. */
const direction = (pct: number): 'up' | 'down' | 'flat' => {
  const shown = roundTo(pct, 1);
  return shown > 0 ? 'up' : shown < 0 ? 'down' : 'flat';
};

/** Fourth markets tile (SPEC §8 "Rates tile"): 1 unit of the base currency in the other three. */
export function RatesTile() {
  const t = useT();
  const { base } = useSettings();
  const { data: rates } = useRates();
  const { data: history } = useHistory();
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
        {others.map(({ code }) => {
          const pct = history
            ? rateChangePct(history.today.rates, history.previous.rates, base, code)
            : null;
          return (
            <p key={code} className={styles.line}>
              {ready ? (
                <>
                  <span className={styles.value}>
                    {formatNumber(convert(1, base, code, rates.rates), {
                      minDecimals: 4,
                      maxDecimals: 4,
                    })}
                  </span>{' '}
                  <span className={styles.code}>{code}</span>
                  {pct !== null && (
                    <span
                      className={styles.change}
                      data-dir={direction(pct)}
                      title={t('sinceYesterday')}
                    >
                      {formatPercent(pct)}
                    </span>
                  )}
                </>
              ) : (
                <span className={styles.value}>{DASH}</span>
              )}
            </p>
          );
        })}
      </div>
    </article>
  );
}
