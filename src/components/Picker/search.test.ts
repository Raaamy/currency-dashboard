import { foldText, matchesQuery } from './search';

describe('foldText', () => {
  it('lower-cases and strips diacritics', () => {
    expect(foldText('Icelandic Króna')).toBe('icelandic krona');
    expect(foldText('São Tomé & Príncipe Dobra')).toBe('sao tome & principe dobra');
    expect(foldText('CHF')).toBe('chf');
  });
});

describe('matchesQuery', () => {
  it('matches the code or the name, ignoring case and accents', () => {
    expect(matchesQuery('CHF', 'Swiss Franc', 'swiss')).toBe(true);
    expect(matchesQuery('CHF', 'Swiss Franc', 'chf')).toBe(true);
    expect(matchesQuery('ISK', 'Icelandic Króna', 'krona')).toBe(true);
    expect(matchesQuery('ISK', 'Icelandic Krona', 'KRÓNA')).toBe(true);
    expect(matchesQuery('CHF', 'Swiss Franc', 'zz')).toBe(false);
  });

  it('matches everything for an empty or blank query', () => {
    expect(matchesQuery('CHF', 'Swiss Franc', '')).toBe(true);
    expect(matchesQuery('CHF', 'Swiss Franc', '   ')).toBe(true);
  });

  it('trims the query', () => {
    expect(matchesQuery('CHF', 'Swiss Franc', '  franc ')).toBe(true);
  });
});
