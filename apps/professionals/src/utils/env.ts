function readValue(value: unknown): string {
  return String(value || '').trim();
}

function readStrictBoolean(value: unknown, fallback = false): boolean {
  const normalized = readValue(value).toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true';
}

function readNodeEnv(): string {
  return readValue(process.env.NODE_ENV) || 'development';
}

function readSupabaseUrl(): string {
  return readValue(process.env.EXPO_PUBLIC_SUPABASE_URL) || readValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

function readSupabaseAnonKey(): string {
  return (
    readValue(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) ||
    readValue(process.env.EXPO_PUBLIC_ANON_KEY) ||
    readValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

function readBuildEnv(): string {
  return readValue(process.env.EXPO_PUBLIC_BUILD_ENV) || readNodeEnv();
}

function parseHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

export const env = {
  useMockApi: readStrictBoolean(process.env.EXPO_PUBLIC_USE_MOCK_API, false),
  supabaseUrl: readSupabaseUrl(),
  supabaseAnonKey: readSupabaseAnonKey(),
  devOtpBypass: readStrictBoolean(process.env.EXPO_PUBLIC_DEV_OTP_BYPASS, false),
  devOtpBypassCode: readValue(process.env.EXPO_PUBLIC_DEV_OTP_BYPASS_CODE) || '000000',
  buildEnv: readBuildEnv(),
};

export const hasSupabaseConfig = Boolean(env.supabaseUrl && env.supabaseAnonKey);

export const supabaseHost = parseHost(env.supabaseUrl);
