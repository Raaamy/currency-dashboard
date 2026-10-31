import { act, render, screen } from '@testing-library/react';
import {
  normalise,
  SETTINGS_VERSION,
  SettingsProvider,
  useSettings,
  type Settings,
  type SettingsApi,
} from './SettingsContext';

let api: SettingsApi;
function Probe() {
  api = useSettings();
  const { items, base, amount, metalUnit } = api;
  return <p data-testid="settings">{JSON.stringify({ items, base, amount, metalUnit })}</p>;
}

const stored = () => JSON.parse(localStorage.getItem('wissel.settings') ?? 'null');
const shown = () => JSON.parse(screen.getByTestId('settings').textContent ?? 'null');

function renderProvider(initialSettings?: Partial<Settings>) {
  return render(
    <SettingsProvider initialSettings={initialSettings}>
      <Probe />
    </SettingsProvider>,
  );
}

const store = (value: unknown) => localStorage.setItem('wissel.settings', JSON.stringify(value));

afterEach(() => {
  localStorage.clear();
});

const ASSETS = ['XAU', 'XAG', 'BTC'];
const DEFAULT_ITEMS = ['EUR', 'USD', ...ASSETS];
const LEGACY_ITEMS = ['EUR', 'USD', 'GBP', 'AED', ...ASSETS];

describe('SettingsProvider state', () => {
  it('defaults to EUR, USD and the three assets with EUR as base and grams, persisted as v5', () => {
    renderProvider();
    expect(SETTINGS_VERSION).toBe(5);
    expect(shown()).toEqual({ items: DEFAULT_ITEMS, base: 'EUR', amount: '', metalUnit: 'g' });
    expect(stored()).toEqual({
      items: DEFAULT_ITEMS,
      base: 'EUR',
      amount: '',
      metalUnit: 'g',
      version: 5,
    });

    act(() => {
      api.setBase('USD');
      api.setAmount('1.234,56');
    });
    expect(api).toMatchObject({ base: 'USD', amount: '1.234,56' });
    expect(stored()).toEqual({
      items: DEFAULT_ITEMS,
      base: 'USD',
      amount: '1.234,56',
      metalUnit: 'g',
      version: 5,
    });
  });

  it('migrates version 4: its currencies + the three assets, keeping base and amount', () => {
    store({ currencies: ['JPY', 'CHF', 'EUR'], base: 'CHF', amount: '7', version: 4 });
    renderProvider();
    expect(shown()).toEqual({
      items: ['JPY', 'CHF', 'EUR', ...ASSETS],
      base: 'CHF',
      amount: '7',
      metalUnit: 'g',
    });
    expect(stored()).toEqual({
      items: ['JPY', 'CHF', 'EUR', ...ASSETS],
      base: 'CHF',
      amount: '7',
      metalUnit: 'g',
      version: 5,
    });
    expect(stored()).not.toHaveProperty('currencies');
  });

  it('migrates version 4 without duplicating an asset already in the list', () => {
    store({ currencies: ['EUR', 'xau', 'USD'], base: 'USD', amount: '', version: 4 });
    renderProvider();
    expect(api.items).toEqual(['EUR', 'XAU', 'USD', 'XAG', 'BTC']);
  });

  it('migrates an invalid version 4 list to the default two + the assets', () => {
    store({ currencies: 'EUR', base: 'USD', amount: '1', version: 4 });
    renderProvider();
    expect(api).toMatchObject({ items: DEFAULT_ITEMS, base: 'USD', amount: '1' });
  });

  it('migrates version 3 settings to the legacy four + the assets, keeping base and amount', () => {
    store({ base: 'GBP', amount: '1250', version: 3 });
    renderProvider();
    expect(shown()).toEqual({ items: LEGACY_ITEMS, base: 'GBP', amount: '1250', metalUnit: 'g' });
    expect(stored()).toEqual({
      items: LEGACY_ITEMS,
      base: 'GBP',
      amount: '1250',
      metalUnit: 'g',
      version: 5,
    });
  });

  it('migrates version 2 settings and drops language and theme', () => {
    store({ language: 'nl', theme: 'dark', base: 'USD', amount: '5', version: 2 });
    renderProvider();
    expect(api).toMatchObject({ items: LEGACY_ITEMS, base: 'USD', amount: '5' });
    expect(stored()).toEqual({
      items: LEGACY_ITEMS,
      base: 'USD',
      amount: '5',
      metalUnit: 'g',
      version: 5,
    });
    expect(stored()).not.toHaveProperty('language');
    expect(stored()).not.toHaveProperty('theme');
  });

  it('migrates settings stored without a version to the legacy four + the assets', () => {
    store({ language: 'nl', theme: 'dark', base: 'AED', amount: '10' });
    renderProvider();
    expect(api).toMatchObject({ items: LEGACY_ITEMS, base: 'AED', amount: '10' });
  });

  it('loads version 5 settings as stored, any item as base', () => {
    store({
      items: ['XAU', 'BTC', 'JPY'],
      base: 'BTC',
      amount: '0,5',
      metalUnit: 'kg',
      version: 5,
    });
    renderProvider();
    expect(shown()).toEqual({
      items: ['XAU', 'BTC', 'JPY'],
      base: 'BTC',
      amount: '0,5',
      metalUnit: 'kg',
    });
  });

  it('loads version 5 with invalid fields: default list, base fallback, grams', () => {
    store({ items: 'EUR', base: 'XYZ', amount: 12, metalUnit: 'lb', version: 5 });
    renderProvider();
    expect(shown()).toEqual({ items: DEFAULT_ITEMS, base: 'EUR', amount: '', metalUnit: 'g' });
  });

  it('loads stored settings, ignoring invalid fields', () => {
    store({ base: 'XYZ', amount: 12, version: 3 });
    renderProvider();
    expect(api).toMatchObject({ items: LEGACY_ITEMS, base: 'EUR', amount: '' });
  });

  it('initialSettings overrides defaults, is normalised and ignores storage', () => {
    store({ base: 'AED' });
    renderProvider({ amount: '1250' });
    expect(api).toMatchObject({ items: DEFAULT_ITEMS, base: 'EUR', amount: '1250' });
    expect(screen.getByTestId('settings')).toHaveTextContent('"amount":"1250"');
  });

  it('normalises initialSettings: a base outside the list moves to the first item', () => {
    renderProvider({ items: ['gbp', 'AED', 'GBP'], base: 'USD' });
    expect(api).toMatchObject({ items: ['GBP', 'AED'], base: 'GBP' });
  });

  it('throws outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow(/SettingsProvider/);
    vi.restoreAllMocks();
  });
});

describe('SettingsProvider invariants', () => {
  it('appends new items in insertion order and ignores duplicates and bad codes', () => {
    renderProvider({ items: ['EUR', 'USD'] });
    act(() => api.addItem('chf'));
    act(() => api.addItem('xau'));
    act(() => api.addItem('CHF'));
    act(() => api.addItem('EUR'));
    act(() => api.addItem('nope'));
    act(() => api.addItem(''));
    expect(api.items).toEqual(['EUR', 'USD', 'CHF', 'XAU']);
    expect(stored().items).toEqual(['EUR', 'USD', 'CHF', 'XAU']);
  });

  it('keeps codes that the rates table may not have', () => {
    renderProvider({ items: ['EUR', 'USD'] });
    act(() => api.addItem('XYZ'));
    expect(api.items).toEqual(['EUR', 'USD', 'XYZ']);
  });

  it('never goes below 2 items', () => {
    renderProvider({ items: ['EUR', 'XAU'] });
    act(() => api.removeItem('XAU'));
    expect(api.items).toEqual(['EUR', 'XAU']);
    act(() => api.addItem('BTC'));
    act(() => api.removeItem('xau'));
    expect(api.items).toEqual(['EUR', 'BTC']);
    act(() => api.removeItem('EUR'));
    expect(api.items).toEqual(['EUR', 'BTC']);
  });

  it('removing the base makes the first remaining item the base, which may be an asset', () => {
    renderProvider({ items: ['EUR', 'XAU', 'USD'], base: 'EUR', amount: '9,99' });
    act(() => api.removeItem('EUR'));
    expect(api).toMatchObject({ items: ['XAU', 'USD'], base: 'XAU', amount: '9,99' });
  });

  it('removing an item that is not listed keeps the same list', () => {
    renderProvider();
    const before = api.items;
    act(() => api.removeItem('JPY'));
    expect(api.items).toBe(before);
  });

  it('keeps the same items array when only the amount, base or unit change', () => {
    renderProvider();
    const before = api.items;
    act(() => api.setAmount('5'));
    act(() => api.setBase('XAU'));
    act(() => api.setMetalUnit('oz'));
    expect(api.items).toBe(before);
  });

  it('setBase accepts any listed item (case-insensitive) and ignores others', () => {
    renderProvider();
    act(() => api.setBase('GBP'));
    expect(api.base).toBe('EUR');
    act(() => api.setBase('xyz'));
    expect(api.base).toBe('EUR');
    act(() => api.setBase('xau'));
    expect(api.base).toBe('XAU');
    act(() => api.setBase('BTC'));
    expect(api.base).toBe('BTC');
    act(() => api.setBase('usd'));
    expect(api.base).toBe('USD');
  });

  it('moveItem moves an item to the index of another and keeps the base', () => {
    renderProvider({ items: ['EUR', 'USD', 'XAU', 'BTC'] });
    act(() => api.moveItem('USD', 'XAU'));
    expect(api).toMatchObject({ items: ['EUR', 'XAU', 'USD', 'BTC'], base: 'EUR' });
    act(() => api.moveItem('btc', 'eur'));
    expect(api.items).toEqual(['BTC', 'EUR', 'XAU', 'USD']);
    expect(api.base).toBe('EUR');
    expect(stored().items).toEqual(['BTC', 'EUR', 'XAU', 'USD']);
    act(() => api.moveItem('EUR', 'USD'));
    expect(api.items).toEqual(['BTC', 'XAU', 'USD', 'EUR']);
  });

  it('moveItem ignores unknown codes and a move onto itself', () => {
    renderProvider();
    const before = api.items;
    act(() => api.moveItem('USD', 'JPY'));
    act(() => api.moveItem('JPY', 'USD'));
    act(() => api.moveItem('USD', 'USD'));
    expect(api.items).toBe(before);
  });

  it('setMetalUnit stores g/oz/kg and ignores unknown units', () => {
    renderProvider();
    act(() => api.setMetalUnit('oz'));
    expect(api.metalUnit).toBe('oz');
    expect(stored().metalUnit).toBe('oz');
    act(() => api.setMetalUnit('lb' as never));
    expect(api.metalUnit).toBe('oz');
    act(() => api.setMetalUnit('kg'));
    expect(api.metalUnit).toBe('kg');
  });
});

describe('SettingsProvider amount re-formatting', () => {
  it('re-formats the amount with the new base input decimals (fiat)', () => {
    renderProvider({ items: ['EUR', 'JPY', 'KWD'], amount: '12,50' });
    act(() => api.setBase('KWD'));
    expect(api.amount).toBe('12,50');
    act(() => api.setBase('JPY'));
    expect(api.amount).toBe('12');
    act(() => api.setAmount('1234'));
    act(() => api.setBase('EUR'));
    expect(api.amount).toBe('1.234');
  });

  it('re-formats with the asset input decimals: BTC 8, g 2, oz and kg 3', () => {
    renderProvider({ items: ['EUR', 'BTC', 'XAU'], amount: '' });
    act(() => api.setBase('BTC'));
    act(() => api.setAmount('0,123456789'));
    act(() => api.setBase('EUR'));
    expect(api.amount).toBe('0,12');
    act(() => api.setAmount('0,123456789'));
    act(() => api.setBase('BTC'));
    expect(api.amount).toBe('0,12345678');
    act(() => api.setBase('XAU'));
    expect(api.amount).toBe('0,12');
    act(() => api.setAmount('1,2345'));
    act(() => api.setMetalUnit('oz'));
    expect(api.amount).toBe('1,234');
    act(() => api.setAmount('1,2345'));
    act(() => api.setMetalUnit('kg'));
    expect(api.amount).toBe('1,234');
  });

  it('re-formats when the metal unit changes while the base is a metal', () => {
    renderProvider({ items: ['EUR', 'XAU'], base: 'XAU', amount: '1,234', metalUnit: 'oz' });
    act(() => api.setMetalUnit('kg'));
    expect(api.amount).toBe('1,234');
    act(() => api.setMetalUnit('g'));
    expect(api.amount).toBe('1,23');
  });

  it('leaves the amount alone when the unit changes and the base is not a metal', () => {
    renderProvider({ items: ['EUR', 'BTC', 'XAU'], base: 'BTC', amount: '0,12345678' });
    act(() => api.setMetalUnit('g'));
    act(() => api.setMetalUnit('oz'));
    expect(api.amount).toBe('0,12345678');
  });

  it('re-formats the amount when removing the base moves it', () => {
    renderProvider({ items: ['EUR', 'JPY', 'USD'], base: 'EUR', amount: '9,99' });
    act(() => api.moveItem('JPY', 'EUR'));
    act(() => api.removeItem('EUR'));
    expect(api).toMatchObject({ items: ['JPY', 'USD'], base: 'JPY', amount: '9' });
  });
});

describe('compatibility aliases for the current UI (Task 18 removes them)', () => {
  it('currencies are the fiat items in list order', () => {
    renderProvider({ items: ['XAU', 'EUR', 'BTC', 'USD', 'GBP'] });
    expect(api.currencies).toEqual(['EUR', 'USD', 'GBP']);
  });

  it('currencies keep their reference while the list is unchanged', () => {
    renderProvider();
    const before = api.currencies;
    act(() => api.setAmount('12'));
    expect(api.currencies).toBe(before);
  });

  it('addCurrency, moveCurrency delegate to the item setters', () => {
    renderProvider();
    act(() => api.addCurrency('gbp'));
    expect(api.items).toEqual([...DEFAULT_ITEMS, 'GBP']);
    act(() => api.moveCurrency('GBP', 'USD'));
    expect(api.items).toEqual(['EUR', 'GBP', 'USD', ...ASSETS]);
    expect(api.currencies).toEqual(['EUR', 'GBP', 'USD']);
  });

  it('removeCurrency keeps at least 2 fiat items and ignores assets', () => {
    renderProvider();
    act(() => api.removeCurrency('USD'));
    expect(api.items).toEqual(DEFAULT_ITEMS);
    act(() => api.removeCurrency('XAU'));
    expect(api.items).toEqual(DEFAULT_ITEMS);
    act(() => api.addCurrency('GBP'));
    act(() => api.setBase('USD'));
    act(() => api.removeCurrency('usd'));
    expect(api).toMatchObject({ items: ['EUR', ...ASSETS, 'GBP'], base: 'EUR' });
    expect(api.currencies).toEqual(['EUR', 'GBP']);
  });
});

describe('normalise', () => {
  it('upper-cases, de-duplicates, drops bad codes and tops up to 2 items', () => {
    expect(
      normalise({ items: ['chf', 'CHF', 1, 'toolong'], base: 'chf', amount: '3', metalUnit: 'oz' }),
    ).toEqual({ items: ['CHF', 'EUR'], base: 'CHF', amount: '3', metalUnit: 'oz' });
    expect(normalise({ items: ['XAU'] })).toEqual({
      items: ['XAU', 'EUR'],
      base: 'XAU',
      amount: '',
      metalUnit: 'g',
    });
    expect(normalise({})).toEqual({
      items: ['EUR', 'USD'],
      base: 'EUR',
      amount: '',
      metalUnit: 'g',
    });
  });

  it('moves a base outside the list to the first item, requires a string amount and a known unit', () => {
    expect(normalise({ items: ['BTC', 'JPY'], base: 'EUR', amount: 5, metalUnit: 'lb' })).toEqual({
      items: ['BTC', 'JPY'],
      base: 'BTC',
      amount: '',
      metalUnit: 'g',
    });
  });
});
