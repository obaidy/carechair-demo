import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PageShell from "../components/PageShell";
import SafeImage from "../components/SafeImage";
import Toast from "../components/Toast";
import { Badge, Button, Card, Skeleton, TextInput } from "../components/ui";
import {
  getDefaultAvatar,
  getInitials,
  getSalonMedia,
  getServiceImage,
} from "../lib/media";
import { supabase } from "../lib/supabase";
import { combineDateTime, generateSlots } from "../lib/slots";
import { formatWhatsappAppointment, sendWhatsappTemplate } from "../lib/whatsapp";
import {
  formatCurrencyIQD,
  formatDateTime,
  formatTime,
  isValidE164WithoutPlus,
  normalizeIraqiPhone,
  SLOT_STEP_MINUTES,
  sortByOrderThenName,
  toDateInput,
} from "../lib/utils";
import { useToast } from "../lib/useToast";

function Step({ index, label, active, done }) {
  return (
    <div className={`step-item${active ? " active" : ""}${done ? " done" : ""}`}>
      <span className="step-index">{done ? "✓" : index}</span>
      <b>{label}</b>
    </div>
  );
}

export default function SalonBookingPage() {
  const { slug } = useParams();
  const { toast, showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [salon, setSalon] = useState(null);
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [staffServices, setStaffServices] = useState([]);
  const [hours, setHours] = useState([]);

  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [dateValue, setDateValue] = useState(() => toDateInput(new Date()));
  const [slotIso, setSlotIso] = useState("");
  const [dayBookings, setDayBookings] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(-1);

  useEffect(() => {
    async function loadPage() {
      if (!supabase) {
        setLoading(false);
        showToast("error", "إعدادات Supabase غير مكتملة.");
        return;
      }

      setLoading(true);
      try {
        const salonRes = await supabase.from("salons").select("*").eq("slug", slug).maybeSingle();

        if (salonRes.error) throw salonRes.error;

        if (!salonRes.data || !salonRes.data.is_active) {
          setSalon(null);
          setLoading(false);
          return;
        }

        const salonRow = salonRes.data;
        setSalon(salonRow);

        const [servicesRes, staffRes, staffServicesRes, hoursRes] = await Promise.all([
          supabase
            .from("services")
            .select("*")
            .eq("salon_id", salonRow.id)
            .eq("is_active", true),
          supabase.from("staff").select("*").eq("salon_id", salonRow.id).eq("is_active", true),
          supabase
            .from("staff_services")
            .select("id, salon_id, staff_id, service_id")
            .eq("salon_id", salonRow.id),
          supabase
            .from("salon_hours")
            .select("day_of_week, open_time, close_time, is_closed")
            .eq("salon_id", salonRow.id),
        ]);

        if (servicesRes.error) throw servicesRes.error;
        if (staffRes.error) throw staffRes.error;
        if (staffServicesRes.error) throw staffServicesRes.error;
        if (hoursRes.error) throw hoursRes.error;

        const serviceRows = (servicesRes.data || []).sort(sortByOrderThenName);
        const staffRows = (staffRes.data || []).sort(sortByOrderThenName);

        setServices(serviceRows);
        setStaff(staffRows);
        setStaffServices(staffServicesRes.data || []);
        setHours(hoursRes.data || []);

        setServiceId(serviceRows[0]?.id || "");
        setStaffId(staffRows[0]?.id || "");
      } catch (err) {
        showToast("error", `تعذر تحميل بيانات الصالون: ${err?.message || err}`);
      } finally {
        setLoading(false);
      }
    }

    loadPage();
  }, [slug, showToast]);

  const servicesById = useMemo(() => Object.fromEntries(services.map((x) => [x.id, x])), [services]);
  const staffById = useMemo(() => Object.fromEntries(staff.map((x) => [x.id, x])), [staff]);
  const assignmentSet = useMemo(
    () => new Set(staffServices.map((x) => `${x.staff_id}:${x.service_id}`)),
    [staffServices]
  );

  const selectedService = servicesById[serviceId] || null;
  const selectedStaff = staffById[staffId] || null;
  const media = useMemo(() => getSalonMedia(salon), [salon]);
  const galleryImages = media.gallery || [];

  const filteredStaff = useMemo(() => {
    if (!serviceId) return staff;
    return staff.filter((row) => assignmentSet.has(`${row.id}:${serviceId}`));
  }, [serviceId, staff, assignmentSet]);

  const filteredServices = useMemo(() => {
    if (!staffId) return services;
    return services.filter((row) => assignmentSet.has(`${staffId}:${row.id}`));
  }, [staffId, services, assignmentSet]);

  useEffect(() => {
    if (serviceId && !filteredServices.some((x) => x.id === serviceId)) {
      setServiceId(filteredServices[0]?.id || "");
    }
  }, [serviceId, filteredServices]);

  useEffect(() => {
    if (staffId && !filteredStaff.some((x) => x.id === staffId)) {
      setStaffId(filteredStaff[0]?.id || "");
    }
  }, [staffId, filteredStaff]);

  const isValidPair = Boolean(serviceId && staffId && assignmentSet.has(`${staffId}:${serviceId}`));

  useEffect(() => {
    setSlotIso("");
  }, [serviceId, staffId, dateValue]);

  useEffect(() => {
    async function loadDayBookings() {
      if (!supabase || !salon?.id || !staffId || !dateValue || !isValidPair) {
        setDayBookings([]);
        return;
      }

      setSlotsLoading(true);
      try {
        const dayStart = combineDateTime(dateValue, "00:00");
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const res = await supabase
          .from("bookings")
          .select("id, appointment_start, appointment_end, status")
          .eq("salon_id", salon.id)
          .eq("staff_id", staffId)
          .in("status", ["pending", "confirmed"])
          .lt("appointment_start", dayEnd.toISOString())
          .gt("appointment_end", dayStart.toISOString())
          .order("appointment_start", { ascending: true });

        if (res.error) throw res.error;
        setDayBookings(res.data || []);
      } catch (err) {
        showToast("error", `تعذر تحميل الأوقات: ${err?.message || err}`);
      } finally {
        setSlotsLoading(false);
      }
    }

    loadDayBookings();
  }, [salon?.id, staffId, dateValue, showToast, isValidPair]);

  const hoursByDay = useMemo(() => {
    const map = {};
    for (const row of hours) map[row.day_of_week] = row;
    return map;
  }, [hours]);

  const availableSlots = useMemo(() => {
    if (!selectedService || !dateValue || !staffId || !isValidPair) return [];

    const dateObj = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(dateObj.getTime())) return [];

    const dayRule = hoursByDay[dateObj.getDay()];
    return generateSlots({
      date: dateValue,
      dayRule,
      durationMinutes: selectedService.duration_minutes,
      bookings: dayBookings,
      nowMs: Date.now(),
    });
  }, [selectedService, dateValue, staffId, isValidPair, hoursByDay, dayBookings]);

  useEffect(() => {
    if (slotIso && !availableSlots.some((s) => s.startIso === slotIso)) {
      setSlotIso("");
    }
  }, [slotIso, availableSlots]);

  const quickDates = useMemo(() => {
    return Array.from({ length: 5 }).map((_, idx) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + idx);
      const value = toDateInput(d);
      return {
        value,
        label: d.toLocaleDateString("ar-IQ", { weekday: "short", month: "short", day: "numeric" }),
      };
    });
  }, []);

  const currentStep = slotIso ? 3 : staffId ? 2 : serviceId ? 1 : 1;

  const summary = {
    service: selectedService?.name || "لم يتم الاختيار",
    staff: selectedStaff?.name || "لم يتم الاختيار",
    price: selectedService ? formatCurrencyIQD(selectedService.price) : "-",
    time: slotIso ? formatDateTime(slotIso) : "اختاري الموعد",
  };

  async function submitBooking(e) {
    e.preventDefault();

    if (!supabase || !salon) {
      showToast("error", "تعذر الاتصال بقاعدة البيانات.");
      return;
    }

    if (customerName.trim().length < 2) {
      showToast("error", "اكتبي الاسم بشكل صحيح.");
      return;
    }

    const normalizedPhone = normalizeIraqiPhone(customerPhone);
    if (!isValidE164WithoutPlus(normalizedPhone)) {
      showToast("error", "اكتبي رقم هاتف صحيح مثل 07xxxxxxxxx.");
      return;
    }

    if (!selectedService || !selectedStaff || !slotIso) {
      showToast("error", "اختاري الخدمة والموظفة والموعد.");
      return;
    }

    if (!assignmentSet.has(`${selectedStaff.id}:${selectedService.id}`)) {
      showToast("error", "هاي الموظفة ما تقدم هالخدمة.");
      return;
    }

    const selectedSlot = availableSlots.find((s) => s.startIso === slotIso);
    if (!selectedSlot) {
      showToast("error", "هذا الموعد لم يعد متاحاً.");
      return;
    }

    setSubmitting(true);
    try {
      const salonWhatsapp = normalizeIraqiPhone(salon.whatsapp || import.meta.env.VITE_WHATSAPP_NUMBER || "");

      const ins = await supabase
        .from("bookings")
        .insert([
          {
            // New schema fields
            salon_id: salon.id,
            service_id: selectedService.id,
            staff_id: selectedStaff.id,
            customer_name: customerName.trim(),
            customer_phone: normalizedPhone,
            notes: notes.trim() || null,
            status: "pending",
            appointment_start: selectedSlot.startIso,
            appointment_end: selectedSlot.endIso,
            // Backward-compat fields for older migrations/schemas
            salon_slug: salon.slug || salon.name || "",
            salon_whatsapp: salonWhatsapp || normalizedPhone,
            service: selectedService.name,
            staff: selectedStaff.name,
            appointment_at: selectedSlot.startIso,
          },
        ])
        .select("id, appointment_start, appointment_at")
        .single();

      if (ins.error) throw ins.error;

      const appointmentLocal = formatWhatsappAppointment(
        ins.data.appointment_start || ins.data.appointment_at || selectedSlot.startIso,
        salon.timezone || "Asia/Baghdad"
      );
      const manualMessage = `مرحبا، اريد أكد حجزي:
الاسم: ${customerName.trim()}
الخدمة: ${selectedService.name}
الموعد: ${appointmentLocal}
رقم الهاتف: ${normalizedPhone}`;
      const manualWhatsappHref = isValidE164WithoutPlus(salonWhatsapp)
        ? `https://wa.me/${salonWhatsapp}?text=${encodeURIComponent(manualMessage)}`
        : "";

      setSuccessData({
        id: ins.data.id,
        service: selectedService.name,
        staff: selectedStaff.name,
        time: ins.data.appointment_start || ins.data.appointment_at || selectedSlot.startIso,
        phone: normalizedPhone,
        whatsappHref: manualWhatsappHref,
      });
      setNotes("");

      let whatsappUnavailable = false;
      if (isValidE164WithoutPlus(salonWhatsapp)) {
        try {
          await sendWhatsappTemplate({
            to: salonWhatsapp,
            template: "booking_created",
            params: [
              customerName.trim(),
              selectedService.name,
              appointmentLocal,
              normalizedPhone,
            ],
          });
        } catch (notifyErr) {
          whatsappUnavailable = true;
          console.error("Failed to send salon booking_created WhatsApp notification:", notifyErr);
        }
      } else {
        whatsappUnavailable = true;
      }

      if (whatsappUnavailable) {
        showToast("success", "تم الحفظ ✅ (إشعار واتساب التلقائي غير مفعل حالياً)");
      } else {
        showToast("success", "تم إرسال طلب الحجز بنجاح.");
      }
    } catch (err) {
      showToast("error", `تعذر إرسال الحجز: ${err?.message || err}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <PageShell title="الحجز" subtitle="جاري تحميل بيانات الصالون">
        <Card>
          <Skeleton className="skeleton-cover" />
          <Skeleton className="skeleton-line" />
          <Skeleton className="skeleton-line short" />
        </Card>
      </PageShell>
    );
  }

  if (!salon) {
    return (
      <PageShell title="الرابط غير متوفر" subtitle="هذا الرابط غير متوفر">
        <Card>
          <p className="muted">هذا الرابط غير متوفر</p>
          <Button as={Link} to="/explore" variant="secondary">
            العودة للاستكشاف
          </Button>
        </Card>
      </PageShell>
    );
  }

  const whatsappPhone = normalizeIraqiPhone(salon.whatsapp || "");
  const hasWhatsapp = isValidE164WithoutPlus(whatsappPhone);

  return (
    <PageShell
      title={salon.name}
      subtitle="احجزي موعدج خلال دقيقة"
      right={
        <Button as={Link} variant="ghost" to={`/s/${salon.slug}/admin`}>
          إدارة الصالون
        </Button>
      }
    >
      <section className="salon-hero" style={{ backgroundImage: `url('${media.cover}')` }}>
        <div className="salon-hero-overlay">
          <div className="salon-hero-content">
            <Badge variant="featured">★ 4.8 (تجريبي)</Badge>
            <h2>{salon.name}</h2>
            <p>{salon.area ? `${salon.area} - بغداد` : "بغداد"}</p>
            <div className="row-actions">
              <Button as="a" href="#booking-form" variant="primary">
                احجزي الآن
              </Button>
              {hasWhatsapp ? (
                <Button as="a" variant="secondary" href={`https://wa.me/${whatsappPhone}`} target="_blank" rel="noreferrer">
                  تواصل واتساب
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <Card>
        <h3 className="section-title">ليش تحجزين من CareChair؟</h3>
        <div className="trust-grid">
          <div className="trust-item">
            <b>تأكيد سريع</b>
            <p>طلبج يوصل فوراً للمركز.</p>
          </div>
          <div className="trust-item">
            <b>تنظيم المواعيد</b>
            <p>أوقات متاحة حقيقية حسب الموظفة.</p>
          </div>
          <div className="trust-item">
            <b>بدون مكالمات</b>
            <p>كلشي يصير أونلاين بخطوات بسيطة.</p>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="section-title">صور من المركز</h3>
        <div className="gallery-grid">
          {galleryImages.map((img, idx) => (
            <button
              type="button"
              key={`${img}-${idx}`}
              className="gallery-lightbox-btn"
              onClick={() => setLightboxIndex(idx)}
            >
              <SafeImage src={img} alt={`صورة ${idx + 1}`} className="gallery-tile" fallbackIcon="🌸" />
            </button>
          ))}
        </div>
      </Card>

      <Card id="booking-form">
        {!successData ? (
          <form onSubmit={submitBooking} className="booking-form-modern">
            <div className="steps-wrap full">
              <Step index={1} label="اختاري الخدمة" active={currentStep === 1} done={Boolean(serviceId)} />
              <Step index={2} label="اختاري الموظفة/الموظف" active={currentStep === 2} done={Boolean(staffId)} />
              <Step index={3} label="اختاري الوقت" active={currentStep === 3} done={Boolean(slotIso)} />
            </div>

            <TextInput className="full" label="الاسم" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />

            <TextInput
              className="full"
              label="رقم الهاتف"
              inputMode="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="07xxxxxxxxx"
            />

            <div className="field full">
              <span>الخدمة</span>
              {services.length === 0 ? (
                <div className="empty-box">لا توجد خدمات مفعلة حالياً.</div>
              ) : (
                <div className="service-grid-compact">
                  {services.map((srv) => {
                    const disabled = !!staffId && !assignmentSet.has(`${staffId}:${srv.id}`);
                    const active = serviceId === srv.id;
                    return (
                      <button
                        type="button"
                        key={srv.id}
                        disabled={disabled}
                        className={`service-mini-card${active ? " active" : ""}${disabled ? " disabled" : ""}`}
                        onClick={() => setServiceId(srv.id)}
                      >
                        <SafeImage
                          src={srv.image_url || getServiceImage(srv.name)}
                          alt={srv.name}
                          className="service-mini-image"
                          fallbackIcon="✨"
                        />
                        <div className="service-mini-meta">
                          <b>{srv.name}</b>
                          <small>{srv.duration_minutes} دقيقة</small>
                          <span>{formatCurrencyIQD(srv.price)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="field full">
              <span>الموظفة/الموظف</span>
              {filteredStaff.length === 0 ? (
                <div className="empty-box">لا يوجد موظف/موظفة مخصص(ة) لهذه الخدمة حالياً.</div>
              ) : (
                <div className="staff-avatar-grid">
                  {filteredStaff.map((st) => {
                    const active = staffId === st.id;
                    return (
                      <button
                        type="button"
                        key={st.id}
                        className={`staff-avatar-card${active ? " active" : ""}`}
                        onClick={() => setStaffId(st.id)}
                      >
                        <SafeImage
                          src={st.photo_url || getDefaultAvatar(st.id || st.name)}
                          alt={st.name}
                          className="staff-avatar-image"
                          fallbackText={getInitials(st.name)}
                        />
                        <b>{st.name}</b>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="field full">
              <span>اختاري اليوم</span>
              <div className="quick-dates-wrap">
                {quickDates.map((day) => (
                  <button
                    type="button"
                    key={day.value}
                    className={`date-pill${dateValue === day.value ? " active" : ""}`}
                    onClick={() => setDateValue(day.value)}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              <input type="date" className="input" value={dateValue} onChange={(e) => setDateValue(e.target.value)} />
            </div>

            <div className="field full">
              <span>المواعيد المتاحة ({SLOT_STEP_MINUTES} دقيقة)</span>
              {!isValidPair && selectedService && selectedStaff ? (
                <div className="empty-box">اختيار الخدمة مع الموظفة غير متوافق.</div>
              ) : slotsLoading ? (
                <div className="slots-wrap">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={`slot-sk-${i}`} className="skeleton-slot" />
                  ))}
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="empty-box">لا توجد مواعيد متاحة لهذا اليوم.</div>
              ) : (
                <div className="slots-wrap">
                  {availableSlots.map((slot) => (
                    <button
                      type="button"
                      key={slot.startIso}
                      className={`slot-pill${slotIso === slot.startIso ? " active" : ""}`}
                      onClick={() => setSlotIso(slot.startIso)}
                    >
                      <b>{formatTime(slot.startIso)}</b>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <label className="field full">
              <span>ملاحظات (اختياري)</span>
              <textarea className="input textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>

            <Card className="summary-card full">
              <h4>ملخص الحجز</h4>
              <p>
                <b>الخدمة:</b> {summary.service}
              </p>
              <p>
                <b>الموظفة/الموظف:</b> {summary.staff}
              </p>
              <p>
                <b>السعر:</b> {summary.price}
              </p>
              <p>
                <b>الموعد:</b> {summary.time}
              </p>
            </Card>

            <Button type="submit" className="full" disabled={submitting || !slotIso || !isValidPair}>
              {submitting ? "جاري الإرسال..." : "تأكيد الحجز"}
            </Button>
          </form>
        ) : (
          <div className="success-screen">
            <div className="success-icon">✓</div>
            <h3>تم إرسال طلب الحجز ✅</h3>
            <p>راح يتم تأكيد الموعد من المركز قريباً</p>
            <div className="success-details">
              <p>
                <b>رقم الطلب:</b> {successData.id}
              </p>
              <p>
                <b>الخدمة:</b> {successData.service}
              </p>
              <p>
                <b>الموظف/الموظفة:</b> {successData.staff}
              </p>
              <p>
                <b>الوقت:</b> {formatDateTime(successData.time)}
              </p>
              <p>
                <b>رقم الهاتف:</b> {successData.phone}
              </p>
            </div>
            <div className="row-actions center">
              {successData.whatsappHref ? (
                <Button
                  as="a"
                  variant="primary"
                  href={successData.whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                >
                  تواصل واتساب مع المركز
                </Button>
              ) : (
                <Button type="button" variant="ghost" disabled>
                  رقم واتساب المركز غير متوفر
                </Button>
              )}
              <Button type="button" variant="secondary" onClick={() => setSuccessData(null)}>
                رجوع للحجز / تعديل موعد
              </Button>
            </div>
          </div>
        )}
      </Card>

      {lightboxIndex >= 0 ? (
        <div className="lightbox-backdrop" role="dialog" aria-modal="true">
          <button type="button" className="lightbox-close" onClick={() => setLightboxIndex(-1)}>
            ×
          </button>
          <button
            type="button"
            className="lightbox-nav prev"
            onClick={() => setLightboxIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length)}
          >
            ‹
          </button>
          <SafeImage
            src={galleryImages[lightboxIndex]}
            alt={`صورة ${lightboxIndex + 1}`}
            className="lightbox-image"
            fallbackIcon="🌸"
          />
          <button
            type="button"
            className="lightbox-nav next"
            onClick={() => setLightboxIndex((prev) => (prev + 1) % galleryImages.length)}
          >
            ›
          </button>
        </div>
      ) : null}

      <Toast {...toast} />
    </PageShell>
  );
}
