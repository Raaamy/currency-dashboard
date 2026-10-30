import { useHistory, useRates } from '@/data';
import { useT } from '@/i18n';
import { getCurrency } from '@/lib/currencies';
import { convert, DASH, formatPercent, formatRate, rateChangePct, roundTo } from '@/lib/money';
import { useSettings } from '@/state/SettingsContext';
import { SymbolBadge } from '@/components/ui/SymbolBadge';
import tileStyles from './tile.module.css';
import styles from './RatesTile.module.css';

/** Direction of the change as displayed (1 decimal), so `0,0%` is never coloured. */
const direction = (pct: number): 'up' | 'down' | 'flat' => {
  const shown = roundTo(pct, 1);
  return shown > 0 ? 'up' : shown < 0 ? 'down' : 'flat';
};

/**
 * First markets tile, full width (SPEC §11 "Rates tile (chip grid)"): 1 unit of the base
 * currency as one chip per other chosen currency (settings order) with the daily change;
 * codes missing from the rates table show `—`.
 */
export function RatesTile() {
  const t = useT();
  const { currencies, base } = useSettings();
  const { data: rates } = useRates();
  const { data: history } = useHistory();
  const baseCurrency = getCurrency(base);
  const others = currencies.filter((code) => code !== base);
  const ready = rates !== null;
  const tileClass = [tileStyles.tile, tileStyles.rates, ready ? '' : tileStyles.loading]
    .filter(Boolean)
    .join(' ');

  return (
    <article
      className={`${tileStyles.cell} ${tileStyles.full}`}
      data-asset="RATES"
      aria-busy={!ready || undefined}
    >
      <div className={tileClass}>
        <div className={styles.header}>
          <SymbolBadge tint={baseCurrency.tint} symbol={baseCurrency.symbol} size={28} />
          <div className={styles.texts}>
            <h3 className={styles.name}>1 {base}</h3>
            <p className={styles.caption}>{t('exchangeRate')}</p>
          </div>
        </div>
        <ul className={styles.chips}>
          {others.map((code) => {
            const currency = getCurrency(code);
            const value = formatRate(ready ? convert(1, base, code, rates.rates) : NaN);
            const pct = history
              ? rateChangePct(history.today.rates, history.previous.rates, base, code)
              : null;
            const label =
              value === DASH
                ? `1 ${base} = ${DASH} ${code}`
                : `1 ${base} = ${value} ${code}` +
                  (pct !== null ? `, ${formatPercent(pct)} ${t('sinceYesterday')}` : '');
            return (
              <li key={code} className={styles.chip} title={label} aria-label={label}>
                <span className={styles.head}>
                  <SymbolBadge tint={currency.tint} symbol={currency.symbol} size={18} />
                  <span className={styles.code}>{code}</span>
                </span>
                <span className={styles.value}>{value}</span>
                {pct !== null && (
                  <span className={styles.change} data-dir={direction(pct)}>
                    {formatPercent(pct)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </article>
  );
}
