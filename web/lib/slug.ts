export function normalizeSlug(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9\-\u0600-\u06FF\u0400-\u04FF\u0100-\u017F]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function slugEquals(a: string, b: string): boolean {
  return normalizeSlug(a) === normalizeSlug(b);
}

export function decodePathPart(value: string): string {
  try {
    return decodeURIComponent(value || '');
  } catch {
    return String(value || '');
  }
}
