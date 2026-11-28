// Background editor for one direct message. Everything here is private to the
// signed-in account: the presets, the custom colour and the picture are stored
// per conversation and per account, never shared with the other participant.

import { useEffect, useRef, useState } from 'react';
import { Loader2, RotateCcw, Upload, X } from 'lucide-react';
import {
  DEFAULT_BACKGROUND,
  SOLID_PRESETS,
  backgroundImageUrl,
  deleteBackgroundImage,
  prepareBackgroundImage,
  saveBackground,
  uploadBackgroundImage,
  type ChatBackground,
} from '../../lib/chat';

const HEX = /^#[0-9a-fA-F]{6}$/;

const swatch =
  'h-7 w-7 rounded-full border border-neutral-300 dark:border-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-neutral-500';
const ghostButton =
  'rounded-md border border-neutral-300 px-2.5 py-1 text-xs text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800';

export function ChatBackgroundEditor({
  conversationId,
  userId,
  background,
  imageUrl,
  onPreview,
  onSaved,
  onClose,
  onError,
}: {
  conversationId: string;
  userId: string;
  background: ChatBackground;
  imageUrl: string | null;
  onPreview: (next: ChatBackground, url: string | null) => void;
  onSaved: (next: ChatBackground, url: string | null) => void;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const [draft, setDraft] = useState<ChatBackground>(background);
  const [draftUrl, setDraftUrl] = useState<string | null>(imageUrl);
  const [hex, setHex] = useState(background.color ?? '#1f2937');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  // A picture uploaded during this edit, so cancelling can clean it up.
  const freshPathRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Every change is previewed immediately on the thread behind the panel.
  const update = (next: ChatBackground, url = draftUrl) => {
    setDraft(next);
    setDraftUrl(url);
    onPreview(next, url);
  };

  const pickPreset = (color: string) => {
    setHex(color);
    setLocalError(null);
    update({ kind: 'solid', color, imagePath: null, overlay: draft.overlay });
  };

  const pickColor = (value: string) => {
    setHex(value);
    if (!HEX.test(value)) return;
    setLocalError(null);
    update({ kind: 'color', color: value, imagePath: null, overlay: draft.overlay });
  };

  const pickImage = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true);
    setLocalError(null);
    try {
      const prepared = await prepareBackgroundImage(file);
      if (!prepared.ok || !prepared.blob) {
        setLocalError(prepared.error ?? 'That image could not be used.');
        return;
      }
      const uploaded = await uploadBackgroundImage(conversationId, userId, prepared.blob);
      if (!uploaded.ok || !uploaded.data) {
        setLocalError(uploaded.error ?? 'That picture could not be uploaded.');
        return;
      }
      const previousFresh = freshPathRef.current;
      freshPathRef.current = uploaded.data;
      if (previousFresh && previousFresh !== uploaded.data) {
        void deleteBackgroundImage(previousFresh, userId);
      }
      const url = await backgroundImageUrl(uploaded.data);
      update({ kind: 'image', color: null, imagePath: uploaded.data, overlay: draft.overlay || 40 }, url);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setLocalError(null);
    try {
      const result = await saveBackground(conversationId, draft);
      if (!result.ok) {
        onError(result.error ?? 'That background could not be saved.');
        return;
      }
      const saved = result.data ?? draft;
      // Only the picture that was replaced is removed; the new one stays.
      const replaced = background.kind === 'image' ? background.imagePath : null;
      const fresh = freshPathRef.current;
      if (replaced && replaced !== saved.imagePath) {
        void deleteBackgroundImage(replaced, userId);
      }
      if (fresh && fresh !== saved.imagePath) {
        void deleteBackgroundImage(fresh, userId);
      }
      freshPathRef.current = null;
      onSaved(saved, saved.kind === 'image' ? draftUrl : null);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (busy) return;
    setBusy(true);
    setLocalError(null);
    try {
      const result = await saveBackground(conversationId, DEFAULT_BACKGROUND);
      if (!result.ok) {
        onError(result.error ?? 'That background could not be reset.');
        return;
      }
      if (background.kind === 'image' && background.imagePath) {
        void deleteBackgroundImage(background.imagePath, userId);
      }
      if (freshPathRef.current) {
        void deleteBackgroundImage(freshPathRef.current, userId);
        freshPathRef.current = null;
      }
      onSaved({ ...DEFAULT_BACKGROUND }, null);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    if (freshPathRef.current) {
      void deleteBackgroundImage(freshPathRef.current, userId);
      freshPathRef.current = null;
    }
    onPreview(background, imageUrl);
    onClose();
  };

  return (
    <div
      className="mt-2 rounded-md border border-neutral-200 bg-white p-3 text-xs dark:border-neutral-700 dark:bg-neutral-900"
      role="group"
      aria-label="Message background"
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium">Message background</h3>
        <button className="rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={cancel} aria-label="Close background editor">
          <X size={14} />
        </button>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <button
          className={`${ghostButton} ${draft.kind === 'default' ? 'ring-1 ring-neutral-500' : ''}`}
          onClick={() => {
            setLocalError(null);
            update({ ...DEFAULT_BACKGROUND });
          }}
        >
          Default
        </button>
        {SOLID_PRESETS.map((color) => (
          <button
            key={color}
            className={swatch}
            style={{ backgroundColor: color }}
            onClick={() => pickPreset(color)}
            aria-label={`Solid ${color}`}
            title={color}
          />
        ))}
        <label className="ml-1 flex items-center gap-1">
          <span className="text-neutral-500 dark:text-neutral-400">Custom</span>
          <input
            type="color"
            aria-label="Custom background colour"
            className="h-7 w-9 cursor-pointer rounded border border-neutral-300 bg-transparent p-0 dark:border-neutral-600"
            value={HEX.test(hex) ? hex : '#1f2937'}
            onChange={(event) => pickColor(event.target.value)}
          />
        </label>
        <input
          className="w-20 rounded border border-neutral-300 bg-transparent px-1.5 py-1 font-mono text-[11px] dark:border-neutral-700"
          value={hex}
          aria-label="Background colour hex value"
          onChange={(event) => pickColor(event.target.value.trim())}
          onBlur={() => setHex(HEX.test(hex) ? hex : '#1f2937')}
          placeholder="#1f2937"
        />
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => void pickImage(event.target.files?.[0])}
        />
        <button className={ghostButton} onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
          <span className="ml-1">Upload image</span>
        </button>
        <span className="text-neutral-500 dark:text-neutral-400">PNG, JPEG or WebP · resized to 1600 px</span>
      </div>

      <label className="mb-2 flex items-center gap-2">
        <span className="shrink-0 text-neutral-500 dark:text-neutral-400">Overlay</span>
        <input
          type="range"
          min={0}
          max={90}
          step={5}
          value={draft.overlay}
          aria-label="Overlay darkness"
          className="flex-1"
          onChange={(event) => update({ ...draft, overlay: Number(event.target.value) })}
        />
        <span className="w-8 text-right tabular-nums">{draft.overlay}%</span>
      </label>

      {localError && (
        <p className="mb-2 text-red-600 dark:text-red-400" role="alert">
          {localError}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button className="btn-primary px-3 py-1 text-xs" onClick={() => void save()} disabled={busy}>
          Save
        </button>
        <button className={ghostButton} onClick={() => void reset()} disabled={busy}>
          <RotateCcw size={12} className="inline" /> Reset
        </button>
        <button className={ghostButton} onClick={cancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}
