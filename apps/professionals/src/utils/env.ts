function readEnv(key: string): string {
  return String(process.env[key] || '').trim();
}

function readStrictBoolean(key: string, fallback = false): boolean {
  const value = readEnv(key).toLowerCase();
  if (!value) return fallback;
  return value === 'true';
}

function parseHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

export const env = {
  useMockApi: readStrictBoolean('EXPO_PUBLIC_USE_MOCK_API', false),
  supabaseUrl: readEnv('EXPO_PUBLIC_SUPABASE_URL') || readEnv('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey:
    readEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY') ||
    readEnv('EXPO_PUBLIC_ANON_KEY') ||
    readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  buildEnv: readEnv('EXPO_PUBLIC_BUILD_ENV') || readEnv('NODE_ENV') || 'development',
};

export const hasSupabaseConfig = Boolean(env.supabaseUrl && env.supabaseAnonKey);

export const supabaseHost = parseHost(env.supabaseUrl);
