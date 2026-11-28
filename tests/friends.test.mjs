// The Friends surface only ever shows what the friendship feature needs.
// Server JSON is untrusted input, presence keys must be opaque and stable, and
// the visitor count must count people, not tabs.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

async function load(entry) {
  const { outputFiles: [{ text }] } = await build({
    stdin: { resolveDir: process.cwd(), contents: entry },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
  });
  return import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`);
}

const friends = await load("export * from './src/lib/friends.ts';");

test('a search term is trimmed, lower-cased and needs two characters', () => {
  assert.equal(friends.normalizeSearchTerm('  Bo  '), 'bo');
  assert.equal(friends.normalizeSearchTerm('a'), '');
  assert.equal(friends.normalizeSearchTerm('   '), '');
  assert.equal(friends.normalizeSearchTerm(null), '');
  assert.equal(friends.normalizeSearchTerm('%_'), '%_');
});

test('a social snapshot keeps only permitted fields', () => {
  const parsed = friends.parseSocialSnapshot({
    friends: [{ userId: 'a', username: 'ann', since: 't', email: 'leak@x', ip: '1.2.3.4' }],
    incoming: [{ requestId: 'r1', userId: 'b', username: 'ben', createdAt: 't', token: 'x' }],
    outgoing: [],
    blocked: [{ userId: 'c', username: 'cat', location: 'here' }],
  });
  assert.deepEqual(Object.keys(parsed.friends[0]).sort(), ['since', 'userId', 'username']);
  assert.deepEqual(Object.keys(parsed.incoming[0]).sort(), ['createdAt', 'requestId', 'userId', 'username']);
  assert.deepEqual(Object.keys(parsed.blocked[0]).sort(), ['userId', 'username']);
});

test('a malformed social snapshot degrades to empty lists', () => {
  const parsed = friends.parseSocialSnapshot({ friends: 'nope', blocked: null });
  assert.deepEqual(parsed.friends, []);
  assert.deepEqual(parsed.incoming, []);
  assert.deepEqual(parsed.outgoing, []);
  assert.deepEqual(parsed.blocked, []);
  assert.deepEqual(friends.parseSocialSnapshot(null), {
    friends: [], incoming: [], outgoing: [], blocked: [],
  });
});

test('the visitor count counts distinct presence keys, not connections', () => {
  assert.equal(friends.countVisitors({}), 0);
  assert.equal(friends.countVisitors({ k1: [{}, {}], k2: [{}] }), 2);
});

test('presence keys are stable for an account and opaque', async () => {
  const one = await friends.presenceKeyFor('user-1', false);
  const again = await friends.presenceKeyFor('user-1', false);
  const other = await friends.presenceKeyFor('user-2', false);
  assert.equal(one, again, 'the same account keeps one key so tabs deduplicate');
  assert.notEqual(one, other, 'different accounts get different keys');
  assert.ok(!one.includes('user-1'), 'the key must not reveal the account id');
  assert.ok(one.length >= 16, 'the key is long enough to be opaque');
});

test('a hidden account still has a presence key, but not its own', async () => {
  const visible = await friends.presenceKeyFor('user-1', false);
  const hidden = await friends.presenceKeyFor('user-1', true);
  assert.ok(hidden.length >= 16);
  assert.notEqual(hidden, visible, 'a hidden account is counted but not shown as online');
});
