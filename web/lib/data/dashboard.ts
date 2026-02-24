import 'server-only';

import {createServerSupabaseClient} from '@/lib/supabase/server';
import {readAuthSession} from '@/lib/auth/server';
import {getSuperadminCode} from '@/lib/auth/config';

type SalonRecord = {
  id: string;
  slug: string;
  name: string;
  area: string | null;
  country_code: string | null;
  currency_code: string | null;
  whatsapp?: string | null;
  status?: string | null;
  subscription_status?: string | null;
  billing_status?: string | null;
  trial_end_at?: string | null;
  trial_end?: string | null;
  current_period_end?: string | null;
  setup_paid?: boolean | null;
  manual_override_until?: string | null;
  admin_passcode?: string | null;
  suspended_reason?: string | null;
  is_active?: boolean;
  is_public?: boolean;
  is_listed?: boolean;
  created_at?: string | null;
};

type SuperadminHealthRow = {
  salon_id: string;
  salon_name: string | null;
  country_code: string | null;
  status: string | null;
  is_active: boolean | null;
  is_listed: boolean | null;
  trial_end_at: string | null;
  subscription_status: string | null;
  staff_count: number | null;
  services_count: number | null;
  total_bookings: number | null;
  bookings_last_7_days: number | null;
  bookings_last_30_days: number | null;
  last_booking_at: string | null;
  total_customers: number | null;
  customers_last_30_days: number | null;
  new_customers_last_30_days: number | null;
  repeat_customers_last_30_days: number | null;
};

type SuperadminStatsRow = {
  total_salons: number | null;
  pending_approval_count: number | null;
  trialing_count: number | null;
  active_count: number | null;
  past_due_count: number | null;
  suspended_count: number | null;
  total_bookings: number | null;
  bookings_today: number | null;
  bookings_last_7_days: number | null;
  bookings_last_30_days: number | null;
  total_unique_customers: number | null;
  new_customers_last_30_days: number | null;
  repeat_customers_last_30_days: number | null;
  customers_last_30_days: number | null;
};

type CountryRecord = {
  code: string;
  name_en?: string | null;
  name_ar?: string | null;
  name_cs?: string | null;
  name_ru?: string | null;
  default_currency?: string | null;
  timezone_default?: string | null;
  stripe_price_id_basic?: string | null;
  stripe_price_id_pro?: string | null;
  trial_days_default?: number | null;
  vat_percent?: number | null;
  is_enabled?: boolean | null;
  is_public?: boolean | null;
  requires_manual_billing?: boolean | null;
};

type SalonInviteRecord = {
  id: string;
  token: string;
  country_code: string;
  created_at: string;
  expires_at: string | null;
  max_uses: number;
  uses: number;
  created_by: string | null;
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
  photo_url?: string | null;
};

type StaffServiceRecord = {
  salon_id: string;
  staff_id: string;
  service_id: string;
};

function missingColumn(error: unknown, columnName: string): boolean {
  const raw = String((error as {message?: string})?.message || '').toLowerCase();
  return raw.includes('column') && raw.includes(columnName.toLowerCase());
}

function missingRelation(error: unknown, relationName: string): boolean {
  const raw = String((error as {message?: string; code?: string})?.message || '').toLowerCase();
  const code = String((error as {code?: string})?.code || '');
  return code === '42p01' || (raw.includes('relation') && raw.includes(relationName.toLowerCase()));
}

export async function getSessionSalon(): Promise<SalonRecord | null> {
  const session = await readAuthSession();
  if (!session || session.role !== 'salon_admin') return null;

  const supabase = createServerSupabaseClient();
  if (!supabase) return null;

  let query = supabase.from('salons').select('*').limit(1);

  if (session.salonId) {
    query = query.eq('id', session.salonId);
  } else if (session.salonSlug) {
    query = query.eq('slug', session.salonSlug);
  } else {
    return null;
  }

  const res = await query.maybeSingle();
  if (res.error || !res.data) return null;

  const salon = res.data as SalonRecord;
  return {
    ...salon,
    is_public: Boolean(salon.is_public ?? salon.is_listed)
  };
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

  let bookingsRes: any = await supabase
    .from('bookings')
    .select('id,status,appointment_start,customer_phone,service_id,price,service_price')
    .eq('salon_id', salonId)
    .limit(4000);
  if (bookingsRes.error && (missingColumn(bookingsRes.error, 'price') || missingColumn(bookingsRes.error, 'service_price'))) {
    bookingsRes = await supabase
      .from('bookings')
      .select('id,status,appointment_start,customer_phone,service_id')
      .eq('salon_id', salonId)
      .limit(4000);
  }

  const [servicesRes, staffRes] = await Promise.all([
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

  let res: any = await supabase
    .from('bookings')
    .select('id,salon_id,staff_id,service_id,customer_name,customer_phone,status,appointment_start,appointment_end,created_at,price,service_price')
    .eq('salon_id', salonId)
    .order('appointment_start', {ascending: false})
    .limit(limit);

  if (res.error && (missingColumn(res.error, 'price') || missingColumn(res.error, 'service_price'))) {
    res = await supabase
      .from('bookings')
      .select('id,salon_id,staff_id,service_id,customer_name,customer_phone,status,appointment_start,appointment_end,created_at')
      .eq('salon_id', salonId)
      .order('appointment_start', {ascending: false})
      .limit(limit);
  }

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
    .select('id,salon_id,name,is_active,sort_order,photo_url')
    .eq('salon_id', salonId)
    .order('sort_order', {ascending: true});

  if (res.error) throw res.error;
  return (res.data || []) as StaffRecord[];
}

export async function getSalonStaffServices(salonId: string): Promise<StaffServiceRecord[]> {
  const supabase = createServerSupabaseClient();
  if (!supabase) return [];

  const res = await supabase
    .from('staff_services')
    .select('salon_id,staff_id,service_id')
    .eq('salon_id', salonId);

  if (res.error) throw res.error;
  return (res.data || []) as StaffServiceRecord[];
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

  const res = await supabase.from('salons').select('*').order('created_at', {ascending: false});
  if (res.error) throw res.error;

  return (res.data || []).map((row) => ({
    ...(row as SalonRecord),
    is_public: Boolean((row as SalonRecord).is_public ?? (row as SalonRecord).is_listed)
  }));
}

export async function getSuperadminOverviewData() {
  const salons = await getSuperadminSalons();
  const supabase = createServerSupabaseClient();

  const fallbackStats = {
    total_salons: salons.length,
    pending_approval_count: salons.filter((row) => String(row.status || '') === 'pending_approval').length,
    trialing_count: salons.filter((row) => String(row.status || '') === 'trialing').length,
    active_count: salons.filter((row) => String(row.status || '') === 'active').length,
    past_due_count: salons.filter((row) => String(row.status || '') === 'past_due').length,
    suspended_count: salons.filter((row) => String(row.status || '') === 'suspended').length,
    total_bookings: 0,
    bookings_today: 0,
    bookings_last_7_days: 0,
    bookings_last_30_days: 0,
    total_unique_customers: 0,
    new_customers_last_30_days: 0,
    repeat_customers_last_30_days: 0,
    customers_last_30_days: 0
  } as SuperadminStatsRow;

  if (!supabase) {
    return {
      salons,
      healthRows: [] as SuperadminHealthRow[],
      healthBySalonId: new Map<string, SuperadminHealthRow>(),
      stats: fallbackStats
    };
  }

  const adminCode = getSuperadminCode();
  const [healthRes, statsRes] = await Promise.all([
    supabase.rpc('superadmin_overview_salons', {p_admin_code: adminCode}),
    supabase.rpc('superadmin_overview_stats', {p_admin_code: adminCode})
  ]);

  if (healthRes.error || statsRes.error) {
    return {
      salons,
      healthRows: [] as SuperadminHealthRow[],
      healthBySalonId: new Map<string, SuperadminHealthRow>(),
      stats: fallbackStats
    };
  }

  const healthRows = (healthRes.data || []) as SuperadminHealthRow[];
  const healthBySalonId = new Map<string, SuperadminHealthRow>();
  for (const row of healthRows) {
    healthBySalonId.set(String(row.salon_id), row);
  }

  const stats = (((statsRes.data || []) as SuperadminStatsRow[])[0] || fallbackStats) as SuperadminStatsRow;

  return {
    salons,
    healthRows,
    healthBySalonId,
    stats
  };
}

export async function getSuperadminCountries(): Promise<CountryRecord[]> {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return [
      {code: 'AE', name_en: 'United Arab Emirates', default_currency: 'AED', timezone_default: 'Asia/Dubai', trial_days_default: 7, vat_percent: 0, is_enabled: true, is_public: true, requires_manual_billing: false},
      {code: 'CZ', name_en: 'Czech Republic', default_currency: 'CZK', timezone_default: 'Europe/Prague', trial_days_default: 7, vat_percent: 0, is_enabled: true, is_public: true, requires_manual_billing: false},
      {code: 'EU', name_en: 'Europe', default_currency: 'EUR', timezone_default: 'Europe/Berlin', trial_days_default: 7, vat_percent: 0, is_enabled: true, is_public: true, requires_manual_billing: false},
      {code: 'IQ', name_en: 'Iraq', default_currency: 'USD', timezone_default: 'Asia/Baghdad', trial_days_default: 7, vat_percent: 0, is_enabled: true, is_public: true, requires_manual_billing: false},
      {code: 'SY', name_en: 'Syria', default_currency: 'SYP', timezone_default: 'Asia/Damascus', trial_days_default: 7, vat_percent: 0, is_enabled: true, is_public: false, requires_manual_billing: true}
    ];
  }

  const res = await supabase
    .from('countries')
    .select(
      'code,name_en,name_ar,name_cs,name_ru,default_currency,timezone_default,stripe_price_id_basic,stripe_price_id_pro,trial_days_default,vat_percent,is_enabled,is_public,requires_manual_billing'
    )
    .order('code', {ascending: true});

  if (res.error) {
    if (missingRelation(res.error, 'countries')) {
      return [
        {code: 'AE', name_en: 'United Arab Emirates', default_currency: 'AED', timezone_default: 'Asia/Dubai', trial_days_default: 7, vat_percent: 0, is_enabled: true, is_public: true, requires_manual_billing: false},
        {code: 'CZ', name_en: 'Czech Republic', default_currency: 'CZK', timezone_default: 'Europe/Prague', trial_days_default: 7, vat_percent: 0, is_enabled: true, is_public: true, requires_manual_billing: false},
        {code: 'EU', name_en: 'Europe', default_currency: 'EUR', timezone_default: 'Europe/Berlin', trial_days_default: 7, vat_percent: 0, is_enabled: true, is_public: true, requires_manual_billing: false},
        {code: 'IQ', name_en: 'Iraq', default_currency: 'USD', timezone_default: 'Asia/Baghdad', trial_days_default: 7, vat_percent: 0, is_enabled: true, is_public: true, requires_manual_billing: false},
        {code: 'SY', name_en: 'Syria', default_currency: 'SYP', timezone_default: 'Asia/Damascus', trial_days_default: 7, vat_percent: 0, is_enabled: true, is_public: false, requires_manual_billing: true}
      ];
    }
    throw res.error;
  }

  return (res.data || []) as CountryRecord[];
}

export async function getSuperadminInvites(limit = 200) {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return {rows: [] as SalonInviteRecord[], available: false};
  }

  const res = await supabase.rpc('superadmin_list_invites', {
    p_admin_code: getSuperadminCode(),
    p_limit: limit
  });

  if (res.error) {
    return {rows: [] as SalonInviteRecord[], available: false};
  }

  return {rows: ((res.data || []) as SalonInviteRecord[]), available: true};
}

export async function getSuperadminSalonDetail(salonId: string) {
  const supabase = createServerSupabaseClient();
  if (!supabase) return null;

  const [salonRes, overview, bookings] = await Promise.all([
    supabase.from('salons').select('*').eq('id', salonId).maybeSingle(),
    getSalonOverview(salonId),
    getSalonBookings(salonId, 300)
  ]);

  if (salonRes.error) throw salonRes.error;

  if (!salonRes.data) return null;

  return {
    salon: {
      ...(salonRes.data as SalonRecord),
      is_public: Boolean((salonRes.data as SalonRecord).is_public ?? (salonRes.data as SalonRecord).is_listed)
    },
    overview,
    bookings
  };
}
