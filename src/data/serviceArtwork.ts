// Owner-supplied screenshots of the external services themselves, shown on the
// service cards. A service without a supplied screenshot renders no image, and
// no screenshot is guessed onto a card whose identity is unconfirmed.
//
// The two remaining files are deliberately unassigned:
//   /artwork/services/unidentified-dark-blue.webp  no branding on the screen, so
//       the service could not be identified without guessing
//   /artwork/services/xylora.webp  the owner's screenshot of Xylora itself, but
//       the repository holds no Xylora endpoint, so there is no card to attach
//       it to yet

export interface ServiceArtwork {
  url: string;
  alt: string;
}

export const SERVICE_ARTWORK: Record<string, ServiceArtwork> = {
  helios: { url: '/artwork/services/helios.webp', alt: 'Helios Proxy home screen with its search bar' },
  arctic: { url: '/artwork/services/arctic.webp', alt: 'Arctic Proxy home screen with its search bar and quick links' },
  cherry: { url: '/artwork/services/cherry.webp', alt: 'Cherry Proxy home screen with its search bar' },
  achroma: { url: '/artwork/services/achroma.webp', alt: 'Achroma Proxy home screen with its search bar' },
  'bull-33': { url: '/artwork/services/bull-33.webp', alt: 'Bull-33 home screen with its search bar and shortcuts' },
};
