import { act, render, screen } from '@testing-library/react';
import {
  normalise,
  SETTINGS_VERSION,
  SettingsProvider,
  useSettings,
  type SettingsApi,
} from './SettingsContext';

let api: SettingsApi;
function Probe() {
  api = useSettings();
  return <p data-testid="settings">{JSON.stringify({ ...api })}</p>;
}

const stored = () => JSON.parse(localStorage.getItem('wissel.settings') ?? 'null');

function renderProvider() {
  return render(
    <SettingsProvider>
      <Probe />
    </SettingsProvider>,
  );
}

afterEach(() => {
  localStorage.clear();
});

const LEGACY = ['EUR', 'USD', 'GBP', 'AED'];

describe('SettingsProvider state', () => {
  it('defaults to EUR and USD with EUR as base, and persists every change as version 4', () => {
    renderProvider();
    expect(SETTINGS_VERSION).toBe(4);
    expect(api).toMatchObject({ currencies: ['EUR', 'USD'], base: 'EUR', amount: '' });
    expect(stored()).toEqual({ currencies: ['EUR', 'USD'], base: 'EUR', amount: '', version: 4 });

    act(() => {
      api.setBase('USD');
      api.setAmount('1.234,56');
    });
    expect(api).toMatchObject({ base: 'USD', amount: '1.234,56' });
    expect(stored()).toEqual({
      currencies: ['EUR', 'USD'],
      base: 'USD',
      amount: '1.234,56',
      version: 4,
    });
  });

  it('migrates version 3 settings to the legacy four, keeping base and amount', () => {
    localStorage.setItem(
      'wissel.settings',
      JSON.stringify({ base: 'GBP', amount: '1250', version: 3 }),
    );
    renderProvider();
    expect(JSON.parse(screen.getByTestId('settings').textContent ?? 'null')).toEqual({
      currencies: LEGACY,
      base: 'GBP',
      amount: '1250',
    });
    expect(stored()).toEqual({ currencies: LEGACY, base: 'GBP', amount: '1250', version: 4 });
  });

  it('migrates version 2 settings and drops language and theme', () => {
    localStorage.setItem(
      'wissel.settings',
      JSON.stringify({ language: 'nl', theme: 'dark', base: 'USD', amount: '5', version: 2 }),
    );
    renderProvider();
    expect(api).toMatchObject({ currencies: LEGACY, base: 'USD', amount: '5' });
    expect(stored()).toEqual({ currencies: LEGACY, base: 'USD', amount: '5', version: 4 });
    expect(stored()).not.toHaveProperty('language');
    expect(stored()).not.toHaveProperty('theme');
  });

  it('migrates settings stored without a version to the legacy four', () => {
    localStorage.setItem(
      'wissel.settings',
      JSON.stringify({ language: 'nl', theme: 'dark', base: 'AED', amount: '10' }),
    );
    renderProvider();
    expect(api).toMatchObject({ currencies: LEGACY, base: 'AED', amount: '10' });
    expect(stored()).toEqual({ currencies: LEGACY, base: 'AED', amount: '10', version: 4 });
  });

  it('loads version 4 settings with their own list', () => {
    localStorage.setItem(
      'wissel.settings',
      JSON.stringify({ currencies: ['JPY', 'CHF', 'EUR'], base: 'CHF', amount: '7', version: 4 }),
    );
    renderProvider();
    expect(api).toMatchObject({ currencies: ['JPY', 'CHF', 'EUR'], base: 'CHF', amount: '7' });
  });

  it('loads stored settings, ignoring invalid fields', () => {
    localStorage.setItem(
      'wissel.settings',
      JSON.stringify({ base: 'XYZ', amount: 12, version: 3 }),
    );
    renderProvider();
    expect(api).toMatchObject({ currencies: LEGACY, base: 'EUR', amount: '' });
  });

  it('falls back to the default list when a version 4 list is invalid', () => {
    localStorage.setItem(
      'wissel.settings',
      JSON.stringify({ currencies: 'EUR', base: 'USD', amount: '1', version: 4 }),
    );
    renderProvider();
    expect(api).toMatchObject({ currencies: ['EUR', 'USD'], base: 'USD', amount: '1' });
  });

  it('initialSettings overrides defaults, is normalised and ignores storage', () => {
    localStorage.setItem('wissel.settings', JSON.stringify({ base: 'AED' }));
    render(
      <SettingsProvider initialSettings={{ amount: '1250' }}>
        <Probe />
      </SettingsProvider>,
    );
    expect(api).toMatchObject({ currencies: ['EUR', 'USD'], base: 'EUR', amount: '1250' });
    expect(screen.getByTestId('settings')).toHaveTextContent('"amount":"1250"');
  });

  it('normalises initialSettings: a base outside the list moves to the first currency', () => {
    render(
      <SettingsProvider initialSettings={{ currencies: ['gbp', 'AED', 'GBP'], base: 'USD' }}>
        <Probe />
      </SettingsProvider>,
    );
    expect(api).toMatchObject({ currencies: ['GBP', 'AED'], base: 'GBP' });
  });

  it('throws outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow(/SettingsProvider/);
    vi.restoreAllMocks();
  });
});

describe('SettingsProvider invariants', () => {
  it('appends new currencies in insertion order and ignores duplicates and bad codes', () => {
    renderProvider();
    act(() => api.addCurrency('chf'));
    act(() => api.addCurrency('JPY'));
    act(() => api.addCurrency('CHF'));
    act(() => api.addCurrency('EUR'));
    act(() => api.addCurrency('nope'));
    act(() => api.addCurrency(''));
    expect(api.currencies).toEqual(['EUR', 'USD', 'CHF', 'JPY']);
    expect(stored().currencies).toEqual(['EUR', 'USD', 'CHF', 'JPY']);
  });

  it('keeps codes that the rates table may not have', () => {
    renderProvider();
    act(() => api.addCurrency('XYZ'));
    expect(api.currencies).toEqual(['EUR', 'USD', 'XYZ']);
  });

  it('never goes below 2 currencies', () => {
    renderProvider();
    act(() => api.removeCurrency('USD'));
    expect(api.currencies).toEqual(['EUR', 'USD']);
    act(() => api.addCurrency('GBP'));
    act(() => api.removeCurrency('USD'));
    expect(api.currencies).toEqual(['EUR', 'GBP']);
    act(() => api.removeCurrency('EUR'));
    expect(api.currencies).toEqual(['EUR', 'GBP']);
  });

  it('removing the base makes the first remaining currency the base', () => {
    renderProvider();
    act(() => {
      api.addCurrency('GBP');
      api.addCurrency('AED');
    });
    act(() => api.setBase('GBP'));
    act(() => api.removeCurrency('gbp'));
    expect(api).toMatchObject({ currencies: ['EUR', 'USD', 'AED'], base: 'EUR' });
    act(() => api.setBase('AED'));
    act(() => api.removeCurrency('EUR'));
    expect(api).toMatchObject({ currencies: ['USD', 'AED'], base: 'AED' });
    act(() => api.removeCurrency('AED'));
    expect(api).toMatchObject({ currencies: ['USD', 'AED'], base: 'AED' });
  });

  it('removing a code that is not chosen keeps the same list', () => {
    renderProvider();
    act(() => api.addCurrency('GBP'));
    const before = api.currencies;
    act(() => api.removeCurrency('JPY'));
    expect(api.currencies).toBe(before);
  });

  it('setBase ignores codes that are not chosen and accepts lower case', () => {
    renderProvider();
    act(() => api.setBase('GBP'));
    expect(api.base).toBe('EUR');
    act(() => api.setBase('xyz'));
    expect(api.base).toBe('EUR');
    act(() => api.setBase('usd'));
    expect(api.base).toBe('USD');
  });

  it('moveCurrency moves a code to the index of another and keeps the base', () => {
    renderProvider();
    act(() => {
      api.addCurrency('GBP');
      api.addCurrency('AED');
    });
    act(() => api.moveCurrency('USD', 'GBP'));
    expect(api).toMatchObject({ currencies: ['EUR', 'GBP', 'USD', 'AED'], base: 'EUR' });
    act(() => api.moveCurrency('aed', 'eur'));
    expect(api.currencies).toEqual(['AED', 'EUR', 'GBP', 'USD']);
    expect(api.base).toBe('EUR');
    expect(stored().currencies).toEqual(['AED', 'EUR', 'GBP', 'USD']);
    act(() => api.moveCurrency('EUR', 'USD'));
    expect(api.currencies).toEqual(['AED', 'GBP', 'USD', 'EUR']);
  });

  it('moveCurrency ignores unknown codes and a move onto itself', () => {
    renderProvider();
    act(() => api.addCurrency('GBP'));
    const before = api.currencies;
    act(() => api.moveCurrency('USD', 'JPY'));
    act(() => api.moveCurrency('JPY', 'USD'));
    act(() => api.moveCurrency('USD', 'USD'));
    expect(api.currencies).toBe(before);
  });

  it('re-formats the amount with the new base currency decimals', () => {
    render(
      <SettingsProvider initialSettings={{ currencies: ['EUR', 'JPY', 'KWD'], amount: '12,50' }}>
        <Probe />
      </SettingsProvider>,
    );
    act(() => api.setBase('KWD'));
    expect(api.amount).toBe('12,50');
    act(() => api.setBase('JPY'));
    expect(api.amount).toBe('12');
    act(() => api.setAmount('1234'));
    act(() => api.setBase('EUR'));
    expect(api.amount).toBe('1.234');
  });

  it('re-formats the amount when removing the base moves it', () => {
    render(
      <SettingsProvider
        initialSettings={{ currencies: ['EUR', 'JPY', 'USD'], base: 'EUR', amount: '9,99' }}
      >
        <Probe />
      </SettingsProvider>,
    );
    act(() => api.moveCurrency('JPY', 'EUR'));
    act(() => api.removeCurrency('EUR'));
    expect(api).toMatchObject({ currencies: ['JPY', 'USD'], base: 'JPY', amount: '9' });
  });
});

describe('normalise', () => {
  it('upper-cases, de-duplicates, drops bad codes and tops up to 2 currencies', () => {
    expect(
      normalise({ currencies: ['chf', 'CHF', 1, 'toolong'], base: 'chf', amount: '3' }),
    ).toEqual({ currencies: ['CHF', 'EUR'], base: 'CHF', amount: '3' });
    expect(normalise({ currencies: ['EUR'] })).toEqual({
      currencies: ['EUR', 'USD'],
      base: 'EUR',
      amount: '',
    });
    expect(normalise({})).toEqual({ currencies: ['EUR', 'USD'], base: 'EUR', amount: '' });
  });

  it('moves a base outside the list to the first currency and requires a string amount', () => {
    expect(normalise({ currencies: ['USD', 'JPY'], base: 'EUR', amount: 5 })).toEqual({
      currencies: ['USD', 'JPY'],
      base: 'USD',
      amount: '',
    });
  });
});
