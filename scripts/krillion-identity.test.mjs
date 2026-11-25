import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const gameId = 'clkrillion-backup';
const aliasId = 'krillion-backup';
const officialId = 'clkrillion';
const tables = { favorites: 'favorites', recent: 'recent' };
function moduleFrom(file, mocks = {}, globals = {}) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const exports = {};
  runInNewContext(outputText, { exports, require: (id) => mocks[id], ...globals });
  return exports;
}
const ids = moduleFrom('../src/data/gameIds.ts');
const plain = (value) => JSON.parse(JSON.stringify(value));

function fixture({ configured = true, failRecent = false } = {}) {
  const raw = new Map();
  const rows = { favorites: [], recent: [] };
  const mutations = [];
  const supabase = {
    from(table) {
      let operation = 'read';
      let limit = Infinity;
      const filters = [];
      const sort = [];
      return {
        select() { return this; },
        delete() { operation = 'delete'; return this; },
        eq(key, value) { filters.push((row) => row[key] === value); return this; },
        in(key, values) { filters.push((row) => values.includes(row[key])); return this; },
        order(key, { ascending = true } = {}) { sort.push([key, ascending]); return this; },
        limit(value) { limit = value; return this; },
        upsert(row, options) {
          mutations.push({ table, op: 'upsert', row });
          if (table === 'recent' && failRecent) return Promise.resolve({ error: { message: 'offline' } });
          const at = rows[table].findIndex((r) => r.user_id === row.user_id && r.game_id === row.game_id);
          if (at < 0) rows[table].push(row);
          else if (!options.ignoreDuplicates) rows[table][at] = row;
          return Promise.resolve({ error: null });
        },
        then(resolve) {
          const matches = (row) => filters.every((filter) => filter(row));
          if (operation === 'delete') {
            const removed = rows[table].filter(matches);
            mutations.push({ table, op: 'delete', removed });
            rows[table] = rows[table].filter((row) => !matches(row));
            resolve({ error: null });
          } else {
            const result = rows[table].filter(matches).sort((a, b) => {
              for (const [key, asc] of sort) {
                if (a[key] !== b[key]) return (a[key] < b[key] ? -1 : 1) * (asc ? 1 : -1);
              }
              return 0;
            });
            resolve({ error: null, data: result.slice(0, limit) });
          }
        },
      };
    },
  };
  const localStorage = {
    getItem: (key) => raw.get(key),
    setItem: (key, value) => raw.set(key, value),
  };
  const api = moduleFrom('../src/lib/userData.ts', {
    './supabase': { supabase, isSupabaseConfigured: configured, T: tables },
    '../data/gameIds': ids,
  }, { localStorage });
  return { api, raw, rows, mutations };
}

test('search identity collapses only Backup aliases, not official Krillion', () => {
  assert.equal(ids.canonicalGameId(aliasId), gameId);
  assert.deepEqual(plain(ids.distinctGameEntries([{ id: officialId }, { id: gameId }, { id: aliasId }, { id: gameId }])),
    [{ id: officialId }, { id: gameId }]);
});

test('favorite reads preserve persisted aliases; explicit unfavorite is owner-scoped', async () => {
  const { api, rows, raw, mutations } = fixture();
  rows.favorites.push(
    { user_id: 'a', game_id: aliasId },
    { user_id: 'b', game_id: aliasId },
    { user_id: 'b', game_id: gameId },
    { user_id: 'a', game_id: officialId },
  );
  raw.set(api.FAVORITES_KEY, JSON.stringify([aliasId, gameId]));
  assert.deepEqual(plain((await api.loadFavorites('a')).data), [gameId, officialId]);
  assert.deepEqual(plain((await api.loadFavorites('b')).data), [gameId]);
  assert.deepEqual(plain((await api.loadFavorites(null)).data), [gameId]);
  assert.deepEqual(mutations, []);
  assert.equal(rows.favorites.length, 4);
  assert.equal(raw.get(api.FAVORITES_KEY), JSON.stringify([aliasId, gameId]));
  assert.deepEqual(plain((await api.setFavorite(aliasId, 'a', true)).data), [gameId, officialId]);
  assert.equal(rows.favorites.filter((r) => r.user_id === 'a').length, 3);
  assert.deepEqual(plain((await api.setFavorite(gameId, 'a', false)).data), [officialId]);
  assert.deepEqual(rows.favorites.filter((r) => r.user_id === 'b').map((r) => r.game_id), [aliasId, gameId]);
  assert.deepEqual(plain((await api.setFavorite(aliasId, null, false)).data), []);
  assert.equal(raw.get(api.FAVORITES_KEY), '[]');
});

test('recents preserve legacy rows, use newest alias, and retain 50 distinct results', async () => {
  const { api, rows, raw, mutations } = fixture();
  const timestamp = (seconds) => new Date(seconds * 1000).toISOString();
  for (let i = 0; i < 50; i++) rows.recent.push({ user_id: 'a', game_id: 'other' + i, played_at: timestamp(i) });
  rows.recent.push({ user_id: 'a', game_id: aliasId, played_at: timestamp(51) },
    { user_id: 'a', game_id: gameId, played_at: timestamp(48) },
    { user_id: 'b', game_id: aliasId, played_at: timestamp(55) });
  const loaded = plain((await api.loadRecent('a')).data);
  assert.equal(loaded[0], gameId);
  assert.equal(loaded.length, 50);
  assert.equal(loaded[49], 'other1');
  assert.deepEqual(plain((await api.loadRecent('b')).data), [gameId]);
  assert.deepEqual(mutations, []);
  await api.trackPlay(aliasId, 'a');
  assert.equal(mutations[0].row.game_id, gameId);
  assert.ok(rows.recent.some((r) => r.user_id === 'a' && r.game_id === aliasId));
  raw.set(api.RECENT_KEY, JSON.stringify([aliasId, officialId]));
  assert.deepEqual(plain((await api.loadRecent(null)).data), [gameId, officialId]);
  assert.deepEqual(JSON.parse(raw.get(api.RECENT_KEY)), [aliasId, officialId]);
  assert.deepEqual(plain((await api.trackPlay(aliasId, null)).data), [gameId, officialId]);
  assert.deepEqual(JSON.parse(raw.get(api.RECENT_KEY)), [gameId, aliasId, officialId]);
});

test('signed-in failures never write to or read from guest history', async () => {
  const { api, raw } = fixture({ failRecent: true });
  assert.equal((await api.trackPlay(aliasId, 'a')).ok, false);
  assert.equal(raw.size, 0);
  const disconnected = fixture({ configured: false });
  disconnected.raw.set(disconnected.api.RECENT_KEY, JSON.stringify([aliasId]));
  assert.equal((await disconnected.api.loadRecent('a')).ok, false);
  assert.equal((await disconnected.api.loadFavorites('a')).ok, false);
});
