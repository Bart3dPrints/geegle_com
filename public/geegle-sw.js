// Injects the per-account storage shim into every local game document.
//
// Editing 2,800 wrapper files would rewrite over a gigabyte of game blobs, so
// the injection happens at response time instead: this worker intercepts
// navigations to /games/*.html and adds one <script> tag before the game's own
// scripts run. It covers HTML5, Unity WebGL, Ruffle, Emscripten and Construct
// wrappers alike, including nested same-origin frames (each navigation is
// intercepted separately), without touching the game files themselves.
//
// Oversized documents (single-file engine builds) are passed through
// untouched; the coverage table reports those as unsupported rather than
// pretending they are saved.
// Absolute origin: many wrappers set <base href="https://cdn...">, which
// rewrites even root-relative script URLs and would break the injected tag.
const SHIM_TAG = `<script src="${self.location.origin}/games/geegle-storage-shim.js" data-geegle-storage></script>`;
const EXISTING_TAG = /<script[^>]*data-geegle-storage[^>]*><\/script>/gi;
const MAX_INJECT_BYTES = 24 * 1024 * 1024;
const GAME_PAGE = /^\/games\/[^/]+\.html$/i;
const HEAD = /<head(\s[^>]*)?>/i;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

async function injected(request) {
  const response = await fetch(request);
  const type = response.headers.get('content-type') ?? '';
  if (!response.ok || !/text\/html/i.test(type)) return response;
  const length = Number(response.headers.get('content-length') ?? '0');
  if (length > MAX_INJECT_BYTES) return response;

  // Replace a previously injected tag so an older relative URL cannot shadow
  // the working one.
  const html = (await response.text()).replace(EXISTING_TAG, '');
  const next = HEAD.test(html)
    ? html.replace(HEAD, (match) => match + SHIM_TAG)
    : SHIM_TAG + html;

  const headers = new Headers(response.headers);
  // The body was decoded and re-encoded, so the original length and encoding
  // no longer describe it.
  headers.delete('content-length');
  headers.delete('content-encoding');
  return new Response(next, { status: response.status, statusText: response.statusText, headers });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.mode !== 'navigate') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !GAME_PAGE.test(url.pathname)) return;
  event.respondWith(injected(request).catch(() => fetch(request)));
});
