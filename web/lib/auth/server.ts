import 'server-only';

import {cookies} from 'next/headers';
import {
  AUTH_ROLE_COOKIE,
  AUTH_SALON_ID_COOKIE,
  AUTH_SALON_SLUG_COOKIE,
  isWebAuthRole,
  type WebAuthRole
} from '@/lib/auth/session';

export type WebAuthSession = {
  role: WebAuthRole;
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
    salonId: jar.get(AUTH_SALON_ID_COOKIE)?.value || null,
    salonSlug: jar.get(AUTH_SALON_SLUG_COOKIE)?.value || null
  };
}

export async function setSalonAdminSession(input: {salonId: string; salonSlug: string}) {
  const jar = await cookies();
  jar.set(AUTH_ROLE_COOKIE, 'salon_admin', COOKIE_OPTIONS);
  jar.set(AUTH_SALON_ID_COOKIE, input.salonId, COOKIE_OPTIONS);
  jar.set(AUTH_SALON_SLUG_COOKIE, input.salonSlug, COOKIE_OPTIONS);
}

export async function setSuperadminSession() {
  const jar = await cookies();
  jar.set(AUTH_ROLE_COOKIE, 'superadmin', COOKIE_OPTIONS);
  jar.delete(AUTH_SALON_ID_COOKIE);
  jar.delete(AUTH_SALON_SLUG_COOKIE);
}

export async function clearAuthSession() {
  const jar = await cookies();
  jar.delete(AUTH_ROLE_COOKIE);
  jar.delete(AUTH_SALON_ID_COOKIE);
  jar.delete(AUTH_SALON_SLUG_COOKIE);
}
