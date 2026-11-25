// Cloud-save compatibility manifest.
//
// Classification rules (auditable, not blanket claims):
// - 'automatic': the game launches same-origin from /games/*.html, so its
//   localStorage/IndexedDB lives on the Geegle origin and the universal
//   adapter can capture/restore it.
// - 'unsupported': the game runs inside a cross-origin iframe (CDN-hosted
//   build). Browser same-origin policy correctly prevents this site from
//   reading that iframe's storage; no supported API exposes it. These games
//   still save locally inside their own iframe.
// - 'external-service': proxies and the YouTube app — not games, no save
//   data by design.

import type { GameEntry } from '../types';
import { adapterFor } from './saveAdapters';

export type SaveSupport = 'automatic' | 'unsupported' | 'external-service';

export function saveSupportFor(game: GameEntry): SaveSupport {
  if (game.kind === 'proxy' || game.kind === 'stream') return 'external-service';
  // Same-origin launch paths get automatic saves; absolute http(s) URLs are
  // cross-origin iframes.
  return game.path.startsWith('http') ? 'unsupported' : 'automatic';
}

export function supportLabel(support: SaveSupport): string {
  switch (support) {
    case 'automatic':
      return 'Automatic cloud saves (localStorage + IndexedDB)';
    case 'unsupported':
      return 'Local-only saves (cross-origin build)';
    case 'external-service':
      return 'Not a game — no save data';
  }
}

/** Engine detection for manifest reporting. */
export function engineFor(game: GameEntry): string {
  if (adapterFor(game.path)?.kind === 'html5') return 'HTML5/engine';
  return 'Cross-origin (engine runs in remote iframe)';
}
