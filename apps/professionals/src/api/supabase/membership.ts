import type {UserRole} from '../../types/models';
import {supabase} from './client';

export type SalonMemberStatus = 'ACTIVE' | 'REMOVED';

export type SalonMembership = {
  salonId: string;
  userId: string;
  role: UserRole;
  status: SalonMemberStatus;
  joinedAt: string;
  removedAt?: string | null;
};

export type CreateInviteInput = {
  salonId: string;
  role: Exclude<UserRole, 'OWNER'>;
  expiresInHours?: number;
  maxUses?: number;
};

export type CreateInviteResult = {
  code: string;
  role: Exclude<UserRole, 'OWNER'>;
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

function assertClient() {
  if (!supabase) throw new Error('SUPABASE_CONFIG_MISSING');
  return supabase;
}

function normalizeRole(role: unknown): UserRole {
  const value = String(role || '').trim().toUpperCase();
  if (value === 'OWNER') return 'OWNER';
  if (value === 'MANAGER') return 'MANAGER';
  return 'STAFF';
}

function normalizeStatus(status: unknown): SalonMemberStatus {
  return String(status || '').trim().toUpperCase() === 'REMOVED' ? 'REMOVED' : 'ACTIVE';
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

export async function upsertMyProfile(params: {phone?: string; fullName?: string}) {
  const client = assertClient();
  const userRes = await client.auth.getUser();
  const user = userRes.data.user;
  if (userRes.error || !user?.id) throw userRes.error || new Error('UNAUTHORIZED');

  const payload = {
    user_id: user.id,
    phone: params.phone ?? user.phone ?? null,
    full_name: params.fullName ?? null,
    last_active_at: new Date().toISOString(),
  };

  const {error} = await client.from('user_profiles').upsert(payload, {onConflict: 'user_id'});
  if (error) throw error;
}

export async function listMyActiveMemberships(): Promise<SalonMembership[]> {
  const client = assertClient();
  const userRes = await client.auth.getUser();
  const user = userRes.data.user;
  if (userRes.error || !user?.id) throw userRes.error || new Error('UNAUTHORIZED');

  const {data, error} = await client
    .from('salon_members')
    .select('salon_id,user_id,role,status,joined_at,removed_at')
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .order('joined_at', {ascending: false});

  if (error) throw error;
  return (data || []).map((row: any) => ({
    salonId: String(row.salon_id),
    userId: String(row.user_id),
    role: normalizeRole(row.role),
    status: normalizeStatus(row.status),
    joinedAt: String(row.joined_at || new Date().toISOString()),
    removedAt: row.removed_at ? String(row.removed_at) : null,
  }));
}

export async function createInvite(input: CreateInviteInput): Promise<CreateInviteResult> {
  const client = assertClient();
  const body = {
    salon_id: input.salonId,
    role: input.role,
    expires_in_hours: input.expiresInHours,
    max_uses: input.maxUses,
  };
  const {data, error} = await client.functions.invoke('create-invite', {body});
  if (error) throw new Error(await getFunctionErrorMessage(error, 'INVITE_CREATE_FAILED'));
  if (!data?.ok) throw new Error(String(data?.error || 'INVITE_CREATE_FAILED'));

  return {
    code: String(data.code || ''),
    role: normalizeRole(data.role) as Exclude<UserRole, 'OWNER'>,
    expiresAt: data.expires_at ? String(data.expires_at) : null,
    inviteLink: String(data.invite_link || ''),
    webLink: String(data.web_link || ''),
  };
}

export async function acceptInvite(input: AcceptInviteInput): Promise<AcceptInviteResult> {
  const client = assertClient();
  const body = {
    token: input.token || undefined,
    code: input.code || undefined,
  };
  const {data, error} = await client.functions.invoke('accept-invite', {body});
  if (error) throw new Error(await getFunctionErrorMessage(error, 'INVITE_ACCEPT_FAILED'));
  if (!data?.ok) throw new Error(String(data?.error || 'INVITE_ACCEPT_FAILED'));

  return {
    salonId: String(data.salon_id || ''),
    role: normalizeRole(data.role),
  };
}
