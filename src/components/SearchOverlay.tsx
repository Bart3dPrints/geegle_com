// Focused search overlay: blurred backdrop, category chips under the input,
// live fuzzy results with thumbnails, full keyboard navigation.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { GameEntry } from '../types';
import { CATEGORIES } from '../data/types';
import { buildSearchIndex, searchIndex } from '../lib/search';
import { TileThumb } from './TileThumb';

export function SearchOverlay({
  entries,
  onClose,
  onLaunch,
}: {
  entries: GameEntry[];
  onClose: () => void;
  onLaunch: (game: GameEntry) => void;
}) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const index = useMemo(() => buildSearchIndex(entries), [entries]);
  const results = useMemo(
    () => (query.trim() ? searchIndex(index, query) : []),
    [index, query]
  );
  const suggestions = useMemo(() => entries.slice(0, 6), [entries]);
  const items = results.length > 0 ? results.map((r) => r.entry) : suggestions;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleKeydown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const target = items[activeIndex];
      if (target) {
        onLaunch(target);
        onClose();
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/70 p-4 pt-24 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Search games"
      >
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
          {query && (
            <button
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
          <button
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            onClick={onClose}
            aria-label="Close search"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          {CATEGORIES.slice(0, 10).map((c) => (
            <button
              key={c.key}
              className="chip"
              onClick={() => setQuery(c.label.toLowerCase())}
            >
              {c.label}
n            </button>
          ))}
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {query && results.length === 0 && (
            <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
              No results for &quot;{query}&quot;. Try a category name, or check
              the spelling.
            </div>
          )}
          {!query && (
            <p className="px-2 py-1 text-xs uppercase tracking-wide text-slate-400">
              Suggested
            </p>
          )}
          {items.map((g, i) => (
            <button
              key={g.id}
              className={`flex w-full items-center gap-3 rounded-lg p-2 text-left ${
                i === activeIndex
                  ? 'bg-slate-100 dark:bg-slate-800'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => {
                onLaunch(g);
                onClose();
              }}
            >
              <TileThumb
                game={g}
                className="h-10 w-16 shrink-0 rounded-md text-sm font-bold"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{g.title}</span>
                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                  {g.categories.join(', ') || 'App'}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
