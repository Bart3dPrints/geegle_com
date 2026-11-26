// Regression tests for the per-account storage shim, run in a bare VM with no
// browser. Each test covers a defect the shim exists to prevent: legacy saves
// copied into a second account, unscoped deletes, property-style access and
// un-namespaced IndexedDB.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

const source = await readFile(new URL('../public/games/geegle-storage-shim.js', import.meta.url), 'utf8');

class FakeStorage {
  #data = new Map();
  getItem(key) { return this.#data.has(String(key)) ? this.#data.get(String(key)) : null; }
  setItem(key, value) { this.#data.set(String(key), String(value)); }
  removeItem(key) { this.#data.delete(String(key)); }
  key(index) { return [...this.#data.keys()][index] ?? null; }
  get length() { return this.#data.size; }
  raw() { return Object.fromEntries(this.#data); }
}

function fakeIndexedDb(opened) {
  return {
    opened,
    open(name, version) {
      opened.push(name);
      return {
        result: {
          version: version ?? 1,
          objectStoreNames: [],
          close() {},
        },
        set onsuccess(fn) { setImmediate(fn); },
        set onerror(_fn) {},
        set onupgradeneeded(_fn) {},
        set onblocked(_fn) {},
      };
    },
    deleteDatabase(name) {
      opened.push(`delete:${name}`);
      return {
        set onsuccess(fn) { setImmediate(fn); },
        set onerror(_fn) {},
        set onblocked(_fn) {},
      };
    },
    databases: async () => [],
    cmp: () => 0,
  };
}

/** A window-like object the shim can install into. */
function makeWindow(search, shared) {
  const opened = [];
  const listeners = [];
  const win = {
    location: { search, pathname: '/games/clsomegame.html' },
    document: {
      currentScript: null,
      documentElement: {},
      addEventListener: (name, fn) => listeners.push([name, fn]),
    },
    frames: [],
    console,
    URLSearchParams,
    Object,
    Error,
    Proxy,
    String,
    encodeURIComponent,
    decodeURIComponent,
    localStorage: shared.local,
    sessionStorage: shared.session,
    indexedDB: fakeIndexedDb(opened),
  };
  win.listeners = listeners;
  win.opened = opened;
  return win;
}

function install(search, shared) {
  const win = makeWindow(search, shared);
  runInNewContext(source, { window: win, URLSearchParams, console, Object, Error, Proxy, String });
  return win;
}

function shared() {
  return { local: new FakeStorage(), session: new FakeStorage() };
}

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';

test('legacy progress is adopted once, never copied into a second account', () => {
  const store = shared();
  store.local.setItem('score', 'legacy 9000');
  store.local.setItem('geegle-favorites', '["cl2048"]');

  const first = install(`?geegle_profile=${A}`, store);
  assert.equal(first.localStorage.getItem('score'), 'legacy 9000');

  const second = install(`?geegle_profile=${B}`, store);
  assert.equal(second.localStorage.getItem('score'), null);
  // The platform's own keys are never adopted either.
  assert.equal(second.localStorage.getItem('geegle-favorites'), null);
  // Each account keeps its own copy.
  first.localStorage.setItem('score', 'A only');
  assert.equal(second.localStorage.getItem('score'), null);
});

test('removeItem never deletes unscoped keys of other games or platform state', () => {
  const store = shared();
  store.local.setItem('score', 'another game');
  store.local.setItem('geegle-session', 'token');
  const win = install(`?geegle_profile=${A}`, store);
  win.localStorage.setItem('score', 'mine');
  win.localStorage.removeItem('score');
  assert.equal(win.localStorage.getItem('score'), null);
  assert.equal(store.local.getItem('score'), 'another game');
  assert.equal(store.local.getItem('geegle-session'), 'token');
});

test('clear only removes this account’s keys for this game', () => {
  const store = shared();
  const win = install(`?geegle_profile=${A}`, store);
  win.localStorage.setItem('a', '1');
  win.localStorage.setItem('b', '2');
  store.local.setItem(`geegle-game:clsomegame:${B}:b`, 'other account');
  store.local.setItem('geegle-game:clothergame:' + A + ':b', 'other game');
  win.localStorage.clear();
  assert.equal(win.localStorage.length, 0);
  assert.equal(store.local.getItem(`geegle-game:clsomegame:${B}:b`), 'other account');
  assert.equal(store.local.getItem(`geegle-game:clothergame:${A}:b`), 'other game');
});

test('property-style access and enumeration behave like Storage', () => {
  const store = shared();
  const win = install(`?geegle_profile=${A}`, store);
  win.localStorage.score = 42;
  assert.equal(win.localStorage.score, '42');
  assert.equal(win.localStorage.getItem('score'), '42');
  assert.equal('score' in win.localStorage, true);
  assert.equal(win.localStorage.length, 1);
  assert.deepEqual(Object.keys(win.localStorage), ['score']);
  delete win.localStorage.score;
  assert.equal(win.localStorage.getItem('score'), null);
});

test('IndexedDB names are namespaced per game and account', () => {
  const store = shared();
  const win = install(`?geegle_profile=${A}&geegle_game=clcatalogname`, store);
  win.indexedDB.open('saves', 3);
  win.indexedDB.deleteDatabase('saves');
  assert.deepEqual(win.opened, [
    `geegle-game:clcatalogname:${A}:saves`,
    `delete:geegle-game:clcatalogname:${A}:saves`,
  ]);
});

test('the catalog id from the launch URL wins over the file name', () => {
  const store = shared();
  const win = install(`?geegle_profile=${A}&geegle_game=clcatalogname`, store);
  win.localStorage.setItem('k', 'v');
  assert.equal(store.local.getItem(`geegle-game:clcatalogname:${A}:k`), 'v');
});

test('sessionStorage is scoped too, and guests are left untouched', () => {
  const store = shared();
  const win = install(`?geegle_profile=${A}`, store);
  win.sessionStorage.setItem('run', '1');
  assert.equal(store.session.getItem(`geegle-game:clsomegame:${A}:run`), '1');
  // A guest gets the real Storage object: no profile means no scoping claim.
  const guest = makeWindow('', shared());
  const nativeStorage = guest.localStorage;
  runInNewContext(source, { window: guest, URLSearchParams, console, Object, Error, Proxy, String });
  assert.equal(guest.localStorage, nativeStorage);
});

test('same-origin nested frames inherit the parent game namespace', () => {
  const store = shared();
  const win = makeWindow(`?geegle_profile=${A}&geegle_game=clcatalogname`, store);
  const child = makeWindow('', store);
  win.frames.push({ contentWindow: child });
  runInNewContext(source, { window: win, URLSearchParams, console, Object, Error, Proxy, String });
  child.localStorage.setItem('frameKey', 'frameValue');
  assert.equal(store.local.getItem(`geegle-game:clcatalogname:${A}:frameKey`), 'frameValue');
});

// Wrappers that write their own save keys call geegleSaveKey(name). Without it
// they throw inside their save routine and keep progress only in memory, which
// is what the explicit adapters for clspacebarclicker, clQuantumClicker and
// clohflip depend on.
test('the shim provides geegleSaveKey for signed-in play', () => {
  const win = install(`?geegle_profile=${A}&geegle_game=clspacebarclicker`, shared());
  assert.equal(typeof win.geegleSaveKey, 'function');
  assert.equal(win.geegleSaveKey('spacebar_clicker_game'), 'spacebar_clicker_game');
});

test('the shim provides geegleSaveKey for guest play too', () => {
  const win = install('', shared());
  assert.equal(typeof win.geegleSaveKey, 'function');
  assert.equal(win.geegleSaveKey('qcSave'), 'qcSave');
});

test('a key written through geegleSaveKey lands in this account namespace', () => {
  const store = shared();
  const win = install(`?geegle_profile=${A}&geegle_game=clspacebarclicker`, store);
  win.localStorage.setItem(win.geegleSaveKey('spacebar_clicker_game'), '{"v":13}');
  assert.equal(
    store.local.getItem(`geegle-game:clspacebarclicker:${A}:spacebar_clicker_game`),
    '{"v":13}'
  );
});
