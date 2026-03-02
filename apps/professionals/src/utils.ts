import type {LocaleCode} from './i18n';
import {STAFF_COLORS} from './constants';

export function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h << 5) - h + value.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function randomUuid(): string {
  const template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  return template.replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function toStaffColor(staffId: string, index: number): string {
  if (index < STAFF_COLORS.length) return STAFF_COLORS[index];
  return STAFF_COLORS[hash(staffId) % STAFF_COLORS.length];
}

export function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function atHour(date: Date, hour: number, minute = 0): Date {
  const next = new Date(date);
  next.setHours(hour, minute, 0, 0);
  return next;
}

export function minutesFromDayStart(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function formatTime(value: Date, locale: LocaleCode): string {
  const localeName = locale === 'ar' ? 'ar' : locale === 'cs' ? 'cs-CZ' : locale === 'ru' ? 'ru-RU' : 'en-US';
  return value.toLocaleTimeString(localeName, {hour: '2-digit', minute: '2-digit'});
}

export function formatDayTitle(date: Date, locale: LocaleCode): string {
  const localeName = locale === 'ar' ? 'ar' : locale === 'cs' ? 'cs-CZ' : locale === 'ru' ? 'ru-RU' : 'en-US';
  return date.toLocaleDateString(localeName, {weekday: 'long', month: 'short', day: 'numeric'});
}

export function mapValidationReasonToMessageKey(reason: string): string {
  if (reason === 'outside_working_hours' || reason === 'closed_day' || reason === 'inside_break' || reason === 'time_off') {
    return 'outsideHours';
  }
  if (reason === 'overlap') return 'overlap';
  return 'slotUnavailable';
}

export function formatSalonOperationalCurrency(
  value: number | string | null | undefined,
  salon: {countryCode?: string | null; currencyCode?: string | null},
  locale: LocaleCode
) {
  const amount = Number(value || 0);
  const country = String(salon?.countryCode || '').toUpperCase();
  const code = country === 'IQ' ? 'IQD' : String(salon?.currencyCode || 'USD').toUpperCase();
  const safeLocale = locale === 'ar' ? 'ar-IQ-u-nu-latn' : locale === 'cs' ? 'cs-CZ' : locale === 'ru' ? 'ru-RU' : 'en-US';

  if (code === 'IQD') {
    const numberPart = new Intl.NumberFormat(safeLocale, {maximumFractionDigits: 0}).format(amount);
    return `${numberPart} ${locale === 'ar' ? 'د.ع' : 'IQD'}`;
  }

  try {
    return new Intl.NumberFormat(safeLocale, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 0
    }).format(amount);
  } catch {
    return `${Math.round(amount).toLocaleString('en-US')} ${code}`;
  }
}
