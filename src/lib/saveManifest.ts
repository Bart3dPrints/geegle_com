import type { GameEntry } from '../types';
import { adapterFor } from './saveAdapters';
import { readCatalogRows } from '../../scripts/catalog-data.mjs' with { type: 'module' };

export type SaveSupport = 'automatic' | 'manual' | 'unsupported' | 'external-service';

/**
 * Evidence-based save support classification.
 *
 * automatic — the game's wrapper was verified to load the storage shim (or is
 * one of the three explicitly scoped games), so per-account localStorage
 * isolation plus generic IndexedDB capture genuinely apply.
 *
 * manual — the game is local but not verified with the shim: the player can
 * still export/import save files from the player toolbar, but automatic
 * per-account isolation is not guaranteed for it.
 *
 * unsupported — cross-origin or non-game entries where no save integration
 * is technically possible.
 */
const SCOPED_GAMES = new Set(['clohflip', 'clspacebarclicker', 'clquantumclicker']);

/** Catalog ids whose wrapper was verified to include the storage shim. */
let shimmedIds: Set<string> | null = null;
export async function computeShimmedGameIds(): Promise<Set<string>> {
  // Deterministic: derived from the injection marker in each wrapper file at
  // build/test time. Kept in a module cache so callers can await it once.
  if (shimmedIds) return shimmedIds;
  const { readFile } = await import('node:fs/promises');
  const { catalogRoot, localFilename } = await import('../../scripts/catalog-data.mjs');
  const ids = new Set<string>();
  for (const row of readCatalogRows()) {
    const file = localFilename(row.path);
    if (!file) continue;
    try {
      const html = await readFile(new URL(`../public/games/${file}`, catalogRoot), 'utf8');
      if (html.includes('data-geegle-storage') || html.includes('geegleSaveKey')) ids.add(row.id);
    } catch { /* file missing; classified manual below */ }
  }
  shimmedIds = ids;
  return ids;
}

export function saveSupportFor(game: GameEntry, shimmed?: Set<string>): SaveSupport {
  if (game.kind === 'proxy' || game.kind === 'stream') return 'external-service';
  if (!game.path.startsWith('/games/')) return 'unsupported';
  if (!adapterFor(game.id, game.path)) return 'unsupported';
  if (SCOPED_GAMES.has(game.id)) return 'automatic';
  // Local game with a generic adapter: automatic only when its wrapper is
  // verified to load the isolation shim; otherwise offer manual export/import.
  return shimmed?.has(game.id) ? 'automatic' : 'manual';
}

export function supportLabel(support: SaveSupport): string {
  switch (support) {
    case 'automatic': return 'Automatic cloud saves';
    case 'manual': return 'Manual game export and import';
    case 'unsupported': return 'Cloud saves unavailable for this game';
    case 'external-service': return 'External service';
  }
}
