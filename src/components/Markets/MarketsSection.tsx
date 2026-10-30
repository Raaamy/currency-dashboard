import { useEffect, useId, useState } from 'react';
import { useMarkets } from '@/data';
import type { AssetId } from '@/data';
import { useT } from '@/i18n';
import { LiveDot } from '@/components/ui/LiveDot';
import { MarketTile } from './MarketTile';
import { RatesTile } from './RatesTile';
import styles from './MarketsSection.module.css';

const ASSETS: readonly AssetId[] = ['BTC', 'XAU', 'XAG'];
const TICK_MS = 10_000;

function CloudOffIcon() {
  return (
    <svg
      className={styles.cloudOff}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M22.61 16.95A5 5 0 0 0 18 10h-1.26a8 8 0 0 0-7.05-6M5 5a8 8 0 0 0 4 15h9a5 5 0 0 0 1.7-.3" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

/** Markets heading (live / offline state), the rates tile and the BTC, gold and silver tiles (SPEC §8). */
export function MarketsSection() {
  const t = useT();
  const headingId = useId();
  const { data: quotes, status, error, lastRefresh } = useMarkets();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const updatedAts = ASSETS.map((id) => quotes[id]?.updatedAt).filter(
    (v): v is number => v !== undefined,
  );
  const hasData = updatedAts.length > 0;
  const timestamp = lastRefresh ?? (hasData ? Math.max(...updatedAts) : null);
  // `loading` happens on every poll: keep the previous verdict (error survives a failed
  // refresh and is cleared by a successful one), so a cold start with a cache never
  // flashes "offline" while the first fetch is in flight.
  const stale = status === 'stale' || (status === 'loading' && error !== null);

  let caption: string | null = null;
  if (stale) caption = t('offline');
  else if (timestamp !== null) {
    const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
    const ago =
      seconds < 60 ? t('ago.s', { n: seconds }) : t('ago.m', { n: Math.floor(seconds / 60) });
    caption = t('live', { ago });
  }

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <div className={styles.heading}>
        <h2 id={headingId} className={styles.label}>
          {t('markets')}
        </h2>
        <LiveDot muted={stale} />
        {stale ? <CloudOffIcon /> : null}
        {caption !== null ? <span className={styles.caption}>{caption}</span> : null}
      </div>
      <div className={styles.tiles}>
        <RatesTile />
        {ASSETS.map((id) => (
          <MarketTile key={id} id={id} stale={stale} />
        ))}
      </div>
    </section>
  );
}
