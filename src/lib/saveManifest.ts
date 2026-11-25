import type { GameEntry } from '../types';
import { adapterFor } from './saveAdapters';
import { CROSS_ORIGIN_GAMES, INJECTABLE_GAMES, OVERSIZE_GAMES } from '../data/saveCoverage';

export type SaveSupport = 'automatic' | 'unsupported' | 'external-service';

/**
 * Support is reported from evidence, not from the shape of the path:
 *  - explicit adapter (the game already namespaces every key itself), or
 *  - the service worker can inject the per-account storage shim into the
 *    wrapper, and the wrapper hosts the game rather than framing another one.
 * Everything else is reported as unavailable instead of promising an
 * automatic save that cannot be captured.
 */
export function saveSupportFor(game: GameEntry): SaveSupport {
  if (game.kind === 'proxy' || game.kind === 'stream') return 'external-service';
  if (!adapterFor(game.id, game.path)) return 'unsupported';
  if (CROSS_ORIGIN_GAMES.has(game.id)) return 'external-service';
  if (OVERSIZE_GAMES.has(game.id)) return 'unsupported';
  return INJECTABLE_GAMES.has(game.id) ? 'automatic' : 'unsupported';
}

export function supportLabel(support: SaveSupport): string {
  switch (support) {
    case 'automatic': return 'Automatic cloud saves';
    case 'unsupported': return 'Cloud saves unavailable for this game';
    case 'external-service': return 'External service';
  }
}
