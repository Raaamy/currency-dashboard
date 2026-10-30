import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { SymbolBadge } from '@/components/ui/SymbolBadge';
import { availableCodes, useRates } from '@/data';
import { useT } from '@/i18n';
import { compareByName, getCurrency, POPULAR } from '@/lib/currencies';
import { MIN_CURRENCIES, useSettings } from '@/state/SettingsContext';
import styles from './CurrencyPicker.module.css';
import { matchesQuery } from './search';

export interface CurrencyPickerProps {
  open: boolean;
  onClose: () => void;
}

/** Fallback when `transitionend` never fires (reduced motion, 0 ms transitions, jsdom). */
const CLOSE_FALLBACK_MS = 250;

function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function blurOnEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.currentTarget.blur();
}

/**
 * Currency picker (SPEC §11 "Currency picker"): a native modal `<dialog>`, bottom sheet below
 * 640 px and centred dialog from 640 px. Tapping an item adds or removes that currency (never
 * below `MIN_CURRENCIES`); the sheet stays open so several can be added.
 *
 * `open` is the source of truth. Escape (`cancel`, prevented) and backdrop taps ask the parent
 * to close; the dialog itself closes after the exit transition. The native `close` event also
 * calls `onClose` (idempotent), so state never stays open when the browser closed the dialog
 * on its own (Chrome may skip `cancel` after a prevented one).
 */
export function CurrencyPicker({ open, onClose }: CurrencyPickerProps) {
  const t = useT();
  const { currencies, addCurrency, removeCurrency } = useSettings();
  const { data } = useRates();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const pressedOnBackdrop = useRef(false);
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  // The list renders only while open or closing (no hidden ~160 buttons the rest of the time).
  const [rendered, setRendered] = useState(open);
  const [wasOpen, setWasOpen] = useState(open);

  // Every opening starts with an empty search (state adjusted during render, not in an effect).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery('');
      setRendered(true);
    }
  }

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onCancel = (event: Event) => {
      event.preventDefault();
      onCloseRef.current();
    };
    const onNativeClose = () => {
      // A stale event from a close that a quick reopen already undid.
      if (dialog.open) return;
      setRendered(false);
      onCloseRef.current();
    };
    dialog.addEventListener('cancel', onCancel);
    dialog.addEventListener('close', onNativeClose);
    return () => {
      dialog.removeEventListener('cancel', onCancel);
      dialog.removeEventListener('close', onNativeClose);
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
        // Commit the closed (off-screen) styles first so the enter transition runs.
        dialog.getBoundingClientRect();
        // Every opening starts at the top of the list (Chrome may restore the old offset).
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
      }
      const finePointer = window.matchMedia?.('(pointer: fine)').matches ?? false;
      // No keyboard pop-up on touch devices: focus the close button there.
      (finePointer ? searchRef.current : closeRef.current)?.focus();
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => {
        cancelAnimationFrame(frame);
        document.body.style.overflow = previousOverflow;
      };
    }

    setVisible(false);
    // Already closed (first render, or closed natively: `onNativeClose` cleared the list).
    if (!dialog.open) return;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      dialog.removeEventListener('transitionend', onEnd);
      clearTimeout(timer);
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
      setRendered(false);
    };
    const onEnd = (event: Event) => {
      if (event.target === dialog) finish();
    };
    dialog.addEventListener('transitionend', onEnd);
    const timer = setTimeout(finish, CLOSE_FALLBACK_MS);
    return () => {
      dialog.removeEventListener('transitionend', onEnd);
      clearTimeout(timer);
    };
  }, [open]);

  // Only the backdrop hits the dialog element itself; require press and release there so a
  // drag that starts in the content (text selection, scrolling) does not close the sheet.
  const onDialogPointerDown = (event: PointerEvent<HTMLDialogElement>) => {
    pressedOnBackdrop.current = event.target === event.currentTarget;
  };
  const onDialogClick = (event: MouseEvent<HTMLDialogElement>) => {
    const onBackdrop = event.target === event.currentTarget && pressedOnBackdrop.current;
    pressedOnBackdrop.current = false;
    if (onBackdrop) onClose();
  };

  const { popular, others } = useMemo(() => {
    const codes = data ? availableCodes(data) : [...POPULAR];
    const set = new Set(codes);
    return {
      popular: POPULAR.filter((code) => set.has(code)),
      others: codes.filter((code) => !POPULAR.includes(code)).sort(compareByName),
    };
  }, [data]);

  const searching = query.trim() !== '';
  const matches = searching
    ? [...popular, ...others].filter((code) => matchesQuery(code, getCurrency(code).name, query))
    : [];
  const atMinimum = currencies.length <= MIN_CURRENCIES;

  const toggle = (code: string) => {
    if (currencies.includes(code)) {
      if (!atMinimum) removeCurrency(code);
    } else {
      addCurrency(code);
    }
  };

  const renderItems = (codes: readonly string[]) => (
    <ul className={styles.items}>
      {codes.map((code) => {
        const currency = getCurrency(code);
        const chosen = currencies.includes(code);
        return (
          <li key={code}>
            <button
              type="button"
              className={styles.item}
              aria-label={`${currency.code} ${currency.name}`}
              aria-pressed={chosen}
              aria-disabled={chosen && atMinimum ? 'true' : undefined}
              onClick={() => toggle(code)}
            >
              <SymbolBadge tint={currency.tint} symbol={currency.symbol} size={32} />
              <span className={styles.texts}>
                <span className={styles.code}>{currency.code}</span>
                <span className={styles.name}>{currency.name}</span>
              </span>
              <span className={styles.check}>{chosen ? <CheckIcon /> : null}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  const section = (key: 'popular' | 'allCurrencies', codes: readonly string[]) =>
    codes.length === 0 ? null : (
      <section className={styles.section} aria-labelledby={`${titleId}-${key}`}>
        <h3 id={`${titleId}-${key}`} className={styles.sectionTitle}>
          {t(key)}
        </h3>
        {renderItems(codes)}
      </section>
    );

  return (
    <dialog
      ref={dialogRef}
      className={visible ? `${styles.dialog} ${styles.isOpen}` : styles.dialog}
      aria-labelledby={titleId}
      onPointerDown={onDialogPointerDown}
      onClick={onDialogClick}
    >
      <div className={styles.content}>
        <div className={styles.head}>
          <span className={styles.handle} aria-hidden="true" />
          <div className={styles.titleRow}>
            <h2 id={titleId} className={styles.title}>
              {t('addCurrency')}
            </h2>
            <button
              ref={closeRef}
              type="button"
              className={styles.close}
              onClick={onClose}
              aria-label={t('close')}
            >
              <CloseIcon />
            </button>
          </div>
          <label className={styles.search}>
            <SearchIcon />
            <input
              ref={searchRef}
              className={styles.input}
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder={t('searchCurrency')}
              aria-label={t('searchCurrency')}
              value={query}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
              onKeyDown={blurOnEnter}
            />
          </label>
        </div>
        <div ref={scrollRef} className={styles.scroll}>
          {!rendered ? null : searching ? (
            matches.length > 0 ? (
              renderItems(matches)
            ) : (
              <p className={styles.empty} role="status">
                {t('noResults')}
              </p>
            )
          ) : (
            <>
              {section('popular', popular)}
              {section('allCurrencies', others)}
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
