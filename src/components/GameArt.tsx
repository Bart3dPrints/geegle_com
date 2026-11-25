import { Image } from 'lucide-react';
import { useState } from 'react';
import { artworkFor } from '../data/artworkManifest';
import type { GameEntry } from '../types';

function ArtworkImage({ url, className }: { url?: string; className: string }) {
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return (
      <span
        className={`flex items-center justify-center bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 ${className}`}
        aria-hidden="true"
      >
        <Image className="h-1/3 w-1/3 max-h-8 max-w-8" />
      </span>
    );
  }

  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      className={`object-contain ${className}`}
      onError={() => setFailed(true)}
    />
  );
}

export function GameArt({ game, className = '' }: { game: GameEntry; className?: string }) {
  const artwork = artworkFor(game);
  const url = artwork.status === 'verified' ? artwork.url : undefined;
  return <ArtworkImage key={game.id + ':' + (url ?? '')} url={url} className={className} />;
}
