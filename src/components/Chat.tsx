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
  Pin,
  PinOff,
  Plus,
  Send,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  amModerator,
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
  loadModerationHistory,
  loadModerationQueue,
  loadConversations,
  loadMessages,
  markRead,
  messageTime,
  openDirectMessage,
  relativeStamp,
  muteUserAsModerator,
  removeMessageAsModerator,
  renameGroup,
  reportMessage,
  resolveReportAsModerator,
  sendMessage,
  setPinned,
  setUnreadSummary,
  summarizeUnread,
  transferOwnership,
  unreadBadge,
  unsendMessage,
  watchChat,
  type ChatBackground,
  type ChatConversation,
  type ChatMessage,
  type ModerationAction,
  type ModerationReport,
  DEFAULT_BACKGROUND,
} from '../lib/chat';
import { ChatAmbient, readThemeAmbient, useConversationAmbient } from '../theme/Ambient';
import { loadSocial, type SocialFriend } from '../lib/friends';
import { ChatBackgroundEditor } from './chat/ChatBackgroundEditor';
import { ForwardDialog } from './chat/ForwardDialog';

const iconButton =
  'rounded-md p-1.5 text-[var(--geegle-muted)] hover:bg-neutral-100 hover:text-neutral-800 disabled:opacity-40';
const smallButton =
  'rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 dark:border-[var(--geegle-border)]';
const menuItem =
  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-neutral-100';

function kindLabel(conversation: ChatConversation): string {
  if (conversation.kind === 'public') return 'Public room';
  if (conversation.kind === 'group') return `${conversation.memberCount} members`;
  return 'Direct message';
}

function ForwardEmbed({
  message,
  onOpen,
  mine,
}: {
  message: ChatMessage;
  onOpen: () => void;
  mine?: boolean;
}) {
  const forwarded = message.forwarded;
  if (!forwarded) return null;
  const when = forwarded.createdAt ? messageTime(forwarded.createdAt) : '';
  return (
    <div
      data-forwarded={forwarded.messageId}
      className={`mb-1 rounded border-l-2 px-2 py-1 text-[11px] ${
        mine ? 'border-current/50 bg-white/15' : 'border-neutral-400 bg-black/5 dark:bg-white/10'
      }`}
    >
      <div className="mb-0.5 flex items-center gap-1 font-medium opacity-80">
        <Forward size={11} /> Forwarded from {forwarded.authorName}
        {when && <span className="font-normal opacity-80">· {when}</span>}
      </div>
      {forwarded.available ? (
        <button
          className="underline underline-offset-2 opacity-90 hover:opacity-100"
          onClick={onOpen}
          data-forward-original={forwarded.messageId}
        >
          View original
        </button>
      ) : (
        <span className="italic opacity-80">Original message is no longer available</span>
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
  const mine = message.mine;
  // A forwarded message carries no text of its own; its words come from the
  // original, and the server has already decided whether this reader may see
  // them. Editing is refused by the server for the same reason.
  const canEdit = mine && !message.unsent && !message.moderated && !message.forwarded;
  const canUnsend = mine && !message.unsent && !message.moderated;
  const canForward = !message.unsent && !message.moderated;
  const bubbleClass = mine
    ? 'bubble bubble-out rounded-br-md'
    : 'bubble bubble-in rounded-bl-md';

  const menu = (
    <div className="relative shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 data-[open=true]:opacity-100" data-open={menuOpen ? 'true' : 'false'}>
      <button
        className={`${iconButton} h-6 w-6 p-0.5`}
        aria-label={`Message options for ${message.authorName}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={onToggleMenu}
        data-message-menu={message.id}
      >
        <MoreVertical size={14} />
      </button>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={onCloseMenu} aria-hidden="true" />
          <div
            className={`absolute top-full z-20 w-44 overflow-hidden rounded-md border border-neutral-200 bg-[var(--geegle-card)] p-1 shadow-xl dark:border-[var(--geegle-border)] ${
              mine ? 'right-0' : 'left-0'
            }`}
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
            {!mine && (
              <button className={menuItem} role="menuitem" onClick={onReport}>
                <MessageSquare size={12} /> Report
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div
      className={`group flex w-full items-start gap-1.5 px-1 py-0.5 ${
        mine ? 'flex-row-reverse' : 'flex-row'
      } ${highlighted ? 'rounded-lg bg-amber-100/70 ring-1 ring-amber-400 dark:bg-amber-500/20' : ''}`}
      data-message={message.id}
      data-unsent={message.unsent ? 'true' : 'false'}
      data-mine={mine ? 'true' : 'false'}
    >
      <div className={`flex min-w-0 max-w-[75%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
        {showAuthor && !mine && (
          <span className="mb-0.5 px-1 text-[11px] font-medium text-neutral-600">
            {message.authorName}
          </span>
        )}

        {editing ? (
          <div className="w-[min(28rem,70vw)]">
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
        ) : message.moderated ? (
          <div className={`${bubbleClass} italic`} data-moderated="true">
            Removed by a moderator
          </div>
        ) : message.unsent ? (
          <div className={`${bubbleClass} italic`} data-unsent="true">
            Message unsent
          </div>
        ) : (
          <div className={bubbleClass} data-bubble={mine ? 'out' : 'in'}>
            <ForwardEmbed message={message} onOpen={onOpenOriginal} mine={mine} />
            {message.forwarded && !message.body ? (
              <span className="italic">Original message is no longer available</span>
            ) : (
              <span className="whitespace-pre-wrap">{message.body}</span>
            )}
          </div>
        )}

        <span className="mt-0.5 flex items-center gap-1 px-1 text-[10px] text-[var(--geegle-muted)]">
          {messageTime(message.createdAt)}
          {message.editedAt && !message.unsent && !message.moderated && (
            <span title="This message was edited" data-edited="true">edited</span>
          )}
        </span>
      </div>
      {!editing && menu}
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
          <button className="rounded p-1 hover:bg-neutral-100" onClick={onClose} aria-label="Close">
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
  ambientEnabled = true,
}: {
  userId: string | null;
  onRequestSignIn: () => void;
  ambientEnabled?: boolean;
}) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Which conversation the messages in memory belong to. While this does not
  // match the open conversation the thread shows nothing: no spinner, and no
  // "no messages" claim about a conversation that has not answered yet.
  const [loadedId, setLoadedId] = useState<string | null>(null);
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
  const [moderator, setModerator] = useState(false);
  const [modOpen, setModOpen] = useState(false);
  const [modQueue, setModQueue] = useState<ModerationReport[]>([]);
  const [modHistory, setModHistory] = useState<ModerationAction[]>([]);
  const [modBusy, setModBusy] = useState(false);

  const threadRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ selectedId, hasMore });
  stateRef.current = { selectedId, hasMore };
  // Every thread request carries a ticket; a response whose ticket is stale is
  // dropped, so a slow answer for one conversation can never replace another
  // conversation's messages.
  const threadTicket = useRef(0);

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
    const ticket = ++threadTicket.current;
    const result = await loadMessages(id, null, 30);
    // A newer request (or a conversation switch) has taken over.
    if (ticket !== threadTicket.current) return;
    if (!result.ok) {
      setThreadError(result.error ?? 'Messages could not be loaded.');
      return;
    }
    const rows = result.data ?? [];
    setMessages(rows);
    setHasMore(rows.length === 30);
    setThreadError(null);
    setLoadedId(id);
  }, []);

  // A new account starts from a clean surface.
  useEffect(() => {
    setConversations([]);
    setMessages([]);
    setLoadedId(null);
    setSelectedId(null);
    setDraft('');
    setError(null);
    setThreadError(null);
    setBackground(DEFAULT_BACKGROUND);
    setBackgroundUrl(null);
    setModerator(false);
    setModOpen(false);
    setModQueue([]);
    setLoading(Boolean(userId));
    if (userId) void refreshConversations();
    else setLoading(false);
  }, [userId, refreshConversations]);

  // Live updates: the list and the open thread follow the database. The thread
  // is refreshed quietly, so arriving messages never replace the conversation
  // with a loading state, and read state is confirmed by its own effect only
  // when there is something new to confirm.
  useEffect(() => {
    if (!userId) return;
    let timer = 0;
    return watchChat(userId, () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const current = stateRef.current;
        if (current.selectedId && !current.hasMore) void loadThread(current.selectedId);
        void refreshConversations();
      }, 250);
    });
  }, [userId, refreshConversations, loadThread]);

  // The Chat tab badge and the sidebar read the same numbers.
  useEffect(() => {
    setUnreadSummary(summarizeUnread(conversations));
  }, [conversations]);

  // Moderator status comes from the database, never from client state.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void amModerator().then((value) => {
      if (!cancelled) setModerator(value);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Pick the public room on first load, so the tab is never an empty shell.
  useEffect(() => {
    if (selectedId || conversations.length === 0) return;
    const first = conversations.find((entry) => entry.kind === 'public') ?? conversations[0];
    setSelectedId(first.id);
  }, [conversations, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    // Opening a conversation clears its badge at once and drops the previous
    // conversation's messages; the thread stays blank until its own answer
    // arrives, so nothing from another conversation is ever shown.
    setConversations((current) =>
      current.map((entry) => (entry.id === selectedId ? { ...entry, unread: 0 } : entry)),
    );
    threadTicket.current += 1;
    setMessages([]);
    setLoadedId(null);
    setHasMore(false);
    setThreadError(null);
    void loadThread(selectedId);
  }, [selectedId, loadThread]);

  // Confirm read state once per genuine transition, not on every Realtime tick.
  useEffect(() => {
    if (!selectedId || loadedId !== selectedId) return;
    const conversation = conversations.find((entry) => entry.id === selectedId);
    if (!conversation || conversation.unread === 0) return;
    void markRead(selectedId).then(() => refreshConversations());
  }, [selectedId, loadedId, conversations, refreshConversations]);

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
        let url = await backgroundImageUrl(result.data.imagePath);
        // A signed link can expire while the tab is open; ask again once.
        if (!url) {
          await new Promise((resolve) => window.setTimeout(resolve, 600));
          url = await backgroundImageUrl(result.data.imagePath);
        }
        if (!cancelled) setBackgroundUrl(url);
        if (!url && !cancelled) setError('Your background picture could not be loaded. Open the background editor to replace it.');
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

  const shownBackground = previewBackground ?? background;
  const shownBackgroundUrl = previewBackground ? previewUrl : backgroundUrl;
  const themeAmbient = readThemeAmbient();
  const chatAmbient = useConversationAmbient({
    kind: shownBackground.kind,
    color: shownBackground.color,
    imageUrl: shownBackgroundUrl,
    themeAmbient,
  });
  const threadReady = Boolean(selected) && loadedId === selected?.id;

  if (!userId) {
    return (
      <section aria-label="Chat" className="mx-auto w-full max-w-md">
        <div className="card p-6 text-center">
          <h2 className="mb-1 text-base font-semibold">Chat</h2>
          <p className="mb-4 text-sm text-[var(--geegle-muted)]">
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

  const togglePin = async (conversation: ChatConversation) => {
    const ok = await run('pin', () => setPinned(conversation.id, !conversation.pinned));
    if (ok) await refreshConversations();
  };

  const openModeration = async () => {
    setModOpen(true);
    setModBusy(true);
    try {
      const [queue, history] = await Promise.all([loadModerationQueue(), loadModerationHistory()]);
      if (queue.ok) setModQueue(queue.data ?? []);
      else setError(queue.error ?? null);
      if (history.ok) setModHistory(history.data ?? []);
    } finally {
      setModBusy(false);
    }
  };

  const refreshModeration = async () => {
    const [queue, history] = await Promise.all([loadModerationQueue(), loadModerationHistory()]);
    if (queue.ok) setModQueue(queue.data ?? []);
    if (history.ok) setModHistory(history.data ?? []);
  };

  const moderateRemove = async (report: ModerationReport) => {
    const reason = window.prompt('Reason for removing this public message. The author will not be told who reported it.');
    if (!reason || !reason.trim()) return;
    setModBusy(true);
    try {
      const result = await removeMessageAsModerator(report.messageId, reason.trim(), report.reportId);
      if (!result.ok) setError(result.error ?? null);
      else setNotice('Message removed and the report resolved.');
      await refreshModeration();
      await refreshConversations();
      if (selectedId) await loadThread(selectedId);
    } finally {
      setModBusy(false);
    }
  };

  const moderateDismiss = async (report: ModerationReport) => {
    setModBusy(true);
    try {
      const result = await resolveReportAsModerator(report.reportId, 'dismissed');
      if (!result.ok) setError(result.error ?? null);
      else setNotice('Report dismissed.');
      await refreshModeration();
    } finally {
      setModBusy(false);
    }
  };

  const moderateMute = async (report: ModerationReport) => {
    const minutes = Number(window.prompt('Pause this account from public chat for how many minutes?', '60'));
    if (!Number.isFinite(minutes) || minutes < 1) return;
    setModBusy(true);
    try {
      if (!report.authorId) {
        setError('Muting applies to public messages only.');
        return;
      }
      const result = await muteUserAsModerator(report.authorId, minutes, 'Reported public message');
      if (!result.ok) setError(result.error ?? null);
      else setNotice('Public chat paused for that account.');
      await refreshModeration();
    } finally {
      setModBusy(false);
    }
  };

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
        {moderator && (
          <button className={smallButton} onClick={() => void openModeration()} data-moderation-open>
            <Shield size={13} className="mr-1 inline" /> Moderation
          </button>
        )}
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
        <div className="card flex items-center justify-center gap-2 p-8 text-sm text-[var(--geegle-muted)]">
          <Loader2 size={15} className="animate-spin" /> Loading chat…
        </div>
      ) : error && conversations.length === 0 ? (
        <div className="card p-6 text-center" role="alert" data-chat-failed>
          <p className="mb-3 text-sm text-neutral-600">{error}</p>
          <button className="btn-primary" onClick={() => void refreshConversations()}>
            Retry
          </button>
        </div>
      ) : (
        <div className="card flex h-[min(72vh,620px)] min-h-[340px] overflow-hidden p-0">
          {/* Conversation list */}
          <div
            className={`w-full shrink-0 flex-col border-r border-neutral-200 bg-[var(--geegle-chat)] transition-colors dark:border-[var(--geegle-border)] md:flex md:w-64 ${
              selectedId ? 'hidden md:flex' : 'flex'
            }`}
            aria-label="Conversations"
          >
            <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
              {conversations.length === 0 ? (
                <p className="p-3 text-xs text-[var(--geegle-muted)]">
                  No conversations yet. Start one from the buttons above.
                </p>
              ) : (
                conversations.map((conversation) => {
                  const last = conversation.lastMessage;
                  const preview = last
                    ? last.unsent
                      ? 'Message unsent'
                      : `${last.mine ? 'You: ' : ''}${last.forwarded ? 'Forwarded message' : last.body ?? ''}`
                    : 'No messages yet';
                  const selectedRow = conversation.id === selectedId;
                  return (
                    <div
                      key={conversation.id}
                      className={`group/row mb-0.5 flex items-stretch rounded ${
                        selectedRow
                          ? 'bg-[var(--geegle-selected)]'
                          : 'hover:bg-[var(--geegle-hover)]'
                      }`}
                      data-conversation={conversation.id}
                      data-conversation-kind={conversation.kind}
                      data-pinned={conversation.pinned ? 'true' : 'false'}
                    >
                      <button
                        className="flex min-w-0 flex-1 items-start gap-2 rounded px-2 py-1.5 text-left"
                        onClick={() => {
                          setSelectedId(conversation.id);
                          setMenuFor(null);
                        }}
                        aria-current={selectedRow ? 'true' : undefined}
                      >
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-600">
                          {conversation.kind === 'public' ? '#' : conversation.kind === 'group' ? <Users size={13} /> : initials(conversation.title)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-1">
                            <span className="flex min-w-0 items-center gap-1">
                              <span className="truncate text-sm font-medium">{conversation.title}</span>
                              {conversation.pinned && (
                                <Pin size={10} className="shrink-0 text-neutral-400" aria-label="Pinned" />
                              )}
                            </span>
                            <span className="shrink-0 text-[10px] text-neutral-400">
                              {relativeStamp(conversation.lastActivityAt)}
                            </span>
                          </span>
                          <span className="flex items-center justify-between gap-1">
                            <span className="truncate text-xs text-[var(--geegle-muted)]">{preview}</span>
                            {conversation.unread > 0 && conversation.kind === 'public' && (
                              <span
                                className="h-2 w-2 shrink-0 rounded-full bg-[var(--geegle-accent)]"
                                aria-label="Unread public messages"
                                data-unread-dot="true"
                              />
                            )}
                            {conversation.unread > 0 && conversation.kind !== 'public' && (
                              <span
                                className="shrink-0 rounded-full bg-[var(--geegle-accent)] px-1.5 text-[10px] font-semibold leading-4 text-[var(--geegle-accent-ink)]"
                                aria-label={`${conversation.unread} unread`}
                                data-unread={conversation.unread}
                              >
                                {unreadBadge(conversation.unread)}
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                      {conversation.kind !== 'public' && (
                        <button
                          className={`${iconButton} my-auto mr-1 h-6 w-6 shrink-0 p-0.5 opacity-0 focus:opacity-100 group-hover/row:opacity-100`}
                          aria-label={conversation.pinned ? `Unpin ${conversation.title}` : `Pin ${conversation.title}`}
                          title={conversation.pinned ? 'Unpin' : 'Pin'}
                          data-pin={conversation.id}
                          disabled={Boolean(busy)}
                          onClick={() => void togglePin(conversation)}
                        >
                          {conversation.pinned ? <PinOff size={12} /> : <Pin size={12} />}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Thread */}
          <div className={`min-w-0 flex-1 flex-col md:flex ${selectedId ? 'flex' : 'hidden md:flex'}`}>
            {!selected ? (
              <div className="flex h-full items-center justify-center p-6 text-sm text-[var(--geegle-muted)]">
                Choose a conversation.
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5 border-b border-neutral-200 px-2 py-1.5 dark:border-[var(--geegle-border)]">
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
                    <p className="truncate text-[11px] text-[var(--geegle-muted)]">{kindLabel(selected)}</p>
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
                            className="absolute right-2 top-16 z-20 w-40 rounded-md border border-neutral-200 bg-[var(--geegle-card)] p-1 shadow-lg dark:border-[var(--geegle-border)]"
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

                <div className="relative min-h-0 flex-1" data-chat-surface>
                  {ambientEnabled && <ChatAmbient palette={chatAmbient} enabled />}
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
                          className="text-xs text-[var(--geegle-muted)] underline-offset-2 hover:underline disabled:opacity-50"
                          onClick={() => void loadOlder()}
                          disabled={olderLoading}
                        >
                          {olderLoading ? 'Loading…' : 'Load earlier messages'}
                        </button>
                      </div>
                    )}
                    {threadError && messages.length === 0 ? (
                      <div className="p-3 text-center" role="alert" data-thread-error>
                        <p className="mb-2 text-xs text-neutral-600">{threadError}</p>
                        <button className="btn-primary px-3 py-1 text-xs" onClick={() => void loadThread(selected.id)}>
                          Retry
                        </button>
                      </div>
                    ) : !threadReady ? (
                      <div className="py-6" aria-hidden="true" />
                    ) : messages.length === 0 ? (
                      <p className="py-8 text-center text-xs text-[var(--geegle-muted)]" data-empty-thread>
                        No messages yet.
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
                              <div className="my-2 text-center text-[10px] uppercase tracking-wide text-[var(--geegle-muted)]">
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
                  className="flex items-end gap-1.5 border-t border-neutral-200 p-2 dark:border-[var(--geegle-border)]"
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

      {modOpen && (
        <Modal title="Moderation" onClose={() => setModOpen(false)}>
          <p className="mb-2 text-xs text-[var(--geegle-muted)]">
            Public messages only. Private reports show what was reported and who reported
            it, never the message itself.
          </p>
          {modBusy && (
            <p className="mb-2 flex items-center gap-1 text-xs text-[var(--geegle-muted)]">
              <Loader2 size={12} className="animate-spin" /> Working
            </p>
          )}
          <div className="mb-3 max-h-64 space-y-2 overflow-y-auto" data-moderation-queue>
            {modQueue.length === 0 ? (
              <p className="text-xs text-[var(--geegle-muted)]">No open reports.</p>
            ) : (
              modQueue.map((report) => (
                <div key={report.reportId} className="rounded-md border border-neutral-200 p-2 text-xs dark:border-[var(--geegle-border)]" data-report={report.reportId}>
                  <p className="font-medium">
                    {report.conversationTitle} · {report.authorName}
                  </p>
                  <p className="text-[var(--geegle-muted)]">
                    Reported by {report.reporter}: “{report.reason}”
                  </p>
                  {report.body !== null ? (
                    <p className="mt-1 whitespace-pre-wrap break-words rounded bg-neutral-100 p-1.5">
                      {report.body}
                    </p>
                  ) : (
                    <p className="mt-1 italic text-[var(--geegle-muted)]">
                      {report.alreadyRemoved ? 'Message already removed.' : 'Private message — content withheld.'}
                    </p>
                  )}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {report.kind === 'public' && !report.alreadyRemoved && (
                      <button className={smallButton} disabled={modBusy} onClick={() => void moderateRemove(report)}>
                        Remove message
                      </button>
                    )}
                    {report.kind === 'public' && (
                      <button className={smallButton} disabled={modBusy} onClick={() => void moderateMute(report)}>
                        Pause author
                      </button>
                    )}
                    <button className={smallButton} disabled={modBusy} onClick={() => void moderateDismiss(report)}>
                      Dismiss
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <p className="mb-1 text-xs font-medium">Recent moderation</p>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-[11px] text-[var(--geegle-muted)]">
            {modHistory.length === 0 ? (
              <li>Nothing yet.</li>
            ) : (
              modHistory.map((entry) => (
                <li key={entry.id} data-moderation-action={entry.id}>
                  {new Date(entry.createdAt).toLocaleString()} · {entry.action}
                  {entry.targetUser ? ' · ' + entry.targetUser : ''}
                  {entry.reason ? ' — ' + entry.reason : ''}
                </li>
              ))
            )}
          </ul>
        </Modal>
      )}

      {picker === 'dm' && (
        <Modal title="New direct message" onClose={() => setPicker(null)}><div data-picker>
          {friends.length === 0 ? (
            <p className="text-xs text-[var(--geegle-muted)]">
              Direct messages need an accepted friend. Add one from the Friends tab first.
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {friends.map((friend) => (
                <button
                  key={friend.userId}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-100 disabled:opacity-50"
                  disabled={Boolean(busy)}
                  onClick={() => void startDirectMessage(friend)}
                  data-start-dm={friend.userId}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-200 text-xs">
                    {initials(friend.username)}
                  </span>
                  <span className="truncate">{friend.username}</span>
                </button>
              ))}
            </div>
          )}
        </div></Modal>
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
            <p className="text-xs text-[var(--geegle-muted)]">
              Every friend is already in this group.
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {friends
                .filter((friend) => !friendIds.has(friend.userId))
                .map((friend) => (
                  <button
                    key={friend.userId}
                    className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-100 disabled:opacity-50"
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
              <p className="text-xs text-[var(--geegle-muted)]">Loading members…</p>
            ) : members.length === 0 ? (
              <p className="text-xs text-[var(--geegle-muted)]">No members.</p>
            ) : (
              members.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center justify-between gap-2 border-b border-neutral-200 py-1.5 text-sm last:border-0 dark:border-[var(--geegle-border)]"
                  data-member={member.userId}
                >
                  <span className="truncate">
                    {member.username}
                    {member.role === 'owner' && (
                      <span className="ml-1 text-[10px] uppercase tracking-wide text-[var(--geegle-muted)]">
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
