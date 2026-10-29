import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useT, type Language } from '@/i18n';
import { useSettings, type Theme } from '@/state/SettingsContext';
import { Segmented } from './Segmented';
import styles from './SettingsSheet.module.css';

export interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
}

/** Fallback when `transitionend` never fires (reduced motion, 0 ms transitions). */
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

export function SettingsSheet({ open, onClose }: SettingsSheetProps) {
  const t = useT();
  const { language, theme, setLanguage, setTheme } = useSettings();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Escape fires `cancel`: keep the exit animation and the `open` prop in control.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onCancel = (event: Event) => {
      event.preventDefault();
      onCloseRef.current();
    };
    dialog.addEventListener('cancel', onCancel);
    return () => dialog.removeEventListener('cancel', onCancel);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open && typeof dialog.showModal === 'function') dialog.showModal();
      closeRef.current?.focus();
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => {
        cancelAnimationFrame(frame);
        document.body.style.overflow = previousOverflow;
      };
    }

    setVisible(false);
    if (!dialog.open) return;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      dialog.removeEventListener('transitionend', onEnd);
      clearTimeout(timer);
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    };
    const onEnd = (event: TransitionEvent) => {
      if (event.target === dialog) finish();
    };
    dialog.addEventListener('transitionend', onEnd);
    const timer = setTimeout(finish, CLOSE_FALLBACK_MS);
    return () => {
      dialog.removeEventListener('transitionend', onEnd);
      clearTimeout(timer);
    };
  }, [open]);

  // Clicks on the content land on inner elements; only the backdrop hits the dialog itself.
  const onDialogClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  const languageOptions: { value: Language; label: string }[] = [
    { value: 'nl', label: t('lang.nl') },
    { value: 'en', label: t('lang.en') },
  ];
  const themeOptions: { value: Theme; label: string }[] = [
    { value: 'system', label: t('theme.system') },
    { value: 'light', label: t('theme.light') },
    { value: 'dark', label: t('theme.dark') },
  ];

  return (
    <dialog
      ref={dialogRef}
      className={visible ? `${styles.dialog} ${styles.isOpen}` : styles.dialog}
      aria-labelledby="settings-title"
      onClick={onDialogClick}
    >
      <div className={styles.content}>
        <span className={styles.handle} aria-hidden="true" />
        <div className={styles.titleRow}>
          <h2 id="settings-title" className={styles.title}>
            {t('settings')}
          </h2>
          <button
            ref={closeRef}
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label={t('close')}
            autoFocus
          >
            <CloseIcon />
          </button>
        </div>
        <div className={styles.group}>
          <span className={styles.label}>{t('language')}</span>
          <Segmented
            name="language"
            ariaLabel={t('language')}
            options={languageOptions}
            value={language}
            onChange={setLanguage}
          />
        </div>
        <div className={styles.group}>
          <span className={styles.label}>{t('appearance')}</span>
          <Segmented
            name="theme"
            ariaLabel={t('appearance')}
            options={themeOptions}
            value={theme}
            onChange={setTheme}
          />
        </div>
      </div>
    </dialog>
  );
}
