// Account settings: password change and sign-out. Accounts persist
// indefinitely per the owner's cancellation of the inactivity-deletion feature.
import { useState } from 'react';
import { X, KeyRound, LogOut, Loader2, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { readKnownDeviceSaves } from '../lib/saveAdapters';
import { downloadArchive, readCloudSaveArchive, readDevicePreferences } from '../lib/saveTransfer';

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

  const exportData = async (source: 'cloud' | 'device') => {
    setBusy(true);
    setMessage(null);
    try {
      if (source === 'device') {
        const preferences = await readDevicePreferences();
        const { data } = await supabase.auth.getSession();
        if (!data.session) throw new Error('Sign in before exporting account device data.');
        downloadArchive('geegle-device-data.json', { preferences, games: readKnownDeviceSaves(data.session.user.id) });
      } else {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session) throw new Error('Sign in before exporting your cloud saves.');
        const userId = data.session.user.id;
        const saves = await readCloudSaveArchive(userId);
        const { data: current } = await supabase.auth.getSession();
        if (current.session?.user.id !== userId) throw new Error('The account changed. Please try again.');
        downloadArchive('geegle-cloud-saves.json', { format: 'geegle-save-archive-v1', saves });
      }
    } catch (error) {
      setMessage({ kind: 'err', text: error instanceof Error ? error.message : 'Could not export data.' });
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
      <div className="card max-h-[90dvh] w-full max-w-md overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2>Account</h2>
          <button onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </div>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
          Signed in as <b>{username}</b>. Supported game saves, favorites, and account preferences can sync across devices.
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
        <div className="mb-4 space-y-2">
          <button className="btn-secondary w-full" disabled={busy} onClick={() => void exportData('cloud')}>Export cloud saves (including older formats)</button>
          <button className="btn-secondary w-full" disabled={busy} onClick={() => void exportData('device')}>Export device preferences and supported saves</button>
          <p className="text-xs text-slate-500">Exports do not change any data. Older formats may require manual recovery. Unassigned preferences are still available when signed out.</p>
          <p className="text-xs text-slate-500">Local games share this site’s browser storage. Only run games you trust while signed in.</p>
        </div>
        <button className="btn-secondary w-full" disabled={busy} onClick={onSignedOut}>
          <LogOut size={16} /> Log out
        </button>
      </div>
    </div>
  );
}
