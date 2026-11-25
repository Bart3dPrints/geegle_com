import { supabase, isSupabaseConfigured, T } from './supabase';
import { adapterFor, type SaveSnapshot } from './saveAdapters';

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'restoring' | 'restored' | 'offline' | 'error' | 'conflict' | 'unsupported';
export interface SaveResult { ok: boolean; error?: string }
export interface RestoreResult extends SaveResult { restored: boolean }
export interface CloudSaveHandle {
  restored: Promise<void>;
  close(): Promise<SaveResult>;
  dispose(): Promise<void>;
  saveNow(): Promise<SaveResult>;
  restore(): Promise<RestoreResult>;
  keepLocal(): Promise<SaveResult>;
  getStatus(): SyncStatus;
  launchPath: string;
  supported: boolean;
}

type Adapter = NonNullable<ReturnType<typeof adapterFor>>;
interface CloudRow { revision: string; save_data: unknown }
interface SaveRemote {
  read(): Promise<CloudRow | null>;
  write(snapshot: SaveSnapshot, revision: string | null): Promise<string | null>;
}

const MAX_SNAPSHOT_BYTES = 512 * 1024;
const SYNC_INTERVAL_MS = 15_000;
const conflictMessage = 'Cloud progress changed on another device. Choose Restore from Cloud or Keep This Device.';
const success = { ok: true };
const describe = (error: unknown) => error instanceof Error ? error.message : 'Cloud sync failed.';

function saveRemote(userId: string, gameId: string): SaveRemote {
  const identity = { user_id: userId, game_id: gameId, save_key: 'default' };
  return {
    async read() {
      const { data, error } = await supabase.from(T.saves).select('revision,save_data').match(identity)
        .abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    async write(save_data, revision) {
      const table = supabase.from(T.saves);
      const query = revision === null
        ? table.insert({ ...identity, save_data })
        : table.update({ save_data }).match({ ...identity, revision });
      const { data, error } = await query.select('revision').abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
      if (error?.code === '23505' && revision === null) return null;
      if (error) throw new Error(error.message);
      return data?.revision ?? null;
    },
  };
}

export function createSaveSession(
  gameId: string,
  userId: string,
  adapter: Adapter,
  remote: SaveRemote,
  onStatus?: (s: SyncStatus) => void,
): CloudSaveHandle {
  const checkpointKey = `geegle-save-checkpoint:${gameId}:${userId}`;
  const checkpoint = (): { revision: string; digest: string | null } | null => {
    const value = localStorage.getItem(checkpointKey);
    return value ? JSON.parse(value) : null;
  };
  const digest = async (value: string | null) => value === null ? null
    : Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
      .map((byte) => byte.toString(16).padStart(2, '0')).join('');
  let revision: string | null = null;
  let base: string | null = null;
  let canUpload = false;
  let status: SyncStatus = 'idle';
  let disposed = false;
  let queue: Promise<unknown> = Promise.resolve();
  let closing: Promise<SaveResult> | null = null;
  let conflictingRevision: string | null | undefined;
  const setStatus = (next: SyncStatus) => { status = next; onStatus?.(next); };
  const unavailable = () => navigator.onLine ? 'error' : 'offline';
  const serialize = (snapshot: SaveSnapshot | null) => snapshot ? JSON.stringify(snapshot) : null;
  const remember = async (remoteRevision: string | null, data: string | null) => {
    if (remoteRevision) localStorage.setItem(checkpointKey, JSON.stringify({ revision: remoteRevision, digest: await digest(data) }));
    else localStorage.removeItem(checkpointKey);
    revision = remoteRevision;
    base = data;
    canUpload = true;
    conflictingRevision = undefined;
  };
  const conflict = (remoteRevision: string | null): SaveResult => {
    canUpload = false;
    conflictingRevision = remoteRevision;
    setStatus('conflict');
    return { ok: false, error: conflictMessage };
  };
  const fail = (error: unknown): SaveResult => {
    setStatus(unavailable());
    return { ok: false, error: describe(error) };
  };
  const schedule = <T>(work: () => Promise<T>): Promise<T> => {
    const result = queue.then(work);
    queue = result.catch(() => undefined);
    return result;
  };

  const read = async () => {
    const row = await remote.read();
    return { revision: row?.revision ?? null, snapshot: row ? adapter.validate(row.save_data) : null };
  };

  let retryRead = false;
  const initialize = async (beforeLaunch: boolean) => {
    if (disposed) return;
    setStatus('restoring');
    try {
      const cloud = await read();
      if (disposed) return;
      const local = serialize(adapter.capture(userId));
      const cloudData = serialize(cloud.snapshot);
      const previous = checkpoint();
      if (!cloud.snapshot && previous && local) {
        conflict(cloud.revision);
        return;
      }
      const localUnchanged = previous && await digest(local) === previous.digest;
      retryRead = false;
      if (local !== cloudData && previous?.revision !== cloud.revision) {
        if (local && !localUnchanged && (cloud.snapshot || previous)) {
          conflict(cloud.revision);
          return;
        }
        if (cloud.snapshot) {
          if (!beforeLaunch) {
            conflict(cloud.revision);
            return;
          }
          adapter.restore(userId, cloud.snapshot);
        }
      } else if (cloud.snapshot && !local) {
        if (!beforeLaunch) {
          conflict(cloud.revision);
          return;
        }
        adapter.restore(userId, cloud.snapshot);
      }
      await remember(cloud.revision, cloudData);
      setStatus(cloud.snapshot && (cloudData === local || !local || localUnchanged) ? 'restored' : 'idle');
    } catch (error) {
      retryRead = !navigator.onLine;
      fail(error);
    }
  };
  const restored = schedule(() => initialize(true));

  const upload = async (): Promise<SaveResult> => {
    if (disposed) return success;
    if (retryRead && navigator.onLine) await initialize(false);
    if (!canUpload) {
      return { ok: false, error: status === 'conflict' ? conflictMessage : 'Cloud restore has not succeeded. Retry Restore from Cloud before saving.' };
    }
    try {
      const snapshot = adapter.capture(userId);
      if (!snapshot) return success;
      const body = JSON.stringify(snapshot);
      if (body === base) {
        if (status === 'offline' || status === 'error') setStatus(revision ? 'saved' : 'idle');
        return success;
      }
      if (!navigator.onLine) return fail(new Error('Offline. Your device still has its progress; sync will retry.'));
      if (new TextEncoder().encode(body).byteLength > MAX_SNAPSHOT_BYTES) {
        return fail(new Error('Save data exceeds the 512 KB limit.'));
      }
      setStatus('saving');
      const next = await remote.write(snapshot, revision);
      if (!next) {
        canUpload = false;
        const latest = await read();
        if (serialize(latest.snapshot) !== body) return conflict(latest.revision);
        await remember(latest.revision, body);
      } else {
        await remember(next, body);
      }
      setStatus('saved');
      return success;
    } catch (error) {
      return fail(error);
    }
  };

  let pending: Promise<SaveResult> | null = null;
  const saveNow = () => {
    if (closing) return closing;
    if (!pending) pending = schedule(upload).finally(() => { pending = null; });
    return pending;
  };
  const timer = setInterval(() => { void saveNow(); }, SYNC_INTERVAL_MS);
  const close = (): Promise<SaveResult> => {
    if (!closing) {
      closing = schedule(async () => {
        // Capture again after a pending upload; the game may have saved during it.
        const result = await upload();
        if (result.ok) {
          disposed = true;
          clearInterval(timer);
        }
        return result;
      }).finally(() => { closing = null; });
    }
    return closing;
  };

  const restore = (): Promise<RestoreResult> => schedule(async () => {
    if (disposed) return { ok: false, restored: false, error: 'This game is closing.' };
    canUpload = false;
    setStatus('restoring');
    try {
      const cloud = await read();
      retryRead = false;
      if (cloud.snapshot) adapter.restore(userId, cloud.snapshot);
      await remember(cloud.revision, serialize(cloud.snapshot));
      setStatus(cloud.snapshot ? 'restored' : 'idle');
      return { ok: true, restored: Boolean(cloud.snapshot) };
    } catch (error) {
      return { ...fail(error), restored: false };
    }
  });

  const keepLocal = (): Promise<SaveResult> => schedule(async () => {
    if (disposed || status !== 'conflict' || conflictingRevision === undefined) return { ok: false, error: 'No cloud conflict to resolve.' };
    try {
      const cloud = await read();
      if (cloud.revision !== conflictingRevision) return conflict(cloud.revision);
      if (!adapter.capture(userId)) return { ok: false, error: 'No saved progress on this device.' };
      revision = cloud.revision;
      base = serialize(cloud.snapshot);
      canUpload = true;
      const result = await upload();
      if (!result.ok) canUpload = false;
      return result;
    } catch (error) {
      return fail(error);
    }
  });

  const dispose = () => {
    disposed = true;
    clearInterval(timer);
    return queue.then(() => undefined);
  };

  return { restored, close, saveNow, restore, keepLocal, getStatus: () => status, launchPath: adapter.launchPath(userId), supported: true, dispose };
}

export function startCloudSync(gameId: string, launchPath: string, userId: string | null, onStatus?: (s: SyncStatus) => void): CloudSaveHandle {
  const adapter = adapterFor(gameId, launchPath);
  if (adapter && userId && isSupabaseConfigured) {
    return createSaveSession(gameId, userId, adapter, saveRemote(userId, gameId), onStatus);
  }
  const result = { ok: false, error: adapter ? 'Sign in to use cloud saves.' : 'Cloud saves are unavailable for this game.' };
  return {
    restored: Promise.resolve(), close: async () => success, saveNow: async () => result,
    restore: async () => ({ ...result, restored: false }), keepLocal: async () => result,
    getStatus: () => userId ? 'unsupported' : 'idle', launchPath, supported: false, dispose: async () => {},
  };
}
