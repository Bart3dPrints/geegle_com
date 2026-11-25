// Letter-tile thumbnail used until per-game artwork is available. Deterministic
// hue per game id; artwork entries in the catalog (game.thumb) take priority.

import type { GameEntry } from '../types';

const PALETTE = [
  'bg-slate-600',
  'bg-blue-600',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-violet-600',
  'bg-rose-600',
  'bg-cyan-600',
  'bg-orange-600',
];

export function tileColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function TileThumb({
  game,
  className = '',
}: {
  game: GameEntry;
  className?: string;
}) {
  const base = 'flex items-center justify-center overflow-hidden';
  if (game.thumb) {
    return (
      <img
        src={game.thumb}
        alt={game.title}
        loading="lazy"
        className={`${base} ${className} object-cover`}
      />
    );
  }
  return (
    <span
      className={`${base} ${className} text-white ${tileColor(game.id)}`}
      aria-hidden="true"
    >
      {game.title.charAt(0).toUpperCase()}
    </span>
  );
}
