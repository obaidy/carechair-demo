export type WebAuthRole = 'salon_admin' | 'superadmin';

export const AUTH_ROLE_COOKIE = 'cc_web_role';
export const AUTH_SALON_ID_COOKIE = 'cc_web_salon_id';
export const AUTH_SALON_SLUG_COOKIE = 'cc_web_salon_slug';
export const AUTH_USER_ID_COOKIE = 'cc_web_user_id';

export function isWebAuthRole(value: string | null | undefined): value is WebAuthRole {
  return value === 'salon_admin' || value === 'superadmin';
}

export function roleForPath(pathWithoutLocale: string): WebAuthRole | null {
  if (pathWithoutLocale === '/app' || pathWithoutLocale.startsWith('/app/')) return 'salon_admin';
  if (pathWithoutLocale === '/sa' || pathWithoutLocale.startsWith('/sa/')) return 'superadmin';
  return null;
}

export function canAccessRoute(role: WebAuthRole, required: WebAuthRole): boolean {
  return role === required;
}
