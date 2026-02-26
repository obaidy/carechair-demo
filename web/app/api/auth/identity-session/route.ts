import {NextRequest, NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {setSalonAdminSession, setSuperadminSession} from '@/lib/auth/server';
import {getSupabaseConfig} from '@/lib/supabase/config';

type WebRole = 'salon_admin' | 'superadmin';

function digitsOnly(value: string | null | undefined) {
  return String(value || '').replace(/\D/g, '');
}

function sanitizeNextPath(value: string, locale: string, fallback: string): string {
  if (!value) return fallback;
  if (!value.startsWith('/')) return fallback;
  if (!value.startsWith(`/${locale}/`)) return fallback;
  return value;
}

function parseRole(input: unknown): WebRole {
  return input === 'superadmin' ? 'superadmin' : 'salon_admin';
}

function isTruthyRole(value: unknown, target: WebRole) {
  const text = String(value || '').toLowerCase();
  if (!text) return false;
  if (target === 'superadmin') return text === 'superadmin';
  return text === 'salon_admin' || text === 'admin' || text === 'owner';
}

function hasRole(user: any, target: WebRole) {
  const appMeta = user?.app_metadata || {};
  const userMeta = user?.user_metadata || {};

  const directRoles = [appMeta.role, userMeta.role, appMeta.web_role, userMeta.web_role, appMeta.dashboard_role, userMeta.dashboard_role];
  if (directRoles.some((row) => isTruthyRole(row, target))) return true;

  const roleList = [
    ...(Array.isArray(appMeta.roles) ? appMeta.roles : []),
    ...(Array.isArray(userMeta.roles) ? userMeta.roles : []),
    ...(Array.isArray(appMeta.web_roles) ? appMeta.web_roles : []),
    ...(Array.isArray(userMeta.web_roles) ? userMeta.web_roles : [])
  ];
  return roleList.some((row) => isTruthyRole(row, target));
}

function readSalonIdentityFromMetadata(user: any): {salonId: string; salonSlug: string} | null {
  const appMeta = user?.app_metadata || {};
  const userMeta = user?.user_metadata || {};
  const salonId = String(appMeta.salon_id || appMeta.salonId || userMeta.salon_id || userMeta.salonId || '').trim();
  const salonSlug = String(appMeta.salon_slug || appMeta.salonSlug || userMeta.salon_slug || userMeta.salonSlug || '').trim();
  if (!salonId || !salonSlug) return null;
  return {salonId, salonSlug};
}

async function resolveSalonById(authClient: ReturnType<typeof createClient<any>>, salonId: string) {
  if (!salonId) return null;
  const {data, error} = await authClient.from('salons').select('id,slug').eq('id', salonId).maybeSingle();
  if (error || !data?.id || !data?.slug) return null;
  return {salonId: String(data.id), salonSlug: String(data.slug)};
}

async function resolveSalonMembership(authClient: ReturnType<typeof createClient<any>>, userId: string) {
  try {
    const {data, error} = await authClient
      .from('salon_memberships')
      .select('salon_id,role,status')
      .eq('user_id', userId)
      .in('role', ['owner', 'admin', 'salon_admin'])
      .limit(1)
      .maybeSingle();
    if (error || !data?.salon_id) return null;
    return resolveSalonById(authClient, String(data.salon_id));
  } catch {
    return null;
  }
}

async function resolveSalonStaff(authClient: ReturnType<typeof createClient<any>>, userId: string) {
  try {
    const {data, error} = await authClient
      .from('staff')
      .select('salon_id')
      .eq('auth_user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (error || !data?.salon_id) return null;
    return resolveSalonById(authClient, String(data.salon_id));
  } catch {
    return null;
  }
}

async function resolveSalonByUserContact(authClient: ReturnType<typeof createClient<any>>, user: any) {
  const phoneDigits = digitsOnly(user?.phone || user?.user_metadata?.phone || user?.app_metadata?.phone);
  const email = String(user?.email || user?.user_metadata?.email || '').trim().toLowerCase();

  if (phoneDigits) {
    try {
      const {data, error} = await authClient
        .from('staff')
        .select('salon_id,phone,is_active')
        .eq('is_active', true)
        .limit(2000);
      if (!error && Array.isArray(data)) {
        const match = data.find((row: any) => digitsOnly(row?.phone) === phoneDigits);
        if (match?.salon_id) {
          const byId = await resolveSalonById(authClient, String(match.salon_id));
          if (byId) return byId;
        }
      }
    } catch {
      // Optional fallback only.
    }

    try {
      const {data, error} = await authClient.from('salons').select('id,slug,whatsapp').limit(2000);
      if (!error && Array.isArray(data)) {
        const match = data.find((row: any) => digitsOnly(row?.whatsapp) === phoneDigits);
        if (match?.id && match?.slug) {
          return {salonId: String(match.id), salonSlug: String(match.slug)};
        }
      }
    } catch {
      // Optional fallback only.
    }
  }

  if (email) {
    try {
      const {data, error} = await authClient.from('staff').select('salon_id,email,is_active').eq('is_active', true).limit(2000);
      if (!error && Array.isArray(data)) {
        const match = data.find((row: any) => String(row?.email || '').trim().toLowerCase() === email);
        if (match?.salon_id) {
          const byId = await resolveSalonById(authClient, String(match.salon_id));
          if (byId) return byId;
        }
      }
    } catch {
      // Optional fallback only.
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ok: false, error: 'invalid_payload'}, {status: 400});
  }

  const locale = String(body?.locale || 'en');
  const role = parseRole(body?.role);
  const accessToken = String(body?.accessToken || '');
  const nextPath = sanitizeNextPath(String(body?.next || ''), locale, role === 'superadmin' ? `/${locale}/sa` : `/${locale}/app`);

  if (!accessToken) {
    return NextResponse.json({ok: false, error: 'missing_access_token'}, {status: 400});
  }

  const cfg = getSupabaseConfig();
  if (!cfg) {
    return NextResponse.json({ok: false, error: 'supabase_missing'}, {status: 500});
  }

  const authClient = createClient<any>(cfg.url, cfg.anonKey, {
    auth: {persistSession: false, autoRefreshToken: false},
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });

  const userRes = await authClient.auth.getUser(accessToken);
  const user = userRes.data?.user;
  if (userRes.error || !user?.id) {
    return NextResponse.json({ok: false, error: 'invalid_session'}, {status: 401});
  }

  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const mappingClient = serviceKey
    ? createClient<any>(cfg.url, serviceKey, {
        auth: {persistSession: false, autoRefreshToken: false}
      })
    : authClient;

  if (role === 'superadmin') {
    if (!hasRole(user, 'superadmin')) {
      return NextResponse.json(
        {ok: false, error: 'superadmin_role_missing'},
        {status: 403}
      );
    }
    await setSuperadminSession({userId: String(user.id)});
    return NextResponse.json({ok: true, nextPath});
  }

  let salonIdentity = readSalonIdentityFromMetadata(user);
  if (salonIdentity?.salonId && !salonIdentity?.salonSlug) {
    salonIdentity = await resolveSalonById(mappingClient, salonIdentity.salonId);
  }

  if (!salonIdentity) {
    salonIdentity = await resolveSalonMembership(mappingClient, String(user.id));
  }

  if (!salonIdentity) {
    salonIdentity = await resolveSalonStaff(mappingClient, String(user.id));
  }

  if (!salonIdentity) {
    salonIdentity = await resolveSalonByUserContact(mappingClient, user);
  }

  if (!salonIdentity?.salonId || !salonIdentity?.salonSlug) {
    return NextResponse.json({
      ok: true,
      nextPath: `/${locale}/onboarding/salon-setup`,
      needsOnboarding: true
    });
  }

  await setSalonAdminSession({
    userId: String(user.id),
    salonId: salonIdentity.salonId,
    salonSlug: salonIdentity.salonSlug
  });
  return NextResponse.json({ok: true, nextPath});
}
