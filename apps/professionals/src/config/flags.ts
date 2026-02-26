function readFlag(key: string, fallback = false): boolean {
  const value = String(process.env[key] || '').trim().toLowerCase();
  if (!value) return fallback;
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

export const flags = {
  // Default ON to keep professionals app on the new onboarding/membership flow.
  // Set EXPO_PUBLIC_USE_INVITES_V2=false only for explicit rollback testing.
  USE_INVITES_V2: readFlag('EXPO_PUBLIC_USE_INVITES_V2', true)
} as const;

export type AppFlags = typeof flags;
