import type {AccessRole} from './lib/identity';

export type {AccessRole};

export type AuthMethod = 'phone' | 'email';
export type DashboardTab = 'calendar' | 'agenda' | 'team';
export type ScreenState = 'loading' | 'auth' | 'pending' | 'dashboard';
export type OtpChannel = 'whatsapp' | 'sms' | null;
export type PendingMode = 'approval' | 'onboarding_required' | 'onboarding_submitted';

export type StaffRow = {
  id: string;
  name: string;
  is_active?: boolean | null;
  sort_order?: number | null;
  photo_url?: string | null;
};

export type ServiceRow = {
  id: string;
  name: string;
  duration_minutes: number;
  price?: number | null;
  is_active?: boolean | null;
  sort_order?: number | null;
};

export type StaffServiceRow = {
  staff_id: string;
  service_id: string;
};

export type BookingRow = {
  id: string;
  salon_id: string;
  staff_id: string | null;
  service_id: string | null;
  customer_name: string;
  customer_phone: string;
  status: string;
  appointment_start: string;
  appointment_end: string;
  created_at?: string;
  notes?: string | null;
};

export type TimeOffRow = {
  staff_id: string | null;
  start_at: string | null;
  end_at: string | null;
};

export type SalonProfile = {
  id: string;
  slug: string;
  name: string;
  status: string;
};

export type CreateDraft = {
  customerName: string;
  customerPhone: string;
  serviceId: string;
  employeeId: string;
  start: Date;
  duration: number;
};

export type PendingMove = {
  bookingId: string;
  start: Date;
  end: Date;
  employeeId: string;
};

export type BookingView = {
  id: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  serviceId: string;
  staffName: string;
  staffId: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  color: string;
};

export type OnboardingDraft = {
  salonName: string;
  countryCode: string;
  city: string;
  whatsapp: string;
  adminPasscode: string;
};
