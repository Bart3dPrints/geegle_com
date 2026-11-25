// Cloud save manager: automatic sync every 15s, save-on-exit, save-before-
// logout, manual save/restore, timestamp conflict resolution, empty-storage
// protection, and offline recovery. All writes go to geegle_game_saves with
// explicit user ids; RLS enforces ownership server-side.

import { supabase, isSupabaseConfigured, T } from './supabase';
import {
  adapterFor,
  saveSupportFor,
  type SaveSnapshot,
} from './saveAdapters';

export type SyncStatus =
  | 'idle'
  | 'saving'
  | 'saved'
  | 'offline'
  | 'error'
  | 'unsupported';

export interface CloudSaveHandle {
  /** Stop the automatic sync interval and save on exit. */
  close: () => Promise<void>;
  /** Trigger an immediate save (e.g. before logout or on important events). */
  saveNow: (reason?: string) => Promise<void>;
  /** Restore the newest cloud snapshot into local storage. */
  restore: () => Promise<RestoreResult>;
  /** Current sync status (for UI indicators). */
  getStatus: () => SyncStatus;
  /** Whether this game's engine supports cloud saves at all. */
  supported: boolean;
}

export interface RestoreResult {
  ok: boolean;
  /** True when a cloud snapshot was found and applied. */
  restored: boolean;
  /** True when the cloud copy was newer than local data. */
  cloudNewer: boolean;
  error?: string;
}

/** Soft size limit per snapshot (JSON payload). 512 KB keeps us in free tier. */
const MAX_SNAPSHOT_BYTES = 512 * 1024;

const localTimestampKey = (gameId: string) =>
  `geegle-save-meta-${gameId}`;

function readLocalTimestamp(gameId: string): number {
  try {
    const raw = localStorage.getItem(localTimestampKey(gameId));
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

function writeLocalTimestamp(gameId: string, ts: number): void {
  try {
    localStorage.setItem(localTimestampKey(gameId), String(ts));
  } catch {
    /* ignore */
  }
}

/**
 * Start automatic cloud sync for a game.
 * - Immediately attempts a restore (cloud wins when newer than local).
 * - Snapshots local storage every 15 seconds and upserts when changed.
 * - Empty local storage never overwrites existing cloud data.
 * - On close() performs a final save so progress survives immediate exit.
 */
export function startCloudSync(
  gameId: string,
  launchPath: string,
  userId: string | null,
  onStatus?: (status: SyncStatus) => void
): CloudSaveHandle {
  const adapter = adapterFor(gameId, launchPath);
  const supported = adapter !== null;

  let status: SyncStatus = 'idle';
  let timer: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  let lastPayload = '';

  const setStatus = (s: SyncStatus) => {
    status = s;
    onStatus?.(s);
  };

  if (!supported) {
    setStatus('unsupported');
    return {
      close: async () => {},
      saveNow: async () => {},
      restore: async () => ({ ok: true, restored: false, cloudNewer: false }),
      getStatus: () => status,
      supported: false,
    };
  }

  // ── restore: bring cloud data in before the game initializes ────────────
  const restoreOnce = (async () => {
    if (!userId || !isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase
        .from(T.saves)
        .select('save_data, updated_at')
        .eq('user_id', userId)
        .eq('game_id', gameId)
        .eq('save_key', 'default')
        .maybeSingle();
      if (error) {
        console.error('[saves] restore query failed:', error.message);
        return;
      }
      if (!data?.save_data) return;

      const cloud = data.save_data as SaveSnapshot;
      const cloudTs = cloud?.timestamp ?? 0;
      const localTs = readLocalTimestamp(gameId);

      // Only restore when the cloud copy is newer than local progress.
      // (Protects a device with newer local data from being clobbered by an
      // older cloud copy; also protects empty local storage from being
      // "restored" with nothing and then overwriting the cloud.)
      if (cloudTs > localTs) {
        await adapter.restore(gameId, cloud);
        writeLocalTimestamp(gameId, cloudTs);
      }
    } catch {
      /* offline at launch — local data still used */
    }
  })();

  const uploadSnapshot = async (): Promise<void> => {
    if (closed || !userId || !isSupabaseConfigured || !adapter) return;

    const snapshot = await adapter.capture(gameId);

    // Empty-storage protection: never overwrite cloud saves with nothing.
    if (!snapshot) return;

    // Skip upload when the payload hasn't changed since the last save.
    const payload = JSON.stringify(snapshot);
    if (payload === lastPayload) return;

    if (payload.length > MAX_SNAPSHOT_BYTES) {
      console.warn(
        `[saves] ${gameId} snapshot too large (${payload.length} bytes); skipping`
      );
      return;
    }

    setStatus('saving');
    const { error } = await supabase.from(T.saves).upsert(
      {
        user_id: userId,
        game_id: gameId,
        save_key: 'default',
        save_data: snapshot as unknown as object,
      },
      { onConflict: 'user_id,game_id,save_key' }
    );

    if (error) {
      console.error('[saves] upload failed:', error.message);
      setStatus(navigator.onLine ? 'error' : 'offline');
      return;
    }

    lastPayload = payload;
    writeLocalTimestamp(gameId, snapshot.timestamp);
    setStatus('saved');
  };

  // ── auto sync every 15 seconds ──────────────────────────────────────────
  void restoreOnce.then(() => {
    if (closed) return;
    void uploadSnapshot();
    timer = setInterval(() => {
      void uploadSnapshot();
    }, 15_000);
  });

  const saveNow = async (_reason?: string) => {
    await restoreOnce;
    await uploadSnapshot();
  };

  return {
    close: async () => {
      closed = true;
      if (timer) clearInterval(timer);
      // Final save so progress made in this session survives exiting.
      await uploadSnapshot();
    },
    saveNow,
    restore: async () => {
      if (!userId || !isSupabaseConfigured || !adapter) {
        return {
          ok: false,
          restored: false,
          cloudNewer: false,
          error: 'Cloud saves unavailable for this game or account.',
        };
      }
      try {
        const { data, error } = await supabase
          .from(T.saves)
          .select('save_data')
          .eq('user_id', userId)
          .eq('game_id', gameId)
          .eq('save_key', 'default')
          .maybeSingle();
        if (error) {
          return {
            ok: false,
            restored: false,
            cloudNewer: false,
            error: error.message,
          };
        }
        const cloud = data?.save_data as SaveSnapshot | undefined;
        if (!cloud) {
          return {
            ok: true,
            restored: false,
            cloudNewer: false,
          };
        }
        await adapter.restore(gameId, cloud);
        writeLocalTimestamp(gameId, cloud.timestamp);
        return { ok: true, restored: true, cloudNewer: true };
      } catch (e) {
        return {
          ok: false,
          restored: false,
          cloudNewer: false,
          error: e instanceof Error ? e.message : 'Restore failed.',
        };
      }
    },
    getStatus: () => status,
    supported: true,
  };
}

export { saveSupportFor };
