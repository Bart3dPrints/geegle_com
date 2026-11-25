// Cloud save engine adapters. Each adapter knows how a game engine persists
// data on the Geegle origin and how to snapshot/restore it.
//
// IMPORTANT SCOPE: adapters only touch storage that lives on the Geegle
// origin (localStorage / IndexedDB entries the page itself owns). Most games
// run inside cross-origin iframes (jsdelivr / EmulatorJS), where browser
// security correctly prevents this site from reading their storage — those
// games are reported as `unsupported` rather than silently failing.

export interface SaveSnapshot {
  /** Milliseconds since epoch when this snapshot was taken. */
  timestamp: number;
  /** 'v1' snapshot format. */
  format: 'v1';
  /** localStorage entries captured for this game. */
  localStorage: Record<string, string>;
  /** IndexedDB databases dumped as records. */
  indexedDB: Record<string, Record<string, unknown>[]>;
}

export type EngineKind =
  | 'html5-local'
  | 'emulatorjs'
  | 'unity'
  | 'ruffle'
  | 'construct'
  | 'unknown';

export interface SaveAdapter {
  kind: EngineKind;
  /** Whether this adapter can snapshot data for the given game. */
  supported(gameId: string, launchPath: string): boolean;
  /** Capture a snapshot of the game's current local storage. */
  capture(gameId: string): Promise<SaveSnapshot | null>;
  /** Restore a snapshot into local storage. Returns true if applied. */
  restore(gameId: string, snapshot: SaveSnapshot): Promise<boolean>;
}

// ── helpers ───────────────────────────────────────────────────────────────

function nowMs(): number {
  return Date.now();
}

/** Reads every localStorage key matching a prefix into a record. */
function readLocalStorageByPrefix(prefixes: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (prefixes.some((p) => key.startsWith(p))) {
        const value = localStorage.getItem(key);
        if (value !== null) out[key] = value;
      }
    }
  } catch {
    /* storage unavailable */
  }
  return out;
}

/** Writes captured entries back into localStorage. */
function writeLocalStorage(entries: Record<string, string>): void {
  try {
    for (const [key, value] of Object.entries(entries)) {
      localStorage.setItem(key, value);
    }
  } catch {
    /* storage unavailable */
  }
}

/** Dumps matching IndexedDB object stores as JSON records. */
async function dumpIndexedDB(
  names: string[]
): Promise<Record<string, Record<string, unknown>[]>> {
  const out: Record<string, Record<string, unknown>[]> = {};
  if (typeof indexedDB === 'undefined') return out;

  for (const name of names) {
    try {
      const dbs = await indexedDB.databases?.();
      const exists = dbs?.some((d) => d.name === name);
      if (!exists) continue;

      const records = await new Promise<Record<string, unknown>[]>
        ((resolve, reject) => {
          const req = indexedDB.open(name);
          req.onsuccess = () => {
            const db = req.result;
            const results: Record<string, unknown>[] = [];
            const stores = Array.from(db.objectStoreNames);
            if (stores.length === 0) {
              db.close();
              resolve(results);
              return;
            }
            const tx = db.transaction(stores, 'readonly');
            let pending = stores.length;
            for (const s of stores) {
              const getAll = tx.objectStore(s).getAll();
              getAll.onsuccess = () => {
                for (const rec of getAll.result ?? []) {
                  if (typeof rec === 'object' && rec !== null) {
                    results.push(rec as Record<string, unknown>);
                  }
                }
                if (--pending === 0) {
                  db.close();
                  resolve(results);
                }
              };
              getAll.onerror = () => {
                if (--pending === 0) {
                  db.close();
                  resolve(results);
                }
              };
            }
            tx.onerror = () => reject(tx.error);
          };
          req.onerror = () => reject(req.error);
        });
      out[name] = records;
    } catch {
      /* database missing or unreadable — skip */
    }
  }
  return out;
}

/** Clears matching object stores before restore so cloud data wins. */
async function clearIndexedDB(names: string[]): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  for (const name of names) {
    try {
      const dbs = await indexedDB.databases?.();
      if (!dbs?.some((d) => d.name === name)) continue;
      await new Promise<void>((resolve) => {
        const req = indexedDB.open(name);
        req.onsuccess = () => {
          const db = req.result;
          const stores = Array.from(db.objectStoreNames);
          if (stores.length === 0) {
            db.close();
            resolve();
            return;
          }
          const tx = db.transaction(stores, 'readwrite');
          for (const s of stores) tx.objectStore(s).clear();
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            resolve();
          };
        };
        req.onerror = () => resolve();
      });
    } catch {
      /* ignore */
    }
  }
}

async function restoreIndexedDB(
  dump: Record<string, Record<string, unknown>[]>
): Promise<void> {
  for (const [name, records] of Object.entries(dump)) {
    if (!Array.isArray(records) || records.length === 0) continue;
    try {
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open(name);
        req.onsuccess = () => {
          const db = req.result;
          const stores = Array.from(db.objectStoreNames);
          if (stores.length === 0) {
            db.close();
            resolve();
            return;
          }
          const tx = db.transaction(stores, 'readwrite');
          const target = tx.objectStore(stores[0]);
          for (const rec of records) {
            const key = (rec as { id?: unknown }).id ??
              (rec as { key?: unknown }).key;
            if (key !== undefined && key !== null) {
              target.put(rec, key as IDBValidKey);
            } else {
              target.put(rec);
            }
          }
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            resolve();
          };
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      /* ignore — store may not exist */
    }
  }
}

// ── HTML5 (localStorage/IndexedDB on the Geegle origin) ───────────────────
// Many games persist via localStorage keys prefixed with the game name or
// a stable engine prefix (e.g. EmulatorJS uses `emulatorjs*` on its own
// origin, but same-origin saves use keys like `geegle-save-<gameId>-*`).

export const html5Adapter: SaveAdapter = {
  kind: 'html5-local',
  supported(gameId, launchPath) {
    // Same-origin launch paths (relative /games/*.html) can have their
    // parent-page storage accessed from this window.
    return !launchPath.startsWith('http');
  },
  async capture(gameId) {
    const prefixes = [
      `geegle-save-${gameId}`,
      `geegle-game-${gameId}`,
      gameId,
      `game-${gameId}`,
    ];
    const ls = readLocalStorageByPrefix(prefixes);
    const idb = await dumpIndexedDB([`geegle-${gameId}`, gameId]);
    const hasData =
      Object.keys(ls).length > 0 ||
      Object.values(idb).some((v) => v.length > 0);
    if (!hasData) return null;
    return {
      timestamp: nowMs(),
      format: 'v1',
      localStorage: ls,
      indexedDB: idb,
    };
  },
  async restore(gameId, snapshot) {
    writeLocalStorage(snapshot.localStorage ?? {});
    const idb = snapshot.indexedDB ?? {};
    const names = Object.keys(idb);
    if (names.length > 0) {
      await clearIndexedDB(names);
      await restoreIndexedDB(idb);
    }
    return true;
  },
};

// ── Adapter registry ──────────────────────────────────────────────────────
// All adapters currently operate on same-origin storage; cross-origin games
// are correctly reported unsupported.

const adapters: SaveAdapter[] = [html5Adapter];

export function adapterFor(gameId: string, launchPath: string): SaveAdapter | null {
  for (const a of adapters) {
    if (a.supported(gameId, launchPath)) return a;
  }
  return null;
}

/** True when the game runs same-origin (cloud saves possible). */
export function saveSupportFor(
  gameId: string,
  launchPath: string
): { supported: boolean; engine: EngineKind } {
  const a = adapterFor(gameId, launchPath);
  return {
    supported: a !== null,
    engine: a?.kind ?? 'unknown',
  };
}
