/**
 * Live formatting of the typed amount (SPEC §12 "Amount input formatting"): nl-NL notation,
 * thousands grouped with `.`, decimal separator `,`. Pure; the input calls it on every change.
 */

export interface AmountInputResult {
  text: string;
  caret: number;
}

/** One output character and the index in `raw` it came from (-1 for an inserted one). */
interface OutChar {
  ch: string;
  src: number;
}

const isDigit = (ch: string): boolean => ch >= '0' && ch <= '9';

const hasDigitAfter = (raw: string, index: number): boolean => {
  for (let i = index + 1; i < raw.length; i++) if (isDigit(raw[i])) return true;
  return false;
};

/** Index in `raw` of the character used as the decimal separator, or -1 for none. */
function decimalIndex(raw: string, caret: number, lastKey: string | undefined): number {
  // The separator the user just typed (left of the caret).
  const typed =
    (lastKey === ',' || lastKey === '.') && caret > 0 && raw[caret - 1] === lastKey
      ? caret - 1
      : -1;
  // The other separators; a newly typed one is ignored while they settle the decimal.
  const commas: number[] = [];
  const dots: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    if (i === typed) continue;
    if (raw[i] === ',') commas.push(i);
    else if (raw[i] === '.') dots.push(i);
  }
  // Both kinds: the last separator is the decimal, the others group (`parseAmount`'s rule).
  // Formatted text always ends its separators with the `,`, so typing in it keeps the value.
  if (commas.length > 0 && dots.length > 0) {
    return Math.max(commas[commas.length - 1], dots[dots.length - 1]);
  }
  // Commas only: the (first) comma is the decimal, also before three digits (`1,234` = 1,234).
  if (commas.length > 0) return commas[0];
  // A typed comma anywhere; a typed dot only at the end (no digits after it).
  if (typed >= 0 && (raw[typed] === ',' || !hasDigitAfter(raw, typed))) return typed;
  // Paste / programmatic text with a single dot: decimal before 1-2 digits (`12.5`, `0.75`);
  // before exactly 3 digits a thousands separator only after 1-3 digits with a non-zero
  // value (`1.234` = 1234, but `0.123` and `1234.567` are decimals), as in `parseAmount`.
  if (lastKey === undefined && dots.length === 1) {
    const dot = dots[0];
    let after = 0;
    for (let i = dot + 1; i < raw.length; i++) if (isDigit(raw[i])) after++;
    if (after >= 1 && after <= 2) return dot;
    if (after === 3) {
      const before = raw.slice(0, dot).replace(/\D/g, '');
      const grouped = before.length >= 1 && before.length <= 3 && Number(before) !== 0;
      return grouped ? -1 : dot;
    }
  }
  return -1;
}

function format(
  raw: string,
  caret: number,
  decimals: number,
  lastKey: string | undefined,
): AmountInputResult {
  const decimal = decimalIndex(raw, caret, lastKey);
  const intDigits: OutChar[] = [];
  const fracDigits: OutChar[] = [];
  for (let i = 0; i < raw.length; i++) {
    if (!isDigit(raw[i])) continue;
    (decimal >= 0 && i > decimal ? fracDigits : intDigits).push({ ch: raw[i], src: i });
  }

  // Leading zeros: keep at most one, and only when it is the whole integer part.
  let start = 0;
  while (start < intDigits.length - 1 && intDigits[start].ch === '0') start++;
  const int = intDigits.slice(start);
  const keepFraction = decimal >= 0 && decimals > 0;

  const out: OutChar[] = [];
  if (int.length === 0 && keepFraction) out.push({ ch: '0', src: -1 });
  int.forEach((digit, i) => {
    if (i > 0 && (int.length - i) % 3 === 0) out.push({ ch: '.', src: -1 });
    out.push(digit);
  });
  // With 0 decimals the separator and everything after it are dropped.
  if (keepFraction) {
    out.push({ ch: ',', src: decimal });
    out.push(...fracDigits.slice(0, decimals));
  }

  // Caret: right after the last kept character that was left of the caret in `raw`.
  let next = 0;
  out.forEach((c, i) => {
    if (c.src >= 0 && c.src < caret) next = i + 1;
  });
  return { text: out.map((c) => c.ch).join(''), caret: next };
}

/**
 * Formats `raw` (the input's value after an edit) and maps the caret.
 *
 * - Keeps digits and at most one decimal separator; a newly typed separator is ignored when
 *   the rest of the text already settles the decimal. Which one is the decimal:
 *   - both `,` and `.` present: the last one (`1,234.56` and `1.234,56` are 1234.56), as in
 *     `parseAmount`;
 *   - only `,`: the comma, also before exactly three digits (`1,234` = 1,234);
 *   - only `.`: one just typed at the end (`lastKey` `.`); for paste/programmatic text
 *     (`lastKey` undefined) a single `.` before 1-2 digits (`12.5`), or before exactly 3
 *     digits unless 1-3 non-zero digits precede it (`0.123` = 0,123, `1234.567` = 1234,567;
 *     `1.234` = 1234), as in `parseAmount`.
 *   Every other separator groups and is dropped (`1.2345` -> 12345, `1.234.567` -> 1234567).
 * - Integer part: leading zeros stripped (a single `0` stays alone or before the separator; a
 *   separator typed first gets a `0` in front), grouped per three with `.`.
 * - Fraction: at most `decimals` digits. With `decimals` 0 the separator and every digit after
 *   it are dropped (`12,5` -> `12`; while typing, digits typed later simply append).
 * - A trailing separator is kept (`12,`).
 * - Caret: placed after the last character that survives from left of the caret.
 * - `lastKey` `Backspace` / `Delete` that only removed a thousands dot (the text would come
 *   back unchanged) removes the digit before / after it instead.
 *
 * @param raw the input text after the edit
 * @param caret `selectionStart` after the edit
 * @param decimals fraction digits of the currency (JPY 0, EUR 2, KWD 3)
 * @param lastKey the typed character, `Backspace` or `Delete`; undefined for a paste
 */
export function formatAmountInput(
  raw: string,
  caret: number,
  decimals: number,
  lastKey?: string,
): AmountInputResult {
  const at = Math.min(Math.max(Math.trunc(caret) || 0, 0), raw.length);
  const places = Math.max(0, Math.trunc(decimals) || 0);
  const result = format(raw, at, places, lastKey);

  if (lastKey === 'Backspace' || lastKey === 'Delete') {
    // The edit removed a group dot: the result equals `raw` with that dot put back at the caret.
    const t = result.text;
    const removedDot =
      t.length === raw.length + 1 && t[at] === '.' && t.slice(0, at) + t.slice(at + 1) === raw;
    if (removedDot) {
      if (lastKey === 'Backspace' && at > 0) {
        return format(raw.slice(0, at - 1) + raw.slice(at), at - 1, places, lastKey);
      }
      if (lastKey === 'Delete' && at < raw.length) {
        return format(raw.slice(0, at) + raw.slice(at + 1), at, places, lastKey);
      }
    }
  }
  return result;
}
