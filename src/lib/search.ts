// Fuzzy search over the game catalog. Self-contained implementation (no new
// dependency) based on a bounded Levenshtein distance with exact/prefix
// matches ranked first. Case-insensitive; matches titles, aliases, and
// categories.

import { games, apps, catalog } from '../data/catalog';
import type { GameEntry } from '../types';

const MAX_RESULTS = 8;
const FUZZY_THRESHOLD = 3; // max edit distance for a near match

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents: é → e ("pokmon" → "pokemon")
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Bounded Levenshtein distance; returns > threshold quickly when far apart. */
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

interface Scored {
  entry: GameEntry;
  score: number;
}

export interface SearchResult {
  entry: GameEntry;
  matchType: 'exact' | 'prefix' | 'word' | 'fuzzy' | 'category';
}

/** Token-wise fuzzy comparison: every query token must match some field token. */
function tokenFuzzyScore(query: string, fields: string[]): number {
  const queryTokens = query.split(' ');
  let total = 0;
  for (const qt of queryTokens) {
    let best = FUZZY_THRESHOLD + 1;
    for (const field of fields) {
      const fieldTokens = field.split(' ');
      for (const ft of fieldTokens) {
        if (ft === qt) { best = Math.min(best, 0); continue; }
        if (ft.startsWith(qt)) { best = Math.min(best, 1); continue; }
        if (qt.length >= 3) {
          const d = editDistance(qt, ft, FUZZY_THRESHOLD);
          if (d < best) best = d;
        }
      }
    }
    if (best > FUZZY_THRESHOLD) return Infinity; // a token matched nothing
    total += best;
  }
  return total;
}

export function searchCatalog(rawQuery: string): SearchResult[] {
  const query = normalize(rawQuery);
  if (!query) return [];

  const results: Scored[] = [];
  for (const entry of catalog) {
    if (entry.hidden) continue;
    const title = normalize(entry.title);
    const aliases = (entry.aliases ?? []).map(normalize);
    const categories = entry.categories.filter((c) => c !== 'all').map(normalize);

    let score = Infinity;
    let matchType: SearchResult['matchType'] = 'fuzzy';

    if (title === query) {
      score = 0; matchType = 'exact';
    } else if (aliases.includes(query)) {
      score = 1; matchType = 'exact';
    } else if (title.startsWith(query)) {
      score = 2; matchType = 'prefix';
    } else if (categories.includes(query)) {
      score = 3; matchType = 'category';
    } else {
      const tokenScore = tokenFuzzyScore(query, [title, ...aliases, ...categories]);
      if (tokenScore !== Infinity && tokenScore <= FUZZY_THRESHOLD) {
        score = 4 + tokenScore; matchType = 'fuzzy';
      }
    }

    if (score < Infinity) {
      results.push({ entry, score, matchType });
    }
  }

  results.sort((a, b) => a.score - b.score || a.entry.title.localeCompare(b.entry.title));
  return results.slice(0, MAX_RESULTS).map((r) => ({ entry: r.entry, matchType: r.matchType }));
}

/** Suggestions shown when nothing was found: popular categories. */
export function noResultsSuggestions(): GameEntry[] {
  const preferred = ['action', 'multiplayer', 'puzzle', 'racing', 'retro'];
  const byCategory = new Map<string, GameEntry>();
  for (const g of games) {
    for (const cat of g.categories) {
      if (preferred.includes(cat) && !byCategory.has(cat)) byCategory.set(cat, g);
    }
  }
  return [...byCategory.values()].slice(0, 5);
}

export { games, apps };
