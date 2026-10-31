import { useEffect, useState, type ReactNode } from 'react';
import { LiveDot } from '@/components/ui/LiveDot';
import { useMarkets, useRates, useRefreshAll, type SourceStatus } from '@/data';
import { useT } from '@/i18n';
import { formatTimestamp } from '@/lib/money';
import styles from './TopBar.module.css';

const TICK_MS = 10_000;

function RefreshIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}

/**
 * `loading` happens on every poll: keep the previous verdict (an error survives a failed
 * refresh and is cleared by a successful one), so a cold start with a cache never flashes
 * "Offline" while the first fetch is in flight.
 */
const isStale = (status: SourceStatus, error: string | null): boolean =>
  status === 'stale' || (status === 'loading' && error !== null);

/** Offline when the rates or the markets are stale; else seconds since the last market data. */
function useLiveStatus(): { stale: boolean; seconds: number | null } {
  const rates = useRates();
  const markets = useMarkets();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const stale = isStale(rates.status, rates.error) || isStale(markets.status, markets.error);
  const updatedAts = Object.values(markets.data)
    .map((q) => q?.updatedAt)
    .filter((v): v is number => typeof v === 'number');
  const timestamp = markets.lastRefresh ?? (updatedAts.length > 0 ? Math.max(...updatedAts) : null);
  const seconds = timestamp === null ? null : Math.max(0, Math.floor((now - timestamp) / 1000));
  return { stale, seconds };
}

export interface TopBarProps {
  /** Narrow form: transparent refresh, "Updated …", the status at the far right. */
  compact: boolean;
  /** Wide form, right side: "Metals in" + this unit toggle (only when a metal is listed). */
  unitToggle?: ReactNode;
}

/**
 * Top bar (SPEC §13 "Top bar"): refresh button, the rates time and the live status; on wide
 * layouts the metal unit toggle on the right.
 */
export function TopBar({ compact, unitToggle }: TopBarProps) {
  const t = useT();
  const rates = useRates();
  const markets = useMarkets();
  const refreshAll = useRefreshAll();
  const [busy, setBusy] = useState(false);
  const { stale, seconds } = useLiveStatus();

  const loading = rates.status === 'loading' || markets.status === 'loading';
  const spinning = busy && loading;

  const onRefresh = () => {
    if (busy) return;
    setBusy(true);
    refreshAll().finally(() => setBusy(false));
  };

  const time = rates.data ? formatTimestamp(rates.data.publishedAt) : '—';

  let statusText: string | null = null;
  if (stale) statusText = t('offlineShort');
  else if (seconds !== null) {
    const ago =
      seconds < 60 ? t('ago.s', { n: seconds }) : t('ago.m', { n: Math.floor(seconds / 60) });
    statusText = compact ? t('liveShort') : t('liveAgo', { ago });
  }
  const status =
    statusText === null ? null : (
      <span className={stale ? `${styles.status} ${styles.stale}` : styles.status}>
        <LiveDot muted={stale} />
        <span>{statusText}</span>
      </span>
    );

  return (
    <header className={compact ? `${styles.bar} ${styles.compact}` : styles.bar}>
      <div className={styles.left}>
        <button
          type="button"
          className={styles.refresh}
          onClick={onRefresh}
          aria-label={t('refresh')}
          title={t('refresh')}
          aria-busy={spinning || undefined}
        >
          <span className={spinning ? `${styles.icon} ${styles.spin}` : styles.icon}>
            <RefreshIcon size={compact ? 18 : 20} />
          </span>
        </button>
        {compact ? (
          <span className={styles.updated}>{t('updatedShort', { time })}</span>
        ) : (
          <div className={styles.texts}>
            <span className={styles.updated}>{t('updated', { time })}</span>
            {status}
          </div>
        )}
      </div>
      {compact ? status : null}
      {!compact && unitToggle ? (
        <div className={styles.right}>
          <span className={styles.metalsIn}>{t('metalsIn')}</span>
          {unitToggle}
        </div>
      ) : null}
    </header>
  );
}
