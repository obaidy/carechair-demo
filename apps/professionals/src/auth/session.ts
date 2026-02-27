import {api} from '../api';
import {acceptInvite, getOwnerContextBySalonIdV2, listActiveMembershipsV2, type Membership, upsertUserProfileV2} from '../api/invites';
import {flags} from '../config/flags';
import {secureGet, secureRemove, secureSet} from '../utils/secureStore';
import type {AuthSession, OwnerContext} from '../types/models';
import {env} from '../utils/env';
import {pushDevLog} from '../lib/devLogger';
import {useAuthStore} from '../state/authStore';

const ACTIVE_SALON_KEY = 'cc_prof_active_salon_id';
const PENDING_JOIN_TOKEN_KEY = 'cc_prof_pending_join_token';

export type HydratedAuthState = {
  session: AuthSession;
  context: OwnerContext;
  memberships: Membership[];
  activeSalonId: string | null;
};

export async function readActiveSalonId() {
  return secureGet(ACTIVE_SALON_KEY);
}

export async function persistActiveSalonId(salonId: string) {
  await secureSet(ACTIVE_SALON_KEY, salonId);
}

export async function clearActiveSalonId() {
  await secureRemove(ACTIVE_SALON_KEY);
}

export async function readPendingJoinToken() {
  return secureGet(PENDING_JOIN_TOKEN_KEY);
}

export async function persistPendingJoinToken(token: string) {
  if (!token) return;
  await secureSet(PENDING_JOIN_TOKEN_KEY, token);
}

export async function consumePendingJoinToken() {
  const token = await readPendingJoinToken();
  if (token) await secureRemove(PENDING_JOIN_TOKEN_KEY);
  return token;
}

export async function clearPendingJoinToken() {
  await secureRemove(PENDING_JOIN_TOKEN_KEY);
}

export function extractJoinTokenFromUrl(url: string | null | undefined) {
  const value = String(url || '').trim();
  if (!value) return null;
  try {
    const parsed = new URL(value);
    const path = parsed.pathname.toLowerCase();
    if (!path.includes('join') && parsed.protocol !== 'carechair:') return null;
    const token = parsed.searchParams.get('token');
    return token ? token.trim() : null;
  } catch {
    const match = /[?&]token=([^&#]+)/i.exec(value);
    return match?.[1] ? decodeURIComponent(match[1]).trim() : null;
  }
}

async function selectActiveSalon(memberships: Membership[]) {
  if (memberships.length === 0) {
    await clearActiveSalonId();
    return null;
  }
  if (memberships.length === 1) {
    const one = memberships[0].salonId;
    await persistActiveSalonId(one);
    return one;
  }
  const saved = await readActiveSalonId();
  if (saved && memberships.some((member) => member.salonId === saved)) return saved;
  return null;
}

export async function hydrateAuthState(options?: {pendingToken?: string | null; acceptPendingToken?: boolean}): Promise<HydratedAuthState | null> {
  const liveSession = await api.auth.getSession();
  const cachedSession = useAuthStore.getState().session;
  const session = liveSession || cachedSession;
  if (__DEV__ && !liveSession && cachedSession) {
    pushDevLog('info', 'auth.hydrate', 'Recovered session from in-memory store fallback', {
      userId: cachedSession.userId,
    });
  }
  if (!session) return null;

  const useLegacyIdentity = !flags.USE_INVITES_V2 && env.useMockApi;
  if (useLegacyIdentity) {
    const context = await api.owner.getContext();
    return {
      session,
      context,
      memberships: context.salon
        ? [
            {
              salonId: context.salon.id,
              userId: context.user.id,
              role: context.user.role,
              status: 'ACTIVE' as const,
              joinedAt: context.salon.createdAt
            }
          ]
        : [],
      activeSalonId: context.salon?.id || null
    };
  }

  await upsertUserProfileV2({phone: session.phone});

  const pendingTokenFromStorage = options?.pendingToken ?? (await readPendingJoinToken());
  if (options?.acceptPendingToken !== false && pendingTokenFromStorage) {
    try {
      await acceptInvite({token: pendingTokenFromStorage});
      await clearPendingJoinToken();
    } catch {
      // Prevent retry loops on bad/expired tokens.
      await clearPendingJoinToken();
    }
  }

  const memberships = await listActiveMembershipsV2();
  const activeSalonId = await selectActiveSalon(memberships);
  const context = await getOwnerContextBySalonIdV2(activeSalonId);

  return {
    session,
    context,
    memberships,
    activeSalonId
  };
}

export async function logoutSession() {
  try {
    await api.auth.signOut();
  } finally {
    await clearActiveSalonId();
    await clearPendingJoinToken();
  }
}
