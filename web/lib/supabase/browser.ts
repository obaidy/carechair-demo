'use client';

import {createClient} from '@supabase/supabase-js';
import {getSupabaseConfig} from '@/lib/supabase/config';
import {createSupabaseFetch} from '@/lib/supabase/fetch';

let cachedClient: ReturnType<typeof createClient<any>> | null = null;

export function createBrowserSupabaseClient() {
  if (cachedClient) return cachedClient;

  const cfg = getSupabaseConfig();
  if (!cfg) return null;

  cachedClient = createClient<any>(cfg.url, cfg.anonKey, {
    global: {
      fetch: createSupabaseFetch('browser'),
    },
  });
  return cachedClient;
}
