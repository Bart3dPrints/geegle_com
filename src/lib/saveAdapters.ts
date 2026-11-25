// Game-save adapters. Snapshots are explicitly tagged so JSONB can preserve
// IndexedDB keys and values that JSON.stringify would corrupt (Blobs,
// ArrayBuffers, typed arrays, Dates, undefined, and nested objects).

export type EngineKind = 'emulatorjs' | 'unity' | 'ruffle' | 'construct' | 'html5' | 'unknown';

type Encoded =
  | { t: 'undefined' }
  | { t: 'null' }
  | { t: 'string' | 'number' | 'boolean'; v: string | number | boolean }
  | { t: 'bigint'; v: string }
  | { t: 'date'; v: string }
  | { t: 'array'; v: Encoded[] }
  | { t: 'object'; v: Record<string, Encoded> }
  | { t: 'map'; v: [Encoded, Encoded][] }
  | { t: 'set'; v: Encoded[] }
  | { t: 'arraybuffer'; v: string }
  | { t: 'typedarray'; c: string; v: string }
  | { t: 'blob'; type: string; v: string };

export interface IndexDump {
  name: string;
  keyPath: string | string[] | null;
  unique: boolean;
  multiEntry: boolean;
}

export interface ObjectStoreDump {
  name: string;
  keyPath: string | string[] | null;
  autoIncrement: boolean;
  indexes: IndexDump[];
  records: { key: Encoded; value: Encoded }[];
}

export interface IndexedDbDump {
  name: string;
  version: number;
  stores: ObjectStoreDump[];
}

export interface SaveSnapshot {
  timestamp: number;
  format: 'v3';
  localStorage: Record<string, string>;
  indexedDB: IndexedDbDump[];
  adapter: string;
}

export interface SaveAdapter {
  kind: EngineKind;
  label: string;
  supported(launchPath: string): boolean;
  capture(gameId: string): Promise<SaveSnapshot | null>;
  restore(gameId: string, snapshot: SaveSnapshot): Promise<boolean>;
  /** Clears only game-owned storage after a successful account logout save. */
  clear(gameId: string): Promise<void>;
}

const FORBIDDEN_KEY_RE = /^(supabase|geegle-auth|geegle-entry|geegle-device|geegle-theme|geegle-favorites|geegle-recently|geegle-default|geegle-save-meta|geegle-settings)/i;
const ENGINE_KEY_RE = /^(ejs[-_]|emulatorjs[-_]|unity(progress)?[-_.]|ruffle[-_]|c[23][-_]|construct[-_])/i;

function idVariants(gameId: string): string[] {
  const lower = gameId.toLowerCase();
  return [lower, lower.replace(/^cl/, ''), lower.replace(/[-_]/g, '')].filter((v) => v.length > 2);
}

function belongsToGame(key: string, gameId: string): boolean {
  if (FORBIDDEN_KEY_RE.test(key)) return false;
  return ENGINE_KEY_RE.test(key) || idVariants(gameId).some((v) => key.toLowerCase().includes(v));
}

function encodeBytes(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

function decodeBytes(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function encode(value: unknown, seen = new WeakSet<object>()): Encoded {
  if (value === undefined) return { t: 'undefined' };
  if (value === null) return { t: 'null' };
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return { t: typeof value, v: value } as Encoded;
  }
  if (typeof value === 'bigint') return { t: 'bigint', v: value.toString() };
  if (value instanceof Date) return { t: 'date', v: value.toISOString() };
  if (value instanceof ArrayBuffer) return { t: 'arraybuffer', v: encodeBytes(new Uint8Array(value)) };
  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView & { constructor: { name: string }; byteOffset: number; byteLength: number };
    return { t: 'typedarray', c: view.constructor.name, v: encodeBytes(new Uint8Array(view.buffer, view.byteOffset, view.byteLength)) };
  }
  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    // Blob encoding is completed asynchronously by encodeAsync; this branch is
    // never used by the async snapshot path and is retained for type safety.
    return { t: 'blob', type: value.type, v: '' };
  }
  if (typeof value !== 'object') return { t: 'undefined' };
  if (seen.has(value as object)) throw new Error('Cyclic save value is not supported');
  seen.add(value as object);
  if (value instanceof Map) return { t: 'map', v: [...value.entries()].map(([k, v]) => [encode(k, seen), encode(v, seen)]) };
  if (value instanceof Set) return { t: 'set', v: [...value].map((v) => encode(v, seen)) };
  if (Array.isArray(value)) return { t: 'array', v: value.map((v) => encode(v, seen)) };
  const out: Record<string, Encoded> = {};
  for (const [k, v] of Object.entries(value)) out[k] = encode(v, seen);
  return { t: 'object', v: out };
}

function decode(value: Encoded): unknown {
  switch (value.t) {
    case 'undefined': return undefined;
    case 'null': return null;
    case 'string': case 'number': case 'boolean': return value.v;
    case 'bigint': return BigInt(value.v);
    case 'date': return new Date(value.v);
    case 'arraybuffer': return decodeBytes(value.v).buffer;
    case 'typedarray': {
      const bytes = decodeBytes(value.v);
      const constructors: Record<string, (b: ArrayBuffer) => unknown> = {
        Uint8Array: (b) => new Uint8Array(b), Int8Array: (b) => new Int8Array(b),
        Uint16Array: (b) => new Uint16Array(b), Int16Array: (b) => new Int16Array(b),
        Uint32Array: (b) => new Uint32Array(b), Int32Array: (b) => new Int32Array(b),
        Float32Array: (b) => new Float32Array(b), Float64Array: (b) => new Float64Array(b),
        BigInt64Array: (b) => new BigInt64Array(b), BigUint64Array: (b) => new BigUint64Array(b),
      };
      return constructors[value.c]?.(bytes.buffer) ?? bytes;
    }
    case 'blob': return new Blob([decodeBytes(value.v)], { type: value.type });
    case 'array': return value.v.map(decode);
    case 'object': return Object.fromEntries(Object.entries(value.v).map(([k, v]) => [k, decode(v)]));
    case 'map': return new Map(value.v.map(([k, v]) => [decode(k), decode(v)]));
    case 'set': return new Set(value.v.map(decode));
  }
}

async function encodeAsync(value: unknown): Promise<Encoded> {
  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    return { t: 'blob', type: value.type, v: encodeBytes(new Uint8Array(await value.arrayBuffer())) };
  }
  if (Array.isArray(value)) {
    return { t: 'array', v: await Promise.all(value.map(encodeAsync)) };
  }
  if (value && typeof value === 'object' && !(value instanceof ArrayBuffer) && !ArrayBuffer.isView(value) && !(value instanceof Date) && !(value instanceof Map) && !(value instanceof Set)) {
    const out: Record<string, Encoded> = {};
    for (const [k, v] of Object.entries(value)) out[k] = await encodeAsync(v);
    return { t: 'object', v: out };
  }
  return encode(value);
}

function localEntries(gameId: string): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && belongsToGame(key, gameId)) {
        const value = localStorage.getItem(key);
        if (value !== null) result[key] = value;
      }
    }
  } catch { /* storage unavailable */ }
  return result;
}

function clearLocalEntries(gameId: string): void {
  try {
    for (const key of Object.keys(localEntries(gameId))) localStorage.removeItem(key);
  } catch { /* storage unavailable */ }
}

function openDb(name: string, version?: number, upgrade?: (db: IDBDatabase) => void): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = version === undefined ? indexedDB.open(name) : indexedDB.open(name, version);
      req.onupgradeneeded = () => { if (req.result) upgrade?.(req.result); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
}

async function dbNames(gameId: string): Promise<string[]> {
  if (typeof indexedDB === 'undefined' || !indexedDB.databases) return [];
  try {
    const all = await indexedDB.databases();
    return (all ?? []).map((d) => d.name).filter((n): n is string => Boolean(n)).filter((n) => !FORBIDDEN_KEY_RE.test(n) && (ENGINE_KEY_RE.test(n) || idVariants(gameId).some((v) => n.toLowerCase().includes(v))));
  } catch { return []; }
}

async function dumpDb(name: string): Promise<IndexedDbDump | null> {
  const db = await openDb(name);
  if (!db || db.objectStoreNames.length === 0) { db?.close(); return null; }
  const storeNames = Array.from(db.objectStoreNames);
  const tx = db.transaction(storeNames, 'readonly');
  const stores: ObjectStoreDump[] = [];
  await Promise.all(storeNames.map(async (storeName) => {
    const store = tx.objectStore(storeName);
    const indexes = Array.from(store.indexNames).map((indexName) => { const i = store.index(indexName); return { name: indexName, keyPath: i.keyPath, unique: i.unique, multiEntry: i.multiEntry }; });
    const records: { key: Encoded; value: Encoded }[] = [];
    await new Promise<void>((resolve) => {
      const req = store.openCursor();
      req.onsuccess = async () => { const c = req.result; if (!c) { resolve(); return; } records.push({ key: encode(c.key), value: await encodeAsync(c.value) }); c.continue(); };
      req.onerror = () => resolve();
    });
    stores.push({ name: storeName, keyPath: store.keyPath, autoIncrement: store.autoIncrement, indexes, records });
  }));
  db.close();
  return { name, version: db.version, stores };
}

async function restoreDb(dump: IndexedDbDump): Promise<boolean> {
  if (typeof indexedDB === 'undefined') return false;
  let db = await openDb(dump.name);
  const needsUpgrade = !db || dump.stores.some((s) => !db!.objectStoreNames.contains(s.name));
  if (db && needsUpgrade) { const next = Math.max(db.version + 1, dump.version); db.close(); db = await openDb(dump.name, next, (upgraded) => { for (const s of dump.stores) if (!upgraded.objectStoreNames.contains(s.name)) { const os = upgraded.createObjectStore(s.name, { keyPath: s.keyPath ?? undefined, autoIncrement: s.autoIncrement }); for (const i of s.indexes) os.createIndex(i.name, i.keyPath, { unique: i.unique, multiEntry: i.multiEntry }); } }); }
  if (!db) return false;
  const names = dump.stores.map((s) => s.name).filter((n) => db!.objectStoreNames.contains(n));
  if (names.length === 0) { db.close(); return true; }
  return await new Promise<boolean>((resolve) => {
    const tx = db!.transaction(names, 'readwrite');
    tx.oncomplete = () => { db!.close(); resolve(true); };
    tx.onerror = tx.onabort = () => { db!.close(); resolve(false); };
    for (const s of dump.stores) {
      if (!db!.objectStoreNames.contains(s.name)) continue;
      const os = tx.objectStore(s.name);
      for (const r of s.records) {
        try { const key = decode(r.key) as IDBValidKey; const value = decode(r.value); if (os.keyPath === null) os.put(value, key); else os.put(value); } catch { /* transaction will report failure if required */ }
      }
    }
  });
}

const adapter: SaveAdapter = {
  kind: 'html5',
  label: 'HTML5 / EmulatorJS / Unity / Ruffle / Construct storage',
  supported: (path) => !path.startsWith('http'),
  async capture(gameId) {
    const localStorage = localEntries(gameId);
    const indexedDB: IndexedDbDump[] = [];
    for (const name of await dbNames(gameId)) { const dump = await dumpDb(name); if (dump) indexedDB.push(dump); }
    if (!Object.keys(localStorage).length && !indexedDB.some((d) => d.stores.some((s) => s.records.length))) return null;
    return { timestamp: Date.now(), format: 'v3', localStorage, indexedDB, adapter: 'universal-v3' };
  },
  async restore(gameId, snapshot) {
    if (snapshot.format !== 'v3' && snapshot.format !== 'v2') return false;
    for (const [key, value] of Object.entries(snapshot.localStorage ?? {})) if (belongsToGame(key, gameId)) localStorage.setItem(key, value);
    let ok = true;
    for (const dump of snapshot.indexedDB ?? []) if (!(await restoreDb(dump))) ok = false;
    return ok;
  },
  async clear(gameId) {
    clearLocalEntries(gameId);
    // Do not delete IndexedDB databases: a database can contain unrelated
    // stores and IDB deletion is destructive. Account switching is protected
    // by clearing captured localStorage plus restoring the next account's
    // namespaced cloud snapshot before launch.
  },
};

export function adapterFor(launchPath: string): SaveAdapter | null { return adapter.supported(launchPath) ? adapter : null; }
export function adapterLabel(launchPath: string): string { return adapterFor(launchPath)?.label ?? 'Unsupported (cross-origin)'; }
