import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, usernameFromEmail } from '../lib/supabase';
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

export function useAuth(onIdentityChange: () => void): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let previous: string | null | undefined;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      const id = next?.user.id ?? null;
      if (previous !== undefined && previous !== id) onIdentityChange();
      previous = id;
      setSession(next);
      setUser(next?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [onIdentityChange]);

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
