import { useState } from 'react';
import { useMarkets, useRates, useRefreshAll } from '@/data';
import { useT } from '@/i18n';
import { formatTimestamp } from '@/lib/money';
import { useSettings } from '@/state/SettingsContext';
import styles from './Header.module.css';

export interface HeaderProps {
  onOpenSettings: () => void;
}

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

function GearIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function Header({ onOpenSettings }: HeaderProps) {
  const t = useT();
  const { language } = useSettings();
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

  const time = rates.data ? formatTimestamp(rates.data.publishedAt, language) : '—';

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
      <button
        type="button"
        className={styles.settings}
        onClick={onOpenSettings}
        aria-label={t('settings')}
      >
        <GearIcon />
      </button>
    </header>
  );
}
