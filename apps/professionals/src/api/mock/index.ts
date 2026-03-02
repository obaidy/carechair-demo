import {addDays, addHours, endOfDay, formatISO, isAfter, isBefore, isEqual, parseISO, startOfDay, startOfWeek} from 'date-fns';
import type {CareChairApi, ListBookingsParams} from '../types';
import type {
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
import {secureGet, secureSet, secureRemove} from '../../utils/secureStore';

const SESSION_KEY = 'cc_prof_mock_session';

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function digits(value: string) {
  return value.replace(/\D/g, '');
}

async function wait(ms = 140) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type DB = {
  users: UserProfile[];
  salons: Salon[];
  staff: Staff[];
  services: Service[];
  clients: Client[];
  bookings: Booking[];
  reminders: Reminder[];
  events: EventLog[];
};

const db: DB = {
  users: [],
  salons: [],
  staff: [],
  services: [],
  clients: [],
  bookings: [],
  reminders: [],
  events: []
};

let runtimeSession: AuthSession | null = null;

function ensureUserByPhone(phone: string): UserProfile {
  const normalized = digits(phone);
  let user = db.users.find((row) => digits(row.phone) === normalized);
  if (user) return user;

  user = {
    id: uid('usr'),
    phone,
    displayName: 'Owner',
    role: 'OWNER',
    salonId: null,
    createdAt: nowIso()
  };
  db.users.push(user);
  return user;
}

function getSessionUser(): UserProfile {
  if (!runtimeSession) throw new Error('NO_SESSION');
  const user = db.users.find((row) => row.id === runtimeSession?.userId);
  if (!user) throw new Error('USER_NOT_FOUND');
  return user;
}

function getSalonByUser(user: UserProfile): Salon | null {
  if (!user.salonId) return null;
  return db.salons.find((row) => row.id === user.salonId) || null;
}

function addEvent(salonId: string, type: EventLog['type'], title: string, description: string, extras?: Partial<EventLog>) {
  db.events.unshift({
    id: uid('evt'),
    salonId,
    type,
    title,
    description,
    createdAt: nowIso(),
    ...extras
  });
}

function staffColor(index: number) {
  const palette = ['#2563EB', '#0EA5E9', '#14B8A6', '#F59E0B', '#EF4444', '#8B5CF6', '#10B981'];
  return palette[index % palette.length];
}

function seedSalonData(salon: Salon) {
  const ownerStaff: Staff = {
    id: uid('stf'),
    salonId: salon.id,
    name: 'Owner',
    roleTitle: 'Owner',
    color: staffColor(0),
    isActive: true,
    serviceIds: [],
    workingHours: {
      0: {start: '08:00', end: '20:00'},
      1: {start: '08:00', end: '20:00'},
      2: {start: '08:00', end: '20:00'},
      3: {start: '08:00', end: '20:00'},
      4: {start: '08:00', end: '20:00'},
      5: {start: '08:00', end: '20:00'},
      6: {start: '08:00', end: '20:00'}
    }
  };

  const service: Service = {
    id: uid('srv'),
    salonId: salon.id,
    name: 'Hair Styling',
    durationMin: 45,
    price: 25,
    isActive: true,
    category: 'Hair',
    assignedStaffIds: [ownerStaff.id]
  };

  ownerStaff.serviceIds = [service.id];

  const client1: Client = {
    id: uid('clt'),
    salonId: salon.id,
    name: 'Sara Kareem',
    phone: '+9647700000011',
    notes: 'Prefers afternoon slots',
    totalSpend: 75,
    createdAt: nowIso(),
    lastVisitAt: nowIso()
  };

  const client2: Client = {
    id: uid('clt'),
    salonId: salon.id,
    name: 'Nour Hassan',
    phone: '+9647700000022',
    notes: '',
    totalSpend: 50,
    createdAt: nowIso(),
    lastVisitAt: nowIso()
  };

  const today = new Date();
  const b1Start = addHours(startOfDay(today), 10);
  const b2Start = addHours(startOfDay(today), 13);

  const booking1: Booking = {
    id: uid('bok'),
    salonId: salon.id,
    clientId: client1.id,
    clientName: client1.name,
    clientPhone: client1.phone,
    serviceId: service.id,
    staffId: ownerStaff.id,
    startAt: formatISO(b1Start),
    endAt: formatISO(addHours(b1Start, 1)),
    status: 'confirmed',
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  const booking2: Booking = {
    id: uid('bok'),
    salonId: salon.id,
    clientId: client2.id,
    clientName: client2.name,
    clientPhone: client2.phone,
    serviceId: service.id,
    staffId: ownerStaff.id,
    startAt: formatISO(b2Start),
    endAt: formatISO(addHours(b2Start, 1)),
    status: 'pending',
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  db.staff.push(ownerStaff);
  db.services.push(service);
  db.clients.push(client1, client2);
  db.bookings.push(booking1, booking2);

  db.reminders.push(
    {id: uid('rem'), salonId: salon.id, channel: 'sms', type: 'booking_reminder_24h', enabled: false},
    {id: uid('rem'), salonId: salon.id, channel: 'whatsapp', type: 'booking_reminder_2h', enabled: false}
  );

  addEvent(salon.id, 'booking_new', 'New booking', `${client1.name} booked ${service.name}`, {bookingId: booking1.id, clientId: client1.id});
  addEvent(salon.id, 'booking_new', 'New booking', `${client2.name} booked ${service.name}`, {bookingId: booking2.id, clientId: client2.id});
}

function assertSalonContext(): {user: UserProfile; salon: Salon} {
  const user = getSessionUser();
  const salon = getSalonByUser(user);
  if (!salon) throw new Error('SALON_REQUIRED');
  return {user, salon};
}

function rangeForParams(params: ListBookingsParams): {from: Date; to: Date} {
  const date = parseISO(params.date);
  if (params.mode === 'week') {
    const from = startOfWeek(date, {weekStartsOn: 1});
    return {from: startOfDay(from), to: endOfDay(addDays(from, 6))};
  }
  return {from: startOfDay(date), to: endOfDay(date)};
}

function listBookingsInternal(salonId: string, params: ListBookingsParams): Booking[] {
  const {from, to} = rangeForParams(params);
  return db.bookings
    .filter((row) => {
      if (row.salonId !== salonId) return false;
      if (params.staffId && row.staffId !== params.staffId) return false;
      const start = parseISO(row.startAt);
      return (isEqual(start, from) || isAfter(start, from)) && (isEqual(start, to) || isBefore(start, to));
    })
    .sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
}

function calculateSummary(salonId: string, dateIso: string): DashboardSummary {
  const bookings = listBookingsInternal(salonId, {date: dateIso, mode: 'day'});
  const noShows = bookings.filter((row) => row.status === 'no_show').length;
  const servicesById = new Map(db.services.filter((s) => s.salonId === salonId).map((s) => [s.id, s]));
  const revenue = bookings
    .filter((row) => row.status === 'completed' || row.status === 'confirmed')
    .reduce((sum, row) => sum + Number(servicesById.get(row.serviceId)?.price || 0), 0);

  const nextAppointment = bookings.find((row) => +new Date(row.startAt) > Date.now()) || null;
  const availableSlots = Math.max(0, 28 - bookings.filter((row) => row.status !== 'canceled').length);

  return {
    bookingsCount: bookings.length,
    revenue,
    noShows,
    availableSlots,
    nextAppointment
  };
}

export const mockApi: CareChairApi = {
  auth: {
    getSession: async () => {
      await wait();
      if (runtimeSession) return runtimeSession;
      const raw = await secureGet(SESSION_KEY);
      if (!raw) return null;
      try {
        runtimeSession = JSON.parse(raw) as AuthSession;
        return runtimeSession;
      } catch {
        return null;
      }
    },
    sendOtp: async (_phone) => {
      await wait();
      return {channel: 'sms'};
    },
    verifyOtp: async (phone, _code) => {
      await wait();
      const user = ensureUserByPhone(phone);
      const session: AuthSession = {
        accessToken: uid('mock_token'),
        userId: user.id,
        phone,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
      };
      runtimeSession = session;
      await secureSet(SESSION_KEY, JSON.stringify(session));
      return session;
    },
    signOut: async () => {
      runtimeSession = null;
      await secureRemove(SESSION_KEY);
    }
  },
  owner: {
    getContext: async () => {
      await wait();
      const user = getSessionUser();
      return {user, salon: getSalonByUser(user)} as OwnerContext;
    },
    getAvailabilityContext: async () => {
      await wait();
      return {
        salonHours: [],
        employeeHours: [],
        timeOff: []
      };
    },
    createOrClaimSalon: async (input) => {
      await wait();
      const user = getSessionUser();
      if (user.salonId) {
        const existing = getSalonByUser(user);
        if (existing) return existing;
      }

      const now = nowIso();
      const salon: Salon = {
        id: uid('sal'),
        ownerId: user.id,
        name: input.name,
        slug: input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        phone: input.phone,
        locationLabel: input.locationLabel,
        locationAddress: input.locationAddress,
        status: 'DRAFT',
        workdayStart: input.workdayStart,
        workdayEnd: input.workdayEnd,
        createdAt: now,
        updatedAt: now
      };

      user.salonId = salon.id;
      db.salons.push(salon);
      seedSalonData(salon);

      return salon;
    },
    requestActivation: async (input) => {
      await wait();
      const {salon} = assertSalonContext();
      salon.locationAddress = input.addressText || salon.locationAddress;
      salon.locationLabel = input.area || salon.locationLabel;
      salon.locationLat = input.locationLat;
      salon.locationLng = input.locationLng;
      if (input.locationLabel) salon.locationLabel = input.locationLabel;
      salon.storefrontPhotoUrl = input.storefrontPhotoUrl;
      salon.status = 'PENDING_REVIEW';
      salon.updatedAt = nowIso();
      addEvent(salon.id, 'booking_rescheduled', 'Activation requested', 'Salon activation moved to pending review.');
      return salon;
    },
    updateSalonProfile: async (patch) => {
      await wait();
      const {salon} = assertSalonContext();
      Object.assign(salon, patch, {updatedAt: nowIso()});
      return salon;
    }
  },
  dashboard: {
    getSummary: async (dateIso) => {
      await wait();
      const {salon} = assertSalonContext();
      return calculateSummary(salon.id, dateIso);
    },
    listEvents: async (limit = 10) => {
      await wait();
      const {salon} = assertSalonContext();
      return db.events.filter((row) => row.salonId === salon.id).slice(0, limit);
    }
  },
  bookings: {
    list: async (params) => {
      await wait();
      const {salon} = assertSalonContext();
      return listBookingsInternal(salon.id, params);
    },
    create: async (input) => {
      await wait();
      const {salon} = assertSalonContext();
      const booking: Booking = {
        id: uid('bok'),
        salonId: salon.id,
        clientId: input.clientId || null,
        clientName: input.clientName,
        clientPhone: input.clientPhone,
        serviceId: input.serviceId,
        staffId: input.staffId,
        startAt: input.startAt,
        endAt: input.endAt,
        status: input.status || 'confirmed',
        notes: input.notes,
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
      db.bookings.push(booking);
      addEvent(salon.id, 'booking_new', 'New booking', `${booking.clientName} added to schedule.`, {bookingId: booking.id, clientId: booking.clientId || undefined});
      return booking;
    },
    updateStatus: async (bookingId, status) => {
      await wait();
      const {salon} = assertSalonContext();
      const booking = db.bookings.find((row) => row.id === bookingId && row.salonId === salon.id);
      if (!booking) throw new Error('BOOKING_NOT_FOUND');
      booking.status = status;
      booking.updatedAt = nowIso();

      const statusTitle: Record<BookingStatus, string> = {
        confirmed: 'Booking confirmed',
        pending: 'Booking pending',
        completed: 'Booking completed',
        no_show: 'Marked no-show',
        canceled: 'Booking canceled',
        blocked: 'Time blocked'
      };
      const statusType: EventLog['type'] = status === 'completed' ? 'booking_completed' : status === 'no_show' ? 'booking_no_show' : 'booking_cancelled';
      addEvent(salon.id, statusType, statusTitle[status], booking.clientName, {bookingId: booking.id, clientId: booking.clientId || undefined});
      return booking;
    },
    reschedule: async (input) => {
      await wait();
      const {salon} = assertSalonContext();
      const booking = db.bookings.find((row) => row.id === input.bookingId && row.salonId === salon.id);
      if (!booking) throw new Error('BOOKING_NOT_FOUND');
      booking.startAt = input.startAt;
      booking.endAt = input.endAt;
      if (input.staffId) booking.staffId = input.staffId;
      booking.updatedAt = nowIso();
      addEvent(salon.id, 'booking_rescheduled', 'Booking rescheduled', booking.clientName, {bookingId: booking.id, clientId: booking.clientId || undefined});
      return booking;
    },
    blockTime: async (input) => {
      await wait();
      const {salon} = assertSalonContext();
      const block: Booking = {
        id: uid('blk'),
        salonId: salon.id,
        clientId: null,
        clientName: input.reason || 'Blocked',
        clientPhone: '-',
        serviceId: 'blocked',
        staffId: input.staffId,
        startAt: input.startAt,
        endAt: input.endAt,
        status: 'blocked',
        notes: input.reason,
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
      db.bookings.push(block);
      return block;
    }
  },
  clients: {
    list: async (query) => {
      await wait();
      const {salon} = assertSalonContext();
      const rows = db.clients.filter((row) => row.salonId === salon.id);
      if (!query?.trim()) return rows;
      const key = query.trim().toLowerCase();
      return rows.filter((row) => row.name.toLowerCase().includes(key) || row.phone.includes(key));
    },
    getById: async (clientId) => {
      await wait();
      const {salon} = assertSalonContext();
      return db.clients.find((row) => row.id === clientId && row.salonId === salon.id) || null;
    },
    create: async (input: CreateClientInput) => {
      await wait();
      const {salon} = assertSalonContext();
      const client: Client = {
        id: uid('clt'),
        salonId: salon.id,
        name: input.name,
        phone: input.phone,
        notes: input.notes,
        totalSpend: 0,
        createdAt: nowIso()
      };
      db.clients.push(client);
      return client;
    },
    update: async (clientId, patch) => {
      await wait();
      const {salon} = assertSalonContext();
      const client = db.clients.find((row) => row.id === clientId && row.salonId === salon.id);
      if (!client) throw new Error('CLIENT_NOT_FOUND');
      Object.assign(client, patch);
      return client;
    },
    history: async (clientId) => {
      await wait();
      const {salon} = assertSalonContext();
      return db.bookings
        .filter((row) => row.salonId === salon.id && row.clientId === clientId)
        .sort((a, b) => +new Date(b.startAt) - +new Date(a.startAt));
    }
  },
  staff: {
    list: async () => {
      await wait();
      const {salon} = assertSalonContext();
      return db.staff.filter((row) => row.salonId === salon.id && row.isActive);
    },
    upsert: async (input: UpsertStaffInput) => {
      await wait();
      const {salon} = assertSalonContext();
      if (input.id) {
        const existing = db.staff.find((row) => row.id === input.id && row.salonId === salon.id);
        if (!existing) throw new Error('STAFF_NOT_FOUND');
        existing.name = input.name;
        existing.roleTitle = input.roleTitle;
        existing.phone = input.phone;
        existing.color = input.color;
        existing.serviceIds = input.serviceIds;
        db.services.forEach((service) => {
          if (service.salonId !== salon.id) return;
          const shouldAssign = input.serviceIds.includes(service.id);
          const has = service.assignedStaffIds.includes(existing.id);
          if (shouldAssign && !has) service.assignedStaffIds.push(existing.id);
          if (!shouldAssign && has) service.assignedStaffIds = service.assignedStaffIds.filter((id) => id !== existing.id);
        });
        return existing;
      }

      const created: Staff = {
        id: uid('stf'),
        salonId: salon.id,
        name: input.name,
        roleTitle: input.roleTitle,
        phone: input.phone,
        color: input.color,
        isActive: true,
        serviceIds: input.serviceIds,
        workingHours: {
          0: {start: '08:00', end: '20:00'},
          1: {start: '08:00', end: '20:00'},
          2: {start: '08:00', end: '20:00'},
          3: {start: '08:00', end: '20:00'},
          4: {start: '08:00', end: '20:00'},
          5: {start: '08:00', end: '20:00'},
          6: {start: '08:00', end: '20:00'}
        }
      };
      db.staff.push(created);
      db.services.forEach((service) => {
        if (service.salonId !== salon.id) return;
        if (input.serviceIds.includes(service.id) && !service.assignedStaffIds.includes(created.id)) {
          service.assignedStaffIds.push(created.id);
        }
      });
      return created;
    }
  },
  services: {
    list: async () => {
      await wait();
      const {salon} = assertSalonContext();
      return db.services.filter((row) => row.salonId === salon.id);
    },
    upsert: async (input: UpsertServiceInput) => {
      await wait();
      const {salon} = assertSalonContext();
      if (input.id) {
        const existing = db.services.find((row) => row.id === input.id && row.salonId === salon.id);
        if (!existing) throw new Error('SERVICE_NOT_FOUND');
        existing.name = input.name;
        existing.durationMin = input.durationMin;
        existing.price = input.price;
        existing.category = input.category;
        existing.assignedStaffIds = input.assignedStaffIds;
        existing.isActive = input.isActive !== false;
        db.staff.forEach((member) => {
          if (member.salonId !== salon.id) return;
          if (input.assignedStaffIds.includes(member.id)) {
            if (!member.serviceIds.includes(existing.id)) member.serviceIds.push(existing.id);
          } else {
            member.serviceIds = member.serviceIds.filter((id) => id !== existing.id);
          }
        });
        return existing;
      }

      const created: Service = {
        id: uid('srv'),
        salonId: salon.id,
        name: input.name,
        durationMin: input.durationMin,
        price: input.price,
        category: input.category,
        assignedStaffIds: input.assignedStaffIds,
        isActive: input.isActive !== false
      };
      db.services.push(created);
      db.staff.forEach((member) => {
        if (member.salonId !== salon.id) return;
        if (input.assignedStaffIds.includes(member.id) && !member.serviceIds.includes(created.id)) {
          member.serviceIds.push(created.id);
        }
      });
      return created;
    }
  },
  reminders: {
    list: async () => {
      await wait();
      const {salon} = assertSalonContext();
      return db.reminders.filter((row) => row.salonId === salon.id);
    },
    update: async (reminderId, enabled) => {
      await wait();
      const {salon} = assertSalonContext();
      const reminder = db.reminders.find((row) => row.id === reminderId && row.salonId === salon.id);
      if (!reminder) throw new Error('REMINDER_NOT_FOUND');
      reminder.enabled = enabled;
      if (enabled) addEvent(salon.id, 'reminder_sent', 'Reminder automation updated', `Rule ${reminder.type} enabled`);
      return reminder;
    }
  },
  notifications: {
    registerPushToken: async (_token) => {
      await wait(40);
      // TODO: send device token to backend endpoint once available.
    }
  }
};
