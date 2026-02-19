export const SLOT_STEP_MINUTES = 15;

export const DAYS = [
  { index: 0, label: "الأحد" },
  { index: 1, label: "الاثنين" },
  { index: 2, label: "الثلاثاء" },
  { index: 3, label: "الأربعاء" },
  { index: 4, label: "الخميس" },
  { index: 5, label: "الجمعة" },
  { index: 6, label: "السبت" },
];

export const DEFAULT_HOURS = DAYS.map((d) => ({
  day_of_week: d.index,
  open_time: "10:00",
  close_time: "20:00",
  is_closed: false,
}));

export const DEFAULT_SERVICES = [
  { name: "قص الشعر", duration_minutes: 45, price: 20000, sort_order: 10 },
  { name: "صبغ الشعر", duration_minutes: 120, price: 55000, sort_order: 20 },
  { name: "تسشوار", duration_minutes: 45, price: 18000, sort_order: 30 },
  { name: "تنظيف بشرة", duration_minutes: 60, price: 30000, sort_order: 40 },
  { name: "مانيكير", duration_minutes: 45, price: 15000, sort_order: 50 },
  { name: "باديكير", duration_minutes: 60, price: 17000, sort_order: 60 },
];

export const DEFAULT_STAFF = [
  { name: "سارة", sort_order: 10 },
  { name: "نور", sort_order: 20 },
  { name: "مريم", sort_order: 30 },
];

export const STATUS_LABELS = {
  pending: "بانتظار التأكيد",
  confirmed: "مؤكد",
  cancelled: "ملغي",
};

export function sortByOrderThenName(a, b) {
  const diff = (a.sort_order || 0) - (b.sort_order || 0);
  if (diff !== 0) return diff;
  return String(a.name || "").localeCompare(String(b.name || ""), "ar");
}

export function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

export function normalizeIraqiPhone(value) {
  const digits = digitsOnly(value);
  if (!digits) return "";
  if (digits.startsWith("964")) return digits;
  if (digits.startsWith("07") && digits.length === 11) return `964${digits.slice(1)}`;
  if (digits.startsWith("7") && digits.length === 10) return `964${digits}`;
  return digits;
}

export function isValidE164WithoutPlus(value) {
  return /^[1-9]\d{7,14}$/.test(String(value || ""));
}

export function toDateInput(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "تاريخ غير معروف";
  return d.toLocaleDateString("ar-IQ", {
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatDateTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "غير معروف";
  return d.toLocaleString("ar-IQ", { dateStyle: "medium", timeStyle: "short" });
}

export function formatTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" });
}

export function formatDateKey(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "invalid";
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

export function formatCurrencyIQD(value) {
  return `${Number(value || 0).toLocaleString("en-US")} د.ع`;
}

export function serviceIcon(name) {
  const t = String(name || "");
  if (t.includes("شعر") || t.includes("صبغ") || t.includes("تسشوار")) return "💇‍♀️";
  if (t.includes("مانيكير") || t.includes("باديكير") || t.includes("أظافر") || t.includes("اظافر")) return "💅";
  if (t.includes("بشرة")) return "✨";
  if (t.includes("مكياج")) return "💄";
  return "🌸";
}

export function csvEscape(value) {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes("\n") || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
