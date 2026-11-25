// Game card: artwork/letter tile, title, optional favorite toggle.

import { Star } from 'lucide-react';
import type { GameEntry } from '../types';
import { TileThumb } from './TileThumb';

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
        <div className="flex aspect-video items-center justify-center bg-slate-200 dark:bg-slate-800">
          <TileThumb game={game} className="h-full w-full text-3xl font-bold" />
        </div>
        <div className="p-3">
          <p className="truncate text-sm font-medium">{game.title}</p>
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
