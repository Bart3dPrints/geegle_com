// Account settings: password change and sign-out. Accounts persist
// indefinitely per the owner's cancellation of the inactivity-deletion feature.
import { useState } from 'react';
import { X, KeyRound, LogOut, Loader2, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function AccountSettings({
  username,
  onClose,
  onSignedOut,
}: {
  username: string;
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
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2>Account</h2>
          <button onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </div>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
          Signed in as <b>{username}</b>. Your saves, favorites, and preferences
          are synced to this account and follow you to any device.
        </p>
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
            <p className={`mb-2 text-sm ${message.kind === 'ok' ? 'text-emerald-600' : 'text-red-600'}`} role="alert">
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
      </div>
    </div>
  );
}
