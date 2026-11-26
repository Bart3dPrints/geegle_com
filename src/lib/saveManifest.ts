import type { GameEntry } from '../types';
import { adapterFor } from './saveAdapters';
import { CROSS_ORIGIN_GAMES, ENGINE_BY_GAME, INJECTABLE_GAMES, OVERSIZE_GAMES } from '../data/saveCoverage';
import type { SaveEngine } from '../data/saveCoverage';

/**
 * What we actually know about a game's cloud saves.
 *
 *  verified         - a human played this game in a browser, made progress, saw
 *                     it captured, deleted browser storage and restored it.
 *  engine-compatible - the wrapper's storage mechanism (engine/localStorage/
 *                     IndexedDB) is covered by tests, but this specific game
 *                     has not been played and verified.
 *  injectable       - the shim can be injected, but no storage mechanism was
 *                     detected, so no claim is made about progress.
 *  manual           - only the user's own save file (export/import) exists.
 *  unsupported      - cannot be captured at all (oversize or no adapter).
 *  external-service - the game runs elsewhere (proxy/stream/cross-origin frame),
 *                     so its progress lives on another origin.
 *
 * The earlier model reported every injectable wrapper as "automatic", which
 * claimed individual verification the project never had.
 */
export type SaveSupport =
  | 'verified'
  | 'engine-compatible'
  | 'injectable'
  | 'manual'
  | 'unsupported'
  | 'external-service';

/**
 * Games verified end-to-end in a browser: the game itself wrote progress, it
 * was captured, the browser profile was destroyed, and the same account restored
 * it. Add an id only with recorded evidence in docs/CLOUD_SAVE_VERIFICATION.md.
 *
 * Empty on purpose: `cl2048` was listed here, but its shipped build loads every
 * script from a CDN and contains no storage manager at all, so its progress
 * never existed outside the page. The earlier evidence came from a key written
 * by the test itself, which proved the shim, not the game.
 */
export const VERIFIED_GAMES = new Set<string>([]);

/**
 * Storage mechanisms whose capture-and-restore path is exercised by the save
 * tests. A wrapper using one of these gets "engine-compatible", not "verified".
 */
const VERIFIED_MECHANISMS = new Set<SaveEngine>(['unity', 'emscripten', 'ruffle', 'indexeddb', 'localstorage']);

const MECHANISM_LABEL: Record<SaveEngine, string> = {
  unity: 'Unity IndexedDB',
  emscripten: 'Emscripten IndexedDB',
  ruffle: 'Ruffle local storage',
  indexeddb: 'IndexedDB',
  localstorage: 'local storage',
};

export function saveSupportFor(game: GameEntry): SaveSupport {
  if (game.kind === 'proxy' || game.kind === 'stream') return 'external-service';
  if (!adapterFor(game.id, game.path)) return 'unsupported';
  if (CROSS_ORIGIN_GAMES.has(game.id)) return 'external-service';
  if (OVERSIZE_GAMES.has(game.id)) return 'unsupported';
  if (!INJECTABLE_GAMES.has(game.id)) return 'unsupported';
  if (VERIFIED_GAMES.has(game.id)) return 'verified';
  const engine = ENGINE_BY_GAME[game.id];
  if (engine && VERIFIED_MECHANISMS.has(engine)) return 'engine-compatible';
  return 'injectable';
}

/**
 * Whether the platform should attempt automatic capture for this game. Unknown
 * injectable games are still captured - the shim can read them - but they are
 * never described as verified.
 */
export function attemptsAutomaticSave(support: SaveSupport): boolean {
  return support === 'verified' || support === 'engine-compatible' || support === 'injectable';
}

export function supportLabel(support: SaveSupport, game?: GameEntry): string {
  switch (support) {
    case 'verified':
      return 'Progress verified in this game';
    case 'engine-compatible': {
      const engine = game ? ENGINE_BY_GAME[game.id] : undefined;
      return engine
        ? `Cloud save via ${MECHANISM_LABEL[engine]} (game not individually played)`
        : 'Cloud save via a tested storage mechanism (game not individually played)';
    }
    case 'injectable':
      return 'Experimental cloud save: storage detected, progress not verified';
    case 'manual':
      return 'Manual save file only';
    case 'unsupported':
      return 'Cloud saves unavailable for this game';
    case 'external-service':
      return 'External service';
  }
}
