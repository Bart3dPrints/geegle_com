/**
 * Normalizes a string for fuzzy keyword matching.
 * Lowercases and strips all non-alphanumeric characters.
 * e.g. "C.O.R.D!", "CORD", "CoRd" → "cord"
 */
export function normalizeText(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Returns true if the normalized input matches the keyword "cord"
 * in any form (e.g. "c.o.r.d", "CORD!", "CoRd").
 */
export function isCordKeyword(input: string): boolean {
  return normalizeText(input) === 'cord';
}
