export type CurrencyCode = 'EUR' | 'USD' | 'GBP' | 'AED';

/** Suffix of the `--tint-*` token used for the currency badge background. */
export type CurrencyTint = 'eur' | 'usd' | 'gbp' | 'aed';

export interface Currency {
  code: CurrencyCode;
  symbol: string;
  name: { nl: string; en: string };
  decimals: number;
  tint: CurrencyTint;
}

export const CURRENCIES: readonly Currency[] = [
  { code: 'EUR', symbol: '€', name: { nl: 'Euro', en: 'Euro' }, decimals: 2, tint: 'eur' },
  {
    code: 'USD',
    symbol: '$',
    name: { nl: 'Amerikaanse dollar', en: 'US dollar' },
    decimals: 2,
    tint: 'usd',
  },
  {
    code: 'GBP',
    symbol: '£',
    name: { nl: 'Britse pond', en: 'British pound' },
    decimals: 2,
    tint: 'gbp',
  },
  {
    code: 'AED',
    symbol: 'د.إ',
    name: { nl: 'VAE-dirham', en: 'UAE dirham' },
    decimals: 2,
    tint: 'aed',
  },
];
