import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { beforeEach, test } from 'node:test';
import { build } from 'esbuild';

const { outputFiles: [{ text }] } = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: "export { createSaveSession, saveRemote } from './src/lib/cloudSaves.ts'; export { adapterFor, readKnownDeviceSaves } from './src/lib/saveAdapters.ts'; export { readCloudSaveArchive, readDevicePreferences } from './src/lib/saveTransfer.ts';",
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
        contents: "export const T = { saves: 'geegle_game_saves' }; export const supabase = { from: (...args) => globalThis.fakeSupabase.from(...args), auth: { getSession: async () => ({ data: { session: globalThis.fakeSession }, error: null }) } }; export const isSupabaseConfigured = false;",
      }));
    },
  }],
});
const { adapterFor, readKnownDeviceSaves, createSaveSession, saveRemote, readCloudSaveArchive, readDevicePreferences } = await import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`);
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
  };
}

let network;
beforeEach(() => {
  globalThis.localStorage = storage();
  globalThis.fakeSession = { user: { id: user }, access_token: 'original-account-token' };
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
      if (id) assert.deepEqual(spec.capture(id)?.localStorage, Object.fromEntries(keys.map((k) => [k, id])));
    }
    for (const k of keys) assert.equal(localStorage.getItem(k), 'guest');
  }
  assert.equal(adapterFor(game, '/games/clohflip.html'), null);
  assert.equal(adapterFor('untested', '/games/untested.html'), null);
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

test('when both schemas are unavailable local data stays intact', async (t) => {
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

test('an explicit legacy copy leaves the original and other accounts untouched', async (t) => {
  const handle = session(t, backend());
  localStorage.setItem('spacebar_clicker_game', 'original');
  localStorage.setItem(key(other), 'other');
  await handle.restored;
  assert.equal(handle.canImportLegacy(), true);
  assert.equal(localStorage.getItem(key()), null);
  assert.equal((await handle.importLegacy()).ok, true);
  assert.equal(localStorage.getItem(key()), 'original');
  assert.equal(localStorage.getItem('spacebar_clicker_game'), 'original');
  assert.equal(localStorage.getItem(key(other)), 'other');
  assert.equal((await handle.importLegacy()).ok, false);
});

test('legacy copying refuses a newly created cloud save', async (t) => {
  const cloud = backend();
  const handle = session(t, cloud);
  localStorage.setItem('spacebar_clicker_game', 'unassigned');
  await handle.restored;
  cloud.replace(snapshot('remote'));
  assert.equal((await handle.importLegacy()).ok, false);
  assert.equal(handle.getStatus(), 'conflict');
  assert.equal(localStorage.getItem(key()), null);
  assert.deepEqual((await cloud.read()).save_data, snapshot('remote'));
});

function mockSaveApi({ migrated = false, initial = null, readError, writeError } = {}) {
  let row = initial;
  let beforeUpdate;
  const calls = [];
  globalThis.fakeSupabase = {
    from(table) {
      assert.equal(table, 'geegle_game_saves');
      let columns;
      let op = 'read';
      let values;
      let filters = {};
      let authorization;
      const q = {
        select: (args) => { columns = args; return q; },
        match: (args) => { filters = args; return q; },
        update: (args) => { op = 'update'; values = args; return q; },
        insert: (args) => { op = 'insert'; values = args; return q; },
        setHeader: (key, value) => { assert.equal(key, 'Authorization'); authorization = value; return q; },
        abortSignal: () => q,
        async maybeSingle() {
          calls.push({ columns, op, filters, authorization });
          if (readError) return { error: readError };
          if (writeError && op !== 'read') return { error: writeError };
          if (columns.includes('revision') && !migrated) return { error: { code: '42703', message: 'column geegle_game_saves.revision does not exist' } };
          if (op === 'update') {
            beforeUpdate?.();
            if (!row || (filters.updated_at && filters.updated_at !== row.updated_at)
              || (filters.revision && filters.revision !== row.revision)) return { data: null };
            row = { ...row, ...values };
          }
          if (op === 'insert') {
            if (row) return { error: { code: '23505' } };
            row = { updated_at: '2026-01-01T00:00:00.000+00:00', ...values };
          }
          return { data: row };
        },
      };
      return q;
    },
  };
  return { calls, beforeUpdate(fn) { beforeUpdate = fn; }, get: () => row, set: (value) => { row = value; } };
}
const legacyRow = (progress, updated_at = '2026-01-01T00:00:00.000+00:00') =>
  ({ updated_at, save_data: snapshot(progress) });

test('pre-migration transport restores and deduplicates existing saves; edits stay on device', async (t) => {
  const api = mockSaveApi({ initial: legacyRow('existing') });
  const handle = session(t, saveRemote(user, game));
  await handle.restored;
  assert.equal(localStorage.getItem(key()), 'existing');
  assert.equal((await handle.saveNow()).ok, true);
  localStorage.setItem(key(), 'device edits');
  const result = await handle.close();
  assert.equal(result.ok, false);
  assert.match(result.error, /requires a cloud save upgrade/i);
  assert.equal(localStorage.getItem(key()), 'device edits');
  assert.deepEqual(api.get().save_data, snapshot('existing'));
  assert.ok(api.calls.every((call) => call.op === 'read'));
});

test('pre-migration first insert works and concurrent first inserts cannot overwrite it', async () => {
  const api = mockSaveApi();
  const first = saveRemote(user, game);
  const second = saveRemote(user, game);
  assert.equal(await first.read(), null);
  assert.equal(await second.read(), null);
  assert.ok((await first.write(snapshot('first'), null)).startsWith('legacy:'));
  assert.equal(await second.write(snapshot('second'), null), null);
  assert.deepEqual(api.get().save_data, snapshot('first'));
});

test('migrated transport updates only the observed revision', async () => {
  const api = mockSaveApi({ migrated: true, initial: { ...legacyRow('existing'), revision: 'r1' } });
  const remote = saveRemote(user, game);
  const original = await remote.read();
  api.beforeUpdate(() => api.set({ ...legacyRow('concurrent device'), revision: 'r2' }));
  assert.equal(await remote.write(snapshot('stale replacement'), original.revision), null);
  assert.deepEqual(api.get().save_data, snapshot('concurrent device'));
  assert.equal(api.calls.find((call) => call.op === 'update').filters.revision, 'r1');
});

test('missing-column fallback never hides unrelated backend errors', async () => {
  const api = mockSaveApi({ readError: { code: '42501', message: 'not authorized' } });
  await assert.rejects(saveRemote(user, game).read(), /not authorized/);
  assert.equal(api.calls.length, 1);
});

test('cloud archive reads unsupported v3 rows verbatim under the active account', async () => {
  const v3 = { format: 'v3', indexedDB: [{ name: 'legacy' }], localStorage: {} };
  let last;
  const row = { id: 'row-1', game_id: 'other-game', save_key: 'default', save_data: v3 };
  globalThis.fakeSupabase = {
    from(table) {
      assert.equal(table, 'geegle_game_saves');
      const q = {
        select: () => q,
        eq: (name, id) => { assert.equal(name, 'user_id'); assert.equal(id, user); return q; },
        order: () => q,
        limit: () => q,
        gt: (name, id) => { assert.equal(name, 'id'); last = id; return q; },
        abortSignal: async () => ({ data: last ? [] : [row] }),
      };
      return q;
    },
  };
  assert.deepEqual(await readCloudSaveArchive(user), [row]);
  assert.equal(last, 'row-1');
});

test('device preference export does not consume or attribute guest values', async () => {
  localStorage.setItem('geegle-favorites', '["guest-favorite"]');
  localStorage.setItem('geegle-recently-played', '["guest-recent"]');
  localStorage.setItem('geegle-theme', 'dark');
  localStorage.setItem('geegle-default-servers', '{"cherry":2}');
  const device = await readDevicePreferences();
  assert.deepEqual(device, { favorites: ['guest-favorite'], recentlyPlayed: ['guest-recent'], theme: 'dark', serverDefaults: { cherry: 2 } });
  assert.deepEqual(await readDevicePreferences(), device);
});

test('device save archive includes only known keys and the selected account', () => {
  localStorage.setItem('spacebar_clicker_game', 'unassigned');
  localStorage.setItem('geegle-auth-session', 'not a game save');
  localStorage.setItem(key(user), 'ours');
  localStorage.setItem(key(other), 'someone else');
  assert.deepEqual(readKnownDeviceSaves(user), [{
    gameId: game, unassigned: snapshot('unassigned'), account: snapshot('ours'),
  }]);
});

test('a legacy writer between preflight and update cannot lose same-timestamp progress', async () => {
  const api = mockSaveApi({ initial: legacyRow('original') });
  const remote = saveRemote(user, game);
  const original = await remote.read();
  const concurrent = legacyRow('legacy writer kept its timestamp');
  let concurrentWriteRan = false;
  const legacyWrite = () => {
    concurrentWriteRan = true;
    api.set(concurrent);
  };
  api.beforeUpdate(legacyWrite);

  const result = await remote.write(snapshot('stale replacement'), original.revision)
    .catch((error) => error.message);
  if (!concurrentWriteRan) legacyWrite();
  assert.deepEqual(api.get().save_data, concurrent.save_data);
  assert.match(result ?? '', /requires a cloud save upgrade/i);
  assert.equal(api.calls.some((call) => call.op === 'update'), false);
});

for (const event of ['sign-out', 'account-switch']) {
  test(`external ${event} finishes the outgoing save even if the player unmounts immediately`, async (t) => {
    const backend = mockSaveApi({ migrated: true, initial: { ...legacyRow('before'), revision: 'r1' } });
    localStorage.setItem(key(other), 'progress in different account');
    const active = session(t, saveRemote(user, game));
    await active.restored;
    localStorage.setItem(key(), 'last change in the original account');
    globalThis.fakeSession = event === 'sign-out' ? null : { user: { id: other }, access_token: 'different-account-token' };
    const closing = active.retire();
    const disposing = active.dispose();
    assert.equal((await closing).ok, true);
    await disposing;
    const writes = backend.calls.filter((call) => call.op === 'update');
    assert.equal(writes.length, 1);
    assert.equal(writes[0].authorization, 'Bearer original-account-token');
    assert.equal(writes[0].filters.user_id, user);
    assert.deepEqual(backend.get().save_data, snapshot('last change in the original account'));
    assert.equal(localStorage.getItem(key(other)), 'progress in different account');
  });
}

test('revoked outgoing token leaves progress on the device without retrying as the new user', async (t) => {
  const api = mockSaveApi({ migrated: true, initial: { ...legacyRow('before'), revision: 'r1' }, writeError: { message: 'Session revoked' } });
  const handle = session(t, saveRemote(user, game));
  await handle.restored;
  localStorage.setItem(key(), 'saved locally');
  globalThis.fakeSession = { user: { id: other }, access_token: 'different-account-token' };
  const closing = handle.retire();
  await handle.dispose();
  assert.deepEqual(await closing, { ok: false, error: 'Session revoked' });
  assert.equal(localStorage.getItem(key()), 'saved locally');
  assert.equal(localStorage.getItem(key(other)), null);
  assert.deepEqual(api.get().save_data, snapshot('before'));
  assert.ok(api.calls.every((call) => call.authorization === 'Bearer original-account-token'));
});
