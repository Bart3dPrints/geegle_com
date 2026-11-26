// Everythingle app with server selection. The user clicks the Everythingle
// card and lands inside the Geegle player — no manual URL entry. Compatible
// servers are ONLY those whose destination interface was verified by direct
// inspection (Cherry: hash-forwarding wrapper + URL-parsing loader). Direct
// framing is the default; external open is the failure fallback.
//
// Preferences persist via the existing server-defaults mechanism (local +
// account-synced), so they survive logout, storage clearing, and re-sign-in.

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, RotateCcw, Maximize2, Loader2, AlertTriangle, ExternalLink } from 'lucide-react';
import { cherryDestinationUrl } from '../data/external';
import { saveServerDefault, loadServerDefaults } from '../lib/userData';

const DESTINATION = 'https://everythingle.com/';

// Evidence-based compatible servers. Cherry mirrors were fetched directly;
// the wrapper forwards location.hash to a URL-parsing loader.
const CHERRY_MIRRORS = [
  { label: 'Cherry 1', url: 'https://chrivtx.s3.amazonaws.com/math.html' },
  { label: 'Cherry 2', url: 'https://s3.amazonaws.com/chrivtx/math.html' },
  { label: 'Cherry 3', url: 'https://chrivtx.s3.dualstack.us-east-1.amazonaws.com/math.html' },
  { label: 'Cherry 4', url: 'https://s3.us-east-1.amazonaws.com/chrivtx/math.html' },
  { label: 'Cherry 5', url: 'https://s3.dualstack.us-east-1.amazonaws.com/chrivtx/math.html' },
];

type Mode = 'direct' | 'cherry';

const SERVICE_ID = 'everythingle';

export function EverythingleApp({
  userId,
  onExit,
}: {
  userId: string | null;
  onExit: () => void;
}) {
  const [mode, setMode] = useState<Mode>('direct');
  const [serverIndex, setServerIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frameKey, setFrameKey] = useState(0);

  // Load persisted preferences (local + account). Server preferences live in
  // the same settings JSON the proxy cards use, so they sync cross-device.
  useEffect(() => {
    void loadServerDefaults(userId).then((res) => {
      if (!res.ok || !res.data) return;
      const pref = res.data[SERVICE_ID];
      if (typeof pref === 'number') {
        // 0 = direct; 1..N = cherry mirror (pref - 1).
        if (pref === 0) setMode('direct');
        else if (pref >= 1 && pref <= CHERRY_MIRRORS.length) {
          setMode('cherry');
          setServerIndex(pref - 1);
        }
      }
    });
  }, [userId]);

  const persist = async (nextMode: Mode, nextIndex: number) => {
    const encoded = nextMode === 'direct' ? 0 : nextIndex + 1;
    const res = await saveServerDefault(SERVICE_ID, encoded, userId);
    if (!res.ok && res.error) setError(`Preference not synced: ${res.error}`);
    else setError(null);
  };

  const chooseMode = (nextMode: Mode) => {
    setMode(nextMode);
    resetFrame();
    void persist(nextMode, nextMode === 'cherry' ? serverIndex : 0);
  };

  const chooseServer = (index: number) => {
    setServerIndex(index);
    resetFrame();
    void persist('cherry', index);
  };

  const src = useMemo(() => {
    if (mode === 'direct') return DESTINATION;
    return cherryDestinationUrl(CHERRY_MIRRORS[serverIndex].url, DESTINATION);
  }, [mode, serverIndex]);

  const resetFrame = () => {
    setLoaded(false);
    setBlocked(false);
    setFrameKey((k) => k + 1);
  };

  const openExternally = () => {
    window.open(DESTINATION, '_blank', 'noopener');
  };

  // Frame-refusal detection: X-Frame-Options/CSP block the load event.
  useEffect(() => {
    if (loaded || blocked) return;
    const timer = setTimeout(() => setBlocked(true), 9000);
    return () => clearTimeout(timer);
  }, [frameKey, loaded, blocked]);

  const btn =
    'btn-secondary border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800';

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950">
      <div className="absolute bottom-3 left-3 z-20">
        <button className={btn} onClick={onExit} aria-label="Back to Apps">
          <ArrowLeft size={16} />
        </button>
      </div>

      <div className="absolute right-3 top-3 z-20 flex flex-wrap items-center justify-end gap-1.5">
        {mode === 'cherry' && (
          <select
            className="input max-w-32 border-neutral-700 bg-neutral-900/95 py-1.5 text-xs text-neutral-100"
            value={serverIndex}
            onChange={(e) => chooseServer(Number(e.target.value))}
            aria-label="Everythingle server"
          >
            {CHERRY_MIRRORS.map((m, i) => (
              <option key={m.url} value={i}>
                {m.label}
              </option>
            ))}
          </select>
        )}
        <select
          className="input max-w-32 border-neutral-700 bg-neutral-900/95 py-1.5 text-xs text-neutral-100"
          value={mode}
          onChange={(e) => chooseMode(e.target.value as Mode)}
          aria-label="Connection method"
        >
          <option value="direct">Direct</option>
          <option value="cherry">Cherry proxy</option>
        </select>
        <button className={btn} onClick={openExternally} aria-label="Open in a new window">
          <ExternalLink size={16} />
        </button>
        <button
          className={btn}
          onClick={() => document.getElementById('everythingle-frame')?.requestFullscreen?.()}
          aria-label="Fullscreen"
        >
          <Maximize2 size={16} />
        </button>
      </div>

      {error && (
        <div className="absolute inset-x-0 top-16 z-10 mx-auto w-fit rounded-md bg-neutral-900/95 px-3 py-2 text-center text-xs text-neutral-300" role="status">
          {error}
        </div>
      )}

      <div className="absolute inset-0">
        {!loaded && !blocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-950 text-neutral-400">
            <Loader2 className="animate-spin" size={28} />
            <span className="text-sm">Opening Everythingle…</span>
          </div>
        )}
        {blocked && !loaded && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-neutral-950 p-6 text-center">
            <AlertTriangle size={28} className="text-neutral-300" />
            <p className="max-w-md text-sm text-neutral-300">
              {mode === 'direct'
                ? 'Everythingle could not be framed directly. Try the Cherry proxy connection, or open it in a new tab.'
                : 'The Cherry proxy server did not respond. Try another server or open Everythingle directly.'}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button className={btn} onClick={resetFrame}>
                <RotateCcw size={14} /> Retry
              </button>
              {mode === 'direct' && (
                <button className="btn-primary" onClick={() => chooseMode('cherry')}>
                  Use Cherry proxy
                </button>
              )}
              <button className={btn} onClick={openExternally}>
                <ExternalLink size={14} /> Open in a new tab
              </button>
              <button className={btn} onClick={onExit}>
                Back to Apps
              </button>
            </div>
          </div>
        )}
        <iframe
          id="everythingle-frame"
          key={frameKey}
          src={src}
          title="Everythingle"
          className="h-full w-full"
          onLoad={() => setLoaded(true)}
          allow="fullscreen"
        />
      </div>
    </div>
  );
}
