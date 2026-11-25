import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react';
import { SearchLanding } from './components/SearchLanding';
import { isSupabaseConfigured, supabase } from './lib/supabase';

const Platform = lazy(() => import('./App'));

function subscribeRoute(update: () => void) {
  window.addEventListener('hashchange', update);
  return () => window.removeEventListener('hashchange', update);
}

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
  const games = useSyncExternalStore(subscribeRoute, () => window.location.hash === '#games');
  useEffect(() => {
    document.title = games ? 'Geegle — Free Web Games' : 'Geegle — Search';
  }, [games]);
  if (!games) return <LandingRoute/>;
  return <>
    <nav aria-label="Geegle navigation" className="bg-slate-50 px-4 py-2 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-200">
      <a href="#search" className="underline underline-offset-2">Back to search</a>
    </nav>
    <Suspense fallback={<main className="p-6" role="status">Loading games…</main>}><Platform/></Suspense>
  </>;
}
