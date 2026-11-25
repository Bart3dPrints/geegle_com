// Game card: artwork/letter tile, title, optional favorite toggle.

import { Star } from 'lucide-react';
import type { GameEntry } from '../types';

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
          {game.thumb ? (
            <img
              src={game.thumb}
              alt={game.title}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <span
              className={`flex h-full w-full items-center justify-center text-2xl font-bold text-white ${tileColor(game.id)}`}
            >
              {game.title.charAt(0).toUpperCase()}
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
