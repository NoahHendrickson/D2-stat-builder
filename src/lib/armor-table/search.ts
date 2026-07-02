// Loose name search for the armor table, ported (functionally) from Noah's
// armorset-tracker: whitespace tokens combine with OR — "ferro smoke" surfaces
// both Ferropotent and Smokejumper pieces — and each token matches by normalized
// substring, falling back to ordered subsequence (typo-tolerant partial typing).

/** Split a search box value into lowercase tokens (whitespace-separated). */
export function tokenizeSearchQuery(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/** Strip punctuation so "smoke-jumper" and "smokejumper" align. */
export function normalizeSearchText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Loose match for armor names: normalized substring, then ordered subsequence
 * (typo-tolerant partial typing, e.g. "frpot" → "Ferropotent").
 */
export function looseNameMatch(token: string, name: string): boolean {
  const t = normalizeSearchText(token);
  const n = normalizeSearchText(name);
  if (t.length === 0) return true;
  if (n.length === 0) return false;
  if (n.includes(t)) return true;

  let ti = 0;
  for (let ni = 0; ni < n.length && ti < t.length; ni++) {
    if (n[ni] === t[ti]) ti++;
  }
  return ti === t.length;
}

/** OR across tokens: the name matches when any token loosely matches it. */
export function nameMatchesSearch(
  name: string,
  tokens: readonly string[],
): boolean {
  if (tokens.length === 0) return true;
  return tokens.some((token) => looseNameMatch(token, name));
}
