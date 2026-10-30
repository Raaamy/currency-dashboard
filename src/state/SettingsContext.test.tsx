import { act, render, screen } from '@testing-library/react';
import {
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

describe('SettingsProvider state', () => {
  it('defaults to EUR and an empty amount, and persists every change as version 3', () => {
    renderProvider();
    expect(SETTINGS_VERSION).toBe(3);
    expect(api).toMatchObject({ base: 'EUR', amount: '' });
    expect(stored()).toEqual({ base: 'EUR', amount: '', version: 3 });

    act(() => {
      api.setBase('GBP');
      api.setAmount('1.234,56');
    });
    expect(api).toMatchObject({ base: 'GBP', amount: '1.234,56' });
    expect(stored()).toEqual({ base: 'GBP', amount: '1.234,56', version: 3 });
  });

  it('loads version 2 settings as { base, amount } and drops language and theme', () => {
    localStorage.setItem(
      'wissel.settings',
      JSON.stringify({ language: 'nl', theme: 'dark', base: 'USD', amount: '5', version: 2 }),
    );
    renderProvider();
    expect(JSON.parse(screen.getByTestId('settings').textContent ?? 'null')).toEqual({
      base: 'USD',
      amount: '5',
    });
    expect(stored()).toEqual({ base: 'USD', amount: '5', version: 3 });
    expect(stored()).not.toHaveProperty('language');
    expect(stored()).not.toHaveProperty('theme');
  });

  it('keeps base and amount from settings stored without a version', () => {
    localStorage.setItem(
      'wissel.settings',
      JSON.stringify({ language: 'nl', theme: 'dark', base: 'GBP', amount: '10' }),
    );
    renderProvider();
    expect(api).toMatchObject({ base: 'GBP', amount: '10' });
    expect(stored()).toEqual({ base: 'GBP', amount: '10', version: 3 });
  });

  it('loads stored settings, ignoring invalid fields', () => {
    localStorage.setItem(
      'wissel.settings',
      JSON.stringify({ base: 'XYZ', amount: 12, version: 3 }),
    );
    renderProvider();
    expect(api).toMatchObject({ base: 'EUR', amount: '' });
  });

  it('initialSettings overrides defaults and ignores storage', () => {
    localStorage.setItem('wissel.settings', JSON.stringify({ base: 'AED' }));
    render(
      <SettingsProvider initialSettings={{ amount: '1250' }}>
        <Probe />
      </SettingsProvider>,
    );
    expect(api).toMatchObject({ base: 'EUR', amount: '1250' });
    expect(screen.getByTestId('settings')).toHaveTextContent('"amount":"1250"');
  });

  it('throws outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow(/SettingsProvider/);
    vi.restoreAllMocks();
  });
});
