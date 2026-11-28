// Forwarding picker. Only direct messages are offered: the public room and
// groups are never valid targets, and the database refuses anything the matrix
// disallows even if this list were tampered with.

import { useEffect } from 'react';
import { Forward, X } from 'lucide-react';
import type { ChatConversation } from '../../lib/chat';

export function ForwardDialog({
  conversations,
  sourceId,
  busy,
  onPick,
  onClose,
}: {
  conversations: ChatConversation[];
  sourceId: string;
  busy: boolean;
  onPick: (conversationId: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const targets = conversations.filter((entry) => entry.kind === 'dm' && entry.id !== sourceId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 p-4" onClick={onClose}>
      <div
        className="card w-full max-w-sm p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Forward message"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Forward size={14} /> Forward to
          </h3>
          <button className="rounded p-1 hover:bg-neutral-100" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>
        {targets.length === 0 ? (
          <p className="py-3 text-xs text-[var(--geegle-muted)]">
            Open a direct message with a friend first — messages can only be forwarded into a DM.
          </p>
        ) : (
          <div className="max-h-64 overflow-y-auto">
            {targets.map((target) => (
              <button
                key={target.id}
                className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-100 disabled:opacity-50"
                disabled={busy}
                onClick={() => onPick(target.id)}
                data-forward-target={target.id}
              >
                <span className="truncate">{target.title}</span>
                <span className="shrink-0 text-xs text-neutral-400">DM</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
