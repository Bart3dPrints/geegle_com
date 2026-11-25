import { recoverLegacyDatabase } from '../../src/lib/legacyRecovery';

const result = document.querySelector('#result');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const eventResult = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
const reject = async (promise) => {
  let failed = false;
  try { await promise; } catch { failed = true; }
  assert(failed, 'Invalid or cancelled recovery did not reject');
};

async function run() {
  const originName = 'live-game';
  const open = indexedDB.open(originName, 1);
  open.onupgradeneeded = () => open.result.createObjectStore('live').add('untouched', 'save');
  const live = await eventResult(open);
  const tag = (t, v) => ({ t, v });
  const fixture = {
    name: originName, version: 5, stores: [
      {
        name: 'saves', autoIncrement: true, keyPath: 'id',
        indexes: [{ name: 'slot', keyPath: 'slot', unique: true, multiEntry: false }],
        records: [{ key: tag('number', 7), value: tag('object', {
          id: tag('number', 7), slot: tag('string', 'main'),
          raw: tag('arraybuffer', 'AP8Q'),
          blob: { ...tag('blob', 'AQID'), type: 'application/octet-stream' },
          typed: { ...tag('typedarray', 'BAUG'), c: 'Uint8ClampedArray' },
          view: { ...tag('typedarray', 'Bwg='), c: 'DataView' },
        }) }],
      },
      {
        name: 'metadata', autoIncrement: false, keyPath: null, indexes: [],
        records: [{
          key: tag('array', [tag('date', '2024-01-01T00:00:00Z'), tag('arraybuffer', 'CQ==')]),
          value: tag('bigint', '9007199254740993'),
        }],
      },
    ],
  };

  let owner = 'account-a';
  const assertOwner = async () => { if (owner !== 'account-a') throw new Error('Account changed'); };
  const copy = (data, controller = new AbortController()) => recoverLegacyDatabase('account-a', 'fixture-game', data, controller.signal, assertOwner);
  const first = await copy(fixture);
  const second = await copy(fixture);
  assert(first !== second && first.startsWith('geegle-recovery:account-a:fixture-game:'), 'Unexpected recovery namespace');
  const restored = await eventResult(indexedDB.open(first));
  assert(restored.version === 5 && restored.objectStoreNames.length === 2, 'Lost schema');
  const schema = restored.transaction('saves').objectStore('saves');
  assert(schema.autoIncrement && schema.keyPath === 'id' && schema.index('slot').unique, 'Lost store or index');
  const value = await eventResult(schema.index('slot').get('main'));
  assert(value.id === 7 && new Uint8Array(value.raw).join() === '0,255,16', 'Bad binary value or inline key');
  assert(value.typed instanceof Uint8ClampedArray && value.typed.join() === '4,5,6', 'Bad typed array');
  assert(value.view instanceof DataView && value.view.getUint8(1) === 8, 'Bad DataView');
  assert(value.blob.type === 'application/octet-stream' && new Uint8Array(await value.blob.arrayBuffer()).join() === '1,2,3', 'Bad blob');
  const compound = [new Date('2024-01-01T00:00:00Z'), Uint8Array.of(9).buffer];
  assert(await eventResult(restored.transaction('metadata').objectStore('metadata').get(compound)) === 9007199254740993n, 'Lost compound key or bigint');
  restored.close();

  const before = (await indexedDB.databases()).length;
  const malformed = structuredClone(fixture);
  malformed.stores[0].records[0].key = tag('number', 8);
  await reject(copy(malformed));
  const duplicate = structuredClone(fixture);
  duplicate.stores[0].records.push(duplicate.stores[0].records[0]);
  await reject(copy(duplicate));
  const unknown = structuredClone(fixture);
  unknown.stores[0].records[0].value.v.typed.c = 'UnknownArray';
  await reject(copy(unknown));
  let controller = new AbortController();
  controller.abort();
  await reject(copy(fixture, controller));

  owner = 'account-b';
  await reject(copy(fixture));
  owner = 'account-a';
  controller = new AbortController();
  const nativeOpen = IDBFactory.prototype.open;
  IDBFactory.prototype.open = function (...args) {
    const pending = nativeOpen.apply(this, args);
    pending.addEventListener('upgradeneeded', () => {
      owner = 'account-b';
      controller.abort();
    }, { once: true });
    return pending;
  };
  try {
    await reject(copy(fixture, controller));
  } finally {
    IDBFactory.prototype.open = nativeOpen;
  }
  owner = 'account-a';
  controller = new AbortController();
  let lateAbort = false;
  IDBFactory.prototype.open = function (...args) {
    const pending = nativeOpen.apply(this, args);
    pending.addEventListener('upgradeneeded', () => {
      pending.transaction.addEventListener('complete', () => {
        lateAbort = true;
        controller.abort();
      }, { once: true });
    }, { once: true });
    return pending;
  };
  try {
    await reject(copy(fixture, controller));
  } finally {
    IDBFactory.prototype.open = nativeOpen;
  }
  assert(lateAbort, 'Did not abort after transaction commit');
  assert((await indexedDB.databases()).length === before, 'Late abort left a committed recovery copy');
  const collisionId = '11111111-1111-4111-8111-111111111111';
  const collisionName = `geegle-recovery:account-a:fixture-game:${collisionId}`;
  const existing = indexedDB.open(collisionName, 1);
  existing.onupgradeneeded = () => existing.result.createObjectStore('sentinel').add('unchanged', 1);
  (await eventResult(existing)).close();
  const nativeUuid = Crypto.prototype.randomUUID;
  Crypto.prototype.randomUUID = () => collisionId;
  try {
    await reject(copy(fixture));
  } finally {
    Crypto.prototype.randomUUID = nativeUuid;
  }
  const sameDb = await eventResult(indexedDB.open(collisionName));
  assert(sameDb.version === 1 && await eventResult(sameDb.transaction('sentinel').objectStore('sentinel').get(1)) === 'unchanged',
    'Name collision changed an existing database');
  sameDb.close();
  await eventResult(indexedDB.deleteDatabase(collisionName));

  const overRecords = structuredClone(fixture);
  overRecords.stores[0].records = Array(2501).fill(fixture.stores[0].records[0]);
  overRecords.stores[1].records = Array(2500).fill(fixture.stores[1].records[0]);
  const overPayload = structuredClone(fixture);
  const binary = { ...tag('typedarray', 'AAAA'.repeat(28_000)), c: 'Uint8Array' };
  overPayload.stores[0].records[0].value.v.typed = binary;
  overPayload.stores[0].records[0].value.v.view = binary;
  let decodeOrOpenCalls = 0;
  const nativeAtob = window.atob;
  const nativeCmp = IDBFactory.prototype.cmp;
  window.atob = (...args) => { decodeOrOpenCalls++; return nativeAtob(...args); };
  IDBFactory.prototype.cmp = function (...args) { decodeOrOpenCalls++; return nativeCmp.apply(this, args); };
  IDBFactory.prototype.open = function (...args) { decodeOrOpenCalls++; return nativeOpen.apply(this, args); };
  try {
    await reject(copy(overRecords));
    await reject(copy(overPayload));
    assert(decodeOrOpenCalls === 0, 'Oversized input reached record decoding or IndexedDB.open');
  } finally {
    window.atob = nativeAtob;
    IDBFactory.prototype.cmp = nativeCmp;
    IDBFactory.prototype.open = nativeOpen;
  }
  assert((await indexedDB.databases()).length === before, 'An invalid recovery created a database');
  assert(await eventResult(live.transaction('live').objectStore('live').get('save')) === 'untouched', 'Original game save changed');
  live.close();
  await Promise.all([first, second, originName].map((name) => eventResult(indexedDB.deleteDatabase(name))));
}

run().then(() => { result.textContent = 'PASS: schema, binary values, rollback, late abort cleanup, name collision, aggregate limits, account changes'; },
  (error) => { result.textContent = `FAIL: ${error.message}`; });
