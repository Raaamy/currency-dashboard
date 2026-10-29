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
import { detectLanguage, isLanguage, type Language } from '@/i18n/locale';
import { CURRENCIES, type CurrencyCode } from '@/lib/currencies';
import { readJSON, writeJSON } from '@/lib/storage';

export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  language: Language;
  theme: Theme;
  base: CurrencyCode;
  amount: string;
}

export interface SettingsApi extends Settings {
  setLanguage: (language: Language) => void;
  setTheme: (theme: Theme) => void;
  setBase: (base: CurrencyCode) => void;
  setAmount: (amount: string) => void;
}

const STORAGE_KEY = 'settings';
/** Must match the `--bg` token per scheme and the theme-color metas in index.html. */
export const THEME_COLOR = { light: '#F6F3EE', dark: '#1C1A18' } as const;

const isTheme = (v: unknown): v is Theme => v === 'system' || v === 'light' || v === 'dark';
const isCurrency = (v: unknown): v is CurrencyCode => CURRENCIES.some((c) => c.code === v);

export const defaultSettings = (): Settings => ({
  language: detectLanguage(),
  theme: 'system',
  base: 'EUR',
  amount: '',
});

/** Stored settings validated field by field and merged over the defaults. */
export function loadSettings(): Settings {
  const stored = readJSON<unknown>(STORAGE_KEY, null);
  const settings = defaultSettings();
  if (typeof stored !== 'object' || stored === null) return settings;
  const s = stored as Record<string, unknown>;
  return {
    language: isLanguage(s.language) ? s.language : settings.language,
    theme: isTheme(s.theme) ? s.theme : settings.theme,
    base: isCurrency(s.base) ? s.base : settings.base,
    amount: typeof s.amount === 'string' ? s.amount : settings.amount,
  };
}

/** Applies the theme to `<html data-theme>` and the `<meta name="theme-color">` tags. */
export function applyTheme(theme: Theme, doc: Document = document): void {
  const root = doc.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;

  doc.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    if (theme === 'system') {
      const isDarkMeta = (meta.getAttribute('media') ?? '').includes('dark');
      meta.content = isDarkMeta ? THEME_COLOR.dark : THEME_COLOR.light;
    } else {
      meta.content = THEME_COLOR[theme];
    }
  });
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
    writeJSON(STORAGE_KEY, settings);
  }, [settings]);

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    document.documentElement.lang = settings.language;
  }, [settings.language]);

  const setLanguage = useCallback(
    (language: Language) => setSettings((s) => ({ ...s, language })),
    [],
  );
  const setTheme = useCallback((theme: Theme) => setSettings((s) => ({ ...s, theme })), []);
  const setBase = useCallback((base: CurrencyCode) => setSettings((s) => ({ ...s, base })), []);
  const setAmount = useCallback((amount: string) => setSettings((s) => ({ ...s, amount })), []);

  const value = useMemo<SettingsApi>(
    () => ({ ...settings, setLanguage, setTheme, setBase, setAmount }),
    [settings, setLanguage, setTheme, setBase, setAmount],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsApi {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
