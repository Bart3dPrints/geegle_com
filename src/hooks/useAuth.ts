import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, usernameFor } from '../lib/supabase';
import { register, login, logout } from '../services/auth';

export interface AuthState {
  user: User | null;
  username: string;
  session: Session | null;
  loading: boolean;
  enabled: boolean;
  signIn: (u: string, p: string) => Promise<string | null>;
  signUp: (u: string, p: string) => Promise<string | null>;
  signOut: () => Promise<string | null>;
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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setUser(next?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    user,
    username: usernameFor(user),
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
