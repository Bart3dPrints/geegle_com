// Cloud save lifecycle. A handle is account-scoped and game-scoped.
// A failed restore blocks automatic upload until the user explicitly retries;
// this prevents a fresh/default browser from overwriting a good cloud save.

import { supabase, isSupabaseConfigured, T } from './supabase';
import { adapterFor, adapterLabel, type SaveSnapshot } from './saveAdapters';

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'restoring' | 'restored' | 'offline' | 'error' | 'unsupported';
export interface SaveResult { ok: boolean; error?: string }
export interface RestoreResult extends SaveResult { restored: boolean }
export interface CloudSaveHandle {
  restored: Promise<void>;
  close: () => Promise<SaveResult>;
  saveNow: () => Promise<SaveResult>;
  restore: () => Promise<RestoreResult>;
  getStatus: () => SyncStatus;
  supportLabel: string;
  supported: boolean;
}

const MAX_SNAPSHOT_BYTES = 512 * 1024;
const SYNC_INTERVAL_MS = 15_000;
function metaKey(game: string, user: string) { return `geegle-save-meta-${user}-${game}`; }
function readTs(game: string, user: string) { try { return Number(localStorage.getItem(metaKey(game, user))) || 0; } catch { return 0; } }
function writeTs(game: string, user: string, ts: number) { try { localStorage.setItem(metaKey(game, user), String(ts)); } catch {} }
function fingerprint(s: SaveSnapshot): string { const x = JSON.stringify({ ...s, timestamp: 0 }); let h = 2166136261; for (let i = 0; i < x.length; i++) h = Math.imul(h ^ x.charCodeAt(i), 16777619); return `${x.length}:${h >>> 0}`; }

export function startCloudSync(gameId: string, launchPath: string, userId: string | null, onStatus?: (s: SyncStatus) => void): CloudSaveHandle {
  const adapter = adapterFor(launchPath);
  let status: SyncStatus = adapter ? 'idle' : 'unsupported';
  let timer: ReturnType<typeof setInterval> | null = null;
  let disposed = false;
  let restoreFailed = false;
  let lastHash = '';
  let uploadPromise: Promise<SaveResult> | null = null;
  let closePromise: Promise<SaveResult> | null = null;
  const setStatus = (s: SyncStatus) => { status = s; onStatus?.(s); };

  if (!adapter) return {
    restored: Promise.resolve(), close: async () => ({ ok: true }), saveNow: async () => ({ ok: false, error: 'Cloud saves are unsupported for this cross-origin game.' }), restore: async () => ({ ok: false, restored: false, error: 'Cloud saves are unsupported for this cross-origin game.' }), getStatus: () => 'unsupported', supportLabel: adapterLabel(launchPath), supported: false,
  };

  const restored = (async () => {
    if (!userId || !isSupabaseConfigured) return;
    setStatus('restoring');
    try {
      const { data, error } = await supabase.from(T.saves).select('save_data,updated_at').eq('user_id', userId).eq('game_id', gameId).eq('save_key', 'default').maybeSingle();
      if (error) { restoreFailed = true; setStatus(navigator.onLine ? 'error' : 'offline'); return; }
      const cloud = data?.save_data as SaveSnapshot | undefined;
      if (!cloud) { setStatus('idle'); return; }
      const cloudTs = cloud.timestamp || (data?.updated_at ? Date.parse(data.updated_at) : 0);
      if (cloudTs <= readTs(gameId, userId)) { lastHash = fingerprint(cloud); setStatus('idle'); return; }
      const applied = await adapter.restore(gameId, cloud);
      if (!applied) { restoreFailed = true; setStatus('error'); return; }
      writeTs(gameId, userId, cloudTs); lastHash = fingerprint(cloud); setStatus('restored');
    } catch (e) { restoreFailed = true; setStatus(navigator.onLine ? 'error' : 'offline'); console.error('[saves] restore failed', e); }
  })();

  const doUpload = async (): Promise<SaveResult> => {
    if (disposed || !userId || !isSupabaseConfigured) return { ok: false, error: 'Cloud saves require a signed-in account.' };
    if (restoreFailed) return { ok: false, error: 'Restore failed; upload is paused to protect the existing cloud save.' };
    if (!navigator.onLine) { setStatus('offline'); return { ok: false, error: 'You are offline. The next sync will retry automatically.' }; }
    const snapshot = await adapter.capture(gameId);
    if (!snapshot) return { ok: true }; // empty-save protection
    const hash = fingerprint(snapshot);
    if (hash === lastHash) return { ok: true };
    const body = JSON.stringify(snapshot);
    if (body.length > MAX_SNAPSHOT_BYTES) return { ok: false, error: 'Save data exceeds the 512 KB limit.' };
    setStatus('saving');
    const { error } = await supabase.from(T.saves).upsert({ user_id: userId, game_id: gameId, save_key: 'default', save_data: snapshot }, { onConflict: 'user_id,game_id,save_key' });
    if (error) { setStatus(navigator.onLine ? 'error' : 'offline'); return { ok: false, error: error.message }; }
    lastHash = hash; writeTs(gameId, userId, snapshot.timestamp); setStatus('saved'); return { ok: true };
  };
  const upload = () => { if (!uploadPromise) uploadPromise = doUpload().finally(() => { uploadPromise = null; }); return uploadPromise; };
  void restored.then(() => { if (disposed || restoreFailed) return; void upload(); timer = setInterval(() => void upload(), SYNC_INTERVAL_MS); });

  const close = (): Promise<SaveResult> => {
    if (closePromise) return closePromise;
    closePromise = (async () => {
      if (timer) { clearInterval(timer); timer = null; }
      await restored;
      const result = restoreFailed ? { ok: false, error: 'Restore failed; final upload withheld to protect cloud data.' } : await upload();
      // Wait for the actual in-flight operation, not a boolean flag.
      if (uploadPromise) await uploadPromise;
      disposed = true;
      // Remove only captured game keys after a successful authenticated save.
      // This prevents account A's same-origin keys being seen by account B.
      if (result.ok && userId) await adapter.clear(gameId);
      return result;
    })();
    return closePromise;
  };

  const restore = async (): Promise<RestoreResult> => {
    if (!userId || !isSupabaseConfigured) return { ok: false, restored: false, error: 'Sign in to use cloud saves.' };
    setStatus('restoring');
    const { data, error } = await supabase.from(T.saves).select('save_data').eq('user_id', userId).eq('game_id', gameId).eq('save_key', 'default').maybeSingle();
    if (error) { restoreFailed = true; setStatus('error'); return { ok: false, restored: false, error: error.message }; }
    const cloud = data?.save_data as SaveSnapshot | undefined;
    if (!cloud) return { ok: true, restored: false };
    const applied = await adapter.restore(gameId, cloud);
    if (!applied) { restoreFailed = true; setStatus('error'); return { ok: false, restored: false, error: 'Cloud data could not be fully applied.' }; }
    restoreFailed = false; writeTs(gameId, userId, cloud.timestamp); lastHash = fingerprint(cloud); setStatus('restored'); return { ok: true, restored: true };
  };

  return { restored, close, saveNow: upload, restore, getStatus: () => status, supportLabel: adapter.label, supported: true };
}
export { adapterLabel };
