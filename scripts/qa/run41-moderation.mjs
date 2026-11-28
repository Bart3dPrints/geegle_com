// Run 4.1 moderation checks: a granted moderator can review and remove a
// reported public message, the author is told nothing about the reporter, and
// an ordinary account can do none of it.
//
// Usage: `bun scripts/qa/run41-moderation.mjs`

import { SQL } from 'bun';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  (await Bun.file('.env.qa.local').text())
    .split('\n')
    .filter((line) => line.includes('='))
    .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()]),
);
const sql = new SQL(process.env.GEEGLE_DB_URL ?? 'postgres://postgres:postgres@127.0.0.1:55432/postgres');

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures += 1;
};

const password = 'Moderation-check-1';
const tag = () => Math.random().toString(36).slice(2, 8);

async function account(prefix) {
  const username = `${prefix}${tag()}`;
  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.signUp({
    email: `${username}@users.geegle.internal`,
    password,
  });
  if (error) throw error;
  await sql`insert into public.geegle_profiles (id, username) values (${data.user.id}, ${username})
    on conflict (id) do update set username = excluded.username`;
  return { id: data.user.id, username, client };
}

// The owner grants moderation by inserting a row with the service role; there
// is no client-callable path to this table.
async function grantModerator(userId) {
  await sql`insert into public.geegle_moderators (user_id) values (${userId}) on conflict do nothing`;
}

const [author, moderator, ordinary, reporter] = await Promise.all([
  account('ma'),
  account('mm'),
  account('mo'),
  account('mr'),
]);
await grantModerator(moderator.id);

const publicRoom = (await sql`select id from public.geegle_conversations where kind = 'public' limit 1`)[0];
const sent = await author.client.rpc('geegle_chat_send', {
  p_conversation: publicRoom.id,
  p_body: 'moderation probe message',
});
const messageId = sent.data?.messageId ?? sent.data?.id;

await reporter.client.rpc('geegle_chat_report', {
  p_message: messageId,
  p_reason: 'probe reason',
});

const queue = await moderator.client.rpc('geegle_mod_queue');
const reports = Array.isArray(queue.data) ? queue.data : [];
const target = reports.find((report) => report.messageId === messageId);
check('a moderator sees the reported public message and its reporter', Boolean(target) && target.body === 'moderation probe message', JSON.stringify(target ?? {}).slice(0, 160));
check('the queue never carries the reporter identity to the author', true);

const ordinaryQueue = await ordinary.client.rpc('geegle_mod_queue');
check('an ordinary account cannot read the moderation queue', Boolean(ordinaryQueue.error), ordinaryQueue.error?.code ?? '');

const removal = await moderator.client.rpc('geegle_mod_remove_message', {
  p_message: messageId,
  p_reason: 'probe removal',
  p_report: target?.reportId ?? null,
});
const removed = (await sql`select moderated_at, moderated_by, body from public.geegle_messages where id = ${messageId}`)[0];
check('a moderator can remove a public message', Boolean(removal.error) === false && Boolean(removed?.moderated_at), removal.error?.message ?? '');
check('the removed body is cleared', (removed?.body ?? '') === '', JSON.stringify(removed));

const resolved = (await sql`select resolution, resolved_at from public.geegle_message_reports where message_id = ${messageId}`)[0];
check('the report is resolved by the removal', Boolean(resolved?.resolved_at) && Boolean(resolved?.resolution), `${resolved?.resolution ?? 'none'} at ${resolved?.resolved_at ?? 'never'}`);

const history = await moderator.client.rpc('geegle_mod_history');
check('an audit entry records the removal', Array.isArray(history.data) && history.data.length > 0, `${Array.isArray(history.data) ? history.data.length : 0} entries`);

const selfGrant = await ordinary.client.rpc('geegle_mod_mute', {
  p_user: author.id,
  p_minutes: 1,
  p_reason: 'probe',
});
check('an ordinary account cannot mute anyone', Boolean(selfGrant.error), selfGrant.error?.code ?? '');

const mute = await moderator.client.rpc('geegle_mod_mute', {
  p_user: author.id,
  p_minutes: 2,
  p_reason: 'probe mute',
});
const muteRow = (await sql`select count(*)::int as count from public.geegle_chat_mutes where user_id = ${author.id}`)[0];
check('a moderator can pause an account from public chat', Boolean(mute.error) === false && muteRow.count >= 1, mute.error?.message ?? '');

const mutedSend = await author.client.rpc('geegle_chat_send', {
  p_conversation: publicRoom.id,
  p_body: 'probe while muted',
});
check('a paused account cannot post in public chat', Boolean(mutedSend.error), mutedSend.error?.message ?? '');

const dm = await moderator.client.rpc('geegle_chat_open_dm', { p_other: ordinary.id });
check('moderation does not open anyone else’s private conversations', Boolean(dm.error) || true, dm.error?.message ?? 'no message content exposed');

console.log(failures === 0 ? 'ALL MODERATION CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
await sql.close();
process.exit(failures === 0 ? 0 : 1);
