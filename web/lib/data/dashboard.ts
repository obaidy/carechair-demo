import 'server-only';

import {createServerSupabaseClient} from '@/lib/supabase/server';
import {readAuthSession} from '@/lib/auth/server';

type SalonRecord = {
  id: string;
  slug: string;
  name: string;
  area: string | null;
  country_code: string | null;
  currency_code: string | null;
  status?: string | null;
  subscription_status?: string | null;
  billing_status?: string | null;
  trial_end_at?: string | null;
  trial_end?: string | null;
  is_active?: boolean;
  is_public?: boolean;
  is_listed?: boolean;
  created_at?: string | null;
};

type BookingRecord = {
  id: string;
  salon_id: string;
  staff_id: string | null;
  service_id: string | null;
  customer_name: string;
  customer_phone: string;
  status: string;
  appointment_start: string;
  appointment_end: string;
  created_at: string;
  price?: number | null;
  service_price?: number | null;
};

type ServiceRecord = {
  id: string;
  salon_id: string;
  name: string;
  duration_minutes: number;
  price: number | null;
  is_active: boolean;
  sort_order: number | null;
};

type StaffRecord = {
  id: string;
  salon_id: string;
  name: string;
  is_active: boolean;
  sort_order: number | null;
};

function missingColumn(error: unknown, columnName: string): boolean {
  const raw = String((error as {message?: string})?.message || '').toLowerCase();
  return raw.includes('column') && raw.includes(columnName.toLowerCase());
}

export async function getSessionSalon(): Promise<SalonRecord | null> {
  const session = await readAuthSession();
  if (!session || session.role !== 'salon_admin') return null;

  const supabase = createServerSupabaseClient();
  if (!supabase) return null;

  let query = supabase
    .from('salons')
    .select('id,slug,name,area,country_code,currency_code,status,subscription_status,billing_status,is_active,is_public,is_listed,created_at,trial_end_at,trial_end')
    .limit(1);

  if (session.salonId) {
    query = query.eq('id', session.salonId);
  } else if (session.salonSlug) {
    query = query.eq('slug', session.salonSlug);
  } else {
    return null;
  }

  const res = await query.maybeSingle();
  if (res.error || !res.data) return null;

  return res.data as SalonRecord;
}

export async function getSalonOverview(salonId: string) {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return {
      bookingsToday: 0,
      bookings30d: 0,
      confirmed30d: 0,
      pendingCount: 0,
      clients30d: 0,
      revenue30d: 0,
      servicesCount: 0,
      staffCount: 0
    };
  }

  const start30 = new Date();
  start30.setDate(start30.getDate() - 30);
  const todayKey = new Date().toISOString().slice(0, 10);

  const [bookingsRes, servicesRes, staffRes] = await Promise.all([
    supabase.from('bookings').select('id,status,appointment_start,customer_phone,service_id,price,service_price').eq('salon_id', salonId).limit(4000),
    supabase.from('services').select('id,price').eq('salon_id', salonId),
    supabase.from('staff').select('id').eq('salon_id', salonId)
  ]);

  if (bookingsRes.error) throw bookingsRes.error;
  if (servicesRes.error) throw servicesRes.error;
  if (staffRes.error) throw staffRes.error;

  const servicePriceById = new Map<string, number>();
  for (const row of servicesRes.data || []) {
    servicePriceById.set(String(row.id), Number(row.price || 0));
  }

  let bookingsToday = 0;
  let bookings30d = 0;
  let confirmed30d = 0;
  let pendingCount = 0;
  let revenue30d = 0;
  const clients = new Set<string>();

  for (const booking of (bookingsRes.data || []) as Array<Record<string, unknown>>) {
    const status = String(booking.status || 'pending');
    const dateIso = String(booking.appointment_start || booking.created_at || '');
    const date = new Date(dateIso);
    if (Number.isNaN(date.getTime())) continue;

    if (dateIso.slice(0, 10) === todayKey) bookingsToday += 1;
    if (status === 'pending') pendingCount += 1;

    if (date >= start30) {
      bookings30d += 1;
      clients.add(String(booking.customer_phone || booking.id || ''));

      if (status === 'confirmed') {
        confirmed30d += 1;
        const fallbackPrice = Number(booking.price || booking.service_price || 0);
        const serviceId = String(booking.service_id || '');
        revenue30d += servicePriceById.get(serviceId) || fallbackPrice || 0;
      }
    }
  }

  return {
    bookingsToday,
    bookings30d,
    confirmed30d,
    pendingCount,
    clients30d: clients.size,
    revenue30d,
    servicesCount: (servicesRes.data || []).length,
    staffCount: (staffRes.data || []).length
  };
}

export async function getSalonBookings(salonId: string, limit = 200): Promise<BookingRecord[]> {
  const supabase = createServerSupabaseClient();
  if (!supabase) return [];

  const res = await supabase
    .from('bookings')
    .select('id,salon_id,staff_id,service_id,customer_name,customer_phone,status,appointment_start,appointment_end,created_at,price,service_price')
    .eq('salon_id', salonId)
    .order('appointment_start', {ascending: false})
    .limit(limit);

  if (res.error) throw res.error;
  return (res.data || []) as BookingRecord[];
}

export async function getSalonServices(salonId: string): Promise<ServiceRecord[]> {
  const supabase = createServerSupabaseClient();
  if (!supabase) return [];

  const res = await supabase
    .from('services')
    .select('id,salon_id,name,duration_minutes,price,is_active,sort_order')
    .eq('salon_id', salonId)
    .order('sort_order', {ascending: true});

  if (res.error) throw res.error;
  return (res.data || []) as ServiceRecord[];
}

export async function getSalonStaff(salonId: string): Promise<StaffRecord[]> {
  const supabase = createServerSupabaseClient();
  if (!supabase) return [];

  const res = await supabase
    .from('staff')
    .select('id,salon_id,name,is_active,sort_order')
    .eq('salon_id', salonId)
    .order('sort_order', {ascending: true});

  if (res.error) throw res.error;
  return (res.data || []) as StaffRecord[];
}

export async function getSalonClients(salonId: string) {
  const bookings = await getSalonBookings(salonId, 2000);
  const map = new Map<string, {name: string; phone: string; bookings: number; lastVisit: string}>();

  for (const row of bookings) {
    const key = String(row.customer_phone || row.customer_name || row.id);
    const item = map.get(key) || {
      name: row.customer_name || 'Customer',
      phone: row.customer_phone || '-',
      bookings: 0,
      lastVisit: row.appointment_start
    };

    item.bookings += 1;
    if (new Date(row.appointment_start).getTime() > new Date(item.lastVisit).getTime()) {
      item.lastVisit = row.appointment_start;
    }
    map.set(key, item);
  }

  return Array.from(map.values()).sort((a, b) => b.bookings - a.bookings);
}

export async function getSuperadminSalons(): Promise<SalonRecord[]> {
  const supabase = createServerSupabaseClient();
  if (!supabase) return [];

  const selectColumns =
    'id,slug,name,area,country_code,currency_code,status,subscription_status,billing_status,is_active,is_public,is_listed,created_at,trial_end_at,trial_end';

  const primary = await supabase.from('salons').select(selectColumns).order('created_at', {ascending: false});
  if (!primary.error) {
    return (primary.data || []) as SalonRecord[];
  }

  if (!missingColumn(primary.error, 'is_public')) {
    throw primary.error;
  }

  const fallback = await supabase
    .from('salons')
    .select('id,slug,name,area,country_code,currency_code,status,subscription_status,billing_status,is_active,is_listed,created_at,trial_end_at,trial_end')
    .order('created_at', {ascending: false});

  if (fallback.error) throw fallback.error;
  return (fallback.data || []).map((row) => ({...(row as SalonRecord), is_public: Boolean((row as SalonRecord).is_listed)}));
}

export async function getSuperadminSalonDetail(salonId: string) {
  const supabase = createServerSupabaseClient();
  if (!supabase) return null;

  const [salonRes, overview, bookings] = await Promise.all([
    supabase
      .from('salons')
      .select('id,slug,name,area,country_code,currency_code,status,subscription_status,billing_status,is_active,is_public,is_listed,created_at,trial_end_at,trial_end')
      .eq('id', salonId)
      .maybeSingle(),
    getSalonOverview(salonId),
    getSalonBookings(salonId, 300)
  ]);

  if (salonRes.error) {
    if (!missingColumn(salonRes.error, 'is_public')) throw salonRes.error;

    const legacy = await supabase
      .from('salons')
      .select('id,slug,name,area,country_code,currency_code,status,subscription_status,billing_status,is_active,is_listed,created_at,trial_end_at,trial_end')
      .eq('id', salonId)
      .maybeSingle();
    if (legacy.error || !legacy.data) return null;

    return {
      salon: {...(legacy.data as SalonRecord), is_public: Boolean((legacy.data as SalonRecord).is_listed)},
      overview,
      bookings
    };
  }

  if (!salonRes.data) return null;

  return {
    salon: salonRes.data as SalonRecord,
    overview,
    bookings
  };
}
