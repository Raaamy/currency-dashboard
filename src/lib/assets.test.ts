import {
  ASSET_IDS,
  convertItem,
  DEFAULT_ITEMS,
  displayDecimals,
  eurPer,
  formatItemAmount,
  getItem,
  GRAMS_PER_UNIT,
  inputDecimals,
  isAsset,
  itemChangePct,
  METAL_UNITS,
  rateDecimals,
  rateLabel,
  rateLine,
  unitLabel,
  type PriceInputs,
} from './assets';
import { OZ_IN_GRAMS } from './money';

const P: PriceInputs = {
  rates: { EUR: 1, USD: 1.1162, GBP: 0.85, JPY: 170, KWD: 0.34 },
  quotes: { BTC: { priceUsd: 77260 }, XAU: { priceUsd: 4020 }, XAG: { priceUsd: 50.3 } },
};

const BTC_EUR = 77260 / 1.1162;
const XAU_EUR_G = 4020 / 1.1162 / OZ_IN_GRAMS;
const XAG_EUR_G = 50.3 / 1.1162 / OZ_IN_GRAMS;

describe('constants', () => {
  it('lists the units, grams per unit, assets and the default items', () => {
    expect(METAL_UNITS).toEqual(['g', 'oz', 'kg']);
    expect(GRAMS_PER_UNIT).toEqual({ g: 1, oz: 31.1034768, kg: 1000 });
    expect(ASSET_IDS).toEqual(['XAU', 'XAG', 'BTC']);
    expect(DEFAULT_ITEMS).toEqual(['EUR', 'USD', 'XAU', 'XAG', 'BTC']);
  });
});

describe('isAsset / getItem', () => {
  it('recognises the three assets case-insensitively', () => {
    expect(isAsset('XAU')).toBe(true);
    expect(isAsset('xag')).toBe(true);
    expect(isAsset(' btc ')).toBe(true);
    expect(isAsset('EUR')).toBe(false);
    expect(isAsset('XAUX')).toBe(false);
  });

  it('describes the assets', () => {
    expect(getItem('XAU')).toEqual({
      code: 'XAU',
      kind: 'metal',
      name: 'Gold',
      symbol: '',
      tint: 'gold',
    });
    expect(getItem('xag')).toEqual({
      code: 'XAG',
      kind: 'metal',
      name: 'Silver',
      symbol: '',
      tint: 'silver',
    });
    expect(getItem('BTC')).toEqual({
      code: 'BTC',
      kind: 'crypto',
      name: 'Bitcoin',
      symbol: '₿',
      tint: 'btc',
    });
  });

  it('delegates fiat codes to the currency registry', () => {
    expect(getItem('eur')).toEqual({
      code: 'EUR',
      kind: 'fiat',
      name: 'Euro',
      symbol: '€',
      tint: 'eur',
    });
    expect(getItem('CHF')).toMatchObject({ code: 'CHF', kind: 'fiat', name: 'Swiss Franc' });
  });
});

describe('eurPer', () => {
  it('fiat: 1 / rate', () => {
    expect(eurPer('EUR', 'g', P)).toBe(1);
    expect(eurPer('USD', 'g', P)).toBeCloseTo(1 / 1.1162, 12);
    expect(eurPer('jpy', 'kg', P)).toBeCloseTo(1 / 170, 12);
  });

  it('BTC: the USD price in EUR, whatever the metal unit', () => {
    for (const unit of METAL_UNITS) expect(eurPer('BTC', unit, P)).toBeCloseTo(BTC_EUR, 6);
  });

  it('metals: EUR per gram times the grams per unit', () => {
    expect(eurPer('XAU', 'g', P)).toBeCloseTo(XAU_EUR_G, 9);
    expect(eurPer('XAU', 'oz', P)).toBeCloseTo(4020 / 1.1162, 9);
    expect(eurPer('XAU', 'kg', P)).toBeCloseTo(XAU_EUR_G * 1000, 6);
    expect(eurPer('XAG', 'g', P)).toBeCloseTo(XAG_EUR_G, 9);
    expect(eurPer('XAG', 'oz', P)).toBeCloseTo(50.3 / 1.1162, 9);
    expect(eurPer('XAG', 'kg', P)).toBeCloseTo(XAG_EUR_G * 1000, 6);
  });

  it('is NaN when rates, a rate or a quote are missing or not positive', () => {
    expect(eurPer('EUR', 'g', { ...P, rates: null })).toBeNaN();
    expect(eurPer('XAU', 'g', { ...P, rates: null })).toBeNaN();
    expect(eurPer('CHF', 'g', P)).toBeNaN();
    expect(eurPer('BTC', 'g', { ...P, quotes: {} })).toBeNaN();
    expect(eurPer('XAG', 'oz', { ...P, quotes: { XAG: { priceUsd: 0 } } })).toBeNaN();
    expect(eurPer('XAU', 'g', { ...P, rates: { EUR: 1 } })).toBeNaN();
    expect(eurPer('USD', 'g', { ...P, rates: { EUR: 1, USD: 0 } })).toBeNaN();
  });
});

describe('convertItem', () => {
  it('EUR -> XAU in g equals amount / eurPer(XAU, g)', () => {
    expect(convertItem(1000, 'EUR', 'XAU', 'g', P)).toBeCloseTo(1000 / eurPer('XAU', 'g', P), 9);
  });

  it('converts between any two items', () => {
    expect(convertItem(10, 'EUR', 'USD', 'g', P)).toBeCloseTo(11.162, 9);
    expect(convertItem(1, 'BTC', 'USD', 'g', P)).toBeCloseTo(77260, 6);
    expect(convertItem(1, 'XAU', 'USD', 'oz', P)).toBeCloseTo(4020, 6);
    expect(convertItem(1, 'XAU', 'XAG', 'kg', P)).toBeCloseTo(4020 / 50.3, 9);
    expect(convertItem(2, 'BTC', 'XAU', 'kg', P)).toBeCloseTo(
      (2 * BTC_EUR) / (XAU_EUR_G * 1000),
      9,
    );
  });

  it('is NaN without data', () => {
    expect(convertItem(1, 'EUR', 'XAU', 'g', { ...P, quotes: {} })).toBeNaN();
    expect(convertItem(1, 'EUR', 'USD', 'g', { ...P, rates: null })).toBeNaN();
  });
});

describe('displayDecimals / inputDecimals', () => {
  it('display decimals per SPEC §13', () => {
    const table: [string, 'g' | 'oz' | 'kg', number, number][] = [
      ['EUR', 'g', 12.5, 2],
      ['JPY', 'oz', 1234, 0],
      ['KWD', 'kg', 1, 3],
      ['BTC', 'g', 0.5, 6],
      ['BTC', 'g', 1, 4],
      ['BTC', 'kg', 25, 4],
      ['XAU', 'g', 99.99, 2],
      ['XAU', 'g', 100, 0],
      ['XAG', 'g', 1500, 0],
      ['XAU', 'oz', 0.25, 2],
      ['XAG', 'oz', 500, 2],
      ['XAU', 'kg', 0.01, 3],
      ['XAG', 'kg', 200, 3],
    ];
    for (const [code, unit, value, decimals] of table) {
      expect([code, unit, value, displayDecimals(code, unit, value)]).toEqual([
        code,
        unit,
        value,
        decimals,
      ]);
    }
  });

  it('input decimals per SPEC §13', () => {
    expect(inputDecimals('EUR', 'g')).toBe(2);
    expect(inputDecimals('JPY', 'g')).toBe(0);
    expect(inputDecimals('KWD', 'oz')).toBe(3);
    expect(inputDecimals('BTC', 'g')).toBe(8);
    expect(inputDecimals('BTC', 'kg')).toBe(8);
    expect(inputDecimals('XAU', 'g')).toBe(2);
    expect(inputDecimals('XAU', 'oz')).toBe(3);
    expect(inputDecimals('XAG', 'kg')).toBe(3);
  });
});

describe('labels', () => {
  it('unitLabel: fiat code, metal unit, BTC', () => {
    expect(unitLabel('usd', 'g')).toBe('USD');
    expect(unitLabel('XAU', 'g')).toBe('g');
    expect(unitLabel('XAG', 'oz')).toBe('oz');
    expect(unitLabel('XAU', 'kg')).toBe('kg');
    expect(unitLabel('BTC', 'oz')).toBe('BTC');
  });

  it('rateLabel: fiat code, `{unit} {name}` for metals, BTC', () => {
    expect(rateLabel('EUR', 'oz')).toBe('EUR');
    expect(rateLabel('XAU', 'g')).toBe('g gold');
    expect(rateLabel('XAG', 'oz')).toBe('oz silver');
    expect(rateLabel('XAU', 'kg')).toBe('kg gold');
    expect(rateLabel('BTC', 'g')).toBe('BTC');
  });
});

describe('rateDecimals', () => {
  it('0 from 10.000, 2 from 10, 4 from 0,01, else 6', () => {
    expect(rateDecimals(69217)).toBe(0);
    expect(rateDecimals(10_000)).toBe(0);
    expect(rateDecimals(9999.99)).toBe(2);
    expect(rateDecimals(10)).toBe(2);
    expect(rateDecimals(9.99)).toBe(4);
    expect(rateDecimals(0.01)).toBe(4);
    expect(rateDecimals(0.0099)).toBe(6);
  });
});

describe('rateLine', () => {
  it('fiat target: 1 base = r target', () => {
    expect(rateLine('EUR', 'USD', 'g', P)).toMatchObject({
      from: 'EUR',
      to: 'USD',
      text: '1 EUR = 1,1162 USD',
    });
    expect(rateLine('EUR', 'USD', 'g', P).rate).toBeCloseTo(1.1162, 12);
    expect(rateLine('JPY', 'KWD', 'g', P).text).toBe('1 JPY = 0,002000 KWD');
    expect(rateLine('USD', 'JPY', 'g', P).text).toBe('1 USD = 152,30 JPY');
  });

  it('asset target: 1 target = r base', () => {
    const line = rateLine('EUR', 'XAU', 'g', P);
    expect(line).toMatchObject({ from: 'XAU', to: 'EUR', text: '1 g gold = 115,79 EUR' });
    expect(line.rate).toBeCloseTo(XAU_EUR_G, 9);
    expect(rateLine('EUR', 'XAG', 'g', P).text).toBe('1 g silver = 1,4488 EUR');
    expect(rateLine('EUR', 'XAU', 'oz', P).text).toBe('1 oz gold = 3.601,51 EUR');
    expect(rateLine('EUR', 'XAU', 'kg', P).text).toBe('1 kg gold = 115.791 EUR');
    expect(rateLine('eur', 'btc', 'g', P)).toMatchObject({
      from: 'BTC',
      to: 'EUR',
      text: '1 BTC = 69.217 EUR',
    });
  });

  it('asset base with a fiat target: 1 base = r target', () => {
    expect(rateLine('XAU', 'USD', 'g', P)).toMatchObject({
      from: 'XAU',
      to: 'USD',
      text: '1 g gold = 129,25 USD',
    });
    expect(rateLine('BTC', 'EUR', 'g', P)).toMatchObject({
      from: 'BTC',
      to: 'EUR',
      text: '1 BTC = 69.217 EUR',
    });
  });

  it('asset base and asset target: 1 target = r base', () => {
    expect(rateLine('XAU', 'BTC', 'g', P)).toMatchObject({
      from: 'BTC',
      to: 'XAU',
      text: '1 BTC = 597,77 g gold',
    });
  });

  it('shows a dash for the number without data', () => {
    const line = rateLine('EUR', 'XAU', 'g', { ...P, quotes: {} });
    expect(line.rate).toBeNaN();
    expect(line.text).toBe('1 g gold = — EUR');
  });
});

describe('itemChangePct', () => {
  const today = { usd: 1.12, xau: 1 / 3600, btc: 1 / 70000 };
  const previous = { usd: 1.1, xau: 1 / 3500, btc: 1 / 70000 };

  it('measures the change of "to per 1 from" in the rate line direction', () => {
    expect(itemChangePct('XAU', 'EUR', today, previous)).toBeCloseTo((3600 / 3500 - 1) * 100, 9);
    expect(itemChangePct('EUR', 'XAU', today, previous)).toBeCloseTo((3500 / 3600 - 1) * 100, 9);
    expect(itemChangePct('EUR', 'USD', today, previous)).toBeCloseTo((1.12 / 1.1 - 1) * 100, 9);
    expect(itemChangePct('BTC', 'EUR', today, previous)).toBeCloseTo(0, 9);
  });

  it('works with the upper-case codes of the rate line and is null without data', () => {
    const line = rateLine('USD', 'XAU', 'oz', P);
    expect(itemChangePct(line.from, line.to, today, previous)).toBeCloseTo(
      ((1.12 * 3600) / (1.1 * 3500) - 1) * 100,
      9,
    );
    expect(itemChangePct('XAG', 'EUR', today, previous)).toBeNull();
    expect(itemChangePct('XAU', 'EUR', today, {})).toBeNull();
  });
});

describe('formatItemAmount', () => {
  it('formats in nl-NL with the display decimals', () => {
    expect(formatItemAmount(1234.5, 'EUR', 'g')).toBe('1.234,50');
    expect(formatItemAmount(1234.5, 'JPY', 'g')).toBe('1.235');
    expect(formatItemAmount(0.0144473, 'BTC', 'g')).toBe('0,014447');
    expect(formatItemAmount(2.5, 'BTC', 'g')).toBe('2,5000');
    expect(formatItemAmount(8.6362, 'XAU', 'g')).toBe('8,64');
    expect(formatItemAmount(863.62, 'XAU', 'g')).toBe('864');
    expect(formatItemAmount(0.2777, 'XAU', 'oz')).toBe('0,28');
    expect(formatItemAmount(0.0086362, 'XAG', 'kg')).toBe('0,009');
  });

  it('shows a dash when not finite', () => {
    expect(formatItemAmount(NaN, 'XAU', 'g')).toBe('—');
    expect(formatItemAmount(Infinity, 'EUR', 'g')).toBe('—');
  });
});
