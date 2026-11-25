// Single source of truth for shared platform types.
// The catalog types are defined in src/data/types.ts and re-exported here so
// every consumer imports from one canonical module. There is exactly one
// GameEntry definition in the codebase.

export type {
  Category,
  CategoryDef,
  EntryKind,
  GameEntry,
} from './data/types';

export { CATEGORIES } from './data/types';

export type ThemePreference = 'light' | 'dark' | 'system';

/** Result shape for user-facing data operations: errors are never swallowed. */
export interface OpResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface SessionUser {
  id: string;
  username: string;
}
