export const CALENDAR_BUSY_STATUSES = new Set(['pending', 'confirmed']);

type BookingLike = Record<string, unknown>;
type EmployeeLike = {id: string; name?: string | null};
type ServiceLike = {id: string; name?: string | null};

export function getBookingStart(row: BookingLike): Date | null {
  const raw = row?.appointment_start || row?.start_time || row?.start || row?.start_at;
  if (!raw) return null;
  const date = new Date(String(raw));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getBookingEnd(row: BookingLike): Date | null {
  const raw = row?.appointment_end || row?.end_time || row?.end || row?.end_at;
  if (!raw) return null;
  const date = new Date(String(raw));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getBookingEmployeeId(row: BookingLike): string | null {
  const value = row?.staff_id || row?.employee_id;
  return value ? String(value) : null;
}

export function getBookingServiceId(row: BookingLike): string | null {
  const value = row?.service_id;
  return value ? String(value) : null;
}

export type CalendarEventRecord = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resourceId: string | null;
  status: string;
  booking: BookingLike;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  employeeName: string;
  notes: string;
};

export function toCalendarEvent(
  row: BookingLike,
  employeesById: Record<string, EmployeeLike> = {},
  servicesById: Record<string, ServiceLike> = {}
): CalendarEventRecord | null {
  const start = getBookingStart(row);
  const end = getBookingEnd(row);
  if (!start || !end) return null;

  const employeeId = getBookingEmployeeId(row);
  const employee = employeeId ? employeesById[employeeId] : null;
  const serviceId = getBookingServiceId(row);
  const service = serviceId ? servicesById[serviceId] : null;
  const customerName = String(row?.customer_name || '');

  return {
    id: String(row.id),
    title: customerName || String(service?.name || '-'),
    start,
    end,
    resourceId: employeeId,
    status: String(row.status || 'pending'),
    booking: row,
    customerName,
    customerPhone: String(row?.customer_phone || ''),
    serviceName: String(service?.name || row?.service || ''),
    employeeName: String(employee?.name || ''),
    notes: String(row?.notes || '')
  };
}

export function mapBookingsToEvents(
  rows: BookingLike[] = [],
  employees: EmployeeLike[] = [],
  services: ServiceLike[] = []
): CalendarEventRecord[] {
  const employeesById = Object.fromEntries((employees || []).map((item) => [item.id, item]));
  const servicesById = Object.fromEntries((services || []).map((item) => [item.id, item]));

  return (rows || [])
    .map((row) => toCalendarEvent(row, employeesById, servicesById))
    .filter((row): row is CalendarEventRecord => Boolean(row))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function toBookingPayloadFromDraft(
  draft: {
    customer_name: string;
    customer_phone: string;
    service_id: string;
    employee_id: string;
    status: string;
    notes?: string;
    start: Date;
    end: Date;
  },
  salonId: string
) {
  return {
    salon_id: salonId,
    customer_name: draft.customer_name,
    customer_phone: draft.customer_phone,
    service_id: draft.service_id,
    staff_id: draft.employee_id,
    appointment_start: draft.start.toISOString(),
    appointment_end: draft.end.toISOString(),
    status: draft.status,
    notes: draft.notes || null
  };
}

export function toDateRangeParams(range: unknown, view: string): {start: Date; end: Date} | null {
  if (!range) return null;

  if (Array.isArray(range) && range.length > 0) {
    const start = new Date(range[0] as Date);
    const end = new Date(range[range.length - 1] as Date);
    end.setDate(end.getDate() + 1);
    return {start, end};
  }

  if (view === 'agenda' || view === 'week') {
    const source = range as {start: Date; end: Date};
    const start = new Date(source.start);
    const end = new Date(source.end);
    return {start, end};
  }

  if (view === 'day') {
    const start = new Date(range as Date);
    const end = new Date(range as Date);
    end.setDate(end.getDate() + 1);
    return {start, end};
  }

  const source = range as {start?: Date; end?: Date};
  const start = new Date(source.start || (range as Date));
  const end = new Date(source.end || (range as Date));
  return {start, end};
}
