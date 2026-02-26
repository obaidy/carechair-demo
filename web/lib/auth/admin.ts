import 'server-only';

import {createServiceSupabaseClient} from '@/lib/supabase/service';

export async function isSuperAdminUser(userId: string | null | undefined): Promise<boolean> {
  const id = String(userId || '').trim();
  if (!id) return false;

  const supabase = createServiceSupabaseClient();
  if (!supabase) return false;

  const {data, error} = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', id)
    .maybeSingle();

  if (error) return false;
  return Boolean(data?.user_id);
}
