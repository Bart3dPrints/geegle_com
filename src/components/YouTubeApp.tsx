// YouTube app using the official privacy-enhanced embed
// (youtube-nocookie.com). Playback, URL parsing and the player itself all use
// YouTube's supported integration. Player chrome is minimal: Back and
// Fullscreen, plus a plain fallback link only when an embed is refused.

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Search, Play, Loader2, Maximize2 } from 'lucide-react';
import { normalizeExternalUrl } from '../lib/externalUrl';

const NOCODDIE = 'https://www.youtube-nocookie.com';

function videoIdFromInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Direct 11-character video id.
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  // Watch URLs: youtube.com/watch?v=…, youtu.be/<id>, /embed/<id>, /shorts/<id>.
  // The address is normalized once (exactly one https:// scheme), and only
  // YouTube hosts are accepted rather than being redirected elsewhere.
  const normalized = normalizeExternalUrl(trimmed);
  if (!normalized || normalized.startsWith('/')) return null;
  try {
    const u = new URL(normalized);
    const host = u.hostname.toLowerCase().replace(/^www\.|^m\./, '');
    if (!['youtube.com', 'youtu.be', 'youtube-nocookie.com', 'music.youtube.com'].includes(host)) {
      return null;
    }
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.split('/').filter(Boolean)[0] ?? '';
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }
    const v = u.searchParams.get('v');
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    const m = u.pathname.match(/\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
  } catch {
    return null;
  }
  return null;
}

export function YouTubeApp({ onExit }: { onExit: () => void }) {
  const [input, setInput] = useState('');
  const [videoId, setVideoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [embedFailed, setEmbedFailed] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  // A frame the provider refuses to embed never fires onError; report it after
  // a bounded wait instead of spinning forever.
  useEffect(() => {
    if (!videoId || !loading) return;
    const timer = window.setTimeout(() => {
      setEmbedFailed(true);
      setLoading(false);
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [videoId, loading]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const id = videoIdFromInput(input);
    if (!id) {
      setError('Enter a YouTube video link or an 11-character video id.');
      return;
    }
    setLoading(true);
    setEmbedFailed(false);
    setVideoId(id);
  };

  const button =
    'rounded-md border border-neutral-700 bg-neutral-900/95 p-2 text-neutral-200 shadow-sm transition-colors hover:bg-neutral-800';

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950">
      <div className="absolute inset-0 flex flex-col">
        <form
          onSubmit={submit}
          className="z-20 mx-auto flex w-full max-w-xl flex-wrap items-center justify-center gap-2 px-4 pb-2 pt-3"
        >
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              className="input w-56 border-neutral-700 bg-neutral-900 py-1.5 pl-8 text-sm text-neutral-100"
              placeholder="Paste a YouTube URL…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label="YouTube video URL"
            />
          </div>
          <button className="btn-primary py-1.5" type="submit">
            <Play size={14} /> Play
          </button>
        </form>

        {error && (
          <div className="z-20 mx-auto mb-2 max-w-md rounded-lg bg-neutral-900 px-4 py-2 text-sm text-red-300" role="alert">
            {error}
          </div>
        )}

        <div ref={stageRef} className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-16">
          {videoId ? (
            <div className="w-full max-w-5xl">
              <div className="relative mx-auto aspect-video w-full overflow-hidden rounded-lg bg-neutral-900">
                {loading && (
                  <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
                    <Loader2 className="animate-spin" size={28} />
                  </div>
                )}
                <iframe
                  key={videoId}
                  className="absolute inset-0 h-full w-full"
                  src={`${NOCODDIE}/embed/${videoId}?rel=0`}
                  title="YouTube video player"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  onLoad={() => {
                    setLoading(false);
                    setEmbedFailed(false);
                  }}
                />
              </div>
              {embedFailed && (
                <p className="mx-auto mt-3 max-w-xl text-center text-sm text-neutral-300" role="alert">
                  This video can't be played inside Geegle.{' '}
                  <a
                    className="underline underline-offset-2"
                    href={`https://www.youtube.com/watch?v=${videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open it on YouTube
                  </a>
                  .
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-neutral-400">Paste a YouTube video URL above to play it.</p>
          )}
        </div>
      </div>

      <div className="absolute bottom-3 left-3 z-20">
        <button className={button} onClick={onExit} aria-label="Back to Apps">
          <ArrowLeft size={16} />
        </button>
      </div>
      <div className="absolute right-3 top-3 z-20">
        <button
          className={button}
          onClick={() => stageRef.current?.requestFullscreen?.()}
          aria-label="Fullscreen"
        >
          <Maximize2 size={16} />
        </button>
      </div>
    </div>
  );
}
