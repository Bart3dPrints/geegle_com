import { useEffect, useState } from 'react';
import { SearchLanding, type LandingAccount } from '../components/SearchLanding';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { accountAppearanceSync } from './appearanceSync';
import { appearanceTransport } from './appearanceTransport';

type State = { account?: LandingAccount; notice?: string; reload?: () => void };
export function AccountSearchRoute({ onOpenLibrary }: { onOpenLibrary: () => void }) {
  const [state, setState] = useState<State | null>(isSupabaseConfigured ? null : {});
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let current: { id: string; close: () => void } | undefined;
    let mounted = true;
    const {data} = supabase.auth.onAuthStateChange((_event, session) => {
      const id = session?.user.id;
      if (!mounted || (current && current.id === id)) return;
      current?.close();
      current = undefined;
      if (!id) { setState({}); return; }

      const sync = accountAppearanceSync(id, appearanceTransport);
      const owner = {id, close:sync.dispose};
      current = owner;
      const active = () => mounted && current === owner;
      const offline = {id, appearance:undefined};
      async function reload() {
        if (!active()) return;
        setState({account:offline});
        try {
          const appearance = await sync.load();
          if (!active()) return;
          const account: LandingAccount = {id:owner.id, appearance, saveAppearance:async value => {
            try {
              await sync.save(value);
              if (!active()) throw new Error('Account changed.');
              setState({account:{...account, appearance:value}});
            } catch (error) {
              if (active()) setState({account:offline, reload,
                notice:'Your change is on this device. Reload the account version before trying to sync again.'});
              throw error;
            }
          }};
          setState({account});
        } catch {
          if (active()) setState({account:offline, reload, notice:'Account appearance is unavailable. Device customization still works.'});
        }
      }
      setState({account:offline});
      // Supabase auth callbacks must return before calling getSession.
      setTimeout(() => { if (active()) void reload(); }, 0);
    });
    return () => { mounted=false; current?.close(); data.subscription.unsubscribe(); };
  }, []);
  if (!state) return <main className="p-6" role="status">Loading search…</main>;
  return <>
    {state.notice && <aside role="status" className="flex items-center justify-center gap-3 px-4 py-2 text-sm">
      {state.notice}<button type="button" className="underline" onClick={state.reload}>Reload account appearance</button>
    </aside>}
    <SearchLanding onOpenLibrary={onOpenLibrary} account={state.account}/>
  </>;
}
