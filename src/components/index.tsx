// Reusable UI components: game card, search overlay, game player, proxy card.

import { useEffect, useRef, useState } from 'react';
import {
  Search, X, Star, ArrowLeft, RotateCcw, Maximize2, Loader2, Globe,
} from 'lucide-react';
import type { GameEntry } from './types';
import type { ProxyService } from './data/proxies';
import { CATEGORIES } from './data/catalog';
import { searchCatalog, noResultsSuggestions } from './lib/search';

// ── GameCard ───────────────────────────────────────────────────────────────

const PALETTE = [
  'bg-slate-600', 'bg-blue-600', 'bg-emerald-600', 'bg-amber-600',
  'bg-violet-600', 'bg-rose-600', 'bg-cyan-600', 'bg-orange-600',
];

function tileColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function GameCard({
  game, onLaunch, isFavorite, onToggleFavorite,
}: {
  game: GameEntry;
  onLaunch: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}) {
  const initial = game.title.charAt(0).toUpperCase();
  return (
    <div className="card group relative overflow-hidden">
      <button
        className="block w-full text-left"
        onClick={onLaunch}
        aria-label={`Play ${game.title}`}
      >
        <div className="flex aspect-video items-center justify-center bg-slate-200 dark:bg-slate-800">
          {game.thumb ? (
            <img src={game.thumb} alt={game.title} loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <span className={`flex h-full w-full items-center justify-center text-2xl font-bold text-white ${tileColor(game.id)}`}>
              {initial}
            </span>
          )}
        </div>
        <div className="p-3">
          <p className="truncate text-sm font-medium">{game.title}</p>
        </div>
      </button>
      {onToggleFavorite && (
        <button
          className="absolute right-2 top-2 rounded-md bg-white/80 p-1.5 opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100 dark:bg-slate-900/80"
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          aria-label={isFavorite ? `Remove ${game.title} from favorites` : `Add ${game.title} to favorites`}
        >
          <Star size={16} className={isFavorite ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'} />
        </button>
      )}
    </div>
  );
}

// ── EmptyState ─────────────────────────────────────────────────────────────

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="card flex flex-col items-center justify-center p-12 text-center">
      <h3 className="mb-1 text-base font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{body}</p>
    </div>
  );
}

// ── SearchOverlay ──────────────────────────────────────────────────────────

export function SearchOverlay({
  onClose, onLaunch,
}: {
  onClose: () => void;
  onLaunch: (game: GameEntry) => void;
}) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const results = searchCatalog(query);
  const suggestions = query ? [] : noResultsSuggestions();

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setActiveIndex(0); }, [query]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const items = results.length > 0 ? results.map((r) => r.entry) : suggestions;

  const handleKeydown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const target = items[activeIndex];
      if (target) { onLaunch(target); onClose(); }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/70 p-4 pt-24 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Search games">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <Search size={18} className="shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            className="w-full bg-transparent text-base outline-none placeholder:text-slate-400"
            placeholder="Search games, categories, keywords..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeydown}
            aria-label="Search query"
          />
          <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" onClick={onClose} aria-label="Close search">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          {CATEGORIES.filter((c) => c.key !== 'all').slice(0, 10).map((c) => (
            <button key={c.key} className="chip" onClick={() => setQuery(c.label)}>
              {c.label}
            </button>
          ))}
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {query && results.length === 0 && (
            <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
              No results for "{query}". Try a category name, or check the spelling.
            </div>
          )}
          {!query && (
            <p className="px-2 py-1 text-xs uppercase tracking-wide text-slate-400">Suggested</p>
          )}
          {items.map((g, i) => (
            <button
              key={g.id}
              className={`flex w-full items-center gap-3 rounded-lg p-2 text-left ${
                i === activeIndex ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => { onLaunch(g); onClose(); }}
            >
              <span className={`flex h-10 w-16 shrink-0 items-center justify-center rounded-md text-sm font-bold text-white ${tileColor(g.id)}`}>
                {g.title.charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{g.title}</span>
                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                  {g.categories.filter((c) => c !== 'all').join(', ') || 'App'}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── GamePlayer ─────────────────────────────────────────────────────────────

export function GamePlayer({
  entry, proxy, onExit, onToggleFavorite, isFavorite,
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

  useEffect(() => { setLoaded(false); }, [url]);

  const goFullscreen = () => {
    frameRef.current?.requestFullscreen?.();
  };

  const reload = () => {
    if (frameRef.current) frameRef.current.src = frameRef.current.src;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950">
      <div className="flex h-14 items-center gap-2 border-b border-slate-800 bg-slate-900 px-4">
        <button className="btn-secondary border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800" onClick={onExit}>
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
            <Star size={16} className={isFavorite ? 'fill-amber-400 text-amber-400' : ''} />
          </button>
        )}
        <button className="btn-secondary border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800" onClick={reload} aria-label="Reload game">
          <RotateCcw size={16} />
        </button>
        <button className="btn-secondary border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800" onClick={goFullscreen} aria-label="Fullscreen">
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

// ── ProxyCard ──────────────────────────────────────────────────────────────

export function ProxyCard({
  service, selected, onSelect, onLaunch,
}: {
  service: ProxyService;
  selected: number;
  onSelect: (index: number) => void;
  onLaunch: (index: number) => void;
}) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Globe size={16} className="text-slate-400" />
        <h3 className="text-sm font-semibold">{service.name}</h3>
        {service.endpoints[selected] && !service.endpoints[selected].verified && (
          <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Unverified</span>
        )}
      </div>
      <p className="mb-4 text-sm text-s-slate-500 dark:text-slate-400">{service.description}</p>
      <div className="flex gap-2">
        <select
          className="input flex-1"
          value={selected}
          onChange={(e) => onSelect(Number(e.target.value))}
          aria-label={`Server for ${service.name}`}
        >
          {service.endpoints.map((ep, i) => (
            <option key={ep.url} value={i}>
              {ep.label}{ep.verified ? '' : ' (unverified)'}
            </option>
          ))}
        </select>
        <button className="btn-primary" onClick={() => onLaunch(selected)}>
          Open
        </button>
      </div>
    </div>
  );
}
