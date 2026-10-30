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
import { CURRENCIES, type CurrencyCode } from '@/lib/currencies';
import { readJSON, writeJSON } from '@/lib/storage';

export interface Settings {
  base: CurrencyCode;
  amount: string;
}

export interface SettingsApi extends Settings {
  setBase: (base: CurrencyCode) => void;
  setAmount: (amount: string) => void;
}

const STORAGE_KEY = 'settings';
/**
 * Version written with the stored settings. v3 dropped the language and theme fields (the
 * copy is English only and light/dark follows the system); older objects keep base and amount.
 */
export const SETTINGS_VERSION = 3;

const isCurrency = (v: unknown): v is CurrencyCode => CURRENCIES.some((c) => c.code === v);

export const defaultSettings = (): Settings => ({
  base: 'EUR',
  amount: '',
});

/**
 * Stored settings validated field by field and merged over the defaults, whatever their
 * version. Fields from older versions (`language`, `theme`) are ignored.
 */
export function loadSettings(): Settings {
  const stored = readJSON<unknown>(STORAGE_KEY, null);
  const settings = defaultSettings();
  if (typeof stored !== 'object' || stored === null) return settings;
  const s = stored as Record<string, unknown>;
  return {
    base: isCurrency(s.base) ? s.base : settings.base,
    amount: typeof s.amount === 'string' ? s.amount : settings.amount,
  };
}

const SettingsContext = createContext<SettingsApi | null>(null);

export interface SettingsProviderProps {
  children: ReactNode;
  /** Fixed starting state (tests): merged over the defaults, storage is not read. */
  initialSettings?: Partial<Settings>;
}

export function SettingsProvider({ children, initialSettings }: SettingsProviderProps) {
  const [settings, setSettings] = useState<Settings>(() =>
    initialSettings ? { ...defaultSettings(), ...initialSettings } : loadSettings(),
  );

  useEffect(() => {
    writeJSON(STORAGE_KEY, {
      base: settings.base,
      amount: settings.amount,
      version: SETTINGS_VERSION,
    });
  }, [settings]);

  const setBase = useCallback((base: CurrencyCode) => setSettings((s) => ({ ...s, base })), []);
  const setAmount = useCallback((amount: string) => setSettings((s) => ({ ...s, amount })), []);

  const value = useMemo<SettingsApi>(
    () => ({ ...settings, setBase, setAmount }),
    [settings, setBase, setAmount],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsApi {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
