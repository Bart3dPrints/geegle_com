// Alphabetical grouping for the library's full-width sections and sidebar.
import type { GameEntry } from '../types';

export interface AlphabetSection {
  letter: string;
  entries: GameEntry[];
}

/** Section letter for a title: A–Z, or "#" when the title has no latin letter. */
export function letterFor(title: string): string {
  const first = title
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .charAt(0)
    .toUpperCase();
  return /^[A-Z]$/.test(first) ? first : '#';
}

/** Groups already-sorted entries into A–Z sections, then "#" last. */
export function groupByLetter(entries: GameEntry[]): AlphabetSection[] {
  const buckets = new Map<string, GameEntry[]>();
  for (const entry of entries) {
    const letter = letterFor(entry.title);
    const bucket = buckets.get(letter);
    if (bucket) bucket.push(entry);
    else buckets.set(letter, [entry]);
  }
  return [...buckets.keys()]
    .sort((a, b) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)))
    .map((letter) => ({ letter, entries: buckets.get(letter) ?? [] }));
}
