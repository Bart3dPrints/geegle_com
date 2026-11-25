import { supabase } from '../lib/supabase';
import type { AppearanceTransport } from './appearanceSync';

const table = 'geegle_landing_appearance';
const columns = 'appearance,revision';
const bounded = (signal: AbortSignal) => AbortSignal.any([signal, AbortSignal.timeout(10_000)]);

export const appearanceTransport: AppearanceTransport = {
  async session() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session ? { id: data.session.user.id, token: data.session.access_token } : null;
  },
  async read(id, token, signal) {
    const {data, error} = await supabase.from(table).select(columns).eq('user_id', id)
      .setHeader('Authorization', 'Bearer ' + token).abortSignal(bounded(signal)).maybeSingle();
    if (error) throw error;
    return data;
  },
  async write(id, token, signal, revision, appearance) {
    const request = revision === null
      ? supabase.from(table).insert({user_id: id, appearance})
      : supabase.from(table).update({appearance}).eq('user_id', id).eq('revision', revision);
    const {data, error} = await request.select(columns)
      .setHeader('Authorization', 'Bearer ' + token).abortSignal(bounded(signal)).maybeSingle();
    if (error?.code === '23505') return null;
    if (error) throw error;
    return data;
  },
};
