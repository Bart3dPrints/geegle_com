// Account settings: password change, sign-out, and account info.

import { useState } from 'react';
import { X, KeyRound, LogOut, Loader2, Check } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export function AccountSettings({
  username,
  onClose,
  onSignedOut,
}: {
  username: string;
  onClose: () => void;
  onSignedOut: () => Promise<void>;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<
    { kind: 'ok' | 'err'; text: string } | null
  >(null);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword.length < 8) {
      setMessage({
        kind: 'err',
        text: 'New password must be at least 8 characters.',
      });
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        setMessage({
          kind: 'err',
          text:
            error.message.includes('different from the old')
              ? 'New password must differ from the current one.'
              : `Could not change password: ${error.message}`,
        });
      } else {
        setMessage({
          kind: 'ok',
          text: 'Password updated. Use it next time you sign in.',
        });
        setCurrentPassword('');
        setNewPassword('');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Account settings"
    >
      <div className="card w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2>Account</h2>
          <button
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
          Signed in as <span className="font-medium">{username}</span>. Your
          saves, favorites, and preferences are synced to this account and
          follow you to any device.
        </p>

        {isSupabaseConfigured && (
          <form onSubmit={changePassword} className="mb-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <KeyRound size={14} />
              Change password
            </div>
            <label className="label" htmlFor="new-password">
              New password
            </label>
            <input
              id="new-password"
              className="input mb-2"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              required
            />
            {message && (
              <p
                className={`mb-2 text-sm ${
                  message.kind === 'ok'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
                role="alert"
              >
                {message.text}
              </p>
            )}
            <button className="btn-primary w-full" disabled={busy} type="submit">
              {busy ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Check size={16} />
              )}
              Update password
            </button>
          </form>
        )}

        <button
          className="btn-secondary w-full"
          onClick={onSignedOut}
          aria-label="Log out"
        >
          <LogOut size={16} />
          Log out
        </button>
      </div>
    </div>
  );
}
