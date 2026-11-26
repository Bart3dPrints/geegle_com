// Games library: search with live suggestions, category filters, Starred,
// optional Recently Played, and full-width alphabetical sections with a
// working letter sidebar.
//
// Enter in the search field always commits the typed text as a library filter
// and never launches a hovered or first suggestion. Only an explicit click on
// a suggestion launches it.
//
// Motion (motion/react) handles the small state transitions; Anime.js drives
// the alphabetical scroll. Both respect prefers-reduced-motion.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { animate } from 'animejs';
import { Search, X } from 'lucide-react';
import type { GameEntry } from '../types';
import { CATEGORIES } from '../data/types';
import { groupByLetter } from '../lib/alphabet';
import { buildSearchIndex, searchIndex } from '../lib/search';
import { GameArt } from './GameArt';
import { GameCard, EmptyState } from './GameCard';

const HEADER_OFFSET = 132;
const SUGGESTION_LIMIT = 6;

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
          ? 'sticky top-32 flex max-h-[calc(100vh-9rem)] flex-col items-center overflow-y-auto'
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
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [activeLetter, setActiveLetter] = useState('');
  const gridRef = useRef<HTMLDivElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();

  const index = useMemo(() => buildSearchIndex(games), [games]);

  const suggestions = useMemo(() => {
    if (!suggestionsOpen || !input.trim()) return [];
    return searchIndex(index, input, SUGGESTION_LIMIT).map((result) => result.entry);
  }, [index, input, suggestionsOpen]);

  const searched = useMemo(
    () => (query ? searchIndex(index, query, games.length).map((result) => result.entry) : games),
    [index, query, games]
  );

  const visible = useMemo(
    () =>
      category === 'all'
        ? searched
        : searched.filter((game) => game.categories.includes(category as never)),
    [searched, category]
  );
  const sections = useMemo(() => groupByLetter(visible), [visible]);
  const letters = useMemo(() => sections.map((section) => section.letter), [sections]);

  const favoriteEntries = useMemo(() => {
    const byId = new Map(games.map((game) => [game.id, game]));
    return favorites.map((id) => byId.get(id)).filter((game): game is GameEntry => Boolean(game));
  }, [games, favorites]);

  // Close the suggestion list when clicking anywhere else.
  useEffect(() => {
    if (!suggestionsOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!searchWrapRef.current?.contains(event.target as Node)) setSuggestionsOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [suggestionsOpen]);

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

  const commitSearch = () => {
    setQuery(input.trim());
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
    window.scrollTo({ top: 0 });
  };

  const clearSearch = () => {
    setInput('');
    setQuery('');
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
    inputRef.current?.focus();
  };

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

      <div ref={searchWrapRef} className="relative mb-3 max-w-xl">
        <div className="flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 dark:border-neutral-700 dark:bg-neutral-900">
          <Search size={17} className="shrink-0 text-neutral-400" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
            placeholder="Search games"
            aria-label="Search games"
            role="combobox"
            aria-expanded={suggestions.length > 0}
            aria-controls="library-suggestions"
            aria-autocomplete="list"
            aria-activedescendant={
              activeSuggestion >= 0 ? `library-suggestion-${activeSuggestion}` : undefined
            }
            autoComplete="off"
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              setSuggestionsOpen(true);
              setActiveSuggestion(-1);
            }}
            onFocus={() => setSuggestionsOpen(true)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitSearch();
              } else if (event.key === 'Escape') {
                setSuggestionsOpen(false);
                setActiveSuggestion(-1);
              } else if (event.key === 'ArrowDown' && suggestions.length > 0) {
                event.preventDefault();
                setActiveSuggestion((current) => (current + 1) % suggestions.length);
              } else if (event.key === 'ArrowUp' && suggestions.length > 0) {
                event.preventDefault();
                setActiveSuggestion((current) =>
                  current <= 0 ? suggestions.length - 1 : current - 1
                );
              }
            }}
          />
          {(input || query) && (
            <button
              type="button"
              className="rounded p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              onClick={clearSearch}
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {suggestions.length > 0 && (
          <ul
            id="library-suggestions"
            role="listbox"
            aria-label="Search suggestions"
            className="card absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-y-auto p-1 shadow-lg"
          >
            {suggestions.map((game, i) => (
              <li key={game.id} id={`library-suggestion-${i}`} role="option" aria-selected={i === activeSuggestion}>
                <button
                  type="button"
                  className={`flex w-full items-center gap-3 rounded p-2 text-left ${
                    i === activeSuggestion
                      ? 'bg-neutral-100 dark:bg-neutral-800'
                      : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60'
                  }`}
                  onClick={() => {
                    onLaunch(game);
                    setSuggestionsOpen(false);
                  }}
                >
                  <GameArt game={game} className="h-8 w-12 shrink-0 rounded text-xs" />
                  <span className="truncate text-sm">{game.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Categories">
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

      {query && (
        <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400" role="status">
          {visible.length} {visible.length === 1 ? 'result' : 'results'} for “{query}”
        </p>
      )}

      {letters.length > 1 && (
        <div className="mb-4 lg:hidden">
          <LetterRail letters={letters} active={activeLetter} onPick={scrollToLetter} layout="row" />
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState
          title={query ? `No games match “${query}”` : 'No games in this category'}
          body="Try another category or search for a game."
        />
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
                className="mb-8 scroll-mt-36"
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
