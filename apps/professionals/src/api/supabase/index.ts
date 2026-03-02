import {endOfDay, parseISO, startOfDay, startOfWeek} from 'date-fns';
import {Platform} from 'react-native';
import type {CareChairApi} from '../types';
import type {
  AvailabilityContext,
  AuthSession,
  BlockTimeInput,
  Booking,
  BookingStatus,
  Client,
  CreateBookingInput,
  CreateClientInput,
  CreateSalonInput,
  DashboardSummary,
  EventLog,
  NotificationPreference,
  OwnerContext,
  Reminder,
  RequestActivationInput,
  RescheduleBookingInput,
  Salon,
  Service,
  Staff,
  UpsertServiceInput,
  UpsertStaffInput,
  UserProfile
} from '../../types/models';
import {supabase} from './client';
import {useAuthStore} from '../../state/authStore';
import {normalizeSalonStatus, toDbSalonStatus} from '../../types/status';
import {pushDevLog} from '../../lib/devLogger';
import {toPhoneWithPlus} from '../../lib/phone';
import {env} from '../../utils/env';
import {invokeEdgeWithLog, requestSalonActivationV2} from '../invites';
import {validateBooking} from '../../lib/availability';

type HourRow = {
  day_of_week: number;
  open_time?: string | null;
  close_time?: string | null;
  is_closed?: boolean | null;
};

type EmployeeHourRow = {
  staff_id: string;
  day_of_week: number;
  start_time?: string | null;
  end_time?: string | null;
  is_off?: boolean | null;
  break_start?: string | null;
  break_end?: string | null;
};

type TimeOffRow = {
  id?: string | null;
  staff_id: string;
  start_at?: string | null;
  end_at?: string | null;
};

const DEFAULT_REMINDER_RULES = [
  {channel: 'sms', type: 'booking_confirmed'},
  {channel: 'whatsapp', type: 'booking_reminder_24h'},
  {channel: 'whatsapp', type: 'booking_reminder_2h'},
  {channel: 'push', type: 'booking_confirmed'}
] as const;

const DEFAULT_NOTIFICATION_PREFERENCE_TYPES: Array<NotificationPreference['type']> = [
  'booking_created',
  'booking_updated',
  'booking_status_changed',
  'daily_summary'
];
let restoreSessionPromise: Promise<any> | null = null;
let lastRestoredSessionFingerprint = '';

function assertSupabase() {
  if (!supabase) throw new Error('SUPABASE_CONFIG_MISSING');
  return supabase;
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function toHHMM(value: unknown, fallback = '08:00') {
  const raw = String(value || '').trim();
  const match = /^(\d{2}):(\d{2})/.exec(raw);
  if (!match) return fallback;
  return `${match[1]}:${match[2]}`;
}

function parseHmToMinutes(value: string, fallback: number) {
  const [hRaw, mRaw] = String(value || '').split(':');
  const hours = Number(hRaw);
  const mins = Number(mRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return fallback;
  return hours * 60 + mins;
}

function missingColumn(error: unknown, column: string) {
  const message = String((error as any)?.message || (error as any)?.details || '');
  return message.includes(column);
}

async function getFunctionErrorMessage(error: any, fallback: string) {
  if (!error) return fallback;

  const context = error?.context;
  if (context && typeof context.json === 'function') {
    try {
      const payload = await context.json();
      const value = String(payload?.error || payload?.message || '').trim();
      if (value) return value;
    } catch {
      // no-op
    }
  }

  if (context && typeof context.text === 'function') {
    try {
      const text = String(await context.text());
      if (text) {
        try {
          const parsed = JSON.parse(text);
          const value = String(parsed?.error || parsed?.message || '').trim();
          if (value) return value;
        } catch {
          return text.slice(0, 120);
        }
      }
    } catch {
      // no-op
    }
  }

  const direct = String(error?.message || '').trim();
  return direct || fallback;
}

function normalizeBookingStatus(value: unknown): BookingStatus {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (normalized === 'confirmed') return 'confirmed';
  if (normalized === 'completed') return 'completed';
  if (normalized === 'no_show') return 'no_show';
  if (normalized === 'blocked') return 'blocked';
  if (normalized === 'canceled' || normalized === 'cancelled') return 'canceled';
  return 'pending';
}

function toDbBookingStatus(status: BookingStatus) {
  if (status === 'canceled') return 'cancelled';
  return status;
}

function extractVirtualStatus(notes: unknown): BookingStatus | null {
  const text = String(notes || '');
  const matched = /\[cc_status:(completed|no_show|canceled|cancelled)\]/i.exec(text);
  if (!matched?.[1]) return null;
  return normalizeBookingStatus(matched[1]);
}

function stripVirtualStatus(notes: unknown) {
  return String(notes || '')
    .replace(/\s*\[cc_status:(completed|no_show|canceled|cancelled)\]\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function withVirtualStatus(notes: unknown, status: 'completed' | 'no_show') {
  const base = stripVirtualStatus(notes);
  return `${base}${base ? ' ' : ''}[cc_status:${status}]`;
}

function mapBookingRow(row: any): Booking {
  const virtualStatus = extractVirtualStatus(row?.notes);
  return {
    id: String(row.id),
    salonId: String(row.salon_id),
    clientId: null,
    clientName: String(row.customer_name || ''),
    clientPhone: String(row.customer_phone || ''),
    serviceId: String(row.service_id || ''),
    staffId: String(row.staff_id || ''),
    startAt: String(row.appointment_start),
    endAt: String(row.appointment_end),
    status: virtualStatus || normalizeBookingStatus(row.status),
    notes: stripVirtualStatus(row.notes),
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.created_at || new Date().toISOString())
  };
}

function formatSalonOperationalCurrencyMobile(
  value: number | string | null | undefined,
  salon: {countryCode?: string | null; currencyCode?: string | null},
  locale: string
) {
  const amount = Number(value || 0);
  const country = String(salon.countryCode || '').toUpperCase();
  const code = country === 'IQ' ? 'IQD' : String(salon.currencyCode || 'USD').toUpperCase();
  const safeLocale = String(locale || 'en').startsWith('ar') ? 'ar-IQ-u-nu-latn' : locale || 'en-US';
  if (code === 'IQD') {
    const numberPart = new Intl.NumberFormat(safeLocale, {maximumFractionDigits: 0}).format(amount);
    return `${numberPart} ${String(locale || '').startsWith('ar') ? 'د.ع' : 'IQD'}`;
  }
  try {
    return new Intl.NumberFormat(safeLocale, {style: 'currency', currency: code, maximumFractionDigits: 0}).format(amount);
  } catch {
    return `${Math.round(amount).toLocaleString('en-US')} ${code}`;
  }
}

function slugifyTempId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}`;
}

const SESSION_REFRESH_LEEWAY_MS = 2 * 60 * 1000;

function sessionExpiresSoon(session: any) {
  const expiresAt = Number(session?.expires_at || 0) * 1000;
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) return false;
  return expiresAt - Date.now() <= SESSION_REFRESH_LEEWAY_MS;
}

async function getActiveSupabaseSession(client: ReturnType<typeof assertSupabase>, options?: {allowRefresh?: boolean}) {
  let session: any = null;
  let lastError: any = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const sessionRes = await client.auth.getSession();
    if (!sessionRes.error && sessionRes.data.session?.access_token) {
      session = sessionRes.data.session;
      break;
    }
    lastError = sessionRes.error;
    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 180));
    }
  }

  if (!session) {
    const cached = useAuthStore.getState().session;
    if (cached?.accessToken && cached?.refreshToken) {
      const fingerprint = `${cached.accessToken.slice(0, 24)}:${cached.refreshToken.slice(0, 24)}`;
      if (!restoreSessionPromise || lastRestoredSessionFingerprint !== fingerprint) {
        lastRestoredSessionFingerprint = fingerprint;
        restoreSessionPromise = client.auth.setSession({
          access_token: cached.accessToken,
          refresh_token: cached.refreshToken
        }).finally(() => {
          restoreSessionPromise = null;
        });
      }
      const restored = await restoreSessionPromise;
      if (!restored.error && restored.data.session?.access_token) {
        session = restored.data.session;
      } else {
        lastError = restored.error || lastError;
      }
    }
  }

  if (!session && options?.allowRefresh !== false) {
    const refreshed = await client.auth.refreshSession();
    if (!refreshed.error && refreshed.data.session?.access_token) {
      session = refreshed.data.session;
    } else {
      lastError = refreshed.error || lastError;
    }
  }

  if (!session && lastError) throw lastError;

  if (session && options?.allowRefresh !== false && sessionExpiresSoon(session)) {
    const refreshed = await client.auth.refreshSession();
    if (!refreshed.error && refreshed.data.session) {
      session = refreshed.data.session;
    }
  }

  if (!session?.access_token) {
    throw new Error('NO_SESSION');
  }

  return session;
}

async function readAuthUser() {
  const client = assertSupabase();
  const session = await getActiveSupabaseSession(client, {allowRefresh: true});
  const userRes = await client.auth.getUser(session.access_token);
  if (!userRes.error && userRes.data.user) return userRes.data.user;

  const refreshed = await client.auth.refreshSession();
  if (!refreshed.error && refreshed.data.session?.access_token) {
    const retry = await client.auth.getUser(refreshed.data.session.access_token);
    if (!retry.error && retry.data.user) return retry.data.user;
    throw retry.error || new Error('NO_SESSION');
  }

  throw userRes.error || new Error('NO_SESSION');
}

async function selectWorkingHoursWithFallback(client: ReturnType<typeof assertSupabase>, salonId: string) {
  const salonPrimary = await client.from('salon_working_hours').select('*').eq('salon_id', salonId);
  const salonHours = salonPrimary.error ? await client.from('salon_hours').select('*').eq('salon_id', salonId) : salonPrimary;

  const employeePrimary = await client.from('employee_working_hours').select('*').eq('salon_id', salonId);
  const employeeHours = employeePrimary.error ? await client.from('employee_hours').select('*').eq('salon_id', salonId) : employeePrimary;

  return {
    salonHours: ((salonHours.data || []) as HourRow[]),
    employeeHours: ((employeeHours.data || []) as EmployeeHourRow[])
  };
}

function deriveSalonWindowFromHours(rows: HourRow[]) {
  const openRows = (rows || []).filter((row) => !row?.is_closed);
  if (!openRows.length) {
    return {workdayStart: '08:00', workdayEnd: '22:00'};
  }

  const sortedStarts = openRows
    .map((row) => parseHmToMinutes(toHHMM(row.open_time, '08:00'), 8 * 60))
    .sort((a, b) => a - b);
  const sortedEnds = openRows
    .map((row) => parseHmToMinutes(toHHMM(row.close_time, '22:00'), 22 * 60))
    .sort((a, b) => b - a);

  const start = sortedStarts[0] ?? 8 * 60;
  const end = sortedEnds[0] ?? 22 * 60;
  const startHours = String(Math.floor(start / 60)).padStart(2, '0');
  const startMins = String(start % 60).padStart(2, '0');
  const endHours = String(Math.floor(end / 60)).padStart(2, '0');
  const endMins = String(end % 60).padStart(2, '0');
  return {
    workdayStart: `${startHours}:${startMins}`,
    workdayEnd: `${endHours}:${endMins}`
  };
}

function buildStaffWorkingHours(rows: EmployeeHourRow[], staffId: string) {
  const entries = rows.filter((row) => String(row.staff_id || '') === staffId);
  const out: Record<number, {start: string; end: string; off?: boolean; breakStart?: string; breakEnd?: string}> = {};
  for (const row of entries) {
    const day = Number(row.day_of_week);
    if (!Number.isFinite(day)) continue;
    out[day] = {
      start: toHHMM(row.start_time, '08:00'),
      end: toHHMM(row.end_time, '22:00'),
      off: Boolean(row.is_off),
      breakStart: row.break_start ? toHHMM(row.break_start, '') : undefined,
      breakEnd: row.break_end ? toHHMM(row.break_end, '') : undefined
    };
  }
  return out;
}

function dateRangeForDay(dateIso: string) {
  const base = startOfDay(parseISO(dateIso));
  const end = endOfDay(base);
  return {base, startIso: base.toISOString(), endIso: end.toISOString()};
}

async function loadAvailabilityContext(client: ReturnType<typeof assertSupabase>, salonId: string, dateIso: string): Promise<AvailabilityContext> {
  const {startIso, endIso} = dateRangeForDay(dateIso);
  const [{salonHours, employeeHours}, timeOffRes] = await Promise.all([
    selectWorkingHoursWithFallback(client, salonId),
    client
      .from('employee_time_off')
      .select('id,staff_id,start_at,end_at')
      .eq('salon_id', salonId)
      .lt('start_at', endIso)
      .gt('end_at', startIso)
  ]);

  if (timeOffRes.error && !missingColumn(timeOffRes.error, 'employee_time_off')) {
    throw timeOffRes.error;
  }

  return {
    salonHours: (salonHours || []).map((row) => ({
      dayOfWeek: Number(row.day_of_week),
      openTime: row.open_time ? toHHMM(row.open_time, '08:00') : undefined,
      closeTime: row.close_time ? toHHMM(row.close_time, '22:00') : undefined,
      isClosed: Boolean(row.is_closed)
    })),
    employeeHours: (employeeHours || []).map((row) => ({
      staffId: String(row.staff_id || ''),
      dayOfWeek: Number(row.day_of_week),
      startTime: row.start_time ? toHHMM(row.start_time, '08:00') : undefined,
      endTime: row.end_time ? toHHMM(row.end_time, '22:00') : undefined,
      isOff: Boolean(row.is_off),
      breakStart: row.break_start ? toHHMM(row.break_start, '') : undefined,
      breakEnd: row.break_end ? toHHMM(row.break_end, '') : undefined
    })),
    timeOff: ((timeOffRes.data || []) as TimeOffRow[]).map((row) => ({
      id: String(row.id || ''),
      staffId: String(row.staff_id || ''),
      startAt: String(row.start_at || ''),
      endAt: String(row.end_at || '')
    }))
  };
}

function ensureBookingAllowed(params: {
  staffId: string;
  startAt: string;
  endAt: string;
  bookings: Booking[];
  availability: AvailabilityContext;
  excludeBookingId?: string;
}) {
  const {staffId, startAt, endAt, bookings, availability, excludeBookingId} = params;
  const start = parseISO(startAt);
  const end = parseISO(endAt);
  const result = validateBooking({
    employeeId: staffId,
    start,
    end,
    bookings: bookings.map((row) => ({
      id: row.id,
      staff_id: row.staffId,
      appointment_start: row.startAt,
      appointment_end: row.endAt,
      status: toDbBookingStatus(row.status)
    })),
    timeOff: availability.timeOff.map((row) => ({
      id: row.id,
      staff_id: row.staffId,
      start_at: row.startAt,
      end_at: row.endAt
    })),
    salonHours: availability.salonHours.map((row) => ({
      day_of_week: row.dayOfWeek,
      open_time: row.openTime || null,
      close_time: row.closeTime || null,
      is_closed: row.isClosed || false
    })),
    employeeHours: availability.employeeHours.map((row) => ({
      staff_id: row.staffId,
      day_of_week: row.dayOfWeek,
      start_time: row.startTime || null,
      end_time: row.endTime || null,
      is_off: row.isOff || false,
      break_start: row.breakStart || null,
      break_end: row.breakEnd || null
    })),
    excludeBookingId
  });
  if (!result.ok) {
    throw new Error(String(result.reason || 'slot_unavailable'));
  }
}

async function sendBookingNotification(event: 'booking_created' | 'booking_updated' | 'booking_status_changed', payload: Record<string, unknown>) {
  try {
    await invokeEdgeWithLog('notify-booking-event', {event, ...payload});
  } catch (error) {
    if (__DEV__) {
      pushDevLog('warn', 'edge.notify', 'Booking notification dispatch failed', {
        event,
        error: String((error as any)?.message || error || 'unknown')
      });
    }
  }
}

async function syncEmployeeHours(
  client: ReturnType<typeof assertSupabase>,
  salonId: string,
  staffId: string,
  workingHours?: UpsertStaffInput['workingHours']
) {
  if (!workingHours) return;
  const payload = Array.from({length: 7}, (_row, dayOfWeek) => {
    const row = workingHours[dayOfWeek] || {start: '08:00', end: '22:00', off: false};
    return {
      salon_id: salonId,
      staff_id: staffId,
      day_of_week: dayOfWeek,
      start_time: `${toHHMM(row.start, '08:00')}:00`,
      end_time: `${toHHMM(row.end, '22:00')}:00`,
      is_off: Boolean(row.off),
      break_start: row.breakStart ? `${toHHMM(row.breakStart, '12:00')}:00` : null,
      break_end: row.breakEnd ? `${toHHMM(row.breakEnd, '13:00')}:00` : null
    };
  });
  const upsert = await client.from('employee_hours').upsert(payload as any, {onConflict: 'staff_id,day_of_week'});
  if (upsert.error) throw upsert.error;
}

async function readOwnerContext(): Promise<OwnerContext> {
  const client = assertSupabase();
  const user = await readAuthUser();
  const store = useAuthStore.getState();
  const profile: UserProfile = {
    id: String(user.id),
    phone: String(user.phone || user.user_metadata?.phone || ''),
    displayName: String(user.user_metadata?.display_name || 'Owner'),
    role: 'OWNER',
    salonId:
      String(store.activeSalonId || store.context?.salon?.id || user.user_metadata?.salon_id || user.app_metadata?.salon_id || '') || null,
    createdAt: String(user.created_at || new Date().toISOString())
  };

  let salonId = profile.salonId;
  if (!salonId) {
    const membershipRes = await client
      .from('salon_members')
      .select('salon_id,role')
      .eq('user_id', user.id)
      .eq('status', 'ACTIVE')
      .order('joined_at', {ascending: false})
      .limit(1)
      .maybeSingle();
    if (!membershipRes.error && membershipRes.data?.salon_id) {
        salonId = String(membershipRes.data.salon_id);
        profile.salonId = salonId;
        profile.role = String((membershipRes.data as any).role || '').toUpperCase() === 'MANAGER'
          ? 'MANAGER'
          : String((membershipRes.data as any).role || '').toUpperCase() === 'STAFF'
            ? 'STAFF'
            : 'OWNER';
      useAuthStore.getState().setActiveSalonId(salonId);
    }
  }
  if (salonId) {
    const roleRes = await client
      .from('salon_members')
      .select('role')
      .eq('salon_id', salonId)
      .eq('user_id', user.id)
      .eq('status', 'ACTIVE')
      .maybeSingle();
    if (!roleRes.error && roleRes.data?.role) {
      profile.role =
        String((roleRes.data as any).role || '').toUpperCase() === 'MANAGER'
          ? 'MANAGER'
          : String((roleRes.data as any).role || '').toUpperCase() === 'STAFF'
            ? 'STAFF'
            : 'OWNER';
    }
  }
  if (!salonId) return {user: profile, salon: null};

  const [salonRes, hoursRes] = await Promise.all([
    client
      .from('salons')
      .select('id,name,slug,whatsapp,status,area,address,address_text,city,location_lat,location_lng,location_label,country_code,currency_code,created_by,created_at,updated_at')
      .eq('id', salonId)
      .maybeSingle(),
    selectWorkingHoursWithFallback(client, salonId)
  ]);
  const salonRow = salonRes.data;

  if (!salonRow) return {user: profile, salon: null};
  if (String((salonRow as any).created_by || '') === profile.id) {
    profile.role = 'OWNER';
  }

  const derivedWindow = deriveSalonWindowFromHours(hoursRes.salonHours);

  const salon: Salon = {
    id: String(salonRow.id),
    ownerId: profile.id,
    name: String(salonRow.name || 'Salon'),
    slug: String(salonRow.slug || ''),
    phone: String((salonRow as any).whatsapp || ''),
    countryCode: String((salonRow as any).country_code || 'IQ'),
    currencyCode: String((salonRow as any).currency_code || ''),
    locationLabel: String((salonRow as any).location_label || (salonRow as any).area || (salonRow as any).city || ''),
    locationAddress: String((salonRow as any).address_text || (salonRow as any).address || (salonRow as any).area || ''),
    locationLat: Number.isFinite(Number((salonRow as any).location_lat)) ? Number((salonRow as any).location_lat) : undefined,
    locationLng: Number.isFinite(Number((salonRow as any).location_lng)) ? Number((salonRow as any).location_lng) : undefined,
    status: normalizeSalonStatus((salonRow as any).status),
    workdayStart: derivedWindow.workdayStart,
    workdayEnd: derivedWindow.workdayEnd,
    publicBookingUrl: salonRow.slug ? `/s/${salonRow.slug}` : undefined,
    createdAt: String((salonRow as any).created_at || new Date().toISOString()),
    updatedAt: String((salonRow as any).updated_at || new Date().toISOString())
  };

  return {user: {...profile, salonId: salon.id}, salon};
}

function toSession(value: any): AuthSession {
  return {
    accessToken: String(value?.access_token || ''),
    refreshToken: String(value?.refresh_token || ''),
    userId: String(value?.user?.id || ''),
    phone: String(value?.user?.phone || value?.user?.user_metadata?.phone || ''),
    expiresAt: value?.expires_at ? Number(value.expires_at) * 1000 : undefined
  };
}

async function safeListBookings(salonId: string, date: string, mode: 'day' | 'week' | 'list'): Promise<Booking[]> {
  const client = assertSupabase();
  const base = parseISO(date);
  const from =
    mode === 'week'
      ? startOfWeek(base, {weekStartsOn: 1})
      : mode === 'list'
        ? startOfDay(new Date(base.getTime() - 30 * 24 * 60 * 60 * 1000))
        : startOfDay(base);
  const to =
    mode === 'week'
      ? endOfDay(new Date(from.getTime() + 6 * 24 * 60 * 60 * 1000))
      : mode === 'list'
        ? endOfDay(new Date(base.getTime() + 365 * 24 * 60 * 60 * 1000))
        : endOfDay(base);

  const {data, error} = await client
    .from('bookings')
    .select('id,salon_id,staff_id,service_id,customer_name,customer_phone,appointment_start,appointment_end,status,created_at,notes')
    .eq('salon_id', salonId)
    .gte('appointment_start', from.toISOString())
    .lte('appointment_start', to.toISOString())
    .order('appointment_start', {ascending: true});

  if (error) return [];

  return (data || []).map((row: any) => ({
    ...mapBookingRow(row)
  }));
}

async function listSalonBookingsAll(salonId: string): Promise<Booking[]> {
  const client = assertSupabase();
  const {data, error} = await client
    .from('bookings')
    .select('id,salon_id,staff_id,service_id,customer_name,customer_phone,appointment_start,appointment_end,status,created_at,notes')
    .eq('salon_id', salonId)
    .order('appointment_start', {ascending: false})
    .limit(1000);
  if (error) return [];
  return (data || []).map((row: any) => mapBookingRow(row));
}

async function nextSortOrder(client: ReturnType<typeof assertSupabase>, table: 'staff' | 'services', salonId: string) {
  const {data} = await client
    .from(table)
    .select('sort_order')
    .eq('salon_id', salonId)
    .order('sort_order', {ascending: false})
    .limit(1)
    .maybeSingle();
  const current = Number((data as any)?.sort_order || 0);
  return Number.isFinite(current) ? current + 10 : 10;
}

async function syncStaffServiceAssignments(client: ReturnType<typeof assertSupabase>, salonId: string, params: {staffId?: string; serviceId?: string; nextIds: string[]}) {
  if (!params.staffId && !params.serviceId) return;

  let query = client.from('staff_services').select('staff_id,service_id').eq('salon_id', salonId);
  if (params.staffId) query = query.eq('staff_id', params.staffId);
  if (params.serviceId) query = query.eq('service_id', params.serviceId);

  const currentRes = await query;
  if (currentRes.error) throw currentRes.error;

  const currentRows = currentRes.data || [];
  const currentSet = new Set(
    currentRows.map((row: any) =>
      params.staffId ? String(row.service_id || '') : String(row.staff_id || '')
    )
  );
  const nextSet = new Set(params.nextIds.map((id) => String(id)));

  const toDelete = Array.from(currentSet).filter((id) => !nextSet.has(id));
  const toInsert = Array.from(nextSet).filter((id) => !currentSet.has(id));

  if (toDelete.length > 0) {
    let del = client.from('staff_services').delete().eq('salon_id', salonId);
    if (params.staffId) {
      del = del.eq('staff_id', params.staffId).in('service_id', toDelete);
    } else {
      del = del.eq('service_id', params.serviceId!).in('staff_id', toDelete);
    }
    const delRes = await del;
    if (delRes.error) throw delRes.error;
  }

  if (toInsert.length > 0) {
    const rows = toInsert.map((id) => ({
      salon_id: salonId,
      staff_id: params.staffId || id,
      service_id: params.serviceId || id
    }));
    const insRes = await client.from('staff_services').upsert(rows, {onConflict: 'staff_id,service_id'});
    if (insRes.error) throw insRes.error;
  }
}

async function ensureReminderDefaults(client: ReturnType<typeof assertSupabase>, salonId: string) {
  const payload = DEFAULT_REMINDER_RULES.map((row) => ({
    salon_id: salonId,
    channel: row.channel,
    type: row.type,
    enabled: false
  }));
  await client.from('salon_reminders').upsert(payload as any, {onConflict: 'salon_id,channel,type'});
}

export const supabaseApi: CareChairApi = {
  auth: {
    getSession: async () => {
      const client = assertSupabase();
      try {
        const session = await getActiveSupabaseSession(client, {allowRefresh: true});
        return toSession(session);
      } catch {
        return null;
      }
    },
    sendOtp: async (phone) => {
      const client = assertSupabase();
      const normalizedPhone = toPhoneWithPlus(phone);
      if (!normalizedPhone) throw new Error('INVALID_PHONE_E164');

      const canUseDevBypass = __DEV__ && env.devOtpBypass;
      if (canUseDevBypass) {
        const runtime = await client.auth.getSession();
        const cached = useAuthStore.getState().session;
        const hasReusableSession = Boolean(runtime.data.session?.access_token || (cached?.accessToken && cached?.refreshToken));
        if (hasReusableSession) {
          pushDevLog('info', 'auth.sendOtp', 'DEV OTP bypass enabled, skipping provider SMS', {
            phone: `${normalizedPhone.slice(0, 5)}***${normalizedPhone.slice(-2)}`,
          });
          return {channel: 'sms'};
        }
      }

      if (__DEV__) {
        pushDevLog('info', 'auth.sendOtp', 'Sending OTP via Supabase', {
          phone: `${normalizedPhone.slice(0, 5)}***${normalizedPhone.slice(-2)}`
        });
      }
      const {error} = await client.auth.signInWithOtp({phone: normalizedPhone, options: {channel: 'sms', shouldCreateUser: true}});
      if (error) throw error;
      if (__DEV__) {
        pushDevLog('info', 'auth.sendOtp', 'Supabase accepted OTP request');
      }
      return {channel: 'sms'};
    },
    verifyOtp: async (phone, code) => {
      const client = assertSupabase();
      const normalizedPhone = toPhoneWithPlus(phone);
      if (!normalizedPhone) throw new Error('INVALID_PHONE_E164');

      const canUseDevBypass = __DEV__ && env.devOtpBypass && String(code || '').trim() === env.devOtpBypassCode;
      if (canUseDevBypass) {
        const runtime = await client.auth.getSession();
        if (!runtime.error && runtime.data.session) {
          pushDevLog('info', 'auth.verifyOtp', 'DEV OTP bypass accepted using runtime session', {
            hasAccessToken: Boolean(runtime.data.session.access_token),
            expiresAt: Number(runtime.data.session.expires_at || 0) * 1000 || null,
            userId: String(runtime.data.session.user?.id || '')
          });
          return toSession(runtime.data.session);
        }
        const cached = useAuthStore.getState().session;
        if (cached?.accessToken && cached.refreshToken) {
          const restored = await client.auth.setSession({
            access_token: cached.accessToken,
            refresh_token: cached.refreshToken
          });
          if (!restored.error && restored.data.session) {
            pushDevLog('info', 'auth.verifyOtp', 'DEV OTP bypass accepted using restored cached session', {
              hasAccessToken: Boolean(restored.data.session.access_token),
              expiresAt: Number(restored.data.session.expires_at || 0) * 1000 || null,
              userId: String(restored.data.session.user?.id || '')
            });
            return toSession(restored.data.session);
          }
        }
        pushDevLog('info', 'auth.verifyOtp', 'DEV OTP bypass requested but no reusable session was found; falling back to Supabase verify');
      }

      const {data, error} = await client.auth.verifyOtp({phone: normalizedPhone, token: code, type: 'sms'});
      if (error || !data.session) throw error || new Error('OTP_FAILED');
      const restored = await client.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
      });
      if (restored.error && __DEV__) {
        pushDevLog('warn', 'auth.verifyOtp', 'OTP verify succeeded but runtime setSession did not settle immediately; using verified session payload', {
          error: String(restored.error?.message || restored.error)
        });
      }

      const settledSession = restored.data.session || data.session;
      if (__DEV__) {
        pushDevLog('info', 'auth.verifyOtp', 'OTP verification succeeded', {
          hasAccessToken: Boolean(settledSession.access_token),
          expiresAt: Number(settledSession.expires_at || 0) * 1000 || null,
          userId: String(settledSession.user?.id || '')
        });
      }
      return toSession(settledSession);
    },
    signOut: async () => {
      const client = assertSupabase();
      await client.auth.signOut();
    }
  },
  owner: {
    getContext: async () => readOwnerContext(),
    getAvailabilityContext: async (dateIso) => {
      const context = await readOwnerContext();
      if (!context.salon) throw new Error('SALON_REQUIRED');
      const client = assertSupabase();
      return loadAvailabilityContext(client, context.salon.id, dateIso);
    },
    createOrClaimSalon: async (input: CreateSalonInput) => {
      const client = assertSupabase();
      const user = await readAuthUser();
      const slugBase = normalizeSlug(input.name) || `salon-${Date.now().toString(36)}`;
      const generatedPasscode = String(input.phone || '').replace(/\D/g, '').slice(-6) || '123456';

      let salonId = '';
      let slug = slugBase;
      let createdAt = new Date().toISOString();
      let updatedAt = createdAt;
      let rawStatus: unknown = 'DRAFT';

      const rpcPayload = {
        salon: {
          name: input.name.trim(),
          slug: slugBase,
          country_code: 'IQ',
          city: input.locationLabel || 'City',
          whatsapp: input.phone,
          admin_passcode: generatedPasscode,
          language_default: 'ar'
        },
        location: {
          label: input.locationLabel || 'Main Branch',
          country_code: 'IQ',
          city: input.locationLabel || null,
          address_line: input.locationAddress || null,
          formatted_address: input.locationAddress || null,
          lat: null,
          lng: null,
          provider: 'manual',
          provider_place_id: null,
          is_primary: true
        },
        working_hours: Array.from({length: 7}, (_r, d) => ({
          day_of_week: d,
          is_closed: false,
          open_time: String(input.workdayStart || '08:00').slice(0, 5),
          close_time: String(input.workdayEnd || '22:00').slice(0, 5)
        })),
        employees: [],
        services: []
      };

      const rpc = await client.rpc('create_salon_onboarding', {payload: rpcPayload});
      if (!rpc.error) {
        salonId = String((rpc.data as any)?.salon_id || '');
        slug = String((rpc.data as any)?.slug || slugBase);
      }

      if (!salonId) {
        let insertPayload: Record<string, unknown> = {
          name: input.name.trim(),
          slug: slugBase,
          area: input.locationAddress || input.locationLabel || null,
          whatsapp: input.phone,
          admin_passcode: generatedPasscode,
          country_code: 'IQ',
          language_default: 'ar',
          status: toDbSalonStatus('DRAFT'),
          created_by: user.id
        };

        let insert = await client.from('salons').insert(insertPayload as any).select('id,slug,status,created_at,updated_at').single();

        if (insert.error && missingColumn(insert.error, 'language_default')) {
          const {language_default: _dropLanguage, ...fallbackPayload} = insertPayload;
          insertPayload = fallbackPayload;
          insert = await client.from('salons').insert(insertPayload as any).select('id,slug,status,created_at,updated_at').single();
        }

        if (insert.error && missingColumn(insert.error, 'country_code')) {
          const {country_code: _dropCountry, ...fallbackPayload} = insertPayload;
          insertPayload = fallbackPayload;
          insert = await client.from('salons').insert(insertPayload as any).select('id,slug,status,created_at,updated_at').single();
        }

        if (insert.error || !insert.data?.id) {
          throw insert.error || rpc.error || new Error('SALON_CREATE_FAILED');
        }

        salonId = String((insert.data as any).id);
        slug = String((insert.data as any).slug || slugBase);
        rawStatus = (insert.data as any).status || 'DRAFT';
        createdAt = String((insert.data as any).created_at || createdAt);
        updatedAt = String((insert.data as any).updated_at || updatedAt);
      }

      await client.from('salon_hours').upsert(
        Array.from({length: 7}, (_row, dayIndex) => ({
          salon_id: salonId,
          day_of_week: dayIndex,
          open_time: `${String(input.workdayStart || '08:00').slice(0, 5)}:00`,
          close_time: `${String(input.workdayEnd || '22:00').slice(0, 5)}:00`,
          is_closed: false
        })),
        {onConflict: 'salon_id,day_of_week'}
      );

      const {error: updateUserError} = await client.auth.updateUser({
        data: {salon_id: salonId, salon_slug: slug, role: 'salon_admin'}
      });
      if (updateUserError) {
        // Do not block onboarding completion if metadata patch fails; context can still proceed in-memory.
        console.warn('[Onboarding] user metadata update skipped', updateUserError);
      }

      return {
        id: salonId,
        ownerId: String(user.id),
        name: input.name,
        slug,
        phone: input.phone,
        locationLabel: input.locationLabel,
        locationAddress: input.locationAddress,
        status: normalizeSalonStatus(rawStatus),
        workdayStart: input.workdayStart,
        workdayEnd: input.workdayEnd,
        publicBookingUrl: slug ? `/s/${slug}` : undefined,
        createdAt,
        updatedAt
      };
    },
    requestActivation: async (input: RequestActivationInput) => {
      const context = await readOwnerContext();
      if (!context.salon) throw new Error('SALON_REQUIRED');
      return requestSalonActivationV2(context.salon.id, input);
    },
    updateSalonProfile: async (patch) => {
      const context = await readOwnerContext();
      if (!context.salon) throw new Error('SALON_REQUIRED');
      const client = assertSupabase();
      const {error} = await client.from('salons').update({name: patch.name, area: patch.locationAddress, whatsapp: patch.phone} as any).eq('id', context.salon.id);
      if (error) throw error;
      return {...context.salon, ...patch, updatedAt: new Date().toISOString()};
    },
    deleteAccount: async () => {
      await invokeEdgeWithLog('delete-account', {});
      useAuthStore.getState().clear();
      try {
        await assertSupabase().auth.signOut();
      } catch {
        // Auth user can already be deleted on the backend.
      }
    }
  },
  dashboard: {
    getSummary: async (dateIso) => {
      const context = await readOwnerContext();
      if (!context.salon) throw new Error('SALON_REQUIRED');
      const bookings = await safeListBookings(context.salon.id, dateIso, 'day');
      const services = await supabaseApi.services.list();
      const priceByService = new Map(services.map((row) => [row.id, Number(row.price || 0)]));
      const nextAppointment = bookings.find((row) => +new Date(row.startAt) > Date.now()) || null;
      const noShows = bookings.filter((row) => row.status === 'no_show').length;
      const revenue = bookings
        .filter((row) => row.status === 'completed' || row.status === 'confirmed' || row.status === 'pending')
        .reduce((sum, row) => sum + Number(priceByService.get(row.serviceId) || 0), 0);
      return {
        bookingsCount: bookings.length,
        revenue,
        revenueFormatted: formatSalonOperationalCurrencyMobile(revenue, context.salon, 'en'),
        noShows,
        availableSlots: Math.max(0, 28 - bookings.length),
        nextAppointment
      } as DashboardSummary;
    },
    listEvents: async (limit = 10) => {
      const context = await readOwnerContext();
      if (!context.salon) throw new Error('SALON_REQUIRED');
      const bookings = await listSalonBookingsAll(context.salon.id);
      return bookings.slice(0, limit).map((row) => ({
        id: row.id,
        salonId: context.salon!.id,
        type:
          row.status === 'completed'
            ? 'booking_completed'
            : row.status === 'no_show'
              ? 'booking_no_show'
              : row.status === 'canceled'
                ? 'booking_cancelled'
                : 'booking_new',
        title:
          row.status === 'completed'
            ? 'Booking completed'
            : row.status === 'no_show'
              ? 'No-show recorded'
              : row.status === 'canceled'
                ? 'Booking cancelled'
                : 'New booking',
        description: `${row.clientName} • ${row.startAt}`,
        createdAt: row.updatedAt || row.createdAt,
        bookingId: row.id,
        clientId: row.clientId || undefined
      }));
    }
  },
  bookings: {
    list: async (params) => {
      const context = await readOwnerContext();
      if (!context.salon) throw new Error('SALON_REQUIRED');
      const bookings = await safeListBookings(context.salon.id, params.date, params.mode);
      if (!params.staffId) return bookings;
      return bookings.filter((row) => row.staffId === params.staffId);
    },
    create: async (input: CreateBookingInput) => {
      const context = await readOwnerContext();
      if (!context.salon) throw new Error('SALON_REQUIRED');
      const client = assertSupabase();
      const [bookings, availability, serviceLinkRes] = await Promise.all([
        safeListBookings(context.salon.id, input.startAt, 'day'),
        loadAvailabilityContext(client, context.salon.id, input.startAt),
        input.serviceId === 'blocked'
          ? Promise.resolve({data: [{staff_id: input.staffId}], error: null} as any)
          : client
          .from('staff_services')
          .select('staff_id')
          .eq('salon_id', context.salon.id)
          .eq('staff_id', input.staffId)
          .eq('service_id', input.serviceId)
          .limit(1)
      ]);
      if (serviceLinkRes.error) throw serviceLinkRes.error;
      if (!(serviceLinkRes.data || []).length) throw new Error('invalid_service_staff');
      ensureBookingAllowed({
        staffId: input.staffId,
        startAt: input.startAt,
        endAt: input.endAt,
        bookings,
        availability
      });
      const payload = {
        salon_id: context.salon.id,
        staff_id: input.staffId,
        service_id: input.serviceId,
        customer_name: input.clientName,
        customer_phone: input.clientPhone,
        appointment_start: input.startAt,
        appointment_end: input.endAt,
        status: toDbBookingStatus(input.status || 'pending'),
        notes: input.notes || null
      };
      const {data, error} = await client.from('bookings').insert([payload]).select('*').single();
      if (error || !data) throw error || new Error('CREATE_FAILED');
      await sendBookingNotification('booking_created', {
        salonId: context.salon.id,
        bookingId: String((data as any).id || ''),
        title: 'New booking',
        body: `${String((data as any).customer_name || 'Client')} • ${String((data as any).appointment_start || '')}`
      });
      return mapBookingRow(data as any);
    },
    updateStatus: async (bookingId, status) => {
      const context = await readOwnerContext();
      if (!context.salon) throw new Error('SALON_REQUIRED');
      const client = assertSupabase();
      const current = await client.from('bookings').select('*').eq('id', bookingId).eq('salon_id', context.salon.id).single();
      if (current.error || !current.data) throw current.error || new Error('UPDATE_FAILED');

      const patch =
        status === 'completed' || status === 'no_show'
          ? {notes: withVirtualStatus((current.data as any).notes, status)}
          : {status: toDbBookingStatus(status), notes: stripVirtualStatus((current.data as any).notes) || null};

      const {data, error} = await client.from('bookings').update(patch as any).eq('id', bookingId).eq('salon_id', context.salon.id).select('*').single();
      if (error || !data) throw error || new Error('UPDATE_FAILED');
      const mapped = mapBookingRow(data as any);
      await sendBookingNotification('booking_status_changed', {
        salonId: context.salon.id,
        bookingId: String((data as any).id || bookingId),
        title: 'Booking updated',
        body: `${mapped.clientName} • ${status}`
      });
      return status === 'completed' || status === 'no_show' ? {...mapped, status} : mapped;
    },
    reschedule: async (input: RescheduleBookingInput) => {
      const patch: any = {
        appointment_start: input.startAt,
        appointment_end: input.endAt
      };
      if (input.staffId) patch.staff_id = input.staffId;
      const context = await readOwnerContext();
      if (!context.salon) throw new Error('SALON_REQUIRED');
      const client = assertSupabase();
      const bookingRes = await client
        .from('bookings')
        .select('id,service_id,staff_id')
        .eq('id', input.bookingId)
        .eq('salon_id', context.salon.id)
        .single();
      if (bookingRes.error || !bookingRes.data) throw bookingRes.error || new Error('RESCHEDULE_FAILED');
      const targetStaffId = String(input.staffId || (bookingRes.data as any).staff_id || '');
      if (!targetStaffId) throw new Error('select_employee');
      if (input.staffId) {
        const linkRes = await client
          .from('staff_services')
          .select('staff_id')
          .eq('salon_id', context.salon.id)
          .eq('staff_id', targetStaffId)
          .eq('service_id', String((bookingRes.data as any).service_id || ''))
          .limit(1);
        if (linkRes.error) throw linkRes.error;
        if (!(linkRes.data || []).length) throw new Error('invalid_service_staff');
      }
      const [bookings, availability] = await Promise.all([
        safeListBookings(context.salon.id, input.startAt, 'day'),
        loadAvailabilityContext(client, context.salon.id, input.startAt)
      ]);
      ensureBookingAllowed({
        staffId: targetStaffId,
        startAt: input.startAt,
        endAt: input.endAt,
        bookings,
        availability,
        excludeBookingId: input.bookingId
      });
      const {data, error} = await client.from('bookings').update(patch).eq('id', input.bookingId).eq('salon_id', context.salon.id).select('*').single();
      if (error || !data) throw error || new Error('RESCHEDULE_FAILED');
      await sendBookingNotification('booking_updated', {
        salonId: context.salon.id,
        bookingId: String((data as any).id || input.bookingId),
        title: 'Booking rescheduled',
        body: `${String((data as any).customer_name || 'Client')} • ${String((data as any).appointment_start || '')}`
      });
      return mapBookingRow(data as any);
    },
    blockTime: async (input: BlockTimeInput) => {
      const context = await readOwnerContext();
      if (!context.salon) throw new Error('SALON_REQUIRED');
      const client = assertSupabase();
      const [bookings, availability] = await Promise.all([
        safeListBookings(context.salon.id, input.startAt, 'day'),
        loadAvailabilityContext(client, context.salon.id, input.startAt)
      ]);
      ensureBookingAllowed({
        staffId: input.staffId,
        startAt: input.startAt,
        endAt: input.endAt,
        bookings,
        availability
      });
      return supabaseApi.bookings.create({
        clientName: input.reason || 'Blocked',
        clientPhone: '-',
        serviceId: 'blocked',
        staffId: input.staffId,
        startAt: input.startAt,
        endAt: input.endAt,
        status: 'blocked',
        notes: input.reason
      });
    },
    remove: async (bookingId) => {
      const context = await readOwnerContext();
      if (!context.salon) throw new Error('SALON_REQUIRED');
      const client = assertSupabase();
      const res = await client
        .from('bookings')
        .delete()
        .eq('id', bookingId)
        .eq('salon_id', context.salon.id);
      if (res.error) throw res.error;
      await sendBookingNotification('booking_status_changed', {
        salonId: context.salon.id,
        bookingId,
        title: 'Booking deleted',
        body: 'A booking was deleted'
      });
    }
  },
  clients: {
    list: async (query) => {
      const context = await readOwnerContext();
      if (!context.salon) throw new Error('SALON_REQUIRED');
      const bookings = await listSalonBookingsAll(context.salon.id);
      const map = new Map<string, Client>();

      for (const row of bookings) {
        const key = String(row.clientPhone || row.clientName || row.id);
        const existing = map.get(key);
        const lastVisitAt = existing?.lastVisitAt && new Date(existing.lastVisitAt).getTime() > new Date(row.startAt).getTime()
          ? existing.lastVisitAt
          : row.startAt;
        map.set(key, {
          id: existing?.id || key || slugifyTempId('client'),
          salonId: context.salon.id,
          name: row.clientName || existing?.name || 'Client',
          phone: row.clientPhone || existing?.phone || '-',
          notes: existing?.notes,
          totalSpend: existing?.totalSpend || 0,
          lastVisitAt,
          createdAt: existing?.createdAt || row.createdAt
        });
      }

      const term = String(query || '').trim().toLowerCase();
      return Array.from(map.values())
        .filter((row) => !term || row.name.toLowerCase().includes(term) || row.phone.toLowerCase().includes(term))
        .sort((a, b) => +new Date(b.lastVisitAt || b.createdAt) - +new Date(a.lastVisitAt || a.createdAt));
    },
    getById: async () => null,
    create: async (input: CreateClientInput) => {
      return {
        id: slugifyTempId('client'),
        salonId: useAuthStore.getState().context?.salon?.id || 'unknown',
        name: input.name,
        phone: input.phone,
        notes: input.notes,
        totalSpend: 0,
        createdAt: new Date().toISOString()
      };
    },
    update: async (_clientId, patch) => {
      return {
        id: `tmp_${Date.now()}`,
        salonId: 'unknown',
        name: String(patch.name || ''),
        phone: String(patch.phone || ''),
        notes: patch.notes,
        totalSpend: Number(patch.totalSpend || 0),
        createdAt: new Date().toISOString()
      };
    },
    history: async (clientId) => {
      const context = await readOwnerContext();
      if (!context.salon) throw new Error('SALON_REQUIRED');
      const bookings = await listSalonBookingsAll(context.salon.id);
      return bookings.filter((row) => String(row.clientPhone || row.clientName || row.id) === String(clientId));
    }
  },
  staff: {
    list: async () => {
      const context = await readOwnerContext();
      if (!context.salon) throw new Error('SALON_REQUIRED');
      const client = assertSupabase();
      const [staffRes, linksRes, hoursRes] = await Promise.all([
        client.from('staff').select('id,name,role,phone,photo_url,is_active').eq('salon_id', context.salon.id).eq('is_active', true),
        client.from('staff_services').select('staff_id,service_id').eq('salon_id', context.salon.id),
        selectWorkingHoursWithFallback(client, context.salon.id)
      ]);
      if (staffRes.error) return [];
      const serviceIdsByStaff = new Map<string, string[]>();
      for (const row of linksRes.data || []) {
        const key = String((row as any).staff_id || '');
        const list = serviceIdsByStaff.get(key) || [];
        list.push(String((row as any).service_id || ''));
        serviceIdsByStaff.set(key, list);
      }
      return (staffRes.data || []).map((row: any, index: number) => ({
        id: String(row.id),
        salonId: context.salon!.id,
        name: String(row.name || ''),
        roleTitle: String(row.role || 'Staff'),
        phone: String(row.phone || ''),
        avatarUrl: String(row.photo_url || ''),
        color: ['#2563EB', '#0EA5E9', '#14B8A6', '#F59E0B'][index % 4],
        isActive: true,
        serviceIds: serviceIdsByStaff.get(String(row.id)) || [],
        workingHours: buildStaffWorkingHours(hoursRes.employeeHours, String(row.id))
      }));
    },
    upsert: async (input: UpsertStaffInput) => {
      const context = await readOwnerContext();
      if (!context.salon) throw new Error('SALON_REQUIRED');
      const client = assertSupabase();
      const staffId = String(input.id || '').trim();

      if (staffId) {
        const updateRes = await client
          .from('staff')
          .update({
            name: input.name,
            role: input.roleTitle,
            phone: input.phone || null
          } as any)
          .eq('id', staffId)
          .eq('salon_id', context.salon.id)
          .select('id,name,role,phone,photo_url,is_active')
          .single();
        if (updateRes.error || !updateRes.data) throw updateRes.error || new Error('STAFF_UPDATE_FAILED');
        await syncStaffServiceAssignments(client, context.salon.id, {
          staffId,
          nextIds: input.serviceIds || []
        });
        await syncEmployeeHours(client, context.salon.id, staffId, input.workingHours);
        return {
          id: String(updateRes.data.id),
          salonId: context.salon.id,
          name: String(updateRes.data.name || ''),
          roleTitle: String((updateRes.data as any).role || input.roleTitle || 'Staff'),
          phone: String((updateRes.data as any).phone || ''),
          avatarUrl: String((updateRes.data as any).photo_url || ''),
          color: input.color,
          isActive: (updateRes.data as any).is_active !== false,
          serviceIds: input.serviceIds || [],
          workingHours: input.workingHours || {}
        };
      }

      const sortOrder = await nextSortOrder(client, 'staff', context.salon.id);
      const insertRes = await client
        .from('staff')
        .insert({
          salon_id: context.salon.id,
          name: input.name,
          role: input.roleTitle,
          phone: input.phone || null,
          sort_order: sortOrder,
          is_active: true
        } as any)
        .select('id,name,role,phone,photo_url,is_active')
        .single();
      if (insertRes.error || !insertRes.data) throw insertRes.error || new Error('STAFF_CREATE_FAILED');
      const createdStaffId = String(insertRes.data.id);
      await syncStaffServiceAssignments(client, context.salon.id, {
        staffId: createdStaffId,
        nextIds: input.serviceIds || []
      });
      await syncEmployeeHours(client, context.salon.id, createdStaffId, input.workingHours);
      return {
        id: createdStaffId,
        salonId: context.salon.id,
        name: String(insertRes.data.name || ''),
        roleTitle: String((insertRes.data as any).role || input.roleTitle || 'Staff'),
        phone: String((insertRes.data as any).phone || ''),
        avatarUrl: String((insertRes.data as any).photo_url || ''),
        color: input.color,
        isActive: (insertRes.data as any).is_active !== false,
        serviceIds: input.serviceIds || [],
        workingHours: input.workingHours || {}
      };
    }
  },
  services: {
    list: async () => {
      const context = await readOwnerContext();
      if (!context.salon) throw new Error('SALON_REQUIRED');
      const client = assertSupabase();
      const [servicesRes, linksRes] = await Promise.all([
        client.from('services').select('id,name,duration_minutes,price,is_active,category').eq('salon_id', context.salon.id),
        client.from('staff_services').select('staff_id,service_id').eq('salon_id', context.salon.id)
      ]);
      if (servicesRes.error) return [];
      const staffIdsByService = new Map<string, string[]>();
      for (const row of linksRes.data || []) {
        const key = String((row as any).service_id || '');
        const list = staffIdsByService.get(key) || [];
        list.push(String((row as any).staff_id || ''));
        staffIdsByService.set(key, list);
      }
      return (servicesRes.data || []).map((row: any) => ({
        id: String(row.id),
        salonId: context.salon!.id,
        name: String(row.name || ''),
        durationMin: Number(row.duration_minutes || 30),
        price: Number(row.price || 0),
        isActive: row.is_active !== false,
        category: String(row.category || ''),
        assignedStaffIds: staffIdsByService.get(String(row.id)) || []
      }));
    },
    upsert: async (input: UpsertServiceInput) => {
      const context = await readOwnerContext();
      if (!context.salon) throw new Error('SALON_REQUIRED');
      const client = assertSupabase();
      const serviceId = String(input.id || '').trim();

      if (serviceId) {
        const updateRes = await client
          .from('services')
          .update({
            name: input.name,
            duration_minutes: input.durationMin,
            price: input.price,
            category: input.category || null,
            is_active: input.isActive !== false
          } as any)
          .eq('id', serviceId)
          .eq('salon_id', context.salon.id)
          .select('id,name,duration_minutes,price,is_active,category')
          .single();
        if (updateRes.error || !updateRes.data) throw updateRes.error || new Error('SERVICE_UPDATE_FAILED');
        await syncStaffServiceAssignments(client, context.salon.id, {
          serviceId,
          nextIds: input.assignedStaffIds || []
        });
        return {
          id: String(updateRes.data.id),
          salonId: context.salon.id,
          name: String(updateRes.data.name || ''),
          durationMin: Number((updateRes.data as any).duration_minutes || 30),
          price: Number((updateRes.data as any).price || 0),
          category: String((updateRes.data as any).category || ''),
          assignedStaffIds: input.assignedStaffIds || [],
          isActive: (updateRes.data as any).is_active !== false
        };
      }

      const sortOrder = await nextSortOrder(client, 'services', context.salon.id);
      const insertRes = await client
        .from('services')
        .insert({
          salon_id: context.salon.id,
          name: input.name,
          duration_minutes: input.durationMin,
          price: input.price,
          category: input.category || null,
          sort_order: sortOrder,
          is_active: input.isActive !== false
        } as any)
        .select('id,name,duration_minutes,price,is_active,category')
        .single();
      if (insertRes.error || !insertRes.data) throw insertRes.error || new Error('SERVICE_CREATE_FAILED');
      await syncStaffServiceAssignments(client, context.salon.id, {
        serviceId: String(insertRes.data.id),
        nextIds: input.assignedStaffIds || []
      });
      return {
        id: String(insertRes.data.id),
        salonId: context.salon.id,
        name: String(insertRes.data.name || ''),
        durationMin: Number((insertRes.data as any).duration_minutes || 30),
        price: Number((insertRes.data as any).price || 0),
        category: String((insertRes.data as any).category || ''),
        assignedStaffIds: input.assignedStaffIds || [],
        isActive: (insertRes.data as any).is_active !== false
      };
    }
  },
  reminders: {
    list: async () => {
      const context = await readOwnerContext();
      if (!context.salon) throw new Error('SALON_REQUIRED');
      const client = assertSupabase();
      let res = await client
        .from('salon_reminders')
        .select('id,salon_id,channel,type,enabled')
        .eq('salon_id', context.salon.id)
        .order('channel', {ascending: true});

      if (res.error) throw res.error;
      if (!(res.data || []).length) {
        await ensureReminderDefaults(client, context.salon.id);
        res = await client
          .from('salon_reminders')
          .select('id,salon_id,channel,type,enabled')
          .eq('salon_id', context.salon.id)
          .order('channel', {ascending: true});
        if (res.error) throw res.error;
      }

      return (res.data || []).map((row: any) => ({
        id: String(row.id),
        salonId: String(row.salon_id || context.salon!.id),
        channel: String(row.channel || 'sms') as Reminder['channel'],
        type: String(row.type || 'booking_confirmed') as Reminder['type'],
        enabled: Boolean(row.enabled)
      })) as Reminder[];
    },
    update: async (reminderId, enabled) => {
      const context = await readOwnerContext();
      if (!context.salon) throw new Error('SALON_REQUIRED');
      const client = assertSupabase();
      const res = await client
        .from('salon_reminders')
        .update({enabled} as any)
        .eq('id', reminderId)
        .eq('salon_id', context.salon.id)
        .select('id,salon_id,channel,type,enabled')
        .single();
      if (res.error || !res.data) throw res.error || new Error('REMINDER_UPDATE_FAILED');
      return {
        id: String(res.data.id),
        salonId: String((res.data as any).salon_id || context.salon.id),
        channel: String((res.data as any).channel || 'sms') as Reminder['channel'],
        type: String((res.data as any).type || 'booking_confirmed') as Reminder['type'],
        enabled: Boolean((res.data as any).enabled)
      } as Reminder;
    }
  },
  notifications: {
    registerPushToken: async (token) => {
      const context = await readOwnerContext();
      if (!context.salon) throw new Error('SALON_REQUIRED');
      const client = assertSupabase();
      const user = await readAuthUser();
      const platform = Platform.OS || 'unknown';
      const res = await client.from('device_tokens').upsert(
        {
          salon_id: context.salon.id,
          user_id: user.id,
          token,
          platform,
          disabled_at: null,
          last_seen_at: new Date().toISOString()
        } as any,
        {onConflict: 'token'}
      );
      if (res.error) throw res.error;
    },
    listPreferences: async () => {
      const context = await readOwnerContext();
      if (!context.salon) throw new Error('SALON_REQUIRED');
      const client = assertSupabase();
      const user = await readAuthUser();
      const res = await client
        .from('notification_preferences')
        .select('id,salon_id,user_id,channel,type,enabled')
        .eq('salon_id', context.salon.id)
        .eq('user_id', user.id)
        .eq('channel', 'push');
      if (res.error) throw res.error;

      const byType = new Map<string, any>((res.data || []).map((row: any) => [String(row.type || ''), row]));
      return DEFAULT_NOTIFICATION_PREFERENCE_TYPES.map((type) => {
        const row = byType.get(type);
        return {
          id: String(row?.id || type),
          salonId: String(row?.salon_id || context.salon?.id || ''),
          userId: String(row?.user_id || user.id),
          channel: 'push',
          type,
          enabled: row ? Boolean(row.enabled) : true
        } as NotificationPreference;
      });
    },
    updatePreference: async (type, enabled) => {
      const context = await readOwnerContext();
      if (!context.salon) throw new Error('SALON_REQUIRED');
      const client = assertSupabase();
      const user = await readAuthUser();
      const res = await client
        .from('notification_preferences')
        .upsert(
          {
            salon_id: context.salon.id,
            user_id: user.id,
            channel: 'push',
            type,
            enabled
          } as any,
          {onConflict: 'salon_id,user_id,channel,type'}
        )
        .select('id,salon_id,user_id,channel,type,enabled')
        .single();
      if (res.error || !res.data) throw res.error || new Error('NOTIFICATION_PREFERENCE_UPDATE_FAILED');
      return {
        id: String((res.data as any).id || type),
        salonId: String((res.data as any).salon_id || context.salon.id),
        userId: String((res.data as any).user_id || user.id),
        channel: 'push',
        type: String((res.data as any).type || type) as NotificationPreference['type'],
        enabled: Boolean((res.data as any).enabled)
      } as NotificationPreference;
    }
  }
};
