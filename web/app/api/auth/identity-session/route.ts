import {NextRequest, NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {setSalonAdminSession, setSuperadminSession} from '@/lib/auth/server';
import {getSupabaseConfig} from '@/lib/supabase/config';

type WebRole = 'salon_admin' | 'superadmin';

type SalonIdentity = {
  salonId: string;
  salonSlug: string;
};

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

function readPreferredSalonIdFromMetadata(user: any): string {
  const appMeta = user?.app_metadata || {};
  const userMeta = user?.user_metadata || {};
  return String(appMeta.salon_id || appMeta.salonId || userMeta.salon_id || userMeta.salonId || '').trim();
}

function missingRelation(error: unknown, relationName: string): boolean {
  const code = String((error as {code?: string})?.code || '').toLowerCase();
  const message = String((error as {message?: string})?.message || '').toLowerCase();
  return code === '42p01' || (message.includes('relation') && message.includes(relationName.toLowerCase()));
}

async function resolveSalonById(client: ReturnType<typeof createClient<any>>, salonId: string): Promise<SalonIdentity | null> {
  if (!salonId) return null;
  const {data, error} = await client.from('salons').select('id,slug').eq('id', salonId).maybeSingle();
  if (error || !data?.id || !data?.slug) return null;
  return {salonId: String(data.id), salonSlug: String(data.slug)};
}

async function listActiveMembershipSalonIds(client: ReturnType<typeof createClient<any>>, userId: string): Promise<string[]> {
  const salonIds = new Set<string>();

  const v2Res = await client
    .from('salon_members')
    .select('salon_id,role,status,joined_at')
    .eq('user_id', userId)
    .eq('status', 'ACTIVE')
    .in('role', ['OWNER', 'MANAGER', 'STAFF'])
    .order('joined_at', {ascending: false})
    .limit(20);

  if (!v2Res.error && Array.isArray(v2Res.data)) {
    for (const row of v2Res.data) {
      const salonId = String((row as any)?.salon_id || '').trim();
      if (salonId) salonIds.add(salonId);
    }
    return Array.from(salonIds);
  }

  if (!missingRelation(v2Res.error, 'salon_members')) {
    return [];
  }

  const legacyRes = await client
    .from('salon_memberships')
    .select('salon_id,role,status')
    .eq('user_id', userId)
    .in('role', ['owner', 'admin', 'salon_admin'])
    .limit(20);

  if (legacyRes.error || !Array.isArray(legacyRes.data)) return [];
  for (const row of legacyRes.data) {
    const salonId = String((row as any)?.salon_id || '').trim();
    if (salonId) salonIds.add(salonId);
  }
  return Array.from(salonIds);
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
  const lookupClient = serviceKey
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

  const memberships = await listActiveMembershipSalonIds(lookupClient, String(user.id));
  if (!memberships.length) {
    return NextResponse.json({
      ok: true,
      nextPath: `/${locale}/onboarding/salon-setup`,
      needsOnboarding: true
    });
  }

  const preferredSalonId = readPreferredSalonIdFromMetadata(user);
  const chosenSalonId = preferredSalonId && memberships.includes(preferredSalonId) ? preferredSalonId : memberships[0];
  const salonIdentity = await resolveSalonById(lookupClient, chosenSalonId);

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
