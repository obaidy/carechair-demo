export const SALON_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_REVIEW: 'PENDING_REVIEW',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;

export type SalonLifecycleStatus = (typeof SALON_STATUS)[keyof typeof SALON_STATUS];

export function normalizeSalonLifecycleStatus(input: unknown, fallback: SalonLifecycleStatus = SALON_STATUS.DRAFT): SalonLifecycleStatus {
  const value = String(input || '').trim().toUpperCase();
  if (!value) return fallback;

  if (value === SALON_STATUS.DRAFT || value === 'REJECTED') return SALON_STATUS.DRAFT;
  if (value === SALON_STATUS.PENDING_REVIEW || value === 'PENDING_APPROVAL' || value === 'PENDING_BILLING') return SALON_STATUS.PENDING_REVIEW;
  if (value === SALON_STATUS.ACTIVE || value === 'TRIALING' || value === 'PAST_DUE') return SALON_STATUS.ACTIVE;
  if (value === SALON_STATUS.SUSPENDED) return SALON_STATUS.SUSPENDED;

  // Legacy lowercase values.
  if (value === 'DRAFT') return SALON_STATUS.DRAFT;
  if (value === 'PENDING_REVIEW' || value === 'PENDING_APPROVAL' || value === 'PENDING_BILLING') return SALON_STATUS.PENDING_REVIEW;
  if (value === 'ACTIVE' || value === 'TRIALING' || value === 'PAST_DUE') return SALON_STATUS.ACTIVE;
  if (value === 'SUSPENDED') return SALON_STATUS.SUSPENDED;
  return fallback;
}

export function lifecycleStatusFromBilling(input: unknown): SalonLifecycleStatus {
  const value = String(input || '').trim().toUpperCase();
  if (value === 'SUSPENDED') return SALON_STATUS.SUSPENDED;
  if (value === 'ACTIVE' || value === 'TRIALING' || value === 'PAST_DUE') return SALON_STATUS.ACTIVE;
  if (value === 'PENDING_APPROVAL' || value === 'PENDING_BILLING') return SALON_STATUS.PENDING_REVIEW;
  return SALON_STATUS.DRAFT;
}

export function isActiveLifecycleStatus(input: unknown) {
  return normalizeSalonLifecycleStatus(input) === SALON_STATUS.ACTIVE;
}
