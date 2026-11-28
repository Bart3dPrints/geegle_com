// Chat responses are untrusted input. Conversations, messages and backgrounds
// keep only the fields the interface uses, malformed rows are dropped rather
// than rendered, and database failures are translated into honest copy.

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

const chat = await load("export * from './src/lib/chat.ts';");
const friends = await load("export * from './src/lib/friends.ts';");

test('a conversation keeps only permitted fields', () => {
  const [row] = chat.parseConversations([
    {
      id: 'c1',
      kind: 'dm',
      title: 'ann',
      otherUserId: 'u2',
      role: 'member',
      memberCount: 2,
      lastActivityAt: '2026-11-28T10:00:00.000Z',
      lastMessage: {
        id: 'm1',
        authorName: 'ann',
        body: 'hello',
        unsent: false,
        createdAt: '2026-11-28T10:00:00.000Z',
        mine: false,
        email: 'leak@example.com',
      },
      unread: 3,
      secret: 'x',
    },
  ]);
  assert.deepEqual(Object.keys(row).sort(), [
    'id', 'kind', 'lastActivityAt', 'lastMessage', 'memberCount',
    'otherUserId', 'pinned', 'role', 'title', 'unread',
  ]);
  assert.deepEqual(Object.keys(row.lastMessage).sort(), [
    'authorName', 'body', 'createdAt', 'forwarded', 'id', 'mine', 'unsent',
  ]);
});

test('malformed conversations are dropped, not rendered', () => {
  assert.deepEqual(chat.parseConversations(null), []);
  assert.deepEqual(chat.parseConversations([null, {}, { id: 'x', kind: 'voice' }]), []);
  assert.equal(chat.parseConversations([{ id: 'x', kind: 'group', title: 'G' }]).length, 1);
});

test('messages are parsed defensively and sorted oldest first', () => {
  const rows = chat.parseMessages([
    { id: 'b', conversationId: 'c', createdAt: '2026-11-28T10:00:02.000Z', body: 'second', authorName: 'a' },
    { id: 'a', conversationId: 'c', createdAt: '2026-11-28T10:00:01.000Z', body: 'first', authorName: 'a' },
    { id: 'broken' },
    null,
  ]);
  assert.deepEqual(rows.map((row) => row.id), ['a', 'b']);
  assert.equal(rows[0].body, 'first');
  assert.equal(rows[0].forwarded, null);
});

test('an unsent message carries no body', () => {
  const [row] = chat.parseMessages([
    { id: 'a', conversationId: 'c', createdAt: 't', unsent: true, body: null, authorName: 'a' },
  ]);
  assert.equal(row.unsent, true);
  assert.equal(row.body, null);
});

test('a forwarded preview keeps its stable reference', () => {
  const [row] = chat.parseMessages([
    {
      id: 'a', conversationId: 'c', createdAt: 't', body: 'copy', authorName: 'me', mine: true,
      forwarded: {
        messageId: 'root', conversationId: 'pub', authorName: 'ann',
        createdAt: '2026-11-27T00:00:00.000Z', available: true, extra: 'x',
      },
    },
  ]);
  assert.deepEqual(Object.keys(row.forwarded).sort(), [
    'authorName', 'available', 'conversationId', 'createdAt', 'messageId',
  ]);
  assert.equal(row.forwarded.messageId, 'root');
});

test('a background is clamped and unknown kinds reset to default', () => {
  assert.deepEqual(chat.parseBackground({ kind: 'solid', color: '#112233', overlay: 500 }), {
    kind: 'solid', color: '#112233', imagePath: null, overlay: 90,
  });
  assert.deepEqual(chat.parseBackground({ kind: 'image', imagePath: 'u/c/x.jpg', overlay: -20 }), {
    kind: 'image', color: null, imagePath: 'u/c/x.jpg', overlay: 0,
  });
  assert.deepEqual(chat.parseBackground({ kind: 'video' }), {
    kind: 'default', color: null, imagePath: null, overlay: 0,
  });
  assert.deepEqual(chat.parseBackground(null), chat.DEFAULT_BACKGROUND);
});

test('an unsupported upload is refused before any decoding', async () => {
  const result = await chat.prepareBackgroundImage({ type: 'image/gif', size: 1000 });
  assert.equal(result.ok, false);
  assert.match(result.error, /PNG, JPEG or WebP/);
  const huge = await chat.prepareBackgroundImage({ type: 'image/png', size: 16 * 1024 * 1024 });
  assert.equal(huge.ok, false);
  assert.match(huge.error, /too large/);
});

test('day separators and relative stamps read naturally', () => {
  const now = new Date('2026-11-28T12:00:00.000Z');
  assert.equal(chat.dayKey('2026-11-28T09:00:00.000Z'), '2026-11-28');
  assert.equal(chat.dayLabel('2026-11-28T09:00:00.000Z', now), 'Today');
  assert.equal(chat.dayLabel('2026-11-27T09:00:00.000Z', now), 'Yesterday');
  assert.equal(chat.relativeStamp('2026-11-28T11:59:30.000Z', now.getTime()), 'now');
  assert.equal(chat.relativeStamp('2026-11-28T11:30:00.000Z', now.getTime()), '30m');
  assert.equal(chat.relativeStamp('2026-11-28T09:00:00.000Z', now.getTime()), '3h');
});

test('invalid timestamps never render as a fake time', () => {
  assert.equal(chat.messageTime('not-a-date'), '');
  assert.equal(chat.dayLabel('not-a-date'), '');
  assert.equal(chat.relativeStamp('not-a-date'), '');
});

test('a missing migration is reported as unavailable, not as empty data', () => {
  const message = friends.socialFailure({
    code: 'PGRST202',
    message: 'Could not find the function public.geegle_list_social() in the schema cache',
  });
  assert.match(message, /not available on this deployment/);
  assert.ok(!message.includes('PGRST'));
  const denied = friends.socialFailure({ code: '42501', message: 'permission denied for function' });
  assert.match(denied, /permission/);
});
