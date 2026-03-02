export type LocaleCode = 'ar' | 'en';

export type ThemeMode = 'light' | 'dark';

export type UserRole = 'OWNER' | 'MANAGER' | 'STAFF';

export type SalonStatus = 'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'SUSPENDED';

export type BookingStatus = 'confirmed' | 'pending' | 'completed' | 'no_show' | 'canceled' | 'blocked';

export type CalendarViewMode = 'day' | 'week' | 'list';

export type ReminderChannel = 'sms' | 'whatsapp' | 'push';

export type ReminderType = 'booking_confirmed' | 'booking_reminder_24h' | 'booking_reminder_2h' | 'follow_up';

export type Reminder = {
  id: string;
  salonId: string;
  channel: ReminderChannel;
  type: ReminderType;
  enabled: boolean;
};

export type SalonHourRule = {
  dayOfWeek: number;
  openTime?: string;
  closeTime?: string;
  isClosed?: boolean;
};

export type EmployeeHourRule = {
  staffId: string;
  dayOfWeek: number;
  startTime?: string;
  endTime?: string;
  isOff?: boolean;
  breakStart?: string;
  breakEnd?: string;
};

export type EmployeeTimeOff = {
  id: string;
  staffId: string;
  startAt: string;
  endAt: string;
};

export type AvailabilityContext = {
  salonHours: SalonHourRule[];
  employeeHours: EmployeeHourRule[];
  timeOff: EmployeeTimeOff[];
};

export type EventType =
  | 'booking_new'
  | 'booking_cancelled'
  | 'booking_rescheduled'
  | 'reminder_sent'
  | 'booking_completed'
  | 'booking_no_show';

export type EventLog = {
  id: string;
  salonId: string;
  type: EventType;
  title: string;
  description: string;
  createdAt: string;
  bookingId?: string;
  clientId?: string;
};

export type UserProfile = {
  id: string;
  phone: string;
  displayName: string;
  role: UserRole;
  salonId: string | null;
  createdAt: string;
};

export type Salon = {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  phone: string;
  locationLabel: string;
  locationAddress: string;
  locationLat?: number;
  locationLng?: number;
  storefrontPhotoUrl?: string;
  status: SalonStatus;
  workdayStart: string;
  workdayEnd: string;
  publicBookingUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type Service = {
  id: string;
  salonId: string;
  name: string;
  durationMin: number;
  price: number;
  isActive: boolean;
  category?: string;
  assignedStaffIds: string[];
};

export type Staff = {
  id: string;
  salonId: string;
  name: string;
  roleTitle: string;
  phone?: string;
  avatarUrl?: string;
  color: string;
  isActive: boolean;
  serviceIds: string[];
  workingHours: Record<number, {start: string; end: string; off?: boolean; breakStart?: string; breakEnd?: string}>;
};

export type Client = {
  id: string;
  salonId: string;
  name: string;
  phone: string;
  notes?: string;
  totalSpend: number;
  lastVisitAt?: string;
  createdAt: string;
};

export type Booking = {
  id: string;
  salonId: string;
  clientId: string | null;
  clientName: string;
  clientPhone: string;
  serviceId: string;
  staffId: string;
  startAt: string;
  endAt: string;
  status: BookingStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type DashboardSummary = {
  bookingsCount: number;
  revenue: number;
  noShows: number;
  availableSlots: number;
  nextAppointment: Booking | null;
};

export type AuthSession = {
  accessToken: string;
  refreshToken?: string;
  userId: string;
  phone: string;
  expiresAt?: number;
};

export type OwnerContext = {
  user: UserProfile;
  salon: Salon | null;
};

export type CreateSalonInput = {
  name: string;
  phone: string;
  locationLabel: string;
  locationAddress: string;
  workdayStart: string;
  workdayEnd: string;
};

export type RequestActivationInput = {
  city?: string;
  area?: string;
  addressMode: 'LOCATION' | 'MANUAL';
  addressText?: string;
  locationLat?: number;
  locationLng?: number;
  locationAccuracyM?: number;
  locationLabel?: string;
  instagram?: string;
  storefrontPhotoUrl?: string;
};

export type CreateClientInput = {
  name: string;
  phone: string;
  notes?: string;
};

export type UpsertStaffInput = {
  id?: string;
  name: string;
  roleTitle: string;
  phone?: string;
  color: string;
  serviceIds: string[];
  workingHours?: Record<number, {start: string; end: string; off?: boolean; breakStart?: string; breakEnd?: string}>;
};

export type UpsertServiceInput = {
  id?: string;
  name: string;
  durationMin: number;
  price: number;
  category?: string;
  assignedStaffIds: string[];
  isActive?: boolean;
};

export type CreateBookingInput = {
  clientId?: string | null;
  clientName: string;
  clientPhone: string;
  serviceId: string;
  staffId: string;
  startAt: string;
  endAt: string;
  status?: BookingStatus;
  notes?: string;
};

export type RescheduleBookingInput = {
  bookingId: string;
  startAt: string;
  endAt: string;
  staffId?: string;
};

export type BlockTimeInput = {
  staffId: string;
  startAt: string;
  endAt: string;
  reason?: string;
};
