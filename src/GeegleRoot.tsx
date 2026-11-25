import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { SearchLanding } from './components/SearchLanding';
import { isSupabaseConfigured, supabase } from './lib/supabase';

import { platformNavigation, type PrepareLeave } from './landing/platformNavigation';

const Platform = lazy(() => import('./App'));

const wantsGames = () => window.location.hash === '#games';

function LandingRoute() {
  const [identity, setIdentity] = useState<string | null | undefined>(isSupabaseConfigured ? undefined : null);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    // Observe INITIAL_SESSION and later identity changes without triggering account migrations.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setIdentity(session?.user.id ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  if (identity === undefined) return <main className="p-6" role="status">Loading search…</main>;
  return <SearchLanding
    onOpenLibrary={() => { window.location.hash = 'games'; }}
    account={identity ? { id: identity, appearance: undefined } : undefined}
  />;
}

export function GeegleRoot() {
  const [games, showGames] = useState(wantsGames);
  const [pending, setPending] = useState(false);
  const leaveRef = useRef<PrepareLeave | null>(null);
  const [navigate] = useState(() => platformNavigation({
    wantsGames, showGames, setPending,
    beginLeave: () => leaveRef.current?.() ?? Promise.resolve(true),
    stayOnGames: () => window.history.pushState(null, '', '#games'),
    warn: () => window.alert('Could not finish saving. You are still in Games; please retry before leaving.'),
  }));
  useEffect(() => {
    window.addEventListener('hashchange', navigate);
    void navigate();
    return () => window.removeEventListener('hashchange', navigate);
  }, [navigate]);
  useEffect(() => {
    document.title = games ? 'Geegle — Free Web Games' : 'Geegle — Search';
  }, [games]);
  if (!games) return <LandingRoute/>;
  return <div className="flex h-[100dvh] flex-col">
    <nav aria-label="Geegle navigation" className="bg-slate-50 px-4 py-2 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-200">
      <a href="#search" className="underline underline-offset-2">Back to search</a>
    </nav>
    <div className="relative min-h-0 flex-1 [transform:translateZ(0)]">
      <div className="h-full overflow-auto" ref={node => { if (node) node.inert = pending; }}>
        <Suspense fallback={<main className="p-6" role="status">Loading games…</main>}><Platform leaveRef={leaveRef}/></Suspense>
      </div>
      {pending && <div role="status" className="absolute inset-0 z-[60] grid place-items-center bg-slate-950/80 text-white">Finishing game save…</div>}
    </div>
  </div>;
}
