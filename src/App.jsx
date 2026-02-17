import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import "./App.css";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_CONFIG_ERROR =
  "لم يتم إعداد Supabase بعد. أضيفي VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في ملف .env.";

function isConfiguredUrl(url) {
  return Boolean(url) && /^https?:\/\//.test(url) && !url.includes("YOUR_SUPABASE_URL");
}

function isConfiguredKey(key) {
  return Boolean(key) && key.length > 20 && !key.includes("YOUR_SUPABASE_ANON_KEY");
}

function createSupabaseFromEnv() {
  if (!isConfiguredUrl(SUPABASE_URL) || !isConfiguredKey(SUPABASE_ANON_KEY)) {
    return null;
  }

  try {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch {
    return null;
  }
}

const supabase = createSupabaseFromEnv();

const SALON_SLUG = import.meta.env.VITE_SALON_SLUG || "bella-beauty-baghdad";
const SALON_NAME = import.meta.env.VITE_SALON_NAME || "بيلا بيوتي بغداد";
const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || "";
const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASS || "1234";

const SERVICES = [
  { value: "Haircut", label: "قص الشعر", minutes: 45 },
  { value: "Hair coloring", label: "صبغ الشعر", minutes: 120 },
  { value: "Blowdry", label: "تسشوار", minutes: 45 },
  { value: "Facial", label: "تنظيف بشرة", minutes: 60 },
  { value: "Manicure", label: "مانيكير", minutes: 45 },
  { value: "Pedicure", label: "باديكير", minutes: 60 },
];

const STAFF = [
  { value: "Sara", label: "سارة" },
  { value: "Noor", label: "نور" },
  { value: "Mariam", label: "مريم" },
];

const STATUS_LABELS = {
  pending: "قيد المراجعة",
  confirmed: "مؤكد",
  cancelled: "ملغي",
};

const SERVICE_LABELS = Object.fromEntries(SERVICES.map((item) => [item.value, item.label]));
const STAFF_LABELS = Object.fromEntries(STAFF.map((item) => [item.value, item.label]));

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

function formatNice(dt) {
  try {
    const d = new Date(dt);
    return d.toLocaleString("ar-IQ", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(dt);
  }
}

function formatSlotDate(dt) {
  return dt.toLocaleDateString("ar-IQ", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatSlotTime(dt) {
  return dt.toLocaleTimeString("ar-IQ", {
    hour: "2-digit",
    minute: "2-digit",
  });
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

const SALON_WHATSAPP = normalizeIraqiPhone(WHATSAPP_NUMBER);

function App() {
  const bookingSectionRef = useRef(null);

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
  const [msg, setMsg] = useState({ type: "", text: "" });

  const [loadingBookings, setLoadingBookings] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [adminFilter, setAdminFilter] = useState("upcoming");
  const [refreshTick, setRefreshTick] = useState(0);
  const [statusUpdating, setStatusUpdating] = useState({});

  const suggestedSlots = useMemo(() => buildSlotsForNextDays(7), []);

  function scrollToBooking() {
    bookingSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function createBooking(e) {
    e.preventDefault();
    setMsg({ type: "", text: "" });

    if (!supabase) {
      setMsg({ type: "error", text: SUPABASE_CONFIG_ERROR });
      return;
    }

    if (customerName.trim().length < 2) {
      setMsg({ type: "error", text: "يرجى كتابة الاسم بشكل صحيح." });
      return;
    }

    if (customerPhone.trim().length < 7) {
      setMsg({ type: "error", text: "يرجى إدخال رقم هاتف صالح." });
      return;
    }

    const normalizedCustomerPhone = normalizeIraqiPhone(customerPhone);
    if (!isValidE164WithoutPlus(normalizedCustomerPhone)) {
      setMsg({
        type: "error",
        text: "يرجى إدخال رقم الهاتف بصيغة صحيحة مثل 07xxxxxxxxx أو 9647xxxxxxxxx.",
      });
      return;
    }

    if (!isValidE164WithoutPlus(SALON_WHATSAPP)) {
      setMsg({
        type: "error",
        text: "رقم واتساب الصالون في الإعدادات غير صالح. عدلي VITE_WHATSAPP_NUMBER أولاً.",
      });
      return;
    }

    const appointmentAt = new Date(slot);
    if (Number.isNaN(appointmentAt.getTime())) {
      setMsg({ type: "error", text: "يرجى اختيار موعد صحيح." });
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase.from("bookings").insert([
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
      ]);

      if (error) throw error;

      setMsg({
        type: "success",
        text: "تم إرسال طلب الحجز بنجاح. وصلكِ التأكيد وسنبلغ الصالون فوراً عبر واتساب.",
      });
      setCustomerPhone(normalizedCustomerPhone);
      setNotes("");
    } catch (err) {
      setMsg({
        type: "error",
        text: `تعذر إرسال الحجز حالياً: ${err?.message || err}`,
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function loadBookings() {
    if (!supabase) {
      setMsg({ type: "error", text: SUPABASE_CONFIG_ERROR });
      return;
    }

    setLoadingBookings(true);

    try {
      let q = supabase
        .from("bookings")
        .select("*")
        .eq("salon_slug", SALON_SLUG)
        .order("appointment_at", { ascending: true });

      if (adminFilter === "upcoming") {
        q = q.gte("appointment_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
      }

      const { data, error } = await q;
      if (error) throw error;
      setBookings(data || []);
    } catch (err) {
      setMsg({
        type: "error",
        text: `تعذر تحميل الحجوزات: ${err?.message || err}`,
      });
    } finally {
      setLoadingBookings(false);
    }
  }

  async function updateStatus(id, status) {
    setMsg({ type: "", text: "" });

    if (!supabase) {
      setMsg({ type: "error", text: SUPABASE_CONFIG_ERROR });
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
      setMsg({
        type: "success",
        text: status === "confirmed" ? "تم تأكيد الحجز وإشعار العميلة عبر واتساب." : "تم إلغاء الحجز وإشعار العميلة عبر واتساب.",
      });
      setRefreshTick((x) => x + 1);
    } catch (err) {
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status: previous.status } : b))
      );
      setMsg({
        type: "error",
        text: `تعذر تحديث حالة الحجز: ${err?.message || err}`,
      });
    } finally {
      setStatusUpdating((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  useEffect(() => {
    if (view === "admin" && adminUnlocked) loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, adminUnlocked, adminFilter, refreshTick]);

  function unlockAdmin(e) {
    e.preventDefault();
    if (adminPassInput === ADMIN_PASS) {
      setAdminUnlocked(true);
      setMsg({ type: "success", text: "تم فتح لوحة الإدارة." });
    } else {
      setMsg({ type: "error", text: "رمز المرور غير صحيح." });
    }
  }

  return (
    <div className="salon-app" dir="rtl">
      <header className="topbar">
        <div className="brand-wrap">
          <span className="brand-chip">نظام حجز الصالون</span>
          <h1 className="brand-title">{SALON_NAME}</h1>
        </div>

        <nav className="view-switch" aria-label="التبديل بين الصفحات">
          <button
            type="button"
            onClick={() => setView("book")}
            className={view === "book" ? "switch-btn active" : "switch-btn"}
          >
            واجهة الحجز
          </button>
          <button
            type="button"
            onClick={() => setView("admin")}
            className={view === "admin" ? "switch-btn active" : "switch-btn"}
          >
            لوحة الإدارة
          </button>
        </nav>
      </header>

      <main className="main-content">
        {view === "book" ? (
          <>
            <section className="hero-card">
              <div>
                <p className="hero-kicker">مرحبا بكِ في {SALON_NAME}</p>
                <h2 className="hero-heading">احجزي موعدك بسهولة خلال دقيقة</h2>
                <p className="hero-text">
                  اختاري الخدمة والوقت المناسب، وفريقنا يؤكد الحجز بسرعة وبكل عناية.
                </p>
                <button type="button" className="cta-btn" onClick={scrollToBooking}>
                  احجزي الآن
                </button>
              </div>

              <div className="photo-card" role="img" aria-label="مكان مخصص لصور الصالون">
                <div className="photo-title">صور الصالون</div>
                <div className="photo-grid">
                  <div className="photo-box">واجهة الصالون</div>
                  <div className="photo-box">ركن العناية</div>
                  <div className="photo-box">محطة المكياج</div>
                  <div className="photo-box">منطقة الاستقبال</div>
                </div>
              </div>
            </section>

            <section className="info-grid">
              <article className="info-card">
                <h3>الخدمات</h3>
                <p>قص، صبغ، عناية بالبشرة، واهتمام كامل بتفاصيلك.</p>
              </article>
              <article className="info-card">
                <h3>عن الصالون</h3>
                <p>صالون نسائي بطابع هادئ، فريق محترف، وجودة عالية في كل جلسة.</p>
              </article>
              <article className="info-card">
                <h3>تواصل معنا</h3>
                <p>للاستفسار السريع يمكنكِ الاتصال أو مراسلتنا عبر واتساب.</p>
              </article>
            </section>

            <section ref={bookingSectionRef} className="panel-card">
              <h3 className="section-title">نموذج الحجز</h3>
              <p className="section-subtitle">املئي البيانات التالية لإرسال طلب الحجز.</p>

              {!supabase ? <div className="alert alert-warning">{SUPABASE_CONFIG_ERROR}</div> : null}

              {msg.text ? (
                <div className={msg.type === "error" ? "alert alert-error" : "alert alert-success"}>
                  {msg.text}
                </div>
              ) : null}

              <form onSubmit={createBooking} className="booking-form">
                <label className="field-group">
                  <span>الاسم</span>
                  <input
                    className="field-input"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="مثال: سارة أحمد"
                  />
                </label>

                <label className="field-group">
                  <span>رقم الهاتف</span>
                  <input
                    className="field-input"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="مثال: 07xxxxxxxxx"
                    inputMode="tel"
                  />
                </label>

                <div className="field-group">
                  <span>اختاري الخدمة</span>
                  <div className="service-grid">
                    {SERVICES.map((item) => {
                      const active = service === item.value;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setService(item.value)}
                          className={active ? "choice-card active" : "choice-card"}
                        >
                          <strong>{item.label}</strong>
                          <small>{item.minutes} دقيقة</small>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="field-group">
                  <span>اختاري الموظفة</span>
                  <div className="staff-grid">
                    {STAFF.map((person) => (
                      <button
                        key={person.value}
                        type="button"
                        onClick={() => setStaff(person.value)}
                        className={staff === person.value ? "staff-chip active" : "staff-chip"}
                      >
                        {person.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="field-group">
                  <span>التاريخ والوقت</span>
                  <input
                    className="field-input"
                    type="datetime-local"
                    value={slot}
                    onChange={(e) => setSlot(e.target.value)}
                  />
                </label>

                <div className="field-group">
                  <span>مواعيد سريعة</span>
                  <div className="slots-grid">
                    {suggestedSlots.slice(0, 18).map((d) => {
                      const val = toLocalInputValue(d);
                      const active = val === slot;

                      return (
                        <button
                          key={d.toISOString()}
                          type="button"
                          onClick={() => setSlot(val)}
                          className={active ? "slot-chip active" : "slot-chip"}
                        >
                          <b>{formatSlotTime(d)}</b>
                          <span>{formatSlotDate(d)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="field-group">
                  <span>ملاحظات إضافية (اختياري)</span>
                  <textarea
                    className="field-input field-textarea"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="مثال: أفضل وقت بعد العصر"
                  />
                </label>

                <button className="submit-btn" disabled={submitting}>
                  {submitting ? "جاري إرسال الطلب..." : "تأكيد طلب الحجز"}
                </button>
              </form>
            </section>
          </>
        ) : (
          <section className="panel-card">
            <h3 className="section-title">لوحة الإدارة</h3>
            <p className="section-subtitle">متابعة الحجوزات وتأكيدها بطريقة سريعة.</p>

            {msg.text ? (
              <div className={msg.type === "error" ? "alert alert-error" : "alert alert-success"}>
                {msg.text}
              </div>
            ) : null}

            {!adminUnlocked ? (
              <form onSubmit={unlockAdmin} className="booking-form">
                <label className="field-group">
                  <span>رمز مرور الإدارة</span>
                  <input
                    className="field-input"
                    value={adminPassInput}
                    onChange={(e) => setAdminPassInput(e.target.value)}
                    placeholder="أدخلي الرمز"
                  />
                </label>
                <button className="submit-btn">دخول لوحة الإدارة</button>
              </form>
            ) : (
              <>
                <div className="admin-toolbar">
                  <label className="field-group">
                    <span>عرض الحجوزات</span>
                    <select
                      className="field-input"
                      value={adminFilter}
                      onChange={(e) => setAdminFilter(e.target.value)}
                    >
                      <option value="upcoming">الحجوزات القادمة</option>
                      <option value="all">كل الحجوزات</option>
                    </select>
                  </label>

                  <button type="button" onClick={() => loadBookings()} className="secondary-btn">
                    {loadingBookings ? "جاري التحديث..." : "تحديث القائمة"}
                  </button>
                </div>

                <div className="bookings-list">
                  {bookings.length === 0 ? (
                    <div className="empty-state">لا توجد حجوزات حالياً.</div>
                  ) : (
                    bookings.map((booking) => {
                      const statusClass = `status-badge status-${booking.status || "pending"}`;
                      const rowLoading = Boolean(statusUpdating[booking.id]);
                      const loadingTarget = statusUpdating[booking.id];
                      return (
                        <article key={booking.id} className="booking-item">
                          <div className="booking-head">
                            <div>
                              <h4>{booking.customer_name}</h4>
                              <p>{booking.customer_phone}</p>
                            </div>
                            <span className={statusClass}>
                              {STATUS_LABELS[booking.status] || "غير معروف"}
                            </span>
                          </div>

                          <div className="booking-meta">
                            <p>
                              <b>الخدمة:</b> {SERVICE_LABELS[booking.service] || booking.service}
                            </p>
                            <p>
                              <b>الموظفة:</b> {STAFF_LABELS[booking.staff] || booking.staff}
                            </p>
                            <p>
                              <b>الموعد:</b> {formatNice(booking.appointment_at)}
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
                              className="action-btn confirm"
                              disabled={rowLoading}
                              onClick={() => updateStatus(booking.id, "confirmed")}
                            >
                              {loadingTarget === "confirmed" ? "جاري التأكيد..." : "تأكيد"}
                            </button>
                            <button
                              type="button"
                              className="action-btn cancel"
                              disabled={rowLoading}
                              onClick={() => updateStatus(booking.id, "cancelled")}
                            >
                              {loadingTarget === "cancelled" ? "جاري الإلغاء..." : "رفض"}
                            </button>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </section>
        )}
      </main>

      <footer className="footer">{SALON_NAME} • حجز مواعيد بسهولة • العراق</footer>
    </div>
  );
}

export default App;
