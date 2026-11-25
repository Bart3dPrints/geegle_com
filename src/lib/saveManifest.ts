import type { GameEntry } from '../types';
import { adapterFor } from './saveAdapters';

export type SaveSupport = 'automatic' | 'manual' | 'unsupported' | 'external-service';

export function saveSupportFor(game: GameEntry): SaveSupport {
  if (game.kind === 'proxy' || game.kind === 'stream') return 'external-service';
  return adapterFor(game.id, game.path) ? 'automatic' : 'unsupported';
}

export function supportLabel(support: SaveSupport): string {
  switch (support) {
    case 'automatic': return 'Automatic cloud saves';
    case 'manual': return 'Manual game export and import';
    case 'unsupported': return 'Cloud saves unavailable for this game';
    case 'external-service': return 'External service';
  }
}
