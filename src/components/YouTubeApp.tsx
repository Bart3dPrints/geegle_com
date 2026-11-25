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
    <div className="fixed inset-0 z-50 bg-slate-950">
      <div className="flex h-14 items-center gap-2 border-b border-slate-800 bg-slate-900 px-4">
        <button
          className="btn-secondary border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
          onClick={onExit}
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <h2 className="text-sm font-medium text-slate-200">YouTube</h2>
        <div className="flex-1" />
        <form onSubmit={submit} className="flex items-center gap-2">
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              className="input w-56 bg-slate-900 py-1.5 pl-8 text-sm"
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
      </div>

      {error && (
        <div
          className="mx-auto mt-6 max-w-md rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center p-4">
        {videoId ? (
          <div className="h-full w-full max-w-5xl">
            <div className="relative mx-auto aspect-video h-full max-h-full">
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400">
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
          <div className="text-center text-slate-400">
            <p className="text-sm">Paste a YouTube video URL above to play it.</p>
            <p className="mt-1 text-xs text-slate-500">
              Videos play through YouTube's official privacy-enhanced embed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
