import { act, render, screen } from '@testing-library/react';
import {
  SETTINGS_VERSION,
  SettingsProvider,
  THEME_COLOR,
  useSettings,
  type SettingsApi,
} from './SettingsContext';

let api: SettingsApi;
function Probe() {
  api = useSettings();
  return <p data-testid="settings">{JSON.stringify({ ...api })}</p>;
}

function addThemeMetas() {
  document.head.innerHTML = `
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="#F6F3EE" />
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#1C1A18" />`;
  const [light, dark] = Array.from(
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'),
  );
  return { light, dark };
}

afterEach(() => {
  localStorage.clear();
  document.head.innerHTML = '';
  delete document.documentElement.dataset.theme;
});

describe('SettingsProvider theme', () => {
  it('applies data-theme and theme-color metas, and restores them for system', () => {
    const { light, dark } = addThemeMetas();
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    );
    expect(document.documentElement.dataset.theme).toBeUndefined();

    act(() => api.setTheme('dark'));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(light.content).toBe('#1C1A18');
    expect(dark.content).toBe('#1C1A18');

    act(() => api.setTheme('light'));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(light.content).toBe(THEME_COLOR.light);
    expect(dark.content).toBe('#F6F3EE');

    act(() => api.setTheme('system'));
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(light.content).toBe('#F6F3EE');
    expect(dark.content).toBe('#1C1A18');
  });
});

describe('SettingsProvider state', () => {
  it('defaults to en (even for a Dutch browser), persists every change and sets <html lang>', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('nl-NL');
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    );
    expect(api).toMatchObject({ language: 'en', theme: 'system', base: 'EUR', amount: '' });
    expect(document.documentElement.lang).toBe('en');
    expect(JSON.parse(localStorage.getItem('wissel.settings') ?? 'null')).toMatchObject({
      version: SETTINGS_VERSION,
    });

    act(() => {
      api.setLanguage('nl');
      api.setBase('GBP');
      api.setAmount('1.234,56');
    });
    expect(api).toMatchObject({ language: 'nl', base: 'GBP', amount: '1.234,56' });
    expect(document.documentElement.lang).toBe('nl');
    expect(JSON.parse(localStorage.getItem('wissel.settings') ?? 'null')).toEqual({
      language: 'nl',
      theme: 'system',
      base: 'GBP',
      amount: '1.234,56',
      version: 2,
    });
    vi.restoreAllMocks();
  });

  it('migrates settings stored without a version to en, keeping the other fields', () => {
    localStorage.setItem(
      'wissel.settings',
      JSON.stringify({ language: 'nl', theme: 'dark', base: 'GBP', amount: '10' }),
    );
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    );
    expect(api).toMatchObject({ language: 'en', theme: 'dark', base: 'GBP', amount: '10' });
    expect(document.documentElement.lang).toBe('en');
    expect(JSON.parse(localStorage.getItem('wissel.settings') ?? 'null')).toEqual({
      language: 'en',
      theme: 'dark',
      base: 'GBP',
      amount: '10',
      version: 2,
    });
  });

  it('keeps the stored language from version 2 on', () => {
    localStorage.setItem('wissel.settings', JSON.stringify({ language: 'nl', version: 2 }));
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    );
    expect(api.language).toBe('nl');
    expect(document.documentElement.lang).toBe('nl');
  });

  it('loads stored settings, ignoring invalid fields', () => {
    localStorage.setItem(
      'wissel.settings',
      JSON.stringify({ language: 'en', theme: 'purple', base: 'AED', amount: 12, version: 2 }),
    );
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    );
    expect(api).toMatchObject({ language: 'en', theme: 'system', base: 'AED', amount: '' });
  });

  it('initialSettings overrides defaults and ignores storage', () => {
    localStorage.setItem('wissel.settings', JSON.stringify({ base: 'AED' }));
    render(
      <SettingsProvider initialSettings={{ language: 'nl', theme: 'dark', amount: '1250' }}>
        <Probe />
      </SettingsProvider>,
    );
    expect(api).toMatchObject({ language: 'nl', theme: 'dark', base: 'EUR', amount: '1250' });
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(screen.getByTestId('settings')).toHaveTextContent('"amount":"1250"');
  });

  it('throws outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow(/SettingsProvider/);
    vi.restoreAllMocks();
  });
});
