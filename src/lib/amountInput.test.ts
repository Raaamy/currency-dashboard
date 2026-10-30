import { formatAmountInput } from './amountInput';
import { parseAmount } from './money';

/** Paste / programmatic input (no key): caret at the end. */
const paste = (raw: string, decimals = 2) => formatAmountInput(raw, raw.length, decimals);
const text = (raw: string, decimals = 2) => paste(raw, decimals).text;

describe('formatAmountInput', () => {
  describe('text', () => {
    it('keeps empty input empty and a lone zero', () => {
      expect(paste('')).toEqual({ text: '', caret: 0 });
      expect(text('0')).toBe('0');
    });

    it('strips leading zeros, keeping one before the separator or alone', () => {
      expect(text('007')).toBe('7');
      expect(text('00')).toBe('0');
      expect(text('0,5')).toBe('0,5');
      expect(text('00,5')).toBe('0,5');
      expect(text('0012,5')).toBe('12,5');
    });

    it('groups the integer part per three with a dot', () => {
      expect(text('123')).toBe('123');
      expect(text('1234')).toBe('1.234');
      expect(text('10000')).toBe('10.000');
      expect(text('1234567')).toBe('1.234.567');
      expect(text('1234,5')).toBe('1.234,5');
    });

    it('drops everything but digits and one decimal separator', () => {
      expect(text('€ 1 234')).toBe('1.234');
      expect(text('-5')).toBe('5');
      expect(text('abc')).toBe('');
    });

    it('with only commas, reads the comma as the decimal separator', () => {
      expect(text('1234567,891')).toBe('1.234.567,89');
      expect(text('12,5')).toBe('12,5');
    });

    it('reads a lone comma before three digits as decimal (Dutch keypad), unlike parseAmount', () => {
      expect(text('1,234')).toBe('1,23');
      expect(text('1,234', 3)).toBe('1,234');
      expect(formatAmountInput('1,234', 5, 3, '4')).toEqual({ text: '1,234', caret: 5 });
    });

    it('with both separators, reads the last one as the decimal (as parseAmount)', () => {
      expect(text('1,234.56')).toBe('1.234,56');
      expect(text('1.234,56')).toBe('1.234,56');
      expect(text('1,234,567.89')).toBe('1.234.567,89');
      expect(text('1.234.567,891')).toBe('1.234.567,89');
      expect(text('1,234.5', 0)).toBe('1.234');
    });

    it('keeps the value when typing a digit or separator into formatted text', () => {
      // '1.234,5|' + '6'
      expect(formatAmountInput('1.234,56', 8, 2, '6')).toEqual({ text: '1.234,56', caret: 8 });
      // '1.234,5|' + '.' / ',': a second separator is ignored
      expect(formatAmountInput('1.234,5.', 8, 2, '.')).toEqual({ text: '1.234,5', caret: 7 });
      expect(formatAmountInput('1.234,5,', 8, 2, ',')).toEqual({ text: '1.234,5', caret: 7 });
      // '1|.234,5' + ','
      expect(formatAmountInput('1,.234,5', 2, 2, ',')).toEqual({ text: '1.234,5', caret: 1 });
      // '1.2|34,5' + '9'
      expect(formatAmountInput('1.2934,5', 4, 2, '9')).toEqual({ text: '12.934,5', caret: 4 });
    });

    it('reads a pasted dot with 1-2 digits after it as the decimal separator', () => {
      expect(text('12.5')).toBe('12,5');
      expect(text('0.75')).toBe('0,75');
    });

    it('reads a pasted dot before three digits as grouping only after 1-3 non-zero digits', () => {
      expect(text('1.234')).toBe('1.234');
      expect(text('999.999')).toBe('999.999');
      expect(text('0.123', 3)).toBe('0,123');
      expect(text('0.123')).toBe('0,12');
      expect(text('.123', 3)).toBe('0,123');
      expect(text('1234.567', 3)).toBe('1.234,567');
      expect(text('1234567.891')).toBe('1.234.567,89');
    });

    it('reads more digits, none or several dots as grouping', () => {
      expect(text('1.2345')).toBe('12.345');
      expect(text('1.234.567')).toBe('1.234.567');
      expect(text('12.')).toBe('12');
      // A dot left in typed text (after a deletion) groups, whatever follows it.
      expect(formatAmountInput('0.123', 0, 2, 'Backspace')).toEqual({ text: '123', caret: 0 });
    });

    it('keeps a trailing separator while typing, shown as a comma', () => {
      expect(formatAmountInput('12,', 3, 2, ',')).toEqual({ text: '12,', caret: 3 });
      expect(formatAmountInput('12.', 3, 2, '.')).toEqual({ text: '12,', caret: 3 });
      expect(formatAmountInput('1.234.', 6, 2, '.')).toEqual({ text: '1.234,', caret: 6 });
    });

    it('adds a zero before a separator typed first', () => {
      expect(formatAmountInput(',', 1, 2, ',')).toEqual({ text: '0,', caret: 2 });
      expect(formatAmountInput('.', 1, 2, '.')).toEqual({ text: '0,', caret: 2 });
      expect(text(',5')).toBe('0,5');
    });

    it('ignores a second separator', () => {
      expect(formatAmountInput('12,5,', 5, 2, ',')).toEqual({ text: '12,5', caret: 4 });
      expect(formatAmountInput('12,5.', 5, 2, '.')).toEqual({ text: '12,5', caret: 4 });
      // A comma typed before an existing one: the existing one stays the decimal.
      expect(formatAmountInput(',12,5', 1, 2, ',')).toEqual({ text: '12,5', caret: 0 });
    });

    it('reads a dot typed in the middle as grouping', () => {
      expect(formatAmountInput('1.2', 2, 2, '.')).toEqual({ text: '12', caret: 1 });
    });

    it('limits the fraction to the currency decimals', () => {
      expect(text('12,345')).toBe('12,34');
      expect(formatAmountInput('12,345', 6, 2, '5')).toEqual({ text: '12,34', caret: 5 });
      // KWD: three decimals.
      expect(text('1,2345', 3)).toBe('1,234');
      expect(text('1234,567', 3)).toBe('1.234,567');
    });

    it('with 0 decimals drops the separator and everything after it', () => {
      expect(text('12,5', 0)).toBe('12');
      expect(text('1.234,56', 0)).toBe('1.234');
      expect(text('12.5', 0)).toBe('12');
      expect(text(',5', 0)).toBe('');
      expect(formatAmountInput('12,', 3, 0, ',')).toEqual({ text: '12', caret: 2 });
      // Typing on after the dropped separator just appends digits.
      expect(formatAmountInput('125', 3, 0, '5')).toEqual({ text: '125', caret: 3 });
    });

    it('re-formats a stored amount for another currency (base change)', () => {
      expect(text('12,50', 0)).toBe('12');
      expect(text('12,50', 3)).toBe('12,50');
      expect(text('1250', 2)).toBe('1.250');
    });

    /** Types `keys` one by one at the end, feeding each result back in as the input would. */
    const typed = (keys: string, decimals = 2): string =>
      [...keys].reduce((value, key) => {
        const raw = value + key;
        return formatAmountInput(raw, raw.length, decimals, key).text;
      }, '');

    it('typing produces the same text as the formatted result', () => {
      expect(typed('1234567')).toBe('1.234.567');
      expect(typed('1234,56')).toBe('1.234,56');
      expect(typed('12.5')).toBe('12,5');
      expect(typed('0,05')).toBe('0,05');
      expect(typed('12,5', 0)).toBe('125');
    });

    // The input and the conversion always agree: parseAmount of the shown text is the number
    // a Dutch user means (decimals 2, so extra decimals are dropped).
    it.each<[string, string, number | null]>([
      ['paste', '', null],
      ['paste', '10000', 10000],
      ['paste', '007', 7],
      ['paste', '1234,5', 1234.5],
      ['paste', '1.234,56', 1234.56],
      ['paste', '1,234.56', 1234.56],
      ['paste', '1,234,567.89', 1234567.89],
      ['paste', '1.234.567,89', 1234567.89],
      ['paste', '€ 1 234,50', 1234.5],
      ['paste', '12.5', 12.5],
      ['paste', '0.75', 0.75],
      ['paste', '0.123', 0.12],
      ['paste', '1.234', 1234],
      ['paste', '1.234.567', 1234567],
      ['paste', '1234.567', 1234.56],
      ['paste', '1234567.891', 1234567.89],
      ['paste', '1234567,891', 1234567.89],
      ['paste', '1,234', 1.23],
      ['paste', '12,345', 12.34],
      ['typed', '1234567', 1234567],
      ['typed', '1234,56', 1234.56],
      ['typed', '12.5', 12.5],
      ['typed', '0,05', 0.05],
      ['typed', '12,5,7', 12.57],
    ])('%s %j parses as %s', (how, raw, expected) => {
      const shown = how === 'typed' ? typed(raw) : text(raw);
      expect(parseAmount(shown)).toBe(expected);
    });
  });

  describe('caret', () => {
    it('stays at the end while typing digits that add group dots', () => {
      expect(formatAmountInput('1234', 4, 2, '4')).toEqual({ text: '1.234', caret: 5 });
      expect(formatAmountInput('1.2345', 6, 2, '5')).toEqual({ text: '12.345', caret: 6 });
      expect(formatAmountInput('123.4567', 8, 2, '7')).toEqual({ text: '1.234.567', caret: 9 });
    });

    it('stays between the same digits when typing in the middle', () => {
      // '1.2|34' + '9'
      expect(formatAmountInput('1.2934', 4, 2, '9')).toEqual({ text: '12.934', caret: 4 });
      // '12|' with the caret before the group dot in the result
      expect(formatAmountInput('1234', 1, 2)).toEqual({ text: '1.234', caret: 1 });
    });

    it('follows removed group dots when a digit is deleted', () => {
      // '1.234|' Backspace
      expect(formatAmountInput('1.23', 4, 2, 'Backspace')).toEqual({ text: '123', caret: 3 });
      // '1.234|.567' Backspace on the 4
      expect(formatAmountInput('1.23.567', 4, 2, 'Backspace')).toEqual({
        text: '123.567',
        caret: 3,
      });
      // '1.234,|5' Backspace on the comma merges the fraction
      expect(formatAmountInput('1.2345', 5, 2, 'Backspace')).toEqual({ text: '12.345', caret: 5 });
    });

    it('Backspace right after a group dot deletes the digit before it', () => {
      // '1.|234'
      expect(formatAmountInput('1234', 1, 2, 'Backspace')).toEqual({ text: '234', caret: 0 });
      // '12.|345'
      expect(formatAmountInput('12345', 2, 2, 'Backspace')).toEqual({ text: '1.345', caret: 1 });
      // '1.|234,56'
      expect(formatAmountInput('1234,56', 1, 2, 'Backspace')).toEqual({
        text: '234,56',
        caret: 0,
      });
    });

    it('Delete right before a group dot deletes the digit after it', () => {
      // '1|.234'
      expect(formatAmountInput('1234', 1, 2, 'Delete')).toEqual({ text: '134', caret: 1 });
      // '1.234|.567'
      expect(formatAmountInput('1.234567', 5, 2, 'Delete')).toEqual({
        text: '123.467',
        caret: 5,
      });
    });

    it('Delete of a leading digit before a dot', () => {
      // '|1.234'
      expect(formatAmountInput('.234', 0, 2, 'Delete')).toEqual({ text: '234', caret: 0 });
    });

    it('moves past stripped leading zeros', () => {
      expect(formatAmountInput('00', 2, 2, '0')).toEqual({ text: '0', caret: 1 });
      expect(formatAmountInput('05', 2, 2, '5')).toEqual({ text: '5', caret: 1 });
      expect(formatAmountInput('01.234', 1, 2, '0')).toEqual({ text: '1.234', caret: 0 });
    });

    it('lands at the end of a paste', () => {
      expect(paste('1234567.891')).toEqual({ text: '1.234.567,89', caret: 12 });
      expect(paste('1,234.56')).toEqual({ text: '1.234,56', caret: 8 });
      expect(paste('1234567,891')).toEqual({ text: '1.234.567,89', caret: 12 });
    });

    it('clamps an out-of-range caret', () => {
      expect(formatAmountInput('1234', 99, 2)).toEqual({ text: '1.234', caret: 5 });
      expect(formatAmountInput('1234', -3, 2)).toEqual({ text: '1.234', caret: 0 });
    });
  });
});
