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
const snapshot = (progress) => ({ format: 'geegle-local-v1', localStorage: { spacebar_clicker_game: progress } });

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

// Minimal shim harness: loads the real shim file with a fake location and
// localStorage, then returns the installed localStorage view plus the
// underlying store, so isolation defects are tested against the shipping code.
async function loadShim(gameId, profileId) {
  const source = await readFile(new URL('../public/games/geegle-storage-shim.js', import.meta.url), 'utf8');
  const backing = storage();
  const context = {
    URLSearchParams,
    location: { search: profileId ? `?geegle_profile=${profileId}` : '', pathname: `/games/${gameId}.html` },
    document: { currentScript: { getAttribute: () => gameId } },
    localStorage: backing,
    Proxy,
    Object,
    String,
    window: {},
  };
  context.window.localStorage = backing;
  context.window.Proxy = Proxy;
  context.window.Object = Object;
  runInNewContext(source, context);
  return { view: context.window.localStorage, backing };
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
  assert.deepEqual(snapshot, { format: 'geegle-storage-v2', localStorage: { slot1: 'level 7' }, indexedDB: [] });
  assert.equal(await spec.capture(other).then((s) => s.localStorage.slot1), 'level 2');
  assert.equal(await adapterFor('clsomeadventure', '/games/clsomeadventure.html').capture('cccccccc-cccc-cccc-cccc-cccccccccccc'), null);

  // Restore is authoritative for this account and never touches others.
  await spec.restore(user, { format: 'geegle-storage-v2', localStorage: { slot1: 'level 9' }, indexedDB: [] });
  assert.equal(localStorage.getItem(`geegle-game:clsomeadventure:${user}:slot1`), 'level 9');
  assert.equal(localStorage.getItem(`geegle-game:clsomeadventure:${other}:slot1`), 'level 2');
  assert.equal(localStorage.getItem('geegle-game:clothergame:' + user + ':x'), 'other game');

  // A stored save can never overwrite platform state.
  assert.throws(() => spec.validate({ format: 'geegle-storage-v2', localStorage: { 'geegle-favorites': '[]' } }), /reserved/);
  assert.throws(() => spec.validate({ format: 'geegle-storage-v2', localStorage: { slot1: 5 } }), /Invalid/);
  assert.throws(() => spec.validate({ format: 'v3', localStorage: { slot1: 'x' } }), /Unrecognized/);
  assert.deepEqual(spec.validate({ format: 'geegle-storage-v2', localStorage: {}, indexedDB: [] }), { format: 'geegle-storage-v2', localStorage: {}, indexedDB: [] });
});

// ─── Storage shim isolation (audited defect regressions) ───────────────────

test('legacy pre-shim progress is claimed once and never leaks to a second account', async () => {
  // Account A opens the game first: legacy key migrates into A's namespace.
  const a = await loadShim('cllegacy', user);
  a.backing.setItem('saveSlot', 'original progress');
  assert.equal(a.view.getItem('saveSlot'), 'original progress');
  assert.equal(a.backing.getItem(`geegle-game:cllegacy:${user}:saveSlot`), 'original progress');

  // Account B later opens the same game: the same legacy key must NOT be
  // copied into B's namespace (the earlier defect migrated progress into
  // every account that ever read it).
  const b = await loadShim('cllegacy', other);
  assert.equal(b.view.getItem('saveSlot'), null);
  assert.equal(b.backing.getItem(`geegle-game:cllegacy:${other}:saveSlot`), null);
  // The legacy value itself is preserved for A.
  assert.equal(a.backing.getItem('saveSlot'), 'original progress');
});

test('shim removeItem and clear only touch the current game+account keys', async () => {
  const s = await loadShim('clescoped', user);
  s.backing.setItem(`geegle-game:clescoped:${user}:mine`, 'mine');
  s.backing.setItem(`geegle-game:clescoped:${other}:theirs`, 'theirs');
  s.backing.setItem('geegle-favorites', 'platform state');
  s.backing.setItem('unscoped-key', 'guest progress');

  s.view.removeItem('mine');
  // The old implementation ALSO removed the unscoped key 'mine'; it must be
  // untouched when absent, and platform/foreign keys must never be removed.
  assert.equal(s.backing.getItem(`geegle-game:clescoped:${other}:theirs`), 'theirs');
  assert.equal(s.backing.getItem('geegle-favorites'), 'platform state');

  s.view.clear();
  assert.equal(s.backing.getItem(`geegle-game:clescoped:${user}:mine`), null);
  assert.equal(s.backing.getItem(`geegle-game:clescoped:${other}:theirs`), 'theirs');
  assert.equal(s.backing.getItem('geegle-favorites'), 'platform state');
  assert.equal(s.backing.getItem('unscoped-key'), 'guest progress');
});

test('shim supports property-style access like real Storage', async () => {
  const s = await loadShim('clpropaccess', user);
  s.view.score = '42';
  assert.equal(s.view.score, '42');
  assert.equal(s.view.getItem('score'), '42');
  assert.equal(s.backing.getItem(`geegle-game:clpropaccess:${user}:score`), '42');

  // Another account's property writes are isolated.
  const b = await loadShim('clpropaccess', other);
  b.view.score = '99';
  assert.equal(s.view.score, '42');
  assert.equal(b.view.score, '99');

  assert.ok('score' in b.view);
  delete b.view.score;
  assert.equal(b.view.score, undefined);
  assert.equal(s.view.score, '42');
});

test('shim key() and length enumerate only this account’s keys', async () => {
  const s = await loadShim('clenum', user);
  s.view.setItem('alpha', '1');
  s.view.setItem('beta', '2');
  s.backing.setItem(`geegle-game:clenum:${other}:gamma`, '3');
  s.backing.setItem('unrelated', '4');
  assert.equal(s.view.length, 2);
  const keys = [s.view.key(0), s.view.key(1)];
  assert.ok(keys.includes('alpha') && keys.includes('beta'));
  assert.equal(s.view.key(2), null);
});

test('guests are untouched by the shim', async () => {
  const guest = await loadShim('clguestgame', null);
  guest.backing.setItem('saveSlot', 'guest progress');
  // No profile parameter: the shim returns early and localStorage stays native.
  assert.equal(guest.view, guest.backing);
});

// ─── Adapter isolation failures are never silent (audited defect #5) ──────

test('isolate reports database deletion failures instead of silently succeeding', async () => {
  const spec = adapterFor('clisolation', '/games/clisolation.html');
  // Simulate a previously recorded owner plus a claimed database.
  localStorage.setItem('geegle-idb-owner:clisolation', other);
  localStorage.setItem('geegle-idb:clisolation', JSON.stringify(['/idbfs/clisolation']));

  // Fake indexedDB whose deleteDatabase never succeeds (blocked).
  let blockedRequest;
  const fakeIdb = {
    databases: async () => [{ name: '/idbfs/clisolation' }],
    deleteDatabase: (name) => {
      blockedRequest = {
        onsuccess: null, onerror: null, onblocked: null,
        error: new Error(`blocked: ${name}`),
      };
      setTimeout(() => blockedRequest.onblocked?.(), 0);
      return blockedRequest;
    },
  };
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: fakeIdb });

  try {
    await assert.rejects(() => spec.isolate(user), /Close other tabs|blocked|Could not/i);
  } finally {
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: undefined });
  }
});

test('restore refuses to overwrite a database owned by another game', async () => {
  const spec = adapterFor('clownercheck', '/games/clownercheck.html');
  // The ledger says another game owns this database.
  localStorage.setItem('geegle-idb-owners', JSON.stringify({ '/idbfs/other-game': 'clothergame' }));
  await assert.rejects(
    () => spec.restore(user, {
      format: 'geegle-storage-v2',
      localStorage: {},
      indexedDB: [{ name: '/idbfs/other-game', version: 1, stores: [{ name: 's', keyPath: 'id', autoIncrement: false, indexes: [], records: [] }] }],
    }),
    /owned by another game/,
  );
});

test('restore before a game opens with empty browser storage', async (t) => {
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
  const cloud = backend({ ...snapshot('bad'), indexedDB: [{ name: 'legacy' }] });
  const handle = session(t, cloud);
  await handle.restored;
  assert.equal(handle.getStatus(), 'error');
  localStorage.setItem(key(), 'initialized defaults');
  assert.equal((await handle.saveNow()).ok, false);
  assert.deepEqual((await cloud.read()).save_data.indexedDB, [{ name: 'legacy' }]);
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
