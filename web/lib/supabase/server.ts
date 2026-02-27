import {createClient} from '@supabase/supabase-js';
import {getSupabaseConfig} from '@/lib/supabase/config';
import {createSupabaseFetch} from '@/lib/supabase/fetch';

export function createServerSupabaseClient() {
  const cfg = getSupabaseConfig();
  if (!cfg) return null;

  return createClient<any>(cfg.url, cfg.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      fetch: createSupabaseFetch('server-anon'),
    },
  });
}
