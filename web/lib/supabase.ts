import {createBrowserSupabaseClient} from '@/lib/supabase/browser';

export const supabase = createBrowserSupabaseClient();

export function assertSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }
  return supabase;
}
