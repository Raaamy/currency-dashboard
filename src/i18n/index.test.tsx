import { render, screen } from '@testing-library/react';
import { en } from './en';
import { t, useT, type MessageKey } from './index';

describe('t()', () => {
  it('returns the English copy', () => {
    expect(t('convert')).toBe('Convert');
    expect(t('nameUnit', { name: 'Gold', unit: 'g' })).toBe('Gold (g)');
    expect(t('addCurrency')).toBe('Add currency');
    expect(t('removeCurrency', { code: 'GBP' })).toBe('Remove GBP');
    expect(t('reorder', { code: 'USD' })).toBe('Reorder USD');
    expect(t('dnd.moved', { code: 'USD', pos: 2, total: 4 })).toBe('USD moved to position 2 of 4.');
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

  it('has exactly the SPEC §8, §11, §12 and §13 keys (names come from the registry)', () => {
    expect(Object.keys(en)).toHaveLength(44);
    expect(en).toMatchObject({
      convertFrom: 'Convert from',
      amountIn: 'Amount in {unit}',
      clickHint: 'Click any result to convert from that currency or metal.',
      tapHint: 'Tap a row to convert from it',
      addItem: 'Add currency or asset',
      metalsIn: 'Metals in',
      liveAgo: 'Live · {ago}',
      liveShort: 'Live',
      offlineShort: 'Offline',
      updatedShort: 'Updated {time}',
      assets: 'Assets',
      fromPill: 'From',
      'unit.g': 'g',
      'unit.oz': 'oz',
      'unit.kg': 'kg',
    });
    expect(Object.keys(en)).toEqual(
      expect.arrayContaining([
        'reorder',
        'dnd.picked',
        'dnd.moved',
        'dnd.dropped',
        'dnd.cancelled',
      ]),
    );
    for (const key of [
      'edit',
      'done',
      'addCurrency',
      'removeCurrency',
      'searchCurrency',
      'popular',
      'allCurrencies',
      'noResults',
      'close',
    ]) {
      expect(en).toHaveProperty(key);
    }
    for (const removed of [
      'settings',
      'appearance',
      'theme.dark',
      'lang.nl',
      'cur.EUR',
      'cur.USD',
      'asset.XAU',
      'asset.BTC',
    ]) {
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
