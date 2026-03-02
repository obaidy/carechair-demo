function readFlag(value: unknown, fallback = false): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

export const flags = {
  // Default ON to keep professionals app on the new onboarding/membership flow.
  // Set EXPO_PUBLIC_USE_INVITES_V2=false only for explicit rollback testing.
  USE_INVITES_V2: readFlag(process.env.EXPO_PUBLIC_USE_INVITES_V2, true)
} as const;

export type AppFlags = typeof flags;
