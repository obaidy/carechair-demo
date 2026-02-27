import {endOfDay, parseISO, startOfDay, startOfWeek} from 'date-fns';
import type {CareChairApi} from '../types';
import type {
  AuthSession,
  BlockTimeInput,
  Booking,
  BookingStatus,
  CreateBookingInput,
  CreateClientInput,
  CreateSalonInput,
  DashboardSummary,
  EventLog,
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

async function readAuthUser() {
  const client = assertSupabase();
  const cached = useAuthStore.getState().session;

  const fromSession = await client.auth.getSession();
  if (!fromSession.error && fromSession.data.session?.access_token) {
    const bySession = await client.auth.getUser(fromSession.data.session.access_token);
    if (!bySession.error && bySession.data.user) return bySession.data.user;
  }

  if (cached?.accessToken && cached?.refreshToken) {
    const restored = await client.auth.setSession({
      access_token: cached.accessToken,
      refresh_token: cached.refreshToken
    });
    if (!restored.error && restored.data.session?.access_token) {
      const byRestored = await client.auth.getUser(restored.data.session.access_token);
      if (!byRestored.error && byRestored.data.user) return byRestored.data.user;
    }
  }

  const first = await client.auth.getUser();
  if (!first.error && first.data.user) return first.data.user;

  const message = String(first.error?.message || '').toLowerCase();

  // Supabase can lose in-memory session in Expo Go hot reloads; restore from latest verified tokens.
  if (message.includes('session') && cached?.accessToken && cached?.refreshToken) {
    const restored = await client.auth.setSession({
      access_token: cached.accessToken,
      refresh_token: cached.refreshToken
    });
    if (!restored.error) {
      const second = await client.auth.getUser();
      if (!second.error && second.data.user) return second.data.user;
      throw second.error || new Error('UNAUTHORIZED');
    }
  }

  throw first.error || new Error('UNAUTHORIZED');
}

async function readOwnerContext(): Promise<OwnerContext> {
  const client = assertSupabase();
  const user = await readAuthUser();
  const profile: UserProfile = {
    id: String(user.id),
    phone: String(user.phone || user.user_metadata?.phone || ''),
    displayName: String(user.user_metadata?.display_name || 'Owner'),
    role: 'OWNER',
    salonId: String(user.user_metadata?.salon_id || user.app_metadata?.salon_id || '') || null,
    createdAt: String(user.created_at || new Date().toISOString())
  };

  const salonId = profile.salonId;
  if (!salonId) return {user: profile, salon: null};

  const {data: salonRow} = await client
    .from('salons')
    .select('id,name,slug,whatsapp,status,area,created_at,updated_at')
    .eq('id', salonId)
    .maybeSingle();

  if (!salonRow) return {user: profile, salon: null};

  const salon: Salon = {
    id: String(salonRow.id),
    ownerId: profile.id,
    name: String(salonRow.name || 'Salon'),
    slug: String(salonRow.slug || ''),
    phone: String((salonRow as any).whatsapp || ''),
    locationLabel: String((salonRow as any).area || ''),
    locationAddress: String((salonRow as any).area || ''),
    status: normalizeSalonStatus((salonRow as any).status),
    workdayStart: '08:00',
    workdayEnd: '22:00',
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
  const from = mode === 'week' ? startOfWeek(base, {weekStartsOn: 1}) : startOfDay(base);
  const to = mode === 'week' ? endOfDay(new Date(from.getTime() + 6 * 24 * 60 * 60 * 1000)) : endOfDay(base);

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

export const supabaseApi: CareChairApi = {
  auth: {
    getSession: async () => {
      const client = assertSupabase();
      const {data} = await client.auth.getSession();
      if (!data.session) return null;
      return toSession(data.session);
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
          pushDevLog('info', 'auth.verifyOtp', 'DEV OTP bypass accepted using runtime session');
          return toSession(runtime.data.session);
        }
        const cached = useAuthStore.getState().session;
        if (cached?.accessToken && cached.refreshToken) {
          const restored = await client.auth.setSession({
            access_token: cached.accessToken,
            refresh_token: cached.refreshToken
          });
          if (!restored.error && restored.data.session) {
            pushDevLog('info', 'auth.verifyOtp', 'DEV OTP bypass accepted using restored cached session');
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
      if (!restored.error && restored.data.session) {
        return toSession(restored.data.session);
      }
      return toSession(data.session);
    },
    signOut: async () => {
      const client = assertSupabase();
      await client.auth.signOut();
    }
  },
  owner: {
    getContext: async () => readOwnerContext(),
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
          status: toDbSalonStatus('DRAFT')
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
      const client = assertSupabase();
      const payload = {
        salon_id: context.salon.id,
        submitted_data: {
          whatsapp: context.salon.phone || null,
          city: input.city || null,
          area: input.area || null,
          address_mode: input.addressMode,
          address_text: input.addressText || null,
          location_lat: input.locationLat ?? null,
          location_lng: input.locationLng ?? null,
          location_accuracy_m: input.locationAccuracyM ?? null,
          location_label: input.locationLabel || null,
          instagram: input.instagram || null,
          photo_url: input.storefrontPhotoUrl || null
        }
      };
      if (__DEV__) {
        pushDevLog('info', 'edge.invoke', 'Invoking request-activation (legacy owner API)', {
          salonId: context.salon.id,
          payload,
          hasAccessToken: Boolean(useAuthStore.getState().session?.accessToken)
        });
      }
      const accessToken = String(useAuthStore.getState().session?.accessToken || '').trim();
      const req = await client.functions.invoke('request-activation', {
        body: payload,
        headers: accessToken ? {Authorization: `Bearer ${accessToken}`} : undefined
      });
      if (__DEV__) {
        const status = Number((req as any)?.error?.context?.status || ((req as any)?.error ? 500 : 200));
        pushDevLog(req.error || !req.data?.ok ? 'error' : 'info', 'edge.invoke', 'request-activation result (legacy owner API)', {
          salonId: context.salon.id,
          status,
          data: req.data ?? null,
          error: req.error ? String(req.error?.message || req.error) : null
        });
      }
      if (req.error || !req.data?.ok) {
        if (req.error) throw new Error(await getFunctionErrorMessage(req.error, 'REQUEST_FAILED'));
        throw new Error(String(req.data?.error || 'REQUEST_FAILED'));
      }

      const {data, error} = await client
        .from('salons')
        .select('id,name,slug,status,area,whatsapp,updated_at,created_at')
        .eq('id', context.salon.id)
        .single();
      if (error || !data) throw error || new Error('REQUEST_FAILED');

      return {
        ...context.salon,
        locationAddress: String((data as any).area || context.salon.locationAddress),
        status: 'PENDING_REVIEW',
        updatedAt: String((data as any).updated_at || new Date().toISOString())
      };
    },
    updateSalonProfile: async (patch) => {
      const context = await readOwnerContext();
      if (!context.salon) throw new Error('SALON_REQUIRED');
      const client = assertSupabase();
      const {error} = await client.from('salons').update({name: patch.name, area: patch.locationAddress, whatsapp: patch.phone} as any).eq('id', context.salon.id);
      if (error) throw error;
      return {...context.salon, ...patch, updatedAt: new Date().toISOString()};
    }
  },
  dashboard: {
    getSummary: async (dateIso) => {
      const context = await readOwnerContext();
      if (!context.salon) throw new Error('SALON_REQUIRED');
      const bookings = await safeListBookings(context.salon.id, dateIso, 'day');
      const nextAppointment = bookings.find((row) => +new Date(row.startAt) > Date.now()) || null;
      const noShows = bookings.filter((row) => row.status === 'no_show').length;
      return {
        bookingsCount: bookings.length,
        revenue: 0,
        noShows,
        availableSlots: Math.max(0, 28 - bookings.length),
        nextAppointment
      } as DashboardSummary;
    },
    listEvents: async () => {
      // TODO: read from dedicated event_logs table when available.
      return [] as EventLog[];
    }
  },
  bookings: {
    list: async (params) => {
      const context = await readOwnerContext();
      if (!context.salon) throw new Error('SALON_REQUIRED');
      return safeListBookings(context.salon.id, params.date, params.mode);
    },
    create: async (input: CreateBookingInput) => {
      const context = await readOwnerContext();
      if (!context.salon) throw new Error('SALON_REQUIRED');
      const client = assertSupabase();
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
      const {data, error} = await client.from('bookings').update(patch).eq('id', input.bookingId).eq('salon_id', context.salon.id).select('*').single();
      if (error || !data) throw error || new Error('RESCHEDULE_FAILED');
      return mapBookingRow(data as any);
    },
    blockTime: async (input: BlockTimeInput) => {
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
    }
  },
  clients: {
    list: async () => {
      // TODO: connect with real clients table; currently inferred from bookings.
      return [];
    },
    getById: async () => null,
    create: async (input: CreateClientInput) => {
      return {
        id: `tmp_${Date.now()}`,
        salonId: 'unknown',
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
    history: async () => []
  },
  staff: {
    list: async () => {
      const context = await readOwnerContext();
      if (!context.salon) throw new Error('SALON_REQUIRED');
      const client = assertSupabase();
      const {data, error} = await client.from('staff').select('id,name,role,phone,photo_url,is_active').eq('salon_id', context.salon.id).eq('is_active', true);
      if (error) return [];
      return (data || []).map((row: any, index: number) => ({
        id: String(row.id),
        salonId: context.salon!.id,
        name: String(row.name || ''),
        roleTitle: String(row.role || 'Staff'),
        phone: String(row.phone || ''),
        avatarUrl: String(row.photo_url || ''),
        color: ['#2563EB', '#0EA5E9', '#14B8A6', '#F59E0B'][index % 4],
        isActive: true,
        serviceIds: [],
        workingHours: {}
      }));
    },
    upsert: async (input: UpsertStaffInput) => {
      // TODO: map to real staff write model and assign staff_services.
      return {
        id: input.id || `tmp_${Date.now()}`,
        salonId: 'unknown',
        name: input.name,
        roleTitle: input.roleTitle,
        phone: input.phone,
        color: input.color,
        isActive: true,
        serviceIds: input.serviceIds,
        workingHours: {}
      };
    }
  },
  services: {
    list: async () => {
      const context = await readOwnerContext();
      if (!context.salon) throw new Error('SALON_REQUIRED');
      const client = assertSupabase();
      const {data, error} = await client.from('services').select('id,name,duration_minutes,price,is_active,category').eq('salon_id', context.salon.id);
      if (error) return [];
      return (data || []).map((row: any) => ({
        id: String(row.id),
        salonId: context.salon!.id,
        name: String(row.name || ''),
        durationMin: Number(row.duration_minutes || 30),
        price: Number(row.price || 0),
        isActive: row.is_active !== false,
        category: String(row.category || ''),
        assignedStaffIds: []
      }));
    },
    upsert: async (input: UpsertServiceInput) => {
      // TODO: map to real services write model and staff assignment relation.
      return {
        id: input.id || `tmp_${Date.now()}`,
        salonId: 'unknown',
        name: input.name,
        durationMin: input.durationMin,
        price: input.price,
        category: input.category,
        assignedStaffIds: input.assignedStaffIds,
        isActive: input.isActive !== false
      };
    }
  },
  reminders: {
    list: async () => {
      // TODO: connect reminders config table.
      return [] as Reminder[];
    },
    update: async (reminderId, enabled) => {
      return {
        id: reminderId,
        salonId: 'unknown',
        channel: 'sms',
        type: 'booking_reminder_24h',
        enabled
      } as Reminder;
    }
  },
  notifications: {
    registerPushToken: async (_token) => {
      // TODO: connect device_tokens endpoint / table.
    }
  }
};
