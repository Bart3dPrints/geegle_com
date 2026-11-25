// The platform page and game frames share one origin, so a game can read
// `parent.localStorage`. The guard must hide the auth session there while
// leaving ordinary platform state readable, and must never let a game write or
// delete the session either.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const { outputFiles: [{ text }] } = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents:
      "export { createRedactingStorage, installStorageGuard, isSensitiveKey, platformStorage } from './src/lib/storageGuard.ts';",
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});

// Namespace import: `platformStorage` is assigned at install time, so a
// destructured binding would capture its initial `undefined`.
const guard = await import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`);
const { createRedactingStorage, installStorageGuard, isSensitiveKey } = guard;

function realStorage() {
  const data = new Map();
  return {
    data,
    getItem: (key) => data.get(String(key)) ?? null,
    setItem: (key, value) => data.set(String(key), String(value)),
    removeItem: (key) => data.delete(String(key)),
    key: (index) => [...data.keys()][index] ?? null,
    get length() { return data.size; },
  };
}

const TOKEN = '{"access_token":"secret","refresh_token":"secret"}';

test('the auth session is sensitive; ordinary platform state is not', () => {
  assert.equal(isSensitiveKey('geegle-auth-session'), true);
  assert.equal(isSensitiveKey('sb-abcdef-auth-token'), true);
  assert.equal(isSensitiveKey('geegle-theme'), false);
  assert.equal(isSensitiveKey('geegle-favorites'), false);
});

test('the guarded view cannot read, write or delete the session', () => {
  const real = realStorage();
  real.setItem('geegle-auth-session', TOKEN);
  real.setItem('geegle-theme', 'dark');
  const view = createRedactingStorage(real);

  assert.equal(view.getItem('geegle-auth-session'), null);
  assert.equal(view.getItem('geegle-theme'), 'dark');

  view.setItem('geegle-auth-session', 'overwritten');
  assert.equal(real.getItem('geegle-auth-session'), TOKEN, 'the session must not be overwritten');

  view.removeItem('geegle-auth-session');
  assert.equal(real.getItem('geegle-auth-session'), TOKEN, 'the session must not be deleted');

  // Enumeration and length expose only visible keys.
  assert.equal(view.length, 1);
  assert.equal(view.key(0), 'geegle-theme');
  assert.equal(view.key(1), null);
  assert.deepEqual(Object.keys(view), ['geegle-theme']);
  assert.equal('geegle-auth-session' in view, false);
  assert.equal('geegle-theme' in view, true);
});

test('clear() keeps the session and property access still works', () => {
  const real = realStorage();
  real.setItem('geegle-auth-session', TOKEN);
  real.setItem('geegle-last-tab', 'games');
  const view = createRedactingStorage(real);

  view.setItem('mine', 'value');
  assert.equal(view.getItem('mine'), 'value');
  view.removeItem('mine');
  assert.equal(view.getItem('mine'), null);

  view.clear();
  assert.equal(real.getItem('geegle-auth-session'), TOKEN, 'clear() must not log the user out');
  assert.equal(real.getItem('geegle-last-tab'), null);
});

test('installStorageGuard replaces window storage but keeps the private reference', () => {
  const local = realStorage();
  const session = realStorage();
  local.setItem('geegle-auth-session', TOKEN);
  local.setItem('geegle-theme', 'dark');
  globalThis.window = { localStorage: local, sessionStorage: session };

  assert.equal(installStorageGuard(), true);
  assert.equal(window.localStorage.getItem('geegle-auth-session'), null);
  assert.equal(window.localStorage.getItem('geegle-theme'), 'dark');
  assert.equal(guard.platformStorage, local, 'the platform keeps the real Storage');
  assert.equal(guard.platformStorage.getItem('geegle-auth-session'), TOKEN);

  // Installing twice is a no-op, not a facade-of-a-facade.
  assert.equal(installStorageGuard(), true);
  assert.equal(guard.platformStorage, local);
  delete globalThis.window;
});
