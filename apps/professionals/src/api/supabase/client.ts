import 'react-native-url-polyfill/auto';
import {createClient} from '@supabase/supabase-js';
import {env, hasSupabaseConfig} from '../../utils/env';
import {createSecureStorageAdapter} from '../../utils/secureStore';

export const supabase = hasSupabaseConfig
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storage: createSecureStorageAdapter('cc_prof_supabase')
      }
    })
  : null;
