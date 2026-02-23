const MAPBOX_STATIC_BASE = 'https://api.mapbox.com/styles/v1/mapbox/streets-v12/static';

function toFiniteNumber(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function normalizeLatitude(value: unknown): number | null {
  const num = toFiniteNumber(value);
  if (num == null || num < -90 || num > 90) return null;
  return Number(num.toFixed(6));
}

export function normalizeLongitude(value: unknown): number | null {
  const num = toFiniteNumber(value);
  if (num == null || num < -180 || num > 180) return null;
  return Number(num.toFixed(6));
}

export function formatAddress(location: {
  formatted_address?: string | null;
  address_line?: string | null;
  city?: string | null;
  country_code?: string | null;
} | null): string {
  if (!location) return '';

  const formatted = String(location.formatted_address || '').trim();
  if (formatted) return formatted;

  return [location.address_line, location.city, location.country_code]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .join(', ');
}

export function buildGoogleDirectionsUrl(lat: unknown, lng: unknown): string {
  const safeLat = normalizeLatitude(lat);
  const safeLng = normalizeLongitude(lng);
  if (safeLat == null || safeLng == null) return '';
  return `https://www.google.com/maps/search/?api=1&query=${safeLat},${safeLng}`;
}

export function buildAppleDirectionsUrl(lat: unknown, lng: unknown, address: string): string {
  const safeLat = normalizeLatitude(lat);
  const safeLng = normalizeLongitude(lng);
  if (safeLat == null || safeLng == null) return '';

  const q = encodeURIComponent(String(address || '').trim() || `${safeLat},${safeLng}`);
  return `https://maps.apple.com/?q=${q}&ll=${safeLat},${safeLng}`;
}

export function buildMapboxStaticPreviewUrl(lat: unknown, lng: unknown, width = 600, height = 300): string {
  const token = String(process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '').trim();
  if (!token) return '';

  const safeLat = normalizeLatitude(lat);
  const safeLng = normalizeLongitude(lng);
  if (safeLat == null || safeLng == null) return '';

  const w = Math.max(200, Math.min(1200, Math.round(width)));
  const h = Math.max(120, Math.min(1200, Math.round(height)));
  const pin = `pin-s+285AEB(${safeLng},${safeLat})`;
  return `${MAPBOX_STATIC_BASE}/${pin}/${safeLng},${safeLat},14/${w}x${h}?access_token=${encodeURIComponent(token)}`;
}
