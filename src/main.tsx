import { installStorageGuard } from './lib/storageGuard';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Mask platform session keys before anything (including a game frame) can read
// them through window.localStorage.
installStorageGuard();

// The service worker injects the per-account storage shim into local game
// documents (see public/geegle-sw.js). Registration is best-effort: without it
// games still run, they just do not get cloud saves.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/geegle-sw.js').catch(() => { /* unsupported context */ });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
