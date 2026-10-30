import { render, screen } from '@testing-library/react';
import { SettingsProvider } from '@/state/SettingsContext';
import { en } from './en';
import { detectLanguage, localeFor, t, useT, type MessageKey } from './index';
import { nl } from './nl';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('t()', () => {
  it('returns the copy for each language', () => {
    expect(t('nl', 'convert')).toBe('Omrekenen');
    expect(t('en', 'convert')).toBe('Convert');
    expect(t('nl', 'asset.XAU')).toBe('Goud');
    expect(t('en', 'theme.system')).toBe('System');
  });

  it('replaces placeholders', () => {
    expect(t('nl', 'updated', { time: '29 okt, 02:02' })).toBe('Koersen bijgewerkt 29 okt, 02:02');
    expect(t('en', 'ago.s', { n: 12 })).toBe('12s ago');
    expect(t('nl', 'ago.s', { n: 12 })).toBe('12 s geleden');
    expect(t('nl', 'ago.m', { n: 3 })).toBe('3 min geleden');
    expect(t('en', 'live', { ago: t('en', 'ago.m', { n: 2 }) })).toBe('live · 2 min ago');
    expect(t('nl', 'approxOz', { n: '0,346' })).toBe('≈ 0,346 oz');
  });

  it('leaves unknown placeholders and falls back to the key for unknown keys', () => {
    expect(t('en', 'updated')).toBe('Rates updated {time}');
    expect(t('en', 'updated', { other: 1 })).toBe('Rates updated {time}');
    expect(t('en', 'no.such.key' as MessageKey)).toBe('no.such.key');
  });

  it('has the same keys in nl and en', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(nl).sort());
    expect(Object.keys(nl)).toHaveLength(30);
  });
});

describe('localeFor / detectLanguage', () => {
  it('maps languages to locales', () => {
    expect(localeFor('nl')).toBe('nl-NL');
    expect(localeFor('en')).toBe('en-GB');
  });

  it('detects nl from navigator.language, else en', () => {
    const spy = vi.spyOn(navigator, 'language', 'get');
    spy.mockReturnValue('nl-BE');
    expect(detectLanguage()).toBe('nl');
    spy.mockReturnValue('NL');
    expect(detectLanguage()).toBe('nl');
    spy.mockReturnValue('en-US');
    expect(detectLanguage()).toBe('en');
    spy.mockReturnValue('de-DE');
    expect(detectLanguage()).toBe('en');
  });

  it('is safe without navigator', () => {
    vi.stubGlobal('navigator', undefined);
    try {
      expect(detectLanguage()).toBe('en');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('useT()', () => {
  function Probe() {
    const tr = useT();
    return <p>{tr('updated', { time: '10:00' })}</p>;
  }

  it('uses the settings language', () => {
    render(
      <SettingsProvider initialSettings={{ language: 'en' }}>
        <Probe />
      </SettingsProvider>,
    );
    expect(screen.getByText('Rates updated 10:00')).toBeInTheDocument();
  });
});
