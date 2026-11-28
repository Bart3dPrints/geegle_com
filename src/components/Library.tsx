// Games library grid: Starred, optional Recently Played, full-width alphabetical
// sections with a working letter rail.
//
// The rail always shows all 28 entries (FAV, #, A–Z) and sizes its rows from the
// real viewport height, so nothing is cut off on a short display. Each
// alphabetical section can be expanded or collapsed vertically.
//
// The search field and category chips live in the sticky library header (see
// LibrarySearchBar); this component receives the already filtered entries.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { animate } from 'animejs';
import { ChevronDown } from 'lucide-react';
import type { GameEntry } from '../types';
import { groupByLetter } from '../lib/alphabet';
import { GameCard, EmptyState } from './GameCard';

/** FAV, #, and every letter: 28 entries, in that order. */
const RAIL_ENTRIES = [
  'FAV',
  '#',
  ...Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index)),
] as const;

function LetterRail({
  entries,
  active,
  hasFavorites,
  onPick,
  layout,
  headerOffset,
  railHeight,
}: {
  entries: string[];
  active: string;
  hasFavorites: boolean;
  onPick: (letter: string) => void;
  layout: 'column' | 'row';
  headerOffset: number;
  railHeight: number;
}) {
  const available = new Set(entries);
  const rowHeight = railHeight / RAIL_ENTRIES.length;
  return (
    <nav
      aria-label="Alphabetical navigation"
      className={
        layout === 'column'
          ? 'sticky grid w-8 shrink-0 gap-0 overflow-y-auto'
          : 'flex gap-1 overflow-x-auto pb-1'
      }
      style={
        layout === 'column'
          ? {
              top: headerOffset + 8,
              // Measured from the real viewport, so every entry fits even on a
              // short display. The grid divides that height evenly.
              height: `${railHeight}px`,
              gridTemplateRows: `repeat(${RAIL_ENTRIES.length}, minmax(0, 1fr))`,
            }
          : undefined
      }
    >
      {RAIL_ENTRIES.map((letter) => {
        const enabled = letter === 'FAV' ? hasFavorites : available.has(letter);
        const current = active === letter;
        return (
          <button
            key={letter}
            type="button"
            onClick={() => onPick(letter)}
            disabled={!enabled}
            aria-label={
              letter === 'FAV'
                ? 'Jump to starred games'
                : `Jump to ${letter === '#' ? 'numbers and symbols' : letter}`
            }
            aria-current={current ? 'true' : undefined}
            className={
              layout === 'column'
                ? `flex h-full min-h-0 w-7 items-center justify-center overflow-hidden rounded font-medium leading-none transition-colors ${
                    current
                      ? 'accent-surface'
                      : enabled
                        ? 'text-[var(--geegle-muted)] hover:bg-neutral-100 hover:text-neutral-900'
                        : 'text-neutral-300'
                  }`
                : `flex h-6 w-7 shrink-0 items-center justify-center rounded text-xs font-medium transition-colors ${
                    current
                      ? 'accent-surface'
                      : enabled
                        ? 'text-[var(--geegle-muted)] hover:bg-neutral-100 hover:text-neutral-900'
                        : 'text-neutral-300'
                  }`
            }
            style={layout === 'column' ? { fontSize: rowHeight < 15 ? 9 : 11 } : undefined}
          >
            {letter}
          </button>
        );
      })}
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
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [railHeight, setRailHeight] = useState(0);
  const reduceMotion = useReducedMotion();
  const collapsedRef = useRef(collapsed);
  collapsedRef.current = collapsed;

  const sections = useMemo(() => groupByLetter(games), [games]);
  const letters = useMemo(() => sections.map((section) => section.letter), [sections]);

  const favoriteEntries = useMemo(() => {
    const byId = new Map(games.map((game) => [game.id, game]));
    return favorites.map((id) => byId.get(id)).filter((game): game is GameEntry => Boolean(game));
  }, [games, favorites]);

  // The rail spans the real viewport below the header, not a fixed height.
  useEffect(() => {
    const update = () => setRailHeight(Math.max(140, window.innerHeight - headerOffset - 40));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [headerOffset]);

  // Track which section is in view so the rail reflects the page.
  useEffect(() => {
    const update = () => {
      const first = favoriteEntries.length > 0 ? 'FAV' : (sections[0]?.letter ?? '');
      let current = first;
      const starred = document.getElementById('starred');
      if (starred && starred.getBoundingClientRect().top <= headerOffset + 40) current = 'FAV';
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
  }, [sections, headerOffset, favoriteEntries.length]);

  const expand = useCallback((letter: string) => {
    if (!collapsedRef.current.includes(letter)) return;
    setCollapsed((current) => current.filter((entry) => entry !== letter));
  }, []);

  const scrollToLetter = useCallback(
    (letter: string) => {
      const id = letter === 'FAV' ? 'starred' : `letter-${letter}`;
      expand(letter);
      const run = () => {
        const element = document.getElementById(id);
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
      };
      // The section has to be expanded before its real position is measured.
      window.requestAnimationFrame(() => window.requestAnimationFrame(run));
    },
    [reduceMotion, headerOffset, expand]
  );

  const toggleSection = (letter: string) => {
    setCollapsed((current) =>
      current.includes(letter) ? current.filter((entry) => entry !== letter) : [...current, letter]
    );
  };

  return (
    <div>
      {favoriteEntries.length > 0 && (
        <section id="starred" className="mb-8 scroll-mt-40" aria-label="Starred">
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
        <p className="mb-4 text-sm text-neutral-600" role="status">
          {games.length} {games.length === 1 ? 'result' : 'results'} for “{query}”
        </p>
      )}

      {letters.length > 1 && (
        <div className="mb-4 lg:hidden">
          <LetterRail
            entries={letters}
            active={activeLetter}
            hasFavorites={favoriteEntries.length > 0}
            onPick={scrollToLetter}
            layout="row"
            headerOffset={headerOffset}
            railHeight={railHeight}
          />
        </div>
      )}

      {games.length === 0 ? (
        <EmptyState
          title={query ? `No games match “${query}”` : 'No games here'}
          body="Try another category or search for a game."
        />
      ) : (
        <div className="flex gap-6">
          <aside className="hidden lg:block">
            <LetterRail
              entries={letters}
              active={activeLetter}
              hasFavorites={favoriteEntries.length > 0}
              onPick={scrollToLetter}
              layout="column"
              headerOffset={headerOffset}
              railHeight={railHeight}
            />
          </aside>
          <div className="min-w-0 flex-1">
            {sections.map((section) => {
              const isCollapsed = collapsed.includes(section.letter);
              return (
                <section
                  key={section.letter}
                  id={`letter-${section.letter}`}
                  className="mb-8"
                  style={{ scrollMarginTop: headerOffset + 8 }}
                  aria-labelledby={`letter-heading-${section.letter}`}
                >
                  <h2
                    id={`letter-heading-${section.letter}`}
                    className="mb-3 border-b border-neutral-200 pb-2 text-sm font-semibold uppercase tracking-wide text-[var(--geegle-muted)] dark:border-[var(--geegle-border)]"
                  >
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 text-left"
                      aria-expanded={!isCollapsed}
                      aria-controls={`letter-panel-${section.letter}`}
                      onClick={() => toggleSection(section.letter)}
                    >
                      <span>{section.letter}</span>
                      <ChevronDown
                        size={14}
                        aria-hidden="true"
                        className={`shrink-0 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
                      />
                    </button>
                  </h2>
                  <AnimatePresence initial={false}>
                    {!isCollapsed && (
                      <motion.div
                        key="panel"
                        id={`letter-panel-${section.letter}`}
                        className="overflow-hidden"
                        initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={reduceMotion ? { opacity: 1 } : { height: 0, opacity: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}
                      >
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
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
