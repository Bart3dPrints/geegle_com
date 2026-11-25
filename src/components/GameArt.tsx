// Game artwork: REAL images from each game's own asset folder on UGS-Assets
// (the same origin the game itself loads from). Candidates are ordered by
// representativeness: loading/title screens first, then icons. The onError
// chain walks candidates with per-session memoization, so each missing file
// is requested at most once per session.

import { useState } from 'react';
import type { GameEntry } from '../types';
import { ARTWORK_FOLDERS } from '../data/artwork';

const CDN = 'https://cdn.jsdelivr.net/gh/bubbls/UGS-Assets@main';

function folderUrl(folder: string, file: string): string {
  return `${CDN}/${folder
    .split('/')
    .map(encodeURIComponent)
    .join('/')}/${encodeURIComponent(file)}`;
}

// Verified file names observed in this asset library's game folders:
// - Unity WebGL games: TemplateData/img.jpg, vin.jpg, 512.jpg, logo.png,
//   Icon_512x512.png (e.g. granny 3, space waves)
// - Construct games: images/*-sheet0.png sprite sheets (menu/background
//   sheets are the most representative), loading-logo.png, icon-256.png
// - Simple HTML5 games: favicon.ico
const CANDIDATES = [
  'loading-logo.png',
  'images/menu_bg-sheet0.png',
  'images/main_bg-sheet0.png',
  'images/game_bg-sheet0.png',
  'images/bg-sheet0.png',
  'images/background-sheet0.png',
  'images/title-sheet0.png',
  'images/level_select-sheet0.png',
  'images/map1_bg-sheet0.png',
  'images/menu-sheet0.png',
  'TemplateData/img.jpg',
  'TemplateData/vin.jpg',
  '512.jpg',
  'logo.png',
  'icon-256.png',
  'icon.png',
  'Icon_512x512.png',
  'images/sheet0.png',
  'favicon.ico',
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

function rememberCandidate(gameId: string, idx: number): void {
  try {
    sessionStorage.setItem(`geegle-art-${gameId}`, String(idx));
  } catch {
    /* ignore */
  }
}

function rememberedCandidate(gameId: string): number {
  try {
    const stored = sessionStorage.getItem(`geegle-art-${gameId}`);
    return stored !== null ? Number(stored) : 0;
  } catch {
    return 0;
  }
}

export function GameArt({
  game,
  className = '',
}: {
  game: GameEntry;
  className?: string;
}) {
  // Explicit per-game artwork takes priority; the folder mapping follows;
  // both share the same fallback chain so a failed explicit thumb never
  // shows a broken image.
  const folder = ARTWORK_FOLDERS[game.id];
  const hasArtwork = Boolean(game.thumb || folder);

  const [idx, setIdx] = useState(() => rememberedCandidate(game.id));
  const [explicitFailed, setExplicitFailed] = useState(false);

  const handleError = () => {
    if (game.thumb && !explicitFailed && folder) {
      setExplicitFailed(true);
      return;
    }
    if (folder) {
      const next = idx + 1;
      if (next < CANDIDATES.length) {
        rememberCandidate(game.id, next);
        setIdx(next);
        return;
      }
    }
    rememberCandidate(game.id, CANDIDATES.length);
    setIdx(CANDIDATES.length);
  };

  const usingFallback =
    (!hasArtwork || idx >= CANDIDATES.length) &&
    !(game.thumb && !explicitFailed);

  if (usingFallback) {
    return (
      <span
        className={`flex items-center justify-center text-white ${tileColor(game.id)} ${className}`}
        aria-hidden="true"
      >
        {game.title.charAt(0).toUpperCase()}
      </span>
    );
  }

  const src =
    game.thumb && !explicitFailed
      ? game.thumb
      : folderUrl(folder as string, CANDIDATES[idx]);

  return (
    <img
      src={src}
      alt={game.title}
      loading="lazy"
      className={`object-cover ${className}`}
      onError={handleError}
    />
  );
}
