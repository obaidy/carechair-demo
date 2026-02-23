import { supabase } from "./supabase";

const MAPBOX_TOKEN = String(import.meta.env.VITE_MAPBOX_TOKEN || "").trim();
const MAPBOX_GEOCODING_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places";
const MAPBOX_STATIC_BASE = "https://api.mapbox.com/styles/v1/mapbox/streets-v12/static";
const DEFAULT_ZOOM = 14;
const TILE_SIZE = 512;

const LOCATION_COLUMNS =
  "id,salon_id,label,country_code,city,address_line,formatted_address,lat,lng,provider,provider_place_id,is_primary,created_at,updated_at";

function isNoRowsError(error) {
  if (!error) return false;
  return String(error.code || "") === "PGRST116";
}

function toFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function hasMapboxToken() {
  return MAPBOX_TOKEN.length > 0;
}

export function normalizeCoordinate(value, min, max, decimals = 6) {
  const num = toFiniteNumber(value);
  if (num == null || num < min || num > max) return null;
  return Number(num.toFixed(decimals));
}

export function normalizeLatitude(value, decimals = 6) {
  return normalizeCoordinate(value, -90, 90, decimals);
}

export function normalizeLongitude(value, decimals = 6) {
  return normalizeCoordinate(value, -180, 180, decimals);
}

export function hasValidLatLng(lat, lng) {
  return normalizeLatitude(lat) != null && normalizeLongitude(lng) != null;
}

export function formatLocationAddress(location) {
  if (!location || typeof location !== "object") return "";
  const formatted = String(location.formatted_address || "").trim();
  if (formatted) return formatted;

  const parts = [
    String(location.address_line || "").trim(),
    String(location.city || "").trim(),
    String(location.country_code || "").trim(),
  ].filter(Boolean);

  return parts.join(", ");
}

export function buildGoogleMapsDirectionsUrl(lat, lng) {
  const safeLat = normalizeLatitude(lat);
  const safeLng = normalizeLongitude(lng);
  if (safeLat == null || safeLng == null) return "";
  return `https://www.google.com/maps/search/?api=1&query=${safeLat},${safeLng}`;
}

export function buildAppleMapsDirectionsUrl({ lat, lng, address = "" }) {
  const safeLat = normalizeLatitude(lat);
  const safeLng = normalizeLongitude(lng);
  if (safeLat == null || safeLng == null) return "";

  const q = encodeURIComponent(String(address || "").trim() || `${safeLat},${safeLng}`);
  return `https://maps.apple.com/?q=${q}&ll=${safeLat},${safeLng}`;
}

export function buildMapboxStaticPreviewUrl({ lat, lng, zoom = DEFAULT_ZOOM, width = 600, height = 300 }) {
  if (!hasMapboxToken()) return "";

  const safeLat = normalizeLatitude(lat, 6);
  const safeLng = normalizeLongitude(lng, 6);
  if (safeLat == null || safeLng == null) return "";

  const safeZoom = Number.isFinite(Number(zoom)) ? Math.max(1, Math.min(20, Number(zoom))) : DEFAULT_ZOOM;
  const safeWidth = Number.isFinite(Number(width)) ? Math.max(120, Math.min(1280, Math.round(Number(width)))) : 600;
  const safeHeight = Number.isFinite(Number(height)) ? Math.max(80, Math.min(1280, Math.round(Number(height)))) : 300;

  const pin = `pin-s+285AEB(${safeLng},${safeLat})`;
  return `${MAPBOX_STATIC_BASE}/${pin}/${safeLng},${safeLat},${safeZoom}/${safeWidth}x${safeHeight}?access_token=${encodeURIComponent(MAPBOX_TOKEN)}`;
}

function lngLatToWorld({ lat, lng, zoom = DEFAULT_ZOOM }) {
  const scale = TILE_SIZE * 2 ** zoom;
  const x = ((lng + 180) / 360) * scale;
  const sin = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
  return { x, y };
}

function worldToLngLat({ x, y, zoom = DEFAULT_ZOOM }) {
  const scale = TILE_SIZE * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

export function pickLatLngFromStaticMapClick({ clickX, clickY, width, height, centerLat, centerLng, zoom = DEFAULT_ZOOM }) {
  const safeCenterLat = normalizeLatitude(centerLat, 8);
  const safeCenterLng = normalizeLongitude(centerLng, 8);
  if (safeCenterLat == null || safeCenterLng == null) return null;

  const w = Number.isFinite(Number(width)) && Number(width) > 0 ? Number(width) : 1;
  const h = Number.isFinite(Number(height)) && Number(height) > 0 ? Number(height) : 1;
  const x = Number.isFinite(Number(clickX)) ? Number(clickX) : w / 2;
  const y = Number.isFinite(Number(clickY)) ? Number(clickY) : h / 2;
  const safeZoom = Number.isFinite(Number(zoom)) ? Math.max(1, Math.min(20, Number(zoom))) : DEFAULT_ZOOM;

  const centerWorld = lngLatToWorld({ lat: safeCenterLat, lng: safeCenterLng, zoom: safeZoom });
  const targetWorld = {
    x: centerWorld.x + (x - w / 2),
    y: centerWorld.y + (y - h / 2),
  };

  const target = worldToLngLat({ ...targetWorld, zoom: safeZoom });
  return {
    lat: normalizeLatitude(target.lat, 6),
    lng: normalizeLongitude(target.lng, 6),
  };
}

export async function searchMapboxPlaces(query, { countryCode = "", limit = 6, language = "en" } = {}) {
  const q = String(query || "").trim();
  if (!hasMapboxToken()) {
    return { data: [], error: null, disabled: true };
  }
  if (q.length < 2) {
    return { data: [], error: null, disabled: false };
  }

  try {
    const params = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      autocomplete: "true",
      limit: String(Math.max(1, Math.min(10, Number(limit) || 6))),
      language: String(language || "en"),
      types: "address,place,locality,poi",
    });

    const cc = String(countryCode || "").trim().toLowerCase();
    if (cc) params.set("country", cc);

    const url = `${MAPBOX_GEOCODING_URL}/${encodeURIComponent(q)}.json?${params.toString()}`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      return {
        data: [],
        error: new Error(`mapbox_geocoding_failed_${res.status}`),
        disabled: false,
      };
    }

    const json = await res.json();
    const features = Array.isArray(json?.features) ? json.features : [];

    const data = features
      .map((row) => {
        const lng = normalizeLongitude(row?.center?.[0], 6);
        const lat = normalizeLatitude(row?.center?.[1], 6);
        if (lat == null || lng == null) return null;
        return {
          place_id: String(row?.id || "").trim(),
          name: String(row?.text || "").trim(),
          formatted_address: String(row?.place_name || "").trim(),
          country_code: String(row?.properties?.short_code || "").replace(/^([A-Za-z]{2}).*$/, "$1").toUpperCase(),
          city: String(row?.context?.find?.((x) => String(x?.id || "").startsWith("place."))?.text || "").trim(),
          address_line: String(row?.properties?.address || row?.text || "").trim(),
          lat,
          lng,
          provider: "mapbox",
        };
      })
      .filter(Boolean);

    return { data, error: null, disabled: false };
  } catch (error) {
    return { data: [], error, disabled: false };
  }
}

export async function getPrimarySalonLocation(salonId) {
  if (!supabase || !salonId) return { data: null, error: null };

  const res = await supabase
    .from("salon_locations")
    .select(LOCATION_COLUMNS)
    .eq("salon_id", salonId)
    .eq("is_primary", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (res.error && !isNoRowsError(res.error)) {
    return { data: null, error: res.error };
  }

  return { data: res.data || null, error: null };
}

export async function getPrimarySalonLocationPublic(salonId) {
  if (!supabase || !salonId) return { data: null, error: null };

  const res = await supabase
    .from("salon_locations")
    .select(`${LOCATION_COLUMNS}, salons!inner(id,is_active,is_listed)`)
    .eq("salon_id", salonId)
    .eq("is_primary", true)
    .eq("salons.is_active", true)
    .eq("salons.is_listed", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (res.error && !isNoRowsError(res.error)) {
    return { data: null, error: res.error };
  }

  if (!res.data) return { data: null, error: null };

  const { salons: _salons, ...location } = res.data;
  return { data: location, error: null };
}
