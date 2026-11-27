// Owner-supplied screenshots of the external services themselves, shown on the
// service cards. A service without a supplied screenshot renders no image, and
// no screenshot is guessed onto a card whose identity is unconfirmed.
//
// The Soluos screenshot was previously stored as unidentified-dark-blue.webp;
// the owner confirmed that dark-blue clock/shortcut screen is Soluos.
//
// Xylora is offered through this repository's own wrapper
// (public/games/xylora.html), so the owner's screenshot has a card.

export interface ServiceArtwork {
  url: string;
  alt: string;
}

export const SERVICE_ARTWORK: Record<string, ServiceArtwork> = {
  helios: { url: '/artwork/services/helios.webp', alt: 'Helios Proxy home screen with its search bar' },
  arctic: { url: '/artwork/services/arctic.webp', alt: 'Arctic Proxy home screen with its search bar and quick links' },
  cherry: { url: '/artwork/services/cherry.webp', alt: 'Cherry Proxy home screen with its search bar' },
  soluos: { url: '/artwork/services/soluos.webp', alt: 'Soluos Proxy home screen with its clock and shortcuts' },
  achroma: { url: '/artwork/services/achroma.webp', alt: 'Achroma Proxy home screen with its search bar' },
  'bull-33': { url: '/artwork/services/bull-33.webp', alt: 'Bull-33 home screen with its search bar and shortcuts' },
  xylora: { url: '/artwork/services/xylora.webp', alt: 'Xylora home screen over a dark forest background' },
};
