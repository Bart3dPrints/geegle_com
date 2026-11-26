// Fuzzy catalog search. Self-contained bounded-Levenshtein implementation —
// zero new dependencies, fast enough for 700+ entries on every keystroke.
// Exact matches rank first, then prefix, then word, then fuzzy (misspellings).

import type { GameEntry } from '../types';

const MAX_RESULTS = 12;
const FUZZY_THRESHOLD = 3;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function editDistance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const d = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      cur.push(d);
      rowMin = Math.min(rowMin, d);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

interface IndexedEntry {
  entry: GameEntry;
  title: string;
  aliasTokens: string[];
  categoryLabels: string[];
}

/** Build the search index once per session, not per keystroke. */
export function buildSearchIndex(entries: GameEntry[]): IndexedEntry[] {
  return entries.map((entry) => ({
    entry,
    title: normalize(entry.title),
    aliasTokens: (entry.aliases ?? []).flatMap((a) => normalize(a).split(' ')),
    categoryLabels: entry.categories.map((c) => c.toLowerCase()),
  }));
}

export interface SearchResult {
  entry: GameEntry;
  matchType: 'exact' | 'prefix' | 'word' | 'fuzzy' | 'category';
}

interface Scored {
  idx: IndexedEntry;
  score: number;
  matchType: SearchResult['matchType'];
}

function tokenFuzzyScore(queryTokens: string[], fields: string[]): number {
  let total = 0;
  for (const qt of queryTokens) {
    let best = FUZZY_THRESHOLD + 1;
    for (const field of fields) {
      const fieldTokens = field.split(' ');
      for (const ft of fieldTokens) {
        if (ft === qt) {
          best = Math.min(best, 0);
          continue;
        }
        if (ft.startsWith(qt)) {
          best = Math.min(best, 1);
          continue;
        }
        if (qt.length >= 3 && ft.length >= 3) {
          const d = editDistance(qt, ft, FUZZY_THRESHOLD);
          if (d < best) best = d;
        }
      }
    }
    if (best > FUZZY_THRESHOLD) return Infinity;
    total += best;
  }
  return total;
}

export function searchIndex(
  index: IndexedEntry[],
  rawQuery: string,
  maxResults = MAX_RESULTS
): SearchResult[] {
  const query = normalize(rawQuery);
  if (!query) return [];
  const queryTokens = query.split(' ');
  const scored: Scored[] = [];

  for (const idx of index) {
    let score = Infinity;
    let matchType: SearchResult['matchType'] = 'fuzzy';

    if (idx.title === query) {
      score = 0;
      matchType = 'exact';
    } else if (idx.aliasTokens.some((a) => a === query)) {
      score = 1;
      matchType = 'exact';
    } else if (idx.title.startsWith(query)) {
      score = 2;
      matchType = 'prefix';
    } else if (idx.categoryLabels.includes(query)) {
      score = 3;
      matchType = 'category';
    } else {
      const aliasText = idx.aliasTokens.join(' ');
      const tokenScore = tokenFuzzyScore(queryTokens, [idx.title, aliasText]);
      if (tokenScore !== Infinity && tokenScore <= FUZZY_THRESHOLD) {
        score = 4 + tokenScore;
        matchType = 'fuzzy';
      }
    }

    if (score < Infinity) scored.push({ idx, score, matchType });
  }

  scored.sort(
    (a, b) => a.score - b.score || a.idx.title.localeCompare(b.idx.title)
  );
  return scored
    .slice(0, maxResults)
    .map((s) => ({ entry: s.idx.entry, matchType: s.matchType }));
}
