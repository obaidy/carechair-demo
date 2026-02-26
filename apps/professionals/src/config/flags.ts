function readFlag(key: string, fallback = false): boolean {
  const value = String(process.env[key] || '').trim().toLowerCase();
  if (!value) return fallback;
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

export const flags = {
  USE_INVITES_V2: readFlag('EXPO_PUBLIC_USE_INVITES_V2', false)
} as const;

export type AppFlags = typeof flags;
