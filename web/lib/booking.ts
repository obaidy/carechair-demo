export const SLOT_STEP_MINUTES = 15;

export function normalizePhone(value: string): string {
  return String(value || '').replace(/\D/g, '');
}

export function isValidE164WithoutPlus(value: string): boolean {
  return /^[1-9]\d{7,14}$/.test(String(value || ''));
}

export function toDateInput(value: Date): string {
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, '0');
  const dd = String(value.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function combineDateTime(dateString: string, hhmm: string): Date {
  const [h, m] = String(hhmm || '00:00').split(':').map((part) => Number(part || 0));
  const d = new Date(`${dateString}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d;
}

function toHHMM(value: string | null | undefined): string {
  return String(value || '00:00').slice(0, 5);
}

function minutes(value: number): number {
  return value * 60 * 1000;
}

function overlaps(startMs: number, endMs: number, booking: {appointment_start: string; appointment_end: string}): boolean {
  const existingStart = new Date(booking.appointment_start).getTime();
  const existingEnd = new Date(booking.appointment_end).getTime();
  if (!Number.isFinite(existingStart) || !Number.isFinite(existingEnd)) return false;
  return startMs < existingEnd && endMs > existingStart;
}

export function generateSlots({
  date,
  dayRule,
  employeeRule,
  durationMinutes,
  bookings,
  timeOff,
  nowMs
}: {
  date: string;
  dayRule: {
    open_time: string | null;
    close_time: string | null;
    is_closed: boolean;
  } | null;
  employeeRule: {
    start_time: string | null;
    end_time: string | null;
    is_off: boolean;
    break_start: string | null;
    break_end: string | null;
  } | null;
  durationMinutes: number;
  bookings: Array<{appointment_start: string; appointment_end: string}>;
  timeOff: Array<{start_at: string; end_at: string}>;
  nowMs: number;
}) {
  if (!dayRule || dayRule.is_closed) return [];

  const openAt = combineDateTime(date, toHHMM(dayRule.open_time));
  const closeAt = combineDateTime(date, toHHMM(dayRule.close_time));
  if (closeAt <= openAt) return [];

  let startRange = openAt.getTime();
  let endRange = closeAt.getTime();

  if (employeeRule) {
    if (employeeRule.is_off) return [];
    const employeeStart = combineDateTime(date, toHHMM(employeeRule.start_time || dayRule.open_time));
    const employeeEnd = combineDateTime(date, toHHMM(employeeRule.end_time || dayRule.close_time));
    if (employeeEnd <= employeeStart) return [];

    startRange = Math.max(startRange, employeeStart.getTime());
    endRange = Math.min(endRange, employeeEnd.getTime());
    if (endRange <= startRange) return [];
  }

  const durationMs = Number(durationMinutes || 0) * 60 * 1000;
  if (durationMs <= 0) return [];

  let breakRange: {start: number; end: number} | null = null;
  if (employeeRule?.break_start && employeeRule?.break_end) {
    const breakStart = combineDateTime(date, toHHMM(employeeRule.break_start)).getTime();
    const breakEnd = combineDateTime(date, toHHMM(employeeRule.break_end)).getTime();
    if (breakEnd > breakStart) {
      breakRange = {start: breakStart, end: breakEnd};
    }
  }

  const timeOffRanges = (timeOff || [])
    .map((item) => ({
      start: new Date(item.start_at).getTime(),
      end: new Date(item.end_at).getTime()
    }))
    .filter((item) => Number.isFinite(item.start) && Number.isFinite(item.end) && item.end > item.start);

  const slots: Array<{startIso: string; endIso: string}> = [];
  for (let slotStart = startRange; slotStart < endRange; slotStart += minutes(SLOT_STEP_MINUTES)) {
    const slotEnd = slotStart + durationMs;
    if (slotEnd > endRange) continue;
    if (slotStart < nowMs + minutes(SLOT_STEP_MINUTES)) continue;

    if (breakRange && slotStart < breakRange.end && slotEnd > breakRange.start) continue;
    if (timeOffRanges.some((off) => slotStart < off.end && slotEnd > off.start)) continue;
    if ((bookings || []).some((booking) => overlaps(slotStart, slotEnd, booking))) continue;

    slots.push({
      startIso: new Date(slotStart).toISOString(),
      endIso: new Date(slotEnd).toISOString()
    });
  }

  return slots;
}
