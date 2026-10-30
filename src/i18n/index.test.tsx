import { render, screen } from '@testing-library/react';
import { en } from './en';
import { t, useT, type MessageKey } from './index';

describe('t()', () => {
  it('returns the English copy', () => {
    expect(t('convert')).toBe('Convert');
    expect(t('asset.XAU')).toBe('Gold');
    expect(t('cur.USD')).toBe('US dollar');
  });

  it('replaces placeholders', () => {
    expect(t('updated', { time: '29 Oct, 02:02' })).toBe('Rates updated 29 Oct, 02:02');
    expect(t('ago.s', { n: 12 })).toBe('12s ago');
    expect(t('ago.m', { n: 3 })).toBe('3 min ago');
    expect(t('live', { ago: t('ago.m', { n: 2 }) })).toBe('live · 2 min ago');
    expect(t('approxOz', { n: '0,346' })).toBe('≈ 0,346 oz');
  });

  it('leaves unknown placeholders and falls back to the key for unknown keys', () => {
    expect(t('updated')).toBe('Rates updated {time}');
    expect(t('updated', { other: 1 })).toBe('Rates updated {time}');
    expect(t('no.such.key' as MessageKey)).toBe('no.such.key');
  });

  it('has exactly the SPEC §8 keys', () => {
    expect(Object.keys(en)).toHaveLength(21);
    for (const removed of ['settings', 'close', 'appearance', 'theme.dark', 'lang.nl']) {
      expect(en).not.toHaveProperty(removed);
    }
  });
});

describe('useT()', () => {
  function Probe() {
    const tr = useT();
    return <p>{tr('updated', { time: '10:00' })}</p>;
  }

  it('returns the English translator without any provider', () => {
    render(<Probe />);
    expect(screen.getByText('Rates updated 10:00')).toBeInTheDocument();
  });
});
