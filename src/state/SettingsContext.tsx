/* eslint-disable react-refresh/only-export-components -- provider and its hook belong together */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { DEFAULT_CURRENCIES, LEGACY_CURRENCIES } from '@/lib/currencies';
import { readJSON, writeJSON } from '@/lib/storage';

/** SPEC §11 "Settings": the chosen currencies (insertion order), the base and the typed amount. */
export interface Settings {
  currencies: string[];
  base: string;
  amount: string;
}

export interface SettingsApi extends Settings {
  /** Ignored for codes that are not in `currencies`. */
  setBase: (base: string) => void;
  setAmount: (amount: string) => void;
  /** Appends a code (case-insensitive); ignored when already chosen or not a 3-letter code. */
  addCurrency: (code: string) => void;
  /** Ignored when it would leave fewer than 2; removing the base makes the first one the base. */
  removeCurrency: (code: string) => void;
}

const STORAGE_KEY = 'settings';
/**
 * Version written with the stored settings. v4 added `currencies`: older objects (users who
 * saw the fixed four) migrate to EUR, USD, GBP, AED and keep base and amount. v3 dropped the
 * language and theme fields.
 */
export const SETTINGS_VERSION = 4;

export const MIN_CURRENCIES = 2;

const CODE_RE = /^[A-Z]{3}$/;

const toCode = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
};

export const defaultSettings = (): Settings => ({
  currencies: [...DEFAULT_CURRENCIES],
  base: 'EUR',
  amount: '',
});

/**
 * Enforces the invariants on any input: upper-case 3-letter codes, no duplicates (first one
 * wins), at least 2 currencies (topped up from the defaults), `base` in `currencies` (else the
 * first one), `amount` a string. Used by load, `initialSettings` and every setter.
 */
export function normalise(input: Partial<Record<keyof Settings, unknown>>): Settings {
  const currencies: string[] = [];
  const raw = Array.isArray(input.currencies) ? input.currencies : [];
  for (const value of raw) {
    const code = toCode(value);
    if (code && !currencies.includes(code)) currencies.push(code);
  }
  for (const code of DEFAULT_CURRENCIES) {
    if (currencies.length >= MIN_CURRENCIES) break;
    if (!currencies.includes(code)) currencies.push(code);
  }
  const base = toCode(input.base);
  return {
    currencies,
    base: base && currencies.includes(base) ? base : currencies[0],
    amount: typeof input.amount === 'string' ? input.amount : '',
  };
}

/**
 * Stored settings migrated and normalised. Without a stored object: the defaults. Stored
 * version < 4 (or none): the legacy four currencies with the stored base and amount. Fields
 * from older versions (`language`, `theme`) are ignored.
 */
export function loadSettings(): Settings {
  const stored = readJSON<unknown>(STORAGE_KEY, null);
  if (typeof stored !== 'object' || stored === null) return defaultSettings();
  const s = stored as Record<string, unknown>;
  const version = typeof s.version === 'number' ? s.version : 0;
  return normalise({
    currencies:
      version < 4 ? [...LEGACY_CURRENCIES] : (s.currencies ?? defaultSettings().currencies),
    base: s.base,
    amount: s.amount,
  });
}

const sameSettings = (a: Settings, b: Settings): boolean =>
  a.base === b.base &&
  a.amount === b.amount &&
  a.currencies.length === b.currencies.length &&
  a.currencies.every((code, i) => code === b.currencies[i]);

const SettingsContext = createContext<SettingsApi | null>(null);

export interface SettingsProviderProps {
  children: ReactNode;
  /** Fixed starting state (tests): merged over the defaults and normalised; storage is not read. */
  initialSettings?: Partial<Settings>;
}

export function SettingsProvider({ children, initialSettings }: SettingsProviderProps) {
  const [settings, setSettings] = useState<Settings>(() =>
    initialSettings ? normalise({ ...defaultSettings(), ...initialSettings }) : loadSettings(),
  );

  useEffect(() => {
    writeJSON(STORAGE_KEY, {
      currencies: settings.currencies,
      base: settings.base,
      amount: settings.amount,
      version: SETTINGS_VERSION,
    });
  }, [settings]);

  /** Applies `change` and normalises; keeps the old object when nothing changed. */
  const update = useCallback((change: (s: Settings) => Partial<Settings> | null) => {
    setSettings((s) => {
      const patch = change(s);
      if (!patch) return s;
      const next = normalise({ ...s, ...patch });
      return sameSettings(s, next) ? s : next;
    });
  }, []);

  const setBase = useCallback(
    (base: string) =>
      update((s) => {
        const code = toCode(base);
        return code && s.currencies.includes(code) ? { base: code } : null;
      }),
    [update],
  );
  const setAmount = useCallback((amount: string) => update(() => ({ amount })), [update]);
  const addCurrency = useCallback(
    (code: string) =>
      update((s) => {
        const c = toCode(code);
        return c && !s.currencies.includes(c) ? { currencies: [...s.currencies, c] } : null;
      }),
    [update],
  );
  const removeCurrency = useCallback(
    (code: string) =>
      update((s) => {
        const c = toCode(code);
        if (!c || !s.currencies.includes(c) || s.currencies.length <= MIN_CURRENCIES) return null;
        return { currencies: s.currencies.filter((x) => x !== c) };
      }),
    [update],
  );

  const value = useMemo<SettingsApi>(
    () => ({ ...settings, setBase, setAmount, addCurrency, removeCurrency }),
    [settings, setBase, setAmount, addCurrency, removeCurrency],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsApi {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
