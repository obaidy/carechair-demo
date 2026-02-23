import {createServerSupabaseClient} from '@/lib/supabase/server';
import {decodePathPart, normalizeSlug, slugEquals} from '@/lib/slug';

export type SalonRow = {
  id: string;
  slug: string;
  name: string;
  area: string | null;
  country_code: string | null;
  currency_code: string | null;
  timezone: string | null;
  language_default: string | null;
  whatsapp: string | null;
  is_active: boolean;
  is_listed: boolean;
  is_public?: boolean;
  created_at: string;
  logo_url: string | null;
  cover_image_url: string | null;
  gallery_image_urls: string[] | null;
  booking_mode: 'choose_employee' | 'auto_assign' | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type ServiceRow = {
  id: string;
  salon_id: string;
  name: string;
  duration_minutes: number;
  price: number | null;
  is_active: boolean;
  sort_order: number | null;
  image_url: string | null;
};

export type StaffRow = {
  id: string;
  salon_id: string;
  name: string;
  is_active: boolean;
  sort_order: number | null;
  photo_url: string | null;
};

export type StaffServiceRow = {
  id: string;
  salon_id: string;
  staff_id: string;
  service_id: string;
};

export type SalonHourRow = {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
};

export type EmployeeHourRow = {
  staff_id: string;
  day_of_week: number;
  start_time: string | null;
  end_time: string | null;
  is_off: boolean;
  break_start: string | null;
  break_end: string | null;
};

export type SalonLocationRow = {
  id: string;
  salon_id: string;
  label: string | null;
  country_code: string;
  city: string | null;
  address_line: string | null;
  formatted_address: string | null;
  lat: number;
  lng: number;
  provider: string;
  provider_place_id: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
};

const SALON_SELECT = [
  'id',
  'slug',
  'name',
  'area',
  'country_code',
  'currency_code',
  'timezone',
  'language_default',
  'whatsapp',
  'is_active',
  'is_listed',
  'created_at',
  'logo_url',
  'cover_image_url',
  'gallery_image_urls',
  'booking_mode',
  'latitude',
  'longitude'
].join(',');

const LOCATION_SELECT = [
  'id',
  'salon_id',
  'label',
  'country_code',
  'city',
  'address_line',
  'formatted_address',
  'lat',
  'lng',
  'provider',
  'provider_place_id',
  'is_primary',
  'created_at',
  'updated_at'
].join(',');

function missingColumn(error: unknown, columnName: string): boolean {
  const raw = String((error as {message?: string})?.message || '');
  if (!raw) return false;
  return raw.includes(columnName) && raw.toLowerCase().includes('column');
}

function missingRelation(error: unknown, relationName: string): boolean {
  const raw = String((error as {message?: string})?.message || '').toLowerCase();
  if (!raw) return false;
  return raw.includes(relationName.toLowerCase()) && (raw.includes('table') || raw.includes('relation'));
}

function hasLatLng(salon: SalonRow): boolean {
  const lat = Number(salon.latitude);
  const lng = Number(salon.longitude);
  return Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lng) && lng >= -180 && lng <= 180;
}

export function citySlugFromSalon(salon: Pick<SalonRow, 'area'>): string {
  return normalizeSlug(String(salon.area || 'city'));
}

export function countrySlugFromSalon(salon: Pick<SalonRow, 'country_code'>): string {
  return normalizeSlug(String(salon.country_code || 'xx'));
}

function mapLocationFallback(salon: SalonRow): SalonLocationRow | null {
  if (!hasLatLng(salon)) return null;

  return {
    id: `fallback-${salon.id}`,
    salon_id: salon.id,
    label: 'Main Branch',
    country_code: String(salon.country_code || '').toUpperCase() || 'IQ',
    city: String(salon.area || '') || null,
    address_line: String(salon.area || '') || null,
    formatted_address: null,
    lat: Number(salon.latitude),
    lng: Number(salon.longitude),
    provider: 'manual',
    provider_place_id: null,
    is_primary: true,
    created_at: salon.created_at,
    updated_at: salon.created_at
  };
}

async function getPublicSalonsBase(): Promise<SalonRow[]> {
  const supabase = createServerSupabaseClient();
  if (!supabase) return [];

  const withPublicAndActive = await supabase
    .from('salons')
    .select(SALON_SELECT)
    .eq('is_public', true)
    .eq('is_active', true)
    .order('created_at', {ascending: false});

  if (!withPublicAndActive.error) {
    return (withPublicAndActive.data || []) as unknown as SalonRow[];
  }

  if (missingColumn(withPublicAndActive.error, 'is_active')) {
    const withPublicOnly = await supabase
      .from('salons')
      .select(SALON_SELECT)
      .eq('is_public', true)
      .order('created_at', {ascending: false});

    if (!withPublicOnly.error) {
      return (withPublicOnly.data || []) as unknown as SalonRow[];
    }

    if (!missingColumn(withPublicOnly.error, 'is_public')) {
      throw withPublicOnly.error;
    }
  } else if (!missingColumn(withPublicAndActive.error, 'is_public')) {
    throw withPublicAndActive.error;
  }

  // Legacy fallback for environments where the migration is not applied yet.
  const legacyVisibilityColumns = ['is_listed', 'visible_on_explore'];
  for (const visibilityColumn of legacyVisibilityColumns) {
    const legacyWithActive = await supabase
      .from('salons')
      .select(SALON_SELECT)
      .eq(visibilityColumn, true)
      .eq('is_active', true)
      .order('created_at', {ascending: false});

    if (!legacyWithActive.error) {
      return (legacyWithActive.data || []) as unknown as SalonRow[];
    }

    if (missingColumn(legacyWithActive.error, 'is_active')) {
      const legacyOnly = await supabase
        .from('salons')
        .select(SALON_SELECT)
        .eq(visibilityColumn, true)
        .order('created_at', {ascending: false});

      if (!legacyOnly.error) {
        return (legacyOnly.data || []) as unknown as SalonRow[];
      }

      if (!missingColumn(legacyOnly.error, visibilityColumn)) {
        throw legacyOnly.error;
      }
      continue;
    }

    if (!missingColumn(legacyWithActive.error, visibilityColumn)) {
      throw legacyWithActive.error;
    }
  }

  throw withPublicAndActive.error;
}

export async function getPublicSalons(): Promise<SalonRow[]> {
  return getPublicSalonsBase();
}

export async function getPrimaryLocationsForSalons(salonIds: string[]): Promise<Record<string, SalonLocationRow>> {
  if (!salonIds.length) return {};

  const supabase = createServerSupabaseClient();
  if (!supabase) return {};

  const res = await supabase
    .from('salon_locations')
    .select(LOCATION_SELECT)
    .in('salon_id', salonIds)
    .eq('is_primary', true)
    .order('created_at', {ascending: false});

  if (res.error) {
    if (missingColumn(res.error, 'salon_locations') || missingRelation(res.error, 'salon_locations')) return {};
    throw res.error;
  }

  const map: Record<string, SalonLocationRow> = {};
  for (const row of (res.data || []) as unknown as SalonLocationRow[]) {
    if (!map[row.salon_id]) {
      map[row.salon_id] = row;
    }
  }

  return map;
}

export async function getPrimarySalonLocation(salonId: string): Promise<SalonLocationRow | null> {
  if (!salonId) return null;

  const supabase = createServerSupabaseClient();
  if (!supabase) return null;

  const res = await supabase
    .from('salon_locations')
    .select(LOCATION_SELECT)
    .eq('salon_id', salonId)
    .eq('is_primary', true)
    .order('created_at', {ascending: false})
    .limit(1)
    .maybeSingle();

  if (res.error) {
    if (missingColumn(res.error, 'salon_locations') || missingRelation(res.error, 'salon_locations')) return null;
    throw res.error;
  }

  return (res.data as unknown as SalonLocationRow | null) || null;
}

export async function getActiveServicesForSalons(salonIds: string[]): Promise<Record<string, ServiceRow[]>> {
  if (!salonIds.length) return {};

  const supabase = createServerSupabaseClient();
  if (!supabase) return {};

  const res = await supabase
    .from('services')
    .select('id,salon_id,name,duration_minutes,price,is_active,sort_order,image_url')
    .eq('is_active', true)
    .in('salon_id', salonIds)
    .order('sort_order', {ascending: true});

  if (res.error) throw res.error;

  const map: Record<string, ServiceRow[]> = {};
  for (const row of (res.data || []) as unknown as ServiceRow[]) {
    if (!map[row.salon_id]) map[row.salon_id] = [];
    map[row.salon_id].push(row);
  }

  return map;
}

export async function getExploreData() {
  const salons = await getPublicSalons();
  const salonIds = salons.map((row) => row.id);

  const [servicesBySalon, locationsBySalon] = await Promise.all([
    getActiveServicesForSalons(salonIds),
    getPrimaryLocationsForSalons(salonIds)
  ]);

  return salons.map((salon) => ({
    salon,
    services: servicesBySalon[salon.id] || [],
    location: locationsBySalon[salon.id] || mapLocationFallback(salon)
  }));
}

export async function getCityListingData(country: string, city: string) {
  const countrySlug = normalizeSlug(decodePathPart(country));
  const citySlug = normalizeSlug(decodePathPart(city));

  const explore = await getExploreData();

  return explore.filter(({salon}) => {
    return countrySlugFromSalon(salon) === countrySlug && citySlugFromSalon(salon) === citySlug;
  });
}

export async function getServiceListingData(country: string, city: string, serviceSlug: string) {
  const cityRows = await getCityListingData(country, city);
  const targetServiceSlug = normalizeSlug(decodePathPart(serviceSlug));

  return cityRows
    .map((row) => {
      const matchingServices = row.services.filter((service) => slugEquals(service.name, targetServiceSlug));
      return {
        ...row,
        services: matchingServices
      };
    })
    .filter((row) => row.services.length > 0);
}

export async function getPublicSalonByPath(country: string, city: string, salonSlug: string) {
  const countrySlug = normalizeSlug(decodePathPart(country));
  const citySlug = normalizeSlug(decodePathPart(city));
  const targetSalonSlug = normalizeSlug(decodePathPart(salonSlug));

  const salons = await getPublicSalons();
  const salon = salons.find((row) => {
    return slugEquals(row.slug, targetSalonSlug) && countrySlugFromSalon(row) === countrySlug && citySlugFromSalon(row) === citySlug;
  });

  if (!salon) return null;

  const supabase = createServerSupabaseClient();
  if (!supabase) return null;

  const [location, servicesRes, staffRes, staffServicesRes, hoursRes, employeeHoursRes] = await Promise.all([
    getPrimarySalonLocation(salon.id),
    supabase
      .from('services')
      .select('id,salon_id,name,duration_minutes,price,is_active,sort_order,image_url')
      .eq('salon_id', salon.id)
      .eq('is_active', true)
      .order('sort_order', {ascending: true}),
    supabase
      .from('staff')
      .select('id,salon_id,name,is_active,sort_order,photo_url')
      .eq('salon_id', salon.id)
      .eq('is_active', true)
      .order('sort_order', {ascending: true}),
    supabase
      .from('staff_services')
      .select('id,salon_id,staff_id,service_id')
      .eq('salon_id', salon.id),
    supabase
      .from('salon_hours')
      .select('day_of_week,open_time,close_time,is_closed')
      .eq('salon_id', salon.id),
    supabase
      .from('employee_hours')
      .select('staff_id,day_of_week,start_time,end_time,is_off,break_start,break_end')
      .eq('salon_id', salon.id)
  ]);

  if (servicesRes.error) throw servicesRes.error;
  if (staffRes.error) throw staffRes.error;
  if (staffServicesRes.error) throw staffServicesRes.error;
  if (hoursRes.error) throw hoursRes.error;
  if (employeeHoursRes.error) throw employeeHoursRes.error;

  return {
    salon,
    location: location || mapLocationFallback(salon),
    services: (servicesRes.data || []) as unknown as ServiceRow[],
    staff: (staffRes.data || []) as unknown as StaffRow[],
    staffServices: (staffServicesRes.data || []) as unknown as StaffServiceRow[],
    hours: (hoursRes.data || []) as unknown as SalonHourRow[],
    employeeHours: (employeeHoursRes.data || []) as unknown as EmployeeHourRow[]
  };
}

export async function getSiteMapData() {
  const explore = await getExploreData();
  const cityPaths = new Set<string>();
  const servicePaths = new Set<string>();
  const salonPaths = new Set<string>();

  for (const row of explore) {
    const country = countrySlugFromSalon(row.salon);
    const city = citySlugFromSalon(row.salon);
    cityPaths.add(`/${country}/${city}`);

    salonPaths.add(`/${country}/${city}/${normalizeSlug(row.salon.slug)}`);
    for (const service of row.services) {
      servicePaths.add(`/${country}/${city}/${normalizeSlug(service.name)}`);
    }
  }

  return {
    cityPaths: Array.from(cityPaths),
    servicePaths: Array.from(servicePaths),
    salonPaths: Array.from(salonPaths)
  };
}
