type TxFn = (
  key: string,
  fallback: string,
  vars?: Record<string, string | number | boolean | null | undefined>
) => string;

function toMs(value: string | null | undefined) {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

function interpolate(template: string, vars?: Record<string, string | number | boolean | null | undefined>) {
  if (!vars) return template;
  return String(template).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    const value = vars[key];
    return value == null ? '' : String(value);
  });
}

function tx(
  t: TxFn | undefined,
  key: string,
  fallback: string,
  vars?: Record<string, string | number | boolean | null | undefined>
) {
  if (!t) return interpolate(fallback, vars);
  try {
    const out = t(key, fallback, vars);
    if (out == null || out === '') return interpolate(fallback, vars);
    return out;
  } catch {
    return interpolate(fallback, vars);
  }
}

function getStatus(salon: any) {
  return String(salon?.status || salon?.subscription_status || salon?.billing_status || 'draft');
}

export function deriveSalonAccess(salon: any, now = new Date(), t?: TxFn) {
  const nowMs = now instanceof Date ? now.getTime() : Date.now();
  const billingStatus = getStatus(salon);
  const manualOverrideUntilMs = toMs(salon?.manual_override_until);
  const manualOverrideActive = Boolean(salon?.manual_override_active) || manualOverrideUntilMs > nowMs;
  const isSalonActive = Boolean(salon?.is_active ?? true);

  if (manualOverrideActive) {
    return {
      code: 'override',
      fullAccess: true,
      canManage: true,
      canCreateBookings: true,
      isLocked: false,
      badgeLabel: tx(t, 'billingAccess.badges.override', 'Manual override'),
      badgeVariant: 'confirmed',
      lockMessage: ''
    };
  }

  if (!isSalonActive) {
    return {
      code: 'inactive_flag',
      fullAccess: false,
      canManage: false,
      canCreateBookings: false,
      isLocked: true,
      badgeLabel: tx(t, 'billingAccess.badges.inactive', 'Inactive'),
      badgeVariant: 'cancelled',
      lockMessage: tx(t, 'billingAccess.lockMessages.inactive', 'Account is inactive. Complete setup and billing.')
    };
  }

  if (['pending_approval', 'pending_billing', 'rejected', 'suspended'].includes(billingStatus)) {
    return {
      code: billingStatus,
      fullAccess: false,
      canManage: false,
      canCreateBookings: false,
      isLocked: true,
      badgeLabel: tx(t, `status.${billingStatus}`, billingStatus),
      badgeVariant: 'pending',
      lockMessage:
        billingStatus === 'pending_approval'
          ? tx(
              t,
              'billingAccess.lockMessages.pendingApproval',
              tx(
                t,
                'billingAccess.lockMessages.default',
                'Account is currently inactive. Complete setup and billing.'
              )
            )
          : billingStatus === 'pending_billing'
            ? tx(
                t,
                'billingAccess.lockMessages.pendingBilling',
                tx(
                  t,
                  'billingAccess.lockMessages.default',
                  'Account is currently inactive. Complete setup and billing.'
                )
              )
            : billingStatus === 'suspended'
              ? tx(t, 'billingAccess.lockMessages.suspended', 'Account is suspended.')
              : tx(
                  t,
                  'billingAccess.lockMessages.rejected',
                  tx(
                    t,
                    'billingAccess.lockMessages.default',
                    'Account is currently inactive. Complete setup and billing.'
                  )
                )
    };
  }

  if ((billingStatus === 'trialing' || billingStatus === 'active') && isSalonActive) {
    return {
      code: billingStatus,
      fullAccess: true,
      canManage: true,
      canCreateBookings: true,
      isLocked: false,
      badgeLabel:
        billingStatus === 'trialing'
          ? tx(t, 'billingAccess.badges.trialing', 'Trialing')
          : tx(t, 'billingAccess.badges.active', 'Active'),
      badgeVariant: billingStatus === 'trialing' ? 'pending' : 'confirmed',
      lockMessage: ''
    };
  }

  if (billingStatus === 'past_due') {
    return {
      code: 'past_due',
      fullAccess: false,
      canManage: false,
      canCreateBookings: false,
      isLocked: true,
      badgeLabel: tx(t, 'billingAccess.badges.pastDue', 'Past due'),
      badgeVariant: 'pending',
      lockMessage: tx(t, 'billingAccess.lockMessages.pastDue', 'Account is past due. Please update billing.')
    };
  }

  return {
    code: billingStatus || 'draft',
    fullAccess: false,
    canManage: false,
    canCreateBookings: false,
    isLocked: true,
    badgeLabel: tx(t, 'billingAccess.badges.inactive', 'Inactive'),
    badgeVariant: 'cancelled',
    lockMessage: tx(
      t,
      'billingAccess.lockMessages.default',
      'Account is currently inactive. Complete setup and billing.'
    )
  };
}

export function formatBillingDate(value: string | null | undefined, locale = 'en-US') {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function getBillingStatusLabel(status: string | null | undefined, t?: TxFn) {
  const key = String(status || 'draft');
  if (key === 'draft') return tx(t, 'status.draft', 'Draft');
  if (key === 'pending_approval') return tx(t, 'status.pending_approval', 'Pending approval');
  if (key === 'pending_billing') return tx(t, 'status.pending_billing', 'Pending billing');
  if (key === 'inactive') return tx(t, 'status.inactive', 'Inactive');
  if (key === 'trialing') return tx(t, 'status.trialing', 'Trialing');
  if (key === 'active') return tx(t, 'status.active', 'Active');
  if (key === 'past_due') return tx(t, 'status.past_due', 'Past due');
  if (key === 'canceled') return tx(t, 'status.canceled', 'Canceled');
  if (key === 'suspended') return tx(t, 'status.suspended', 'Suspended');
  if (key === 'rejected') return tx(t, 'status.rejected', 'Rejected');
  return key;
}

export function getTrialRemainingLabel(trialEnd: string | null | undefined, now = new Date(), t?: TxFn) {
  if (!trialEnd) return '';
  const endMs = toMs(trialEnd);
  const nowMs = now instanceof Date ? now.getTime() : Date.now();
  const diffMs = endMs - nowMs;
  if (diffMs <= 0) return tx(t, 'billingAccess.trialEnded', 'Trial ended');
  const hours = Math.ceil(diffMs / (1000 * 60 * 60));
  if (hours < 24) return tx(t, 'billingAccess.hoursRemaining', '{{count}} hours remaining', {count: hours});
  const days = Math.ceil(hours / 24);
  return tx(t, 'billingAccess.daysRemaining', '{{count}} days remaining', {count: days});
}

export function computeIsActiveFromBilling(salon: any, now = new Date(), t?: TxFn) {
  const access = deriveSalonAccess(salon, now, t);
  return access.code === 'active' || access.code === 'trialing' || access.code === 'override';
}
