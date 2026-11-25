// Regression tests for cloud-save identity, namespace and failure handling.
//
// These cover the defects that made the previous save layer unsafe: saves were
// not tied to a game, IndexedDB restores could target unrelated databases, a
// blocked delete was treated as success, and capture guessed database
// ownership from whatever appeared during gameplay.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { build } from 'esbuild';

const { outputFiles: [{ text }] } = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: "export { adapterFor, storagePrefix } from './src/lib/saveAdapters.ts'; export { deleteDatabase } from './src/lib/storageSnapshot.ts';",
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});

const { adapterFor, storagePrefix, deleteDatabase } = await import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`);

const user = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const gameId = 'clsomegame';
const prefix = storagePrefix(gameId, user);
const spec = adapterFor(gameId, `/games/${gameId}.html`);

function storage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    key: (index) => [...data.keys()][index] ?? null,
    get length() { return data.size; },
  };
}

/** Minimal IndexedDB: only the operations the snapshot layer calls. */
function fakeIndexedDb(options = {}) {
  const names = options.names ?? [];
  const opened = [];
  return {
    opened,
    databases: async () => names.map((name) => ({ name, version: 1 })),
    open(name, version) {
      opened.push(name);
      const request = { result: { name, version: version ?? 1, objectStoreNames: [], close() {} } };
      setImmediate(() => request.onsuccess?.());
      return request;
    },
    deleteDatabase(name) {
      opened.push(`delete:${name}`);
      const request = {};
      setImmediate(() => {
        if (options.blocked) request.onblocked?.();
        else request.onsuccess?.();
      });
      return request;
    },
  };
}

beforeEach(() => {
  globalThis.localStorage = storage();
  globalThis.indexedDB = fakeIndexedDb();
});

const snapshot = (extra = {}) => ({
  format: 'geegle-storage-v3',
  gameId,
  localStorage: { slot: 'level 4' },
  indexedDB: [],
  ...extra,
});

test('a save from another game is rejected, not restored', () => {
  assert.throws(() => spec.validate({ ...snapshot(), gameId: 'clother' }, user), /different game/);
  assert.throws(() => spec.validate({ ...snapshot(), format: 'geegle-local-v1' }, user), /Unrecognized/);
  assert.deepEqual(spec.validate(snapshot(), user), snapshot());
});

test('a save cannot reference a database outside this game/account namespace', () => {
  const database = { name: 'supabase-auth', version: 1, stores: [] };
  assert.throws(() => spec.validate(snapshot({ indexedDB: [database] }), user), /does not belong/);
  const foreign = { name: storagePrefix(gameId, other) + 'saves', version: 1, stores: [] };
  assert.throws(() => spec.validate(snapshot({ indexedDB: [foreign] }), user), /does not belong/);
  assert.throws(() => spec.validate(snapshot({ indexedDB: [{ ...database, name: prefix.slice(0, -1) }] }), user), /does not belong/);
  assert.throws(() => spec.validate(snapshot({ localStorage: { 'geegle-session': 'x' } }), user), /reserved/);
  assert.throws(() => spec.validate(snapshot({ indexedDB: [{ name: prefix + 'db', version: 0, stores: [] }] }), user), /version/);
  assert.throws(() => spec.validate(snapshot({ indexedDB: [{ name: prefix + 'db', version: 1, stores: [{ name: 'a', keyPath: null, autoIncrement: false, indexes: [], records: 'x' }] }] }), user), /Invalid/);
});

test('capture reads only this account’s namespaced data', async () => {
  const plain = adapterFor(gameId, `/games/${gameId}.html`);
  localStorage.setItem(`${prefix}slot`, 'mine');
  localStorage.setItem(`${storagePrefix(gameId, other)}slot`, 'theirs');
  localStorage.setItem(`${storagePrefix('clother', user)}slot`, 'other game');
  localStorage.setItem('slot', 'unscoped legacy');
  const captured = await plain.capture(user);
  assert.deepEqual(captured.localStorage, { slot: 'mine' });
  assert.equal(captured.gameId, gameId);
  // The other account captures its own data, never this account's.
  assert.deepEqual((await plain.capture(other)).localStorage, { slot: 'theirs' });
});

test('capture ignores databases that are not this account’s', async () => {
  globalThis.indexedDB = fakeIndexedDb({ names: [`${prefix}db`, 'supabase-auth', `${storagePrefix(gameId, other)}db`] });
  const captured = await adapterFor(gameId, `/games/${gameId}.html`).capture(user);
  // The empty database has no stores, so there is nothing to upload yet.
  assert.equal(captured, null);
  assert.deepEqual(globalThis.indexedDB.opened, [`${prefix}db`]);
});

test('a blocked database delete fails the restore instead of reporting success', async () => {
  globalThis.indexedDB = fakeIndexedDb({ names: [`${prefix}old`], blocked: true });
  const database = { name: `${prefix}old`, version: 1, stores: [{ name: 's', keyPath: 'id', autoIncrement: false, indexes: [], records: [] }] };
  await assert.rejects(
    () => adapterFor(gameId, `/games/${gameId}.html`).restore(user, snapshot({
      localStorage: { slot: 'cloud' },
      indexedDB: [database],
    })),
    /Close other tabs/,
  );
  // Nothing was written over the device’s progress.
  assert.equal(localStorage.getItem(`${prefix}slot`), null);
  // The delete helper surfaces the same blocked state instead of resolving.
  assert.equal(await deleteDatabase(`${prefix}missing`).then(() => 'ok', () => 'blocked'), 'blocked');
});

test('restore replaces this account’s databases and never touches foreign ones', async () => {
  const idb = fakeIndexedDb({ names: [`${prefix}saves`, `${prefix}stale`, 'supabase-auth'] });
  globalThis.indexedDB = idb;
  const database = {
    name: `${prefix}saves`,
    version: 2,
    stores: [{ name: 'progress', keyPath: 'id', autoIncrement: false, indexes: [], records: [] }],
  };
  // Restoring into an empty store list is still a real restore of the schema.
  await adapterFor(gameId, `/games/${gameId}.html`).restore(user, snapshot({ indexedDB: [database] }));
  assert.ok(idb.opened.includes(`delete:${prefix}saves`));
  assert.ok(idb.opened.includes(`delete:${prefix}stale`));
  assert.ok(!idb.opened.some((name) => name.includes('supabase')));
  assert.equal(localStorage.getItem(`${prefix}slot`), 'level 4');
});

test('an empty database list protects existing progress', async () => {
  const idb = fakeIndexedDb({ names: [`${prefix}saves`] });
  globalThis.indexedDB = idb;
  await adapterFor(gameId, `/games/${gameId}.html`).restore(user, snapshot());
  assert.deepEqual(idb.opened, []);
  assert.equal(localStorage.getItem(`${prefix}slot`), 'level 4');
});

test('isolation is structural and independent of any delete', async () => {
  await adapterFor(gameId, `/games/${gameId}.html`).isolate(user);
  // Account B’s data lives under a different prefix and is never enumerated.
  localStorage.setItem(`${storagePrefix(gameId, other)}slot`, 'theirs');
  const captured = await adapterFor(gameId, `/games/${gameId}.html`).capture(user);
  assert.equal(captured, null);
  assert.equal(localStorage.getItem(`${storagePrefix(gameId, other)}slot`), 'theirs');
});
