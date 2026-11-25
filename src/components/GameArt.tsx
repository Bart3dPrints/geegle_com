// Game artwork: REAL images from each game's own asset folder on UGS-Assets
// (the same origin the game itself loads from — no new licensing surface).
// Candidate list covers Construct-style images/ folders, Unity-style
// template/root images, icons, and favicons; falls back to a neutral tile
// only when a game genuinely has no usable image.
//
// Every candidate URL is verified lazily at runtime via the onError chain:
// failed candidates are remembered per session so each missing image is
// requested at most once — no repeated network requests for 404s.

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

// Priority: title/menu screens first (best 16:9), then backgrounds, then
// Unity template/root images, icons, favicons.
const CANDIDATES = [
  'images/menu_bg-sheet0.png',
  'images/main_bg-sheet0.png',
  'images/game_bg-sheet0.png',
  'images/bg-sheet0.png',
  'images/background-sheet0.png',
  'images/title-sheet0.png',
  'images/level_select-sheet0.png',
  'images/map1_bg-sheet0.png',
  'images/menu-sheet0.png',
  'images/sheet0.png',
  'TemplateData/img.jpg',
  'TemplateData/vin.jpg',
  '512.jpg',
  'logo.png',
  'icon.png',
  'Icon_512x512.png',
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

/** Tracks which candidate index resolved for each game this session. */
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
  // Explicit per-game artwork takes priority; the folder mapping is used
  // when no curated thumb exists. Both paths share the same fallback chain.
  const folder = ARTWORK_FOLDERS[game.id];
  const hasArtwork = Boolean(game.thumb || folder);

  const [idx, setIdx] = useState(() =>
    rememberedCandidate(game.id)
  );
  const [explicitFailed, setExplicitFailed] = useState(false);

  const handleError = () => {
    // Curated thumb failed → try the folder mapping if present.
    if (game.thumb && !explicitFailed && folder) {
      setExplicitFailed(true);
      return;
    }
    // Walk the candidate list inside the mapped folder.
    if (folder) {
      const next = idx + 1;
      if (next < CANDIDATES.length) {
        rememberCandidate(game.id, next);
        setIdx(next);
        return;
      }
    }
    // No more candidates: neutral fallback for this session (remembered so
    // we never re-request the missing image).
    rememberCandidate(game.id, CANDIDATES.length);
    setIdx(CANDIDATES.length);
  };

  // Neutral fallback — only for games with no verified artwork.
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
