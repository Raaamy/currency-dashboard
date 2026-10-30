/** English copy, SPEC §8 "Copy". The key set of this object defines `MessageKey`. */
export const en = {
  convert: 'Convert',
  markets: 'Markets',
  updated: 'Rates updated {time}',
  live: 'live · {ago}',
  'ago.s': '{n}s ago',
  'ago.m': '{n} min ago',
  offline: 'Offline, showing last rates',
  perOunce: 'per troy oz',
  perGram: 'per gram',
  perBitcoin: 'per bitcoin',
  approxOz: '≈ {n} oz',
  exchangeRate: 'Exchange rate',
  sinceYesterday: 'vs yesterday',
  refresh: 'Refresh',
  'cur.EUR': 'Euro',
  'cur.USD': 'US dollar',
  'cur.GBP': 'British pound',
  'cur.AED': 'UAE dirham',
  'asset.BTC': 'Bitcoin',
  'asset.XAU': 'Gold',
  'asset.XAG': 'Silver',
};

export type MessageKey = keyof typeof en;
