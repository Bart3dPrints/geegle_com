// Save adapters describe how one game's progress is captured and restored.
//
// Two families exist:
//  1. Explicit adapters for games that already write account-namespaced keys.
//  2. A generic adapter for every shimmed local HTML5 game. The wrapper loads
//     /games/geegle-storage-shim.js, which namespaces localStorage,
//     sessionStorage and IndexedDB per (game, account). Capture therefore reads
//     exactly one account's data and nothing else.
//
// IndexedDB identity is explicit, not inferred: the shim prefixes every
// database name with `geegle-game:<gameId>:<userId>:`, so ownership is a name
// check. Nothing is guessed from "databases created while the game ran", which
// broke down with concurrent games and shared database names. Because the
// prefix contains the account, two accounts can never see each other's
// databases and isolation never depends on a delete succeeding.
import {
  deleteDatabase,
  dumpDatabase,
  isSerializedDatabase,
  listDatabases,
  restoreDatabase,
  type SerializedDatabase,
} from './storageSnapshot';

export interface SaveSnapshot {
  format: 'geegle-local-v1' | 'geegle-storage-v3';
  gameId: string;
  localStorage: Record<string, string>;
  indexedDB: SerializedDatabase[];
}

export interface SaveAdapter {
  launchPath(userId: string | null): string;
  capture(userId: string): Promise<SaveSnapshot | null>;
  /** Validate a stored save against this game and account. Throws on mismatch. */
  validate(snapshot: unknown, userId: string): SaveSnapshot;
  restore(userId: string, snapshot: SaveSnapshot): Promise<void>;
  /**
   * Called before launch. With per-account database names there is nothing to
   * delete to keep accounts apart, so isolation is structural; this hook only
   * verifies the namespace contract and reports a failure instead of swallowing
   * it.
   */
  isolate(userId: string): Promise<void>;
  /** IndexedDB databases this account has stored for this game. */
  databases(userId: string): Promise<string[]>;
}

const games = [
  { id: 'clohflip', path: '/games/clohflip.html', keys: ['ohflip.goalIdx', 'ohflip.maxHeightFt', 'ohflip.maxTotalFlips'] },
  { id: 'clspacebarclicker', path: '/games/clspacebarclicker.html', keys: ['spacebar_clicker_game'] },
  { id: 'clquantumclicker', path: '/games/clQuantumClicker.html', keys: ['qcSave'] },
] as const;

const MAX_KEY_LENGTH = 400;
const MAX_VALUE_BYTES = 512 * 1024;
const MAX_DATABASES = 24;
const MAX_STORES = 64;
const MAX_RECORDS = 50_000;

/** Thrown when account storage cannot be isolated; the game must not open. */
export class IsolationError extends Error {}

export function storagePrefix(gameId: string, userId: string): string {
  return `geegle-game:${gameId}:${userId}:`;
}

function scopedKeys(gameId: string, userId: string): string[] {
  const prefix = storagePrefix(gameId, userId);
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && key.startsWith(prefix)) keys.push(key);
  }
  return keys;
}

function readScoped(gameId: string, userId: string): Record<string, string> {
  const prefix = storagePrefix(gameId, userId);
  const values: Record<string, string> = {};
  for (const key of scopedKeys(gameId, userId)) {
    const value = localStorage.getItem(key);
    if (value !== null) values[key.slice(prefix.length)] = value;
  }
  return values;
}

function writeScoped(gameId: string, userId: string, values: Record<string, string>): void {
  const prefix = storagePrefix(gameId, userId);
  for (const [key, value] of Object.entries(values)) localStorage.setItem(prefix + key, value);
}

function removeScopedExcept(gameId: string, userId: string, keep: Record<string, string>): void {
  const prefix = storagePrefix(gameId, userId);
  for (const key of scopedKeys(gameId, userId)) {
    if (!Object.prototype.hasOwnProperty.call(keep, key.slice(prefix.length))) localStorage.removeItem(key);
  }
}

export function validSavePayload(values: unknown): values is Record<string, string> {
  if (!values || typeof values !== 'object' || Array.isArray(values)) return false;
  return Object.entries(values as Record<string, unknown>).every(([key, value]) =>
    typeof value === 'string' && key.length > 0 && key.length <= MAX_KEY_LENGTH
    && value.length <= MAX_VALUE_BYTES
    && key !== '__proto__' && key !== 'constructor' && key !== 'prototype');
}

/**
 * Reject a database that is not inside this game/account's namespace, is
 * oversized, or carries a malformed schema. A malicious save file therefore
 * cannot target the platform's databases or destroy unrelated progress.
 */
function checkedDatabase(entry: unknown, prefix: string): SerializedDatabase {
  if (!isSerializedDatabase(entry)) throw new Error('Invalid cloud save database entry.');
  const database = entry as SerializedDatabase;
  if (!database.name.startsWith(prefix) || database.name.length === prefix.length) {
    throw new Error('Cloud save references a database that does not belong to this game.');
  }
  if (!Number.isInteger(database.version) || database.version < 1 || database.version > 1000) {
    throw new Error('Cloud save database version is not supported.');
  }
  if (database.stores.length > MAX_STORES) throw new Error('Cloud save database has too many stores.');
  let records = 0;
  for (const store of database.stores) {
    if (!store.name || store.name.length > MAX_KEY_LENGTH) throw new Error('Invalid cloud save store.');
    records += Array.isArray(store.records) ? store.records.length : 0;
  }
  if (records > MAX_RECORDS) throw new Error('Cloud save database has too many records.');
  return database;
}

function validIndexedDB(value: unknown, prefix: string): SerializedDatabase[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('Invalid cloud save database list.');
  if (value.length > MAX_DATABASES) throw new Error('Cloud save contains too many databases.');
  return value.map((entry) => checkedDatabase(entry, prefix));
}

function explicitAdapter(game: typeof games[number]) {
  const { id: gameId, path, keys } = game;
  return {
    launchPath(userId: string | null) {
      return userId ? `${path}?geegle_profile=${encodeURIComponent(userId)}&geegle_game=${encodeURIComponent(gameId)}` : path;
    },
    async capture(userId: string): Promise<SaveSnapshot | null> {
      const values: Record<string, string> = {};
      for (const key of keys) {
        const value = localStorage.getItem(`geegle-game:${gameId}:${userId}:${key}`);
        if (value !== null) values[key] = value;
      }
      if (!Object.keys(values).length) return null;
      return { format: 'geegle-storage-v3', gameId, localStorage: values, indexedDB: [] };
    },
    validate(snapshot: unknown, userId: string): SaveSnapshot {
      if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new Error('Invalid cloud save.');
      const record = snapshot as { format?: unknown; gameId?: unknown; localStorage?: unknown; indexedDB?: unknown };
      // Saves written before the game identity was recorded carry no gameId;
      // the key allowlist below is then the identity check.
      if (record.gameId !== undefined && record.gameId !== gameId) {
        throw new Error('This save file belongs to a different game.');
      }
      if ('indexedDB' in record && (!Array.isArray(record.indexedDB) || record.indexedDB.length)) {
        throw new Error('This older save contains IndexedDB data. It was kept in the cloud but cannot be restored safely.');
      }
      if (record.format !== 'geegle-local-v1' && record.format !== 'geegle-storage-v3' && record.format !== 'v3') {
        throw new Error('Unrecognized cloud save format.');
      }
      if (!validSavePayload(record.localStorage)) throw new Error('Invalid cloud save.');
      const values = record.localStorage;
      const clean: Record<string, string> = {};
      for (const key of keys) {
        const value = values[key];
        if (value !== undefined) clean[key] = value;
      }
      if (!Object.keys(clean).length || Object.keys(values).length !== Object.keys(clean).length) {
        throw new Error('Cloud save contains unexpected game keys.');
      }
      void userId;
      return { format: 'geegle-storage-v3', gameId, localStorage: clean, indexedDB: [] };
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
    async databases() { return [] as string[]; },
  };
}

function genericAdapter(gameId: string, path: string): SaveAdapter {
  const prefixFor = (userId: string) => storagePrefix(gameId, userId);

  async function ownedDatabases(userId: string): Promise<string[]> {
    const prefix = prefixFor(userId);
    return (await listDatabases()).filter((name) => name.startsWith(prefix) && name.length > prefix.length);
  }

  return {
    launchPath(userId) {
      return userId ? `${path}?geegle_profile=${encodeURIComponent(userId)}&geegle_game=${encodeURIComponent(gameId)}` : path;
    },
    async capture(userId) {
      if (!userId) return null;
      const values = readScoped(gameId, userId);
      const databases: SerializedDatabase[] = [];
      for (const name of await ownedDatabases(userId)) {
        const dump = await dumpDatabase(name);
        // Empty stores mean the game had not written anything yet; uploading
        // them would replace a real save with an empty schema.
        if (dump && dump.stores.length) databases.push(dump);
      }
      if (!Object.keys(values).length && !databases.length) return null;
      return { format: 'geegle-storage-v3', gameId, localStorage: values, indexedDB: databases };
    },
    validate(snapshot, userId): SaveSnapshot {
      if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new Error('Invalid cloud save.');
      const record = snapshot as { format?: unknown; gameId?: unknown; localStorage?: unknown; indexedDB?: unknown };
      if (record.format !== 'geegle-storage-v3') throw new Error('Unrecognized cloud save format.');
      if (record.gameId !== gameId) throw new Error('This save file belongs to a different game.');
      if (!validSavePayload(record.localStorage)) throw new Error('Invalid cloud save.');
      for (const key of Object.keys(record.localStorage)) {
        // Game keys are stored unscoped; a key that looks like platform state
        // is rejected rather than allowed to overwrite it on restore.
        if (key.startsWith('geegle-')) throw new Error('Cloud save contains reserved keys.');
      }
      return {
        format: 'geegle-storage-v3',
        gameId,
        localStorage: { ...record.localStorage },
        indexedDB: validIndexedDB(record.indexedDB, prefixFor(userId)),
      };
    },
    async restore(userId, snapshot) {
      const prefix = prefixFor(userId);
      const values = snapshot.localStorage;
      const backup = readScoped(gameId, userId);
      if (Object.keys(backup).length) {
        localStorage.setItem(`geegle-game-backup:${gameId}:${userId}:${crypto.randomUUID()}`, JSON.stringify({
          format: 'geegle-storage-v3',
          gameId,
          localStorage: backup,
          indexedDB: [],
        }));
      }
      const databases = snapshot.indexedDB ?? [];
      const restored: string[] = [];
      for (const database of databases) {
        // Re-checked here as well: validate() is the boundary, but restore is
        // the code that deletes, so it re-asserts the namespace itself.
        const checked = checkedDatabase(database, prefix);
        await restoreDatabase(checked);
        restored.push(checked.name);
      }
      writeScoped(gameId, userId, values);
      removeScopedExcept(gameId, userId, values);
      // A snapshot that declares databases is authoritative for this account:
      // databases saved with it replace the local copies, and stale ones go.
      // An empty list never deletes anything (empty-save protection).
      if (databases.length) {
        for (const name of await ownedDatabases(userId)) {
          if (restored.includes(name)) continue;
          await deleteDatabase(name);
        }
      }
    },
    async isolate(userId) {
      // Every database this game writes carries the account in its name, so
      // another account's data is unreachable rather than merely deleted.
      // Verify the contract instead of pretending a delete happened.
      const prefix = prefixFor(userId);
      if (!prefix.startsWith(`geegle-game:${gameId}:`) || !prefix.endsWith(':')) {
        throw new IsolationError('Game storage namespace is invalid.');
      }
    },
    databases: ownedDatabases,
  };
}

/** The adapter for a catalog entry, or null when no save support is possible. */
export function adapterFor(gameId: string, path: string): SaveAdapter | null {
  const explicit = games.find((entry) => entry.id === gameId && entry.path === path);
  if (explicit) return explicitAdapter(explicit);
  if (!path.startsWith('/games/')) return null;
  return genericAdapter(gameId, path);
}
