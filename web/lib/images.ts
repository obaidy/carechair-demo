const DEFAULT_BUCKET = 'carechair-media';

const IMAGE_FALLBACKS = {
  hero: '/images/default/hero-1.jpg',
  cover: '/images/default/hero-1.jpg',
  gallery: '/images/default/gallery-1.jpg',
  logo: '/images/brand/carechair-mark.png',
  service: '/images/default/service-facial.jpg',
  staff: '/images/avatars/avatar-1.png'
} as const;

export type ImageFallbackKey = keyof typeof IMAGE_FALLBACKS;

export function getImageFallback(fallbackKey?: ImageFallbackKey): string {
  if (!fallbackKey) return IMAGE_FALLBACKS.cover;
  return IMAGE_FALLBACKS[fallbackKey] || IMAGE_FALLBACKS.cover;
}

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function splitStorageTarget(value: string): {bucket: string; path: string} | null {
  const trimmed = String(value || '').trim().replace(/^\/+/, '');
  if (!trimmed) return null;

  if (trimmed.startsWith('storage/v1/object/public/')) {
    const rest = trimmed.slice('storage/v1/object/public/'.length);
    const [bucket, ...parts] = rest.split('/').filter(Boolean);
    if (!bucket || parts.length === 0) return null;
    return {bucket, path: parts.join('/')};
  }

  const [first, ...parts] = trimmed.split('/').filter(Boolean);
  if (!first || parts.length === 0) return null;

  if (first.includes('.')) {
    return {bucket: DEFAULT_BUCKET, path: trimmed};
  }

  if (first === 'salons' || first === 'staff' || first === 'services' || first === 'uploads' || first === 'media') {
    return {bucket: DEFAULT_BUCKET, path: trimmed};
  }

  return {bucket: first, path: parts.join('/')};
}

export function encodeStoragePath(path: string): string {
  return path
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

export function getPublicStorageUrl(bucket: string, path: string): string | null {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  if (!url) return null;
  const safeBase = url.endsWith('/') ? url.slice(0, -1) : url;
  return `${safeBase}/storage/v1/object/public/${bucket}/${encodeStoragePath(path)}`;
}

export function resolveImageSrc(input: string | null | undefined, fallbackKey?: ImageFallbackKey): string {
  const fallback = getImageFallback(fallbackKey);
  const raw = String(input || '').trim();
  if (!raw) return fallback;

  if (isHttpUrl(raw)) return raw;
  if (raw.startsWith('/')) return raw;

  const target = splitStorageTarget(raw);
  if (!target) return fallback;

  return getPublicStorageUrl(target.bucket, target.path) || fallback;
}
