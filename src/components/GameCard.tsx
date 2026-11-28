// Game card: real artwork, title, favorite toggle. Used by every grid.
// The favorite control is always visible (never hover-only) and the star
// reacts with a short tap animation that respects reduced motion.

import { Star } from 'lucide-react';
import { motion } from 'motion/react';
import type { GameEntry } from '../types';
import { GameArt } from './GameArt';

export function GameCard({
  game,
  onLaunch,
  isFavorite,
  onToggleFavorite,
}: {
  game: GameEntry;
  onLaunch: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}) {
  return (
    <div
      data-card=""
      className="card group relative overflow-hidden transition-[transform,border-color,box-shadow,background-color] duration-150 ease-out hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-[0_1px_2px_rgba(0,0,0,0.16),0_6px_14px_-6px_rgba(0,0,0,0.28)]"
    >
      <button
        className="block w-full text-left"
        onClick={onLaunch}
        aria-label={`Play ${game.title}`}
      >
        <div className="flex aspect-video items-center justify-center overflow-hidden bg-neutral-200">
          <GameArt game={game} className="h-full w-full" />
        </div>
        <div className="p-3">
          <p className="truncate text-sm font-medium">{game.title}</p>
        </div>
      </button>
      {onToggleFavorite && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.86 }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
          className="absolute right-2 top-2 rounded-md border border-neutral-200 bg-white/95 p-1.5 dark:border-[var(--geegle-border)]"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          aria-label={
            isFavorite
              ? `Remove ${game.title} from favorites`
              : `Add ${game.title} to favorites`
          }
          aria-pressed={Boolean(isFavorite)}
        >
          <Star
            size={16}
            className={
              isFavorite
                ? 'fill-neutral-900 text-neutral-900'
                : 'text-neutral-400'
            }
          />
        </motion.button>
      )}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="card flex flex-col items-center justify-center p-12 text-center">
      <h3 className="mb-1 text-base font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-[var(--geegle-muted)]">{body}</p>
    </div>
  );
}
