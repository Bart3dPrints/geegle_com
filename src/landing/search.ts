export type SearchMode = 'web' | 'lucky';
export interface LandingSearch { query: string; mode: SearchMode }

export function searchAction(input: string, mode: SearchMode) {
  const query = input.trim();
  if (!query) return { kind: 'empty' } as const;
  // A legacy navigation alias, never an authentication decision.
  const alias = query.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (alias === 'pirate' || alias === 'games') return { kind: 'library' } as const;
  if (query === 'Bart is Awesome') return { kind: 'surprise' } as const;
  return { kind: 'search', request: { query, mode } } as const;
}

export function externalSearch({ query, mode }: LandingSearch) {
  const url = new URL('https://www.google.com/search');
  url.searchParams.set('q', query);
  if (mode === 'lucky') url.searchParams.set('btnI', '1');
  return url.href;
}
