import {
  convert,
  DASH,
  DATE_LOCALE,
  formatMoney,
  formatNumber,
  formatPercent,
  formatQuantity,
  formatRate,
  formatTimestamp,
  gramToOz,
  NUMBER_LOCALE,
  OZ_IN_GRAMS,
  ozToGram,
  parseAmount,
  quantityFor,
  rateChangePct,
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

  it('returns NaN when a rate is missing or not positive', () => {
    expect(convert(100, 'EUR', 'CHF', RATES)).toBeNaN();
    expect(convert(100, 'CHF', 'EUR', RATES)).toBeNaN();
    expect(convert(100, 'EUR', 'USD', { EUR: 1, USD: 0 })).toBeNaN();
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

  it.each([
    ['1,234', 1.234],
    ['28,805', 28.805],
    ['999,000', 999],
  ])(
    'reads a single comma as the decimal separator, as the input shows it: %j -> %d',
    (input, expected) => {
      expect(parseAmount(input)).toBe(expected);
    },
  );

  it.each(['', '   ', 'abc', '€', ',', '.', '-5', '\u22125', '-1,5', '1,2,3.4.5,6'])(
    'rejects %j',
    (input) => {
      expect(parseAmount(input)).toBeNull();
    },
  );

  it.each([
    ['1.234', 1234],
    ['12.500', 12500],
    ['999.000', 999000],
    ['€ 1.234', 1234],
  ])('reads a single dot before exactly 3 digits as thousands: %j -> %d', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each([
    ['1,5', 1.5],
    ['0.500', 0.5],
    ['1234.567', 1234.567],
    ['1.23', 1.23],
    ['1,2345', 1.2345],
    [',500', 0.5],
  ])('otherwise reads a single separator as decimal: %j -> %d', (input, expected) => {
    expect(parseAmount(input)).toBeCloseTo(expected, 10);
  });

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
  it('uses Dutch notation and narrow symbols with 2 decimals by default', () => {
    expect(NUMBER_LOCALE).toBe('nl-NL');
    expect(plain(formatMoney(1250, 'EUR'))).toBe('€ 1.250,00');
    expect(plain(formatMoney(1393.2, 'USD'))).toBe('$ 1.393,20');
    expect(plain(formatMoney(1046.64, 'GBP'))).toBe('£ 1.046,64');
    expect(plain(formatMoney(1234.5, 'EUR'))).toBe('€ 1.234,50');
    // AED has no narrow symbol in every ICU build; whatever Intl gives must not be empty.
    expect(plain(formatMoney(10, 'AED'))).toMatch(/^\S+ 10,00$/);
  });

  it('honours decimals and symbol: false', () => {
    expect(plain(formatMoney(63209.4, 'EUR', { decimals: 0 }))).toBe('€ 63.209');
    expect(formatMoney(1234.5, 'GBP', { symbol: false })).toBe('1.234,50');
    expect(formatMoney(4938.24, 'AED', { symbol: false })).toBe('4.938,24');
  });

  it('never prints negative zero', () => {
    expect(plain(formatMoney(-0, 'EUR'))).toBe('€ 0,00');
  });

  it('defaults to the minor units of any ISO currency', () => {
    expect(formatMoney(1234.56, 'JPY', { symbol: false })).toBe('1.235');
    expect(formatMoney(1.2345, 'KWD', { symbol: false })).toBe('1,235');
    expect(plain(formatMoney(12.5, 'CHF'))).toBe('CHF 12,50');
    expect(formatMoney(1234.56, 'JPY', { symbol: false, decimals: 2 })).toBe('1.234,56');
  });

  it('formats non-finite values (missing rates) as a dash and never throws', () => {
    expect(DASH).toBe('—');
    expect(formatMoney(NaN, 'EUR')).toBe('—');
    expect(formatMoney(Infinity, 'USD', { symbol: false })).toBe('—');
    expect(plain(formatMoney(5, '1$'))).toBe('1$ 5,00');
  });
});

describe('formatRate', () => {
  it('uses 4 decimals below 10, 3 below 100 and 2 from 100 (SPEC §11)', () => {
    expect(formatRate(1.11619)).toBe('1,1162');
    expect(formatRate(38.2149)).toBe('38,215');
    expect(formatRate(169.421)).toBe('169,42');
    expect(formatRate(0.85)).toBe('0,8500');
    expect(formatRate(10)).toBe('10,000');
    expect(formatRate(100)).toBe('100,00');
    expect(formatRate(4123.456)).toBe('4.123,46');
  });

  it('formats non-finite values as a dash', () => {
    expect(formatRate(NaN)).toBe('—');
  });
});

describe('formatNumber', () => {
  it('uses Dutch separators with 0..2 decimals by default', () => {
    expect(formatNumber(1234.567)).toBe('1.234,57');
    expect(formatNumber(5)).toBe('5');
  });

  it('honours min/max decimals', () => {
    expect(formatNumber(5, { minDecimals: 2 })).toBe('5,00');
    expect(formatNumber(1.23456, { maxDecimals: 4 })).toBe('1,2346');
    expect(formatNumber(0.017852, { maxDecimals: 6 })).toBe('0,017852');
    expect(formatNumber(1.2, { minDecimals: 3, maxDecimals: 1 })).toBe('1,200');
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
    expect(formatQuantity(0.01978, 'btc')).toBe('0,01978');
    expect(formatQuantity(0.0197764, 'btc')).toBe('0,019776');
    expect(formatQuantity(1.2345, 'btc')).toBe('1,2345');
    expect(formatQuantity(1.23456, 'btc')).toBe('1,2346');
    expect(formatQuantity(12.5, 'btc')).toBe('12,5');
    expect(formatQuantity(2, 'btc')).toBe('2');
    expect(formatQuantity(0.000000123456, 'btc')).toBe('0,00000012');
    expect(formatQuantity(0, 'btc')).toBe('0');
  });

  it('gram: 2 decimals under 100, else 0', () => {
    expect(formatQuantity(10.7712, 'gram')).toBe('10,77');
    expect(formatQuantity(10.8, 'gram')).toBe('10,80');
    expect(formatQuantity(99.994, 'gram')).toBe('99,99');
    expect(formatQuantity(100, 'gram')).toBe('100');
    expect(formatQuantity(1234.6, 'gram')).toBe('1.235');
    expect(formatQuantity(0, 'gram')).toBe('0');
  });

  it('oz: 3 decimals under 10, else 2', () => {
    expect(formatQuantity(0.34628, 'oz')).toBe('0,346');
    expect(formatQuantity(12.3456, 'oz')).toBe('12,35');
    expect(formatQuantity(0, 'oz')).toBe('0');
  });
});

describe('formatTimestamp', () => {
  it('shows day, short English month and 24 h time', () => {
    expect(DATE_LOCALE).toBe('en-GB');
    expect(formatTimestamp(new Date(2026, 9, 29, 1, 2).getTime())).toBe('29 Oct, 01:02');
  });

  it('uses 00 for midnight, not 24', () => {
    expect(formatTimestamp(new Date(2026, 0, 5, 0, 7).getTime())).toBe('5 Jan, 00:07');
  });
});

describe('formatPercent', () => {
  it('is signed with one decimal, Dutch notation and a real minus sign', () => {
    expect(plain(formatPercent(-3.14))).toBe('−3,1%');
    expect(formatPercent(-3.14)).not.toContain('-');
    expect(plain(formatPercent(3.14))).toBe('+3,1%');
    expect(plain(formatPercent(0))).toBe('0,0%');
    expect(plain(formatPercent(-0))).toBe('0,0%');
  });
});

describe('rateChangePct', () => {
  const today = { eur: 1, usd: 1.21, xau: 0.0002 };
  const previous = { eur: 1, usd: 1.1, xau: 0.00025 };

  it('is the change of "units of to per 1 from" (EUR -> USD)', () => {
    expect(rateChangePct(today, previous, 'EUR', 'USD')).toBeCloseTo(10, 10);
  });

  it('handles the inverse direction (USD -> EUR)', () => {
    expect(rateChangePct(today, previous, 'USD', 'EUR')).toBeCloseTo(-9.090909, 5);
  });

  it('gives the change of an asset price in the base (XAU -> EUR)', () => {
    // Gold in EUR: 1 / 0.00025 = 4000 -> 1 / 0.0002 = 5000.
    expect(rateChangePct(today, previous, 'XAU', 'EUR')).toBeCloseTo(25, 10);
  });

  it('treats eur as 1 when it is missing and compares codes case-insensitively', () => {
    expect(rateChangePct({ usd: 1.21 }, { usd: 1.1 }, 'eur', 'usd')).toBeCloseTo(10, 10);
  });

  it('is 0 when unchanged and for EUR -> EUR', () => {
    expect(rateChangePct(previous, { ...previous }, 'USD', 'XAU')).toBe(0);
    expect(rateChangePct(today, previous, 'EUR', 'EUR')).toBe(0);
  });

  it('is null when a rate is missing or not positive', () => {
    expect(rateChangePct(today, previous, 'EUR', 'GBP')).toBeNull();
    expect(rateChangePct({ ...today, usd: 0 }, previous, 'EUR', 'USD')).toBeNull();
    expect(rateChangePct(today, { ...previous, usd: -1 }, 'USD', 'EUR')).toBeNull();
  });
});
