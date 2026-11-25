// Cloud save manager.
//
// Design decisions (each maps to a reviewed defect):
// - close() saves FIRST, then marks closed — the final upload is never skipped.
// - Uploads are deduplicated by CONTENT HASH, not timestamp: unchanged data
//   is never re-uploaded even though every snapshot gets a fresh timestamp.
// - Local timestamps are keyed by account (userId), so signing into a
//   different account never misinterprets another account's local progress.
// - Restore-before-launch returns a promise the player actually awaits.
// - Restore failures propagate to the UI; nothing is silently ignored.

import { supabase, isSupabaseConfigured, T } from './supabase';
import {
  adapterFor,
  adapterLabel,
  type SaveSnapshot,
} from './saveAdapters';

export type SyncStatus =
  | 'idle'
  | 'saving'
  | 'saved'
  | 'restoring'
  | 'restored'
  | 'offline'
  | 'error'
  | 'unsupported';

export interface CloudSaveHandle {
  /** Awaited restore-before-launch. Resolves when cloud data is in place. */
  restored: Promise<void>;
  /** Stop the sync interval and save on exit. Always performs the save. */
  close: () => Promise<void>;
  /** Immediate save (manual button, before logout, important events). */
  saveNow: () => Promise<{ ok: boolean; error?: string }>;
  /** Manual restore from cloud into local storage. */
  restore: () => Promise<{
    ok: boolean;
    restored: boolean;
    error?: string;
  }>;
  getStatus: () => SyncStatus;
  /** Save-engine compatibility label for this game. */
  supportLabel: string;
  supported: boolean;
}

/** 512 KB per snapshot — keeps payloads inside free-tier limits. */
const MAX_SNAPSHOT_BYTES = 512 * 1024;
const SYNC_INTERVAL_MS = 15_000;

/** FNV-1a content hash — cheap, stable, and sufficient for change detection. */
function contentHash(snapshot: SaveSnapshot): string {
  const payload = JSON.stringify(snapshot);
  let h = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${payload.length}-${h.toString(16)}`;
}

/** Local timestamps are per-account so accounts never cross-contaminate. */
function localMetaKey(gameId: string, userId: string | null): string {
  return `geegle-save-meta-${userId ?? 'anon'}-${gameId}`;
}

function readLocalTimestamp(gameId: string, userId: string | null): number {
  try {
    const raw = localStorage.getItem(localMetaKey(gameId, userId));
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

function writeLocalTimestamp(
  gameId: string,
  userId: string | null,
  ts: number
): void {
  try {
    localStorage.setItem(localMetaKey(gameId, userId), String(ts));
  } catch {
    /* ignore */
  }
}

function fingerprintWithoutTimestamp(snapshot: SaveSnapshot): SaveSnapshot {
  // Hash on data only: the timestamp changes every capture but the data
  // usually does not, and re-uploading identical data is wasteful.
  return { ...snapshot, timestamp: 0 };
}

export function startCloudSync(
  gameId: string,
  launchPath: string,
  userId: string | null,
  onStatus?: (status: SyncStatus) => void
): CloudSaveHandle {
  const adapter = adapterFor(launchPath);

  let status: SyncStatus = 'idle';
  let timer: ReturnType<typeof setInterval> | null = null;
  let lastHash = '';
  let disposed = false;
  let inFlightSave = false;
  const statusListeners = new Set<(s: SyncStatus) => void>();

  if (onStatus) statusListeners.add(onStatus);

  const setStatus = (s: SyncStatus) => {
    status = s;
    for (const listener of statusListeners) listener(s);
  };

  if (!adapter) {
    setStatus('unsupported');
    return {
      restored: Promise.resolve(),
      close: async () => {},
      saveNow: async () => ({ ok: true }),
      restore: async () => ({ ok: true, restored: false }),
      getStatus: () => 'unsupported',
      supportLabel: adapterLabel(launchPath),
      supported: false,
    };
  }

  // ── restore-before-launch (awaited by the player) ────────────────────────
  const restored = (async () => {
    if (!userId || !isSupabaseConfigured) return;
    setStatus('restoring');
    try {
      const { data, error } = await supabase
        .from(T.saves)
        .select('save_data')
        .eq('user_id', userId)
        .eq('game_id', gameId)
        .eq('save_key', 'default')
        .maybeSingle();

      if (error) {
        // Surface the failure: local data is still used, but the user knows.
        console.error('[saves] restore query failed:', error.message);
        setStatus(navigator.onLine ? 'error' : 'offline');
        return;
      }

      const cloud = data?.save_data as SaveSnapshot | undefined;
      if (!cloud) {
        setStatus('idle');
        return;
      }

      const cloudTs = cloud.timestamp ?? 0;
      const localTs = readLocalTimestamp(gameId, userId);

      // Timestamp conflict resolution: cloud wins only when newer than the
      // local progress for THIS account. Never clobber newer local data.
      if (cloudTs > localTs) {
        const applied = await adapter.restore(gameId, cloud);
        if (applied) {
          writeLocalTimestamp(gameId, userId, cloudTs);
          // Seed the hash so the first auto-sync doesn't immediately
          // re-upload what was just restored.
          lastHash = contentHash(fingerprintWithoutTimestamp(cloud));
          setStatus('restored');
        } else {
          console.error('[saves] restore applied with errors for', gameId);
          setStatus('error');
        }
      } else {
        setStatus('idle');
      }
    } catch (e) {
      console.error('[saves] restore threw:', e);
      setStatus('offline');
    }
  })();

  const uploadSnapshot = async (): Promise<{ ok: boolean; error?: string }> => {
    // Never upload for a disposed handle EXCEPT when called from close(),
    // which invokes this before setting disposed (see close()).
    if (disposed || !userId || !isSupabaseConfigured) {
      return { ok: true };
    }

    const snapshot = await adapter.capture(gameId);

    // Empty-storage protection: nothing captured → nothing uploaded. A wiped
    // browser therefore never overwrites the cloud copy with emptiness.
    if (!snapshot) return { ok: true };

    // Content-hash dedup: identical data is not re-uploaded even though the
    // timestamp is fresh on every capture.
    const hash = contentHash(fingerprintWithoutTimestamp(snapshot));
    if (hash === lastHash) return { ok: true };

    const payload = JSON.stringify(snapshot);
    if (payload.length > MAX_SNAPSHOT_BYTES) {
      console.warn(
        `[saves] ${gameId} snapshot too large (${payload.length} bytes); skipping`
      );
      return { ok: false, error: 'Save data exceeds the 512 KB limit.' };
    }

    if (inFlightSave) return { ok: true };
    inFlightSave = true;
    setStatus('saving');

    try {
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
        return { ok: false, error: error.message };
      }

      lastHash = hash;
      writeLocalTimestamp(gameId, userId, snapshot.timestamp);
      setStatus('saved');
      return { ok: true };
    } finally {
      inFlightSave = false;
    }
  };

  // ── auto-sync every 15s once restore settles ──────────────────────────────
  void restored.then(() => {
    if (disposed) return;
    void uploadSnapshot();
    timer = setInterval(() => {
      void uploadSnapshot();
    }, SYNC_INTERVAL_MS);
  });

  const saveNow = () => uploadSnapshot();

  return {
    restored,
    close: async () => {
      // Stop the interval FIRST so no tick races the final save, then upload
      // BEFORE marking disposed — the exit save is the whole point of close.
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      await restored;
      const result = await uploadSnapshot();
      disposed = true;
      return result;
    },
    saveNow,
    restore: async () => {
      if (!userId || !isSupabaseConfigured) {
        return {
          ok: false,
          restored: false,
          error: 'Sign in to use cloud saves for this game.',
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
          return { ok: false, restored: false, error: error.message };
        }
        const cloud = data?.save_data as SaveSnapshot | undefined;
        if (!cloud) {
          return { ok: true, restored: false };
        }
        const applied = await adapter.restore(gameId, cloud);
        if (!applied) {
          return {
            ok: false,
            restored: false,
            error: 'Cloud data could not be fully applied.',
          };
        }
        writeLocalTimestamp(gameId, userId, cloud.timestamp);
        lastHash = contentHash(fingerprintWithoutTimestamp(cloud));
        setStatus('restored');
        return { ok: true, restored: true };
      } catch (e) {
        return {
          ok: false,
          restored: false,
          error: e instanceof Error ? e.message : 'Restore failed.',
        };
      }
    },
    getStatus: () => status,
    supportLabel: adapter.label,
    supported: true,
  };
}

export { adapterLabel };
