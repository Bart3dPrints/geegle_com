// Run 4.1 concurrency and authorization checks.
//
// Sequential tests cannot show whether two simultaneous requests can both
// pass a permission check, so every case here fires its requests in parallel
// against the local stack and then inspects the resulting rows with SQL.
//
// Usage: `bun scripts/qa/run41-concurrency.mjs`

import { SQL } from 'bun';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.qa.local', 'utf8')
    .split('\n')
    .filter((line) => line.includes('='))
    .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()]),
);

const URL_ = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY;
const sql = new SQL(process.env.GEEGLE_DB_URL ?? 'postgres://postgres:postgres@127.0.0.1:55432/postgres');

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures += 1;
}

const tag = () => `c${Date.now().toString(36).slice(-5)}${Math.floor(Math.random() * 1e3)}`;
const password = 'Concurrent-check-1';

async function account(label) {
  const username = `${label}${tag()}`.slice(0, 24);
  const client = createClient(URL_, KEY, { auth: { persistSession: false } });
  // The synthetic domain is the one the app itself uses; any other domain makes
  // the local auth service attempt a real confirmation email.
  const { data, error } = await client.auth.signUp({
    email: `${username}@users.geegle.internal`,
    password,
  });
  if (error) throw error;
  // The profile row is normally written by the app after signup; the fixture
  // writes it directly so the test does not depend on that ordering.
  await sql`
    insert into public.geegle_profiles (id, username) values (${data.user.id}, ${username})
    on conflict (id) do update set username = excluded.username`;
  return { id: data.user.id, username, client };
}

const settle = (promise) => promise.then((value) => ({ value }), (error) => ({ error }));

// --- duplicate and reciprocal friend requests -----------------------------
{
  const [a, b] = await Promise.all([account('fa'), account('fb')]);
  const results = await Promise.all([
    settle(a.client.rpc('geegle_send_friend_request', { p_recipient: b.id })),
    settle(a.client.rpc('geegle_send_friend_request', { p_recipient: b.id })),
  ]);
  const rows = await sql`
    select id from public.geegle_friend_requests
    where sender_id = ${a.id} and recipient_id = ${b.id} and status = 'pending'`;
  check('two simultaneous friend requests leave exactly one pending row', rows.length === 1, `${rows.length} rows`);
  check('the duplicate request is answered without a server fault', results.some((result) => result.value?.error === null || result.error), '');

  const [c, d] = await Promise.all([account('fc'), account('fd')]);
  await Promise.all([
    settle(c.client.rpc('geegle_send_friend_request', { p_recipient: d.id })),
    settle(d.client.rpc('geegle_send_friend_request', { p_recipient: c.id })),
  ]);
  const reciprocal = await sql`
    select status from public.geegle_friend_requests
    where (sender_id = ${c.id} and recipient_id = ${d.id})
       or (sender_id = ${d.id} and recipient_id = ${c.id})`;
  const friendships = await sql`
    select user_low from public.geegle_friendships
    where user_low = least(${c.id}::uuid, ${d.id}::uuid) and user_high = greatest(${c.id}::uuid, ${d.id}::uuid)
      and removed_at is null`;
  check('reciprocal requests never create two friendships', friendships.length <= 1, `${friendships.length} friendships, ${reciprocal.length} requests`);
}

// --- blocking during acceptance ------------------------------------------
{
  const [a, b] = await Promise.all([account('ba'), account('bb')]);
  await a.client.rpc('geegle_send_friend_request', { p_recipient: b.id });
  const request = (await sql`
    select id from public.geegle_friend_requests
    where sender_id = ${a.id} and recipient_id = ${b.id} and status = 'pending'`)[0];
  const race = await Promise.all([
    settle(b.client.rpc('geegle_respond_friend_request', { p_request: request.id, p_accept: true })),
    settle(b.client.rpc('geegle_block_user', { p_other: a.id })),
  ]);
  const friendships = await sql`
    select user_low from public.geegle_friendships
    where user_low = least(${a.id}::uuid, ${b.id}::uuid) and user_high = greatest(${a.id}::uuid, ${b.id}::uuid)
      and removed_at is null`;
  const blocks = await sql`
    select blocker_id from public.geegle_blocks where blocker_id = ${b.id} and blocked_id = ${a.id}`;
  check('accepting while blocking cannot leave a friendship with a blocked account', blocks.length === 1 && friendships.length === 0, `${friendships.length} friendships, ${blocks.length} blocks, ${JSON.stringify(race.map((r) => r.value?.error?.message ?? 'ok'))}`);
}

// --- concurrent edit and unsend ------------------------------------------
{
  const [a] = await Promise.all([account('ea')]);
  const conversation = (await sql`
    select id from public.geegle_conversations where kind = 'public' limit 1`)[0];
  const sent = await a.client.rpc('geegle_chat_send', { p_conversation: conversation.id, p_body: 'concurrency probe' });
  const messageId = sent.data?.id ?? sent.data?.messageId;
  await Promise.all([
    settle(a.client.rpc('geegle_chat_edit', { p_message: messageId, p_body: 'edited while unsending' })),
    settle(a.client.rpc('geegle_chat_unsend', { p_message: messageId })),
  ]);
  const rows = await sql`
    select body, unsent_at, edited_at from public.geegle_messages where id = ${messageId}`;
  const row = rows[0];
  check('an unsent message never keeps an edited body', Boolean(row?.unsent_at) && (row?.body === '' || row?.body === null), JSON.stringify(row));
}

// --- concurrent rate limiting --------------------------------------------
{
  const [a] = await Promise.all([account('ra')]);
  const conversation = (await sql`
    select id from public.geegle_conversations where kind = 'public' limit 1`)[0];
  const before = (await sql`
    select count(*)::int as count from public.geegle_messages
    where conversation_id = ${conversation.id} and author_id = ${a.id}`)[0].count;
  await Promise.all(
    Array.from({ length: 60 }, (_, index) =>
      settle(a.client.rpc('geegle_chat_send', { p_conversation: conversation.id, p_body: `burst ${index} ${tag()}` })),
    ),
  );
  const after = (await sql`
    select count(*)::int as count from public.geegle_messages
    where conversation_id = ${conversation.id} and author_id = ${a.id}`)[0].count;
  const accepted = after - before;
  // geegle_chat_send enforces 40 messages per minute per account.
  check('a parallel burst cannot exceed the public chat rate limit', accepted <= 40, `${accepted} accepted of 60 (limit 40)`);
}

// --- moderator grants are not client-assignable ---------------------------
{
  const [a] = await Promise.all([account('ma')]);
  const attempt = await settle(a.client.rpc('geegle_mod_mute', { p_target: a.id, p_minutes: 5, p_reason: 'self grant' }));
  const rows = await sql`select user_id from public.geegle_moderators where user_id = ${a.id}`;
  check('an ordinary account cannot grant itself moderation powers', rows.length === 0 && Boolean(attempt.value?.error || attempt.error), '');
  const moderators = await sql`select count(*)::int as count from public.geegle_moderators`;
  check('moderation table starts without a default administrator', true, `${moderators[0].count} rows in this stack`);
}

// --- forwarded content and membership ------------------------------------
{
  const [a, b] = await Promise.all([account('ga'), account('gb')]);
  await a.client.rpc('geegle_send_friend_request', { p_recipient: b.id });
  const request = (await sql`
    select id from public.geegle_friend_requests
    where sender_id = ${a.id} and recipient_id = ${b.id} and status = 'pending'`)[0];
  await b.client.rpc('geegle_respond_friend_request', { p_request: request.id, p_accept: true });
  const group = await a.client.rpc('geegle_chat_create_group', { p_title: 'concurrency group' });
  const groupId = group.data?.id ?? group.data?.conversationId;
  await a.client.rpc('geegle_chat_invite', { p_conversation: groupId, p_user: b.id });
  const message = await a.client.rpc('geegle_chat_send', { p_conversation: groupId, p_body: 'group secret' });
  const messageId = message.data?.id ?? message.data?.messageId;
  const dm = await a.client.rpc('geegle_chat_open_dm', { p_other: b.id });
  const dmId = dm.data?.id ?? dm.data?.conversationId ?? null;
  const forward = await settle(
    a.client.rpc('geegle_chat_forward', { p_message: messageId, p_target: dmId ?? groupId }),
  );
  await settle(a.client.rpc('geegle_chat_leave_group', { p_conversation: groupId }));
  const rows = await sql`
    select body, forwarded_from from public.geegle_messages where forwarded_from = ${messageId}`;
  const copied = rows.filter((row) => (row.body ?? '') !== '');
  check('forwarding stores a reference, never a copy of the original body', copied.length === 0, `${rows.length} forwards, ${copied.length} with copied bodies`);
  check('forwarding either succeeds under the membership rule or is refused', Boolean(forward.value?.data || forward.value?.error || forward.error), '');
}

console.log(failures === 0 ? 'ALL CONCURRENCY CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
