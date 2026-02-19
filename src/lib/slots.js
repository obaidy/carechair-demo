import { SLOT_STEP_MINUTES } from "./utils";

export function toHHMM(value) {
  return String(value || "10:00").slice(0, 5);
}

export function combineDateTime(dateString, hhmm) {
  const [h, m] = String(hhmm || "00:00")
    .split(":")
    .map((x) => Number(x || 0));

  const d = new Date(`${dateString}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d;
}

export function isOverlap(startMs, endMs, booking) {
  const existingStart = new Date(booking.appointment_start).getTime();
  const existingEnd = new Date(booking.appointment_end).getTime();
  if (Number.isNaN(existingStart) || Number.isNaN(existingEnd)) return false;
  return startMs < existingEnd && endMs > existingStart;
}

function toMs(value) {
  return Number(value || 0) * 60 * 1000;
}

export function generateSlots({
  date,
  dayRule,
  employeeRule,
  durationMinutes,
  bookings,
  timeOff = [],
  nowMs,
}) {
  if (!date || !dayRule || dayRule.is_closed) return [];

  const openAt = combineDateTime(date, toHHMM(dayRule.open_time));
  const closeAt = combineDateTime(date, toHHMM(dayRule.close_time));
  if (closeAt <= openAt) return [];

  let rangeStartMs = openAt.getTime();
  let rangeEndMs = closeAt.getTime();

  if (employeeRule) {
    if (employeeRule.is_off) return [];
    const empStart = combineDateTime(date, toHHMM(employeeRule.start_time || dayRule.open_time));
    const empEnd = combineDateTime(date, toHHMM(employeeRule.end_time || dayRule.close_time));
    if (empEnd <= empStart) return [];
    rangeStartMs = Math.max(rangeStartMs, empStart.getTime());
    rangeEndMs = Math.min(rangeEndMs, empEnd.getTime());
    if (rangeEndMs <= rangeStartMs) return [];
  }

  const durationMs = Number(durationMinutes || 0) * 60 * 1000;
  if (durationMs <= 0) return [];

  let breakRange = null;
  if (employeeRule?.break_start && employeeRule?.break_end) {
    const breakStart = combineDateTime(date, toHHMM(employeeRule.break_start)).getTime();
    const breakEnd = combineDateTime(date, toHHMM(employeeRule.break_end)).getTime();
    if (breakEnd > breakStart) breakRange = { start: breakStart, end: breakEnd };
  }

  const timeOffRanges = (timeOff || [])
    .map((row) => ({
      start: new Date(row.start_at).getTime(),
      end: new Date(row.end_at).getTime(),
    }))
    .filter((row) => Number.isFinite(row.start) && Number.isFinite(row.end) && row.end > row.start);

  const slots = [];
  for (
    let startMs = rangeStartMs;
    startMs < rangeEndMs;
    startMs += toMs(SLOT_STEP_MINUTES)
  ) {
    const endMs = startMs + durationMs;
    if (endMs > rangeEndMs) continue;
    if (startMs < nowMs + toMs(SLOT_STEP_MINUTES)) continue;
    if (breakRange && startMs < breakRange.end && endMs > breakRange.start) continue;
    if (timeOffRanges.some((off) => startMs < off.end && endMs > off.start)) continue;
    if ((bookings || []).some((b) => isOverlap(startMs, endMs, b))) continue;

    slots.push({
      startIso: new Date(startMs).toISOString(),
      endIso: new Date(endMs).toISOString(),
    });
  }

  return slots;
}
