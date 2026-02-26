import 'server-only';

import {cookies} from 'next/headers';
import {
  AUTH_ROLE_COOKIE,
  AUTH_USER_ID_COOKIE,
  AUTH_SALON_ID_COOKIE,
  AUTH_SALON_SLUG_COOKIE,
  isWebAuthRole,
  type WebAuthRole
} from '@/lib/auth/session';

export type WebAuthSession = {
  role: WebAuthRole;
  userId: string | null;
  salonId: string | null;
  salonSlug: string | null;
};

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 12
};

export async function readAuthSession(): Promise<WebAuthSession | null> {
  const jar = await cookies();
  const role = jar.get(AUTH_ROLE_COOKIE)?.value;
  if (!isWebAuthRole(role)) return null;

  return {
    role,
    userId: jar.get(AUTH_USER_ID_COOKIE)?.value || null,
    salonId: jar.get(AUTH_SALON_ID_COOKIE)?.value || null,
    salonSlug: jar.get(AUTH_SALON_SLUG_COOKIE)?.value || null
  };
}

export async function setSalonAdminSession(input: {userId?: string; salonId: string; salonSlug: string}) {
  const jar = await cookies();
  jar.set(AUTH_ROLE_COOKIE, 'salon_admin', COOKIE_OPTIONS);
  if (String(input.userId || '').trim()) {
    jar.set(AUTH_USER_ID_COOKIE, String(input.userId), COOKIE_OPTIONS);
  } else {
    jar.delete(AUTH_USER_ID_COOKIE);
  }
  jar.set(AUTH_SALON_ID_COOKIE, input.salonId, COOKIE_OPTIONS);
  jar.set(AUTH_SALON_SLUG_COOKIE, input.salonSlug, COOKIE_OPTIONS);
}

export async function setSuperadminSession(input?: {userId?: string}) {
  const jar = await cookies();
  jar.set(AUTH_ROLE_COOKIE, 'superadmin', COOKIE_OPTIONS);
  if (String(input?.userId || '').trim()) {
    jar.set(AUTH_USER_ID_COOKIE, String(input?.userId), COOKIE_OPTIONS);
  } else {
    jar.delete(AUTH_USER_ID_COOKIE);
  }
  jar.delete(AUTH_SALON_ID_COOKIE);
  jar.delete(AUTH_SALON_SLUG_COOKIE);
}

export async function clearAuthSession() {
  const jar = await cookies();
  jar.delete(AUTH_ROLE_COOKIE);
  jar.delete(AUTH_USER_ID_COOKIE);
  jar.delete(AUTH_SALON_ID_COOKIE);
  jar.delete(AUTH_SALON_SLUG_COOKIE);
}
