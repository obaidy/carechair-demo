import type {SupabaseClient, User} from '@supabase/supabase-js';
import {digitsOnly} from './phone';
import {normalizeSalonStatus, SALON_STATUS} from '../types/status';

export type AccessRole = 'salon_admin' | 'superadmin';

type SalonIdentity = {
  salonId: string;
  salonSlug: string;
  salonName?: string;
  salonStatus?: string;
};

export type IdentityResult =
  | {
      ok: true;
      role: 'superadmin';
      userId: string;
    }
  | {
      ok: true;
      role: 'salon_admin';
      userId: string;
      salonId: string;
      salonSlug: string;
      salonName: string;
      salonStatus: string;
      needsOnboarding: boolean;
      needsApproval: boolean;
    }
  | {
      ok: false;
      error: 'access_denied' | 'onboarding_required' | 'invalid_session';
    };

function parseRole(value: unknown, target: AccessRole): boolean {
  const text = String(value || '').toLowerCase();
  if (!text) return false;
  if (target === 'superadmin') return text === 'superadmin';
  return text === 'salon_admin' || text === 'admin' || text === 'owner';
}

function hasRole(user: User, target: AccessRole): boolean {
  const appMeta = user?.app_metadata || {};
  const userMeta = user?.user_metadata || {};

  const direct = [appMeta.role, userMeta.role, appMeta.web_role, userMeta.web_role, appMeta.dashboard_role, userMeta.dashboard_role];
  if (direct.some((value) => parseRole(value, target))) return true;

  const roles = [
    ...(Array.isArray(appMeta.roles) ? appMeta.roles : []),
    ...(Array.isArray(userMeta.roles) ? userMeta.roles : []),
    ...(Array.isArray(appMeta.web_roles) ? appMeta.web_roles : []),
    ...(Array.isArray(userMeta.web_roles) ? userMeta.web_roles : [])
  ];

  return roles.some((value) => parseRole(value, target));
}

function readSalonIdentityFromMetadata(user: User): Partial<SalonIdentity> | null {
  const appMeta = user?.app_metadata || {};
  const userMeta = user?.user_metadata || {};
  const salonId = String(appMeta.salon_id || appMeta.salonId || userMeta.salon_id || userMeta.salonId || '').trim();
  const salonSlug = String(appMeta.salon_slug || appMeta.salonSlug || userMeta.salon_slug || userMeta.salonSlug || '').trim();
  if (!salonId && !salonSlug) return null;
  return {salonId, salonSlug};
}

async function resolveSalonById(client: SupabaseClient, salonId: string): Promise<SalonIdentity | null> {
  if (!salonId) return null;
  const {data, error} = await client
    .from('salons')
    .select('id,slug,name,status,subscription_status,billing_status')
    .eq('id', salonId)
    .maybeSingle();
  if (error || !data?.id || !data?.slug) return null;
  const status = normalizeSalonStatus(data.status || data.subscription_status || data.billing_status || SALON_STATUS.DRAFT);
  return {
    salonId: String(data.id),
    salonSlug: String(data.slug),
    salonName: String(data.name || 'Salon'),
    salonStatus: status
  };
}

async function resolveSalonBySlug(client: SupabaseClient, salonSlug: string): Promise<SalonIdentity | null> {
  if (!salonSlug) return null;
  const {data, error} = await client
    .from('salons')
    .select('id,slug,name,status,subscription_status,billing_status')
    .eq('slug', salonSlug)
    .maybeSingle();
  if (error || !data?.id || !data?.slug) return null;
  const status = normalizeSalonStatus(data.status || data.subscription_status || data.billing_status || SALON_STATUS.DRAFT);
  return {
    salonId: String(data.id),
    salonSlug: String(data.slug),
    salonName: String(data.name || 'Salon'),
    salonStatus: status
  };
}

async function resolveSalonMembership(client: SupabaseClient, userId: string): Promise<SalonIdentity | null> {
  try {
    const {data, error} = await client
      .from('salon_memberships')
      .select('salon_id,role,status')
      .eq('user_id', userId)
      .in('role', ['owner', 'admin', 'salon_admin'])
      .limit(1)
      .maybeSingle();
    if (error || !data?.salon_id) return null;
    return resolveSalonById(client, String(data.salon_id));
  } catch {
    return null;
  }
}

async function resolveSalonStaff(client: SupabaseClient, userId: string): Promise<SalonIdentity | null> {
  try {
    const {data, error} = await client
      .from('staff')
      .select('salon_id')
      .eq('auth_user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (error || !data?.salon_id) return null;
    return resolveSalonById(client, String(data.salon_id));
  } catch {
    return null;
  }
}

function lower(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

async function resolveSalonByUserContact(client: SupabaseClient, user: User): Promise<SalonIdentity | null> {
  const phoneDigits = digitsOnly(String(user.phone || user.user_metadata?.phone || user.app_metadata?.phone || ''));
  const email = lower(user.email || user.user_metadata?.email || user.app_metadata?.email);

  if (phoneDigits) {
    try {
      const staffRes = await client.from('staff').select('salon_id,phone,is_active').eq('is_active', true).limit(2000);
      if (!staffRes.error && Array.isArray(staffRes.data)) {
        const match = staffRes.data.find((row: any) => digitsOnly(String(row?.phone || '')) === phoneDigits);
        if (match?.salon_id) {
          const found = await resolveSalonById(client, String(match.salon_id));
          if (found) return found;
        }
      }
    } catch {
      // Optional fallback.
    }

    try {
      const salonRes = await client.from('salons').select('id,slug,name,status,subscription_status,billing_status,whatsapp').limit(2000);
      if (!salonRes.error && Array.isArray(salonRes.data)) {
        const match = salonRes.data.find((row: any) => digitsOnly(String(row?.whatsapp || '')) === phoneDigits);
        if (match?.id && match?.slug) {
          const status = normalizeSalonStatus(match.status || match.subscription_status || match.billing_status || SALON_STATUS.DRAFT);
          return {
            salonId: String(match.id),
            salonSlug: String(match.slug),
            salonName: String(match.name || 'Salon'),
            salonStatus: status
          };
        }
      }
    } catch {
      // Optional fallback.
    }
  }

  if (email) {
    try {
      const staffRes = await client.from('staff').select('salon_id,email,is_active').eq('is_active', true).limit(2000);
      if (!staffRes.error && Array.isArray(staffRes.data)) {
        const match = staffRes.data.find((row: any) => lower(row?.email) === email);
        if (match?.salon_id) {
          const found = await resolveSalonById(client, String(match.salon_id));
          if (found) return found;
        }
      }
    } catch {
      // Optional fallback.
    }
  }

  return null;
}

function isPendingApproval(status: string): boolean {
  const normalized = normalizeSalonStatus(status);
  return normalized === SALON_STATUS.PENDING_REVIEW || normalized === SALON_STATUS.DRAFT;
}

export async function resolveIdentitySession(
  client: SupabaseClient,
  user: User,
  requestedRole: AccessRole
): Promise<IdentityResult> {
  if (!user?.id) return {ok: false, error: 'invalid_session'};

  if (requestedRole === 'superadmin') {
    if (!hasRole(user, 'superadmin')) {
      return {ok: false, error: 'access_denied'};
    }
    return {
      ok: true,
      role: 'superadmin',
      userId: String(user.id)
    };
  }

  let salonIdentity: SalonIdentity | null = null;
  const metaIdentity = readSalonIdentityFromMetadata(user);

  if (metaIdentity?.salonId) {
    salonIdentity = await resolveSalonById(client, String(metaIdentity.salonId));
  }

  if (!salonIdentity && metaIdentity?.salonSlug) {
    salonIdentity = await resolveSalonBySlug(client, String(metaIdentity.salonSlug));
  }

  if (!salonIdentity) {
    salonIdentity = await resolveSalonMembership(client, String(user.id));
  }

  if (!salonIdentity) {
    salonIdentity = await resolveSalonStaff(client, String(user.id));
  }

  if (!salonIdentity) {
    salonIdentity = await resolveSalonByUserContact(client, user);
  }

  if (!salonIdentity?.salonId || !salonIdentity?.salonSlug) {
    return {ok: false, error: 'onboarding_required'};
  }

  const salonStatus = normalizeSalonStatus(salonIdentity.salonStatus || SALON_STATUS.DRAFT);

  return {
    ok: true,
    role: 'salon_admin',
    userId: String(user.id),
    salonId: salonIdentity.salonId,
    salonSlug: salonIdentity.salonSlug,
    salonName: String(salonIdentity.salonName || 'Salon'),
    salonStatus,
    needsOnboarding: false,
    needsApproval: isPendingApproval(salonStatus)
  };
}
