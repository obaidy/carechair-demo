import type {
  AuthSession,
  BlockTimeInput,
  Booking,
  BookingStatus,
  CalendarViewMode,
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
  UpsertStaffInput
} from '../types/models';

export type ListBookingsParams = {
  date: string;
  mode: CalendarViewMode;
  staffId?: string;
};

export interface CareChairApi {
  auth: {
    getSession: () => Promise<AuthSession | null>;
    sendOtp: (phone: string) => Promise<{channel: 'sms' | 'whatsapp'}>;
    verifyOtp: (phone: string, code: string) => Promise<AuthSession>;
    signOut: () => Promise<void>;
  };
  owner: {
    getContext: () => Promise<OwnerContext>;
    createOrClaimSalon: (input: CreateSalonInput) => Promise<Salon>;
    requestActivation: (input: RequestActivationInput) => Promise<Salon>;
    updateSalonProfile: (patch: Partial<Salon>) => Promise<Salon>;
  };
  dashboard: {
    getSummary: (dateIso: string) => Promise<DashboardSummary>;
    listEvents: (limit?: number) => Promise<EventLog[]>;
  };
  bookings: {
    list: (params: ListBookingsParams) => Promise<Booking[]>;
    create: (input: CreateBookingInput) => Promise<Booking>;
    updateStatus: (bookingId: string, status: BookingStatus) => Promise<Booking>;
    reschedule: (input: RescheduleBookingInput) => Promise<Booking>;
    blockTime: (input: BlockTimeInput) => Promise<Booking>;
  };
  clients: {
    list: (query?: string) => Promise<Client[]>;
    getById: (clientId: string) => Promise<Client | null>;
    create: (input: CreateClientInput) => Promise<Client>;
    update: (clientId: string, patch: Partial<Client>) => Promise<Client>;
    history: (clientId: string) => Promise<Booking[]>;
  };
  staff: {
    list: () => Promise<Staff[]>;
    upsert: (input: UpsertStaffInput) => Promise<Staff>;
  };
  services: {
    list: () => Promise<Service[]>;
    upsert: (input: UpsertServiceInput) => Promise<Service>;
  };
  reminders: {
    list: () => Promise<Reminder[]>;
    update: (reminderId: string, enabled: boolean) => Promise<Reminder>;
  };
  notifications: {
    registerPushToken: (token: string) => Promise<void>;
  };
}
