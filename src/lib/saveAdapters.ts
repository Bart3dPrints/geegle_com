// Game save engine adapters.
//
// Each adapter snapshots and restores a game's persisted data on the Geegle
// origin. Key discovery is per-game rather than assumed: the same-origin games
// in this repo load their logic from CDNs but persist into THIS page's
// storage under engine-specific names, so adapters capture by pattern and
// record what they found. Nothing outside game-scoped keys is ever uploaded.

export interface SaveSnapshot {
  /** Milliseconds since epoch (UTC) when this snapshot was taken. */
  timestamp: number;
  format: 'v2';
  /** Game-scoped localStorage entries. */
  localStorage: Record<string, string>;
  /** Full-fidelity IndexedDB dumps. */
  indexedDB: IndexedDbDump[];
  /** Which adapter produced this snapshot (for the compatibility manifest). */
  adapter: string;
}

export interface ObjectStoreDump {
  name: string;
  /** Records as { key, value } pairs preserving original keys. */
  records: { key: string; value: unknown }[];
}

export interface IndexedDbDump {
  name: string;
  /** Original database version. */
  version: number;
  /** All object stores with their records. */
  stores: ObjectStoreDump[];
}

export type EngineKind =
  | 'emulatorjs'
  | 'unity'
  | 'ruffle'
  | 'construct'
  | 'html5'
  | 'unknown';

export interface SaveAdapter {
  kind: EngineKind;
  /** Human-readable name for the compatibility manifest. */
  label: string;
  supported(launchPath: string): boolean;
  capture(gameId: string): Promise<SaveSnapshot | null>;
  restore(gameId: string, snapshot: SaveSnapshot): Promise<boolean>;
}

// ── localStorage capture ──────────────────────────────────────────────────

/**
 * Engine key patterns observed in this repository's games:
 * - EmulatorJS (same-origin): `ejs-*`, `emulatorjs-*`
 * - Unity WebGL: `UnityProgress-*`, `unity.*`, `unity_*`, and
 *   `<CompanyName>_<ProductName>*` patterns
 * - Ruffle: `ruffle-*`
 * - Construct 2/3: `c2-*`, `c3-*`, `construct-*`
 * - Generic HTML5: the game id itself in various shapes (`clfoo`, `clfoo.html`)
 */
const KEY_PATTERNS: { engine: string; patterns: RegExp[] }[] = [
  { engine: 'emulatorjs', patterns: [/^ejs[-_]/i, /^emulatorjs[-_]/i] },
  { engine: 'unity', patterns: [/^unityprogress[-_]/i, /^unity[._]/i, /^unity[-_]/i] },
  { engine: 'ruffle', patterns: [/^ruffle[-_]/i] },
  { engine: 'construct', patterns: [/^c2[-_]/i, /^c3[-_]/i, /^construct[-_]/i] },
  { engine: 'html5', patterns: [] }, // game-scoped patterns added dynamically
];

/** True when a localStorage key belongs to this game (never another user's data). */
function isGameKey(key: string, gameId: string): boolean {
  const idVariants = [
    gameId.toLowerCase(),
    gameId.toLowerCase().replace(/^cl/, ''),
    gameId.toLowerCase().replace(/[-_]/g, ''),
  ];
  // Engine patterns are game-agnostic by design (one game runs at a time in
  // the player) but only engine-scoped prefixes are allowed — never broad
  // keys like `token`, `session`, or Supabase's own keys.
  for (const { patterns } of KEY_PATTERNS) {
    for (const p of patterns) {
      if (p.test(key)) return true;
    }
  }
  return idVariants.some((v) => v.length > 2 && key.toLowerCase().includes(v));
}

/** Never sync these — account/session credentials, not game data. */
const FORBIDDEN_KEY_RE =
  /^(supabase|geegle-auth|geegle-entry|geegle-device|geegle-theme|geegle-favorites|geegle-recently|geegle-default|geegle-save-meta|geegle-settings)/i;

function readLocalStorageForGame(gameId: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (FORBIDDEN_KEY_RE.test(key)) continue;
      if (isGameKey(key, gameId)) {
        const value = localStorage.getItem(key);
        if (value !== null) out[key] = value;
      }
    }
  } catch {
    /* storage unavailable */
  }
  return out;
}

function writeLocalStorageEntries(entries: Record<string, string>): void {
  try {
    for (const [key, value] of Object.entries(entries)) {
      localStorage.setItem(key, value);
    }
  } catch {
    /* storage unavailable */
  }
}

// ── IndexedDB full-fidelity dump ───────────────────────────────────────────

function idbOpenVersioned(name: string, version?: number): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req =
        version !== undefined
          ? indexedDB.open(name, version)
          : indexedDB.open(name);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
      // versionchange can happen if another tab holds the db; treat as null.
      req.onupgradeneeded = () => {
        /* upgrade is written by the game itself on first run; capture only. */
      };
    } catch {
      resolve(null);
    }
  });
}

/** Lists game-related database names (never auth/infra databases). */
async function gameDatabaseNames(gameId: string): Promise<string[]> {
  if (typeof indexedDB === 'undefined' || !indexedDB.databases) return [];
  const idVariants = [
    gameId.toLowerCase(),
    gameId.toLowerCase().replace(/^cl/, ''),
  ];
  const enginePrefixes = ['ejs', 'emulatorjs', 'unity', 'ruffle', 'c2', 'c3', 'construct'];
  try {
    const dbs = await indexedDB.databases();
    return (dbs ?? [])
      .map((d) => d.name)
      .filter((n): n is string => Boolean(n))
      .filter((name) => {
        const lower = name.toLowerCase();
        if (FORBIDDEN_KEY_RE.test(lower)) return false;
        if (enginePrefixes.some((p) => lower.startsWith(p))) return true;
        return idVariants.some((v) => v.length > 2 && lower.includes(v));
      });
  } catch {
    return [];
  }
}

/** Dumps a database preserving version, stores, keys, and values. */
async function dumpDatabase(name: string): Promise<IndexedDbDump | null> {
  const db = await idbOpenVersioned(name);
  if (!db) return null;

  return new Promise((resolve) => {
    const version = db.version;
    const storeNames = Array.from(db.objectStoreNames);
    if (storeNames.length === 0) {
      db.close();
      resolve(null);
      return;
    }

    const stores: ObjectStoreDump[] = [];
    let pending = storeNames.length;
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      db.close();
      resolve({ name, version, stores });
    };

    const tx = db.transaction(storeNames, 'readonly');
    tx.onabort = finish;
    tx.onerror = () => finish();

    for (const storeName of storeNames) {
      const store = tx.objectStore(storeName);
      const records: { key: string; value: unknown }[] = [];
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          records.push({
            key: String(cursor.key),
            value: cursor.value,
          });
          cursor.continue();
        } else {
          stores.push({ name: storeName, records });
          if (--pending === 0) finish();
        }
      };
      cursorReq.onerror = () => {
        stores.push({ name: storeName, records });
        if (--pending === 0) finish();
      };
    }
  });
}

/** Restores a dump WITHOUT destructive clearing: records are upserted, so
 *  local-only records survive and cloud records win on the same key. */
async function restoreDatabase(dump: IndexedDbDump): Promise<boolean> {
  if (typeof indexedDB === 'undefined') return false;

  // Open at the dumped version so the database is upgraded to match, letting
  // the game's own upgrade path create stores when missing.
  const db = await idbOpenVersioned(dump.name, Math.max(dump.version, 1));
  if (!db) return false;

  return new Promise((resolve) => {
    const storeNames = Array.from(db.objectStoreNames);
    const missingStores = dump.stores
      .map((s) => s.name)
      .filter((name) => !storeNames.includes(name));

    if (missingStores.length > 0) {
      // The current connection can't create stores without a version bump;
      // reopen at version+1 to trigger the upgrade path, then retry once.
      db.close();
      idbOpenVersioned(dump.name, db.version + 1).then((upgraded) => {
        if (!upgraded) {
          resolve(false);
          return;
        }
        upgraded.close();
        void restoreDatabase(dump).then(resolve);
      });
      return;
    }

    let pending = dump.stores.length;
    let ok = true;
    const finish = () => resolve(ok);
    if (pending === 0) {
      db.close();
      resolve(true);
      return;
    }

    const tx = db.transaction(storeNames, 'readwrite');
    tx.oncomplete = () => {
      db.close();
      finish();
    };
    tx.onerror = () => {
      db.close();
      ok = false;
      finish();
    };
    tx.onabort = () => {
      db.close();
      ok = false;
      finish();
    };

    for (const storeDump of dump.stores) {
      if (!storeNames.includes(storeDump.name)) continue;
      const store = tx.objectStore(storeDump.name);
      for (const record of storeDump.records) {
        try {
          const value = record.value;
          const key = record.key;
          const parsed = parseKey(key);
          if (parsed !== undefined) {
            store.put(value as never, parsed);
          } else {
            store.put(value as never);
          }
        } catch {
          ok = false;
        }
      }
    }
  });
}

/** Best-effort reconstruction of the original key type. */
function parseKey(serialized: string): IDBValidKey | undefined {
  // Numeric keys were stringified by JSON; restore their type so records
  // land on the same keys the game expects.
  if (/^-?\d+$/.test(serialized)) {
    const n = Number(serialized);
    if (Number.isSafeInteger(n)) return n;
  }
  return serialized;
}

// ── Universal adapter ─────────────────────────────────────────────────────

function makeSnapshot(
  gameId: string,
  adapterName: string,
  ls: Record<string, string>,
  idb: IndexedDbDump[]
): SaveSnapshot | null {
  const hasData =
    Object.keys(ls).length > 0 ||
    idb.some((d) => d.stores.some((s) => s.records.length > 0));
  if (!hasData) return null;
  return {
    timestamp: Date.now(),
    format: 'v2',
    localStorage: ls,
    indexedDB: idb,
    adapter: adapterName,
  };
}

export const universalAdapter: SaveAdapter = {
  kind: 'html5',
  label: 'HTML5 / engine localStorage + IndexedDB',
  supported(launchPath) {
    // Same-origin games only: cross-origin iframes keep storage on their
    // own origin where browser security (correctly) blocks this page.
    return !launchPath.startsWith('http');
  },
  async capture(gameId) {
    const ls = readLocalStorageForGame(gameId);
    const names = await gameDatabaseNames(gameId);
    const dumps: IndexedDbDump[] = [];
    for (const name of names) {
      const dump = await dumpDatabase(name);
      if (dump) dumps.push(dump);
    }
    return makeSnapshot(gameId, 'universal-v2', ls, dumps);
  },
  async restore(_gameId, snapshot) {
    if (snapshot.format !== 'v2') return false;
    writeLocalStorageEntries(snapshot.localStorage ?? {});
    let allOk = true;
    for (const dump of snapshot.indexedDB ?? []) {
      const ok = await restoreDatabase(dump);
      if (!ok) allOk = false;
    }
    return allOk;
  },
};

const adapters: SaveAdapter[] = [universalAdapter];

export function adapterFor(launchPath: string): SaveAdapter | null {
  for (const a of adapters) {
    if (a.supported(launchPath)) return a;
  }
  return null;
}

export function adapterLabel(launchPath: string): string {
  return adapterFor(launchPath)?.label ?? 'Unsupported (cross-origin)';
}
