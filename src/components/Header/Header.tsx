import { useState } from 'react';
import { useMarkets, useRates, useRefreshAll } from '@/data';
import { useT } from '@/i18n';
import { formatTimestamp } from '@/lib/money';
import styles from './Header.module.css';

function RefreshIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" />
      <path d="M4 3v5h5" />
      <path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" />
      <path d="M20 21v-5h-5" />
    </svg>
  );
}

export function Header() {
  const t = useT();
  const rates = useRates();
  const markets = useMarkets();
  const refreshAll = useRefreshAll();
  const [busy, setBusy] = useState(false);

  const loading = rates.status === 'loading' || markets.status === 'loading';
  const spinning = busy && loading;

  const onRefresh = () => {
    if (busy) return;
    setBusy(true);
    refreshAll().finally(() => setBusy(false));
  };

  const time = rates.data ? formatTimestamp(rates.data.publishedAt) : '—';

  return (
    <header className={styles.header}>
      <p className={styles.caption}>
        <button
          type="button"
          className={styles.refresh}
          onClick={onRefresh}
          aria-label={t('refresh')}
          title={t('refresh')}
          aria-busy={spinning || undefined}
        >
          <span className={spinning ? `${styles.icon} ${styles.spin}` : styles.icon}>
            <RefreshIcon />
          </span>
        </button>
        <span>{t('updated', { time })}</span>
      </p>
    </header>
  );
}
