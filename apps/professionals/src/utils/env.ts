function readEnv(key: string): string {
  return String(process.env[key] || '').trim();
}

export const env = {
  useMockApi: readEnv('EXPO_PUBLIC_USE_MOCK_API') !== 'false',
  supabaseUrl: readEnv('EXPO_PUBLIC_SUPABASE_URL') || readEnv('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey:
    readEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY') || readEnv('EXPO_PUBLIC_ANON_KEY') || readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
};

export const hasSupabaseConfig = Boolean(env.supabaseUrl && env.supabaseAnonKey);
