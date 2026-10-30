import {
  compareByName,
  DEFAULT_CURRENCIES,
  getCurrency,
  LEGACY_CURRENCIES,
  POPULAR,
  tintFor,
} from './currencies';

describe('getCurrency', () => {
  it('keeps the hand-tuned symbols and named tints for EUR, USD, GBP and AED', () => {
    expect(getCurrency('EUR')).toMatchObject({
      code: 'EUR',
      symbol: '€',
      decimals: 2,
      tint: 'eur',
    });
    expect(getCurrency('USD')).toMatchObject({ symbol: '$', tint: 'usd' });
    expect(getCurrency('GBP')).toMatchObject({ symbol: '£', tint: 'gbp' });
    expect(getCurrency('AED')).toMatchObject({ code: 'AED', symbol: 'د.إ', tint: 'aed' });
    expect(getCurrency('EUR').name).toBe('Euro');
  });

  it('takes English names from Intl', () => {
    expect(getCurrency('CHF').name.toLowerCase()).toBe('swiss franc');
    expect(getCurrency('JPY').name.toLowerCase()).toBe('japanese yen');
    expect(getCurrency('USD').name.toLowerCase()).toBe('us dollar');
  });

  it('takes the minor units from Intl (JPY 0, EUR 2, KWD 3)', () => {
    expect(getCurrency('JPY').decimals).toBe(0);
    expect(getCurrency('EUR').decimals).toBe(2);
    expect(getCurrency('KWD').decimals).toBe(3);
  });

  it('takes the narrow symbol from Intl, else the code', () => {
    expect(getCurrency('JPY').symbol).toBe('¥');
    expect(getCurrency('CHF').symbol).toBe('CHF');
  });

  it('is case-insensitive and memoised per code', () => {
    expect(getCurrency('chf')).toBe(getCurrency('CHF'));
    expect(getCurrency(' jpy ').code).toBe('JPY');
  });

  it('falls back to the code for unknown and malformed codes without throwing', () => {
    expect(getCurrency('XYZ')).toMatchObject({ code: 'XYZ', name: 'XYZ', symbol: 'XYZ' });
    expect(getCurrency('XYZ').decimals).toBeGreaterThanOrEqual(0);
    expect(() => getCurrency('1$')).not.toThrow();
    expect(getCurrency('1$')).toMatchObject({ code: '1$', name: '1$', symbol: '1$', decimals: 2 });
  });
});

describe('tintFor', () => {
  it('returns the named tints for the four hand-tuned currencies', () => {
    expect(LEGACY_CURRENCIES.map(tintFor)).toEqual(['eur', 'usd', 'gbp', 'aed']);
  });

  it('is stable, in range and follows the char-code sum mod 6', () => {
    for (const code of ['CHF', 'JPY', 'CNY', 'TRY', 'XYZ', 'ZAR']) {
      const tint = tintFor(code);
      expect(['1', '2', '3', '4', '5', '6']).toContain(tint);
      expect(tintFor(code)).toBe(tint);
      expect(tintFor(code.toLowerCase())).toBe(tint);
      expect(getCurrency(code).tint).toBe(tint);
    }
    // C(67) + H(72) + F(70) = 209; 209 % 6 = 5 -> the sixth tint.
    expect(tintFor('CHF')).toBe('6');
  });
});

describe('lists', () => {
  it('defaults to EUR and USD and migrates to the legacy four', () => {
    expect(DEFAULT_CURRENCIES).toEqual(['EUR', 'USD']);
    expect(LEGACY_CURRENCIES).toEqual(['EUR', 'USD', 'GBP', 'AED']);
  });

  it('has the 20 popular codes of SPEC §11 without duplicates', () => {
    expect(POPULAR).toHaveLength(20);
    expect(new Set(POPULAR).size).toBe(20);
    expect(POPULAR.slice(0, 6)).toEqual(['EUR', 'USD', 'GBP', 'AED', 'CHF', 'JPY']);
  });
});

describe('compareByName', () => {
  it('sorts codes by English name', () => {
    expect(['USD', 'CHF', 'EUR', 'AED'].sort(compareByName)).toEqual(['EUR', 'CHF', 'AED', 'USD']);
    expect(compareByName('EUR', 'EUR')).toBe(0);
  });
});
