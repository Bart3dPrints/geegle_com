// Ordinary Geegle settings, organized as tabs:
//   Theme         — light/dark/system.
//   Appearance    — surfaces, accent colour, typeface, text colour, wallpaper,
//                   optional clock/date widgets and their resets.
//   Preferences   — Recently Played, the library notice, account and password.
//   Tab appearance — optional user-owned page title and icon.
//   Changelog     — release history from merged pull requests (always last).
//
// The window keeps one external size across every section and scrolls its own
// content, so switching tabs never resizes it. Changes apply immediately and are
// saved without a success toast; only a real failure is reported.

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { X, KeyRound, LogOut, Loader2, Check, Upload, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  DEFAULT_APPEARANCE_SETTINGS,
  type AppearanceSettings,
} from '../lib/userData';
import {
  ACCENT_PRESETS,
  FONT_OPTIONS,
  contrastText,
  isWallpaperDataUrl,
  type FontKey,
} from '../lib/personalization';
import { prepareWallpaper } from '../lib/wallpaper';
import { PasswordInput } from './PasswordInput';
import { Changelog } from './Changelog';
import {
  DEFAULT_TAB_IDENTITY,
  TAB_ICON_MAX_BYTES,
  TAB_TITLE_MAX,
  validateTabIdentity,
  type TabIdentity,
} from '../lib/tabIdentity';

const BACKGROUNDS = ['#fafafa', '#ffffff', '#e5e5e5', '#202020', '#181818'];
const CARDS = ['#ffffff', '#f5f5f5', '#e5e5e5', '#2c2c2c', '#252525'];
const TABS = [
  { key: 'theme', label: 'Theme' },
  { key: 'appearance', label: 'Appearance' },
  { key: 'preferences', label: 'Preferences' },
  { key: 'tab', label: 'Tab appearance' },
  { key: 'changelog', label: 'Changelog' },
] as const;
export type SettingsTab = (typeof TABS)[number]['key'];

/** Small heading with an optional per-group reset control. */
function GroupHeading({
  children,
  onReset,
  resetLabel,
}: {
  children: React.ReactNode;
  onReset?: () => void;
  resetLabel?: string;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{children}</p>
      {onReset && (
        <button
          type="button"
          className="shrink-0 text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          onClick={onReset}
          aria-label={resetLabel}
        >
          Reset
        </button>
      )}
    </div>
  );
}

export function Settings({
  username,
  showRecent,
  onShowRecentChange,
  appearance,
  onPreviewAppearance,
  onSaveAppearance,
  tabIdentity,
  onSaveTabIdentity,
  noticeDismissed,
  onShowNoticeAgain,
  accountReminderOff,
  onResetReminder,
  initialTab = 'theme',
  onClose,
  onSignedOut,
}: {
  username: string | null;
  showRecent: boolean;
  onShowRecentChange: (visible: boolean) => void;
  appearance: AppearanceSettings;
  /** Applies the draft to the page without writing to the account yet. */
  onPreviewAppearance: (value: AppearanceSettings) => void;
  onSaveAppearance: (value: AppearanceSettings) => Promise<void>;
  tabIdentity: TabIdentity;
  onSaveTabIdentity: (value: TabIdentity) => Promise<void>;
  noticeDismissed: boolean;
  onShowNoticeAgain: () => Promise<void>;
  accountReminderOff: boolean;
  onResetReminder: () => void;
  initialTab?: SettingsTab;
  onClose: () => void;
  onSignedOut: () => Promise<void>;
}) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [draft, setDraft] = useState<AppearanceSettings>(appearance);
  const [identity, setIdentity] = useState<TabIdentity>(tabIdentity);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preparingWallpaper, setPreparingWallpaper] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const reduceMotion = useReducedMotion();

  // Debounced saves: one request after a burst of changes, and the last change
  // is flushed when the window closes.
  const draftRef = useRef(draft);
  const pendingRef = useRef<AppearanceSettings | null>(null);
  const timerRef = useRef<number | null>(null);
  const saveRef = useRef(onSaveAppearance);
  saveRef.current = onSaveAppearance;
  const previewRef = useRef(onPreviewAppearance);
  previewRef.current = onPreviewAppearance;

  const persist = useCallback(async (value: AppearanceSettings) => {
    pendingRef.current = null;
    setSaving(true);
    try {
      await saveRef.current(value);
      setMessage(null);
    } catch (error) {
      setMessage({
        kind: 'err',
        text: error instanceof Error ? error.message : 'Could not save your appearance.',
      });
    } finally {
      setSaving(false);
    }
  }, []);

  const queue = useCallback(
    (next: AppearanceSettings) => {
      draftRef.current = next;
      setDraft(next);
      previewRef.current(next);
      pendingRef.current = next;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => void persist(next), 600);
    },
    [persist]
  );

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      // Closing the window must not drop the last change.
      if (pendingRef.current) void saveRef.current(pendingRef.current);
    },
    []
  );

  const applyDraft = (patch: Partial<AppearanceSettings>) => queue({ ...draftRef.current, ...patch });

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setMessage({ kind: 'err', text: 'New password must be at least 8 characters.' });
      return;
    }
    if (newPassword.length > 72) {
      setMessage({ kind: 'err', text: 'New password must be at most 72 characters.' });
      return;
    }
    if (!currentPassword) {
      setMessage({ kind: 'err', text: 'Enter your current password to confirm the change.' });
      return;
    }
    setBusy(true);
    // Reauthenticate first: an open session on a shared computer must not be
    // enough to replace the account password.
    const { data: current } = await supabase.auth.getUser();
    const email = current.user?.email;
    if (!email) {
      setBusy(false);
      setMessage({ kind: 'err', text: 'You are no longer signed in.' });
      return;
    }
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (reauthError) {
      setBusy(false);
      setMessage({ kind: 'err', text: 'Current password is incorrect.' });
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    setMessage(
      error
        ? { kind: 'err', text: `Could not change password: ${error.message}` }
        : { kind: 'ok', text: 'Password updated.' }
    );
    if (!error) {
      setCurrentPassword('');
      setNewPassword('');
    }
  };

  const applyIdentity = async (value: TabIdentity) => {
    const problem = validateTabIdentity(value);
    if (problem) {
      setMessage({ kind: 'err', text: problem });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await onSaveTabIdentity({ title: value.title.trim(), icon: value.icon });
      setIdentity({ title: value.title.trim(), icon: value.icon });
      setMessage({ kind: 'ok', text: 'Tab appearance saved.' });
    } catch (error) {
      setMessage({ kind: 'err', text: error instanceof Error ? error.message : 'Could not save tab appearance.' });
    } finally {
      setSaving(false);
    }
  };

  const pickIcon = (file: File | null) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setMessage({ kind: 'err', text: 'Choose a PNG, JPEG or WebP image.' });
      return;
    }
    if (file.size > TAB_ICON_MAX_BYTES) {
      setMessage({ kind: 'err', text: 'Keep the icon under 200 KB.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setIdentity((current) => ({ ...current, icon: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const pickWallpaper = async (file: File | null) => {
    if (!file) return;
    setPreparingWallpaper(true);
    setMessage(null);
    const result = await prepareWallpaper(file);
    setPreparingWallpaper(false);
    if (!result.ok) {
      setMessage({ kind: 'err', text: result.error });
      return;
    }
    if (!isWallpaperDataUrl(result.dataUrl)) {
      setMessage({ kind: 'err', text: 'That image could not be used as a wallpaper.' });
      return;
    }
    applyDraft({ wallpaper: result.dataUrl });
  };

  const resetAll = () => {
    queue({ ...DEFAULT_APPEARANCE_SETTINGS });
    setMessage(null);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.16, ease: 'easeOut' }}
    >
      <motion.div
        className="card flex w-full max-w-2xl flex-col overflow-hidden p-6"
        style={{ height: 'min(640px, calc(100vh - 2rem))' }}
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
        transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <h2>Settings</h2>
          <button onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 sm:flex-row sm:gap-5">
          <div
            className="flex shrink-0 flex-wrap gap-1 rounded-md border border-neutral-200 p-1 sm:w-36 sm:flex-col sm:flex-nowrap sm:content-start sm:rounded-none sm:border-0 sm:border-r sm:border-neutral-200 sm:p-0 sm:pr-2 dark:border-neutral-700 dark:sm:border-neutral-700"
            role="tablist"
            aria-label="Settings sections"
            aria-orientation="vertical"
          >
            {TABS.map((entry) => (
              <button
                key={entry.key}
                type="button"
                role="tab"
                aria-selected={tab === entry.key}
                className={`rounded px-2 py-1.5 text-xs sm:w-full sm:text-left sm:text-sm ${
                  tab === entry.key
                    ? 'accent-surface'
                    : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
                onClick={() => {
                  setTab(entry.key);
                  setMessage(null);
                }}
              >
                {entry.label}
              </button>
            ))}
          </div>

          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto pr-1">
            {tab === 'theme' && (
              <section aria-labelledby="settings-theme">
                <h3 id="settings-theme" className="mb-3 text-sm font-medium">
                  Theme
                </h3>
                <div className="flex gap-1 rounded-md border border-neutral-200 p-1 dark:border-neutral-700" role="group" aria-label="Theme">
                  {(['light', 'system', 'dark'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={draft.mode === mode}
                      className={`flex-1 rounded px-2 py-1.5 text-sm capitalize ${
                        draft.mode === mode
                          ? 'accent-surface'
                          : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                      }`}
                      onClick={() => applyDraft({ mode })}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn-secondary mt-4"
                  onClick={() => applyDraft({ mode: 'system' })}
                >
                  Reset to system
                </button>
              </section>
            )}

            {tab === 'appearance' && (
              <section aria-labelledby="settings-appearance" className="space-y-5">
                <h3 id="settings-appearance" className="text-sm font-medium">
                  Appearance
                </h3>

                <div>
                  <GroupHeading
                    onReset={() => applyDraft({ background: null, card: null })}
                    resetLabel="Reset background and card colours"
                  >
                    Background
                  </GroupHeading>
                  <div className="flex flex-wrap items-center gap-2">
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
                        onClick={() => applyDraft({ background: color })}
                      />
                    ))}
                    <input
                      type="color"
                      aria-label="Custom background colour"
                      value={draft.background ?? '#fafafa'}
                      onChange={(event) => applyDraft({ background: event.target.value })}
                      className="h-7 w-9 cursor-pointer border-0 bg-transparent p-0"
                    />
                  </div>

                  <p className="mb-1 mt-3 text-xs text-neutral-500 dark:text-neutral-400">Card colour</p>
                  <div className="flex flex-wrap items-center gap-2">
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
                        onClick={() => applyDraft({ card: color })}
                      />
                    ))}
                    <input
                      type="color"
                      aria-label="Custom card colour"
                      value={draft.card ?? '#ffffff'}
                      onChange={(event) => applyDraft({ card: event.target.value })}
                      className="h-7 w-9 cursor-pointer border-0 bg-transparent p-0"
                    />
                  </div>
                </div>

                <div>
                  <GroupHeading
                    onReset={() => applyDraft({ accent: null })}
                    resetLabel="Reset accent colour"
                  >
                    Accent colour
                  </GroupHeading>
                  <div className="flex flex-wrap items-center gap-2">
                    {ACCENT_PRESETS.map((preset) => {
                      const selected = (draft.accent ?? null) === preset.value;
                      return (
                        <button
                          key={preset.name}
                          type="button"
                          aria-label={preset.name}
                          title={preset.name}
                          aria-pressed={selected}
                          className={`h-7 w-7 rounded-full border ${
                            selected
                              ? 'border-neutral-900 ring-1 ring-neutral-900 dark:border-neutral-100 dark:ring-neutral-100'
                              : 'border-neutral-300 dark:border-neutral-600'
                          }`}
                          style={{
                            background: preset.value ?? 'linear-gradient(135deg, #171717 50%, #f5f5f5 50%)',
                          }}
                          onClick={() => applyDraft({ accent: preset.value })}
                        />
                      );
                    })}
                    <input
                      type="color"
                      aria-label="Custom accent colour"
                      value={draft.accent ?? '#171717'}
                      onChange={(event) => applyDraft({ accent: event.target.value })}
                      className="h-7 w-9 cursor-pointer border-0 bg-transparent p-0"
                    />
                  </div>
                  {draft.accent && (
                    <p
                      className="mt-2 inline-flex rounded px-2 py-1 text-xs"
                      style={{
                        background: draft.accent,
                        color: contrastText(draft.accent),
                      }}
                    >
                      Preview
                    </p>
                  )}
                </div>

                <div>
                  <GroupHeading
                    onReset={() => applyDraft({ font: 'default', fontColor: null })}
                    resetLabel="Reset text style"
                  >
                    Text
                  </GroupHeading>
                  <label className="sr-only" htmlFor="settings-font">
                    Font
                  </label>
                  <select
                    id="settings-font"
                    className="input"
                    value={draft.font}
                    onChange={(event) => applyDraft({ font: event.target.value as FontKey })}
                  >
                    {FONT_OPTIONS.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">Text colour</span>
                    <input
                      type="color"
                      aria-label="Text colour"
                      value={draft.fontColor ?? '#171717'}
                      onChange={(event) => applyDraft({ fontColor: event.target.value })}
                      className="h-7 w-9 cursor-pointer border-0 bg-transparent p-0"
                    />
                    {draft.fontColor && (
                      <button
                        type="button"
                        className="text-xs text-neutral-500 underline underline-offset-2 dark:text-neutral-400"
                        onClick={() => applyDraft({ fontColor: null })}
                      >
                        Use default
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <GroupHeading
                    onReset={() => applyDraft({ wallpaper: null })}
                    resetLabel="Remove wallpaper"
                  >
                    Wallpaper
                  </GroupHeading>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded border border-neutral-300 bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-800">
                      {draft.wallpaper ? (
                        <img src={draft.wallpaper} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon size={16} className="text-neutral-400" />
                      )}
                    </span>
                    <label className="btn-secondary cursor-pointer text-sm">
                      {preparingWallpaper ? <Loader2 className="animate-spin" size={15} /> : <Upload size={15} />}
                      Choose image
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        disabled={preparingWallpaper}
                        onChange={(event) => {
                          void pickWallpaper(event.target.files?.[0] ?? null);
                          event.target.value = '';
                        }}
                      />
                    </label>
                    {draft.wallpaper && (
                      <button
                        type="button"
                        className="text-xs text-neutral-500 underline underline-offset-2 dark:text-neutral-400"
                        onClick={() => applyDraft({ wallpaper: null })}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    PNG, JPEG or WebP, under 8 MB.
                  </p>
                </div>

                <div>
                  <GroupHeading
                    onReset={() => applyDraft({ clock: false, date: false })}
                    resetLabel="Reset widgets"
                  >
                    Widgets
                  </GroupHeading>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.clock}
                        onChange={(event) => applyDraft({ clock: event.target.checked })}
                      />
                      Clock
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.date}
                        onChange={(event) => applyDraft({ date: event.target.checked })}
                      />
                      Date
                    </label>
                  </div>
                </div>

                <div className="border-t border-neutral-200 pt-4 dark:border-neutral-700">
                  <button type="button" className="btn-secondary w-full" onClick={resetAll}>
                    Reset all personalization
                  </button>
                  {saving && (
                    <p className="mt-2 flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                      <Loader2 className="animate-spin" size={12} /> Saving
                    </p>
                  )}
                </div>
              </section>
            )}

            {tab === 'preferences' && (
              <>
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

                <section className="mb-6" aria-label="Guest reminder">
                  <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
                    The guest account reminder can be turned back on.
                  </p>
                  <button
                    type="button"
                    className="btn-secondary w-full"
                    disabled={!accountReminderOff}
                    onClick={onResetReminder}
                    title={accountReminderOff ? undefined : 'The guest reminder is already shown.'}
                  >
                    Reset account reminder
                  </button>
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
                      <PasswordInput
                        className="input mb-2"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Current password"
                        aria-label="Current password"
                        autoComplete="current-password"
                        required
                      />
                      <PasswordInput
                        className="input mb-2"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New password (at least 8 characters)"
                        aria-label="New password"
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
              </>
            )}

            {tab === 'tab' && (
              <section aria-labelledby="settings-tab-appearance">
                <h3 id="settings-tab-appearance" className="mb-1 text-sm font-medium">
                  Tab appearance
                </h3>
                <p className="mb-4 text-xs text-neutral-500 dark:text-neutral-400">
                  Optional. Sets the page title and icon in your own browser tab. The library still shows Geegle.
                </p>

                <label className="label" htmlFor="tab-title">
                  Page title
                </label>
                <input
                  id="tab-title"
                  className="input mb-3"
                  value={identity.title}
                  maxLength={TAB_TITLE_MAX}
                  onChange={(event) => setIdentity({ ...identity, title: event.target.value })}
                  placeholder={DEFAULT_TAB_IDENTITY.title}
                />

                <div className="mb-2 flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-neutral-300 bg-white dark:border-neutral-600">
                    {identity.icon ? (
                      <img src={identity.icon} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <img src="/favicon.svg" alt="" className="h-full w-full" />
                    )}
                  </span>
                  <label className="btn-secondary cursor-pointer text-sm">
                    <Upload size={15} /> Choose icon
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={(event) => pickIcon(event.target.files?.[0] ?? null)}
                    />
                  </label>
                  {identity.icon && (
                    <button
                      type="button"
                      className="text-xs text-neutral-500 underline underline-offset-2 dark:text-neutral-400"
                      onClick={() => setIdentity({ ...identity, icon: null })}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="mb-4 text-xs text-neutral-500 dark:text-neutral-400">
                  PNG, JPEG or WebP, under 200 KB.
                </p>

                <div className="flex items-center gap-2">
                  <button type="button" className="btn-primary" disabled={saving} onClick={() => void applyIdentity(identity)}>
                    {saving ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />} Apply
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={saving}
                    onClick={() => {
                      setIdentity(DEFAULT_TAB_IDENTITY);
                      void applyIdentity(DEFAULT_TAB_IDENTITY);
                    }}
                  >
                    Reset to defaults
                  </button>
                </div>
              </section>
            )}

            {tab === 'changelog' && <Changelog />}
          </div>
        </div>

        {message && (
          <p
            className={`mt-3 shrink-0 text-sm ${
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
    </motion.div>
  );
}
