/**
 * Central catalog types. Single source of truth shared by every card grid,
 * the fuzzy-search index, and the category filter.
 */

export type Category =
  | 'action'
  | 'adventure'
  | 'arcade'
  | 'racing'
  | 'sports'
  | 'puzzle'
  | 'strategy'
  | 'simulation'
  | 'platformer'
  | 'multiplayer'
  | 'pokemon'
  | 'retro'
  | 'horror'
  | 'casual'
  | 'rhythm';

export type EntryKind = 'game' | 'app' | 'proxy' | 'stream';

export interface GameEntry {
  /** Stable slug — never changes. Used as the favorites/saves key. */
  id: string;
  /** Corrected display title. */
  title: string;
  /** Launch path (site-relative) or absolute external URL. */
  path: string;
  categories: Category[];
  kind: EntryKind;
  /** Extra search terms: misspellings, series names, keywords. */
  aliases?: string[];
  /** Artwork URL (16:9 preferred). */
  thumb?: string;
  /** Provenance note for the audit trail. */
  source?: string;
  description?: string;
}

export interface CategoryDef {
  key: Category;
  label: string;
}

/** Category buttons shown under the search bar and in the grid toolbar. */
export const CATEGORIES: CategoryDef[] = [
  { key: 'action', label: 'Action' },
  { key: 'adventure', label: 'Adventure' },
  { key: 'arcade', label: 'Arcade' },
  { key: 'racing', label: 'Racing' },
  { key: 'sports', label: 'Sports' },
  { key: 'puzzle', label: 'Puzzle' },
  { key: 'strategy', label: 'Strategy' },
  { key: 'simulation', label: 'Simulation' },
  { key: 'platformer', label: 'Platformer' },
  { key: 'multiplayer', label: 'Multiplayer' },
  { key: 'pokemon', label: 'Pokemon' },
  { key: 'retro', label: 'Retro' },
  { key: 'horror', label: 'Horror' },
  { key: 'casual', label: 'Casual' },
  { key: 'rhythm', label: 'Rhythm' },
];
