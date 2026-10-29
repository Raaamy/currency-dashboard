import { CURRENCIES } from './currencies';

describe('CURRENCIES', () => {
  it('lists the four supported currencies with unique codes', () => {
    expect(CURRENCIES).toHaveLength(4);
    expect(new Set(CURRENCIES.map((c) => c.code)).size).toBe(4);
    expect(CURRENCIES.map((c) => c.code)).toEqual(['EUR', 'USD', 'GBP', 'AED']);
  });
});
