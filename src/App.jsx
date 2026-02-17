import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import "./App.css";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SALON_SLUG = import.meta.env.VITE_SALON_SLUG || "salon-demo";
const SALON_NAME = import.meta.env.VITE_SALON_NAME || "صالون بغداد";
const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || "";
const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASS || "1234";

const SLOT_STEP_MINUTES = 15;

const SUPABASE_CONFIG_ERROR =
  "إعدادات Supabase غير مكتملة. تأكدي من VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY.";

const WEEK_DAYS = [
  { index: 0, label: "الأحد" },
  { index: 1, label: "الاثنين" },
  { index: 2, label: "الثلاثاء" },
  { index: 3, label: "الأربعاء" },
  { index: 4, label: "الخميس" },
  { index: 5, label: "الجمعة" },
  { index: 6, label: "السبت" },
];

const DEFAULT_HOURS = WEEK_DAYS.map((d) => ({
  day_of_week: d.index,
  open_time: "10:00",
  close_time: "20:00",
  is_closed: false,
}));

const DEFAULT_STAFF = [
  { name: "سارة", sort_order: 10 },
  { name: "نور", sort_order: 20 },
  { name: "مريم", sort_order: 30 },
];

const DEFAULT_SERVICES = [
  { name: "قص الشعر", duration_minutes: 45, price: 20000, sort_order: 10, image: "/images/service-hair.jpg" },
  { name: "صبغ الشعر", duration_minutes: 120, price: 55000, sort_order: 20, image: "/images/service-hair.jpg" },
  { name: "تسشوار", duration_minutes: 45, price: 18000, sort_order: 30, image: "/images/service-hair.jpg" },
  { name: "تنظيف بشرة", duration_minutes: 60, price: 30000, sort_order: 40, image: "/images/service-facial.jpg" },
  { name: "مانيكير", duration_minutes: 45, price: 15000, sort_order: 50, image: "/images/service-nails.jpg" },
  { name: "باديكير", duration_minutes: 60, price: 17000, sort_order: 60, image: "/images/service-nails.jpg" },
];

const STATUS_LABELS = {
  pending: "بانتظار التأكيد",
  confirmed: "مؤكد",
  cancelled: "ملغي",
};

const STATUS_COLORS = {
  pending: "#d8a246",
  confirmed: "#49a46f",
  cancelled: "#ca6075",
};

const GALLERY_IMAGES = [
  { src: "/images/gallery-1.jpg", title: "جلسات شعر راقية" },
  { src: "/images/gallery-2.jpg", title: "عناية مميزة بالبشرة" },
  { src: "/images/gallery-3.jpg", title: "قسم الأظافر" },
  { src: "/images/gallery-4.jpg", title: "استقبال أنيق" },
];

function isConfiguredUrl(url) {
  return Boolean(url) && /^https?:\/\//.test(url) && !url.includes("YOUR_SUPABASE_URL");
}

function isConfiguredKey(key) {
  return Boolean(key) && key.length > 20 && !key.includes("YOUR_SUPABASE_ANON_KEY");
}

function createSupabaseFromEnv() {
  if (!isConfiguredUrl(SUPABASE_URL) || !isConfiguredKey(SUPABASE_ANON_KEY)) return null;

  try {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch {
    return null;
  }
}

const supabase = createSupabaseFromEnv();

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeIraqiPhone(value) {
  const digits = digitsOnly(value);
  if (!digits) return "";

  if (digits.startsWith("964")) return digits;
  if (digits.startsWith("07") && digits.length === 11) return `964${digits.slice(1)}`;
  if (digits.startsWith("7") && digits.length === 10) return `964${digits}`;
  return digits;
}

function isValidE164WithoutPlus(value) {
  return /^[1-9]\d{7,14}$/.test(value);
}

function toDateInput(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTime(value) {
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "--:--";
    return d.toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "--:--";
  }
}

function formatDate(value) {
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "تاريخ غير معروف";
    return d.toLocaleDateString("ar-IQ", {
      weekday: "long",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "تاريخ غير معروف";
  }
}

function formatDateKey(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "invalid";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

function formatDateTime(value) {
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "غير معروف";
    return d.toLocaleString("ar-IQ", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "غير معروف";
  }
}

function formatCurrencyIQD(value) {
  const amount = Number(value) || 0;
  return `${amount.toLocaleString("en-US")} د.ع`;
}

function toHHMM(value) {
  if (!value) return "10:00";
  return String(value).slice(0, 5);
}

function combineDateTime(dateString, hhmm) {
  const [h, m] = String(hhmm || "00:00")
    .split(":")
    .map((x) => Number(x || 0));

  const d = new Date(`${dateString}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d;
}

function isOverlap(startMs, endMs, booking) {
  const existingStart = new Date(booking.appointment_start).getTime();
  const existingEnd = new Date(booking.appointment_end).getTime();
  if (Number.isNaN(existingStart) || Number.isNaN(existingEnd)) return false;
  return startMs < existingEnd && endMs > existingStart;
}

function sortByOrderThenName(a, b) {
  const d = (a.sort_order || 0) - (b.sort_order || 0);
  if (d !== 0) return d;
  return String(a.name || "").localeCompare(String(b.name || ""), "ar");
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes("\n") || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildHoursDraft(hoursRows) {
  const map = {};
  for (const day of WEEK_DAYS) {
    map[day.index] = { is_closed: false, open_time: "10:00", close_time: "20:00" };
  }

  for (const row of hoursRows || []) {
    map[row.day_of_week] = {
      is_closed: Boolean(row.is_closed),
      open_time: toHHMM(row.open_time),
      close_time: toHHMM(row.close_time),
    };
  }

  return map;
}

function SafeImage({ src, alt, className, fallbackClassName, fallbackText = "صورة" }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={fallbackClassName} role="img" aria-label={alt}>
        <span>{fallbackText}</span>
      </div>
    );
  }

  return <img src={src} alt={alt} loading="lazy" className={className} onError={() => setFailed(true)} />;
}

function App() {
  const bookingSectionRef = useRef(null);
  const toastTimerRef = useRef(null);

  const [view, setView] = useState("book");

  const [initializing, setInitializing] = useState(true);
  const [salon, setSalon] = useState(null);
  const [salonHours, setSalonHours] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [serviceList, setServiceList] = useState([]);

  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => toDateInput(new Date()));
  const [selectedSlotIso, setSelectedSlotIso] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");

  const [bookingSuccess, setBookingSuccess] = useState(null);
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [staffDayBookings, setStaffDayBookings] = useState([]);

  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState("");
  const [adminPage, setAdminPage] = useState("bookings");
  const [bookingFilter, setBookingFilter] = useState("today");
  const [adminBookings, setAdminBookings] = useState([]);
  const [loadingAdminBookings, setLoadingAdminBookings] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState({});

  const [hoursDraft, setHoursDraft] = useState({});
  const [savingHours, setSavingHours] = useState(false);

  const [newStaffName, setNewStaffName] = useState("");
  const [savingStaff, setSavingStaff] = useState(false);

  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceDuration, setNewServiceDuration] = useState("45");
  const [newServicePrice, setNewServicePrice] = useState("20000");
  const [savingService, setSavingService] = useState(false);

  const [refreshTick, setRefreshTick] = useState(0);
  const [toast, setToast] = useState({ show: false, type: "success", text: "" });

  const salonWhatsapp = normalizeIraqiPhone(WHATSAPP_NUMBER || salon?.whatsapp || "");
  const hasSalonWhatsApp = isValidE164WithoutPlus(salonWhatsapp);

  const activeServices = useMemo(
    () => [...serviceList].filter((s) => s.is_active).sort(sortByOrderThenName),
    [serviceList]
  );

  const activeStaff = useMemo(
    () => [...staffList].filter((s) => s.is_active).sort(sortByOrderThenName),
    [staffList]
  );

  const servicesById = useMemo(() => Object.fromEntries(serviceList.map((s) => [s.id, s])), [serviceList]);
  const staffById = useMemo(() => Object.fromEntries(staffList.map((s) => [s.id, s])), [staffList]);

  const selectedService = servicesById[selectedServiceId] || null;
  const selectedStaff = staffById[selectedStaffId] || null;

  function showToast(type, text) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ show: true, type, text });
    toastTimerRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 3200);
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  function whatsappLink(prefilledText) {
    if (!hasSalonWhatsApp) return "";
    if (!prefilledText) return `https://wa.me/${salonWhatsapp}`;
    return `https://wa.me/${salonWhatsapp}?text=${encodeURIComponent(prefilledText)}`;
  }

  async function loadSalonConfig(salonId) {
    const [hoursRes, staffRes, servicesRes] = await Promise.all([
      supabase.from("salon_hours").select("*").eq("salon_id", salonId).order("day_of_week", { ascending: true }),
      supabase.from("staff").select("*").eq("salon_id", salonId).order("sort_order", { ascending: true }),
      supabase.from("services").select("*").eq("salon_id", salonId).order("sort_order", { ascending: true }),
    ]);

    if (hoursRes.error) throw hoursRes.error;
    if (staffRes.error) throw staffRes.error;
    if (servicesRes.error) throw servicesRes.error;

    const hours = hoursRes.data || [];
    const staff = staffRes.data || [];
    const services = servicesRes.data || [];

    setSalonHours(hours);
    setStaffList(staff);
    setServiceList(services);
    setHoursDraft(buildHoursDraft(hours));

    const firstActiveService = services.filter((s) => s.is_active).sort(sortByOrderThenName)[0];
    const firstActiveStaff = staff.filter((s) => s.is_active).sort(sortByOrderThenName)[0];

    setSelectedServiceId((prev) =>
      prev && services.some((s) => s.id === prev && s.is_active)
        ? prev
        : firstActiveService
          ? firstActiveService.id
          : ""
    );

    setSelectedStaffId((prev) =>
      prev && staff.some((s) => s.id === prev && s.is_active)
        ? prev
        : firstActiveStaff
          ? firstActiveStaff.id
          : ""
    );
  }

  async function seedDefaultsIfMissing(salonId) {
    const [hoursCountRes, staffCountRes, servicesCountRes] = await Promise.all([
      supabase.from("salon_hours").select("id", { count: "exact", head: true }).eq("salon_id", salonId),
      supabase.from("staff").select("id", { count: "exact", head: true }).eq("salon_id", salonId),
      supabase.from("services").select("id", { count: "exact", head: true }).eq("salon_id", salonId),
    ]);

    if (hoursCountRes.error) throw hoursCountRes.error;
    if (staffCountRes.error) throw staffCountRes.error;
    if (servicesCountRes.error) throw servicesCountRes.error;

    if ((hoursCountRes.count || 0) === 0) {
      const payload = DEFAULT_HOURS.map((row) => ({
        salon_id: salonId,
        day_of_week: row.day_of_week,
        open_time: `${row.open_time}:00`,
        close_time: `${row.close_time}:00`,
        is_closed: row.is_closed,
      }));

      const { error } = await supabase.from("salon_hours").upsert(payload, {
        onConflict: "salon_id,day_of_week",
      });
      if (error) throw error;
    }

    if ((staffCountRes.count || 0) === 0) {
      const payload = DEFAULT_STAFF.map((row) => ({
        salon_id: salonId,
        name: row.name,
        is_active: true,
        sort_order: row.sort_order,
      }));
      const { error } = await supabase.from("staff").upsert(payload, {
        onConflict: "salon_id,name",
      });
      if (error) throw error;
    }

    if ((servicesCountRes.count || 0) === 0) {
      const payload = DEFAULT_SERVICES.map((row) => ({
        salon_id: salonId,
        name: row.name,
        duration_minutes: row.duration_minutes,
        price: row.price,
        is_active: true,
        sort_order: row.sort_order,
      }));
      const { error } = await supabase.from("services").upsert(payload, {
        onConflict: "salon_id,name",
      });
      if (error) throw error;
    }
  }

  async function bootstrap() {
    if (!supabase) {
      setInitializing(false);
      return;
    }

    setInitializing(true);

    try {
      let { data: foundSalon, error: salonError } = await supabase
        .from("salons")
        .select("*")
        .eq("slug", SALON_SLUG)
        .maybeSingle();

      if (salonError) throw salonError;

      if (!foundSalon) {
        const insertRes = await supabase
          .from("salons")
          .insert([
            {
              slug: SALON_SLUG,
              name: SALON_NAME,
              timezone: "Asia/Baghdad",
              whatsapp: salonWhatsapp || null,
            },
          ])
          .select("*")
          .single();

        if (insertRes.error) throw insertRes.error;
        foundSalon = insertRes.data;
      } else {
        const patch = {};
        if (foundSalon.name !== SALON_NAME) patch.name = SALON_NAME;
        if (salonWhatsapp && foundSalon.whatsapp !== salonWhatsapp) patch.whatsapp = salonWhatsapp;

        if (Object.keys(patch).length > 0) {
          const patchRes = await supabase
            .from("salons")
            .update(patch)
            .eq("id", foundSalon.id)
            .select("*")
            .single();
          if (patchRes.error) throw patchRes.error;
          foundSalon = patchRes.data;
        }
      }

      setSalon(foundSalon);

      await seedDefaultsIfMissing(foundSalon.id);
      await loadSalonConfig(foundSalon.id);
    } catch (err) {
      showToast("error", `تعذر تحميل إعدادات الصالون: ${err?.message || err}`);
    } finally {
      setInitializing(false);
    }
  }

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedServiceId || activeServices.some((s) => s.id === selectedServiceId)) return;
    setSelectedServiceId(activeServices[0]?.id || "");
  }, [activeServices, selectedServiceId]);

  useEffect(() => {
    if (!selectedStaffId || activeStaff.some((s) => s.id === selectedStaffId)) return;
    setSelectedStaffId(activeStaff[0]?.id || "");
  }, [activeStaff, selectedStaffId]);

  useEffect(() => {
    setSelectedSlotIso("");
  }, [selectedDate, selectedServiceId, selectedStaffId]);

  async function loadStaffDayBookings() {
    if (!supabase || !salon?.id || !selectedStaffId || !selectedDate) {
      setStaffDayBookings([]);
      return;
    }

    setLoadingSlots(true);

    try {
      const dayStart = combineDateTime(selectedDate, "00:00");
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const { data, error } = await supabase
        .from("bookings")
        .select("id, appointment_start, appointment_end, status")
        .eq("salon_id", salon.id)
        .eq("staff_id", selectedStaffId)
        .in("status", ["pending", "confirmed"])
        .lt("appointment_start", dayEnd.toISOString())
        .gt("appointment_end", dayStart.toISOString())
        .order("appointment_start", { ascending: true });

      if (error) throw error;
      setStaffDayBookings(data || []);
    } catch (err) {
      showToast("error", `تعذر تحميل المواعيد المتاحة: ${err?.message || err}`);
    } finally {
      setLoadingSlots(false);
    }
  }

  useEffect(() => {
    loadStaffDayBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salon?.id, selectedStaffId, selectedDate, refreshTick]);

  const hoursByDay = useMemo(() => {
    const map = {};
    for (const row of salonHours) map[row.day_of_week] = row;
    return map;
  }, [salonHours]);

  const availableSlots = useMemo(() => {
    if (!selectedService || !selectedDate || !selectedStaffId) return [];

    const dayDate = new Date(`${selectedDate}T00:00:00`);
    if (Number.isNaN(dayDate.getTime())) return [];

    const dayRule = hoursByDay[dayDate.getDay()];
    if (!dayRule || dayRule.is_closed) return [];

    const openAt = combineDateTime(selectedDate, toHHMM(dayRule.open_time));
    const closeAt = combineDateTime(selectedDate, toHHMM(dayRule.close_time));

    if (closeAt <= openAt) return [];

    const durationMs = Number(selectedService.duration_minutes || 0) * 60 * 1000;
    if (durationMs <= 0) return [];

    const now = Date.now();
    const slots = [];

    for (let startMs = openAt.getTime(); startMs < closeAt.getTime(); startMs += SLOT_STEP_MINUTES * 60 * 1000) {
      const endMs = startMs + durationMs;
      if (endMs > closeAt.getTime()) continue;

      if (startMs < now + SLOT_STEP_MINUTES * 60 * 1000) continue;

      const hasOverlap = staffDayBookings.some((b) => isOverlap(startMs, endMs, b));
      if (hasOverlap) continue;

      slots.push({
        startIso: new Date(startMs).toISOString(),
        endIso: new Date(endMs).toISOString(),
        label: formatTime(startMs),
      });
    }

    return slots;
  }, [hoursByDay, selectedDate, selectedService, selectedStaffId, staffDayBookings]);

  useEffect(() => {
    if (selectedSlotIso && !availableSlots.some((slot) => slot.startIso === selectedSlotIso)) {
      setSelectedSlotIso("");
    }
  }, [availableSlots, selectedSlotIso]);

  function bookingSummary() {
    if (!selectedService || !selectedStaff || !selectedSlotIso) {
      return {
        service: selectedService?.name || "لم يتم الاختيار",
        staff: selectedStaff?.name || "لم يتم الاختيار",
        time: "اختاري الموعد",
        price: selectedService ? formatCurrencyIQD(selectedService.price) : "-",
      };
    }

    return {
      service: selectedService.name,
      staff: selectedStaff.name,
      time: formatDateTime(selectedSlotIso),
      price: formatCurrencyIQD(selectedService.price),
    };
  }

  async function createBooking(e) {
    e.preventDefault();

    if (!supabase) {
      showToast("error", SUPABASE_CONFIG_ERROR);
      return;
    }

    if (!salon?.id) {
      showToast("error", "تعذر تحديد الصالون. أعيدي تحديث الصفحة.");
      return;
    }

    if (customerName.trim().length < 2) {
      showToast("error", "يرجى كتابة الاسم بشكل صحيح.");
      return;
    }

    const normalizedPhone = normalizeIraqiPhone(customerPhone);
    if (!isValidE164WithoutPlus(normalizedPhone)) {
      showToast("error", "يرجى إدخال رقم هاتف صحيح مثل 07xxxxxxxxx.");
      return;
    }

    if (!selectedService || !selectedStaff || !selectedSlotIso) {
      showToast("error", "يرجى اختيار الخدمة والموظفة والموعد.");
      return;
    }

    const slot = availableSlots.find((s) => s.startIso === selectedSlotIso);
    if (!slot) {
      showToast("error", "الموعد المختار لم يعد متاحاً. اختاري موعداً آخر.");
      return;
    }

    setSubmittingBooking(true);

    try {
      const { data, error } = await supabase
        .from("bookings")
        .insert([
          {
            salon_id: salon.id,
            salon_slug: SALON_SLUG,
            salon_whatsapp: salonWhatsapp || salon.whatsapp || null,
            customer_name: customerName.trim(),
            customer_phone: normalizedPhone,
            service_id: selectedService.id,
            staff_id: selectedStaff.id,
            service: selectedService.name,
            staff: selectedStaff.name,
            appointment_start: slot.startIso,
            appointment_end: slot.endIso,
            appointment_at: slot.startIso,
            notes: notes.trim() || null,
            status: "pending",
          },
        ])
        .select("id, appointment_start, service_id, staff_id")
        .single();

      if (error) throw error;

      setBookingSuccess({
        id: data?.id,
        appointment_start: data?.appointment_start || slot.startIso,
        service_name: selectedService.name,
        staff_name: selectedStaff.name,
      });

      setNotes("");
      showToast("success", "تم إرسال طلب الحجز بنجاح.");
      setRefreshTick((x) => x + 1);
    } catch (err) {
      showToast("error", `تعذر إرسال الحجز حالياً: ${err?.message || err}`);
    } finally {
      setSubmittingBooking(false);
    }
  }

  async function loadAdminBookings() {
    if (!supabase || !salon?.id) return;

    setLoadingAdminBookings(true);

    try {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("salon_id", salon.id)
        .order("appointment_start", { ascending: true })
        .limit(1000);

      if (error) throw error;
      setAdminBookings(data || []);
    } catch (err) {
      showToast("error", `تعذر تحميل الحجوزات: ${err?.message || err}`);
    } finally {
      setLoadingAdminBookings(false);
    }
  }

  useEffect(() => {
    if (view === "admin" && adminUnlocked) {
      loadAdminBookings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, adminUnlocked, salon?.id, refreshTick]);

  async function updateBookingStatus(bookingId, nextStatus) {
    if (!supabase || !salon?.id) return;
    if (statusUpdating[bookingId]) return;

    const previous = adminBookings.find((b) => b.id === bookingId);
    if (!previous) return;

    setStatusUpdating((prev) => ({ ...prev, [bookingId]: nextStatus }));
    setAdminBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status: nextStatus } : b)));

    try {
      const { data, error } = await supabase
        .from("bookings")
        .update({ status: nextStatus })
        .eq("id", bookingId)
        .eq("salon_id", salon.id)
        .select("*")
        .single();

      if (error) throw error;

      setAdminBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, ...data } : b)));
      showToast(
        "success",
        nextStatus === "confirmed"
          ? "تم تأكيد الحجز وإشعار العميلة."
          : "تم رفض الحجز وإشعار العميلة."
      );
      setRefreshTick((x) => x + 1);
    } catch (err) {
      setAdminBookings((prev) => prev.map((b) => (b.id === bookingId ? previous : b)));
      showToast("error", `تعذر تحديث الحالة: ${err?.message || err}`);
    } finally {
      setStatusUpdating((prev) => {
        const next = { ...prev };
        delete next[bookingId];
        return next;
      });
    }
  }

  async function saveHoursSettings() {
    if (!supabase || !salon?.id) return;

    for (const day of WEEK_DAYS) {
      const row = hoursDraft[day.index];
      if (!row) continue;
      if (!row.is_closed && row.close_time <= row.open_time) {
        showToast("error", `وقت الإغلاق يجب أن يكون بعد وقت الفتح (${day.label}).`);
        return;
      }
    }

    setSavingHours(true);

    try {
      const payload = WEEK_DAYS.map((day) => {
        const row = hoursDraft[day.index] || { is_closed: false, open_time: "10:00", close_time: "20:00" };
        return {
          salon_id: salon.id,
          day_of_week: day.index,
          open_time: `${row.open_time}:00`,
          close_time: `${row.close_time}:00`,
          is_closed: Boolean(row.is_closed),
        };
      });

      const { error } = await supabase.from("salon_hours").upsert(payload, {
        onConflict: "salon_id,day_of_week",
      });

      if (error) throw error;

      showToast("success", "تم حفظ ساعات العمل.");
      await loadSalonConfig(salon.id);
      setRefreshTick((x) => x + 1);
    } catch (err) {
      showToast("error", `تعذر حفظ ساعات العمل: ${err?.message || err}`);
    } finally {
      setSavingHours(false);
    }
  }

  async function addStaff() {
    if (!supabase || !salon?.id) return;
    const name = newStaffName.trim();
    if (name.length < 2) {
      showToast("error", "يرجى إدخال اسم موظفة صحيح.");
      return;
    }

    setSavingStaff(true);

    try {
      const maxSort = Math.max(0, ...staffList.map((s) => Number(s.sort_order || 0)));
      const { error } = await supabase.from("staff").insert([
        {
          salon_id: salon.id,
          name,
          is_active: true,
          sort_order: maxSort + 10,
        },
      ]);
      if (error) throw error;

      setNewStaffName("");
      showToast("success", "تمت إضافة الموظفة.");
      await loadSalonConfig(salon.id);
    } catch (err) {
      showToast("error", `تعذر إضافة الموظفة: ${err?.message || err}`);
    } finally {
      setSavingStaff(false);
    }
  }

  async function toggleStaffActive(row) {
    if (!supabase || !salon?.id) return;

    try {
      const { error } = await supabase
        .from("staff")
        .update({ is_active: !row.is_active })
        .eq("id", row.id)
        .eq("salon_id", salon.id);

      if (error) throw error;

      setStaffList((prev) => prev.map((s) => (s.id === row.id ? { ...s, is_active: !row.is_active } : s)));
      showToast("success", !row.is_active ? "تم تفعيل الموظفة." : "تم تعطيل الموظفة.");
    } catch (err) {
      showToast("error", `تعذر تحديث الموظفة: ${err?.message || err}`);
    }
  }

  async function addService() {
    if (!supabase || !salon?.id) return;

    const name = newServiceName.trim();
    const duration = Number(newServiceDuration);
    const price = Number(newServicePrice);

    if (name.length < 2) {
      showToast("error", "يرجى إدخال اسم خدمة صحيح.");
      return;
    }

    if (!Number.isFinite(duration) || duration <= 0) {
      showToast("error", "يرجى إدخال مدة صحيحة بالدقائق.");
      return;
    }

    if (!Number.isFinite(price) || price < 0) {
      showToast("error", "يرجى إدخال سعر صحيح.");
      return;
    }

    setSavingService(true);

    try {
      const maxSort = Math.max(0, ...serviceList.map((s) => Number(s.sort_order || 0)));
      const { error } = await supabase.from("services").insert([
        {
          salon_id: salon.id,
          name,
          duration_minutes: duration,
          price,
          is_active: true,
          sort_order: maxSort + 10,
        },
      ]);

      if (error) throw error;

      setNewServiceName("");
      setNewServiceDuration("45");
      setNewServicePrice("20000");
      showToast("success", "تمت إضافة الخدمة.");
      await loadSalonConfig(salon.id);
    } catch (err) {
      showToast("error", `تعذر إضافة الخدمة: ${err?.message || err}`);
    } finally {
      setSavingService(false);
    }
  }

  async function toggleServiceActive(row) {
    if (!supabase || !salon?.id) return;

    try {
      const { error } = await supabase
        .from("services")
        .update({ is_active: !row.is_active })
        .eq("id", row.id)
        .eq("salon_id", salon.id);

      if (error) throw error;

      setServiceList((prev) => prev.map((s) => (s.id === row.id ? { ...s, is_active: !row.is_active } : s)));
      showToast("success", !row.is_active ? "تم تفعيل الخدمة." : "تم تعطيل الخدمة.");
    } catch (err) {
      showToast("error", `تعذر تحديث الخدمة: ${err?.message || err}`);
    }
  }

  function exportBookingsCsv() {
    const headers = [
      "id",
      "customer_name",
      "customer_phone",
      "service",
      "staff",
      "appointment_start",
      "appointment_end",
      "status",
      "notes",
    ];

    const rows = adminBookings.map((b) => [
      b.id,
      b.customer_name,
      b.customer_phone,
      servicesById[b.service_id]?.name || b.service || "",
      staffById[b.staff_id]?.name || b.staff || "",
      b.appointment_start,
      b.appointment_end,
      b.status,
      b.notes || "",
    ]);

    const csv = [headers.map(csvEscape).join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `bookings-${Date.now()}.csv`;
    a.click();

    URL.revokeObjectURL(url);
    showToast("success", "تم تنزيل ملف CSV.");
  }

  const todayKey = formatDateKey(new Date());
  const nowMs = Date.now();

  const sortedAdminBookings = useMemo(() => {
    return [...adminBookings].sort(
      (a, b) => new Date(a.appointment_start).getTime() - new Date(b.appointment_start).getTime()
    );
  }, [adminBookings]);

  const filteredBookings = useMemo(() => {
    if (bookingFilter === "all") return sortedAdminBookings;

    if (bookingFilter === "today") {
      return sortedAdminBookings.filter((b) => formatDateKey(b.appointment_start) === todayKey);
    }

    return sortedAdminBookings.filter((b) => new Date(b.appointment_start).getTime() >= nowMs);
  }, [bookingFilter, sortedAdminBookings, todayKey, nowMs]);

  const groupedBookings = useMemo(() => {
    const map = {};

    for (const row of filteredBookings) {
      const key = formatDateKey(row.appointment_start);
      if (!map[key]) {
        map[key] = {
          key,
          label: formatDate(row.appointment_start),
          items: [],
        };
      }
      map[key].items.push(row);
    }

    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
  }, [filteredBookings]);

  const kpis = useMemo(() => {
    return {
      today: sortedAdminBookings.filter((b) => formatDateKey(b.appointment_start) === todayKey).length,
      pending: sortedAdminBookings.filter((b) => b.status === "pending").length,
      confirmed: sortedAdminBookings.filter((b) => b.status === "confirmed").length,
      cancelled: sortedAdminBookings.filter((b) => b.status === "cancelled").length,
    };
  }, [sortedAdminBookings, todayKey]);

  const statusDistribution = useMemo(() => {
    const total = kpis.pending + kpis.confirmed + kpis.cancelled;
    if (total === 0) {
      return {
        total,
        ring: "conic-gradient(#ece7e8 0deg 360deg)",
      };
    }

    const p1 = (kpis.pending / total) * 360;
    const p2 = p1 + (kpis.confirmed / total) * 360;

    return {
      total,
      ring: `conic-gradient(${STATUS_COLORS.pending} 0deg ${p1}deg, ${STATUS_COLORS.confirmed} ${p1}deg ${p2}deg, ${STATUS_COLORS.cancelled} ${p2}deg 360deg)`,
    };
  }, [kpis]);

  const topServices = useMemo(() => {
    const counter = {};
    for (const row of sortedAdminBookings) {
      const name = servicesById[row.service_id]?.name || row.service || "غير محدد";
      counter[name] = (counter[name] || 0) + 1;
    }

    return Object.entries(counter)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [sortedAdminBookings, servicesById]);

  const maxServiceCount = topServices[0]?.count || 1;
  const summary = bookingSummary();

  function scrollToBooking() {
    bookingSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (initializing) {
    return (
      <div className="premium-app" dir="rtl">
        <div className="loading-card">جاري تجهيز النظام...</div>
      </div>
    );
  }

  return (
    <div className="premium-app" dir="rtl">
      <header className="top-header">
        <div className="brand-side">
          <span className="mini-badge">نظام حجوزات احترافي</span>
          <h1>{SALON_NAME}</h1>
          <p>نظام مواعيد منظم مع توفر لحظي لكل موظفة وخدمة.</p>
        </div>

        <div className="mode-switch">
          <button
            type="button"
            onClick={() => setView("book")}
            className={view === "book" ? "mode-btn active" : "mode-btn"}
          >
            صفحة العملاء
          </button>
          <button
            type="button"
            onClick={() => setView("admin")}
            className={view === "admin" ? "mode-btn active" : "mode-btn"}
          >
            لوحة الإدارة
          </button>
        </div>
      </header>

      <main className="page-wrap">
        {!supabase ? <div className="inline-warning">{SUPABASE_CONFIG_ERROR}</div> : null}

        {view === "book" ? (
          <>
            <section className="hero-panel">
              <SafeImage
                src="/images/hero.jpg"
                alt={`صورة رئيسية لصالون ${SALON_NAME}`}
                className="hero-bg-image"
                fallbackClassName="hero-bg-fallback"
                fallbackText="واجهة الصالون"
              />
              <div className="hero-overlay" />
              <div className="hero-content">
                <p className="eyebrow">أهلاً وسهلاً بيج في {SALON_NAME}</p>
                <h2>احجزي موعدج بثواني وبكل سهولة</h2>
                <p>المواعيد اللي تشوفينها هنا متاحة فعلياً حسب جدول الموظفات وساعات العمل.</p>

                <div className="hero-actions">
                  <button type="button" className="primary-cta" onClick={scrollToBooking}>
                    احجزي الآن
                  </button>
                  {hasSalonWhatsApp ? (
                    <a
                      href={whatsappLink("مرحبا، أريد الاستفسار عن المواعيد المتاحة")}
                      target="_blank"
                      rel="noreferrer"
                      className="secondary-cta"
                    >
                      تواصل واتساب
                    </a>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="portfolio-section">
              <div className="section-head">
                <h3>معرض الأعمال</h3>
                <p>نماذج من أجواء وخدمات الصالون</p>
              </div>
              <div className="portfolio-grid">
                {GALLERY_IMAGES.map((item) => (
                  <article key={item.src} className="gallery-card">
                    <SafeImage
                      src={item.src}
                      alt={item.title}
                      className="gallery-image"
                      fallbackClassName="gallery-fallback"
                      fallbackText={item.title}
                    />
                  </article>
                ))}
              </div>
            </section>

            <section className="booking-section" ref={bookingSectionRef}>
              {!bookingSuccess ? (
                <>
                  <div className="section-head">
                    <h3>احجزي موعدك</h3>
                    <p>اختاري الخدمة، الموظفة، اليوم، والوقت المتاح فقط.</p>
                  </div>

                  <form onSubmit={createBooking} className="booking-form">
                    <label className="field">
                      <span>الاسم</span>
                      <input
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="مثال: زهراء أحمد"
                        className="input"
                      />
                    </label>

                    <label className="field">
                      <span>رقم الهاتف</span>
                      <input
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="07xxxxxxxxx"
                        inputMode="tel"
                        className="input"
                      />
                    </label>

                    <div className="field">
                      <span>الخدمة</span>
                      {activeServices.length === 0 ? (
                        <div className="slots-empty">لا توجد خدمات مفعلة حالياً.</div>
                      ) : (
                        <div className="service-grid">
                          {activeServices.map((item, i) => {
                            const image = DEFAULT_SERVICES[i % DEFAULT_SERVICES.length]?.image || "/images/service-hair.jpg";
                            const active = selectedServiceId === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                className={active ? "service-card active" : "service-card"}
                                onClick={() => setSelectedServiceId(item.id)}
                              >
                                <SafeImage
                                  src={image}
                                  alt={item.name}
                                  className="service-image"
                                  fallbackClassName="service-fallback"
                                  fallbackText={item.name}
                                />
                                <strong>{item.name}</strong>
                                <small>{item.duration_minutes} دقيقة</small>
                                <b>{formatCurrencyIQD(item.price)}</b>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="field">
                      <span>الموظفة</span>
                      {activeStaff.length === 0 ? (
                        <div className="slots-empty">لا توجد موظفات مفعّلات حالياً.</div>
                      ) : (
                        <div className="staff-chips">
                          {activeStaff.map((item) => {
                            const active = selectedStaffId === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                className={active ? "staff-chip active" : "staff-chip"}
                                onClick={() => setSelectedStaffId(item.id)}
                              >
                                <b>{item.name}</b>
                                <small>{item.is_active ? "متاحة" : "غير متاحة"}</small>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <label className="field">
                      <span>اليوم</span>
                      <input
                        type="date"
                        className="input"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                      />
                    </label>

                    <div className="field">
                      <span>أقرب المواعيد المتاحة ({SLOT_STEP_MINUTES} دقيقة)</span>
                      {loadingSlots ? (
                        <div className="slots-empty">جاري تحميل المواعيد...</div>
                      ) : availableSlots.length === 0 ? (
                        <div className="slots-empty">
                          لا توجد مواعيد متاحة لهذا اليوم مع الاختيارات الحالية.
                        </div>
                      ) : (
                        <div className="slots-wrap">
                          {availableSlots.map((slot) => {
                            const active = selectedSlotIso === slot.startIso;
                            return (
                              <button
                                key={slot.startIso}
                                type="button"
                                className={active ? "slot-pill active" : "slot-pill"}
                                onClick={() => setSelectedSlotIso(slot.startIso)}
                              >
                                <b>{slot.label}</b>
                                <small>{formatDateKey(slot.startIso)}</small>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <label className="field">
                      <span>ملاحظات إضافية (اختياري)</span>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="input textarea"
                        placeholder="مثال: أفضل وقت بعد العصر"
                      />
                    </label>

                    <div className="summary-card">
                      <h4>ملخص الحجز</h4>
                      <p>
                        <b>الخدمة:</b> {summary.service}
                      </p>
                      <p>
                        <b>الموظفة:</b> {summary.staff}
                      </p>
                      <p>
                        <b>السعر:</b> {summary.price}
                      </p>
                      <p>
                        <b>الموعد:</b> {summary.time}
                      </p>
                    </div>

                    <button className="submit-main" disabled={submittingBooking || !selectedSlotIso}>
                      {submittingBooking ? "جاري إرسال الطلب..." : "تأكيد الحجز"}
                    </button>
                  </form>
                </>
              ) : (
                <div className="success-screen">
                  <div className="success-icon">✓</div>
                  <h3>تم إرسال طلب الحجز</h3>
                  <p>سيتواصل الصالون لتأكيد الموعد.</p>

                  <div className="success-details">
                    <p>
                      <b>رقم الطلب:</b> {bookingSuccess.id}
                    </p>
                    <p>
                      <b>الخدمة:</b> {bookingSuccess.service_name}
                    </p>
                    <p>
                      <b>الموظفة:</b> {bookingSuccess.staff_name}
                    </p>
                    <p>
                      <b>الوقت:</b> {formatDateTime(bookingSuccess.appointment_start)}
                    </p>
                  </div>

                  <div className="success-actions">
                    {hasSalonWhatsApp ? (
                      <a
                        href={whatsappLink(`مرحباً، أرسلت طلب حجز برقم ${bookingSuccess.id} وأريد المتابعة.`)}
                        target="_blank"
                        rel="noreferrer"
                        className="secondary-cta"
                      >
                        مراسلة الصالون عبر واتساب
                      </a>
                    ) : null}

                    <button type="button" className="primary-cta" onClick={() => setBookingSuccess(null)}>
                      حجز جديد
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="admin-section">
            <div className="section-head">
              <h3>لوحة الإدارة</h3>
              <p>إدارة الحجوزات والإعدادات من مكان واحد.</p>
            </div>

            {!adminUnlocked ? (
              <form
                className="admin-lock"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (adminPassInput === ADMIN_PASS) {
                    setAdminUnlocked(true);
                    showToast("success", "تم فتح لوحة الإدارة.");
                  } else {
                    showToast("error", "رمز المرور غير صحيح.");
                  }
                }}
              >
                <label className="field">
                  <span>رمز دخول الإدارة</span>
                  <input
                    className="input"
                    value={adminPassInput}
                    onChange={(e) => setAdminPassInput(e.target.value)}
                    placeholder="أدخلي الرمز"
                  />
                </label>
                <button className="submit-main">دخول</button>
              </form>
            ) : (
              <>
                <div className="admin-page-tabs">
                  <button
                    type="button"
                    className={adminPage === "bookings" ? "tab-btn active" : "tab-btn"}
                    onClick={() => setAdminPage("bookings")}
                  >
                    الحجوزات
                  </button>
                  <button
                    type="button"
                    className={adminPage === "settings" ? "tab-btn active" : "tab-btn"}
                    onClick={() => setAdminPage("settings")}
                  >
                    الإعدادات
                  </button>
                </div>

                {adminPage === "bookings" ? (
                  <>
                    <div className="kpi-grid">
                      <article className="kpi-card">
                        <span>طلبات اليوم</span>
                        <strong>{kpis.today}</strong>
                      </article>
                      <article className="kpi-card">
                        <span>بانتظار التأكيد</span>
                        <strong>{kpis.pending}</strong>
                      </article>
                      <article className="kpi-card">
                        <span>مؤكد</span>
                        <strong>{kpis.confirmed}</strong>
                      </article>
                      <article className="kpi-card">
                        <span>ملغي</span>
                        <strong>{kpis.cancelled}</strong>
                      </article>
                    </div>

                    <div className="admin-toolbar">
                      <div className="tabs">
                        <button
                          type="button"
                          className={bookingFilter === "today" ? "tab-btn active" : "tab-btn"}
                          onClick={() => setBookingFilter("today")}
                        >
                          اليوم
                        </button>
                        <button
                          type="button"
                          className={bookingFilter === "upcoming" ? "tab-btn active" : "tab-btn"}
                          onClick={() => setBookingFilter("upcoming")}
                        >
                          القادمة
                        </button>
                        <button
                          type="button"
                          className={bookingFilter === "all" ? "tab-btn active" : "tab-btn"}
                          onClick={() => setBookingFilter("all")}
                        >
                          الكل
                        </button>
                      </div>

                      <div className="toolbar-actions">
                        <button type="button" className="ghost-btn" onClick={loadAdminBookings}>
                          {loadingAdminBookings ? "جاري التحديث..." : "تحديث"}
                        </button>
                        <button type="button" className="ghost-btn" onClick={exportBookingsCsv}>
                          تصدير CSV
                        </button>
                      </div>
                    </div>

                    <section className="analytics-grid">
                      <article className="analytics-card">
                        <h4>توزيع الحالات</h4>
                        <div className="ring-wrap">
                          <div className="status-ring" style={{ background: statusDistribution.ring }}>
                            <div className="ring-center">{statusDistribution.total}</div>
                          </div>
                          <div className="ring-legend">
                            <p>
                              <span style={{ background: STATUS_COLORS.pending }} /> بانتظار ({kpis.pending})
                            </p>
                            <p>
                              <span style={{ background: STATUS_COLORS.confirmed }} /> مؤكد ({kpis.confirmed})
                            </p>
                            <p>
                              <span style={{ background: STATUS_COLORS.cancelled }} /> ملغي ({kpis.cancelled})
                            </p>
                          </div>
                        </div>
                      </article>

                      <article className="analytics-card">
                        <h4>الخدمات الأكثر طلباً</h4>
                        {topServices.length === 0 ? (
                          <p className="muted">لا توجد بيانات حالياً.</p>
                        ) : (
                          <div className="bars">
                            {topServices.map((row) => (
                              <div key={row.name} className="bar-row">
                                <div className="bar-head">
                                  <span>{row.name}</span>
                                  <b>{row.count}</b>
                                </div>
                                <div className="bar-track">
                                  <div
                                    className="bar-fill"
                                    style={{ width: `${Math.max(8, (row.count / maxServiceCount) * 100)}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </article>
                    </section>

                    <section className="calendar-list">
                      {groupedBookings.length === 0 ? (
                        <div className="empty-box">لا توجد حجوزات ضمن هذا الفلتر.</div>
                      ) : (
                        groupedBookings.map((group) => (
                          <div className="date-group" key={group.key}>
                            <div className="date-header">
                              <h5>{group.label}</h5>
                              <span>{group.items.length} حجز</span>
                            </div>

                            <div className="bookings-stack">
                              {group.items.map((row) => {
                                const serviceName = servicesById[row.service_id]?.name || row.service || "-";
                                const staffName = staffById[row.staff_id]?.name || row.staff || "-";
                                const rowLoading = Boolean(statusUpdating[row.id]);
                                const rowTarget = statusUpdating[row.id];

                                return (
                                  <article key={row.id} className="booking-card">
                                    <div className="booking-top">
                                      <div>
                                        <h6>{row.customer_name}</h6>
                                        <p>{row.customer_phone}</p>
                                      </div>
                                      <span className={`status-badge status-${row.status || "pending"}`}>
                                        {STATUS_LABELS[row.status] || "غير معروف"}
                                      </span>
                                    </div>

                                    <div className="booking-info">
                                      <p>
                                        <b>الخدمة:</b> {serviceName}
                                      </p>
                                      <p>
                                        <b>الموظفة:</b> {staffName}
                                      </p>
                                      <p>
                                        <b>الوقت:</b> {formatTime(row.appointment_start)}
                                      </p>
                                      <p>
                                        <b>المدة:</b>{" "}
                                        {servicesById[row.service_id]?.duration_minutes
                                          ? `${servicesById[row.service_id].duration_minutes} دقيقة`
                                          : "-"}
                                      </p>
                                      {row.notes ? (
                                        <p>
                                          <b>ملاحظات:</b> {row.notes}
                                        </p>
                                      ) : null}
                                    </div>

                                    <div className="booking-actions">
                                      <button
                                        type="button"
                                        className="action confirm"
                                        disabled={rowLoading}
                                        onClick={() => updateBookingStatus(row.id, "confirmed")}
                                      >
                                        {rowTarget === "confirmed" ? "جاري القبول..." : "قبول"}
                                      </button>
                                      <button
                                        type="button"
                                        className="action reject"
                                        disabled={rowLoading}
                                        onClick={() => updateBookingStatus(row.id, "cancelled")}
                                      >
                                        {rowTarget === "cancelled" ? "جاري الرفض..." : "رفض"}
                                      </button>
                                    </div>
                                  </article>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      )}
                    </section>
                  </>
                ) : (
                  <section className="settings-grid">
                    <article className="settings-card">
                      <h4>ساعات العمل</h4>
                      <p className="muted">حددي ساعات الصالون لكل يوم.</p>

                      <div className="hours-list">
                        {WEEK_DAYS.map((day) => {
                          const row = hoursDraft[day.index] || {
                            is_closed: false,
                            open_time: "10:00",
                            close_time: "20:00",
                          };

                          return (
                            <div className="day-row" key={day.index}>
                              <div className="day-name">{day.label}</div>
                              <label className="day-toggle">
                                <input
                                  type="checkbox"
                                  checked={row.is_closed}
                                  onChange={(e) =>
                                    setHoursDraft((prev) => ({
                                      ...prev,
                                      [day.index]: { ...row, is_closed: e.target.checked },
                                    }))
                                  }
                                />
                                <span>مغلق</span>
                              </label>

                              <div className="time-grid">
                                <input
                                  type="time"
                                  className="input"
                                  value={row.open_time}
                                  disabled={row.is_closed}
                                  onChange={(e) =>
                                    setHoursDraft((prev) => ({
                                      ...prev,
                                      [day.index]: { ...row, open_time: e.target.value },
                                    }))
                                  }
                                />
                                <input
                                  type="time"
                                  className="input"
                                  value={row.close_time}
                                  disabled={row.is_closed}
                                  onChange={(e) =>
                                    setHoursDraft((prev) => ({
                                      ...prev,
                                      [day.index]: { ...row, close_time: e.target.value },
                                    }))
                                  }
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <button type="button" className="submit-main" disabled={savingHours} onClick={saveHoursSettings}>
                        {savingHours ? "جاري الحفظ..." : "حفظ ساعات العمل"}
                      </button>
                    </article>

                    <article className="settings-card">
                      <h4>إدارة الموظفات</h4>
                      <p className="muted">أضيفي موظفة جديدة أو فعّلي/عطلي أي موظفة.</p>

                      <div className="inline-form">
                        <input
                          className="input"
                          placeholder="اسم الموظفة"
                          value={newStaffName}
                          onChange={(e) => setNewStaffName(e.target.value)}
                        />
                        <button type="button" className="ghost-btn" disabled={savingStaff} onClick={addStaff}>
                          {savingStaff ? "جاري الإضافة..." : "إضافة"}
                        </button>
                      </div>

                      <div className="settings-list">
                        {staffList.length === 0 ? (
                          <div className="empty-box">لا توجد موظفات.</div>
                        ) : (
                          staffList
                            .slice()
                            .sort(sortByOrderThenName)
                            .map((row) => (
                              <div className="settings-row" key={row.id}>
                                <div>
                                  <b>{row.name}</b>
                                  <p className="muted">{row.is_active ? "مفعلة" : "معطلة"}</p>
                                </div>
                                <button
                                  type="button"
                                  className={row.is_active ? "ghost-btn" : "primary-cta"}
                                  onClick={() => toggleStaffActive(row)}
                                >
                                  {row.is_active ? "تعطيل" : "تفعيل"}
                                </button>
                              </div>
                            ))
                        )}
                      </div>
                    </article>

                    <article className="settings-card">
                      <h4>إدارة الخدمات</h4>
                      <p className="muted">أضيفي خدمة جديدة وحددي المدة والسعر.</p>

                      <div className="service-form-grid">
                        <input
                          className="input"
                          placeholder="اسم الخدمة"
                          value={newServiceName}
                          onChange={(e) => setNewServiceName(e.target.value)}
                        />
                        <input
                          className="input"
                          type="number"
                          min="5"
                          step="5"
                          placeholder="المدة (دقيقة)"
                          value={newServiceDuration}
                          onChange={(e) => setNewServiceDuration(e.target.value)}
                        />
                        <input
                          className="input"
                          type="number"
                          min="0"
                          step="1000"
                          placeholder="السعر"
                          value={newServicePrice}
                          onChange={(e) => setNewServicePrice(e.target.value)}
                        />
                        <button type="button" className="ghost-btn" disabled={savingService} onClick={addService}>
                          {savingService ? "جاري الإضافة..." : "إضافة خدمة"}
                        </button>
                      </div>

                      <div className="settings-list">
                        {serviceList.length === 0 ? (
                          <div className="empty-box">لا توجد خدمات.</div>
                        ) : (
                          serviceList
                            .slice()
                            .sort(sortByOrderThenName)
                            .map((row) => (
                              <div className="settings-row" key={row.id}>
                                <div>
                                  <b>{row.name}</b>
                                  <p className="muted">
                                    {row.duration_minutes} دقيقة • {formatCurrencyIQD(row.price)} • {row.is_active ? "مفعلة" : "معطلة"}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  className={row.is_active ? "ghost-btn" : "primary-cta"}
                                  onClick={() => toggleServiceActive(row)}
                                >
                                  {row.is_active ? "تعطيل" : "تفعيل"}
                                </button>
                              </div>
                            ))
                        )}
                      </div>
                    </article>
                  </section>
                )}
              </>
            )}
          </section>
        )}
      </main>

      <div className={`floating-toast ${toast.show ? "show" : ""} ${toast.type}`}>
        {toast.text}
      </div>
    </div>
  );
}

export default App;
