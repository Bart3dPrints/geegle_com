// Game player with ACTIVE cloud saves: awaits the real restore-before-launch
// promise (no timers), syncs every 15s, saves on exit, exposes manual save and
// restore, and offers an external open fallback when a site refuses framing.

import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { motion } from 'motion/react';
import {
  Star,
  ArrowLeft,
  Maximize2,
  Loader2,
  UploadCloud,
  DownloadCloud,
  FileDown,
  FileUp,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import type { GameEntry } from '../types';
import { attemptsAutomaticSave, saveSupportFor } from '../lib/saveManifest';
import {
  startCloudSync,
  type CloudSaveHandle,
  type SyncStatus,
} from '../lib/cloudSaves';

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
  const importInputRef = useRef<HTMLInputElement>(null);

  const url = entry ? entry.path : proxy?.url;
  const title = entry ? entry.title : proxy?.title;
  const gameId = entry?.id ?? null;
  const launchPath = entry?.path ?? '';
  const isExternal = Boolean(url && /^https?:\/\//.test(url));

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
      // Buttons and status only appear when this game really is captured by
      // the shim; the session can exist for any /games/* path.
      setSupported(sync.supported && (!entry || attemptsAutomaticSave(saveSupportFor(entry))));
      setIframePath(sync.launchPath);
      setSyncStatus(sync.getStatus());
      registerSaveHandle?.(sync);
      await sync.restored;
      if (cancelled) return;
      // Isolation failure is the one case where opening the game could show
      // another account's progress, so the frame stays closed.
      if (!sync.canLaunch()) {
        setManualMsg('This account’s game storage could not be isolated. Close other tabs of this game and reload.');
        return;
      }
      setRestoreReady(true);
    };

    if (userId && navigator.locks && entry && attemptsAutomaticSave(saveSupportFor(entry))) {
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

  const manualExport = async () => {
    const result = await saveHandleRef.current?.exportSave();
    if (!result) return;
    if (!result.ok || !result.json) {
      setManualMsg(result.error ?? 'Nothing to export yet.');
      return;
    }
    const blob = new Blob([result.json], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${gameId ?? 'game'}-save.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
    setManualMsg('Save file downloaded.');
  };

  const manualImport = async (file: File | undefined) => {
    if (!file) return;
    const handle = saveHandleRef.current;
    if (!handle) return;
    setBusy(true);
    try {
      const result = await handle.importSave(await file.text());
      setManualMsg(result.ok ? 'Save file imported and synced to the cloud.' : result.error ?? 'Import failed.');
      if (result.ok) {
        setLoaded(false);
        setLoadFailed(false);
      }
    } finally {
      setBusy(false);
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

  // Automatic saves stay silent. Only a failure you can act on is shown; a
  // routine successful sync is never announced.
  const restoreError = supported && syncStatus === 'conflict'
    ? 'Cloud progress differs. Choose Restore from Cloud or Keep This Device.'
    : supported && syncStatus === 'error' ? 'Cloud sync failed. Your device still has its saved progress.' : null;

  const clusterButton =
    'rounded-md border border-neutral-700 bg-neutral-900/95 p-2 text-neutral-200 shadow-sm transition-colors hover:bg-neutral-800';
  const isGame = entry?.kind === 'game';

  const backButton = (
    <button
      className={clusterButton}
      onClick={() => void exit()}
      disabled={busy}
      aria-label="Back to library"
      title="Back to library"
    >
      <ArrowLeft size={16} />
    </button>
  );

  const openButton = (
    <button
      className={clusterButton}
      onClick={openExternally}
      aria-label="Open in a new window"
      title="Open in a new window"
    >
      <ExternalLink size={16} />
    </button>
  );

  const fullscreenButton = (
    <button
      className={clusterButton}
      onClick={goFullscreen}
      aria-label="Fullscreen"
      title="Fullscreen"
    >
      <Maximize2 size={16} />
    </button>
  );

  const saveControls = supported ? (
    <>
      <button
        className={clusterButton}
        onClick={() => void manualSave()}
        aria-label="Save progress to cloud"
        title="Save to Cloud"
      >
        <UploadCloud size={16} />
      </button>
      <button
        className={clusterButton}
        onClick={() => void manualRestore()}
        disabled={busy}
        aria-label="Restore progress from cloud"
        title="Restore from Cloud"
      >
        <DownloadCloud size={16} />
      </button>
      <button
        className={clusterButton}
        onClick={() => void manualExport()}
        disabled={busy}
        aria-label="Export this save as a file"
        title="Export save file"
      >
        <FileDown size={16} />
      </button>
      <button
        className={clusterButton}
        onClick={() => importInputRef.current?.click()}
        disabled={busy}
        aria-label="Import a save file"
        title="Import save file"
      >
        <FileUp size={16} />
      </button>
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          void manualImport(file);
        }}
      />
      {syncStatus === 'conflict' && (
        <button className={clusterButton} disabled={busy} onClick={() => void keepLocal()} title="Keep this device's progress">
          Keep This Device
        </button>
      )}
    </>
  ) : null;

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-neutral-950"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
    >
      <div className="absolute inset-0">
        {restoreReady && !loaded && !loadFailed && !frameBlocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-950 text-neutral-400">
            <Loader2 className="animate-spin" size={28} />
            <span className="text-sm">Loading {title}…</span>
          </div>
        )}
        {frameBlocked && !loaded && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-neutral-950 p-6 text-center">
            <ExternalLink size={28} className="text-neutral-400" />
            <p className="max-w-md text-sm text-neutral-300">
              {title} may not allow embedding inside other sites. You can open
              it directly in a new window.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {openButton}
              <button className="btn-secondary" onClick={() => void exit()} disabled={busy}>
                Back to library
              </button>
            </div>
          </div>
        )}
        {loadFailed && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-neutral-950 p-6 text-center">
            <AlertTriangle size={28} className="text-neutral-300" />
            <p className="text-sm text-neutral-300">
              {title} failed to load. Try opening it in a new window.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {openButton}
              <button className="btn-secondary" onClick={() => void exit()} disabled={busy}>
                Back to library
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
            className="h-full w-full border-0"
            onLoad={() => setLoaded(true)}
            onError={() => setLoadFailed(true)}
            allow="autoplay; fullscreen; gamepad; pointer-lock"
          />
        )}
      </div>

      {isGame ? (
        <>
          <div className="absolute left-3 top-3 z-20 flex items-center gap-1.5">{backButton}</div>
          <div className="absolute right-3 top-3 z-20 flex max-w-[calc(100%-4.5rem)] flex-wrap items-center justify-end gap-1.5">
              {entry && (
              <button
                className={clusterButton}
                onClick={onToggleFavorite}
                aria-label="Toggle favorite"
                aria-pressed={isFavorite}
                title="Favorite"
              >
                <Star size={16} className={isFavorite ? 'fill-neutral-100 text-neutral-100' : ''} />
              </button>
            )}
            {saveControls}
            {openButton}
            {fullscreenButton}
          </div>
        </>
      ) : (
        <>
          <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5">{backButton}</div>
          <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5">
            {openButton}
            {fullscreenButton}
          </div>
        </>
      )}

      {(manualMsg || restoreError) && (
        <p className="absolute inset-x-3 bottom-3 z-10 mx-auto max-w-lg rounded-md bg-neutral-900/95 px-3 py-2 text-center text-xs text-neutral-200">
          {manualMsg ?? restoreError}
        </p>
      )}

    </motion.div>
  );
}
