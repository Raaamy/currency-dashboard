/** Picker search (SPEC §11 "Currency picker"): case- and accent-insensitive matching. Pure. */

/** Lower-case text without diacritics: `Króna` -> `krona`. */
export function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/** True when the (trimmed, folded) query is empty or part of the code or the name. */
export function matchesQuery(code: string, name: string, query: string): boolean {
  const q = foldText(query.trim());
  if (!q) return true;
  return foldText(code).includes(q) || foldText(name).includes(q);
}
