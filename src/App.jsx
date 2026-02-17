import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import "./App.css";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_CONFIG_ERROR =
  "إعدادات Supabase غير مكتملة. تأكدي من VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY.";

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

const SALON_SLUG = import.meta.env.VITE_SALON_SLUG || "salon-demo";
const SALON_NAME = import.meta.env.VITE_SALON_NAME || "صالون الملكة";
const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || "";
const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASS || "1234";

const SERVICES = [
  { value: "Haircut", label: "قص الشعر", minutes: 45, price: 20000, image: "/images/service-hair.jpg" },
  {
    value: "Hair coloring",
    label: "صبغ الشعر",
    minutes: 120,
    price: 55000,
    image: "/images/service-hair.jpg",
  },
  { value: "Blowdry", label: "تسشوار", minutes: 45, price: 18000, image: "/images/service-hair.jpg" },
  { value: "Facial", label: "تنظيف بشرة", minutes: 60, price: 30000, image: "/images/service-facial.jpg" },
  { value: "Manicure", label: "مانيكير", minutes: 45, price: 15000, image: "/images/service-nails.jpg" },
  { value: "Pedicure", label: "باديكير", minutes: 60, price: 17000, image: "/images/service-nails.jpg" },
];

const STAFF = [
  { value: "Sara", label: "سارة", role: "خبيرة شعر" },
  { value: "Noor", label: "نور", role: "خبيرة عناية" },
  { value: "Mariam", label: "مريم", role: "مكياج وتسريحات" },
];

const GALLERY_IMAGES = [
  { src: "/images/gallery-1.jpg", title: "ستايل شعر ناعم" },
  { src: "/images/gallery-2.jpg", title: "ركن العناية بالبشرة" },
  { src: "/images/gallery-3.jpg", title: "تفاصيل جلسات الأظافر" },
  { src: "/images/gallery-4.jpg", title: "أجواء استقبال راقية" },
];

const STATUS_LABELS = {
  pending: "بانتظار التأكيد",
  confirmed: "مؤكد",
  cancelled: "ملغي",
};

const STATUS_COLORS = {
  pending: "#d9a441",
  confirmed: "#4ea973",
  cancelled: "#cf6679",
};

const SERVICE_BY_VALUE = Object.fromEntries(SERVICES.map((item) => [item.value, item]));
const STAFF_BY_VALUE = Object.fromEntries(STAFF.map((item) => [item.value, item]));

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toLocalInputValue(date) {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
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

function formatTime(value) {
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "--:--";
    return d.toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "--:--";
  }
}

function formatDateKey(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "غير محدد";
  return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
}

function formatDateHeading(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "تاريخ غير معروف";
  return d.toLocaleDateString("ar-IQ", {
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatCurrencyIQD(value) {
  const n = Number(value) || 0;
  return `${n.toLocaleString("en-US")} د.ع`;
}

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

function buildSlotsForNextDays(days = 7) {
  const slots = [];
  const now = new Date();

  for (let day = 0; day < days; day++) {
    const date = new Date(now);
    date.setDate(now.getDate() + day);

    for (let hour = 10; hour <= 20; hour++) {
      for (const minute of [0, 30]) {
        const slot = new Date(date);
        slot.setHours(hour, minute, 0, 0);
        if (slot.getTime() < now.getTime() + 30 * 60 * 1000) continue;
        slots.push(slot);
      }
    }
  }

  return slots;
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes("\n") || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
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

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

function App() {
  const bookingSectionRef = useRef(null);
  const toastTimerRef = useRef(null);

  const [view, setView] = useState("book");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [service, setService] = useState(SERVICES[0].value);
  const [staff, setStaff] = useState(STAFF[0].value);
  const [notes, setNotes] = useState("");
  const [slot, setSlot] = useState(() => {
    const next = new Date();
    next.setHours(next.getHours() + 2);
    next.setMinutes(0, 0, 0);
    return toLocalInputValue(next);
  });

  const [submitting, setSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(null);

  const [loadingBookings, setLoadingBookings] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [adminTab, setAdminTab] = useState("today");
  const [refreshTick, setRefreshTick] = useState(0);
  const [statusUpdating, setStatusUpdating] = useState({});

  const [toast, setToast] = useState({ show: false, type: "success", text: "" });

  const suggestedSlots = useMemo(() => buildSlotsForNextDays(7).slice(0, 24), []);

  const SALON_WHATSAPP = normalizeIraqiPhone(WHATSAPP_NUMBER);
  const hasSalonWhatsApp = isValidE164WithoutPlus(SALON_WHATSAPP);

  const selectedService = SERVICE_BY_VALUE[service];
  const selectedStaff = STAFF_BY_VALUE[staff];

  const bookingSummaryTime = useMemo(() => {
    const d = new Date(slot);
    return Number.isNaN(d.getTime()) ? "اختاري موعداً" : formatDateTime(d.toISOString());
  }, [slot]);

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

  function scrollToBooking() {
    bookingSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function whatsappLink(prefilled) {
    if (!hasSalonWhatsApp) return "";
    if (!prefilled) return `https://wa.me/${SALON_WHATSAPP}`;
    return `https://wa.me/${SALON_WHATSAPP}?text=${encodeURIComponent(prefilled)}`;
  }

  async function createBooking(e) {
    e.preventDefault();

    if (!supabase) {
      showToast("error", SUPABASE_CONFIG_ERROR);
      return;
    }

    if (customerName.trim().length < 2) {
      showToast("error", "يرجى كتابة الاسم بشكل صحيح.");
      return;
    }

    const normalizedCustomerPhone = normalizeIraqiPhone(customerPhone);
    if (!isValidE164WithoutPlus(normalizedCustomerPhone)) {
      showToast("error", "يرجى إدخال رقم الهاتف بصيغة صحيحة مثل 07xxxxxxxxx.");
      return;
    }

    if (!hasSalonWhatsApp) {
      showToast("error", "رقم واتساب الصالون غير مضبوط بشكل صحيح.");
      return;
    }

    const appointmentAt = new Date(slot);
    if (Number.isNaN(appointmentAt.getTime())) {
      showToast("error", "يرجى اختيار موعد صحيح.");
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase
        .from("bookings")
        .insert([
          {
            salon_slug: SALON_SLUG,
            customer_name: customerName.trim(),
            customer_phone: normalizedCustomerPhone,
            salon_whatsapp: SALON_WHATSAPP,
            service,
            staff,
            appointment_at: appointmentAt.toISOString(),
            notes: notes.trim() || null,
            status: "pending",
          },
        ])
        .select("id, service, staff, appointment_at")
        .single();

      if (error) throw error;

      setBookingSuccess({
        id: data?.id,
        service: data?.service || service,
        staff: data?.staff || staff,
        appointment_at: data?.appointment_at || appointmentAt.toISOString(),
      });

      setCustomerPhone(normalizedCustomerPhone);
      setNotes("");
      showToast("success", "تم إرسال طلب الحجز بنجاح.");
      setRefreshTick((x) => x + 1);
    } catch (err) {
      showToast("error", `تعذر إرسال الحجز حالياً: ${err?.message || err}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function loadBookings() {
    if (!supabase) {
      showToast("error", SUPABASE_CONFIG_ERROR);
      return;
    }

    setLoadingBookings(true);

    try {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("salon_slug", SALON_SLUG)
        .order("appointment_at", { ascending: true });

      if (error) throw error;
      setBookings(data || []);
    } catch (err) {
      showToast("error", `تعذر تحميل الحجوزات: ${err?.message || err}`);
    } finally {
      setLoadingBookings(false);
    }
  }

  async function updateStatus(id, status) {
    if (!supabase) {
      showToast("error", SUPABASE_CONFIG_ERROR);
      return;
    }

    if (statusUpdating[id]) return;

    const previous = bookings.find((b) => b.id === id);
    if (!previous) return;

    setStatusUpdating((prev) => ({ ...prev, [id]: status }));
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));

    try {
      const { data, error } = await supabase
        .from("bookings")
        .update({ status })
        .eq("id", id)
        .eq("salon_slug", SALON_SLUG)
        .select("*")
        .single();

      if (error) throw error;

      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, ...data } : b)));
      showToast(
        "success",
        status === "confirmed"
          ? "تم تأكيد الحجز وإشعار العميلة عبر واتساب."
          : "تم رفض الحجز وإشعار العميلة عبر واتساب."
      );
      setRefreshTick((x) => x + 1);
    } catch (err) {
      setBookings((prev) => prev.map((b) => (b.id === id ? previous : b)));
      showToast("error", `تعذر تحديث الحالة: ${err?.message || err}`);
    } finally {
      setStatusUpdating((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  function exportCsv() {
    const headers = [
      "id",
      "customer_name",
      "customer_phone",
      "salon_slug",
      "service",
      "staff",
      "appointment_at",
      "status",
      "notes",
    ];

    const rows = bookings.map((b) => [
      b.id,
      b.customer_name,
      b.customer_phone,
      b.salon_slug,
      SERVICE_BY_VALUE[b.service]?.label || b.service,
      STAFF_BY_VALUE[b.staff]?.label || b.staff,
      b.appointment_at,
      b.status,
      b.notes || "",
    ]);

    const csv = [headers.map(csvEscape).join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join(
      "\n"
    );

    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookings-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showToast("success", "تم تنزيل ملف CSV بنجاح.");
  }

  useEffect(() => {
    if (view === "admin" && adminUnlocked) loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, adminUnlocked, refreshTick]);

  function unlockAdmin(e) {
    e.preventDefault();
    if (adminPassInput === ADMIN_PASS) {
      setAdminUnlocked(true);
      showToast("success", "تم فتح لوحة الإدارة.");
    } else {
      showToast("error", "رمز المرور غير صحيح.");
    }
  }

  const sortedBookings = useMemo(
    () => [...bookings].sort((a, b) => new Date(a.appointment_at).getTime() - new Date(b.appointment_at).getTime()),
    [bookings]
  );

  const now = new Date();
  const todayKey = formatDateKey(now);

  const visibleBookings = useMemo(() => {
    if (adminTab === "all") return sortedBookings;

    if (adminTab === "today") {
      return sortedBookings.filter((b) => formatDateKey(b.appointment_at) === todayKey);
    }

    return sortedBookings.filter((b) => new Date(b.appointment_at).getTime() >= now.getTime());
  }, [adminTab, sortedBookings, todayKey, now]);

  const groupedBookings = useMemo(() => {
    const groups = {};

    for (const booking of visibleBookings) {
      const key = formatDateKey(booking.appointment_at);
      if (!groups[key]) {
        groups[key] = {
          key,
          label: formatDateHeading(booking.appointment_at),
          items: [],
        };
      }
      groups[key].items.push(booking);
    }

    return Object.values(groups).sort((a, b) => a.key.localeCompare(b.key));
  }, [visibleBookings]);

  const kpis = useMemo(() => {
    const totalToday = sortedBookings.filter((b) => formatDateKey(b.appointment_at) === todayKey).length;
    const pending = sortedBookings.filter((b) => b.status === "pending").length;
    const confirmed = sortedBookings.filter((b) => b.status === "confirmed").length;
    const cancelled = sortedBookings.filter((b) => b.status === "cancelled").length;

    return { totalToday, pending, confirmed, cancelled };
  }, [sortedBookings, todayKey]);

  const statusDistribution = useMemo(() => {
    const pending = kpis.pending;
    const confirmed = kpis.confirmed;
    const cancelled = kpis.cancelled;
    const total = pending + confirmed + cancelled;

    if (total === 0) {
      return {
        total,
        ring: "conic-gradient(#ece7e8 0deg 360deg)",
        pending,
        confirmed,
        cancelled,
      };
    }

    const p1 = (pending / total) * 360;
    const p2 = p1 + (confirmed / total) * 360;

    const ring = `conic-gradient(${STATUS_COLORS.pending} 0deg ${p1}deg, ${STATUS_COLORS.confirmed} ${p1}deg ${p2}deg, ${STATUS_COLORS.cancelled} ${p2}deg 360deg)`;

    return { total, ring, pending, confirmed, cancelled };
  }, [kpis]);

  const topServices = useMemo(() => {
    const map = {};
    for (const b of sortedBookings) {
      const key = SERVICE_BY_VALUE[b.service]?.label || b.service || "غير محدد";
      map[key] = (map[key] || 0) + 1;
    }

    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [sortedBookings]);

  const maxServiceCount = topServices[0]?.count || 1;

  return (
    <div className="premium-app" dir="rtl">
      <header className="top-header">
        <div className="brand-side">
          <span className="mini-badge">حجوزات الصالون</span>
          <h1>{SALON_NAME}</h1>
          <p>خدمات عناية وجمال بلمسة أنثوية راقية</p>
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
                <p className="eyebrow">أهلاً بكِ في {SALON_NAME}</p>
                <h2>إطلالة أجمل تبدأ من حجزك السريع</h2>
                <p>
                  احجزي الآن خلال دقيقة، وفريق الصالون يتواصل وياج فوراً لتأكيد الموعد.
                </p>

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
                <p>صور حقيقية لأجواء وخدمات الصالون</p>
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

            <section ref={bookingSectionRef} className="booking-section">
              {!bookingSuccess ? (
                <>
                  <div className="section-head">
                    <h3>نموذج الحجز</h3>
                    <p>اختاري الخدمة والوقت، ونأكد لكِ الحجز خلال وقت قصير.</p>
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
                      <span>اختاري الخدمة</span>
                      <div className="service-grid">
                        {SERVICES.map((item) => {
                          const active = service === item.value;
                          return (
                            <button
                              key={item.value}
                              type="button"
                              className={active ? "service-card active" : "service-card"}
                              onClick={() => setService(item.value)}
                            >
                              <SafeImage
                                src={item.image}
                                alt={item.label}
                                className="service-image"
                                fallbackClassName="service-fallback"
                                fallbackText={item.label}
                              />
                              <strong>{item.label}</strong>
                              <small>{item.minutes} دقيقة</small>
                              <b>{formatCurrencyIQD(item.price)}</b>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="field">
                      <span>اختاري الكوافيرة</span>
                      <div className="staff-chips">
                        {STAFF.map((person) => {
                          const active = staff === person.value;
                          return (
                            <button
                              key={person.value}
                              type="button"
                              className={active ? "staff-chip active" : "staff-chip"}
                              onClick={() => setStaff(person.value)}
                            >
                              <b>{person.label}</b>
                              <small>{person.role}</small>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="field">
                      <span>أقرب المواعيد</span>
                      <div className="slots-wrap">
                        {suggestedSlots.map((d) => {
                          const val = toLocalInputValue(d);
                          const active = slot === val;
                          return (
                            <button
                              key={d.toISOString()}
                              type="button"
                              className={active ? "slot-pill active" : "slot-pill"}
                              onClick={() => setSlot(val)}
                            >
                              <b>{formatTime(d.toISOString())}</b>
                              <small>{formatDateKey(d.toISOString())}</small>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <label className="field">
                      <span>اختيار الوقت يدويًا (اختياري)</span>
                      <input
                        type="datetime-local"
                        value={slot}
                        onChange={(e) => setSlot(e.target.value)}
                        className="input"
                      />
                    </label>

                    <label className="field">
                      <span>ملاحظات إضافية</span>
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
                        <b>الخدمة:</b> {selectedService?.label}
                      </p>
                      <p>
                        <b>المدة:</b> {selectedService?.minutes} دقيقة
                      </p>
                      <p>
                        <b>السعر:</b> {formatCurrencyIQD(selectedService?.price)}
                      </p>
                      <p>
                        <b>الكوافيرة:</b> {selectedStaff?.label}
                      </p>
                      <p>
                        <b>الموعد:</b> {bookingSummaryTime}
                      </p>
                    </div>

                    <button className="submit-main" disabled={submitting}>
                      {submitting ? "جاري إرسال الطلب..." : "تأكيد طلب الحجز"}
                    </button>
                  </form>
                </>
              ) : (
                <div className="success-screen">
                  <div className="success-icon">✓</div>
                  <h3>تم إرسال طلب الحجز</h3>
                  <p>سيتواصل الصالون لتأكيد الموعد خلال وقت قصير.</p>

                  <div className="success-details">
                    <p>
                      <b>رقم الطلب:</b> {bookingSuccess.id || "-"}
                    </p>
                    <p>
                      <b>الخدمة:</b> {SERVICE_BY_VALUE[bookingSuccess.service]?.label || bookingSuccess.service}
                    </p>
                    <p>
                      <b>الكوافيرة:</b> {STAFF_BY_VALUE[bookingSuccess.staff]?.label || bookingSuccess.staff}
                    </p>
                    <p>
                      <b>الموعد:</b> {formatDateTime(bookingSuccess.appointment_at)}
                    </p>
                  </div>

                  <div className="success-actions">
                    {hasSalonWhatsApp ? (
                      <a
                        href={whatsappLink(
                          `مرحباً، أرسلت طلب حجز برقم ${bookingSuccess.id || "-"} وأرغب بالمتابعة.`
                        )}
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
              <p>إدارة الطلبات بسرعة، مع إحصائيات واضحة للعميل.</p>
            </div>

            {!adminUnlocked ? (
              <form onSubmit={unlockAdmin} className="admin-lock">
                <label className="field">
                  <span>رمز دخول الإدارة</span>
                  <input
                    className="input"
                    value={adminPassInput}
                    onChange={(e) => setAdminPassInput(e.target.value)}
                    placeholder="أدخلي الرمز"
                  />
                </label>
                <button className="submit-main">دخول اللوحة</button>
              </form>
            ) : (
              <>
                <div className="kpi-grid">
                  <article className="kpi-card">
                    <span>طلبات اليوم</span>
                    <strong>{kpis.totalToday}</strong>
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
                      className={adminTab === "today" ? "tab-btn active" : "tab-btn"}
                      onClick={() => setAdminTab("today")}
                    >
                      اليوم
                    </button>
                    <button
                      type="button"
                      className={adminTab === "upcoming" ? "tab-btn active" : "tab-btn"}
                      onClick={() => setAdminTab("upcoming")}
                    >
                      القادمة
                    </button>
                    <button
                      type="button"
                      className={adminTab === "all" ? "tab-btn active" : "tab-btn"}
                      onClick={() => setAdminTab("all")}
                    >
                      الكل
                    </button>
                  </div>

                  <div className="toolbar-actions">
                    <button type="button" className="ghost-btn" onClick={loadBookings}>
                      {loadingBookings ? "جاري التحديث..." : "تحديث"}
                    </button>
                    <button type="button" className="ghost-btn" onClick={exportCsv}>
                      تصدير CSV
                    </button>
                  </div>
                </div>

                <section className="analytics-grid">
                  <article className="analytics-card">
                    <h4>توزيع حالات الحجوزات</h4>
                    <div className="ring-wrap">
                      <div className="status-ring" style={{ background: statusDistribution.ring }}>
                        <div className="ring-center">{statusDistribution.total}</div>
                      </div>
                      <div className="ring-legend">
                        <p>
                          <span style={{ background: STATUS_COLORS.pending }} /> بانتظار التأكيد ({statusDistribution.pending})
                        </p>
                        <p>
                          <span style={{ background: STATUS_COLORS.confirmed }} /> مؤكد ({statusDistribution.confirmed})
                        </p>
                        <p>
                          <span style={{ background: STATUS_COLORS.cancelled }} /> ملغي ({statusDistribution.cancelled})
                        </p>
                      </div>
                    </div>
                  </article>

                  <article className="analytics-card">
                    <h4>الخدمات الأكثر طلباً</h4>
                    {topServices.length === 0 ? (
                      <p className="muted">لا توجد بيانات كافية.</p>
                    ) : (
                      <div className="bars">
                        {topServices.map((item) => (
                          <div key={item.name} className="bar-row">
                            <div className="bar-head">
                              <span>{item.name}</span>
                              <b>{item.count}</b>
                            </div>
                            <div className="bar-track">
                              <div
                                className="bar-fill"
                                style={{ width: `${Math.max(8, (item.count / maxServiceCount) * 100)}%` }}
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
                      <div key={group.key} className="date-group">
                        <div className="date-header">
                          <h5>{group.label}</h5>
                          <span>{group.items.length} حجز</span>
                        </div>

                        <div className="bookings-stack">
                          {group.items.map((booking) => {
                            const rowLoading = Boolean(statusUpdating[booking.id]);
                            const loadingTarget = statusUpdating[booking.id];
                            return (
                              <article key={booking.id} className="booking-card">
                                <div className="booking-top">
                                  <div>
                                    <h6>{booking.customer_name}</h6>
                                    <p>{booking.customer_phone}</p>
                                  </div>
                                  <span className={`status-badge status-${booking.status || "pending"}`}>
                                    {STATUS_LABELS[booking.status] || "غير معروف"}
                                  </span>
                                </div>

                                <div className="booking-info">
                                  <p>
                                    <b>الخدمة:</b> {SERVICE_BY_VALUE[booking.service]?.label || booking.service}
                                  </p>
                                  <p>
                                    <b>الكوافيرة:</b> {STAFF_BY_VALUE[booking.staff]?.label || booking.staff}
                                  </p>
                                  <p>
                                    <b>الوقت:</b> {formatTime(booking.appointment_at)}
                                  </p>
                                  <p>
                                    <b>التاريخ:</b> {formatDateKey(booking.appointment_at)}
                                  </p>
                                  {booking.notes ? (
                                    <p>
                                      <b>ملاحظات:</b> {booking.notes}
                                    </p>
                                  ) : null}
                                </div>

                                <div className="booking-actions">
                                  <button
                                    type="button"
                                    className="action confirm"
                                    disabled={rowLoading}
                                    onClick={() => updateStatus(booking.id, "confirmed")}
                                  >
                                    {loadingTarget === "confirmed" ? "جاري التأكيد..." : "قبول"}
                                  </button>
                                  <button
                                    type="button"
                                    className="action reject"
                                    disabled={rowLoading}
                                    onClick={() => updateStatus(booking.id, "cancelled")}
                                  >
                                    {loadingTarget === "cancelled" ? "جاري الرفض..." : "رفض"}
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
