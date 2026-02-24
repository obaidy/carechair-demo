export const CALENDAR_SNAP_MINUTES = 10;

type WorkingHourRow = {
  day_of_week: number;
  open_time?: string | null;
  close_time?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  is_closed?: boolean | null;
};

type EmployeeHourRow = WorkingHourRow & {
  staff_id?: string | null;
  employee_id?: string | null;
  is_off?: boolean | null;
  break_start?: string | null;
  break_end?: string | null;
};

function hhmmToMinutes(value: string | null | undefined): number {
  const [h, m] = String(value || '00:00')
    .slice(0, 5)
    .split(':')
    .map((x) => Number(x || 0));
  return h * 60 + m;
}

function mergeDateWithMinutes(date: Date, minutes: number): Date {
  const next = new Date(date);
  next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return next;
}

export function snapDate(date: Date, step = CALENDAR_SNAP_MINUTES): Date {
  const next = new Date(date);
  const mins = next.getMinutes();
  const snapped = Math.round(mins / step) * step;
  next.setMinutes(snapped, 0, 0);
  return next;
}

export function getWorkingWindow(
  salonHours: WorkingHourRow[] = [],
  employeeHours: EmployeeHourRow[] = [],
  employeeId: string,
  date: Date
): {
  start: Date;
  end: Date;
  breakStart: Date | null;
  breakEnd: Date | null;
} | null {
  const day = new Date(date).getDay();

  const employeeDay = (employeeHours || []).find(
    (row) => String(row.staff_id || row.employee_id || '') === String(employeeId) && Number(row.day_of_week) === day
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
      breakEnd: employeeDay.break_end ? mergeDateWithMinutes(date, hhmmToMinutes(employeeDay.break_end)) : null
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
    breakEnd: null
  };
}

export function hasOverlap(
  bookingsForEmployee: Array<Record<string, unknown>> = [],
  start: Date,
  end: Date,
  excludeBookingId?: string
): boolean {
  return (bookingsForEmployee || []).some((row) => {
    const rowId = String(row?.id || '');
    if (excludeBookingId && rowId === String(excludeBookingId)) return false;

    const existingStart = new Date(String(row.appointment_start || row.start_time || row.start || '')).getTime();
    const existingEnd = new Date(String(row.appointment_end || row.end_time || row.end || '')).getTime();
    if (!Number.isFinite(existingStart) || !Number.isFinite(existingEnd)) return false;

    return start.getTime() < existingEnd && end.getTime() > existingStart;
  });
}

function parseRangeTime(row: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const raw = row?.[key];
    if (!raw) continue;
    const parsed = new Date(String(raw)).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  return Number.NaN;
}

function hasArbitraryOverlap(
  rows: Array<Record<string, unknown>> = [],
  start: Date,
  end: Date,
  startKeys: string[],
  endKeys: string[]
): boolean {
  return (rows || []).some((row) => {
    const existingStart = parseRangeTime(row, startKeys);
    const existingEnd = parseRangeTime(row, endKeys);
    if (!Number.isFinite(existingStart) || !Number.isFinite(existingEnd)) return false;
    return start.getTime() < existingEnd && end.getTime() > existingStart;
  });
}

export function validateBooking(input: {
  employeeId: string;
  start: Date;
  end: Date;
  bookings?: Array<Record<string, unknown>>;
  timeOff?: Array<Record<string, unknown>>;
  salonHours?: WorkingHourRow[];
  employeeHours?: EmployeeHourRow[];
  excludeBookingId?: string;
  t?: (key: string, fallback: string) => string;
}) {
  const {employeeId, start, end, bookings = [], timeOff = [], salonHours = [], employeeHours = [], excludeBookingId, t} = input;
  const tr = (key: string, fallback: string) => (t ? t(key, fallback) : fallback);

  if (!employeeId) {
    return {ok: false, reason: tr('calendar.errors.selectEmployee', 'Select an employee first.')};
  }

  if (!(start instanceof Date) || !(end instanceof Date) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return {ok: false, reason: tr('calendar.errors.invalidRange', 'Invalid time range.')};
  }

  const window = getWorkingWindow(salonHours, employeeHours, employeeId, start);
  if (!window) {
    return {ok: false, reason: tr('calendar.errors.closedDay', 'Employee/salon is closed on this day.')};
  }

  if (start < window.start || end > window.end) {
    return {ok: false, reason: tr('calendar.errors.outsideWorkingHours', 'This booking is outside working hours.')};
  }

  if (window.breakStart && window.breakEnd) {
    const overlapsBreak = start < window.breakEnd && end > window.breakStart;
    if (overlapsBreak) {
      return {ok: false, reason: tr('calendar.errors.insideBreak', 'This time overlaps break hours.')};
    }
  }

  const busyRows = (bookings || []).filter((row) => {
    const status = String(row.status || 'pending');
    const rowEmployeeId = String(row.staff_id || row.employee_id || '');
    return rowEmployeeId === String(employeeId) && ['pending', 'confirmed'].includes(status);
  });

  if (hasOverlap(busyRows, start, end, excludeBookingId)) {
    return {ok: false, reason: tr('calendar.errors.overlap', 'This slot overlaps another booking.')};
  }

  const offRows = (timeOff || []).filter((row) => {
    const rowEmployeeId = String(row.staff_id || row.employee_id || '');
    return rowEmployeeId === String(employeeId);
  });

  if (hasArbitraryOverlap(offRows, start, end, ['start_at', 'start_time', 'appointment_start'], ['end_at', 'end_time', 'appointment_end'])) {
    return {ok: false, reason: tr('calendar.errors.timeOff', 'Employee is unavailable in this time range.')};
  }

  return {ok: true, reason: ''};
}
