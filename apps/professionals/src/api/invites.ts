import type {AuthSession, OwnerContext, Salon, SalonStatus, UserProfile, UserRole} from '../types/models';
import type {RequestActivationInput} from '../types/models';
import {supabase} from './supabase/client';
import {useAuthStore} from '../state/authStore';
import {normalizeSalonStatus, toDbSalonStatus} from '../types/status';
import {pushDevLog} from '../lib/devLogger';
import {env} from '../utils/env';

export type MembershipStatus = 'ACTIVE' | 'REMOVED';

export type Membership = {
  salonId: string;
  userId: string;
  role: UserRole;
  status: MembershipStatus;
  joinedAt: string;
};

type InviteRole = Exclude<UserRole, 'OWNER'>;

export type CreateInviteInput = {
  salonId: string;
  role: InviteRole;
  expiresInHours?: number;
  maxUses?: number;
};

export type CreateInviteResult = {
  code: string;
  role: InviteRole;
  expiresAt?: string | null;
  inviteLink: string;
  webLink: string;
};

export type AcceptInviteInput = {
  token?: string;
  code?: string;
};

export type AcceptInviteResult = {
  salonId: string;
  role: UserRole;
};

export type CreateSalonDraftInput = {
  name: string;
  phone: string;
  locationLabel: string;
  locationAddress: string;
  workdayStart: string;
  workdayEnd: string;
};

function assertClient() {
  if (!supabase) throw new Error('SUPABASE_CONFIG_MISSING');
  return supabase;
}

function normalizeSlug(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function normalizeRole(role: unknown): UserRole {
  const value = String(role || '')
    .trim()
    .toUpperCase();
  if (value === 'OWNER') return 'OWNER';
  if (value === 'MANAGER') return 'MANAGER';
  return 'STAFF';
}

function normalizeStatus(status: unknown): MembershipStatus {
  const value = String(status || '')
    .trim()
    .toUpperCase();
  return value === 'REMOVED' ? 'REMOVED' : 'ACTIVE';
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SESSION_REFRESH_LEEWAY_MS = 2 * 60 * 1000;

function syncStoreSession(session: any) {
  if (!session?.access_token) return;
  const current = useAuthStore.getState().session;
  const setSession = useAuthStore.getState().setSession;
  const payload: AuthSession = {
    accessToken: String(session.access_token),
    refreshToken: String(session.refresh_token || current?.refreshToken || ''),
    userId: String(session.user?.id || current?.userId || ''),
    phone: String(session.user?.phone || session.user?.user_metadata?.phone || current?.phone || ''),
    expiresAt: typeof session.expires_at === 'number' ? Number(session.expires_at) * 1000 : current?.expiresAt
  };
  setSession(payload);
}

function clearStoreSession() {
  useAuthStore.getState().setSession(null);
  useAuthStore.getState().setContext(null);
  useAuthStore.getState().setMemberships([]);
  useAuthStore.getState().setActiveSalonId(null);
}

async function forceLogoutNoSession(reason: string) {
  const client = assertClient();
  if (__DEV__) {
    pushDevLog('error', 'auth.session', 'Supabase session missing; forcing logout', {reason});
  }
  clearStoreSession();
  try {
    await client.auth.signOut();
  } catch {
    // Best effort.
  }
}

function sessionExpiresSoon(session: any) {
  const expiresAt = Number(session?.expires_at || 0) * 1000;
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) return false;
  return expiresAt - Date.now() <= SESSION_REFRESH_LEEWAY_MS;
}

async function getActiveSupabaseSession(options?: {allowRefresh?: boolean}) {
  const client = assertClient();
  let session: any = null;
  let lastError: any = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const {data, error} = await client.auth.getSession();
    if (!error && data.session?.access_token) {
      session = data.session;
      break;
    }
    lastError = error;
    if (attempt < 2) await delay(180);
  }

  if (!session) {
    const cached = useAuthStore.getState().session;
    if (cached?.accessToken && cached?.refreshToken) {
      const restored = await client.auth.setSession({
        access_token: cached.accessToken,
        refresh_token: cached.refreshToken
      });
      if (!restored.error && restored.data.session?.access_token) {
        session = restored.data.session;
        if (__DEV__) {
          pushDevLog('info', 'auth.session', 'Restored runtime Supabase session from persisted auth store tokens');
        }
      } else {
        lastError = restored.error || lastError;
      }
    }
  }

  if (!session && options?.allowRefresh !== false) {
    const refreshed = await client.auth.refreshSession();
    if (!refreshed.error && refreshed.data.session?.access_token) {
      session = refreshed.data.session;
    } else {
      lastError = refreshed.error || lastError;
    }
  }

  if (!session && lastError) throw lastError;

  if (session && options?.allowRefresh !== false && sessionExpiresSoon(session)) {
    const refreshed = await client.auth.refreshSession();
    if (!refreshed.error && refreshed.data.session) {
      session = refreshed.data.session;
    }
  }

  if (!session?.access_token) {
    await forceLogoutNoSession('NO_SESSION');
    throw new Error('NO_SESSION');
  }

  return session;
}

async function readAuthUser() {
  const client = assertClient();
  const session = await getActiveSupabaseSession({allowRefresh: true});
  syncStoreSession(session);
  const userRes = await client.auth.getUser(session.access_token);
  if (userRes.error || !userRes.data.user) {
    const refreshed = await client.auth.refreshSession();
    if (!refreshed.error && refreshed.data.session?.access_token) {
      syncStoreSession(refreshed.data.session);
      const retryUserRes = await client.auth.getUser(refreshed.data.session.access_token);
      if (!retryUserRes.error && retryUserRes.data.user) return retryUserRes.data.user;
    }
    await forceLogoutNoSession('NO_SESSION');
    throw userRes.error || new Error('NO_SESSION');
  }
  return userRes.data.user;
}

function missingColumn(error: unknown, column: string) {
  const message = String((error as any)?.message || (error as any)?.details || '');
  return message.toLowerCase().includes(column.toLowerCase());
}

async function getFunctionErrorMessage(error: any, fallback: string) {
  if (!error) return fallback;

  const context = error?.context;
  if (context && typeof context.json === 'function') {
    try {
      const payload = await context.json();
      const value = String(payload?.error || payload?.message || '').trim();
      if (value) return value;
    } catch {
      // no-op
    }
  }

  if (context && typeof context.text === 'function') {
    try {
      const text = String(await context.text());
      if (text) {
        try {
          const parsed = JSON.parse(text);
          const value = String(parsed?.error || parsed?.message || '').trim();
          if (value) return value;
        } catch {
          return text.slice(0, 120);
        }
      }
    } catch {
      // no-op
    }
  }

  const direct = String(error?.message || '').trim();
  return direct || fallback;
}

function redactPayloadForLog(payload: unknown) {
  if (!payload || typeof payload !== 'object') return payload;
  const raw = payload as Record<string, unknown>;
  const cloned: Record<string, unknown> = {...raw};
  if (typeof cloned.token === 'string' && cloned.token) cloned.token = '***';
  if (typeof cloned.code === 'string' && cloned.code) cloned.code = String(cloned.code).slice(0, 2) + '******';
  return cloned;
}

async function getAccessTokenForApi() {
  const session = await getActiveSupabaseSession({allowRefresh: true});
  syncStoreSession(session);
  const token = String(session.access_token || '').trim();
  if (!token) {
    await forceLogoutNoSession('NO_SESSION');
    throw new Error('NO_SESSION');
  }
  return {
    token,
    source: 'supabase.getSession' as const,
    expiresAt: Number(session.expires_at || 0) * 1000 || null
  };
}

async function restRequest(path: string, init: RequestInit & {token: string}) {
  const url = `${env.supabaseUrl}${path}`;
  const headers: Record<string, string> = {
    apikey: env.supabaseAnonKey,
    Authorization: `Bearer ${init.token}`,
    ...(init.headers as Record<string, string> | undefined),
  };
  const response = await fetch(url, {...init, headers});
  const text = await response.text();
  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text || null;
  }
  return {response, payload};
}

async function invokeEdgeWithLog(functionName: string, body: Record<string, unknown>) {
  const {token, source, expiresAt} = await getAccessTokenForApi();
  if (__DEV__) {
    pushDevLog('info', 'edge.invoke', `Invoking ${functionName}`, {
      functionName,
      body: redactPayloadForLog(body),
      hasAccessToken: true,
      tokenSource: source,
      tokenLength: token.length,
      expiresAt,
    });
  }
  let attempt = 0;
  let invoke = await restRequest(`/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
    token,
  });
  if (invoke.response.status === 401) {
    attempt = 1;
    const client = assertClient();
    const refreshed = await client.auth.refreshSession();
    const refreshedToken = String(refreshed.data.session?.access_token || '').trim();
    if (refreshedToken) {
      syncStoreSession(refreshed.data.session);
      if (__DEV__) {
        pushDevLog('info', 'edge.invoke', `Retrying ${functionName} after 401 with refreshed session`, {
          functionName,
          tokenSource: 'supabase.getSession',
          tokenLength: refreshedToken.length,
          expiresAt: Number(refreshed.data.session?.expires_at || 0) * 1000 || null
        });
      }
      invoke = await restRequest(`/functions/v1/${functionName}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
        token: refreshedToken,
      });
    } else {
      if (__DEV__) {
        pushDevLog('warn', 'edge.invoke', `Refresh session unavailable after 401 from ${functionName}`, {
          functionName,
          tokenSource: source,
        });
      }
    }
  }

  const ok = invoke.response.ok;
  const result = {
    data: ok ? invoke.payload : null,
    error: ok ? null : {message: String(invoke.payload?.error || invoke.payload?.message || `HTTP_${invoke.response.status}`)},
    status: invoke.response.status,
  };
  if (__DEV__) {
    pushDevLog(result.error || !result.data?.ok ? 'error' : 'info', 'edge.invoke', `Result ${functionName}`, {
      functionName,
      status: invoke.response.status,
      data: result.data ?? null,
      error: result.error ? String(result.error?.message || result.error) : null,
      tokenSource: source,
      attempts: attempt + 1,
    });
  }
  return result;
}

export async function upsertUserProfileV2(params?: {phone?: string; fullName?: string}) {
  const user = await readAuthUser();
  const {token, source} = await getAccessTokenForApi();
  const payload = {
    user_id: user.id,
    phone: params?.phone ?? user.phone ?? null,
    full_name: params?.fullName ?? null,
    last_active_at: new Date().toISOString()
  };
  const {response, payload: resPayload} = await restRequest('/rest/v1/user_profiles?on_conflict=user_id', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(payload),
    token,
  });
  if (!response.ok) {
    if (__DEV__) {
      pushDevLog('error', 'db.user_profiles.upsert', 'Failed to upsert user profile', {
        error: String(resPayload?.message || resPayload?.code || 'unknown'),
        status: response.status,
        tokenSource: source,
      });
    }
    throw new Error(String(resPayload?.message || resPayload?.code || 'USER_PROFILE_UPSERT_FAILED'));
  }
}

export async function listActiveMembershipsV2(): Promise<Membership[]> {
  const user = await readAuthUser();
  const {token, source} = await getAccessTokenForApi();
  let lastError: any = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const {response, payload} = await restRequest(
      `/rest/v1/salon_members?select=salon_id,user_id,role,status,joined_at&user_id=eq.${encodeURIComponent(user.id)}&status=eq.ACTIVE&order=joined_at.desc`,
      {
        method: 'GET',
        token
      }
    );

    if (response.ok && Array.isArray(payload)) {
      return payload.map((row: any) => ({
        salonId: String(row.salon_id),
        userId: String(row.user_id),
        role: normalizeRole(row.role),
        status: normalizeStatus(row.status),
        joinedAt: String(row.joined_at || new Date().toISOString())
      }));
    }

    lastError = payload || new Error(`HTTP_${response.status}`);
    if (__DEV__) {
      pushDevLog('error', 'db.salon_members.select', 'Failed to fetch active memberships', {
        attempt: attempt + 1,
        error: String(payload?.message || payload?.code || `HTTP_${response.status}`),
        status: response.status,
        tokenSource: source,
      });
    }
    if (attempt < 2) await delay(220);
  }

  throw lastError || new Error('MEMBERSHIP_LOAD_FAILED');
}

export async function getUserProfileFromAuth(): Promise<UserProfile> {
  const user = await readAuthUser();
  const displayName =
    String(user.user_metadata?.full_name || user.user_metadata?.display_name || '').trim() ||
    (user.phone ? user.phone : 'Owner');
  return {
    id: String(user.id),
    phone: String(user.phone || user.user_metadata?.phone || ''),
    displayName,
    role: 'OWNER',
    salonId: null,
    createdAt: String(user.created_at || new Date().toISOString())
  };
}

function mapSalonRowToContext(row: any, user: UserProfile): OwnerContext {
  const salon: Salon = {
    id: String(row.id),
    ownerId: user.id,
    name: String(row.name || 'Salon'),
    slug: String(row.slug || ''),
    phone: String(row.whatsapp || ''),
    locationLabel: String(row.area || row.city || ''),
    locationAddress: String(row.address || row.area || ''),
    status: normalizeSalonStatus(row.status),
    workdayStart: '08:00',
    workdayEnd: '22:00',
    publicBookingUrl: row.slug ? `/s/${row.slug}` : undefined,
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || row.created_at || new Date().toISOString())
  };
  return {user: {...user, salonId: salon.id}, salon};
}

export async function getOwnerContextBySalonIdV2(salonId: string | null): Promise<OwnerContext> {
  const user = await getUserProfileFromAuth();
  if (!salonId) return {user, salon: null};
  const {token, source} = await getAccessTokenForApi();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const {response, payload} = await restRequest(
      `/rest/v1/salons?select=id,name,slug,whatsapp,status,area,address,city,created_at,updated_at&id=eq.${encodeURIComponent(salonId)}&limit=1`,
      {
        method: 'GET',
        token
      }
    );
    const row = Array.isArray(payload) ? payload[0] : null;
    if (response.ok && row) return mapSalonRowToContext(row, user);
    if (__DEV__) {
      pushDevLog('error', 'db.salons.select', 'Failed to fetch owner context salon', {
        attempt: attempt + 1,
        salonId,
        error: String(payload?.message || payload?.code || `HTTP_${response.status}`),
        status: response.status,
        tokenSource: source,
      });
    }
    if (attempt < 2) await delay(220);
  }

  return {user, salon: null};
}

export async function createSalonDraftV2(input: CreateSalonDraftInput): Promise<Salon> {
  const client = assertClient();
  const user = await getUserProfileFromAuth();

  const slugBase = normalizeSlug(input.name) || `salon-${Date.now().toString(36)}`;
  const generatedPasscode = String(input.phone || '').replace(/\D/g, '').slice(-6) || '123456';

  let payload: Record<string, unknown> = {
    name: input.name.trim(),
    slug: slugBase,
    area: input.locationAddress || input.locationLabel || null,
    address: input.locationAddress || null,
    city: input.locationLabel || null,
    whatsapp: input.phone,
    timezone: 'Asia/Baghdad',
    admin_passcode: generatedPasscode,
    status: toDbSalonStatus('DRAFT' as SalonStatus),
    created_by: user.id,
    is_public: false,
    is_active: true
  };

  let insert = await client.from('salons').insert(payload as any).select('id,name,slug,whatsapp,status,area,address,city,created_at,updated_at').single();

  if (insert.error && missingColumn(insert.error, 'created_by')) {
    const {created_by: _drop, ...fallback} = payload;
    payload = fallback;
    insert = await client.from('salons').insert(payload as any).select('id,name,slug,whatsapp,status,area,address,city,created_at,updated_at').single();
  }

  if (insert.error && missingColumn(insert.error, 'address')) {
    const {address: _dropAddress, city: _dropCity, ...fallback} = payload;
    payload = fallback;
    insert = await client.from('salons').insert(payload as any).select('id,name,slug,whatsapp,status,area,address,city,created_at,updated_at').single();
  }

  if (insert.error || !insert.data?.id) {
    throw insert.error || new Error('SALON_CREATE_FAILED');
  }

  const context = mapSalonRowToContext(insert.data, user);
  return context.salon!;
}

export async function requestSalonActivationV2(salonId: string, input: RequestActivationInput): Promise<Salon> {
  const client = assertClient();
  await readAuthUser();
  const payload = {
    salon_id: salonId,
    submitted_data: {
      whatsapp: null,
      city: input.city || null,
      area: input.area || null,
      address_mode: input.addressMode,
      address_text: input.addressText || null,
      location_lat: input.locationLat ?? null,
      location_lng: input.locationLng ?? null,
      location_accuracy_m: input.locationAccuracyM ?? null,
      location_label: input.locationLabel || null,
      instagram: input.instagram || null,
      photo_url: input.storefrontPhotoUrl || null
    }
  };

  const req = await invokeEdgeWithLog('request-activation', payload);
  if (req.error || !req.data?.ok) {
    if (req.error) {
      throw new Error(await getFunctionErrorMessage(req.error, 'REQUEST_FAILED'));
    }
    throw new Error(String(req.data?.error || 'REQUEST_FAILED'));
  }

  const user = await getUserProfileFromAuth();
  const refreshed = await client
    .from('salons')
    .select('id,name,slug,whatsapp,status,area,address,city,created_at,updated_at')
    .eq('id', salonId)
    .single();
  if (refreshed.error || !refreshed.data) throw refreshed.error || new Error('REQUEST_FAILED');
  return mapSalonRowToContext(refreshed.data, user).salon!;
}

export async function createInvite(input: CreateInviteInput): Promise<CreateInviteResult> {
  const client = assertClient();
  await readAuthUser();
  const payload = {
    salon_id: input.salonId,
    role: input.role,
    expires_in_hours: input.expiresInHours,
    max_uses: input.maxUses
  };
  const {data, error} = await invokeEdgeWithLog('create-invite', payload);
  if (error) throw new Error(await getFunctionErrorMessage(error, 'INVITE_CREATE_FAILED'));
  if (!data?.ok) throw new Error(String(data?.error || 'INVITE_CREATE_FAILED'));
  return {
    code: String(data.code || ''),
    role: normalizeRole(data.role) as InviteRole,
    expiresAt: data.expires_at ? String(data.expires_at) : null,
    inviteLink: String(data.invite_link || ''),
    webLink: String(data.web_link || '')
  };
}

export async function acceptInvite(input: AcceptInviteInput): Promise<AcceptInviteResult> {
  const client = assertClient();
  await readAuthUser();
  const payload = {
    token: input.token || undefined,
    code: input.code ? String(input.code).trim().toUpperCase() : undefined
  };
  const {data, error} = await invokeEdgeWithLog('accept-invite', payload);
  if (error) throw new Error(await getFunctionErrorMessage(error, 'INVALID_INVITE'));
  if (!data?.ok) throw new Error(String(data?.error || 'INVALID_INVITE'));
  return {
    salonId: String(data.salon_id || ''),
    role: normalizeRole(data.role)
  };
}
