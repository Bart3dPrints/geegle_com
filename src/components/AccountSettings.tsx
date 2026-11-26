// Account settings: password change, Recently Played visibility and sign-out.
// Accounts persist indefinitely per the owner's cancellation of the
// inactivity-deletion feature.
import { useState } from 'react';
import { motion } from 'motion/react';
import { X, KeyRound, LogOut, Loader2, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function AccountSettings({
  username,
  showRecent,
  onShowRecentChange,
  onClose,
  onSignedOut,
}: {
  username: string;
  showRecent: boolean;
  onShowRecentChange: (visible: boolean) => void;
  onClose: () => void;
  onSignedOut: () => Promise<void>;
}) {
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Account settings"
    >
      <motion.div
        className="card w-full max-w-md p-6"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2>Account</h2>
          <button onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Signed in as <b>{username}</b>.
        </p>

        <label className="mb-6 flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={showRecent}
            onChange={(e) => onShowRecentChange(e.target.checked)}
          />
          <span>
            Show Recently Played
            <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
              Adds a Recently Played row to the Games library.
            </span>
          </span>
        </label>

        <form onSubmit={changePassword} className="mb-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
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
          {message && (
            <p
              className={`mb-2 text-sm ${
                message.kind === 'ok'
                  ? 'text-slate-700 dark:text-slate-300'
                  : 'text-red-600 dark:text-red-400'
              }`}
              role="alert"
            >
              {message.text}
            </p>
          )}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Update password
          </button>
        </form>
        <button className="btn-secondary w-full" onClick={onSignedOut}>
          <LogOut size={16} /> Log out
        </button>
      </motion.div>
    </div>
  );
}
