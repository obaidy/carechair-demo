import type {AuthSession, OwnerContext, Salon, SalonStatus, UserProfile, UserRole} from '../types/models';
import type {RequestActivationInput} from '../types/models';
import {supabase} from './supabase/client';
import {useAuthStore} from '../state/authStore';

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

function toSalonStatus(input: unknown): SalonStatus {
  const value = String(input || '')
    .trim()
    .toLowerCase();
  if (value === 'active' || value === 'trialing' || value === 'past_due') return 'ACTIVE';
  if (value === 'suspended') return 'SUSPENDED';
  if (value === 'pending_review' || value === 'pending_approval') return 'PENDING_REVIEW';
  return 'DRAFT';
}

function toDbSalonStatus(status: SalonStatus) {
  if (status === 'PENDING_REVIEW') return 'pending_approval';
  if (status === 'ACTIVE') return 'active';
  if (status === 'SUSPENDED') return 'suspended';
  return 'draft';
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function readAuthUser() {
  const client = assertClient();
  const cached = useAuthStore.getState().session;

  const fromSession = await client.auth.getSession();
  if (!fromSession.error && fromSession.data.session?.access_token) {
    const bySession = await client.auth.getUser(fromSession.data.session.access_token);
    if (!bySession.error && bySession.data.user) {
      syncStoreSession(fromSession.data.session);
      return bySession.data.user;
    }

    // Force refresh if stored access token is stale.
    if (fromSession.data.session.refresh_token) {
      const refreshed = await client.auth.setSession({
        access_token: fromSession.data.session.access_token,
        refresh_token: fromSession.data.session.refresh_token
      });
      if (!refreshed.error && refreshed.data.session?.access_token) {
        const byRefreshed = await client.auth.getUser(refreshed.data.session.access_token);
        if (!byRefreshed.error && byRefreshed.data.user) {
          syncStoreSession(refreshed.data.session);
          return byRefreshed.data.user;
        }
      }
    }
  }

  // Force SDK re-hydration from the latest verified OTP tokens when available.
  if (cached?.accessToken && cached?.refreshToken) {
    const restored = await client.auth.setSession({
      access_token: cached.accessToken,
      refresh_token: cached.refreshToken
    });
    if (!restored.error && restored.data.session?.access_token) {
      const byRestored = await client.auth.getUser(restored.data.session.access_token);
      if (!byRestored.error && byRestored.data.user) {
        syncStoreSession(restored.data.session);
        return byRestored.data.user;
      }
    }
  }

  const first = await client.auth.getUser();
  if (!first.error && first.data.user) {
    const currentSession = await client.auth.getSession();
    if (!currentSession.error && currentSession.data.session) {
      syncStoreSession(currentSession.data.session);
    }
    return first.data.user;
  }

  const message = String(first.error?.message || '').toLowerCase();

  // Expo hot reloads can lose in-memory session. Restore from cached tokens.
  if (message.includes('session') && cached?.accessToken && cached?.refreshToken) {
    const restored = await client.auth.setSession({
      access_token: cached.accessToken,
      refresh_token: cached.refreshToken
    });
    if (!restored.error) {
      const second = await client.auth.getUser();
      if (!second.error && second.data.user) return second.data.user;
      throw second.error || new Error('UNAUTHORIZED');
    }
  }

  throw first.error || new Error('UNAUTHORIZED');
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

export async function upsertUserProfileV2(params?: {phone?: string; fullName?: string}) {
  const client = assertClient();
  const user = await readAuthUser();
  const payload = {
    user_id: user.id,
    phone: params?.phone ?? user.phone ?? null,
    full_name: params?.fullName ?? null,
    last_active_at: new Date().toISOString()
  };
  const {error} = await client.from('user_profiles').upsert(payload, {onConflict: 'user_id'});
  if (error) throw error;
}

export async function listActiveMembershipsV2(): Promise<Membership[]> {
  const client = assertClient();
  const user = await readAuthUser();
  let lastError: any = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const {data, error} = await client
      .from('salon_members')
      .select('salon_id,user_id,role,status,joined_at')
      .eq('user_id', user.id)
      .eq('status', 'ACTIVE')
      .order('joined_at', {ascending: false});

    if (!error) {
      return (data || []).map((row: any) => ({
        salonId: String(row.salon_id),
        userId: String(row.user_id),
        role: normalizeRole(row.role),
        status: normalizeStatus(row.status),
        joinedAt: String(row.joined_at || new Date().toISOString())
      }));
    }

    lastError = error;
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
    status: toSalonStatus(row.status),
    workdayStart: '08:00',
    workdayEnd: '22:00',
    publicBookingUrl: row.slug ? `/s/${row.slug}` : undefined,
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || row.created_at || new Date().toISOString())
  };
  return {user: {...user, salonId: salon.id}, salon};
}

export async function getOwnerContextBySalonIdV2(salonId: string | null): Promise<OwnerContext> {
  const client = assertClient();
  const user = await getUserProfileFromAuth();
  if (!salonId) return {user, salon: null};

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const {data, error} = await client
      .from('salons')
      .select('id,name,slug,whatsapp,status,area,address,city,created_at,updated_at')
      .eq('id', salonId)
      .maybeSingle();
    if (!error && data) return mapSalonRowToContext(data, user);
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
    status: toDbSalonStatus('DRAFT'),
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

  const req = await client.functions.invoke('request-activation', {body: payload});
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
  const {data, error} = await client.functions.invoke('create-invite', {
    body: {
      salon_id: input.salonId,
      role: input.role,
      expires_in_hours: input.expiresInHours,
      max_uses: input.maxUses
    }
  });
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
  const {data, error} = await client.functions.invoke('accept-invite', {body: payload});
  if (error) throw new Error(await getFunctionErrorMessage(error, 'INVALID_INVITE'));
  if (!data?.ok) throw new Error(String(data?.error || 'INVALID_INVITE'));
  return {
    salonId: String(data.salon_id || ''),
    role: normalizeRole(data.role)
  };
}
