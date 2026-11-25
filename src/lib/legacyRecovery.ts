// Recover one authenticated archive database into a separate copy, never the live game database.
const typedArrays = {
  Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array,
  Uint32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array, DataView,
};

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid v3 archive object.');
  return value as Record<string, unknown>;
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Invalid v3 archive array.');
  return value;
}

const maxPayload = 512 * 1024;
const maxNodes = 50_000;
const maxRecords = 5_000;

function enforceRecoveryLimits(dump: Record<string, unknown>) {
  let units = 0;
  let nodes = 0;
  let records = 0;
  const charge = (size: number) => {
    units += size;
    if (units > maxPayload) throw new Error('Recovery payload exceeds the 512 KiB budget.');
  };
  const visit = (value: unknown, depth: number) => {
    if (++nodes > maxNodes || depth > 128) throw new Error('Recovery payload is too complex.');
    charge(1);
    if (typeof value === 'string') {
      // Use an upper bound for UTF-8 without creating a second copy.
      charge(value.length * 3);
    } else if (Array.isArray(value)) {
      if (value.length > maxNodes - nodes) throw new Error('Recovery payload is too complex.');
      for (const entry of value) visit(entry, depth + 1);
    } else if (value && typeof value === 'object') {
      const fields = value as Record<string, unknown>;
      for (const key in fields) {
        if (!Object.prototype.hasOwnProperty.call(fields, key)) continue;
        charge(key.length * 3 + 1);
        visit(fields[key], depth + 1);
      }
    }
  };
  const stores = array(dump.stores);
  if (stores.length > maxNodes) throw new Error('Recovery payload is too complex.');
  for (const entry of stores) {
    records += array(object(entry).records).length;
    if (records > maxRecords) throw new Error('Recovery payload exceeds the 5,000 record limit.');
  }
  visit(dump, 0);
}

function string(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid v3 archive string.');
  return value;
}

function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('Invalid v3 archive flag.');
  return value;
}

function keyPath(value: unknown): string | string[] {
  return Array.isArray(value) ? value.map(string) : string(value);
}

function bytes(value: unknown): ArrayBuffer {
  return Uint8Array.from(atob(string(value)), (char) => char.charCodeAt(0)).buffer;
}

function decode(input: unknown, depth = 0): unknown {
  if (depth > 64) throw new Error('The archive exceeds the supported nesting limit.');
  const { t, v, c, type } = object(input);
  const child = (value: unknown) => decode(value, depth + 1);
  switch (t) {
    case 'null': return null;
    case 'undefined': return undefined;
    case 'boolean': return bool(v);
    case 'string': return string(v);
    case 'number':
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      break;
    case 'bigint': return BigInt(string(v));
    case 'date': {
      const date = new Date(string(v));
      if (Number.isFinite(date.getTime())) return date;
      break;
    }
    case 'arraybuffer': return bytes(v);
    case 'blob': return new Blob([bytes(v)], type === undefined ? {} : { type: string(type) });
    case 'typedarray': {
      if (typeof c !== 'string' || !Object.prototype.hasOwnProperty.call(typedArrays, c)) break;
      const View = typedArrays[c as keyof typeof typedArrays];
      return new View(bytes(v));
    }
    case 'object': return Object.fromEntries(Object.entries(object(v)).map(([key, value]) => [key, child(value)]));
    case 'array': return array(v).map(child);
    case 'set': return new Set(array(v).map(child));
    case 'map': return new Map(array(v).map((entry) => {
      const pair = array(entry);
      if (pair.length !== 2) throw new Error('Invalid v3 map entry.');
      return [child(pair[0]), child(pair[1])];
    }));
  }
  throw new Error('Unsupported or invalid v3 value.');
}

export function legacyDatabases(snapshot: unknown): unknown[] {
  if (!snapshot || typeof snapshot !== 'object' || !('format' in snapshot) || snapshot.format !== 'v3') return [];
  return 'indexedDB' in snapshot && Array.isArray(snapshot.indexedDB) ? snapshot.indexedDB : [];
}

export function databaseLabel(input: unknown) {
  if (input && typeof input === 'object' && 'name' in input && typeof input.name === 'string') return input.name;
  return 'Unnamed database';
}

export async function recoverLegacyDatabase(
  ownerId: string,
  gameId: string,
  input: unknown,
  signal: AbortSignal,
  assertOwner: () => Promise<void>,
): Promise<string> {
  signal.throwIfAborted();
  const dump = object(input);
  enforceRecoveryLimits(dump);
  string(dump.name);
  const version = dump.version;
  if (typeof version !== 'number' || !Number.isSafeInteger(version) || version <= 0) throw new Error('Invalid v3 database version.');
  const stores = array(dump.stores).map((entry) => {
    const store = object(entry);
    return {
      name: string(store.name),
      keyPath: store.keyPath === null ? null : keyPath(store.keyPath),
      autoIncrement: bool(store.autoIncrement),
      indexes: array(store.indexes).map((entry) => {
        const index = object(entry);
        return { name: string(index.name), keyPath: keyPath(index.keyPath), unique: bool(index.unique), multiEntry: bool(index.multiEntry) };
      }),
      records: array(store.records).map((entry) => {
        const record = object(entry);
        const key = decode(record.key) as IDBValidKey;
        indexedDB.cmp(key, key);
        return { key, value: decode(record.value) };
      }),
    };
  });
  await assertOwner();
  signal.throwIfAborted();
  const name = `geegle-recovery:${encodeURIComponent(ownerId)}:${encodeURIComponent(gameId)}:${crypto.randomUUID()}`;

  return new Promise<string>((resolve, reject) => {
    const request = indexedDB.open(name, version);
    let failure: unknown;
    let transaction: IDBTransaction | null = null;
    let created = false;
    let blocked = false;
    const abort = () => {
      if (!transaction) return;
      try { transaction.abort(); } catch { /* The transaction already finished. */ }
    };
    signal.addEventListener('abort', abort, { once: true });
    const cleanup = () => signal.removeEventListener('abort', abort);
    request.onblocked = () => {
      blocked = true;
      cleanup();
      reject(new Error('Recovery database name is already in use.'));
    };
    request.onerror = () => { cleanup(); reject(failure ?? request.error ?? new Error('Recovery failed.')); };
    request.onupgradeneeded = (event) => {
      transaction = request.transaction;
      if (!transaction) return;
      try {
        signal.throwIfAborted();
        if (blocked || event.oldVersion !== 0) throw new Error('Recovery never updates an existing database.');
        created = true;
        const db = request.result;
        for (const store of stores) {
          const target = db.createObjectStore(store.name, { keyPath: store.keyPath, autoIncrement: store.autoIncrement });
          for (const { name, keyPath, unique, multiEntry } of store.indexes) target.createIndex(name, keyPath, { unique, multiEntry });
          for (const { key, value } of store.records) {
            const add = store.keyPath === null ? target.add(value, key) : target.add(value);
            add.onsuccess = () => {
              if (indexedDB.cmp(add.result, key) !== 0) {
                failure = new Error('An archived record key does not match its stored value.');
                abort();
              }
            };
          }
        }
      } catch (error) {
        failure = error;
        abort();
      }
    };
    request.onsuccess = () => {
      request.result.close();
      cleanup();
      if (!created) reject(new Error('Recovery never updates an existing database.'));
      else if (signal.aborted) {
        // Only oldVersion === 0 can set created; never delete a pre-existing database.
        const removal = indexedDB.deleteDatabase(name);
        removal.onsuccess = () => reject(signal.reason);
        removal.onerror = () => reject(removal.error ?? new Error('Could not remove the cancelled recovery copy.'));
      } else resolve(name);
    };
  });
}
