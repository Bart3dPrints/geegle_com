// Games library: category filters, Starred, optional Recently Played, and
// full-width alphabetical sections with a working letter sidebar.
//
// Motion (motion/react) handles the small state transitions; Anime.js drives
// the alphabetical scroll and the per-letter stagger when the filter changes.
// Both respect prefers-reduced-motion.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { animate, stagger } from 'animejs';
import type { GameEntry } from '../types';
import { CATEGORIES } from '../data/types';
import { groupByLetter } from '../lib/alphabet';
import { GameCard, EmptyState } from './GameCard';

const HEADER_OFFSET = 104;
const STAGGER_LIMIT = 60;

function LetterRail({
  letters,
  active,
  onPick,
  layout,
}: {
  letters: string[];
  active: string;
  onPick: (letter: string) => void;
  layout: 'column' | 'row';
}) {
  return (
    <nav
      aria-label="Alphabetical navigation"
      className={
        layout === 'column'
          ? 'sticky top-28 flex max-h-[calc(100vh-8rem)] flex-col items-center overflow-y-auto'
          : 'flex gap-1 overflow-x-auto pb-1'
      }
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
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
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
  onLaunch,
  onToggleFavorite,
}: {
  games: GameEntry[];
  favorites: string[];
  recent: GameEntry[];
  showRecent: boolean;
  onLaunch: (game: GameEntry) => void;
  onToggleFavorite: (id: string) => void;
}) {
  const [category, setCategory] = useState('all');
  const [activeLetter, setActiveLetter] = useState('');
  const gridRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const visible = useMemo(
    () =>
      category === 'all'
        ? games
        : games.filter((game) => game.categories.includes(category as never)),
    [games, category]
  );
  const sections = useMemo(() => groupByLetter(visible), [visible]);
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
        if (element && element.getBoundingClientRect().top <= HEADER_OFFSET + 16) {
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
  }, [sections]);

  const scrollToLetter = useCallback(
    (letter: string) => {
      const element = document.getElementById(`letter-${letter}`);
      if (!element) return;
      const target = Math.max(0, element.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET);
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
    [reduceMotion]
  );

  // Short stagger on the first screenful only; never thousands of cards.
  useEffect(() => {
    if (reduceMotion) return;
    const cards = gridRef.current?.querySelectorAll('[data-card]');
    if (!cards || cards.length === 0) return;
    const sample = Array.from(cards).slice(0, STAGGER_LIMIT);
    animate(sample, {
      opacity: [0, 1],
      y: [4, 0],
      duration: 200,
      delay: stagger(5),
      ease: 'outQuad',
    });
  }, [category, reduceMotion]);

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
            transition={{ duration: 0.2, ease: 'easeOut' }}
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

      <div className="mb-6 flex flex-wrap gap-1.5" role="tablist" aria-label="Categories">
        <button
          role="tab"
          aria-selected={category === 'all'}
          className={category === 'all' ? 'chip-active' : 'chip'}
          onClick={() => setCategory('all')}
        >
          All
        </button>
        {CATEGORIES.map((entry) => (
          <button
            key={entry.key}
            role="tab"
            aria-selected={category === entry.key}
            className={category === entry.key ? 'chip-active' : 'chip'}
            onClick={() => setCategory(entry.key)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {letters.length > 1 && (
        <div className="mb-4 lg:hidden">
          <LetterRail letters={letters} active={activeLetter} onPick={scrollToLetter} layout="row" />
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState title="No games in this category" body="Try another category or search for a game." />
      ) : (
        <div className="flex gap-6">
          <aside className="hidden w-8 shrink-0 lg:block">
            <LetterRail letters={letters} active={activeLetter} onPick={scrollToLetter} layout="column" />
          </aside>
          <div ref={gridRef} className="min-w-0 flex-1">
            {sections.map((section) => (
              <section
                key={section.letter}
                id={`letter-${section.letter}`}
                className="mb-8 scroll-mt-28"
                aria-labelledby={`letter-heading-${section.letter}`}
              >
                <h2
                  id={`letter-heading-${section.letter}`}
                  className="mb-3 border-b border-slate-200 pb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400"
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
