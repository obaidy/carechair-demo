const MAPBOX_TOKEN = String(process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '').trim();
const MAPBOX_GEOCODING_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
const MAPBOX_STATIC_BASE = 'https://api.mapbox.com/styles/v1/mapbox/streets-v12/static';
const DEFAULT_ZOOM = 14;
const TILE_SIZE = 512;

function toFiniteNumber(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function hasMapboxToken(): boolean {
  return MAPBOX_TOKEN.length > 0;
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

export function buildGoogleDirectionsUrl(lat: unknown, lng: unknown, address = ''): string {
  const safeLat = normalizeLatitude(lat);
  const safeLng = normalizeLongitude(lng);
  if (safeLat != null && safeLng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${safeLat},${safeLng}`;
  }
  if (!address) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function buildAppleDirectionsUrl(lat: unknown, lng: unknown, address: string): string {
  const safeLat = normalizeLatitude(lat);
  const safeLng = normalizeLongitude(lng);
  const query = String(address || '').trim();
  if (safeLat != null && safeLng != null) {
    const q = encodeURIComponent(query || `${safeLat},${safeLng}`);
    return `https://maps.apple.com/?q=${q}&ll=${safeLat},${safeLng}`;
  }
  if (!query) return '';
  return `https://maps.apple.com/?q=${encodeURIComponent(query)}`;
}

type StaticMapInput = {
  lat: unknown;
  lng: unknown;
  zoom?: number;
  width?: number;
  height?: number;
};

export function buildMapboxStaticPreviewUrl(
  latOrInput: unknown | StaticMapInput,
  lng?: unknown,
  width = 600,
  height = 300
): string {
  if (!hasMapboxToken()) return '';

  let lat: unknown = latOrInput;
  let zoom = DEFAULT_ZOOM;
  let w = width;
  let h = height;

  if (latOrInput && typeof latOrInput === 'object' && 'lat' in (latOrInput as Record<string, unknown>)) {
    const input = latOrInput as StaticMapInput;
    lat = input.lat;
    lng = input.lng;
    zoom = Number.isFinite(Number(input.zoom)) ? Math.max(1, Math.min(20, Number(input.zoom))) : DEFAULT_ZOOM;
    w = Number.isFinite(Number(input.width)) ? Number(input.width) : width;
    h = Number.isFinite(Number(input.height)) ? Number(input.height) : height;
  }

  const safeLat = normalizeLatitude(lat);
  const safeLng = normalizeLongitude(lng);
  if (safeLat == null || safeLng == null) return '';

  const safeWidth = Math.max(120, Math.min(1200, Math.round(w)));
  const safeHeight = Math.max(80, Math.min(1200, Math.round(h)));
  const pin = `pin-s+285AEB(${safeLng},${safeLat})`;
  return `${MAPBOX_STATIC_BASE}/${pin}/${safeLng},${safeLat},${zoom}/${safeWidth}x${safeHeight}?access_token=${encodeURIComponent(MAPBOX_TOKEN)}`;
}

function lngLatToWorld({lat, lng, zoom = DEFAULT_ZOOM}: {lat: number; lng: number; zoom?: number}) {
  const scale = TILE_SIZE * 2 ** zoom;
  const x = ((lng + 180) / 360) * scale;
  const sin = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
  return {x, y};
}

function worldToLngLat({x, y, zoom = DEFAULT_ZOOM}: {x: number; y: number; zoom?: number}) {
  const scale = TILE_SIZE * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return {lat, lng};
}

export function pickLatLngFromStaticMapClick({
  clickX,
  clickY,
  width,
  height,
  centerLat,
  centerLng,
  zoom = DEFAULT_ZOOM
}: {
  clickX: number;
  clickY: number;
  width: number;
  height: number;
  centerLat: unknown;
  centerLng: unknown;
  zoom?: number;
}): {lat: number | null; lng: number | null} | null {
  const safeCenterLat = normalizeLatitude(centerLat);
  const safeCenterLng = normalizeLongitude(centerLng);
  if (safeCenterLat == null || safeCenterLng == null) return null;

  const w = Number.isFinite(Number(width)) && Number(width) > 0 ? Number(width) : 1;
  const h = Number.isFinite(Number(height)) && Number(height) > 0 ? Number(height) : 1;
  const x = Number.isFinite(Number(clickX)) ? Number(clickX) : w / 2;
  const y = Number.isFinite(Number(clickY)) ? Number(clickY) : h / 2;
  const safeZoom = Number.isFinite(Number(zoom)) ? Math.max(1, Math.min(20, Number(zoom))) : DEFAULT_ZOOM;

  const centerWorld = lngLatToWorld({lat: safeCenterLat, lng: safeCenterLng, zoom: safeZoom});
  const targetWorld = {
    x: centerWorld.x + (x - w / 2),
    y: centerWorld.y + (y - h / 2)
  };

  const target = worldToLngLat({...targetWorld, zoom: safeZoom});
  return {
    lat: normalizeLatitude(target.lat),
    lng: normalizeLongitude(target.lng)
  };
}

type SearchMapboxPlacesOptions = {
  countryCode?: string;
  limit?: number;
  language?: string;
};

export async function searchMapboxPlaces(query: string, options: SearchMapboxPlacesOptions = {}): Promise<{
  data: Array<{
    place_id: string;
    name: string;
    formatted_address: string;
    country_code: string;
    city: string;
    address_line: string;
    lat: number;
    lng: number;
    provider: 'mapbox';
  }>;
  error: unknown;
  disabled: boolean;
}> {
  const q = String(query || '').trim();
  if (!hasMapboxToken()) {
    return {data: [], error: null, disabled: true};
  }
  if (q.length < 2) {
    return {data: [], error: null, disabled: false};
  }

  try {
    const params = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      autocomplete: 'true',
      limit: String(Math.max(1, Math.min(10, Number(options.limit) || 6))),
      language: String(options.language || 'en'),
      types: 'address,place,locality,poi'
    });

    const cc = String(options.countryCode || '').trim().toLowerCase();
    if (cc) params.set('country', cc);

    const url = `${MAPBOX_GEOCODING_URL}/${encodeURIComponent(q)}.json?${params.toString()}`;
    const res = await fetch(url, {method: 'GET'});
    if (!res.ok) {
      return {data: [], error: new Error(`mapbox_geocoding_failed_${res.status}`), disabled: false};
    }

    const json = await res.json();
    const features = Array.isArray(json?.features) ? json.features : [];

    const data = features
      .map((row: any) => {
        const safeLng = normalizeLongitude(row?.center?.[0]);
        const safeLat = normalizeLatitude(row?.center?.[1]);
        if (safeLat == null || safeLng == null) return null;
        return {
          place_id: String(row?.id || '').trim(),
          name: String(row?.text || '').trim(),
          formatted_address: String(row?.place_name || '').trim(),
          country_code: String(row?.properties?.short_code || '')
            .replace(/^([A-Za-z]{2}).*$/, '$1')
            .toUpperCase(),
          city: String(
            row?.context?.find?.((x: {id?: string; text?: string}) => String(x?.id || '').startsWith('place.'))?.text || ''
          ).trim(),
          address_line: String(row?.properties?.address || row?.text || '').trim(),
          lat: safeLat,
          lng: safeLng,
          provider: 'mapbox' as const
        };
      })
      .filter(Boolean);

    return {data, error: null, disabled: false};
  } catch (error) {
    return {data: [], error, disabled: false};
  }
}
