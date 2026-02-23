export function getSupabaseConfig() {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const anonKey = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

  if (!url || !anonKey || url.includes('YOUR_') || anonKey.includes('YOUR_')) {
    return null;
  }

  return {url, anonKey};
}

export function hasSupabaseConfig(): boolean {
  return Boolean(getSupabaseConfig());
}
