import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, usernameFromEmail } from '../lib/supabase';
import { register, login, logout } from '../services/auth';
import { migrateLocalToAccount } from '../lib/migrateSaves';

export interface AuthState {
  user: User | null;
  username: string;
  session: Session | null;
  loading: boolean;
  enabled: boolean;
  signIn: (u: string, p: string) => Promise<string | null>;
  signUp: (u: string, p: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Restore any persisted session (login survives reload/reopen).
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setUser(data.session?.user ?? null);
      })
      .finally(() => setLoading(false));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, next) => {
      setSession(next);
      setUser(next?.user ?? null);
      const uid = next?.user?.id;
      // First successful sign-in: merge anonymous local data into the account.
      if (uid) void migrateLocalToAccount(uid);
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    user,
    username: usernameFromEmail(user?.email),
    session,
    loading,
    enabled: isSupabaseConfigured,
    signIn: async (u, p) => {
      const r = await login(u, p);
      return r.ok ? null : (r.error ?? 'Sign-in failed.');
    },
    signUp: async (u, p) => {
      const r = await register(u, p);
      return r.ok ? null : (r.error ?? 'Registration failed.');
    },
    signOut: logout,
  };
}
