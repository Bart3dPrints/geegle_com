// Games library grid: Starred, optional Recently Played, full-width alphabetical
// sections with a working letter rail.
//
// The search field and category chips live in the sticky library header (see
// LibrarySearchBar); this component receives the already filtered entries.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { animate } from 'animejs';
import type { GameEntry } from '../types';
import { groupByLetter } from '../lib/alphabet';
import { GameCard, EmptyState } from './GameCard';

function LetterRail({
  letters,
  active,
  onPick,
  layout,
  headerOffset,
}: {
  letters: string[];
  active: string;
  onPick: (letter: string) => void;
  layout: 'column' | 'row';
  headerOffset: number;
}) {
  return (
    <nav
      aria-label="Alphabetical navigation"
      className={layout === 'column' ? 'sticky flex flex-col items-center overflow-y-auto' : 'flex gap-1 overflow-x-auto pb-1'}
      style={layout === 'column' ? { top: headerOffset + 8, maxHeight: `calc(100vh - ${headerOffset + 40}px)` } : undefined}
    >
      {letters.map((letter) => (
        <button
          key={letter}
          type="button"
          onClick={() => onPick(letter)}
          aria-label={`Jump to ${letter === '#' ? 'numbers and symbols' : letter}`}
          aria-current={active === letter ? 'true' : undefined}
          className={`flex h-6 w-7 shrink-0 items-center justify-center rounded text-xs font-medium transition-colors ${
            active === letter
              ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
              : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100'
          }`}
        >
          {letter}
        </button>
      ))}
    </nav>
  );
}

export function Library({
  games,
  favorites,
  recent,
  showRecent,
  query,
  headerOffset,
  onLaunch,
  onToggleFavorite,
}: {
  games: GameEntry[];
  favorites: string[];
  recent: GameEntry[];
  showRecent: boolean;
  query: string;
  headerOffset: number;
  onLaunch: (game: GameEntry) => void;
  onToggleFavorite: (id: string) => void;
}) {
  const [activeLetter, setActiveLetter] = useState('');
  const reduceMotion = useReducedMotion();

  const sections = useMemo(() => groupByLetter(games), [games]);
  const letters = useMemo(() => sections.map((section) => section.letter), [sections]);

  const favoriteEntries = useMemo(() => {
    const byId = new Map(games.map((game) => [game.id, game]));
    return favorites.map((id) => byId.get(id)).filter((game): game is GameEntry => Boolean(game));
  }, [games, favorites]);

  // Track which section is in view so the rail reflects the page.
  useEffect(() => {
    const update = () => {
      let current = sections[0]?.letter ?? '';
      for (const section of sections) {
        const element = document.getElementById(`letter-${section.letter}`);
        if (element && element.getBoundingClientRect().top <= headerOffset + 16) {
          current = section.letter;
        }
      }
      setActiveLetter(current);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [sections, headerOffset]);

  const scrollToLetter = useCallback(
    (letter: string) => {
      const element = document.getElementById(`letter-${letter}`);
      if (!element) return;
      const target = Math.max(0, element.getBoundingClientRect().top + window.scrollY - headerOffset - 4);
      if (reduceMotion) {
        window.scrollTo(0, target);
        return;
      }
      const position = { y: window.scrollY };
      animate(position, {
        y: target,
        duration: 420,
        ease: 'outCubic',
        onUpdate: () => window.scrollTo(0, position.y),
      });
    },
    [reduceMotion, headerOffset]
  );

  return (
    <div>
      {favoriteEntries.length > 0 && (
        <section className="mb-8" aria-label="Starred">
          <h2 className="mb-3">Starred</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {favoriteEntries.slice(0, 18).map((game) => (
              <GameCard
                key={game.id}
                game={game}
                onLaunch={() => onLaunch(game)}
                isFavorite
                onToggleFavorite={() => onToggleFavorite(game.id)}
              />
            ))}
          </div>
        </section>
      )}

      <AnimatePresence initial={false}>
        {showRecent && recent.length > 0 && (
          <motion.section
            className="mb-8"
            aria-label="Recently played"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}
          >
            <h2 className="mb-3">Recently Played</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {recent.slice(0, 12).map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  onLaunch={() => onLaunch(game)}
                  isFavorite={favorites.includes(game.id)}
                  onToggleFavorite={() => onToggleFavorite(game.id)}
                />
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {query && (
        <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400" role="status">
          {games.length} {games.length === 1 ? 'result' : 'results'} for “{query}”
        </p>
      )}

      {letters.length > 1 && (
        <div className="mb-4 lg:hidden">
          <LetterRail letters={letters} active={activeLetter} onPick={scrollToLetter} layout="row" headerOffset={headerOffset} />
        </div>
      )}

      {games.length === 0 ? (
        <EmptyState
          title={query ? `No games match “${query}”` : 'No games here'}
          body="Try another category or search for a game."
        />
      ) : (
        <div className="flex gap-6">
          <aside className="hidden w-8 shrink-0 lg:block">
            <LetterRail letters={letters} active={activeLetter} onPick={scrollToLetter} layout="column" headerOffset={headerOffset} />
          </aside>
          <div className="min-w-0 flex-1">
            {sections.map((section) => (
              <section
                key={section.letter}
                id={`letter-${section.letter}`}
                className="mb-8"
                style={{ scrollMarginTop: headerOffset + 8 }}
                aria-labelledby={`letter-heading-${section.letter}`}
              >
                <h2
                  id={`letter-heading-${section.letter}`}
                  className="mb-3 border-b border-neutral-200 pb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:text-neutral-400"
                >
                  {section.letter}
                </h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {section.entries.map((game) => (
                    <GameCard
                      key={game.id}
                      game={game}
                      onLaunch={() => onLaunch(game)}
                      isFavorite={favorites.includes(game.id)}
                      onToggleFavorite={() => onToggleFavorite(game.id)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
