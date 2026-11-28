// Chat: public room, direct messages, groups, forwarding, edits, unsending,
// private per-account backgrounds and live updates.
//
// Every mutation is an RPC that derives the caller from the session; the client
// never sends "who am I". Responses are untrusted input, so only the fields the
// interface uses are kept. Database failures are translated into short, honest
// messages: a deployment without the chat migration says so instead of showing
// an empty room.

import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';
import type { OpResult } from '../types';

export type ChatKind = 'public' | 'dm' | 'group';

export interface ChatLastMessage {
  id: string;
  authorName: string;
  body: string | null;
  unsent: boolean;
  forwarded: boolean;
  createdAt: string;
  mine: boolean;
}

export interface ChatConversation {
  id: string;
  kind: ChatKind;
  title: string;
  otherUserId: string | null;
  role: 'owner' | 'member';
  /** Pinned by this account; public chat is always first by rule. */
  pinned: boolean;
  memberCount: number;
  lastActivityAt: string;
  lastMessage: ChatLastMessage | null;
  unread: number;
}

export interface ForwardPreview {
  messageId: string;
  conversationId: string | null;
  authorName: string;
  createdAt: string;
  available: boolean;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  body: string | null;
  createdAt: string;
  editedAt: string | null;
  unsent: boolean;
  /** Removed by a moderator; the text is gone for everyone. */
  moderated: boolean;
  authorId: string | null;
  authorName: string;
  mine: boolean;
  forwarded: ForwardPreview | null;
}

export interface ChatMember {
  userId: string;
  username: string;
  role: 'owner' | 'member';
}

export type BackgroundKind = 'default' | 'solid' | 'color' | 'image';

export interface ChatBackground {
  kind: BackgroundKind;
  color: string | null;
  imagePath: string | null;
  overlay: number;
}

export const DEFAULT_BACKGROUND: ChatBackground = {
  kind: 'default',
  color: null,
  imagePath: null,
  overlay: 0,
};

export const SOLID_PRESETS = [
  '#1f2937',
  '#3b0764',
  '#0c4a6e',
  '#14532d',
  '#7c2d12',
  '#4c0519',
];

const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const num = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
const nullableText = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

const KINDS: ChatKind[] = ['public', 'dm', 'group'];

export function parseConversation(value: unknown): ChatConversation | null {
  if (!isObject(value)) return null;
  const id = text(value.id);
  const kind = text(value.kind) as ChatKind;
  if (!id || !KINDS.includes(kind)) return null;
  const last = isObject(value.lastMessage) ? value.lastMessage : null;
  return {
    id,
    kind,
    title: text(value.title) || 'Conversation',
    otherUserId: nullableText(value.otherUserId),
    role: text(value.role) === 'owner' ? 'owner' : 'member',
    pinned: value.pinned === true,
    memberCount: num(value.memberCount),
    lastActivityAt: text(value.lastActivityAt),
    lastMessage: last
      ? {
          id: text(last.id),
          authorName: text(last.authorName) || 'Unknown',
          body: nullableText(last.body),
          unsent: last.unsent === true,
          forwarded: last.forwarded === true,
          createdAt: text(last.createdAt),
          mine: last.mine === true,
        }
      : null,
    unread: num(value.unread),
  };
}

export function parseConversations(value: unknown): ChatConversation[] {
  if (!Array.isArray(value)) return [];
  return value.map(parseConversation).filter((entry): entry is ChatConversation => Boolean(entry));
}

export function parseMessage(value: unknown): ChatMessage | null {
  if (!isObject(value)) return null;
  const id = text(value.id);
  const conversationId = text(value.conversationId);
  if (!id || !conversationId) return null;
  const forwarded = isObject(value.forwarded) ? value.forwarded : null;
  return {
    id,
    conversationId,
    body: nullableText(value.body),
    createdAt: text(value.createdAt),
    editedAt: nullableText(value.editedAt),
    unsent: value.unsent === true,
    moderated: value.moderated === true,
    authorId: nullableText(value.authorId),
    authorName: text(value.authorName) || 'Deleted account',
    mine: value.mine === true,
    forwarded: forwarded
      ? {
          messageId: text(forwarded.messageId),
          conversationId: nullableText(forwarded.conversationId),
          authorName: text(forwarded.authorName) || 'Unknown',
          createdAt: text(forwarded.createdAt),
          available: forwarded.available === true,
        }
      : null,
  };
}

export function parseMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(parseMessage)
    .filter((entry): entry is ChatMessage => Boolean(entry))
    // The database returns newest first; the thread reads oldest first.
    .sort((a, b) => (a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt)));
}

export function parseBackground(value: unknown): ChatBackground {
  if (!isObject(value)) return { ...DEFAULT_BACKGROUND };
  const kind = text(value.kind) as BackgroundKind;
  if (!['default', 'solid', 'color', 'image'].includes(kind)) return { ...DEFAULT_BACKGROUND };
  return {
    kind,
    color: nullableText(value.color),
    imagePath: nullableText(value.imagePath),
    overlay: Math.min(Math.max(num(value.overlay), 0), 90),
  };
}

const CHAT_ERRORS: Record<string, string> = {
  not_authenticated: 'Sign in to chat.',
  rate_limited: 'You are sending messages too quickly. Wait a moment.',
  invalid_target: 'That account cannot be used here.',
  not_friends: 'Direct messages need an accepted friend.',
  blocked: 'That account cannot be contacted.',
  conversation_not_found: 'That conversation is no longer available.',
  message_not_found: 'That message is no longer available.',
  message_empty: 'Write something first.',
  message_too_long: 'That message is too long (4,000 characters).',
  message_unsent: 'That message was unsent.',
  not_author: 'You can only change your own messages.',
  title_required: 'Give the group a name.',
  title_too_long: 'Keep the group name under 60 characters.',
  owner_only: 'Only the group owner can do that.',
  not_a_group: 'That is not a group.',
  not_a_member: 'You are not in that group.',
  group_full: 'That group is full (25 members).',
  forward_not_allowed: 'That message cannot be forwarded there.',
  not_a_dm: 'Backgrounds are only available in direct messages.',
  invalid_color: 'Use a hex colour such as #1f2937.',
  invalid_image: 'That image could not be used.',
  invalid_background: 'That background is not supported.',
  reason_required: 'Describe the problem first.',
  not_pinnable: 'The public room is always first and cannot be pinned.',
  forward_not_editable: 'A forwarded message cannot be edited.',
  muted: 'A moderator has paused your public chat. You can still use direct messages.',
  not_moderator: 'That tool is only available to moderators.',
  not_public: 'Only public messages can be removed.',
  report_not_found: 'That report was already handled.',
  duplicate: 'That request is already pending.',
};

/** A deployment whose database has not been migrated reports it plainly. */
function missingSchema(raw: string, code: string): boolean {
  return (
    code === 'PGRST202' ||
    code === 'PGRST205' ||
    /schema cache/i.test(raw) ||
    /Could not find the (table|function)/i.test(raw)
  );
}

function failure(error: { message?: string; code?: string } | null): string {
  const raw = (error?.message ?? '').trim();
  const code = error?.code ?? '';
  if (missingSchema(raw, code)) {
    return 'Chat is not available on this deployment yet. Try again later.';
  }
  if (code === '42501' || /permission denied/i.test(raw)) {
    return 'You do not have access to that.';
  }
  return CHAT_ERRORS[raw] ?? (raw || 'Something went wrong.');
}

function unavailable<T>(): OpResult<T> {
  return { ok: false, error: 'Chat needs an account on this deployment.' };
}

async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<OpResult<T>> {
  if (!isSupabaseConfigured) return unavailable<T>();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: failure(error) };
  return { ok: true, data: data as T };
}

export async function loadConversations(): Promise<OpResult<ChatConversation[]>> {
  const result = await call<unknown>('geegle_chat_overview');
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: parseConversations(result.data) };
}

export async function loadMessages(
  conversationId: string,
  before?: { createdAt: string; id: string } | null,
  limit = 30,
): Promise<OpResult<ChatMessage[]>> {
  const result = await call<unknown>('geegle_chat_messages', {
    p_conversation: conversationId,
    p_before: before?.createdAt ?? null,
    p_before_id: before?.id ?? null,
    p_limit: limit,
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: parseMessages(result.data) };
}

export const openDirectMessage = (userId: string) =>
  call<{ conversationId: string }>('geegle_chat_open_dm', { p_other: userId });

export const createGroup = (title: string) =>
  call<{ conversationId: string }>('geegle_chat_create_group', { p_title: title });

export const renameGroup = (conversationId: string, title: string) =>
  call<{ status: string }>('geegle_chat_rename_group', { p_conversation: conversationId, p_title: title });

export const inviteToGroup = (conversationId: string, userId: string) =>
  call<{ status: string }>('geegle_chat_invite', { p_conversation: conversationId, p_user: userId });

export const leaveGroup = (conversationId: string) =>
  call<{ status: string }>('geegle_chat_leave_group', { p_conversation: conversationId });

export const transferOwnership = (conversationId: string, userId: string) =>
  call<{ status: string }>('geegle_chat_transfer_ownership', {
    p_conversation: conversationId,
    p_user: userId,
  });

export const sendMessage = (conversationId: string, body: string) =>
  call<{ messageId: string }>('geegle_chat_send', { p_conversation: conversationId, p_body: body });

export const editMessage = (messageId: string, body: string) =>
  call<{ status: string }>('geegle_chat_edit', { p_message: messageId, p_body: body });

export const unsendMessage = (messageId: string) =>
  call<{ status: string }>('geegle_chat_unsend', { p_message: messageId });

export const hideMessage = (messageId: string) =>
  call<{ status: string }>('geegle_chat_hide', { p_message: messageId });

export const reportMessage = (messageId: string, reason: string) =>
  call<{ status: string }>('geegle_chat_report', { p_message: messageId, p_reason: reason });

export const markRead = (conversationId: string) =>
  call<{ status: string }>('geegle_chat_mark_read', { p_conversation: conversationId });

export const forwardMessage = (messageId: string, conversationId: string) =>
  call<{ messageId: string }>('geegle_chat_forward', {
    p_message: messageId,
    p_conversation: conversationId,
  });

export async function loadMembers(conversationId: string): Promise<OpResult<ChatMember[]>> {
  const result = await call<unknown>('geegle_chat_members', { p_conversation: conversationId });
  if (!result.ok) return { ok: false, error: result.error };
  const rows = Array.isArray(result.data) ? result.data : [];
  return {
    ok: true,
    data: rows
      .map((entry) => {
        if (!isObject(entry)) return null;
        const userId = text(entry.userId);
        const username = text(entry.username);
        if (!userId || !username) return null;
        return { userId, username, role: text(entry.role) === 'owner' ? 'owner' : 'member' } as ChatMember;
      })
      .filter((entry): entry is ChatMember => Boolean(entry)),
  };
}

export async function loadBackground(conversationId: string): Promise<OpResult<ChatBackground>> {
  const result = await call<unknown>('geegle_chat_background', { p_conversation: conversationId });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: parseBackground(result.data) };
}

export async function saveBackground(
  conversationId: string,
  background: ChatBackground,
): Promise<OpResult<ChatBackground>> {
  const result = await call<unknown>('geegle_chat_set_background', {
    p_conversation: conversationId,
    p_kind: background.kind,
    p_color: background.color,
    p_image_path: background.imagePath,
    p_overlay: background.overlay,
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: parseBackground(result.data) };
}

// --- live updates ---------------------------------------------------------
//
// One channel per account for the whole app, owned here rather than by a
// component: React mounts effects twice in development, and two channels on
// one topic fight each other. RLS decides which rows each account receives.

let chatChannel: RealtimeChannel | null = null;
let chatChannelUser: string | null = null;
let chatQueue: Promise<void> = Promise.resolve();
const chatListeners = new Set<() => void>();

function notifyChat() {
  for (const listener of chatListeners) listener();
}

function connectChat(userId: string) {
  chatQueue = chatQueue.then(async () => {
    if (chatChannelUser === userId && chatChannel) return;
    const previous = chatChannel;
    chatChannel = null;
    if (previous) await supabase.removeChannel(previous);
    chatChannelUser = userId;
    const channel = supabase
      .channel(`geegle:chat:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'geegle_messages' }, notifyChat)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'geegle_conversations' }, notifyChat)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'geegle_conversation_members' }, notifyChat);
    chatChannel = channel;
    channel.subscribe();
  });
  return chatQueue;
}

/** Subscribes to chat changes; returns an unsubscribe function. */
export function watchChat(userId: string | null, onChange: () => void): () => void {
  chatListeners.add(onChange);
  if (userId && isSupabaseConfigured) void connectChat(userId);
  return () => {
    chatListeners.delete(onChange);
  };
}

// --- DM background images -------------------------------------------------

export const BACKGROUND_BUCKET = 'geegle-chat-backgrounds';
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const TARGET_MAX_DIMENSION = 1600;
const TARGET_QUALITY = 0.85;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

async function decode(file: File): Promise<{ width: number; height: number; draw: (canvas: HTMLCanvasElement) => void; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (canvas) => canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height),
      close: () => bitmap.close(),
    };
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('invalid_image'));
      element.src = url;
    });
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      draw: (canvas) => canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height),
      close: () => undefined,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Validates, downscales and re-encodes a background picture in the browser, so
 * the upload is small and can never carry an unexpected format.
 */
export async function prepareBackgroundImage(
  file: File,
): Promise<{ ok: boolean; blob?: Blob; error?: string }> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, error: 'Choose a PNG, JPEG or WebP image.' };
  }
  if (file.size > MAX_SOURCE_BYTES) {
    return { ok: false, error: 'That image is too large (15 MB maximum).' };
  }
  try {
    const source = await decode(file);
    const scale = Math.min(1, TARGET_MAX_DIMENSION / Math.max(source.width, source.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(source.width * scale));
    canvas.height = Math.max(1, Math.round(source.height * scale));
    source.draw(canvas);
    source.close();
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', TARGET_QUALITY);
    });
    if (!blob) return { ok: false, error: 'That image could not be processed.' };
    if (blob.size > 3 * 1024 * 1024) {
      return { ok: false, error: 'That image is still too large after resizing.' };
    }
    return { ok: true, blob };
  } catch {
    return { ok: false, error: 'That image could not be read.' };
  }
}

export async function uploadBackgroundImage(
  conversationId: string,
  userId: string,
  blob: Blob,
): Promise<OpResult<string>> {
  if (!isSupabaseConfigured) return unavailable<string>();
  const path = `${userId}/${conversationId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(BACKGROUND_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (error) {
    const raw = (error.message ?? '').toLowerCase();
    if (raw.includes('bucket') || raw.includes('not found')) {
      return { ok: false, error: 'Image backgrounds are not available on this deployment yet.' };
    }
    if (raw.includes('policy') || raw.includes('unauthorized') || raw.includes('row-level')) {
      return { ok: false, error: 'That picture could not be saved for your account.' };
    }
    return { ok: false, error: 'That picture could not be uploaded.' };
  }
  return { ok: true, data: path };
}

/** A short-lived signed link; the bucket itself is private. */
export async function backgroundImageUrl(path: string): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.storage
    .from(BACKGROUND_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Removes one of this account's own background pictures. */
export async function deleteBackgroundImage(path: string, userId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  if (!path.startsWith(`${userId}/`)) return;
  await supabase.storage.from(BACKGROUND_BUCKET).remove([path]);
}

// --- presentation helpers --------------------------------------------------

/** Local wall-clock time for one message. */
export function messageTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** A stable local calendar key, e.g. 2026-11-28, for day separators. */
export function dayKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** "Today", "Yesterday" or a written date for a day separator. */
export function dayLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const today = dayKey(now.toISOString());
  const key = dayKey(iso);
  if (key === today) return 'Today';
  const yesterday = new Date(now.getTime() - 86_400_000);
  if (key === dayKey(yesterday.toISOString())) return 'Yesterday';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Short "3m", "2h", "4d" stamp for the conversation list. */
export function relativeStamp(iso: string, now = Date.now()): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return '';
  const seconds = Math.max(0, Math.round((now - time) / 1000));
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// --- unread summary -------------------------------------------------------
//
// The Chat tab badge is derived from the same conversation list the sidebar
// shows, so it cannot drift from it. Public chat contributes a dot; private
// and group conversations contribute a combined count capped at 99+.

export interface ChatUnreadSummary {
  publicUnread: number;
  privateUnread: number;
}

const EMPTY_UNREAD: ChatUnreadSummary = { publicUnread: 0, privateUnread: 0 };

let unreadSummary: ChatUnreadSummary = EMPTY_UNREAD;
const unreadListeners = new Set<() => void>();

export function summarizeUnread(conversations: ChatConversation[]): ChatUnreadSummary {
  let publicUnread = 0;
  let privateUnread = 0;
  for (const conversation of conversations) {
    if (conversation.kind === 'public') publicUnread += conversation.unread;
    else privateUnread += conversation.unread;
  }
  return { publicUnread, privateUnread };
}

export function setUnreadSummary(next: ChatUnreadSummary): void {
  if (next.publicUnread === unreadSummary.publicUnread && next.privateUnread === unreadSummary.privateUnread) {
    return;
  }
  unreadSummary = next;
  for (const listener of unreadListeners) listener();
}

export function getUnreadSummary(): ChatUnreadSummary {
  return unreadSummary;
}

export function watchUnreadSummary(listener: () => void): () => void {
  unreadListeners.add(listener);
  return () => {
    unreadListeners.delete(listener);
  };
}

/** `99+` is the only cap; the stored number stays exact. */
export function unreadBadge(count: number): string {
  return count > 99 ? '99+' : String(count);
}

// --- pins -----------------------------------------------------------------

export const setPinned = (conversationId: string, pinned: boolean) =>
  call<{ pinned: boolean }>('geegle_chat_set_pinned', {
    p_conversation: conversationId,
    p_pinned: pinned,
  });

// --- moderation -----------------------------------------------------------
//
// Moderator status is never inferred from the client: the database answers
// whether this account holds the grant, and every action re-checks it.

export interface ModerationReport {
  reportId: string;
  reason: string;
  createdAt: string;
  reporter: string;
  kind: ChatKind;
  conversationTitle: string;
  messageId: string;
  authorName: string;
  /** Only ever populated for public messages. */
  authorId: string | null;
  /** Only ever populated for public messages. */
  body: string | null;
  alreadyRemoved: boolean;
}

export interface ModerationAction {
  id: string;
  action: string;
  moderator: string;
  targetUser: string | null;
  targetMessage: string | null;
  reportId: string | null;
  reason: string | null;
  createdAt: string;
}

export async function amModerator(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const { data, error } = await supabase.rpc('geegle_is_moderator');
  return !error && data === true;
}

export async function loadModerationQueue(): Promise<OpResult<ModerationReport[]>> {
  const result = await call<unknown>('geegle_mod_queue');
  if (!result.ok) return { ok: false, error: result.error };
  const rows = Array.isArray(result.data) ? result.data : [];
  return {
    ok: true,
    data: rows
      .map((entry) => {
        if (!isObject(entry)) return null;
        const kind = text(entry.kind) as ChatKind;
        if (!KINDS.includes(kind)) return null;
        const reportId = text(entry.reportId);
        const messageId = text(entry.messageId);
        if (!reportId || !messageId) return null;
        return {
          reportId,
          messageId,
          kind,
          reason: text(entry.reason),
          createdAt: text(entry.createdAt),
          reporter: text(entry.reporter) || 'Unknown',
          conversationTitle: text(entry.conversationTitle) || 'Conversation',
          authorName: text(entry.authorName) || 'Deleted account',
          authorId: nullableText(entry.authorId),
          body: nullableText(entry.body),
          alreadyRemoved: entry.alreadyRemoved === true,
        } as ModerationReport;
      })
      .filter((entry): entry is ModerationReport => Boolean(entry)),
  };
}

export const removeMessageAsModerator = (messageId: string, reason: string, reportId: string | null) =>
  call<{ status: string }>('geegle_mod_remove_message', {
    p_message: messageId,
    p_reason: reason,
    p_report: reportId,
  });

export const muteUserAsModerator = (userId: string, minutes: number, reason: string) =>
  call<{ until: string }>('geegle_mod_mute', {
    p_user: userId,
    p_minutes: minutes,
    p_reason: reason,
  });

export const resolveReportAsModerator = (reportId: string, resolution: 'removed' | 'dismissed') =>
  call<{ status: string }>('geegle_mod_resolve_report', {
    p_report: reportId,
    p_resolution: resolution,
  });

export async function loadModerationHistory(): Promise<OpResult<ModerationAction[]>> {
  const result = await call<unknown>('geegle_mod_history');
  if (!result.ok) return { ok: false, error: result.error };
  const rows = Array.isArray(result.data) ? result.data : [];
  return {
    ok: true,
    data: rows
      .map((entry) => {
        if (!isObject(entry)) return null;
        const id = text(entry.id);
        if (!id) return null;
        return {
          id,
          action: text(entry.action),
          moderator: text(entry.moderator) || 'Unknown',
          targetUser: nullableText(entry.targetUser),
          targetMessage: nullableText(entry.targetMessage),
          reportId: nullableText(entry.reportId),
          reason: nullableText(entry.reason),
          createdAt: text(entry.createdAt),
        } as ModerationAction;
      })
      .filter((entry): entry is ModerationAction => Boolean(entry)),
  };
}
