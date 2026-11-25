// Game artwork: uses REAL images from each game's own asset folder on
// UGS-Assets (the same origin the game itself loads from — no new licensing
// surface). Falls back to a neutral tile only when a game genuinely has no
// usable image.

import { useState } from 'react';
import type { GameEntry } from '../types';
import { ARTWORK_FOLDERS } from '../data/artwork';

const CDN = 'https://cdn.jsdelivr.net/gh/bubbls/UGS-Assets@main';

// Candidate image names inside each asset folder, in priority order:
// background/title screens first (best 16:9 sources), then menu images.
const CANDIDATES = [
  'images/menu_bg-sheet0.png',
  'images/main_bg-sheet0.png',
  'images/game_bg-sheet0.png',
  'images/bg-sheet0.png',
  'images/background-sheet0.png',
  'images/title-sheet0.png',
  'images/title_screen-sheet0.png',
  'images/level_select-sheet0.png',
  'images/map1_bg-sheet0.png',
  'images/menu-sheet0.png',
  'images/sprite-sheet0.png',
  'images/sheet0.png',
];

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

/**
 * Tries real image candidates from the game's asset folder in priority
 * order. Remembers which candidate index worked per game in sessionStorage
 * so repeat views load the known-good URL directly.
 */
export function GameArt({
  game,
  className = '',
}: {
  game: GameEntry;
  className?: string;
}) {
  const folder = ARTWORK_FOLDERS[game.id];

  const startIdx = (() => {
    if (!folder) return -1;
    try {
      const stored = sessionStorage.getItem(`geegle-art-${game.id}`);
      if (stored !== null) return Number(stored);
    } catch {
      /* ignore */
    }
    return 0;
  })();

  const [idx, setIdx] = useState(startIdx);

  // Explicit artwork (curated per-game URL) always wins.
  if (game.thumb) {
    return (
      <img
        src={game.thumb}
        alt={game.title}
        loading="lazy"
        className={`object-cover ${className}`}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  }

  if (!folder || idx < 0 || idx >= CANDIDATES.length) {
    // Neutral fallback — only for games with no usable artwork.
    return (
      <span
        className={`flex items-center justify-center text-white ${tileColor(game.id)} ${className}`}
        aria-hidden="true"
      >
        {game.title.charAt(0).toUpperCase()}
      </span>
    );
  }

  const src = `${CDN}/${folder}/${CANDIDATES[idx]}`;

  return (
    <img
      src={src}
      alt={game.title}
      loading="lazy"
      className={`object-cover ${className}`}
      onError={() => {
        const next = idx + 1;
        setIdx(next);
        if (next < CANDIDATES.length) {
          try {
            sessionStorage.setItem(`geegle-art-${game.id}`, String(next));
          } catch {
            /* ignore */
          }
        }
      }}
    />
  );
}
