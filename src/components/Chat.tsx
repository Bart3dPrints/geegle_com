// Chat: the public room, direct messages and groups in one compact surface.
//
// Everything a person can do is decided by the database: the three-dot menu
// only offers actions the server will accept, and the server refuses the rest
// even if the client asks. Guests are asked to sign in; nothing private is
// fetched until an account exists.

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Forward,
  Loader2,
  MessageSquare,
  MoreVertical,
  Palette,
  Pencil,
  Plus,
  Send,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  backgroundImageUrl,
  createGroup,
  dayKey,
  dayLabel,
  editMessage,
  forwardMessage,
  hideMessage,
  inviteToGroup,
  leaveGroup,
  loadBackground,
  loadMembers,
  loadConversations,
  loadMessages,
  markRead,
  messageTime,
  openDirectMessage,
  relativeStamp,
  renameGroup,
  reportMessage,
  sendMessage,
  transferOwnership,
  unsendMessage,
  watchChat,
  type ChatBackground,
  type ChatConversation,
  type ChatMessage,
  DEFAULT_BACKGROUND,
} from '../lib/chat';
import { loadSocial, type SocialFriend } from '../lib/friends';
import { ChatBackgroundEditor } from './chat/ChatBackgroundEditor';
import { ForwardDialog } from './chat/ForwardDialog';

const iconButton =
  'rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 disabled:opacity-40 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100';
const smallButton =
  'rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800';
const menuItem =
  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800';

function kindLabel(conversation: ChatConversation): string {
  if (conversation.kind === 'public') return 'Public room';
  if (conversation.kind === 'group') return `${conversation.memberCount} members`;
  return 'Direct message';
}

function ForwardEmbed({
  message,
  onOpen,
}: {
  message: ChatMessage;
  onOpen: () => void;
}) {
  const forwarded = message.forwarded;
  if (!forwarded) return null;
  const when = forwarded.createdAt ? messageTime(forwarded.createdAt) : '';
  return (
    <div className="mb-1 rounded border-l-2 border-neutral-400 bg-neutral-100/80 px-2 py-1 text-[11px] text-neutral-600 dark:border-neutral-500 dark:bg-neutral-800/70 dark:text-neutral-300">
      <div className="mb-0.5 flex items-center gap-1 font-medium">
        <Forward size={11} /> Forwarded from {forwarded.authorName}
        {when && <span className="font-normal text-neutral-500 dark:text-neutral-400">· {when}</span>}
      </div>
      {forwarded.available ? (
        <button
          className="underline-offset-2 hover:underline"
          onClick={onOpen}
          data-forward-original={forwarded.messageId}
        >
          View original
        </button>
      ) : (
        <span className="italic text-neutral-500 dark:text-neutral-400">
          Original message is no longer available
        </span>
      )}
    </div>
  );
}

function MessageRow({
  message,
  showAuthor,
  menuOpen,
  editing,
  editText,
  busy,
  highlighted,
  onToggleMenu,
  onCloseMenu,
  onStartEdit,
  onEditText,
  onSaveEdit,
  onCancelEdit,
  onUnsend,
  onHide,
  onForward,
  onReport,
  onOpenOriginal,
}: {
  message: ChatMessage;
  showAuthor: boolean;
  menuOpen: boolean;
  editing: boolean;
  editText: string;
  busy: boolean;
  highlighted: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onStartEdit: () => void;
  onEditText: (value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onUnsend: () => void;
  onHide: () => void;
  onForward: () => void;
  onReport: () => void;
  onOpenOriginal: () => void;
}) {
  const canEdit = message.mine && !message.unsent;
  const canUnsend = message.mine && !message.unsent;
  const canForward = !message.unsent;

  return (
    <div
      className={`group relative rounded px-2 py-1 ${highlighted ? 'bg-amber-100/70 ring-1 ring-amber-400 dark:bg-amber-500/20' : ''}`}
      data-message={message.id}
      data-unsent={message.unsent ? 'true' : 'false'}
    >
      {showAuthor && (
        <div className="flex items-baseline gap-1.5">
          <span className="truncate text-xs font-semibold">{message.authorName}</span>
          <span className="shrink-0 text-[11px] text-neutral-500 dark:text-neutral-400">
            {messageTime(message.createdAt)}
          </span>
          {message.editedAt && !message.unsent && (
            <span className="text-[10px] text-neutral-400" title="Edited">
              edited
            </span>
          )}
        </div>
      )}

      {editing ? (
        <div className="mt-1">
          <textarea
            className="input w-full text-sm"
            rows={2}
            value={editText}
            maxLength={4000}
            aria-label="Edit message"
            onChange={(event) => onEditText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                onSaveEdit();
              }
              if (event.key === 'Escape') onCancelEdit();
            }}
          />
          <div className="mt-1 flex gap-1">
            <button className="btn-primary px-2 py-1 text-xs" onClick={onSaveEdit} disabled={busy}>
              Save
            </button>
            <button className={smallButton} onClick={onCancelEdit} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      ) : message.unsent ? (
        <p className="text-sm italic text-neutral-500 dark:text-neutral-400">Message unsent</p>
      ) : (
        <>
          <ForwardEmbed message={message} onOpen={onOpenOriginal} />
          <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
        </>
      )}

      <div className="absolute right-1 top-0.5 opacity-0 focus-within:opacity-100 group-hover:opacity-100">
        <button
          className={iconButton}
          aria-label={`Message options for ${message.authorName}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={onToggleMenu}
          data-message-menu={message.id}
        >
          <MoreVertical size={13} />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={onCloseMenu} aria-hidden="true" />
            <div
              className="absolute right-0 top-full z-20 w-40 overflow-hidden rounded-md border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
              role="menu"
            >
              {canEdit && (
                <button className={menuItem} role="menuitem" onClick={onStartEdit}>
                  <Pencil size={12} /> Edit
                </button>
              )}
              {canUnsend && (
                <button className={menuItem} role="menuitem" onClick={onUnsend}>
                  <X size={12} /> Unsend
                </button>
              )}
              <button className={menuItem} role="menuitem" onClick={onHide}>
                <Trash2 size={12} /> Delete for me
              </button>
              {canForward && (
                <button className={menuItem} role="menuitem" onClick={onForward}>
                  <Forward size={12} /> Forward
                </button>
              )}
              {!message.mine && (
                <button className={menuItem} role="menuitem" onClick={onReport}>
                  <MessageSquare size={12} /> Report
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function BackgroundLayer({
  background,
  imageUrl,
}: {
  background: ChatBackground;
  imageUrl: string | null;
}) {
  if (background.kind === 'default') return null;
  const base =
    background.kind === 'image' && imageUrl
      ? { backgroundImage: `url("${imageUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : background.kind === 'image'
        ? { backgroundColor: '#3f3f46' }
        : { backgroundColor: background.color ?? '#3f3f46' };
  return (
    <div
      className="pointer-events-none absolute inset-0"
      aria-hidden="true"
      data-chat-background={background.kind}
      data-overlay={background.overlay}
    >
      <div className="absolute inset-0" style={base} />
      {background.overlay > 0 && (
        <div className="absolute inset-0 bg-neutral-950" style={{ opacity: background.overlay / 100 }} />
      )}
    </div>
  );
}

interface ChatMember {
  userId: string;
  username: string;
  role: 'owner' | 'member';
}

function initials(name: string): string {
  return name.slice(0, 1).toUpperCase() || '?';
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-sm p-4"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button className="rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Chat({
  userId,
  onRequestSignIn,
}: {
  userId: string | null;
  onRequestSignIn: () => void;
}) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [olderLoading, setOlderLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [forwardFor, setForwardFor] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [background, setBackground] = useState<ChatBackground>(DEFAULT_BACKGROUND);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [previewBackground, setPreviewBackground] = useState<ChatBackground | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [backgroundOpen, setBackgroundOpen] = useState(false);
  const [picker, setPicker] = useState<'dm' | 'invite' | 'members' | 'renaming' | 'group' | null>(null);
  const [friends, setFriends] = useState<SocialFriend[]>([]);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [membersBusy, setMembersBusy] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  const threadRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ selectedId, hasMore });
  stateRef.current = { selectedId, hasMore };

  const selected = useMemo(
    () => conversations.find((entry) => entry.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const refreshConversations = useCallback(async () => {
    if (!userId) return;
    const result = await loadConversations();
    if (!result.ok) {
      setError(result.error ?? 'Conversations could not be loaded.');
      setLoading(false);
      return;
    }
    setError(null);
    setConversations(result.data ?? []);
    setLoading(false);
  }, [userId]);

  const loadThread = useCallback(async (id: string) => {
    setThreadLoading(true);
    setThreadError(null);
    const result = await loadMessages(id, null, 30);
    if (!result.ok) {
      setThreadError(result.error ?? 'Messages could not be loaded.');
      setMessages([]);
      setHasMore(false);
    } else {
      const rows = result.data ?? [];
      setMessages(rows);
      setHasMore(rows.length === 30);
    }
    setThreadLoading(false);
  }, []);

  // A new account starts from a clean surface.
  useEffect(() => {
    setConversations([]);
    setMessages([]);
    setSelectedId(null);
    setDraft('');
    setError(null);
    setThreadError(null);
    setBackground(DEFAULT_BACKGROUND);
    setBackgroundUrl(null);
    setLoading(Boolean(userId));
    if (userId) void refreshConversations();
    else setLoading(false);
  }, [userId, refreshConversations]);

  // Live updates: the list and the open thread follow the database.
  useEffect(() => {
    if (!userId) return;
    let timer = 0;
    return watchChat(userId, () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        const current = stateRef.current;
        if (current.selectedId && !current.hasMore) {
          await loadThread(current.selectedId);
          // A message that arrives in the open conversation is already read.
          await markRead(current.selectedId);
        }
        await refreshConversations();
      }, 250);
    });
  }, [userId, refreshConversations, loadThread]);

  // Pick the public room on first load, so the tab is never an empty shell.
  useEffect(() => {
    if (selectedId || conversations.length === 0) return;
    const first = conversations.find((entry) => entry.kind === 'public') ?? conversations[0];
    setSelectedId(first.id);
  }, [conversations, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    // Opening a conversation clears its badge at once, then confirms it with
    // the database so another device sees the same read state.
    setConversations((current) =>
      current.map((entry) => (entry.id === selectedId ? { ...entry, unread: 0 } : entry)),
    );
    void loadThread(selectedId);
    void markRead(selectedId).then(() => refreshConversations());
  }, [selectedId, loadThread, refreshConversations]);

  // The DM background belongs to this account only. Keyed by conversation id
  // (not by the conversation object) so a live refresh cannot close the editor.
  const backgroundConversationId = selected?.kind === 'dm' ? selected.id : null;
  useEffect(() => {
    let cancelled = false;
    setBackground(DEFAULT_BACKGROUND);
    setBackgroundUrl(null);
    setPreviewBackground(null);
    setPreviewUrl(null);
    setBackgroundOpen(false);
    if (!backgroundConversationId) return;
    void loadBackground(backgroundConversationId).then(async (result) => {
      if (cancelled || !result.ok || !result.data) return;
      setBackground(result.data);
      if (result.data.kind === 'image' && result.data.imagePath) {
        const url = await backgroundImageUrl(result.data.imagePath);
        if (!cancelled) setBackgroundUrl(url);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [backgroundConversationId]);

  // New messages land at the bottom when the reader is already there.
  useEffect(() => {
    const element = threadRef.current;
    if (!element || hasMore) return;
    element.scrollTop = element.scrollHeight;
  }, [messages, hasMore, selectedId]);

  // Clicking a forward jumps to the original and highlights it briefly.
  useEffect(() => {
    if (!focusId || !messages.some((message) => message.id === focusId)) return;
    const element = threadRef.current?.querySelector(`[data-message="${focusId}"]`);
    element?.scrollIntoView({ block: 'center' });
    const timer = window.setTimeout(() => setFocusId(null), 2600);
    return () => window.clearTimeout(timer);
  }, [focusId, messages]);

  if (!userId) {
    return (
      <section aria-label="Chat" className="mx-auto w-full max-w-md">
        <div className="card p-6 text-center">
          <h2 className="mb-1 text-base font-semibold">Chat</h2>
          <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
            Sign in to join the public room and message your friends.
          </p>
          <button className="btn-primary" onClick={onRequestSignIn}>
            Sign in
          </button>
        </div>
      </section>
    );
  }

  const run = async (tag: string, action: () => Promise<{ ok: boolean; error?: string }>) => {
    if (busy) return false;
    setBusy(tag);
    setError(null);
    try {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? 'That did not work.');
        return false;
      }
      return true;
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    const body = draft.trim();
    if (!body || !selectedId || busy) return;
    const id = selectedId;
    setBusy('send');
    try {
      const result = await sendMessage(id, body);
      if (!result.ok) {
        setError(result.error ?? 'That message was not sent.');
        return;
      }
      setDraft('');
      await loadThread(id);
      await refreshConversations();
    } finally {
      setBusy(null);
    }
  };

  const loadOlder = async () => {
    if (!selectedId || olderLoading || messages.length === 0) return;
    setOlderLoading(true);
    const oldest = messages[0];
    const result = await loadMessages(selectedId, { createdAt: oldest.createdAt, id: oldest.id }, 30);
    if (!result.ok) setThreadError(result.error ?? 'Earlier messages could not be loaded.');
    else {
      const rows = result.data ?? [];
      setMessages((current) => [...rows.filter((row) => !current.some((m) => m.id === row.id)), ...current]);
      setHasMore(rows.length === 30);
    }
    setOlderLoading(false);
  };

  const startEdit = (message: ChatMessage) => {
    setMenuFor(null);
    setEditingId(message.id);
    setEditText(message.body ?? '');
  };

  const saveEdit = async () => {
    if (!editingId || !selectedId) return;
    const body = editText.trim();
    if (!body) return;
    const ok = await run('edit', () => editMessage(editingId, body));
    if (ok) {
      setEditingId(null);
      setEditText('');
      await loadThread(selectedId);
    }
  };

  const unsend = async (message: ChatMessage) => {
    setMenuFor(null);
    if (!selectedId) return;
    const ok = await run('unsend', () => unsendMessage(message.id));
    if (ok) {
      await loadThread(selectedId);
      await refreshConversations();
    }
  };

  const hide = async (message: ChatMessage) => {
    setMenuFor(null);
    if (!selectedId) return;
    const ok = await run('hide', () => hideMessage(message.id));
    if (ok) {
      setMessages((current) => current.filter((row) => row.id !== message.id));
      await refreshConversations();
    }
  };

  const report = async (message: ChatMessage) => {
    setMenuFor(null);
    const reason = window.prompt('Report this message to the site owner. What is wrong with it?');
    if (!reason || !reason.trim()) return;
    const ok = await run('report', () => reportMessage(message.id, reason.trim()));
    if (ok) setNotice('Report sent. Thank you.');
  };

  const forward = async (targetId: string) => {
    if (!forwardFor) return;
    const sourceId = forwardFor;
    setForwardFor(null);
    const ok = await run('forward', () => forwardMessage(sourceId, targetId));
    if (ok) {
      setSelectedId(targetId);
      await refreshConversations();
    }
  };

  const openOriginal = (message: ChatMessage) => {
    const forwarded = message.forwarded;
    if (!forwarded?.conversationId || !forwarded.available) return;
    setSelectedId(forwarded.conversationId);
    setFocusId(forwarded.messageId);
  };

  const openFriends = async (mode: 'dm' | 'invite') => {
    setPicker(mode);
    const result = await loadSocial();
    if (result.ok && result.data) setFriends(result.data.friends);
    else setFriends([]);
  };

  const startDirectMessage = async (friend: SocialFriend) => {
    const ok = await run('dm', async () => {
      const result = await openDirectMessage(friend.userId);
      if (!result.ok) return { ok: false, error: result.error };
      setPicker(null);
      await refreshConversations();
      setSelectedId(result.data?.conversationId ?? null);
      return { ok: true };
    });
    if (!ok) setPicker(null);
  };

  const submitGroup = async () => {
    const title = titleDraft.trim();
    if (!title) return;
    const ok = await run('group', async () => {
      const result = await createGroup(title);
      if (!result.ok) return { ok: false, error: result.error };
      setPicker(null);
      setTitleDraft('');
      await refreshConversations();
      setSelectedId(result.data?.conversationId ?? null);
      return { ok: true };
    });
    if (!ok) setPicker(null);
  };

  const submitRename = async () => {
    const title = titleDraft.trim();
    if (!title || !selected) return;
    const ok = await run('rename', () => renameGroup(selected.id, title));
    if (ok) {
      setPicker(null);
      setTitleDraft('');
      await refreshConversations();
    }
  };

  const invite = async (friendId: string) => {
    if (!selected) return;
    const ok = await run('invite', () => inviteToGroup(selected.id, friendId));
    if (ok) {
      setPicker(null);
      await refreshConversations();
    }
  };

  const openMembers = async () => {
    if (!selected) return;
    setPicker('members');
    setMembersBusy(true);
    try {
      const result = await loadMembers(selected.id);
      setMembers(result.ok ? result.data ?? [] : []);
      if (!result.ok) setError(result.error ?? null);
    } finally {
      setMembersBusy(false);
    }
  };

  const makeOwner = async (member: ChatMember) => {
    if (!selected) return;
    const ok = await run('transfer', () => transferOwnership(selected.id, member.userId));
    if (ok) await refreshConversations();
  };

  const leave = async () => {
    if (!selected) return;
    const ok = await run('leave', () => leaveGroup(selected.id));
    if (ok) {
      setSelectedId(null);
      setMessages([]);
      await refreshConversations();
    }
  };

  const shownBackground = previewBackground ?? background;
  const shownBackgroundUrl = previewBackground ? previewUrl : backgroundUrl;
  const friendIds = new Set(members.map((member) => member.userId));

  return (
    <section aria-label="Chat" className="mx-auto w-full max-w-5xl">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button className={smallButton} onClick={() => void openFriends('dm')} disabled={Boolean(busy)}>
          <MessageSquare size={13} className="mr-1 inline" /> New message
        </button>
        <button
          className={smallButton}
          onClick={() => {
            setTitleDraft('');
            setPicker('group');
          }}
          disabled={Boolean(busy)}
        >
          <Plus size={13} className="mr-1 inline" /> New group
        </button>
        {error && (
          <p className="ml-auto text-xs text-red-600 dark:text-red-400" role="alert" data-chat-error>
            {error}
            <button
              className="ml-2 underline underline-offset-2"
              onClick={() => {
                setError(null);
                void refreshConversations();
              }}
            >
              Retry
            </button>
          </p>
        )}
      </div>

      {loading && conversations.length === 0 ? (
        <div className="card flex items-center justify-center gap-2 p-8 text-sm text-neutral-500 dark:text-neutral-400">
          <Loader2 size={15} className="animate-spin" /> Loading chat…
        </div>
      ) : error && conversations.length === 0 ? (
        <div className="card p-6 text-center" role="alert" data-chat-failed>
          <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-300">{error}</p>
          <button className="btn-primary" onClick={() => void refreshConversations()}>
            Retry
          </button>
        </div>
      ) : (
        <div className="card flex h-[min(72vh,620px)] min-h-[340px] overflow-hidden p-0">
          {/* Conversation list */}
          <div
            className={`w-full shrink-0 flex-col border-r border-neutral-200 dark:border-neutral-800 md:flex md:w-64 ${
              selectedId ? 'hidden md:flex' : 'flex'
            }`}
            aria-label="Conversations"
          >
            <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
              {conversations.length === 0 ? (
                <p className="p-3 text-xs text-neutral-500 dark:text-neutral-400">
                  No conversations yet. Start one from the buttons above.
                </p>
              ) : (
                conversations.map((conversation) => {
                  const last = conversation.lastMessage;
                  const preview = last
                    ? last.unsent
                      ? 'Message unsent'
                      : `${last.mine ? 'You: ' : ''}${last.body ?? ''}`
                    : conversation.kind === 'dm'
                      ? 'No messages yet'
                      : 'No messages yet';
                  return (
                    <button
                      key={conversation.id}
                      className={`mb-0.5 flex w-full items-start gap-2 rounded px-2 py-1.5 text-left ${
                        conversation.id === selectedId
                          ? 'bg-neutral-100 dark:bg-neutral-800'
                          : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60'
                      }`}
                      onClick={() => {
                        setSelectedId(conversation.id);
                        setMenuFor(null);
                      }}
                      aria-current={conversation.id === selectedId ? 'true' : undefined}
                      data-conversation={conversation.id}
                      data-conversation-kind={conversation.kind}
                    >
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-600 dark:bg-neutral-700 dark:text-neutral-200">
                        {conversation.kind === 'public' ? '#' : conversation.kind === 'group' ? <Users size={13} /> : initials(conversation.title)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-1">
                          <span className="truncate text-sm font-medium">{conversation.title}</span>
                          <span className="shrink-0 text-[10px] text-neutral-400">
                            {relativeStamp(conversation.lastActivityAt)}
                          </span>
                        </span>
                        <span className="flex items-center justify-between gap-1">
                          <span className="truncate text-xs text-neutral-500 dark:text-neutral-400">{preview}</span>
                          {conversation.unread > 0 && (
                            <span
                              className="shrink-0 rounded-full bg-[var(--geegle-accent,#2563eb)] px-1.5 text-[10px] font-semibold leading-4 text-white"
                              aria-label={`${conversation.unread} unread`}
                              data-unread={conversation.unread}
                            >
                              {conversation.unread > 99 ? '99+' : conversation.unread}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Thread */}
          <div className={`min-w-0 flex-1 flex-col md:flex ${selectedId ? 'flex' : 'hidden md:flex'}`}>
            {!selected ? (
              <div className="flex h-full items-center justify-center p-6 text-sm text-neutral-500 dark:text-neutral-400">
                Choose a conversation.
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5 border-b border-neutral-200 px-2 py-1.5 dark:border-neutral-800">
                  <button
                    className={`${iconButton} md:hidden`}
                    onClick={() => setSelectedId(null)}
                    aria-label="Back to conversations"
                  >
                    <ArrowLeft size={15} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-semibold" data-chat-title>
                      {selected.title}
                    </h2>
                    <p className="truncate text-[11px] text-neutral-500 dark:text-neutral-400">{kindLabel(selected)}</p>
                  </div>
                  {selected.kind === 'dm' && (
                    <button
                      className={iconButton}
                      aria-label="Message background"
                      aria-expanded={backgroundOpen}
                      onClick={() => setBackgroundOpen((open) => !open)}
                    >
                      <Palette size={15} />
                    </button>
                  )}
                  {selected.kind === 'group' && (
                    <>
                      <button className={iconButton} aria-label="Group members" onClick={() => void openMembers()}>
                        <Users size={15} />
                      </button>
                      <button
                        className={iconButton}
                        aria-label="Group options"
                        aria-haspopup="menu"
                        aria-expanded={menuFor === 'header'}
                        onClick={() => setMenuFor(menuFor === 'header' ? null : 'header')}
                      >
                        <MoreVertical size={15} />
                      </button>
                      {menuFor === 'header' && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} aria-hidden="true" />
                          <div
                            className="absolute right-2 top-16 z-20 w-40 rounded-md border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
                            role="menu"
                          >
                            <button
                              className={menuItem}
                              role="menuitem"
                              onClick={() => {
                                setMenuFor(null);
                                setTitleDraft(selected.title);
                                setPicker('renaming');
                              }}
                            >
                              <Pencil size={12} /> Rename group
                            </button>
                            <button
                              className={menuItem}
                              role="menuitem"
                              onClick={() => {
                                setMenuFor(null);
                                void openFriends('invite');
                              }}
                            >
                              <UserPlus size={12} /> Invite
                            </button>
                            <button
                              className={menuItem}
                              role="menuitem"
                              onClick={() => {
                                setMenuFor(null);
                                void leave();
                              }}
                            >
                              <X size={12} /> Leave group
                            </button>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>

                <div className="relative min-h-0 flex-1">
                  {selected.kind === 'dm' && (
                    <BackgroundLayer background={shownBackground} imageUrl={shownBackgroundUrl} />
                  )}
                  <div ref={threadRef} className="relative h-full overflow-y-auto px-2 py-2" data-chat-thread>
                    {backgroundOpen && selected.kind === 'dm' && (
                      <ChatBackgroundEditor
                        conversationId={selected.id}
                        userId={userId}
                        background={background}
                        imageUrl={backgroundUrl}
                        onPreview={(next, url) => {
                          setPreviewBackground(next);
                          setPreviewUrl(url);
                        }}
                        onSaved={(next, url) => {
                          setBackground(next);
                          setBackgroundUrl(url);
                          setPreviewBackground(null);
                          setPreviewUrl(null);
                        }}
                        onClose={() => setBackgroundOpen(false)}
                        onError={(message) => setError(message)}
                      />
                    )}
                    {hasMore && (
                      <div className="mb-2 text-center">
                        <button
                          className="text-xs text-neutral-500 underline-offset-2 hover:underline disabled:opacity-50 dark:text-neutral-400"
                          onClick={() => void loadOlder()}
                          disabled={olderLoading}
                        >
                          {olderLoading ? 'Loading…' : 'Load earlier messages'}
                        </button>
                      </div>
                    )}
                    {threadLoading && messages.length === 0 ? (
                      <p className="flex items-center gap-2 py-4 text-xs text-neutral-500 dark:text-neutral-400">
                        <Loader2 size={13} className="animate-spin" /> Loading messages…
                      </p>
                    ) : threadError ? (
                      <div className="p-3 text-center" role="alert" data-thread-error>
                        <p className="mb-2 text-xs text-neutral-600 dark:text-neutral-300">{threadError}</p>
                        <button className="btn-primary px-3 py-1 text-xs" onClick={() => void loadThread(selected.id)}>
                          Retry
                        </button>
                      </div>
                    ) : messages.length === 0 ? (
                      <p className="py-6 text-center text-xs text-neutral-500 dark:text-neutral-400">
                        No messages yet. Say hello.
                      </p>
                    ) : (
                      messages.map((message, index) => {
                        const previous = messages[index - 1];
                        const newDay = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt);
                        const showAuthor =
                          newDay ||
                          !previous ||
                          previous.authorId !== message.authorId ||
                          previous.unsent !== message.unsent;
                        return (
                          <Fragment key={message.id}>
                            {newDay && (
                              <div className="my-2 text-center text-[10px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                                {dayLabel(message.createdAt)}
                              </div>
                            )}
                            <MessageRow
                              message={message}
                              showAuthor={showAuthor}
                              menuOpen={menuFor === message.id}
                              editing={editingId === message.id}
                              editText={editText}
                              busy={Boolean(busy)}
                              highlighted={focusId === message.id}
                              onToggleMenu={() => setMenuFor(menuFor === message.id ? null : message.id)}
                              onCloseMenu={() => setMenuFor(null)}
                              onStartEdit={() => startEdit(message)}
                              onEditText={setEditText}
                              onSaveEdit={() => void saveEdit()}
                              onCancelEdit={() => {
                                setEditingId(null);
                                setEditText('');
                              }}
                              onUnsend={() => void unsend(message)}
                              onHide={() => void hide(message)}
                              onForward={() => {
                                setMenuFor(null);
                                setForwardFor(message.id);
                              }}
                              onReport={() => void report(message)}
                              onOpenOriginal={() => openOriginal(message)}
                            />
                          </Fragment>
                        );
                      })
                    )}
                  </div>
                </div>

                <form
                  className="flex items-end gap-1.5 border-t border-neutral-200 p-2 dark:border-neutral-800"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submit();
                  }}
                >
                  <textarea
                    className="input max-h-24 min-h-[34px] flex-1 resize-none py-1.5 text-sm"
                    rows={1}
                    value={draft}
                    maxLength={4000}
                    placeholder={`Message ${selected.title}`}
                    aria-label="Message text"
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void submit();
                      }
                    }}
                  />
                  <button
                    className="btn-primary px-3 py-1.5"
                    type="submit"
                    disabled={Boolean(busy) || !draft.trim()}
                    aria-label="Send message"
                  >
                    {busy === 'send' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {notice && (
        <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400" role="status" data-chat-notice>
          {notice}
        </p>
      )}

      {forwardFor && selected && (
        <ForwardDialog
          conversations={conversations}
          sourceId={selected.id}
          busy={Boolean(busy)}
          onPick={(conversationId) => void forward(conversationId)}
          onClose={() => setForwardFor(null)}
        />
      )}

      {picker === 'dm' && (
        <Modal title="New direct message" onClose={() => setPicker(null)}>
          {friends.length === 0 ? (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Direct messages need an accepted friend. Add one from the Friends tab first.
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {friends.map((friend) => (
                <button
                  key={friend.userId}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-100 disabled:opacity-50 dark:hover:bg-neutral-800"
                  disabled={Boolean(busy)}
                  onClick={() => void startDirectMessage(friend)}
                  data-start-dm={friend.userId}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-200 text-xs dark:bg-neutral-700">
                    {initials(friend.username)}
                  </span>
                  <span className="truncate">{friend.username}</span>
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}

      {(picker === 'group' || picker === 'renaming') && (
        <Modal title={picker === 'renaming' ? 'Rename group' : 'New group'} onClose={() => setPicker(null)}>
          <label className="label" htmlFor="chat-group-title">
            Group name
          </label>
          <input
            id="chat-group-title"
            className="input mb-3"
            value={titleDraft}
            maxLength={60}
            autoFocus
            onChange={(event) => setTitleDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void (picker === 'renaming' ? submitRename() : submitGroup());
              }
            }}
          />
          <button
            className="btn-primary w-full"
            disabled={!titleDraft.trim() || Boolean(busy)}
            onClick={() => void (picker === 'renaming' ? submitRename() : submitGroup())}
          >
            {picker === 'renaming' ? 'Save name' : 'Create group'}
          </button>
        </Modal>
      )}

      {picker === 'invite' && (
        <Modal title="Invite to group" onClose={() => setPicker(null)}>
          {friends.filter((friend) => !friendIds.has(friend.userId)).length === 0 ? (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Every friend is already in this group.
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {friends
                .filter((friend) => !friendIds.has(friend.userId))
                .map((friend) => (
                  <button
                    key={friend.userId}
                    className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-100 disabled:opacity-50 dark:hover:bg-neutral-800"
                    disabled={Boolean(busy)}
                    onClick={() => void invite(friend.userId)}
                    data-invite={friend.userId}
                  >
                    <span className="truncate">{friend.username}</span>
                    <UserPlus size={13} />
                  </button>
                ))}
            </div>
          )}
        </Modal>
      )}

      {picker === 'members' && (
        <Modal title="Group members" onClose={() => setPicker(null)}>
          <div className="mb-2 max-h-64 overflow-y-auto">
            {membersBusy && members.length === 0 ? (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Loading members…</p>
            ) : members.length === 0 ? (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">No members.</p>
            ) : (
              members.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center justify-between gap-2 border-b border-neutral-200 py-1.5 text-sm last:border-0 dark:border-neutral-800"
                  data-member={member.userId}
                >
                  <span className="truncate">
                    {member.username}
                    {member.role === 'owner' && (
                      <span className="ml-1 text-[10px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                        owner
                      </span>
                    )}
                  </span>
                  {selected?.role === 'owner' && member.role !== 'owner' && (
                    <button
                      className={smallButton}
                      disabled={Boolean(busy)}
                      onClick={() => void makeOwner(member)}
                    >
                      Make owner
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
          <button className={smallButton} onClick={() => void openFriends('invite')}>
            <UserPlus size={12} className="mr-1 inline" /> Invite a friend
          </button>
        </Modal>
      )}
    </section>
  );
}
