// Save adapters describe how one game's progress is captured and restored.
//
// Two families exist:
//  1. Explicit adapters for games that already write account-namespaced keys.
//  2. A generic adapter for every other local HTML5 game. game wrappers load
//     /games/geegle-storage-shim.js, which namespaces localStorage per account,
//     so a generic capture is simply every key under this game/account prefix.
// IndexedDB cannot be namespaced per account, so generic saves also carry
// full-fidelity database dumps and swap them on restore.
//
// Ownership rules for shared IndexedDB (audited hardening):
// - A database is only ever captured when it is listed in this game's own
//   claim ledger (previously observed as created/owned by this game).
// - Fresh databases observed during a session are recorded as candidates
//   ONLY after they are no longer in the adapter's baseline; a database
//   that already existed before this game launched is never claimed.
// - claimDatabases never steals a database owned by another game.
// - delete failures propagate: isolation/restore failures are reported,
//   never silently treated as success.
import {
  dumpDatabase,
  isSerializedDatabase,
  listDatabases,
  type SerializedDatabase,
} from './storageSnapshot';

export interface SaveSnapshot {
  format: 'geegle-local-v1' | 'geegle-storage-v2';
  localStorage: Record<string, string>;
  indexedDB?: SerializedDatabase[];
}

export interface SaveAdapter {
  launchPath(userId: string | null): string;
  capture(userId: string): Promise<SaveSnapshot | null>;
  validate(snapshot: unknown): SaveSnapshot;
  restore(userId: string, snapshot: SaveSnapshot): Promise<void>;
  /**
   * Called before launch when this account has no cloud save yet. Shared
   * IndexedDB data left by a different account is cleared so progress is
   * never shown to, or uploaded by, the wrong account. Throws on failure —
   * a blocked or failed deletion must not be reported as successful isolation.
   */
  isolate(userId: string): Promise<void>;
  /** IndexedDB databases this game has been observed writing. */
  databases(): string[];
}

const games = [
  { id: 'clohflip', path: '/games/clohflip.html', keys: ['ohflip.goalIdx', 'ohflip.maxHeightFt', 'ohflip.maxTotalFlips'] },
  { id: 'clspacebarclicker', path: '/games/clspacebarclicker.html', keys: ['spacebar_clicker_game'] },
  { id: 'clquantumclicker', path: '/games/clQuantumClicker.html', keys: ['qcSave'] },
] as const;

const MAX_KEY_LENGTH = 400;
const DB_INDEX = (gameId: string) => `geegle-idb:${gameId}`;
const DB_OWNER = (gameId: string) => `geegle-idb-owner:${gameId}`;
const DB_OWNERS = 'geegle-idb-owners';

function readJson(raw: string | null): unknown {
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function readDbNames(gameId: string): string[] {
  const value = readJson(localStorage.getItem(DB_INDEX(gameId)));
  return Array.isArray(value) ? value.filter((name): name is string => typeof name === 'string') : [];
}

function writeDbNames(gameId: string, names: string[]): void {
  try { localStorage.setItem(DB_INDEX(gameId), JSON.stringify([...new Set(names)])); } catch { /* quota */ }
}

function readOwners(): Record<string, string> {
  const value = readJson(localStorage.getItem(DB_OWNERS));
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, string> : {};
}

function claimDatabases(gameId: string, names: string[]): string[] {
  const owners = readOwners();
  const claimed = readDbNames(gameId);
  for (const name of names) {
    const owner = owners[name];
    if (owner && owner !== gameId) continue;
    owners[name] = gameId;
    if (!claimed.includes(name)) claimed.push(name);
  }
  writeDbNames(gameId, claimed);
  try { localStorage.setItem(DB_OWNERS, JSON.stringify(owners)); } catch { /* quota */ }
  return claimed;
}

function scopedPrefix(gameId: string, userId: string): string {
  return `geegle-game:${gameId}:${userId}:`;
}

function readScoped(gameId: string, userId: string): Record<string, string> {
  const prefix = scopedPrefix(gameId, userId);
  const values: Record<string, string> = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !key.startsWith(prefix)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) values[key.slice(prefix.length)] = value;
  }
  return values;
}

function writeScoped(gameId: string, userId: string, values: Record<string, string>): void {
  const prefix = scopedPrefix(gameId, userId);
  for (const [key, value] of Object.entries(values)) localStorage.setItem(prefix + key, value);
}

function removeScopedExcept(gameId: string, userId: string, keep: Record<string, string>): void {
  const prefix = scopedPrefix(gameId, userId);
  const stale: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !key.startsWith(prefix)) continue;
    if (!Object.prototype.hasOwnProperty.call(keep, key.slice(prefix.length))) stale.push(key);
  }
  for (const key of stale) localStorage.removeItem(key);
}

export function validSavePayload(values: unknown): values is Record<string, string> {
  if (!values || typeof values !== 'object' || Array.isArray(values)) return false;
  return Object.entries(values as Record<string, unknown>).every(([key, value]) =>
    typeof value === 'string' && key.length > 0 && key.length <= MAX_KEY_LENGTH);
}

function validIndexedDB(value: unknown): SerializedDatabase[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('Invalid cloud save database list.');
  return value.map((entry) => {
    if (!isSerializedDatabase(entry)) throw new Error('Invalid cloud save database entry.');
    return entry;
  });
}

function explicitAdapter(game: typeof games[number]) {
  const { id: gameId, path, keys } = game;
  return {
    launchPath(userId: string | null) {
      return userId ? `${path}?geegle_profile=${encodeURIComponent(userId)}` : path;
    },
    async capture(userId: string) {
      const values: Record<string, string> = {};
      for (const key of keys) {
        const value = localStorage.getItem(`geegle-game:${gameId}:${userId}:${key}`);
        if (value !== null) values[key] = value;
      }
      return Object.keys(values).length ? { format: 'geegle-local-v1' as const, localStorage: values } : null;
    },
    validate(snapshot: unknown): SaveSnapshot {
      if (!snapshot || typeof snapshot !== 'object') throw new Error('Invalid cloud save.');
      const { format, localStorage: values } = snapshot as { format: unknown; localStorage: unknown };
      // Older saves may carry a pre-2026 IndexedDB list; those cannot be
      // restored safely and are rejected rather than silently dropped.
      if ('indexedDB' in snapshot && (!Array.isArray((snapshot as { indexedDB: unknown }).indexedDB)
        || ((snapshot as { indexedDB: unknown[] }).indexedDB).length)) {
        throw new Error('This older save contains IndexedDB data. It was kept in the cloud but cannot be restored safely.');
      }
      if (format !== 'geegle-local-v1' && format !== 'v3') throw new Error('Unrecognized cloud save format.');
      if (!validSavePayload(values)) throw new Error('Invalid cloud save.');
      const clean = Object.fromEntries(keys.flatMap((key) => {
        const value = (values as Record<string, unknown>)[key];
        if (value === undefined) return [];
        if (typeof value !== 'string') throw new Error('Invalid cloud save value.');
        return [[key, value]];
      }));
      if (!Object.keys(clean).length || Object.keys(values).length !== Object.keys(clean).length) {
        throw new Error('Cloud save contains unexpected game keys.');
      }
      return { format: 'geegle-local-v1', localStorage: clean };
    },
    async restore(userId: string, snapshot: SaveSnapshot) {
      const backup = await this.capture(userId);
      if (backup && JSON.stringify(backup) !== JSON.stringify(snapshot)) {
        // Keep progress when a player explicitly picks a different cloud version.
        localStorage.setItem(`geegle-game-backup:${gameId}:${userId}:${crypto.randomUUID()}`, JSON.stringify(backup));
      }
      for (const key of keys) {
        const scoped = `geegle-game:${gameId}:${userId}:${key}`;
        const value = snapshot.localStorage[key];
        if (value === undefined) localStorage.removeItem(scoped);
        else localStorage.setItem(scoped, value);
      }
    },
    async isolate() { /* Explicit adapters only touch account-scoped keys. */ },
    databases: () => [] as string[],
  };
}

function genericAdapter(gameId: string, path: string): SaveAdapter {
  // The baseline is snapshotted once per adapter instance, at launch time.
  // Any database already present when the game starts belongs to something
  // else (the platform, another game, another account's earlier session) and
  // is never claimed by this game.
  const baseline = listDatabases();

  return {
    launchPath(userId) {
      return userId ? `${path}?geegle_profile=${encodeURIComponent(userId)}` : path;
    },
    async capture(userId) {
      if (!userId) return null;
      const values = readScoped(gameId, userId);
      // Only databases this game has already claimed are captured. New
      // databases created during this session are recorded for the NEXT
      // capture (after this game has demonstrably written them), never
      // speculatively dumped on their first appearance.
      const current = await listDatabases();
      const owned = readDbNames(gameId);
      const initial = await baseline;
      const fresh = current.filter((name) => !initial.includes(name) && !owned.includes(name));
      if (fresh.length) claimDatabases(gameId, fresh);
      const claimable = readDbNames(gameId).filter((name) => current.includes(name));
      const databases: SerializedDatabase[] = [];
      for (const name of claimable) {
        const dump = await dumpDatabase(name);
        if (dump && dump.stores.length) databases.push(dump);
      }
      if (!Object.keys(values).length && !databases.length) return null;
      return { format: 'geegle-storage-v2', localStorage: values, indexedDB: databases };
    },
    validate(snapshot): SaveSnapshot {
      if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new Error('Invalid cloud save.');
      const record = snapshot as { format?: unknown; localStorage?: unknown; indexedDB?: unknown };
      if (record.format !== 'geegle-storage-v2' && record.format !== 'geegle-local-v1') {
        throw new Error('Unrecognized cloud save format.');
      }
      if (!validSavePayload(record.localStorage)) throw new Error('Invalid cloud save.');
      for (const key of Object.keys(record.localStorage)) {
        // Never let a stored save overwrite platform state.
        if (key.startsWith('geegle-') && !key.startsWith(`geegle-game:${gameId}:`)) {
          throw new Error('Cloud save contains reserved keys.');
        }
      }
      return {
        format: 'geegle-storage-v2',
        localStorage: { ...(record.localStorage as Record<string, string>) },
        indexedDB: validIndexedDB(record.indexedDB),
      };
    },
    async restore(userId, snapshot) {
      const values = snapshot.localStorage;
      const backup = readScoped(gameId, userId);
      if (Object.keys(backup).length) {
        localStorage.setItem(`geegle-game-backup:${gameId}:${userId}:${crypto.randomUUID()}`, JSON.stringify({
          format: 'geegle-storage-v2',
          localStorage: backup,
        }));
      }
      writeScoped(gameId, userId, values);
      removeScopedExcept(gameId, userId, values);
      const databases = snapshot.indexedDB ?? [];
      // A restore is authoritative for databases this game owns. Every
      // database in the snapshot must already belong to this game in the
      // ownership ledger, or be new on this origin — a save for game A can
      // never overwrite a database owned by game B.
      const owners = readOwners();
      for (const database of databases) {
        const owner = owners[database.name];
        if (owner && owner !== gameId) {
          throw new Error(`Cloud save targets a database owned by another game (${database.name}).`);
        }
      }
      const restored: string[] = [];
      for (const database of databases) {
        await restoreDatabase(database);
        restored.push(database.name);
      }
      const owned = readDbNames(gameId);
      for (const name of owned) {
        if (restored.includes(name)) continue;
        if (databases.length && name) await deleteDatabase(name);
      }
      claimDatabases(gameId, restored);
      try { localStorage.setItem(DB_OWNER(gameId), userId); } catch { /* quota */ }
    },
    async isolate(userId) {
      let previous: string | null = null;
      try { previous = localStorage.getItem(DB_OWNER(gameId)); } catch { previous = null; }
      try { localStorage.setItem(DB_OWNER(gameId), userId); } catch { /* quota */ }
      if (!previous || previous === userId) return;
      for (const name of readDbNames(gameId)) await deleteDatabase(name);
    },
    databases: () => readDbNames(gameId),
  };
}

/** Delete a database this game owns. Failures propagate — never silent. */
function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error(`Could not clear this game’s stored data (${name}).`));
    request.onblocked = () => reject(new Error(`Another tab is using this game’s data (${name}). Close it and retry.`));
  });
}

/** The adapter for a catalog entry, or null when no save support is possible. */
export function adapterFor(gameId: string, path: string): SaveAdapter | null {
  const explicit = games.find((entry) => entry.id === gameId && entry.path === path);
  if (explicit) return explicitAdapter(explicit);
  if (!path.startsWith('/games/')) return null;
  return genericAdapter(gameId, path);
}
