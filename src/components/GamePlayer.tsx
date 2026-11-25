// Game player with ACTIVE cloud saves: awaits the real restore-before-launch
// promise (no timers), syncs every 15s, saves on exit, exposes manual save and
// restore, and offers an external open fallback when a site refuses framing.

import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  Star,
  ArrowLeft,
  RotateCcw,
  Maximize2,
  Loader2,
  UploadCloud,
  DownloadCloud,
  AlertTriangle,
  Check,
  WifiOff,
  Ban,
  ExternalLink,
} from 'lucide-react';
import type { GameEntry } from '../types';
import { saveSupportFor } from '../lib/saveManifest';
import {
  startCloudSync,
  type CloudSaveHandle,
  type SyncStatus,
} from '../lib/cloudSaves';

function StatusPill({ status }: { status: SyncStatus }) {
  switch (status) {
    case 'restoring':
      return (
        <span className="flex items-center gap-1 text-xs text-slate-400">
          <Loader2 size={12} className="animate-spin" /> Restoring…
        </span>
      );
    case 'saving':
      return (
        <span className="flex items-center gap-1 text-xs text-slate-400">
          <Loader2 size={12} className="animate-spin" /> Saving…
        </span>
      );
    case 'saved':
    case 'restored':
      return (
        <span className="flex items-center gap-1 text-xs text-emerald-400">
          <Check size={12} /> Saved to Cloud
        </span>
      );
    case 'offline':
      return (
        <span className="flex items-center gap-1 text-xs text-amber-400">
          <WifiOff size={12} /> Offline
        </span>
      );
    case 'error':
      return (
        <span className="flex items-center gap-1 text-xs text-red-400">
          <AlertTriangle size={12} /> Sync Failed
        </span>
      );
    case 'conflict':
      return <span className="text-xs text-amber-400">Cloud save conflict</span>;
    case 'unsupported':
      return (
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <Ban size={12} /> Cloud Saves Unsupported
        </span>
      );
    default:
      return null;
  }
}

export function GamePlayer({
  entry,
  proxy,
  userId,
  onExit,
  onToggleFavorite,
  isFavorite,
  registerSaveHandle,
}: {
  entry: GameEntry | null;
  proxy: { url: string; title: string } | null;
  userId: string | null;
  onExit: () => void;
  onToggleFavorite: () => void;
  isFavorite: boolean;
  /** Lets the app await the final save before logout (no timing guesses). */
  registerSaveHandle?: (handle: CloudSaveHandle | null) => void;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [frameBlocked, setFrameBlocked] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [manualMsg, setManualMsg] = useState<string | null>(null);
  const saveHandleRef = useRef<CloudSaveHandle | null>(null);

  const url = entry ? entry.path : proxy?.url;
  const title = entry ? entry.title : proxy?.title;
  const gameId = entry?.id ?? null;
  const launchPath = entry?.path ?? '';
  const isExternal = Boolean(url && /^https?:\/\//.test(url));
  const canOpenExternally = isExternal;

  // The iframe mounts only when restoreReady is true — restore-before-launch
  // is awaited for real (no arbitrary delay).
  const [restoreReady, setRestoreReady] = useState(!gameId);
  const [iframePath, setIframePath] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;
    let release: (() => void) | undefined;
    const lockController = new AbortController();
    let handle: CloudSaveHandle | undefined;

    setRestoreReady(false);
    setManualMsg(null);
    setSyncStatus('idle');
    setFrameBlocked(false);

    const open = async () => {
      if (cancelled) return;
      setManualMsg(null);
      const sync = startCloudSync(gameId, launchPath, userId, (status) => {
        if (!cancelled) setSyncStatus(status);
      });
      handle = sync;
      saveHandleRef.current = sync;
      setSupported(sync.supported);
      setIframePath(sync.launchPath);
      setSyncStatus(sync.getStatus());
      registerSaveHandle?.(sync);
      await sync.restored;
      if (!cancelled) setRestoreReady(true);
    };

    if (userId && navigator.locks && entry && saveSupportFor(entry) === 'automatic') {
      void navigator.locks.request(
        `geegle-game:${gameId}:${userId}`,
        { signal: lockController.signal },
        async () => {
          if (cancelled) return;
          const owned = new Promise<void>((resolve) => { release = resolve; });
          await open();
          await owned;
        },
      ).catch(() => {
        if (!cancelled) setManualMsg('Could not open this account’s game storage.');
      });
      setManualMsg('Opening save storage… Close this game in other tabs if needed.');
    } else {
      void open();
    }

    return () => {
      cancelled = true;
      lockController.abort();
      void (handle?.dispose() ?? Promise.resolve()).finally(() => release?.());
      saveHandleRef.current = null;
      registerSaveHandle?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, launchPath, userId]);

  const goFullscreen = () => {
    frameRef.current?.requestFullscreen?.();
  };

  const openExternally = () => {
    if (url) window.open(url, '_blank', 'noopener');
  };

  // External sites that send X-Frame-Options/CSP frame-ancestors load the
  // iframe's about:blank error path; onLoad never fires. Detect it and offer
  // the external-open fallback instead of an indefinite spinner.
  useEffect(() => {
    if (!isExternal || loaded || loadFailed) return;
    const timer = setTimeout(() => {
      setFrameBlocked(true);
    }, 8000);
    return () => clearTimeout(timer);
  }, [isExternal, loaded, loadFailed]);

  const reload = () => {
    setLoadFailed(false);
    setFrameBlocked(false);
    setLoaded(false);
    const path = gameId ? iframePath : url;
    if (frameRef.current && path) frameRef.current.src = path;
  };

  const manualSave = async () => {
    setManualMsg(null);
    const result = await saveHandleRef.current?.saveNow();
    if (!result) return;
    if (result.ok) {
      const s = saveHandleRef.current?.getStatus();
      if (s === 'saved' || s === 'restored')
        setManualMsg('Progress saved to cloud.');
      else if (s === 'idle')
        setManualMsg('No changes to save — already in sync.');
    } else {
      setManualMsg(result.error ?? 'Save failed.');
    }
  };

  const manualRestore = async () => {
    const handle = saveHandleRef.current;
    if (busy || !handle || !window.confirm('Load cloud progress? If it differs, this device’s current save will be kept as a local backup.')) return;
    flushSync(() => {
      setBusy(true);
      setRestoreReady(false);
      setManualMsg(null);
    });
    try {
      const result = await handle.restore();
      setManualMsg(result.restored ? 'Cloud save restored.' : result.error ?? 'No cloud save found for this game yet.');
      setLoaded(false);
      setLoadFailed(false);
    } finally {
      setBusy(false);
      setRestoreReady(true);
    }
  };

  const keepLocal = async () => {
    if (busy || !window.confirm('Replace the conflicting cloud version with this device’s progress?')) return;
    setBusy(true);
    try {
      const result = await saveHandleRef.current?.keepLocal();
      if (result) setManualMsg(result.ok ? 'This device’s progress is saved to the cloud.' : result.error ?? 'Save failed.');
    } finally {
      setBusy(false);
    }
  };

  const exit = async () => {
    if (busy) return;
    const handle = saveHandleRef.current;
    setBusy(true);
    try {
      const result = await handle?.close();
      if (!result || result.ok || window.confirm(`${result.error} Leave the game with progress kept on this device?`)) onExit();
      else setManualMsg(result.error ?? null);
    } finally {
      setBusy(false);
    }
  };

  const restoreError = supported && syncStatus === 'conflict'
    ? 'Cloud progress differs. Choose Restore from Cloud or Keep This Device.'
    : supported && syncStatus === 'error' ? 'Cloud sync failed. Your device still has its saved progress.' : null;

  const btn =
    'btn-secondary border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950">
      <div className="flex h-14 items-center gap-2 border-b border-slate-800 bg-slate-900 px-4">
        <button className={btn} onClick={() => void exit()} disabled={busy}>
          <ArrowLeft size={16} />
          Back
        </button>
        <h2 className="truncate text-sm font-medium text-slate-200">{title}</h2>

        <div className="hidden md:block">
          <StatusPill status={syncStatus} />
        </div>

        <div className="flex-1" />

        {/* External open fallback: for cross-origin sites that may refuse to
            be framed. Never sends Geegle credentials — plain navigation. */}
        {canOpenExternally && (
          <button
            className={btn}
            onClick={openExternally}
            aria-label="Open in a new tab"
            title="Open in a new tab"
          >
            <ExternalLink size={16} />
          </button>
        )}

        {supported && (
          <>
            <button
              className={btn}
              onClick={manualSave}
              disabled={busy}
              aria-label="Save progress to cloud"
              title="Save to Cloud"
            >
              <UploadCloud size={16} />
            </button>
            <button
              className={btn}
              onClick={manualRestore}
              disabled={busy}
              aria-label="Restore progress from cloud"
              title="Restore from Cloud"
            >
              <DownloadCloud size={16} />
            </button>
            {syncStatus === 'conflict' && <button className={btn} disabled={busy} onClick={() => void keepLocal()}>Keep This Device</button>}
          </>
        )}

        {entry && (
          <button
            className={btn}
            onClick={onToggleFavorite}
            aria-label="Toggle favorite"
          >
            <Star
              size={16}
              className={isFavorite ? 'fill-amber-400 text-amber-400' : ''}
            />
          </button>
        )}
        <button className={btn} onClick={reload} aria-label="Reload game">
          <RotateCcw size={16} />
        </button>
        <button className={btn} onClick={goFullscreen} aria-label="Fullscreen">
          <Maximize2 size={16} />
        </button>
      </div>

      {(manualMsg || restoreError) && (
        <div
          className="border-b border-slate-800 bg-slate-900 px-4 py-2 text-center text-xs text-slate-300"
          role="status"
        >
          {manualMsg ?? restoreError}
        </div>
      )}

      <div className="flex items-center justify-center bg-slate-900 py-1 md:hidden">
        <StatusPill status={syncStatus} />
      </div>

      <div className="relative h-[calc(100vh-3.5rem)] w-full">
        {restoreReady && !loaded && !loadFailed && !frameBlocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 text-slate-400">
            <Loader2 className="animate-spin" size={28} />
            <span className="text-sm">Loading {title}…</span>
          </div>
        )}
        {frameBlocked && !loaded && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-950 p-6 text-center">
            <ExternalLink size={28} className="text-blue-400" />
            <p className="max-w-md text-sm text-slate-300">
              {title} may not allow embedding inside other sites. You can
              retry, or open it directly in a new tab.
            </p>
            <div className="flex gap-2">
              <button className={btn} onClick={reload}>
                <RotateCcw size={14} /> Retry
              </button>
              {canOpenExternally && (
                <button className="btn-primary" onClick={openExternally}>
                  <ExternalLink size={14} /> Open in a new tab
                </button>
              )}
              <button className={btn} onClick={() => void exit()} disabled={busy}>
                Back to Games
              </button>
            </div>
          </div>
        )}
        {loadFailed && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-950 p-6 text-center">
            <AlertTriangle size={28} className="text-amber-400" />
            <p className="text-sm text-slate-300">
              {title} failed to load. The game's server may be temporarily
              unavailable.
            </p>
            <div className="flex gap-2">
              <button className={btn} onClick={reload}>
                <RotateCcw size={14} /> Retry
              </button>
              <button className={btn} onClick={() => void exit()} disabled={busy}>
                Back to Games
              </button>
            </div>
          </div>
        )}
        {restoreReady && (gameId ? iframePath : url) && !frameBlocked && (
          <iframe
            ref={frameRef}
            src={(gameId ? iframePath : url) ?? undefined}
            referrerPolicy="no-referrer"
            title={title ?? 'Game'}
            className="h-full w-full"
            onLoad={() => setLoaded(true)}
            onError={() => setLoadFailed(true)}
            allow="autoplay; fullscreen; gamepad; pointer-lock"
          />
        )}
      </div>
    </div>
  );
}
