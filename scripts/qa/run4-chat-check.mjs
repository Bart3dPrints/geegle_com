// Run 4 chat verification against the isolated/local Supabase stack.
//
// Creates four disposable accounts and drives the real auth and REST endpoints,
// so the forwarding matrix, group ownership, personal deletion, backgrounds and
// every client-write refusal are checked against the database rather than the
// UI.
//
// Usage: .env.qa.local must provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
// Run: bun scripts/qa/run4-chat-check.mjs

import { readFileSync } from 'node:fs';

const env = {};
for (const line of readFileSync('.env.qa.local', 'utf8').split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match) env[match[1]] = match[2].trim();
}
const BASE = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY;
if (!BASE || !KEY) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env.qa.local');
  process.exit(2);
}

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures += 1;
}

const suffix = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

async function signup(label) {
  const username = `${label}${suffix()}`.slice(0, 28);
  const password = `Pw-${suffix()}-${suffix()}`;
  const response = await fetch(`${BASE}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: KEY },
    body: JSON.stringify({ email: `${username}@users.geegle.internal`, password }),
  });
  const body = await response.json();
  if (!body.access_token) throw new Error(`signup failed for ${label}: ${JSON.stringify(body)}`);
  return { username, password, id: body.user.id, token: body.access_token };
}

async function rpc(token, fn, args = {}) {
  const response = await fetch(`${BASE}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: KEY,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(args),
  });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: response.status, body };
}

async function table(token, path, options = {}) {
  const response = await fetch(`${BASE}/rest/v1/${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      apikey: KEY,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: response.status, body };
}

const json = (value) => JSON.stringify(value);
const failed = (result) => result.status >= 400 || result.body?.code !== undefined;
const said = (result, text) => json(result.body).toLowerCase().includes(text.toLowerCase());

async function befriend(a, b) {
  const sent = await rpc(a.token, 'geegle_send_friend_request', { p_recipient: b.id });
  const requestId = sent.body?.id;
  const accepted = await rpc(b.token, 'geegle_respond_friend_request', { p_request: requestId, p_accept: true });
  return accepted.status === 200;
}

const A = await signup('q4a');
const B = await signup('q4b');
const C = await signup('q4c');
const D = await signup('q4d');
console.log(`accounts: ${[A, B, C, D].map((account) => account.username).join(', ')}`);

// --- guests ---------------------------------------------------------------
const zero = '00000000-0000-0000-0000-000000000000';
for (const [fn, args] of [
  ['geegle_chat_overview', {}],
  ['geegle_chat_messages', { p_conversation: zero }],
  ['geegle_chat_send', { p_conversation: zero, p_body: 'x' }],
  ['geegle_chat_open_dm', { p_other: zero }],
  ['geegle_chat_forward', { p_message: zero, p_conversation: zero }],
]) {
  const guest = await rpc(null, fn, args);
  check(`guest is refused ${fn}`, guest.status === 401 && said(guest, 'permission denied'), `status ${guest.status}`);
}

// --- the public room ------------------------------------------------------
const overview = await rpc(A.token, 'geegle_chat_overview');
check('overview lists the public room', Array.isArray(overview.body) && overview.body.some((row) => row.kind === 'public'));
const publicId = overview.body.find((row) => row.kind === 'public').id;
check('the public room is the same for everyone', (await rpc(B.token, 'geegle_chat_overview')).body.some((row) => row.id === publicId && row.kind === 'public'));

const sentPublic = await rpc(A.token, 'geegle_chat_send', { p_conversation: publicId, p_body: 'hello <b>world</b>' });
check('a signed-in account can post in the public room', sentPublic.status === 200 && Boolean(sentPublic.body.messageId));
const emptyBody = await rpc(A.token, 'geegle_chat_send', { p_conversation: publicId, p_body: '   ' });
check('an empty message is refused', failed(emptyBody) && said(emptyBody, 'message_empty'));
const longBody = await rpc(A.token, 'geegle_chat_send', { p_conversation: publicId, p_body: 'x'.repeat(4001) });
check('an over-long message is refused', failed(longBody) && said(longBody, 'message_too_long'));

const listForB = await rpc(B.token, 'geegle_chat_messages', { p_conversation: publicId, p_limit: 30 });
const seen = listForB.body.find((row) => row.id === sentPublic.body.messageId);
check('another account reads the public message', Boolean(seen));
check('message text is stored verbatim, never interpreted', seen?.body === 'hello <b>world</b>');

const overviewB = await rpc(B.token, 'geegle_chat_overview');
const publicForB = overviewB.body.find((row) => row.id === publicId);
check('the public room reports unread messages', publicForB.unread >= 1, `unread ${publicForB?.unread}`);
await rpc(B.token, 'geegle_chat_mark_read', { p_conversation: publicId });
const afterRead = (await rpc(B.token, 'geegle_chat_overview')).body.find((row) => row.id === publicId);
check('marking read clears the unread count', afterRead.unread === 0, `unread ${afterRead?.unread}`);

// --- pagination -----------------------------------------------------------
const pageIds = [];
for (const text of ['one', 'two', 'three', 'four', 'five']) {
  const sent = await rpc(C.token, 'geegle_chat_send', { p_conversation: publicId, p_body: `${text}-${suffix()}` });
  pageIds.push(sent.body.messageId);
}
const firstPage = await rpc(C.token, 'geegle_chat_messages', { p_conversation: publicId, p_limit: 2 });
check('the page size is honoured', firstPage.body.length === 2);
check('the newest message comes first', firstPage.body[0].id === pageIds.at(-1));
const cursor = firstPage.body.at(-1);
const olderPage = await rpc(C.token, 'geegle_chat_messages', {
  p_conversation: publicId,
  p_before: cursor.createdAt,
  p_before_id: cursor.id,
  p_limit: 2,
});
check('the older page continues where the first stopped', olderPage.body.length === 2 && !olderPage.body.some((row) => row.id === cursor.id));
check('pages do not repeat each other', olderPage.body.every((row) => row.id !== firstPage.body[0].id));

// --- direct messages ------------------------------------------------------
check('A and B become friends', await befriend(A, B));
const dmAB = await rpc(A.token, 'geegle_chat_open_dm', { p_other: B.id });
check('opening a DM with a friend works', dmAB.status === 200 && Boolean(dmAB.body.conversationId));
const dmId = dmAB.body.conversationId;
const dmAgain = await rpc(B.token, 'geegle_chat_open_dm', { p_other: A.id });
check('a DM is never duplicated', dmAgain.body.conversationId === dmId);
const dmAC = await rpc(A.token, 'geegle_chat_open_dm', { p_other: C.id });
check('a DM with a non-friend is refused', failed(dmAC) && said(dmAC, 'not_friends'));
const dmWithSelf = await rpc(A.token, 'geegle_chat_open_dm', { p_other: A.id });
check('a DM with yourself is refused', failed(dmWithSelf));

const dmMessage = await rpc(A.token, 'geegle_chat_send', { p_conversation: dmId, p_body: 'private hello' });
check('a DM message is sent', dmMessage.status === 200);
const dmMessageId = dmMessage.body.messageId;
const bReadsDm = await rpc(B.token, 'geegle_chat_messages', { p_conversation: dmId });
check('the other side reads the DM', bReadsDm.body.some((row) => row.id === dmMessageId));
const cReadsDm = await rpc(C.token, 'geegle_chat_messages', { p_conversation: dmId });
check('a stranger cannot read the DM', failed(cReadsDm) && said(cReadsDm, 'conversation_not_found'));
const cSendsDm = await rpc(C.token, 'geegle_chat_send', { p_conversation: dmId, p_body: 'intrude' });
check('a stranger cannot post into the DM', failed(cSendsDm));
const directDm = await table(C.token, `geegle_messages?conversation_id=eq.${dmId}&select=id,body`);
check('RLS hides DM rows from a stranger', Array.isArray(directDm.body) && directDm.body.length === 0);

// --- edit, unsend, delete-for-me -----------------------------------------
const edited = await rpc(A.token, 'geegle_chat_edit', { p_message: dmMessageId, p_body: 'private hello (edited)' });
check('an author can edit a message', edited.status === 200);
const bAfterEdit = await rpc(B.token, 'geegle_chat_messages', { p_conversation: dmId });
const editedRow = bAfterEdit.body.find((row) => row.id === dmMessageId);
check('the edit is visible to the other side', editedRow?.body === 'private hello (edited)' && Boolean(editedRow?.editedAt));
const hijack = await rpc(B.token, 'geegle_chat_edit', { p_message: dmMessageId, p_body: 'hijacked' });
check('another account cannot edit your message', failed(hijack) && said(hijack, 'not_author'));
const emptyEdit = await rpc(A.token, 'geegle_chat_edit', { p_message: dmMessageId, p_body: '   ' });
check('an edit cannot empty a message', failed(emptyEdit) && said(emptyEdit, 'message_empty'));

await rpc(B.token, 'geegle_chat_hide', { p_message: dmMessageId });
const bAfterHide = await rpc(B.token, 'geegle_chat_messages', { p_conversation: dmId });
check('delete for me removes it only for that account', !bAfterHide.body.some((row) => row.id === dmMessageId));
const aStillSees = await rpc(A.token, 'geegle_chat_messages', { p_conversation: dmId });
check('delete for me leaves it for everyone else', aStillSees.body.some((row) => row.id === dmMessageId));

const doomed = await rpc(A.token, 'geegle_chat_send', { p_conversation: dmId, p_body: 'to be unsent' });
const doomedId = doomed.body.messageId;
const unsendByB = await rpc(B.token, 'geegle_chat_unsend', { p_message: doomedId });
check('only the author can unsend', failed(unsendByB) && said(unsendByB, 'not_author'));
const unsendOk = await rpc(A.token, 'geegle_chat_unsend', { p_message: doomedId });
check('the author can unsend', unsendOk.status === 200);
await rpc(B.token, 'geegle_chat_mark_read', { p_conversation: dmId });
const afterUnsend = (await rpc(B.token, 'geegle_chat_messages', { p_conversation: dmId })).body.find((row) => row.id === doomedId);
check('unsent text is destroyed', afterUnsend?.unsent === true && afterUnsend?.body === null);
const revive = await rpc(A.token, 'geegle_chat_edit', { p_message: doomedId, p_body: 'revived' });
check('an unsent message cannot be edited back', failed(revive) && said(revive, 'message_unsent'));
const forwardUnsent = await rpc(A.token, 'geegle_chat_forward', { p_message: doomedId, p_conversation: dmId });
check('an unsent message cannot be forwarded', failed(forwardUnsent) && said(forwardUnsent, 'message_not_found'));

// --- forwarding matrix ----------------------------------------------------
const forwardFromPublic = await rpc(A.token, 'geegle_chat_forward', { p_message: sentPublic.body.messageId, p_conversation: dmId });
check('public → DM with an accepted friend is allowed', forwardFromPublic.status === 200);
const forwardId = forwardFromPublic.body.messageId;
const bSeesForward = (await rpc(B.token, 'geegle_chat_messages', { p_conversation: dmId, p_limit: 50 })).body;
const forwardRow = bSeesForward.find((row) => row.id === forwardId);
check('the forward references the original message', forwardRow?.forwarded?.messageId === sentPublic.body.messageId);
check('the forward names the original author and time', forwardRow?.forwarded?.authorName === A.username && Boolean(forwardRow?.forwarded?.createdAt));
check('the original is reachable for a reader who can see it', forwardRow?.forwarded?.available === true);

const intoPublic = await rpc(A.token, 'geegle_chat_forward', { p_message: sentPublic.body.messageId, p_conversation: publicId });
check('forwarding into the public room is refused', failed(intoPublic) && said(intoPublic, 'forward_not_allowed'));
const dmToDm = await rpc(A.token, 'geegle_chat_forward', { p_message: dmMessageId, p_conversation: dmId });
check('a DM message cannot be forwarded', failed(dmToDm) && said(dmToDm, 'forward_not_allowed'));
const chain = await rpc(A.token, 'geegle_chat_forward', { p_message: forwardId, p_conversation: dmId });
check('a forward cannot be chained through a DM', failed(chain) && said(chain, 'forward_not_allowed'));

// --- groups ---------------------------------------------------------------
const group = await rpc(A.token, 'geegle_chat_create_group', { p_title: `QA ${suffix()}` });
check('a group can be created', group.status === 200 && Boolean(group.body.conversationId));
const groupId = group.body.conversationId;
const noTitle = await rpc(A.token, 'geegle_chat_create_group', { p_title: '   ' });
check('a group needs a name', failed(noTitle) && said(noTitle, 'title_required'));
const renameByB = await rpc(B.token, 'geegle_chat_rename_group', { p_conversation: groupId, p_title: 'nope' });
check('only the owner can rename a group', failed(renameByB) && said(renameByB, 'owner_only'));
const inviteStranger = await rpc(A.token, 'geegle_chat_invite', { p_conversation: groupId, p_user: C.id });
check('only accepted friends can be invited', failed(inviteStranger) && said(inviteStranger, 'not_friends'));
const inviteB = await rpc(A.token, 'geegle_chat_invite', { p_conversation: groupId, p_user: B.id });
check('a friend can be invited', inviteB.status === 200);
const groupMessage = await rpc(B.token, 'geegle_chat_send', { p_conversation: groupId, p_body: 'group hi' });
check('a member can post in the group', groupMessage.status === 200);
const outsiderReads = await rpc(C.token, 'geegle_chat_messages', { p_conversation: groupId });
check('a non-member cannot read the group', failed(outsiderReads));
const groupToMember = await rpc(A.token, 'geegle_chat_forward', { p_message: groupMessage.body.messageId, p_conversation: dmId });
check('group → DM is allowed when the recipient is a member', groupToMember.status === 200);
check('A and D become friends', await befriend(A, D));
const dmAD = await rpc(A.token, 'geegle_chat_open_dm', { p_other: D.id });
const groupToOutsider = await rpc(A.token, 'geegle_chat_forward', {
  p_message: groupMessage.body.messageId,
  p_conversation: dmAD.body.conversationId,
});
check('group → DM is refused when the recipient is not a member', failed(groupToOutsider) && said(groupToOutsider, 'forward_not_allowed'));

const memberList = await rpc(A.token, 'geegle_chat_members', { p_conversation: groupId });
check('members are listed with roles', memberList.body.length === 2 && memberList.body.some((m) => m.role === 'owner'));
const transferByB = await rpc(B.token, 'geegle_chat_transfer_ownership', { p_conversation: groupId, p_user: A.id });
check('only the owner can transfer ownership', failed(transferByB) && said(transferByB, 'owner_only'));
const transfer = await rpc(A.token, 'geegle_chat_transfer_ownership', { p_conversation: groupId, p_user: B.id });
check('ownership transfers to a member', transfer.status === 200);
const leaveB = await rpc(B.token, 'geegle_chat_leave_group', { p_conversation: groupId });
check('a member can leave', leaveB.body?.status === 'left');
const afterLeave = await rpc(A.token, 'geegle_chat_members', { p_conversation: groupId });
check('ownership falls back to the remaining member', afterLeave.body.length === 1 && afterLeave.body[0].userId === A.id && afterLeave.body[0].role === 'owner');
const leaveA = await rpc(A.token, 'geegle_chat_leave_group', { p_conversation: groupId });
check('leaving the last member closes the group', leaveA.body?.status === 'closed');
check('a closed group is gone', failed(await rpc(A.token, 'geegle_chat_messages', { p_conversation: groupId })));

// --- backgrounds ----------------------------------------------------------
const solid = await rpc(A.token, 'geegle_chat_set_background', { p_conversation: dmId, p_kind: 'color', p_color: '#112233', p_overlay: 30 });
check('a custom hex background is saved', solid.status === 200 && solid.body.color === '#112233');
const preset = await rpc(A.token, 'geegle_chat_set_background', { p_conversation: dmId, p_kind: 'solid', p_color: '#0c4a6e' });
check('a solid preset is saved', preset.status === 200 && preset.body.kind === 'solid');
const badColor = await rpc(A.token, 'geegle_chat_set_background', { p_conversation: dmId, p_kind: 'color', p_color: 'red' });
check('an invalid colour is refused', failed(badColor) && said(badColor, 'invalid_color'));
const badPath = await rpc(A.token, 'geegle_chat_set_background', {
  p_conversation: dmId, p_kind: 'image', p_image_path: `${B.id}/${dmId}/x.jpg`,
});
check('another account’s image folder is refused', failed(badPath) && said(badPath, 'invalid_image'));
const goodPath = await rpc(A.token, 'geegle_chat_set_background', {
  p_conversation: dmId, p_kind: 'image', p_image_path: `${A.id}/${dmId}/1.jpg`, p_overlay: 55,
});
check('an own-folder image path is accepted', goodPath.status === 200 && goodPath.body.overlay === 55);
check('the background is returned to its owner', (await rpc(A.token, 'geegle_chat_background', { p_conversation: dmId })).body?.kind === 'image');
check('the other participant does not see it', (await rpc(B.token, 'geegle_chat_background', { p_conversation: dmId })).body === null);
const publicBg = await rpc(A.token, 'geegle_chat_set_background', { p_conversation: publicId, p_kind: 'solid', p_color: '#112233' });
check('backgrounds are refused outside a DM', failed(publicBg) && said(publicBg, 'not_a_dm'));
const resetBg = await rpc(A.token, 'geegle_chat_set_background', { p_conversation: dmId, p_kind: 'default' });
check('reset restores the default', resetBg.status === 200 && resetBg.body.kind === 'default' && resetBg.body.color === null);

// --- reports --------------------------------------------------------------
check('a message can be reported', (await rpc(C.token, 'geegle_chat_report', { p_message: sentPublic.body.messageId, p_reason: 'spam' })).status === 200);
const noReason = await rpc(C.token, 'geegle_chat_report', { p_message: sentPublic.body.messageId, p_reason: '  ' });
check('a report needs a reason', failed(noReason) && said(noReason, 'reason_required'));

// --- direct table access --------------------------------------------------
const insertMessage = await table(A.token, 'geegle_messages', { method: 'POST', body: { conversation_id: publicId, body: 'direct' } });
check('a client cannot insert a message', insertMessage.status >= 400);
const insertConversation = await table(A.token, 'geegle_conversations', { method: 'POST', body: { kind: 'group', title: 'x' } });
check('a client cannot create a conversation directly', insertConversation.status >= 400);
const patchMessage = await table(A.token, `geegle_messages?id=eq.${sentPublic.body.messageId}`, { method: 'PATCH', body: { body: 'tampered' } });
check('a client cannot edit a message directly', patchMessage.status >= 400);
const deleteConversation = await table(A.token, `geegle_conversations?id=eq.${dmId}`, { method: 'DELETE' });
check('a client cannot delete a conversation directly', deleteConversation.status >= 400);
const hideDirect = await table(A.token, 'geegle_message_hidden', { method: 'POST', body: { message_id: sentPublic.body.messageId, user_id: A.id } });
check('a client cannot hide a message directly', hideDirect.status >= 400);
const reportsTable = await table(A.token, 'geegle_message_reports?select=id');
check('message reports are not readable by clients', reportsTable.status >= 400 || (Array.isArray(reportsTable.body) && reportsTable.body.length === 0));
const backgroundTable = await table(B.token, 'geegle_dm_backgrounds?select=*');
check('backgrounds of other accounts are unreadable', Array.isArray(backgroundTable.body) && backgroundTable.body.every((row) => row.user_id === B.id));

// --- rate limiting --------------------------------------------------------
let limited = false;
for (let index = 0; index < 60 && !limited; index += 1) {
  const result = await rpc(D.token, 'geegle_chat_send', { p_conversation: publicId, p_body: `burst ${index}` });
  if (result.status >= 400 && said(result, 'rate_limited')) limited = true;
}
check('message sending is rate limited', limited);

// --- blocking closes the DM ----------------------------------------------
await rpc(B.token, 'geegle_block_user', { p_other: A.id });
check('blocking closes the DM for the blocker', failed(await rpc(B.token, 'geegle_chat_messages', { p_conversation: dmId })));
check('blocking closes the DM for the other side too', failed(await rpc(A.token, 'geegle_chat_messages', { p_conversation: dmId })));
await rpc(B.token, 'geegle_unblock_user', { p_other: A.id });

console.log(`\n${failures === 0 ? 'ALL CHAT CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
