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

export function generateSlots({ date, dayRule, durationMinutes, bookings, nowMs }) {
  if (!date || !dayRule || dayRule.is_closed) return [];

  const openAt = combineDateTime(date, toHHMM(dayRule.open_time));
  const closeAt = combineDateTime(date, toHHMM(dayRule.close_time));
  if (closeAt <= openAt) return [];

  const durationMs = Number(durationMinutes || 0) * 60 * 1000;
  if (durationMs <= 0) return [];

  const slots = [];
  for (
    let startMs = openAt.getTime();
    startMs < closeAt.getTime();
    startMs += SLOT_STEP_MINUTES * 60 * 1000
  ) {
    const endMs = startMs + durationMs;
    if (endMs > closeAt.getTime()) continue;
    if (startMs < nowMs + SLOT_STEP_MINUTES * 60 * 1000) continue;
    if ((bookings || []).some((b) => isOverlap(startMs, endMs, b))) continue;

    slots.push({
      startIso: new Date(startMs).toISOString(),
      endIso: new Date(endMs).toISOString(),
    });
  }

  return slots;
}
