// Fullscreen game/proxy player: header controls, loading state, iframe.

import { useEffect, useRef, useState } from 'react';
import { Star, ArrowLeft, RotateCcw, Maximize2, Loader2 } from 'lucide-react';
import type { GameEntry } from '../types';

export function GamePlayer({
  entry,
  proxy,
  onExit,
  onToggleFavorite,
  isFavorite,
}: {
  entry: GameEntry | null;
  proxy: { url: string; title: string } | null;
  onExit: () => void;
  onToggleFavorite: () => void;
  isFavorite: boolean;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const url = entry ? entry.url : proxy?.url;
  const title = entry ? entry.title : proxy?.title;

  useEffect(() => {
    setLoaded(false);
  }, [url]);

  const goFullscreen = () => {
    frameRef.current?.requestFullscreen?.();
  };

  const reload = () => {
    if (frameRef.current) frameRef.current.src = frameRef.current.src;
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
        <h2 className="truncate text-sm font-medium text-slate-200">{title}</h2>
        <div className="flex-1" />
        {entry && (
          <button
            className="btn-secondary border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
            onClick={onToggleFavorite}
            aria-label="Toggle favorite"
          >
            <Star
              size={16}
              className={isFavorite ? 'fill-amber-400 text-amber-400' : ''}
            />
          </button>
        )}
        <button
          className="btn-secondary border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
          onClick={reload}
          aria-label="Reload game"
        >
          <RotateCcw size={16} />
        </button>
        <button
          className="btn-secondary border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
          onClick={goFullscreen}
          aria-label="Fullscreen"
        >
          <Maximize2 size={16} />
        </button>
      </div>

      <div className="relative h-[calc(100vh-3.5rem)] w-full">
        {!loaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 text-slate-400">
            <Loader2 className="animate-spin" size={28} />
            <span className="text-sm">Loading {title}...</span>
          </div>
        )}
        {url && (
          <iframe
            ref={frameRef}
            src={url}
            title={title ?? 'Game'}
            className="h-full w-full"
            onLoad={() => setLoaded(true)}
            allow="autoplay; fullscreen; gamepad; pointer-lock"
          />
        )}
      </div>
    </div>
  );
}
