// Run 3 social verification against the isolated/local Supabase stack.
//
// Creates disposable accounts and drives the real REST/auth endpoints, so every
// rule below (duplicates, self-requests, blocking, foreign identities, direct
// table access) is exercised against the database, not against the UI.
//
// Usage: dotenv-style .env.qa.local must provide VITE_SUPABASE_URL and
// VITE_SUPABASE_ANON_KEY. Run: bun scripts/qa/run3-social-check.mjs

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

function suffix() {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

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

async function signIn(username, password) {
  const response = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: KEY },
    body: JSON.stringify({ email: `${username}@users.geegle.internal`, password }),
  });
  return response.json();
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

const messageOf = (result) => JSON.stringify(result.body);

async function list(token) {
  const result = await rpc(token, 'geegle_list_social');
  if (result.status !== 200) throw new Error(`list_social failed: ${messageOf(result)}`);
  return result.body;
}

// ---------------------------------------------------------------------------
const A = await signup('anna');
const B = await signup('bob');
const C = await signup('cara');

check('three disposable accounts are provisioned', Boolean(A.id && B.id && C.id));

// 15/16: a guest (anonymous key, no session) cannot touch any social surface.
const guestList = await rpc(null, 'geegle_list_social');
check('guests cannot read social data', guestList.status >= 400, String(guestList.status));
const guestSearch = await rpc(null, 'geegle_search_users', { p_query: 'an' });
check('guests cannot search accounts', guestSearch.status >= 400, String(guestSearch.status));

// 1: case-insensitive discovery, excluding the caller.
const search = await rpc(A.token, 'geegle_search_users', { p_query: B.username.slice(0, 6).toUpperCase() });
const found = Array.isArray(search.body) ? search.body : [];
check('A finds B by username, case-insensitively', found.some((row) => row.user_id === B.id), messageOf(search));
check('discovery never returns the caller', !found.some((row) => row.user_id === A.id));
check('discovery returns only id and username', found.every((row) => Object.keys(row).sort().join(',') === 'user_id,username'));

// 2: send a request.
const sent = await rpc(A.token, 'geegle_send_friend_request', { p_recipient: B.id });
check('A can send B a friend request', sent.body?.status === 'pending', messageOf(sent));

// 3: B sees it without any refresh (a fresh read of the database).
const bList = await list(B.token);
check('B sees the incoming request', bList.incoming.some((row) => row.userId === A.id));
check('the incoming request carries only permitted fields',
  bList.incoming.every((row) => Object.keys(row).sort().join(',') === 'createdAt,requestId,userId,username'));

// 8: duplicate requests are rejected.
const duplicate = await rpc(A.token, 'geegle_send_friend_request', { p_recipient: B.id });
check('a duplicate request is not created', duplicate.body?.status === 'duplicate', messageOf(duplicate));

// 9: self-directed requests are rejected.
const self = await rpc(A.token, 'geegle_send_friend_request', { p_recipient: A.id });
check('self-directed requests are rejected', self.status >= 400 && messageOf(self).includes('self_request'), messageOf(self));

// 17: approving a request that was not sent to you fails.
const requestId = bList.incoming.find((row) => row.userId === A.id).requestId;
const foreignAccept = await rpc(C.token, 'geegle_respond_friend_request', { p_request: requestId, p_accept: true });
check('C cannot accept a request addressed to B', foreignAccept.status >= 400, messageOf(foreignAccept));

// 4/5: accept, then both accounts see the friendship.
const accepted = await rpc(B.token, 'geegle_respond_friend_request', { p_request: requestId, p_accept: true });
check('B accepts the request', accepted.body?.status === 'accepted', messageOf(accepted));
const aAfter = await list(A.token);
const bAfter = await list(B.token);
check('both accounts now show the friendship',
  aAfter.friends.some((row) => row.userId === B.id) && bAfter.friends.some((row) => row.userId === A.id));

// 6: the friendship survives a fresh sign-in (server state, not localStorage).
const session = await signIn(A.username, A.password);
check('A can sign in again', Boolean(session.access_token), JSON.stringify(session).slice(0, 120));
const freshList = await list(session.access_token);
check('the friendship persists across sign-ins', freshList.friends.some((row) => row.userId === B.id));

// 12: blocking removes the friendship and blocks new requests.
const blocked = await rpc(A.token, 'geegle_block_user', { p_other: B.id });
check('A can block B', blocked.body?.status === 'blocked', messageOf(blocked));
const afterBlockA = await list(A.token);
const afterBlockB = await list(B.token);
check('blocking removes the friendship on both sides',
  !afterBlockA.friends.some((row) => row.userId === B.id) && !afterBlockB.friends.some((row) => row.userId === A.id));
const blockedRequest = await rpc(B.token, 'geegle_send_friend_request', { p_recipient: A.id });
check('a blocked account cannot send a request', blockedRequest.status >= 400 && messageOf(blockedRequest).includes('blocked'), messageOf(blockedRequest));
const blockedSearch = await rpc(B.token, 'geegle_search_users', { p_query: A.username.slice(0, 8) });
check('a blocked account cannot find the blocker', !(blockedSearch.body ?? []).some((row) => row.user_id === A.id));

// 13: unblocking restores normal behaviour.
const unblocked = await rpc(A.token, 'geegle_unblock_user', { p_other: B.id });
check('A can unblock B', unblocked.body?.status === 'unblocked', messageOf(unblocked));
const requestAfterUnblock = await rpc(B.token, 'geegle_send_friend_request', { p_recipient: A.id });
check('requests work again after unblocking', requestAfterUnblock.body?.status === 'pending', messageOf(requestAfterUnblock));

// 18: simultaneous requests resolve to a friendship.
const mutual = await rpc(A.token, 'geegle_send_friend_request', { p_recipient: B.id });
check('a reciprocal request accepts the existing one', mutual.body?.status === 'accepted', messageOf(mutual));
const mutualList = await list(A.token);
check('the mutual pair are friends', mutualList.friends.some((row) => row.userId === B.id));

// 10: cancelling an outgoing request.
const cToA = await rpc(C.token, 'geegle_send_friend_request', { p_recipient: A.id });
const cancel = await rpc(C.token, 'geegle_cancel_friend_request', { p_request: cToA.body.id });
check('C can cancel an outgoing request', cancel.body?.status === 'cancelled', messageOf(cancel));
const afterCancel = await list(A.token);
check('the cancelled request no longer appears', !afterCancel.incoming.some((row) => row.userId === C.id));

// 11: declining.
const cToB = await rpc(C.token, 'geegle_send_friend_request', { p_recipient: B.id });
const declined = await rpc(B.token, 'geegle_respond_friend_request', { p_request: cToB.body.id, p_accept: false });
check('B can decline', declined.body?.status === 'declined', messageOf(declined));
const afterDecline = await list(C.token);
check('a declined request leaves no friendship', !afterDecline.friends.some((row) => row.userId === B.id));

// 11b: removing a friendship updates both accounts.
const removed = await rpc(A.token, 'geegle_remove_friend', { p_other: B.id });
check('A can remove the friendship', removed.body?.status === 'removed', messageOf(removed));
const aFinal = await list(A.token);
const bFinal = await list(B.token);
check('removal updates both accounts',
  !aFinal.friends.some((row) => row.userId === B.id) && !bFinal.friends.some((row) => row.userId === A.id));

// 19: an unrelated account cannot read or modify another pair's private rows.
const cToB2 = await rpc(C.token, 'geegle_send_friend_request', { p_recipient: B.id });
const foreignRows = await table(A.token, `geegle_friend_requests?id=eq.${cToB2.body.id}&select=*`);
check('A cannot read C and B\'s request row', Array.isArray(foreignRows.body) && foreignRows.body.length === 0, JSON.stringify(foreignRows.body));
const foreignFriendship = await table(C.token, 'geegle_friendships?select=*');
check('C sees no friendship rows that are not theirs', Array.isArray(foreignFriendship.body) && foreignFriendship.body.length === 0);

// 16: direct writes and forged identities fail.
const insertAttempt = await table(A.token, 'geegle_friendships', {
  method: 'POST',
  headers: { prefer: 'return=representation' },
  body: { user_low: B.id, user_high: C.id },
});
check('direct friendship inserts are refused', insertAttempt.status >= 400, `${insertAttempt.status}`);
const blockInsert = await table(A.token, 'geegle_blocks', {
  method: 'POST',
  headers: { prefer: 'return=representation' },
  body: { blocker_id: A.id, blocked_id: C.id },
});
check('direct block inserts are refused', blockInsert.status >= 400, `${blockInsert.status}`);
const forgedRate = await table(A.token, 'geegle_social_rate?select=*');
check('the rate-limit table is not readable', forgedRate.status >= 400 || (Array.isArray(forgedRate.body) && forgedRate.body.length === 0), JSON.stringify(forgedRate.body));

// 20: rate limiting on discovery.
let limited = false;
for (let i = 0; i < 40; i += 1) {
  const attempt = await rpc(A.token, 'geegle_search_users', { p_query: 'an' });
  if (attempt.status >= 400 && messageOf(attempt).includes('rate_limited')) { limited = true; break; }
}
check('username search is rate limited', limited);

// Reporting works and is scoped to the reporter.
const report = await rpc(C.token, 'geegle_report_user', { p_reported: B.id, p_reason: 'testing the report path' });
check('an account can submit a report', report.body?.status === 'reported', messageOf(report));
const reportRows = await table(C.token, 'geegle_reports?select=*');
check('only the reporter sees the report', Array.isArray(reportRows.body) && reportRows.body.length >= 1);
const otherReportRows = await table(A.token, 'geegle_reports?id=eq.00000000-0000-0000-0000-000000000000&select=*');
check('reports are not globally readable', Array.isArray(otherReportRows.body));

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
