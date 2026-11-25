import { supabase, isSupabaseConfigured, T } from './supabase';
import { adapterFor, IsolationError, type SaveSnapshot } from './saveAdapters';

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
  /** Download this account's save as a JSON file; null when nothing is stored. */
  exportSave(): Promise<SaveResult & { json?: string }>;
  /** Import a previously exported save file and sync it to the cloud. */
  importSave(json: string): Promise<SaveResult>;
  getStatus(): SyncStatus;
  /** False when account isolation could not be established; launch must wait. */
  canLaunch(): boolean;
  launchPath: string;
  supported: boolean;
}

type Adapter = NonNullable<ReturnType<typeof adapterFor>>;
interface CloudRow { revision: string; save_data: unknown }
interface SaveRemote {
  read(): Promise<CloudRow | null>;
  write(snapshot: SaveSnapshot, revision: string | null): Promise<string | null>;
}

// IndexedDB dumps (Unity IDBFS, Ruffle shared objects) are larger than plain
// key/value saves, so the limit accounts for base64-encoded binary data.
const MAX_SNAPSHOT_BYTES = 4 * 1024 * 1024;
const SYNC_INTERVAL_MS = 15_000;
const conflictMessage = 'Cloud progress changed on another device. Choose Restore from Cloud or Keep This Device.';
// Isolation failures are the one condition that must stop a game from opening.
const isIsolationError = (error: unknown) => error instanceof IsolationError;
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
    return { revision: row?.revision ?? null, snapshot: row ? adapter.validate(row.save_data, userId) : null };
  };

  let retryRead = false;
  let launchBlocked = false;
  const initialize = async (beforeLaunch: boolean) => {
    if (disposed) return;
    setStatus('restoring');
    try {
      // Isolation is established before the cloud read: a failed read must not
      // leave another account's local data visible to this one.
      if (beforeLaunch) await adapter.isolate(userId);
      if (disposed) return;
      const cloud = await read();
      if (disposed) return;
      const local = serialize(await adapter.capture(userId));
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
          await adapter.restore(userId, cloud.snapshot);
        }
      } else if (cloud.snapshot && !local) {
        if (!beforeLaunch) {
          conflict(cloud.revision);
          return;
        }
        await adapter.restore(userId, cloud.snapshot);
      }
      await remember(cloud.revision, cloudData);
      setStatus(cloud.snapshot && (cloudData === local || !local || localUnchanged) ? 'restored' : 'idle');
    } catch (error) {
      retryRead = !navigator.onLine;
      fail(error);
      // Only an isolation failure blocks launch; a network failure leaves this
      // account's own data in place and can be retried.
      if (beforeLaunch) launchBlocked = isIsolationError(error);
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
      const snapshot = await adapter.capture(userId);
      if (!snapshot) return success;
      const body = JSON.stringify(snapshot);
      if (body === base) {
        if (status === 'offline' || status === 'error') setStatus(revision ? 'saved' : 'idle');
        return success;
      }
      if (!navigator.onLine) return fail(new Error('Offline. Your device still has its progress; sync will retry.'));
      if (new TextEncoder().encode(body).byteLength > MAX_SNAPSHOT_BYTES) {
        return fail(new Error('Save data exceeds the 4 MB limit.'));
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
      if (cloud.snapshot) await adapter.restore(userId, cloud.snapshot);
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
      if (!(await adapter.capture(userId))) return { ok: false, error: 'No saved progress on this device.' };
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

  const exportSave = (): Promise<SaveResult & { json?: string }> => schedule(async () => {
    try {
      const snapshot = await adapter.capture(userId);
      if (!snapshot) return { ok: false, error: 'No saved progress on this device yet.' };
      return { ok: true, json: JSON.stringify(snapshot, null, 2) };
    } catch (error) {
      return { ok: false, error: describe(error) };
    }
  });

  const importSave = (json: string): Promise<SaveResult> => schedule(async () => {
    try {
      const snapshot = adapter.validate(JSON.parse(json), userId);
      if (!canUpload) {
        return { ok: false, error: 'Restore from the cloud (or resolve the conflict) before importing a save.' };
      }
      await adapter.restore(userId, snapshot);
      return upload();
    } catch (error) {
      return { ok: false, error: describe(error) };
    }
  });

  const dispose = () => {
    disposed = true;
    clearInterval(timer);
    return queue.then(() => undefined);
  };

  return {
    restored, close, saveNow, restore, keepLocal, exportSave, importSave,
    getStatus: () => status, canLaunch: () => !launchBlocked,
    launchPath: adapter.launchPath(userId), supported: true, dispose,
  };
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
    exportSave: async () => result, importSave: async () => result,
    getStatus: () => userId ? 'unsupported' : 'idle', canLaunch: () => true,
    launchPath, supported: false, dispose: async () => {},
  };
}
