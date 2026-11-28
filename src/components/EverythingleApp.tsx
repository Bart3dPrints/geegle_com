// Everythingle: the complete collection, playable inside Geegle.
//
// The provider's terms forbid copying or redistributing its games, so Geegle
// never proxies or mirrors them: each game either runs as Geegle's own original
// implementation (marked "Geegle"), or loads the provider's official game page
// directly from everythingle.com in the player. Selecting a game goes straight
// to its playable interface — there is no launcher or proxy-choice screen.

import { useMemo, useState } from 'react';
import { ArrowLeft, Maximize2, Search, X } from 'lucide-react';
import {
  EVERYTHINGLE_CATEGORIES,
  EVERYTHINGLE_GAMES,
  LOCAL_GAME_TITLES,
  everythingleUrl,
  type EverythingleCategory,
  type EverythingleGame,
} from '../data/everythingle';
import { WordBoards, type BoardVariant } from './everythingle/WordBoards';
import { MiddleWord } from './everythingle/MiddleWord';

type Filter = 'all' | EverythingleCategory;

const LOCAL_BOARDS: Record<string, BoardVariant> = {
  'five-letter': 'single',
  dordle: 'dordle',
  quordle: 'quordle',
  word500: 'word500',
};

export function EverythingleApp({
  onExit,
}: {
  userId: string | null;
  onExit: () => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [localGame, setLocalGame] = useState<EverythingleGame | null>(null);
  const [official, setOfficial] = useState<EverythingleGame | null>(null);

  const games = useMemo(() => {
    const text = query.trim().toLowerCase();
    return EVERYTHINGLE_GAMES.filter(
      (game) =>
        (filter === 'all' || game.category === filter) &&
        (!text || `${game.title} ${game.blurb} ${game.category}`.toLowerCase().includes(text))
    );
  }, [filter, query]);

  if (localGame) {
    const boardVariant = localGame.local ? LOCAL_BOARDS[localGame.local] : undefined;
    if (boardVariant) {
      return (
        <WordBoards
          variant={boardVariant}
          title={LOCAL_GAME_TITLES[localGame.local!]}
          onExit={() => setLocalGame(null)}
        />
      );
    }
    return <MiddleWord onExit={() => setLocalGame(null)} />;
  }

  if (official) {
    return (
      <div className="fixed inset-0 z-[60] bg-neutral-50 dark:bg-neutral-950">
        <iframe
          key={official.slug}
          title={`${official.title} on everythingle.com`}
          src={everythingleUrl(official.slug)}
          className="h-full w-full border-0"
          allow="fullscreen; autoplay"
          referrerPolicy="strict-origin-when-cross-origin"
        />
        <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex items-center gap-2">
          <button
            type="button"
            className="pointer-events-auto rounded-md border border-neutral-300 bg-white/95 p-2 text-neutral-700 shadow-sm hover:bg-white dark:border-neutral-700 dark:bg-neutral-800/95 dark:text-neutral-200"
            onClick={() => setOfficial(null)}
            aria-label="Back to Everythingle"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="pointer-events-auto rounded-md bg-white/95 px-2 py-1 text-xs text-neutral-500 shadow-sm dark:bg-neutral-800/95 dark:text-neutral-400">
            {official.title} · everythingle.com
          </span>
        </div>
        <div className="absolute right-3 top-3 z-20">
          <button
            type="button"
            className="rounded-md border border-neutral-300 bg-white/95 p-2 text-neutral-700 shadow-sm hover:bg-white dark:border-neutral-700 dark:bg-neutral-800/95 dark:text-neutral-200"
            onClick={() => document.documentElement.requestFullscreen?.()}
            aria-label="Fullscreen"
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>
    );
  }

  const open = (game: EverythingleGame) => {
    if (game.local) setLocalGame(game);
    else setOfficial(game);
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Everythingle</h2>
            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              {EVERYTHINGLE_GAMES.length} games
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-900">
              <Search size={15} className="text-neutral-400" aria-hidden="true" />
              <input
                className="w-40 bg-transparent text-sm outline-none sm:w-56"
                placeholder="Search games"
                aria-label="Search Everythingle games"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && (
                <button type="button" aria-label="Clear search" onClick={() => setQuery('')}>
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              type="button"
              className="rounded-md border border-neutral-300 bg-white p-2 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
              onClick={onExit}
              aria-label="Back to Apps"
            >
              <ArrowLeft size={16} />
            </button>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-1.5" role="group" aria-label="Categories">
          {(['all', ...EVERYTHINGLE_CATEGORIES] as Filter[]).map((entry) => (
            <button
              key={entry}
              type="button"
              aria-pressed={filter === entry}
              onClick={() => setFilter(entry)}
              className={`rounded-full border px-3 py-1 text-xs ${
                filter === entry
                  ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
                  : 'border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
              }`}
            >
              {entry === 'all' ? 'All' : entry}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <button
              key={game.slug}
              type="button"
              data-everythingle-game={game.slug}
              onClick={() => open(game)}
              className="card flex h-full flex-col items-start gap-1 p-4 text-left transition-transform duration-200 hover:-translate-y-0.5"
            >
              <span className="flex w-full items-start justify-between gap-2">
                <span className="text-sm font-medium">{game.title}</span>
                <span
                  data-source={game.local ? 'geegle' : 'everythingle'}
                  className="shrink-0 rounded-full border border-neutral-300 px-2 py-0.5 text-[11px] text-neutral-500 dark:border-neutral-600 dark:text-neutral-400"
                >
                  {game.local ? 'Geegle' : 'everythingle.com'}
                </span>
              </span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">{game.blurb}</span>
            </button>
          ))}
        </div>

        {!games.length && (
          <p className="mt-6 text-sm text-neutral-500 dark:text-neutral-400">No games match that search.</p>
        )}

        <p className="mt-6 text-xs text-neutral-500 dark:text-neutral-400">
          Games marked Geegle run inside Geegle. The others load the official game from everythingle.com.
        </p>
      </div>
    </div>
  );
}
