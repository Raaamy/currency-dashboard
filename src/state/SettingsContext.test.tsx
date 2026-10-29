import { act, render, screen } from '@testing-library/react';
import { SettingsProvider, THEME_COLOR, useSettings, type SettingsApi } from './SettingsContext';

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
  it('uses defaults, persists every change and sets <html lang>', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('nl-NL');
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    );
    expect(api).toMatchObject({ language: 'nl', theme: 'system', base: 'EUR', amount: '' });
    expect(document.documentElement.lang).toBe('nl');

    act(() => {
      api.setLanguage('en');
      api.setBase('GBP');
      api.setAmount('1.234,56');
    });
    expect(api).toMatchObject({ language: 'en', base: 'GBP', amount: '1.234,56' });
    expect(document.documentElement.lang).toBe('en');
    expect(JSON.parse(localStorage.getItem('wissel.settings') ?? 'null')).toEqual({
      language: 'en',
      theme: 'system',
      base: 'GBP',
      amount: '1.234,56',
    });
    vi.restoreAllMocks();
  });

  it('loads stored settings, ignoring invalid fields', () => {
    localStorage.setItem(
      'wissel.settings',
      JSON.stringify({ language: 'en', theme: 'purple', base: 'AED', amount: 12 }),
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
