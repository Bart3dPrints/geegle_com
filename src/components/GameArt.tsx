import { Image } from 'lucide-react';
import { useEffect, useState } from 'react';
import { artworkFor } from '../data/artworkManifest';
import type { GameEntry } from '../types';

function ArtworkImage({ url, className }: { url?: string; className: string }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [url]);

  if (!url || failed) {
    return (
      <span
        className={`flex items-center justify-center bg-neutral-100 text-neutral-400 ${className}`}
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
      data-loaded={loaded ? 'true' : 'false'}
      className={`geegle-art object-contain ${className}`}
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
    />
  );
}

export function GameArt({ game, className = '' }: { game: GameEntry; className?: string }) {
  const artwork = artworkFor(game);
  const url = artwork.status === 'unavailable' ? undefined : artwork.url;
  return <ArtworkImage key={game.id + ':' + (url ?? '')} url={url} className={className} />;
}
