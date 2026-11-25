// Lossless, game-scoped browser-save adapters.
// Snapshots use tagged values because JSON.stringify cannot preserve IndexedDB
// keys, Blobs, ArrayBuffers, typed arrays, Dates, Maps, Sets, or undefined.

export type EngineKind = 'emulatorjs' | 'unity' | 'ruffle' | 'construct' | 'html5' | 'unknown';

type Encoded = { t: string; v?: unknown; c?: string; type?: string };
export interface IndexDump { name: string; keyPath: string | string[] | null; unique: boolean; multiEntry: boolean }
export interface ObjectStoreDump { name: string; keyPath: string | string[] | null; autoIncrement: boolean; indexes: IndexDump[]; records: { key: Encoded; value: Encoded }[] }
export interface IndexedDbDump { name: string; version: number; stores: ObjectStoreDump[] }
export interface SaveSnapshot { timestamp: number; format: 'v3'; localStorage: Record<string, string>; indexedDB: IndexedDbDump[]; adapter: string }
export interface SaveAdapter { kind: EngineKind; label: string; supported(path: string): boolean; capture(gameId: string): Promise<SaveSnapshot | null>; restore(gameId: string, snapshot: SaveSnapshot): Promise<boolean>; clear(gameId: string): Promise<void> }

const FORBIDDEN = /^(supabase|geegle-auth|geegle-entry|geegle-device|geegle-theme|geegle-favorites|geegle-recently|geegle-default|geegle-save-meta|geegle-settings)/i;
const ENGINE_KEY = /^(ejs[-_]|emulatorjs[-_]|unity(progress)?[-_.]|ruffle[-_]|c[23][-_]|construct[-_])/i;
const variants = (id: string) => [id.toLowerCase(), id.toLowerCase().replace(/^cl/, ''), id.toLowerCase().replace(/[-_]/g, '')].filter((x) => x.length > 2);
const gameKey = (key: string, id: string) => !FORBIDDEN.test(key) && (ENGINE_KEY.test(key) || variants(id).some((v) => key.toLowerCase().includes(v)));

function bytesToBase64(bytes: Uint8Array): string { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); }
function base64ToBytes(s: string): Uint8Array { const b = atob(s); const a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }

async function enc(value: unknown, stack = new WeakSet<object>()): Promise<Encoded> {
  if (value === undefined) return { t: 'undefined' }; if (value === null) return { t: 'null' };
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return { t: typeof value, v: value };
  if (typeof value === 'bigint') return { t: 'bigint', v: value.toString() };
  if (value instanceof Date) return { t: 'date', v: value.toISOString() };
  if (value instanceof ArrayBuffer) return { t: 'arraybuffer', v: bytesToBase64(new Uint8Array(value)) };
  if (ArrayBuffer.isView(value)) { const x = value as ArrayBufferView; return { t: 'typedarray', c: value.constructor.name, v: bytesToBase64(new Uint8Array(x.buffer, x.byteOffset, x.byteLength)) }; }
  if (typeof Blob !== 'undefined' && value instanceof Blob) return { t: 'blob', type: value.type, v: bytesToBase64(new Uint8Array(await value.arrayBuffer())) };
  if (typeof value !== 'object') return { t: 'undefined' };
  if (stack.has(value)) throw new Error('Cyclic save value'); stack.add(value);
  if (value instanceof Map) return { t: 'map', v: await Promise.all([...value].map(async ([k, v]) => [await enc(k, stack), await enc(v, stack)])) };
  if (value instanceof Set) return { t: 'set', v: await Promise.all([...value].map((v) => enc(v, stack))) };
  if (Array.isArray(value)) return { t: 'array', v: await Promise.all(value.map((v) => enc(v, stack))) };
  const out: Record<string, Encoded> = {}; for (const [k, v] of Object.entries(value)) out[k] = await enc(v, stack); return { t: 'object', v: out };
}

function dec(x: Encoded): unknown {
  switch (x.t) {
    case 'undefined': return undefined; case 'null': return null; case 'string': case 'number': case 'boolean': return x.v;
    case 'bigint': return BigInt(x.v as string); case 'date': return new Date(x.v as string);
    case 'arraybuffer': return base64ToBytes(x.v as string).buffer;
    case 'blob': return new Blob([base64ToBytes(x.v as string)], { type: x.type });
    case 'typedarray': { const b = base64ToBytes(x.v as string).buffer; const C: Record<string, (b: ArrayBuffer) => unknown> = { Uint8Array: (z) => new Uint8Array(z), Int8Array: (z) => new Int8Array(z), Uint16Array: (z) => new Uint16Array(z), Int16Array: (z) => new Int16Array(z), Uint32Array: (z) => new Uint32Array(z), Int32Array: (z) => new Int32Array(z), Float32Array: (z) => new Float32Array(z), Float64Array: (z) => new Float64Array(z), BigInt64Array: (z) => new BigInt64Array(z), BigUint64Array: (z) => new BigUint64Array(z) }; return C[x.c ?? '']?.(b) ?? new Uint8Array(b); }
    case 'array': return (x.v as Encoded[]).map(dec); case 'object': return Object.fromEntries(Object.entries(x.v as Record<string, Encoded>).map(([k, v]) => [k, dec(v)]));
    case 'map': return new Map((x.v as [Encoded, Encoded][]).map(([k, v]) => [dec(k), dec(v)])); case 'set': return new Set((x.v as Encoded[]).map(dec)); default: throw new Error(`Unknown save value ${x.t}`);
  }
}

function openDb(name: string, version?: number, upgrade?: (db: IDBDatabase) => void): Promise<IDBDatabase | null> { return new Promise((resolve) => { try { const r = version === undefined ? indexedDB.open(name) : indexedDB.open(name, version); r.onupgradeneeded = () => upgrade?.(r.result); r.onsuccess = () => resolve(r.result); r.onerror = () => resolve(null); r.onblocked = () => resolve(null); } catch { resolve(null); } }); }
function localFor(id: string): Record<string, string> { const o: Record<string, string> = {}; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && gameKey(k, id)) { const v = localStorage.getItem(k); if (v !== null) o[k] = v; } } } catch {} return o; }
async function namesFor(id: string): Promise<string[]> { if (typeof indexedDB === 'undefined' || !indexedDB.databases) return []; try { const all = await indexedDB.databases(); return (all ?? []).map((x) => x.name).filter((n): n is string => Boolean(n) && !FORBIDDEN.test(n) && (ENGINE_KEY.test(n) || variants(id).some((v) => n.toLowerCase().includes(v)))); } catch { return []; } }

async function dumpDb(name: string): Promise<IndexedDbDump | null> {
  const db = await openDb(name); if (!db || db.objectStoreNames.length === 0) { db?.close(); return null; }
  const stores: ObjectStoreDump[] = [];
  for (const name of Array.from(db.objectStoreNames)) {
    const tx = db.transaction(name, 'readonly'); const os = tx.objectStore(name);
    const indexes = Array.from(os.indexNames).map((n) => { const i = os.index(n); return { name: n, keyPath: i.keyPath, unique: i.unique, multiEntry: i.multiEntry }; });
    const records: { key: Encoded; value: Encoded }[] = [];
    await new Promise<void>((resolve) => { const r = os.openCursor(); r.onsuccess = async () => { const c = r.result; if (!c) { resolve(); return; } try { records.push({ key: await enc(c.key), value: await enc(c.value) }); } catch {} c.continue(); }; r.onerror = () => resolve(); });
    stores.push({ name, keyPath: os.keyPath, autoIncrement: os.autoIncrement, indexes, records });
  }
  const version = db.version; db.close(); return { name, version, stores };
}

function schemaNeedsUpgrade(db: IDBDatabase, dump: IndexedDbDump): boolean { return dump.stores.some((s) => { if (!db.objectStoreNames.contains(s.name)) return true; const os = db.transaction(s.name, 'readonly').objectStore(s.name); return s.indexes.some((i) => !os.indexNames.contains(i.name)); }); }
async function restoreDb(dump: IndexedDbDump): Promise<boolean> {
  if (typeof indexedDB === 'undefined') return false;
  let db = await openDb(dump.name);
  const createAll = (upgraded: IDBDatabase) => { for (const s of dump.stores) { let os = upgraded.objectStoreNames.contains(s.name) ? null : upgraded.createObjectStore(s.name, { keyPath: s.keyPath ?? undefined, autoIncrement: s.autoIncrement }); if (!os) continue; for (const i of s.indexes) if (!os.indexNames.contains(i.name)) os.createIndex(i.name, i.keyPath, { unique: i.unique, multiEntry: i.multiEntry }); } };
  if (!db) db = await openDb(dump.name, Math.max(1, dump.version), createAll);
  else if (schemaNeedsUpgrade(db, dump)) { const next = db.version + 1; db.close(); db = await openDb(dump.name, next, createAll); }
  if (!db) return false;
  const names = dump.stores.map((s) => s.name).filter((n) => db!.objectStoreNames.contains(n));
  return new Promise<boolean>((resolve) => { if (!names.length) { db!.close(); resolve(true); return; } const tx = db!.transaction(names, 'readwrite'); tx.oncomplete = () => { db!.close(); resolve(true); }; tx.onerror = tx.onabort = () => { db!.close(); resolve(false); }; for (const s of dump.stores) { if (!db!.objectStoreNames.contains(s.name)) continue; const os = tx.objectStore(s.name); for (const r of s.records) { try { const value = dec(r.value); const key = dec(r.key) as IDBValidKey; os.keyPath === null ? os.put(value, key) : os.put(value); } catch {} } } });
}

const adapter: SaveAdapter = {
  kind: 'html5', label: 'HTML5 / EmulatorJS / Unity / Ruffle / Construct storage', supported: (path) => !path.startsWith('http'),
  async capture(gameId) { const localStorage = localFor(gameId); const indexedDB: IndexedDbDump[] = []; for (const n of await namesFor(gameId)) { const d = await dumpDb(n); if (d) indexedDB.push(d); } if (!Object.keys(localStorage).length && !indexedDB.some((d) => d.stores.some((s) => s.records.length))) return null; return { timestamp: Date.now(), format: 'v3', localStorage, indexedDB, adapter: 'universal-v3' }; },
  async restore(gameId, snapshot) { if (snapshot.format !== 'v3') return false; for (const [k, v] of Object.entries(snapshot.localStorage ?? {})) if (gameKey(k, gameId)) localStorage.setItem(k, v); let ok = true; for (const d of snapshot.indexedDB ?? []) if (!(await restoreDb(d))) ok = false; return ok; },
  async clear(gameId) { for (const k of Object.keys(localFor(gameId))) localStorage.removeItem(k); },
};
export function adapterFor(path: string): SaveAdapter | null { return adapter.supported(path) ? adapter : null; }
export function adapterLabel(path: string): string { return adapterFor(path)?.label ?? 'Unsupported (cross-origin)'; }
