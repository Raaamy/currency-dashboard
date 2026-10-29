import {
  convert,
  formatMoney,
  formatNumber,
  formatPercent,
  formatQuantity,
  formatTimestamp,
  gramToOz,
  OZ_IN_GRAMS,
  ozToGram,
  parseAmount,
  quantityFor,
  roundTo,
  type RateTable,
} from './money';

/** Intl inserts NBSP / narrow NBSP; compare with plain spaces. */
const plain = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ');

const RATES: RateTable = { EUR: 1, USD: 1.08, GBP: 0.85, AED: 3.9666 };

describe('convert', () => {
  it('uses amount / rates[from] * rates[to]', () => {
    expect(convert(100, 'EUR', 'USD', RATES)).toBeCloseTo(108, 10);
    expect(convert(108, 'USD', 'EUR', RATES)).toBeCloseTo(100, 10);
    expect(convert(85, 'GBP', 'USD', RATES)).toBeCloseTo(108, 10);
    expect(convert(42, 'AED', 'AED', RATES)).toBeCloseTo(42, 10);
  });
});

describe('parseAmount', () => {
  it.each([
    ['1234.56', 1234.56],
    ['1234,56', 1234.56],
    ['1.234,56', 1234.56],
    ['1,234.56', 1234.56],
    ['1,5', 1.5],
    ['1.5', 1.5],
    ['1.234', 1.234], // ambiguous single separator: decimal by design
    ['1.234.567', 1234567],
    ['1,234,567', 1234567],
    ['1.234.567,89', 1234567.89],
    ['12,', 12],
    [',5', 0.5],
    ['.5', 0.5],
    ['  42  ', 42],
    ['1 234,56', 1234.56],
    ['€ 12,50', 12.5],
    ['$1,000.25', 1000.25],
    ['12 EUR', 12],
    ['0', 0],
  ])('parses %j as %d', (input, expected) => {
    expect(parseAmount(input)).toBeCloseTo(expected, 10);
  });

  it.each(['', '   ', 'abc', '€', ',', '.', '-5', '\u22125', '-1,5', '1,2,3.4.5,6'])(
    'rejects %j',
    (input) => {
      expect(parseAmount(input)).toBeNull();
    },
  );

  it('rejects a repeated decimal separator when both kinds appear', () => {
    expect(parseAmount('1.234,56,7')).toBeNull();
  });
});

describe('roundTo', () => {
  it('rounds to cents, half away from zero, without binary artefacts', () => {
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(2.675, 2)).toBe(2.68);
    expect(roundTo(1.234, 2)).toBe(1.23);
    expect(roundTo(-1.005, 2)).toBe(-1.01);
    expect(roundTo(12.5, 0)).toBe(13);
    expect(roundTo(-0.001, 2)).toBe(0);
    expect(Object.is(roundTo(-0.001, 2), -0)).toBe(false);
  });
});

describe('formatMoney', () => {
  it('formats currency per locale with 2 decimals by default', () => {
    expect(plain(formatMoney(1234.5, 'EUR', 'nl'))).toBe('€ 1.234,50');
    expect(plain(formatMoney(1234.5, 'EUR', 'en'))).toBe('€1,234.50');
    expect(plain(formatMoney(1234.5, 'USD', 'en'))).toMatch(/1,234\.50/);
    expect(plain(formatMoney(10, 'AED', 'nl'))).toMatch(/10,00/);
  });

  it('honours decimals and symbol: false', () => {
    expect(plain(formatMoney(63209.4, 'EUR', 'nl', { decimals: 0 }))).toBe('€ 63.209');
    expect(formatMoney(1234.5, 'GBP', 'nl', { symbol: false })).toBe('1.234,50');
    expect(formatMoney(1234.5, 'GBP', 'en', { symbol: false })).toBe('1,234.50');
  });

  it('never prints negative zero', () => {
    expect(plain(formatMoney(-0, 'EUR', 'nl'))).toBe('€ 0,00');
  });
});

describe('formatNumber', () => {
  it('uses locale separators with 0..2 decimals by default', () => {
    expect(formatNumber(1234.567, 'nl')).toBe('1.234,57');
    expect(formatNumber(1234.567, 'en')).toBe('1,234.57');
    expect(formatNumber(5, 'nl')).toBe('5');
  });

  it('honours min/max decimals', () => {
    expect(formatNumber(5, 'nl', { minDecimals: 2 })).toBe('5,00');
    expect(formatNumber(1.23456, 'en', { maxDecimals: 4 })).toBe('1.2346');
    expect(formatNumber(1.2, 'en', { minDecimals: 3, maxDecimals: 1 })).toBe('1.200');
  });
});

describe('ozToGram / gramToOz', () => {
  it('uses 31.1034768 g per troy ounce', () => {
    expect(OZ_IN_GRAMS).toBe(31.1034768);
    expect(ozToGram(1)).toBe(31.1034768);
    expect(ozToGram(2)).toBeCloseTo(62.2069536, 10);
    expect(gramToOz(31.1034768)).toBe(1);
    expect(gramToOz(ozToGram(0.346))).toBeCloseTo(0.346, 12);
  });
});

describe('quantityFor', () => {
  it('is the USD value of the amount divided by the USD price', () => {
    // 1250 EUR = 1350 USD; BTC at 67500 USD -> 0.02 BTC
    expect(quantityFor(1250, 'EUR', 67500, RATES)).toBeCloseTo(0.02, 12);
    // base USD needs no conversion
    expect(quantityFor(3600, 'USD', 3600, RATES)).toBeCloseTo(1, 12);
    // ratio: twice the amount buys twice the quantity
    expect(quantityFor(2500, 'GBP', 40, RATES)).toBeCloseTo(
      2 * quantityFor(1250, 'GBP', 40, RATES),
      12,
    );
  });

  it('returns 0 for a non-positive price and for a zero amount', () => {
    expect(quantityFor(100, 'EUR', 0, RATES)).toBe(0);
    expect(quantityFor(100, 'EUR', -5, RATES)).toBe(0);
    expect(quantityFor(0, 'EUR', 3600, RATES)).toBe(0);
  });
});

describe('formatQuantity', () => {
  it('btc: up to 5 significant digits, max 8 decimals, trailing zeros stripped', () => {
    expect(formatQuantity(0.01978, 'btc', 'nl')).toBe('0,01978');
    expect(formatQuantity(0.0197764, 'btc', 'nl')).toBe('0,019776');
    expect(formatQuantity(1.2345, 'btc', 'nl')).toBe('1,2345');
    expect(formatQuantity(1.23456, 'btc', 'nl')).toBe('1,2346');
    expect(formatQuantity(12.5, 'btc', 'nl')).toBe('12,5');
    expect(formatQuantity(12.5, 'btc', 'en')).toBe('12.5');
    expect(formatQuantity(2, 'btc', 'nl')).toBe('2');
    expect(formatQuantity(0.000000123456, 'btc', 'nl')).toBe('0,00000012');
    expect(formatQuantity(0, 'btc', 'nl')).toBe('0');
  });

  it('gram: 2 decimals under 100, else 0', () => {
    expect(formatQuantity(10.7712, 'gram', 'nl')).toBe('10,77');
    expect(formatQuantity(99.994, 'gram', 'en')).toBe('99.99');
    expect(formatQuantity(100, 'gram', 'nl')).toBe('100');
    expect(formatQuantity(1234.6, 'gram', 'nl')).toBe('1.235');
    expect(formatQuantity(0, 'gram', 'nl')).toBe('0');
  });

  it('oz: 3 decimals under 10, else 2', () => {
    expect(formatQuantity(0.34628, 'oz', 'nl')).toBe('0,346');
    expect(formatQuantity(12.3456, 'oz', 'en')).toBe('12.35');
    expect(formatQuantity(0, 'oz', 'en')).toBe('0');
  });
});

describe('formatTimestamp', () => {
  it('shows day, short month and 24 h time', () => {
    const ms = new Date(2026, 9, 29, 2, 2).getTime();
    const nl = formatTimestamp(ms, 'nl');
    const en = formatTimestamp(ms, 'en');
    for (const s of [nl, en]) {
      expect(s).toContain('29');
      expect(s).toContain(':');
      expect(s).toContain('02:02');
    }
    expect(nl.toLowerCase()).toContain('okt');
    expect(en).toContain('Oct');
  });

  it('uses 00 for midnight, not 24', () => {
    expect(formatTimestamp(new Date(2026, 0, 5, 0, 7).getTime(), 'en')).toContain('00:07');
  });
});

describe('formatPercent', () => {
  it('is signed with one decimal and a real minus sign', () => {
    const nlNeg = plain(formatPercent(-3.14, 'nl'));
    expect(nlNeg).toContain('\u22123,1');
    expect(nlNeg).toContain('%');
    expect(nlNeg).not.toContain('-');
    expect(plain(formatPercent(3.14, 'en'))).toBe('+3.1%');
    expect(plain(formatPercent(0, 'en'))).toBe('0.0%');
  });
});
