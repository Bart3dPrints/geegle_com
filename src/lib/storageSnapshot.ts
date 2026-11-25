// Lossless serialization for browser game storage.
//
// Games on Geegle are served same-origin, so their progress lands in one of
// two browser stores: localStorage or IndexedDB (Unity WebGL's IDBFS,
// Ruffle's shared objects, and hand-written HTML5 games all use these).
// This module dumps and restores both with full schema fidelity:
// database version, object stores, key paths, autoIncrement, indexes,
// original record keys, and binary values (ArrayBuffer, typed arrays, Blob).

export type EncodedValue =
  | { t: 'null' }
  | { t: 'undefined' }
  | { t: 'string'; v: string }
  | { t: 'number'; v: string }
  | { t: 'boolean'; v: boolean }
  | { t: 'bigint'; v: string }
  | { t: 'date'; v: string }
  | { t: 'arraybuffer'; v: string }
  | { t: 'typedarray'; c: string; v: string }
  | { t: 'dataview'; v: string }
  | { t: 'blob'; m: string; v: string }
  | { t: 'array'; v: EncodedValue[] }
  | { t: 'object'; v: Record<string, EncodedValue> }
  | { t: 'map'; v: [EncodedValue, EncodedValue][] }
  | { t: 'set'; v: EncodedValue[] };

export interface SerializedIndex {
  name: string;
  keyPath: string | string[] | null;
  unique: boolean;
  multiEntry: boolean;
}

export interface SerializedRecord {
  key: EncodedValue;
  value: EncodedValue;
}

export interface SerializedStore {
  name: string;
  keyPath: string | string[] | null;
  autoIncrement: boolean;
  indexes: SerializedIndex[];
  records: SerializedRecord[];
}

export interface SerializedDatabase {
  name: string;
  version: number;
  stores: SerializedStore[];
}

/** Thrown instead of silently losing a value we cannot round-trip. */
export class UnsupportedValueError extends Error {}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const TYPED_ARRAYS = [
  'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array',
  'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array',
  'BigInt64Array', 'BigUint64Array',
] as const;
type TypedArrayName = typeof TYPED_ARRAYS[number];
const typedArrayConstructors: Record<TypedArrayName, new (buffer: ArrayBuffer) => ArrayBufferView> = {
  Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array,
  Uint32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array,
};

async function readBlob(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  return toBase64(new Uint8Array(buffer));
}

export async function encodeValue(value: unknown, seen = new WeakSet<object>()): Promise<EncodedValue> {
  if (value === null) return { t: 'null' };
  if (value === undefined) return { t: 'undefined' };
  switch (typeof value) {
    case 'string': return { t: 'string', v: value };
    case 'boolean': return { t: 'boolean', v: value };
    case 'number':
      // Preserve NaN/-0/Infinity instead of relying on JSON round trips.
      return { t: 'number', v: Number.isNaN(value) ? 'NaN' : Object.is(value, -0) ? '-0' : String(value) };
    case 'bigint': return { t: 'bigint', v: value.toString() };
    default: break;
  }
  if (typeof value !== 'object') throw new UnsupportedValueError(`Cannot store a ${typeof value} value.`);
  const object = value as object;
  if (seen.has(object)) throw new UnsupportedValueError('Cannot store a circular reference.');
  seen.add(object);
  try {
    if (object instanceof Date) return { t: 'date', v: object.toISOString() };
    if (object instanceof ArrayBuffer) return { t: 'arraybuffer', v: toBase64(new Uint8Array(object)) };
    if (object instanceof DataView) {
      return { t: 'dataview', v: toBase64(new Uint8Array(object.buffer, object.byteOffset, object.byteLength)) };
    }
    for (const name of TYPED_ARRAYS) {
      if (object instanceof typedArrayConstructors[name]) {
        const view = object as unknown as { buffer: ArrayBuffer; byteOffset: number; byteLength: number };
        return { t: 'typedarray', c: name, v: toBase64(new Uint8Array(view.buffer, view.byteOffset, view.byteLength)) };
      }
    }
    if (typeof Blob !== 'undefined' && object instanceof Blob) {
      return { t: 'blob', m: object.type || '', v: await readBlob(object) };
    }
    if (Array.isArray(object)) {
      const items: EncodedValue[] = [];
      for (const item of object) items.push(await encodeValue(item, seen));
      return { t: 'array', v: items };
    }
    if (object instanceof Map) {
      const entries: [EncodedValue, EncodedValue][] = [];
      for (const [key, item] of object) entries.push([await encodeValue(key, seen), await encodeValue(item, seen)]);
      return { t: 'map', v: entries };
    }
    if (object instanceof Set) {
      const items: EncodedValue[] = [];
      for (const item of object) items.push(await encodeValue(item, seen));
      return { t: 'set', v: items };
    }
    const prototype = Object.getPrototypeOf(object);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new UnsupportedValueError(`Cannot store a ${object.constructor?.name ?? 'custom'} object.`);
    }
    const entries: Record<string, EncodedValue> = {};
    for (const [key, item] of Object.entries(object)) entries[key] = await encodeValue(item, seen);
    return { t: 'object', v: entries };
  } finally {
    seen.delete(object);
  }
}

export function decodeValue(encoded: unknown): unknown {
  if (!encoded || typeof encoded !== 'object') throw new Error('Invalid stored value.');
  const value = encoded as { t?: unknown };
  switch (value.t) {
    case 'null': return null;
    case 'undefined': return undefined;
    case 'string': return String((value as { v: unknown }).v);
    case 'boolean': return Boolean((value as { v: unknown }).v);
    case 'number': {
      const raw = String((value as { v: unknown }).v);
      if (raw === 'NaN') return Number.NaN;
      if (raw === '-0') return -0;
      if (raw === 'Infinity') return Infinity;
      if (raw === '-Infinity') return -Infinity;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) && raw !== 'NaN') throw new Error('Invalid stored number.');
      return parsed;
    }
    case 'bigint': return BigInt(String((value as { v: unknown }).v));
    case 'date': return new Date(String((value as { v: unknown }).v));
    case 'arraybuffer': return fromBase64(String((value as { v: unknown }).v)).buffer;
    case 'dataview': {
      const bytes = fromBase64(String((value as { v: unknown }).v));
      return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    }
    case 'typedarray': {
      const name = String((value as { c: unknown }).c) as TypedArrayName;
      if (!(name in typedArrayConstructors)) throw new Error('Invalid stored binary type.');
      const bytes = fromBase64(String((value as { v: unknown }).v));
      // Copy into an aligned buffer: restored data must not share storage.
      return new typedArrayConstructors[name](bytes.slice().buffer);
    }
    case 'blob': return new Blob([fromBase64(String((value as { v: unknown }).v))], { type: String((value as { m?: unknown }).m ?? '') });
    case 'array': {
      const items = (value as { v: unknown }).v;
      if (!Array.isArray(items)) throw new Error('Invalid stored array.');
      return items.map(decodeValue);
    }
    case 'object': {
      const entries = (value as { v: unknown }).v;
      if (!entries || typeof entries !== 'object' || Array.isArray(entries)) throw new Error('Invalid stored object.');
      return Object.fromEntries(Object.entries(entries).map(([key, item]) => [key, decodeValue(item)]));
    }
    case 'map': {
      const entries = (value as { v: unknown }).v;
      if (!Array.isArray(entries)) throw new Error('Invalid stored map.');
      return new Map(entries.map((pair) => [decodeValue(pair[0]), decodeValue(pair[1])]));
    }
    case 'set': {
      const items = (value as { v: unknown }).v;
      if (!Array.isArray(items)) throw new Error('Invalid stored set.');
      return new Set(items.map(decodeValue));
    }
    default:
      throw new Error('Unknown stored value type.');
  }
}

function openDatabase(name: string, version?: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = version === undefined ? indexedDB.open(name) : indexedDB.open(name, version);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open IndexedDB.'));
    req.onblocked = () => reject(new Error('Another tab is blocking this game’s database.'));
  });
}

export async function listDatabases(): Promise<string[]> {
  if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') return [];
  try {
    const databases = await indexedDB.databases();
    return databases.map((db) => db.name).filter((name): name is string => Boolean(name));
  } catch {
    return [];
  }
}

function closeDatabase(db: IDBDatabase): void {
  try { db.close(); } catch { /* already closed */ }
}

/** Dump a single database including schema, keys and binary values. */
export async function dumpDatabase(name: string): Promise<SerializedDatabase | null> {
  let db: IDBDatabase;
  try {
    db = await openDatabase(name);
  } catch {
    return null;
  }
  try {
    const version = db.version;
    const stores: SerializedStore[] = [];
    for (const storeName of Array.from(db.objectStoreNames)) {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const indexes: SerializedIndex[] = Array.from(store.indexNames).map((indexName) => {
        const index = store.index(indexName);
        return { name: index.name, keyPath: index.keyPath as string | string[] | null, unique: index.unique, multiEntry: index.multiEntry };
      });
      // The cursor must be advanced synchronously inside onsuccess: awaiting
      // anything first lets the read transaction auto-commit, which throws
      // TransactionInactiveError on the next continue(). So raw records are
      // collected first and encoded afterwards.
      const raw: { key: IDBValidKey; value: unknown }[] = [];
      const req = store.openCursor();
      await new Promise<void>((resolve, reject) => {
        req.onerror = () => reject(req.error ?? new Error('Could not read IndexedDB records.'));
        req.onsuccess = () => {
          const cursor = req.result;
          if (!cursor) { resolve(); return; }
          raw.push({ key: cursor.primaryKey, value: cursor.value });
          cursor.continue();
        };
      });
      const records: SerializedRecord[] = [];
      for (const record of raw) {
        records.push({ key: await encodeValue(record.key), value: await encodeValue(record.value) });
      }
      stores.push({
        name: storeName,
        keyPath: store.keyPath as string | string[] | null,
        autoIncrement: store.autoIncrement,
        indexes,
        records,
      });
    }
    return { name, version, stores };
  } finally {
    closeDatabase(db);
  }
}

/**
 * Delete one database. A blocked or failed delete rejects: treating it as
 * success would silently report isolation or a restore that never happened.
 */
export function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error(`Could not replace the ${name} database.`));
    req.onblocked = () => reject(new Error('Close other tabs of this game, then retry.'));
  });
}

/** Recreate a database exactly: same version, stores, indexes, keys, values. */
export async function restoreDatabase(spec: SerializedDatabase): Promise<void> {
  if (!spec || typeof spec.name !== 'string' || !Number.isInteger(spec.version) || !Array.isArray(spec.stores)) {
    throw new Error('Invalid stored database description.');
  }
  // Replacing the database is the only way to guarantee the saved schema
  // wins over a newer local default schema.
  await deleteDatabase(spec.name);
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(spec.name, spec.version);
    req.onupgradeneeded = () => {
      const target = req.result;
      for (const store of spec.stores) {
        const created = target.createObjectStore(store.name, {
          keyPath: store.keyPath ?? undefined,
          autoIncrement: store.autoIncrement,
        });
        for (const index of store.indexes) {
          created.createIndex(index.name, index.keyPath as string | string[], { unique: index.unique, multiEntry: index.multiEntry });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not restore this game’s database.'));
    req.onblocked = () => reject(new Error('Close other tabs of this game, then retry the restore.'));
  });
  try {
    for (const store of spec.stores) {
      if (!store.records.length) continue;
      const tx = db.transaction(store.name, 'readwrite');
      const target = tx.objectStore(store.name);
      for (const record of store.records) {
        const value = decodeValue(record.value);
        if (store.keyPath === null) {
          const key = decodeValue(record.key) as IDBValidKey;
          target.put(value, key);
        } else {
          target.put(value);
        }
      }
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Could not write restored records.'));
        tx.onabort = () => reject(tx.error ?? new Error('Restore was aborted.'));
      });
    }
  } finally {
    closeDatabase(db);
  }
}

export function isSerializedDatabase(value: unknown): value is SerializedDatabase {
  if (!value || typeof value !== 'object') return false;
  const db = value as Partial<SerializedDatabase>;
  if (typeof db.name !== 'string' || !Number.isInteger(db.version) || !Array.isArray(db.stores)) return false;
  return db.stores.every((store) => Boolean(store)
    && typeof store.name === 'string'
    && Array.isArray(store.records)
    && Array.isArray(store.indexes));
}
