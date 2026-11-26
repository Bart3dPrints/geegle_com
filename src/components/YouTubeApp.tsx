// Dedicated YouTube app using the official privacy-enhanced embed
// (youtube-nocookie.com) — playback, URL input, and search links all use
// YouTube's supported integration methods. This is an official embed, not a
// mirror of YouTube.

import { useState } from 'react';
import { ArrowLeft, Search, Play, Loader2 } from 'lucide-react';

const NOCODDIE = 'https://www.youtube-nocookie.com';

function videoIdFromInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Direct 11-character video id.
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  // Watch URLs: youtube.com/watch?v=…, youtu.be/<id>, /embed/<id>, /shorts/<id>.
  try {
    const u = new URL(
      trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
    );
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.split('/').filter(Boolean)[0] ?? '';
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }
    const v = u.searchParams.get('v');
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    const m = u.pathname.match(
      /\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]{11})/
    );
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const id = videoIdFromInput(input);
    if (!id) {
      setError(
        'Enter a valid YouTube video URL (youtube.com/watch?v=…, youtu.be/…) or an 11-character video id.'
      );
      return;
    }
    setLoading(true);
    setVideoId(id);
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950">
      <form
        onSubmit={submit}
        className="absolute inset-x-0 top-0 z-20 mx-auto flex w-full max-w-xl flex-wrap items-center justify-center gap-2 p-3"
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
          <Play size={14} />
          Play
        </button>
      </form>

      {error && (
        <div
          className="absolute inset-x-0 top-20 z-20 mx-auto max-w-md rounded-lg bg-neutral-900 p-4 text-sm text-red-300"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="absolute inset-0 flex items-center justify-center p-4 pt-20">
        {videoId ? (
          <div className="h-full w-full max-w-5xl">
            <div className="relative mx-auto aspect-video h-full max-h-full">
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
                  <Loader2 className="animate-spin" size={28} />
                </div>
              )}
              <iframe
                key={videoId}
                className="absolute inset-0 h-full w-full rounded-lg"
                src={`${NOCODDIE}/embed/${videoId}?rel=0`}
                title="YouTube video player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                onLoad={() => setLoading(false)}
              />
            </div>
          </div>
        ) : (
          <div className="text-center text-neutral-400">
            <p className="text-sm">Paste a YouTube video URL above to play it.</p>
            <p className="mt-1 text-xs text-neutral-500">
              Videos play through YouTube's official privacy-enhanced embed.
            </p>
          </div>
        )}
      </div>

      <div className="absolute bottom-3 left-3 z-20">
        <button
          className="rounded-md border border-neutral-700 bg-neutral-900/95 p-2 text-neutral-200 shadow-sm transition-colors hover:bg-neutral-800"
          onClick={onExit}
          aria-label="Back to Apps"
        >
          <ArrowLeft size={16} />
        </button>
      </div>
    </div>
  );
}
