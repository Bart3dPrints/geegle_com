import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { beforeEach, test } from 'node:test';
import { build } from 'esbuild';

const { outputFiles: [{ text }] } = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: "export { createSaveSession } from './src/lib/cloudSaves.ts'; export { adapterFor } from './src/lib/saveAdapters.ts';",
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  plugins: [{
    name: 'no-backend',
    setup(builder) {
      builder.onResolve({ filter: /^\.\/supabase$/ }, () => ({ path: 'supabase', namespace: 'stub' }));
      builder.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
        contents: "export const T = {}; export const supabase = null; export const isSupabaseConfigured = false;",
      }));
    },
  }],
});
const { adapterFor, createSaveSession } = await import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`);
const user = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const game = 'clspacebarclicker';
const path = '/games/clspacebarclicker.html';
const adapter = adapterFor(game, path);
const key = (id = user) => `geegle-game:${game}:${id}:spacebar_clicker_game`;
const snapshot = (progress) => ({
  format: 'geegle-storage-v3',
  gameId: game,
  localStorage: { spacebar_clicker_game: progress },
  indexedDB: [],
});

function storage() {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    key: (index) => [...data.keys()][index] ?? null,
    get length() { return data.size; },
  };
}

let network;
beforeEach(() => {
  globalThis.localStorage = storage();
  network = { onLine: true };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: network });
});

function backend(initial = null) {
  let row = initial && { revision: '0', save_data: initial };
  let version = 0;
  const service = {
    read: async () => row,
    write: async (value, revision) => {
      if ((row?.revision ?? null) !== revision) return null;
      service.replace(value);
      return row.revision;
    },
    replace(value) { row = { revision: String(++version), save_data: value }; },
  };
  return service;
}

function session(t, remote, userId = user) {
  const handle = createSaveSession(game, userId, adapter, remote);
  t.after(() => handle.dispose());
  return handle;
}

test('each supported HTML game uses exactly the keys used by its adapter', async () => {
  for (const [gameId, file, keys] of [
    ['clspacebarclicker', 'clspacebarclicker.html', ['spacebar_clicker_game']],
    ['clquantumclicker', 'clQuantumClicker.html', ['qcSave']],
    ['clohflip', 'clohflip.html', ['ohflip.goalIdx', 'ohflip.maxHeightFt', 'ohflip.maxTotalFlips']],
  ]) {
    const html = await readFile(new URL(`../public/games/${file}`, import.meta.url), 'utf8');
    const helper = html.match(/function geegleSaveKey\(key\) \{[\s\S]*?\r?\n\}/)?.[0];
    const spec = adapterFor(gameId, `/games/${file}`);
    for (const id of [user, other, null]) {
      const search = id ? new URL(spec.launchPath(id), 'https://geegle.test').search : '';
      for (const k of keys) {
        const scoped = runInNewContext(`${helper}; geegleSaveKey(key)`, { URLSearchParams, location: { search }, key: k });
        localStorage.setItem(scoped, id ?? 'guest');
      }
      if (id) assert.deepEqual((await spec.capture(id))?.localStorage, Object.fromEntries(keys.map((k) => [k, id])));
    }
    for (const k of keys) assert.equal(localStorage.getItem(k), 'guest');
  }
  // A game with no stored progress yet captures nothing (empty-save protection).
  assert.equal(await adapterFor('cluntouchedgame', '/games/cluntouchedgame.html').capture(user), null);
  assert.equal(adapterFor('untested', 'https://example.com/game.html'), null);
});

test('every local game gets generic storage-based cloud saves', async () => {
  const spec = adapterFor('clsomeadventure', '/games/clsomeadventure.html');
  assert.ok(spec);
  assert.match(spec.launchPath(user), /geegle_profile=/);
  // The shim namespaces game keys per account; capture reads only this account.
  localStorage.setItem(`geegle-game:clsomeadventure:${user}:slot1`, 'level 7');
  localStorage.setItem(`geegle-game:clsomeadventure:${other}:slot1`, 'level 2');
  localStorage.setItem('geegle-game:clothergame:' + user + ':x', 'other game');
  const snapshot = await spec.capture(user);
  assert.deepEqual(snapshot, {
    format: 'geegle-storage-v3',
    gameId: 'clsomeadventure',
    localStorage: { slot1: 'level 7' },
    indexedDB: [],
  });
  assert.equal(await spec.capture(other).then((s) => s.localStorage.slot1), 'level 2');
  assert.equal(await adapterFor('clsomeadventure', '/games/clsomeadventure.html').capture('cccccccc-cccc-cccc-cccc-cccccccccccc'), null);

  // Restore is authoritative for this account and never touches others.
  await spec.restore(user, { format: 'geegle-storage-v3', gameId: 'clsomeadventure', localStorage: { slot1: 'level 9' }, indexedDB: [] });
  assert.equal(localStorage.getItem(`geegle-game:clsomeadventure:${user}:slot1`), 'level 9');
  assert.equal(localStorage.getItem(`geegle-game:clsomeadventure:${other}:slot1`), 'level 2');
  assert.equal(localStorage.getItem(`geegle-game:clothergame:${user}:x`), 'other game');

  // A stored save can never overwrite platform state.
  assert.throws(() => spec.validate({ format: 'geegle-storage-v3', gameId: 'clsomeadventure', localStorage: { 'geegle-favorites': '[]' } }, user), /reserved/);
  assert.throws(() => spec.validate({ format: 'geegle-storage-v3', gameId: 'clsomeadventure', localStorage: { slot1: 5 } }, user), /Invalid/);
  assert.throws(() => spec.validate({ format: 'v3', localStorage: { slot1: 'x' } }, user), /Unrecognized/);
  assert.deepEqual(
    spec.validate({ format: 'geegle-storage-v3', gameId: 'clsomeadventure', localStorage: {}, indexedDB: [] }, user),
    { format: 'geegle-storage-v3', gameId: 'clsomeadventure', localStorage: {}, indexedDB: [] },
  );
});

test('restore from cloud before a game opens with empty browser storage', async (t) => {
  const cloud = backend(snapshot('known progress'));
  const handle = session(t, cloud);
  await handle.restored;
  assert.equal(handle.getStatus(), 'restored');
  assert.equal(localStorage.getItem(key()), 'known progress');
  assert.equal(localStorage.getItem(key(other)), null);
  await handle.close();
  assert.equal(localStorage.getItem(key()), 'known progress');
});

test('guest progress and another account’s local saves are never uploaded', async (t) => {
  localStorage.setItem('spacebar_clicker_game', 'guest');
  localStorage.setItem(key(other), 'another user');
  const cloud = backend();
  const handle = session(t, cloud);
  await handle.restored;
  assert.deepEqual(await handle.saveNow(), { ok: true });
  assert.equal(await cloud.read(), null);
  assert.equal(localStorage.getItem(key(other)), 'another user');
});

test('an unsuccessful restore never authorizes a write', async (t) => {
  const cloud = backend({ ...snapshot('bad'), indexedDB: [{ name: 'legacy', version: 1, stores: [] }] });
  const handle = session(t, cloud);
  await handle.restored;
  assert.equal(handle.getStatus(), 'error');
  localStorage.setItem(key(), 'initialized defaults');
  assert.equal((await handle.saveNow()).ok, false);
  assert.deepEqual((await cloud.read()).save_data.indexedDB, [{ name: 'legacy', version: 1, stores: [] }]);
});

test('failed first restore can be retried explicitly', async (t) => {
  const cloud = backend(snapshot('safe'));
  const read = cloud.read;
  cloud.read = async () => { throw new Error('unavailable'); };
  const handle = session(t, cloud);
  await handle.restored;
  localStorage.setItem(key(), 'default');
  assert.equal((await handle.saveNow()).ok, false);
  cloud.read = read;
  assert.deepEqual(await handle.restore(), { ok: true, restored: true });
  assert.equal(localStorage.getItem(key()), 'safe');
  assert.equal((await handle.saveNow()).ok, true);
});

test('offline progress retries on reconnection and remains on this device', async (t) => {
  const cloud = backend(snapshot('before'));
  const handle = session(t, cloud);
  await handle.restored;
  network.onLine = false;
  localStorage.setItem(key(), 'offline progress');
  assert.equal((await handle.saveNow()).ok, false);
  assert.equal(handle.getStatus(), 'offline');
  assert.equal(localStorage.getItem(key()), 'offline progress');
  network.onLine = true;
  assert.equal((await handle.saveNow()).ok, true);
  assert.deepEqual((await cloud.read()).save_data, snapshot('offline progress'));
});

test('latest cloud progress is pulled if this device has not changed', async (t) => {
  const cloud = backend(snapshot('first'));
  const first = session(t, cloud);
  await first.restored;
  await first.close();
  cloud.replace(snapshot('newer'));
  const next = session(t, cloud);
  await next.restored;
  assert.equal(localStorage.getItem(key()), 'newer');
  assert.equal(next.getStatus(), 'restored');
});

test('cloud and local edits conflict without overwriting either side', async (t) => {
  const cloud = backend(snapshot('first'));
  const handle = session(t, cloud);
  await handle.restored;
  localStorage.setItem(key(), 'our edit');
  cloud.replace(snapshot('other device'));
  assert.equal((await handle.saveNow()).ok, false);
  assert.equal(handle.getStatus(), 'conflict');
  assert.equal(localStorage.getItem(key()), 'our edit');
  assert.deepEqual((await cloud.read()).save_data, snapshot('other device'));
  cloud.replace(snapshot('third edit'));
  assert.equal((await handle.keepLocal()).ok, false);
  assert.deepEqual((await cloud.read()).save_data, snapshot('third edit'));
  assert.equal((await handle.keepLocal()).ok, true);
  assert.deepEqual((await cloud.read()).save_data, snapshot('our edit'));
});

test('a first-save race is treated as a conflict, not an upsert', async (t) => {
  const cloud = backend();
  const handle = session(t, cloud);
  await handle.restored;
  localStorage.setItem(key(), 'current');
  cloud.replace(snapshot('another device saved first'));
  assert.equal((await handle.saveNow()).ok, false);
  assert.equal(handle.getStatus(), 'conflict');
  assert.deepEqual((await cloud.read()).save_data, snapshot('another device saved first'));
});

test('exit captures newer progress after waiting for an in-flight upload', async (t) => {
  const cloud = backend();
  const write = cloud.write;
  let notify;
  let unblock;
  const writing = new Promise((resolve) => { notify = resolve; });
  const paused = new Promise((resolve) => { unblock = resolve; });
  cloud.write = async (...args) => {
    notify();
    await paused;
    return write(...args);
  };
  const handle = session(t, cloud);
  await handle.restored;
  localStorage.setItem(key(), 'first update');
  const syncing = handle.saveNow();
  await writing;
  localStorage.setItem(key(), 'last update');
  const closing = handle.close();
  unblock();
  await syncing;
  assert.equal((await closing).ok, true);
  assert.deepEqual((await cloud.read()).save_data, snapshot('last update'));
});

test('missing migration fails closed with local data intact', async (t) => {
  const cloud = backend();
  cloud.read = async () => { throw new Error('column geegle_game_saves.revision does not exist'); };
  const handle = session(t, cloud);
  await handle.restored;
  localStorage.setItem(key(), 'device progress');
  assert.equal(handle.getStatus(), 'error');
  assert.equal((await handle.close()).ok, false);
  assert.equal(localStorage.getItem(key()), 'device progress');
});

test('an offline initial launch can resume without overwriting a remote save', async (t) => {
  const cloud = backend(snapshot('remote progress'));
  const read = cloud.read;
  network.onLine = false;
  cloud.read = async () => { throw new Error('offline'); };
  const handle = session(t, cloud);
  await handle.restored;
  localStorage.setItem(key(), 'device progress');
  network.onLine = true;
  cloud.read = read;
  assert.equal((await handle.saveNow()).ok, false);
  assert.equal(handle.getStatus(), 'conflict');
  assert.deepEqual((await cloud.read()).save_data, snapshot('remote progress'));
});
