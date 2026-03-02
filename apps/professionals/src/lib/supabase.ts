import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createClient} from '@supabase/supabase-js';

function readEnv(...keys: string[]) {
  const envMap: Record<string, string> = {
    EXPO_PUBLIC_SUPABASE_URL: String(process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim(),
    NEXT_PUBLIC_SUPABASE_URL: String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
    EXPO_PUBLIC_SUPABASE_ANON_KEY: String(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim(),
    EXPO_PUBLIC_ANON_KEY: String(process.env.EXPO_PUBLIC_ANON_KEY || '').trim(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim(),
  };
  for (const key of keys) {
    const value = envMap[key] || '';
    if (value) return value;
  }
  return '';
}

const supabaseUrl = readEnv('EXPO_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = readEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY');

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      }
    })
  : null;
