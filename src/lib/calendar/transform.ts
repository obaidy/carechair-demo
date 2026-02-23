import { parseISO } from "date-fns";

export const CALENDAR_BUSY_STATUSES = new Set(["pending", "confirmed"]);

export function getBookingStart(row) {
  const raw = row?.appointment_start || row?.start_time || row?.start || row?.start_at;
  if (!raw) return null;
  const d = typeof raw === "string" ? parseISO(raw) : new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getBookingEnd(row) {
  const raw = row?.appointment_end || row?.end_time || row?.end || row?.end_at;
  if (!raw) return null;
  const d = typeof raw === "string" ? parseISO(raw) : new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getBookingEmployeeId(row) {
  return row?.staff_id || row?.employee_id || null;
}

export function getBookingServiceId(row) {
  return row?.service_id || null;
}

export function toCalendarEvent(row, employeesById = {}, servicesById = {}) {
  const start = getBookingStart(row);
  const end = getBookingEnd(row);
  if (!start || !end) return null;

  const employeeId = getBookingEmployeeId(row);
  const employee = employeeId ? employeesById[employeeId] : null;
  const serviceId = getBookingServiceId(row);
  const service = serviceId ? servicesById[serviceId] : null;
  const customerName = row?.customer_name || "";

  return {
    id: row.id,
    title: customerName || service?.name || "-",
    start,
    end,
    resourceId: employeeId,
    status: row.status || "pending",
    booking: row,
    customerName,
    customerPhone: row?.customer_phone || "",
    serviceName: service?.name || row?.service || "",
    employeeName: employee?.name || "",
    notes: row?.notes || "",
  };
}

export function mapBookingsToEvents(rows = [], employees = [], services = []) {
  const employeesById = Object.fromEntries((employees || []).map((x) => [x.id, x]));
  const servicesById = Object.fromEntries((services || []).map((x) => [x.id, x]));

  return (rows || [])
    .map((row) => toCalendarEvent(row, employeesById, servicesById))
    .filter(Boolean)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function toBookingPayloadFromDraft(draft, salonId) {
  return {
    salon_id: salonId,
    customer_name: draft.customer_name,
    customer_phone: draft.customer_phone,
    service_id: draft.service_id,
    staff_id: draft.employee_id,
    appointment_start: draft.start.toISOString(),
    appointment_end: draft.end.toISOString(),
    status: draft.status,
    notes: draft.notes || null,
  };
}

export function toDateRangeParams(range, view) {
  if (!range) return null;

  if (Array.isArray(range) && range.length > 0) {
    const start = new Date(range[0]);
    const end = new Date(range[range.length - 1]);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  if (view === "agenda" || view === "week") {
    const start = new Date(range.start);
    const end = new Date(range.end);
    return { start, end };
  }

  if (view === "day") {
    const start = new Date(range);
    const end = new Date(range);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  const start = new Date(range.start || range);
  const end = new Date(range.end || range);
  return { start, end };
}
