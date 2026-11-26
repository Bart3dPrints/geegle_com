// Ordinary Geegle settings: solid neutral appearance, Recently Played, the
// library notice preference, and account actions when signed in.
//
// Appearance supports only a light/dark/system mode plus a solid background
// and card colour. Defaults are neutral; there are no image or animated
// backgrounds and no preset that imitates another service.

import { useState } from 'react';
import { motion } from 'motion/react';
import { X, KeyRound, LogOut, Loader2, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DEFAULT_APPEARANCE_SETTINGS, type AppearanceSettings } from '../lib/userData';

const BACKGROUNDS = ['#fafafa', '#ffffff', '#e5e5e5', '#202020', '#181818'];
const CARDS = ['#ffffff', '#f5f5f5', '#e5e5e5', '#2c2c2c', '#252525'];

export function Settings({
  username,
  showRecent,
  onShowRecentChange,
  appearance,
  onSaveAppearance,
  noticeDismissed,
  onShowNoticeAgain,
  onClose,
  onSignedOut,
}: {
  username: string | null;
  showRecent: boolean;
  onShowRecentChange: (visible: boolean) => void;
  appearance: AppearanceSettings;
  onSaveAppearance: (value: AppearanceSettings) => Promise<void>;
  noticeDismissed: boolean;
  onShowNoticeAgain: () => Promise<void>;
  onClose: () => void;
  onSignedOut: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<AppearanceSettings>(appearance);
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setMessage({ kind: 'err', text: 'New password must be at least 8 characters.' });
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    setMessage(
      error
        ? { kind: 'err', text: `Could not change password: ${error.message}` }
        : { kind: 'ok', text: 'Password updated.' }
    );
    if (!error) setNewPassword('');
  };

  const apply = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await onSaveAppearance(draft);
      setMessage({ kind: 'ok', text: 'Appearance saved.' });
    } catch (error) {
      setMessage({ kind: 'err', text: error instanceof Error ? error.message : 'Could not save appearance.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <motion.div
        className="card max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto p-6"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2>Settings</h2>
          <button onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </div>

        <section className="mb-6" aria-labelledby="settings-appearance">
          <h3 id="settings-appearance" className="mb-3 text-sm font-medium">
            Appearance
          </h3>
          <div className="mb-3 flex gap-1 rounded-md border border-neutral-200 p-1 dark:border-neutral-700" role="group" aria-label="Theme">
            {(['light', 'system', 'dark'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={draft.mode === mode}
                className={`flex-1 rounded px-2 py-1.5 text-sm capitalize ${
                  draft.mode === mode
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                    : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
                onClick={() => setDraft({ ...draft, mode })}
              >
                {mode}
              </button>
            ))}
          </div>

          <p className="mb-1 text-xs text-neutral-500 dark:text-neutral-400">Background</p>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {BACKGROUNDS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Background ${color}`}
                aria-pressed={(draft.background ?? '') === color}
                className={`h-7 w-7 rounded-full border ${
                  (draft.background ?? '') === color
                    ? 'border-neutral-900 ring-1 ring-neutral-900 dark:border-neutral-100 dark:ring-neutral-100'
                    : 'border-neutral-300 dark:border-neutral-600'
                }`}
                style={{ background: color }}
                onClick={() => setDraft({ ...draft, background: color })}
              />
            ))}
            <input
              type="color"
              aria-label="Custom background colour"
              value={draft.background ?? '#fafafa'}
              onChange={(event) => setDraft({ ...draft, background: event.target.value })}
              className="h-7 w-9 cursor-pointer border-0 bg-transparent p-0"
            />
          </div>

          <p className="mb-1 text-xs text-neutral-500 dark:text-neutral-400">Card colour</p>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {CARDS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Card ${color}`}
                aria-pressed={(draft.card ?? '') === color}
                className={`h-7 w-7 rounded-full border ${
                  (draft.card ?? '') === color
                    ? 'border-neutral-900 ring-1 ring-neutral-900 dark:border-neutral-100 dark:ring-neutral-100'
                    : 'border-neutral-300 dark:border-neutral-600'
                }`}
                style={{ background: color }}
                onClick={() => setDraft({ ...draft, card: color })}
              />
            ))}
            <input
              type="color"
              aria-label="Custom card colour"
              value={draft.card ?? '#ffffff'}
              onChange={(event) => setDraft({ ...draft, card: event.target.value })}
              className="h-7 w-9 cursor-pointer border-0 bg-transparent p-0"
            />
          </div>

          <div
            className="mb-3 rounded-md border border-neutral-200 p-3 dark:border-neutral-700"
            style={{
              background: draft.background ?? undefined,
            }}
            aria-label="Appearance preview"
          >
            <div
              className="rounded-md border border-neutral-300 p-3 text-xs dark:border-neutral-600"
              style={{ background: draft.card ?? undefined }}
            >
              Preview
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" className="btn-primary" onClick={apply} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />} Apply
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={saving}
              onClick={() => {
                setDraft(DEFAULT_APPEARANCE_SETTINGS);
                void onSaveAppearance(DEFAULT_APPEARANCE_SETTINGS);
              }}
            >
              Reset to defaults
            </button>
          </div>
        </section>

        <section className="mb-6 space-y-3" aria-label="Library">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={showRecent}
              onChange={(e) => onShowRecentChange(e.target.checked)}
            />
            <span>
              Show Recently Played
              <span className="mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400">
                Adds a Recently Played row to the Games library.
              </span>
            </span>
          </label>
          {noticeDismissed && (
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => void onShowNoticeAgain()}
            >
              Show the library notice again
            </button>
          )}
        </section>

        {username ? (
          <section aria-label="Account">
            <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
              Signed in as <b className="text-neutral-900 dark:text-neutral-100">{username}</b>.
            </p>
            <form onSubmit={changePassword} className="mb-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <KeyRound size={14} /> Change password
              </div>
              <input
                className="input mb-2"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                required
              />
              <button className="btn-secondary w-full" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Update password
              </button>
            </form>
            <button className="btn-secondary w-full" onClick={onSignedOut}>
              <LogOut size={16} /> Log out
            </button>
          </section>
        ) : (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Sign in to sync favorites, settings and game progress.
          </p>
        )}

        {message && (
          <p
            className={`mt-4 text-sm ${
              message.kind === 'ok'
                ? 'text-neutral-700 dark:text-neutral-300'
                : 'text-red-600 dark:text-red-400'
            }`}
            role="alert"
          >
            {message.text}
          </p>
        )}
      </motion.div>
    </div>
  );
}
