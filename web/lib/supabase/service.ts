import 'server-only';

import {createClient} from '@supabase/supabase-js';
import {getSupabaseConfig} from '@/lib/supabase/config';

export function createServiceSupabaseClient() {
  const cfg = getSupabaseConfig();
  const serviceRole = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!cfg || !serviceRole) return null;

  return createClient<any>(cfg.url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
