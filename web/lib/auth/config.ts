export function getSuperadminCode(): string {
  return String(
    process.env.VITE_SUPERADMIN_CODE ||
      process.env.VITE_SUPER_ADMIN_CODE ||
      process.env.VITE_SUPER_ADMIN ||
      process.env.VITE_SUPER_ADMIN_PASSCODE ||
    process.env.NEXT_PUBLIC_SUPERADMIN_CODE ||
      process.env.NEXT_PUBLIC_SUPER_ADMIN_CODE ||
      process.env.NEXT_PUBLIC_SUPER_ADMIN ||
      process.env.NEXT_PUBLIC_SUPER_ADMIN_PASSCODE ||
      process.env.SUPER_ADMIN_CODE ||
      process.env.SUPER_ADMIN ||
      process.env.SUPER_ADMIN_PASSCODE ||
      process.env.SUPERADMIN_CODE ||
      '1989'
  ).trim();
}
