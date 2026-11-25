// Game card: real artwork, title, favorite toggle. Used by every grid.

import { Star } from 'lucide-react';
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
    <div className="card group relative overflow-hidden">
      <button
        className="block w-full text-left"
        onClick={onLaunch}
        aria-label={`Play ${game.title}`}
      >
        <div className="flex aspect-video items-center justify-center overflow-hidden bg-slate-200 dark:bg-slate-800">
          <GameArt game={game} className="h-full w-full" />
        </div>
        <div className="p-3">
          <p className="truncate text-sm font-medium">{game.title}</p>
          {game.description && (
            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
              {game.description}
            </p>
          )}
        </div>
      </button>
      {onToggleFavorite && (
        <button
          className="absolute right-2 top-2 rounded-md bg-white/80 p-1.5 opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100 dark:bg-slate-900/80"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          aria-label={
            isFavorite
              ? `Remove ${game.title} from favorites`
              : `Add ${game.title} to favorites`
          }
        >
          <Star
            size={16}
            className={
              isFavorite
                ? 'fill-amber-400 text-amber-400'
                : 'text-slate-300 dark:text-slate-600'
            }
          />
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="card flex flex-col items-center justify-center p-12 text-center">
      <h3 className="mb-1 text-base font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{body}</p>
    </div>
  );
}
