import { isBefore } from "date-fns";

export const CALENDAR_SNAP_MINUTES = 10;

function hhmmToMinutes(value) {
  const [h, m] = String(value || "00:00")
    .slice(0, 5)
    .split(":")
    .map((x) => Number(x || 0));
  return h * 60 + m;
}

function mergeDateWithMinutes(date, minutes) {
  const next = new Date(date);
  next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return next;
}

export function snapDate(date, step = CALENDAR_SNAP_MINUTES) {
  const d = new Date(date);
  const mins = d.getMinutes();
  const snapped = Math.round(mins / step) * step;
  d.setMinutes(snapped, 0, 0);
  return d;
}

export function getWorkingWindow(salonHours = [], employeeHours = [], employeeId, date) {
  const day = new Date(date).getDay();

  const employeeDay = (employeeHours || []).find(
    (row) => String(row.staff_id || row.employee_id) === String(employeeId) && Number(row.day_of_week) === day
  );

  if (employeeDay) {
    if (employeeDay.is_off || employeeDay.is_closed) return null;
    const start = hhmmToMinutes(employeeDay.start_time || employeeDay.open_time);
    const end = hhmmToMinutes(employeeDay.end_time || employeeDay.close_time);
    if (end <= start) return null;

    return {
      start: mergeDateWithMinutes(date, start),
      end: mergeDateWithMinutes(date, end),
      breakStart: employeeDay.break_start ? mergeDateWithMinutes(date, hhmmToMinutes(employeeDay.break_start)) : null,
      breakEnd: employeeDay.break_end ? mergeDateWithMinutes(date, hhmmToMinutes(employeeDay.break_end)) : null,
    };
  }

  const salonDay = (salonHours || []).find((row) => Number(row.day_of_week) === day);
  if (!salonDay || salonDay.is_closed) return null;

  const start = hhmmToMinutes(salonDay.start_time || salonDay.open_time);
  const end = hhmmToMinutes(salonDay.end_time || salonDay.close_time);
  if (end <= start) return null;

  return {
    start: mergeDateWithMinutes(date, start),
    end: mergeDateWithMinutes(date, end),
    breakStart: null,
    breakEnd: null,
  };
}

export function hasOverlap(bookingsForEmployee = [], start, end, excludeBookingId) {
  return (bookingsForEmployee || []).some((row) => {
    const rowId = row?.id;
    if (excludeBookingId && String(rowId) === String(excludeBookingId)) return false;

    const st = new Date(row.appointment_start || row.start_time || row.start);
    const en = new Date(row.appointment_end || row.end_time || row.end);
    if (Number.isNaN(st.getTime()) || Number.isNaN(en.getTime())) return false;

    return start < en && end > st;
  });
}

export function validateBooking({
  employeeId,
  start,
  end,
  bookings = [],
  salonHours = [],
  employeeHours = [],
  excludeBookingId,
  t,
}) {
  if (!employeeId) {
    return { ok: false, reason: t ? t("calendar.errors.selectEmployee", "Select an employee first.") : "Select an employee first." };
  }

  if (!(start instanceof Date) || !(end instanceof Date) || !isBefore(start, end)) {
    return { ok: false, reason: t ? t("calendar.errors.invalidRange", "Invalid time range.") : "Invalid time range." };
  }

  const window = getWorkingWindow(salonHours, employeeHours, employeeId, start);
  if (!window) {
    return {
      ok: false,
      reason: t ? t("calendar.errors.closedDay", "Employee/salon is closed on this day.") : "Employee/salon is closed on this day.",
    };
  }

  if (isBefore(start, window.start) || end > window.end) {
    return {
      ok: false,
      reason: t
        ? t("calendar.errors.outsideWorkingHours", "This booking is outside working hours.")
        : "This booking is outside working hours.",
    };
  }

  if (window.breakStart && window.breakEnd) {
    const overlapsBreak = start < window.breakEnd && end > window.breakStart;
    if (overlapsBreak) {
      return {
        ok: false,
        reason: t ? t("calendar.errors.insideBreak", "This time overlaps break hours.") : "This time overlaps break hours.",
      };
    }
  }

  const busyRows = (bookings || []).filter((row) => {
    const status = String(row.status || "pending");
    const rowEmployeeId = row.staff_id || row.employee_id;
    return String(rowEmployeeId) === String(employeeId) && ["pending", "confirmed"].includes(status);
  });

  if (hasOverlap(busyRows, start, end, excludeBookingId)) {
    return {
      ok: false,
      reason: t ? t("calendar.errors.overlap", "This slot overlaps another booking.") : "This slot overlaps another booking.",
    };
  }

  return { ok: true };
}
