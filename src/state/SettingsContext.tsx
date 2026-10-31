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
import { formatAmountInput } from '@/lib/amountInput';
import {
  amountTextFor,
  ASSET_IDS,
  DEFAULT_ITEMS,
  getItem,
  GRAMS_PER_UNIT,
  inputDecimals,
  METAL_UNITS,
  type MetalUnit,
} from '@/lib/assets';
import { parseAmount } from '@/lib/money';
import { DEFAULT_CURRENCIES, LEGACY_CURRENCIES } from '@/lib/currencies';
import { readJSON, writeJSON } from '@/lib/storage';

/**
 * SPEC §13 "Items model": the user's items (fiat codes and `XAU`/`XAG`/`BTC`, display order),
 * the base (any item), the typed amount and the unit the metals are shown in.
 */
export interface Settings {
  items: string[];
  base: string;
  amount: string;
  metalUnit: MetalUnit;
}

export interface SettingsApi extends Settings {
  /** Any item in `items` (case-insensitive); ignored otherwise. Re-formats the amount. */
  setBase: (base: string) => void;
  setAmount: (amount: string) => void;
  /** Appends an item (case-insensitive); ignored when already listed or not a 3-letter code. */
  addItem: (code: string) => void;
  /** Ignored when it would leave fewer than 2; removing the base makes the first item the base. */
  removeItem: (code: string) => void;
  /** Moves `from` to the index of `to` (SPEC §12); ignored unless both are listed. Base unchanged. */
  moveItem: (from: string, to: string) => void;
  /** Ignored for unknown units; with a metal base it converts the typed quantity to the new unit. */
  setMetalUnit: (unit: MetalUnit) => void;
}

const STORAGE_KEY = 'settings';
/**
 * Version written with the stored settings. v5 replaced `currencies` with `items` (assets
 * included) and added `metalUnit`: v4 objects keep their currencies and get XAU, XAG, BTC
 * appended. v4 added `currencies`: older objects (users who saw the fixed four) migrate to
 * EUR, USD, GBP, AED (+ the assets) and keep base and amount. v3 dropped language and theme.
 */
export const SETTINGS_VERSION = 5;

export const MIN_ITEMS = 2;

const DEFAULT_METAL_UNIT: MetalUnit = 'g';

const CODE_RE = /^[A-Z]{3}$/;

const toCode = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
};

const toMetalUnit = (value: unknown): MetalUnit | null =>
  (METAL_UNITS as readonly unknown[]).includes(value) ? (value as MetalUnit) : null;

export const defaultSettings = (): Settings => ({
  items: [...DEFAULT_ITEMS],
  base: 'EUR',
  amount: '',
  metalUnit: DEFAULT_METAL_UNIT,
});

/**
 * Enforces the invariants on any input: upper-case 3-letter codes, no duplicates (first one
 * wins), at least 2 items (topped up from the defaults), `base` in `items` (else the first
 * one), `amount` a string, `metalUnit` one of g/oz/kg (else `g`). Used by load,
 * `initialSettings` and every setter.
 */
export function normalise(input: Partial<Record<keyof Settings, unknown>>): Settings {
  const items: string[] = [];
  const raw = Array.isArray(input.items) ? input.items : [];
  for (const value of raw) {
    const code = toCode(value);
    if (code && !items.includes(code)) items.push(code);
  }
  for (const code of DEFAULT_ITEMS) {
    if (items.length >= MIN_ITEMS) break;
    if (!items.includes(code)) items.push(code);
  }
  const base = toCode(input.base);
  return {
    items,
    base: base && items.includes(base) ? base : items[0],
    amount: typeof input.amount === 'string' ? input.amount : '',
    metalUnit: toMetalUnit(input.metalUnit) ?? DEFAULT_METAL_UNIT,
  };
}

/** The list a stored object migrates to (SPEC §13): see `SETTINGS_VERSION`. */
function storedItems(s: Record<string, unknown>, version: number): readonly unknown[] {
  if (version >= 5) return Array.isArray(s.items) ? s.items : DEFAULT_ITEMS;
  if (version === 4) {
    const currencies = Array.isArray(s.currencies) ? s.currencies : DEFAULT_CURRENCIES;
    return [...currencies, ...ASSET_IDS];
  }
  return [...LEGACY_CURRENCIES, ...ASSET_IDS];
}

/**
 * Stored settings migrated and normalised. Without a stored object: the defaults. Version 5:
 * as stored. Version 4: its `currencies` (the default two when invalid) + XAU, XAG, BTC.
 * Version < 4 (or none): the legacy four + the three assets. Base and amount are kept; fields
 * of older versions (`language`, `theme`, `currencies`) are dropped.
 */
export function loadSettings(): Settings {
  const stored = readJSON<unknown>(STORAGE_KEY, null);
  if (typeof stored !== 'object' || stored === null) return defaultSettings();
  const s = stored as Record<string, unknown>;
  const version = typeof s.version === 'number' ? s.version : 0;
  return normalise({
    items: storedItems(s, version),
    base: s.base,
    amount: s.amount,
    metalUnit: s.metalUnit,
  });
}

const sameList = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((code, i) => code === b[i]);

const sameSettings = (a: Settings, b: Settings): boolean =>
  a.base === b.base &&
  a.amount === b.amount &&
  a.metalUnit === b.metalUnit &&
  sameList(a.items, b.items);

const isMetal = (code: string): boolean => getItem(code).kind === 'metal';

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
      items: settings.items,
      base: settings.base,
      amount: settings.amount,
      metalUnit: settings.metalUnit,
      version: SETTINGS_VERSION,
    });
  }, [settings]);

  /**
   * Applies `change` and normalises; keeps the old object when nothing changed, and the old
   * `items` array when the list did not change. When the base changes (setBase, or removing
   * the base), or the metal unit changes while the base is a metal, the amount is re-formatted
   * with the base's input decimals (SPEC §12, §13): extra decimals dropped, the number itself
   * is not converted.
   */
  const update = useCallback((change: (s: Settings) => Partial<Settings> | null) => {
    setSettings((s) => {
      const patch = change(s);
      if (!patch) return s;
      const next = normalise({ ...s, ...patch });
      const unitMatters = next.metalUnit !== s.metalUnit && isMetal(next.base);
      if (next.base !== s.base || unitMatters) {
        const { amount } = next;
        next.amount = formatAmountInput(
          amount,
          amount.length,
          inputDecimals(next.base, next.metalUnit),
        ).text;
      }
      if (sameSettings(s, next)) return s;
      return sameList(s.items, next.items) ? { ...next, items: s.items } : next;
    });
  }, []);

  const setBase = useCallback(
    (base: string) =>
      update((s) => {
        const code = toCode(base);
        return code && s.items.includes(code) ? { base: code } : null;
      }),
    [update],
  );
  const setAmount = useCallback((amount: string) => update(() => ({ amount })), [update]);
  const addItem = useCallback(
    (code: string) =>
      update((s) => {
        const c = toCode(code);
        return c && !s.items.includes(c) ? { items: [...s.items, c] } : null;
      }),
    [update],
  );
  const removeItem = useCallback(
    (code: string) =>
      update((s) => {
        const c = toCode(code);
        if (!c || !s.items.includes(c) || s.items.length <= MIN_ITEMS) return null;
        return { items: s.items.filter((x) => x !== c) };
      }),
    [update],
  );
  const moveItem = useCallback(
    (from: string, to: string) =>
      update((s) => {
        const a = s.items.indexOf(toCode(from) ?? '');
        const b = s.items.indexOf(toCode(to) ?? '');
        if (a < 0 || b < 0 || a === b) return null;
        const items = [...s.items];
        items.splice(b, 0, ...items.splice(a, 1));
        return { items };
      }),
    [update],
  );
  const setMetalUnit = useCallback(
    (unit: MetalUnit) =>
      update((s) => {
        const u = toMetalUnit(unit);
        if (!u || u === s.metalUnit) return null;
        // With a metal base the typed quantity is converted (895,93 g -> 28,80 oz), so the
        // amount of metal, and every result, stays the same.
        const value = isMetal(s.base) ? parseAmount(s.amount) : null;
        if (value === null) return { metalUnit: u };
        const converted = (value * GRAMS_PER_UNIT[s.metalUnit]) / GRAMS_PER_UNIT[u];
        return { metalUnit: u, amount: amountTextFor(converted, s.base, u) };
      }),
    [update],
  );

  const value = useMemo<SettingsApi>(
    () => ({
      ...settings,
      setBase,
      setAmount,
      addItem,
      removeItem,
      moveItem,
      setMetalUnit,
    }),
    [settings, setBase, setAmount, addItem, removeItem, moveItem, setMetalUnit],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsApi {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
