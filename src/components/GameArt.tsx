// Game artwork: REAL images from each game's own asset folder on UGS-Assets
// (the same origin the game itself loads from — no new licensing surface).
// Candidate list covers Construct-style images/ folders and Unity-style
// root/template images; falls back to a neutral tile only when a game
// genuinely has no usable image.

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

// Candidate image paths, priority ordered: title/menu screens first (best
// 16:9 sources), then backgrounds, then icons. Construct projects keep
// images in images/; Unity WebGL builds put icons at the root or in
// TemplateData/. The onError chain walks the list until one loads.
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
  'logo.png',
  'Icon_512x512.png',
  'icon.png',
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

export function GameArt({
  game,
  className = '',
}: {
  game: GameEntry;
  className?: string;
}) {
  const folder = game.thumb ? undefined : ARTWORK_FOLDERS[game.id];

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

  const handleError = () => {
    if (!folder) return;
    const next = idx + 1;
    setIdx(next);
    if (next < CANDIDATES.length) {
      try {
        sessionStorage.setItem(`geegle-art-${game.id}`, String(next));
      } catch {
        /* ignore */
      }
    }
  };

  // Explicit per-game artwork (curated URL) takes priority.
  if (game.thumb) {
    return (
      <img
        src={game.thumb}
        alt={game.title}
        loading="lazy"
        className={`object-cover ${className}`}
        onError={handleError}
      />
    );
  }

  if (!folder || idx < 0 || idx >= CANDIDATES.length) {
    return (
      <span
        className={`flex items-center justify-center text-white ${tileColor(game.id)} ${className}`}
        aria-hidden="true"
      >
        {game.title.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={folderUrl(folder, CANDIDATES[idx])}
      alt={game.title}
      loading="lazy"
      className={`object-cover ${className}`}
      onError={handleError}
    />
  );
}
