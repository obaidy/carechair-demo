import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PageShell from "../components/PageShell";
import SafeImage from "../components/SafeImage";
import Toast from "../components/Toast";
import { Button, Card, Skeleton, TextInput } from "../components/ui";
import {
  getDefaultAvatar,
  getInitials,
  getSalonMedia,
  getServiceImage,
} from "../lib/media";
import { supabase } from "../lib/supabase";
import { combineDateTime, generateSlots } from "../lib/slots";
import { formatWhatsappAppointment, sendWhatsappTemplate } from "../lib/whatsapp";
import { deriveSalonAccess } from "../lib/billing";
import {
  formatSalonOperationalCurrency,
  formatDateTime,
  formatTime,
  isValidE164WithoutPlus,
  normalizeIraqiPhone,
  SLOT_STEP_MINUTES,
  sortByOrderThenName,
  toDateInput,
} from "../lib/utils";
import { useToast } from "../lib/useToast";

function toMinutesOfDay(value) {
  const [h, m] = String(value || "00:00")
    .slice(0, 5)
    .split(":")
    .map((x) => Number(x || 0));
  return h * 60 + m;
}

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
  const { t, i18n } = useTranslation();
  const { toast, showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [salon, setSalon] = useState(null);
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [staffServices, setStaffServices] = useState([]);
  const [hours, setHours] = useState([]);
  const [employeeHours, setEmployeeHours] = useState([]);

  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [dateValue, setDateValue] = useState(() => toDateInput(new Date()));
  const [slotIso, setSlotIso] = useState("");
  const [dayBookings, setDayBookings] = useState([]);
  const [dayTimeOff, setDayTimeOff] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [timeOffLoading, setTimeOffLoading] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const bookingFormRef = useRef(null);

  useEffect(() => {
    async function loadPage() {
      if (!supabase) {
        setLoading(false);
        showToast("error", t("errors.supabaseConfigMissing"));
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

        const [servicesRes, staffRes, staffServicesRes, hoursRes, employeeHoursRes] = await Promise.all([
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
          supabase
            .from("employee_hours")
            .select("staff_id, day_of_week, start_time, end_time, is_off, break_start, break_end")
            .eq("salon_id", salonRow.id),
        ]);

        if (servicesRes.error) throw servicesRes.error;
        if (staffRes.error) throw staffRes.error;
        if (staffServicesRes.error) throw staffServicesRes.error;
        if (hoursRes.error) throw hoursRes.error;
        if (employeeHoursRes.error) throw employeeHoursRes.error;

        const serviceRows = (servicesRes.data || []).sort(sortByOrderThenName);
        const staffRows = (staffRes.data || []).sort(sortByOrderThenName);

        setServices(serviceRows);
        setStaff(staffRows);
        setStaffServices(staffServicesRes.data || []);
        setHours(hoursRes.data || []);
        setEmployeeHours(employeeHoursRes.data || []);

        setServiceId(serviceRows[0]?.id || "");
        setStaffId(staffRows[0]?.id || "");
      } catch (err) {
        showToast("error", t("booking.errors.loadSalonFailed", { message: err?.message || err }));
      } finally {
        setLoading(false);
      }
    }

    loadPage();
  }, [slug, showToast, t]);

  const servicesById = useMemo(() => Object.fromEntries(services.map((x) => [x.id, x])), [services]);
  const staffById = useMemo(() => Object.fromEntries(staff.map((x) => [x.id, x])), [staff]);
  const assignmentSet = useMemo(
    () => new Set(staffServices.map((x) => `${x.staff_id}:${x.service_id}`)),
    [staffServices]
  );

  const bookingMode = salon?.booking_mode === "auto_assign" ? "auto_assign" : "choose_employee";
  const selectedService = servicesById[serviceId] || null;
  const selectedStaff = staffById[staffId] || null;
  const media = useMemo(() => getSalonMedia(salon), [salon]);
  const galleryImages = media.gallery || [];
  const salonAccess = useMemo(() => deriveSalonAccess(salon), [salon]);

  const filteredStaff = useMemo(() => {
    if (!serviceId) return staff;
    return staff.filter((row) => assignmentSet.has(`${row.id}:${serviceId}`));
  }, [serviceId, staff, assignmentSet]);

  const filteredServices = useMemo(() => {
    if (bookingMode === "auto_assign") return services;
    if (!staffId) return services;
    return services.filter((row) => assignmentSet.has(`${staffId}:${row.id}`));
  }, [bookingMode, staffId, services, assignmentSet]);

  useEffect(() => {
    if (serviceId && !filteredServices.some((x) => x.id === serviceId)) {
      setServiceId(filteredServices[0]?.id || "");
    }
  }, [serviceId, filteredServices]);

  useEffect(() => {
    if (bookingMode === "auto_assign") return;
    if (staffId && !filteredStaff.some((x) => x.id === staffId)) {
      setStaffId(filteredStaff[0]?.id || "");
    }
  }, [bookingMode, staffId, filteredStaff]);

  const eligibleStaffIds = useMemo(() => filteredStaff.map((x) => x.id), [filteredStaff]);
  const isValidPair =
    bookingMode === "auto_assign"
      ? Boolean(serviceId && eligibleStaffIds.length > 0)
      : Boolean(serviceId && staffId && assignmentSet.has(`${staffId}:${serviceId}`));

  useEffect(() => {
    setSlotIso("");
  }, [serviceId, staffId, dateValue, bookingMode]);

  useEffect(() => {
    async function loadDayBookings() {
      if (!supabase || !salon?.id || !dateValue || !isValidPair || !salonAccess.canCreateBookings) {
        setDayBookings([]);
        return;
      }

      const targetStaffIds = bookingMode === "auto_assign" ? eligibleStaffIds : [staffId].filter(Boolean);
      if (targetStaffIds.length === 0) {
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
          .select("id, staff_id, appointment_start, appointment_end, status")
          .eq("salon_id", salon.id)
          .in("staff_id", targetStaffIds)
          .in("status", ["pending", "confirmed"])
          .lt("appointment_start", dayEnd.toISOString())
          .gt("appointment_end", dayStart.toISOString())
          .order("appointment_start", { ascending: true });

        if (res.error) throw res.error;
        setDayBookings(res.data || []);
      } catch (err) {
        showToast("error", t("booking.errors.loadSlotsFailed", { message: err?.message || err }));
      } finally {
        setSlotsLoading(false);
      }
    }

    loadDayBookings();
  }, [salon?.id, staffId, eligibleStaffIds, dateValue, showToast, isValidPair, bookingMode, salonAccess.canCreateBookings, t]);

  useEffect(() => {
    async function loadDayTimeOff() {
      if (!supabase || !salon?.id || !dateValue || !isValidPair || !salonAccess.canCreateBookings) {
        setDayTimeOff([]);
        setTimeOffLoading(false);
        return;
      }
      const targetStaffIds = bookingMode === "auto_assign" ? eligibleStaffIds : [staffId].filter(Boolean);
      if (targetStaffIds.length === 0) {
        setDayTimeOff([]);
        setTimeOffLoading(false);
        return;
      }

      setTimeOffLoading(true);
      try {
        const dayStart = combineDateTime(dateValue, "00:00");
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const res = await supabase
          .from("employee_time_off")
          .select("id, staff_id, start_at, end_at")
          .eq("salon_id", salon.id)
          .in("staff_id", targetStaffIds)
          .lt("start_at", dayEnd.toISOString())
          .gt("end_at", dayStart.toISOString())
          .order("start_at", { ascending: true });
        if (res.error) throw res.error;
        setDayTimeOff(res.data || []);
      } catch (err) {
        showToast("error", t("booking.errors.loadTimeOffFailed", { message: err?.message || err }));
      } finally {
        setTimeOffLoading(false);
      }
    }

    loadDayTimeOff();
  }, [salon?.id, staffId, eligibleStaffIds, dateValue, showToast, isValidPair, bookingMode, salonAccess.canCreateBookings, t]);

  const hoursByDay = useMemo(() => {
    const map = {};
    for (const row of hours) map[row.day_of_week] = row;
    return map;
  }, [hours]);

  const employeeHoursByStaffDay = useMemo(() => {
    const map = {};
    for (const row of employeeHours) {
      const key = `${row.staff_id}:${row.day_of_week}`;
      const prev = map[key];
      if (!prev) {
        map[key] = row;
        continue;
      }
      if (prev.is_off || row.is_off) {
        map[key] = { ...prev, ...row, is_off: true };
        continue;
      }
      map[key] = prev;
    }
    return map;
  }, [employeeHours]);

  const availableSlots = useMemo(() => {
    if (!selectedService || !dateValue || !isValidPair || !salonAccess.canCreateBookings) return [];

    const dateObj = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(dateObj.getTime())) return [];

    const dayRule = hoursByDay[dateObj.getDay()];
    const dayIndex = dateObj.getDay();
    const nowMs = Date.now();

    if (bookingMode === "auto_assign") {
      const byStart = new Map();
      for (const st of filteredStaff) {
        const staffBookings = dayBookings.filter((b) => b.staff_id === st.id);
        const staffTimeOff = dayTimeOff.filter((x) => x.staff_id === st.id);
        const employeeRule = employeeHoursByStaffDay[`${st.id}:${dayIndex}`];
        const generated = generateSlots({
          date: dateValue,
          dayRule,
          employeeRule,
          durationMinutes: selectedService.duration_minutes,
          bookings: staffBookings,
          timeOff: staffTimeOff,
          nowMs,
        });
        for (const slot of generated) {
          if (!byStart.has(slot.startIso)) {
            byStart.set(slot.startIso, { ...slot, staffId: st.id });
          }
        }
      }
      return Array.from(byStart.values()).sort((a, b) => a.startIso.localeCompare(b.startIso));
    }

    const employeeRule = employeeHoursByStaffDay[`${staffId}:${dayIndex}`];
    return generateSlots({
      date: dateValue,
      dayRule,
      employeeRule,
      durationMinutes: selectedService.duration_minutes,
      bookings: dayBookings.filter((b) => b.staff_id === staffId),
      timeOff: dayTimeOff.filter((x) => x.staff_id === staffId),
      nowMs,
    }).map((slot) => ({ ...slot, staffId }));
  }, [
    selectedService,
    dateValue,
    staffId,
    isValidPair,
    bookingMode,
    filteredStaff,
    hoursByDay,
    employeeHoursByStaffDay,
    dayBookings,
    dayTimeOff,
    salonAccess.canCreateBookings,
  ]);

  const availabilityLoading = slotsLoading || timeOffLoading;

  useEffect(() => {
    if (slotIso && !availableSlots.some((s) => s.startIso === slotIso)) {
      setSlotIso("");
    }
  }, [slotIso, availableSlots]);

  useEffect(() => {
    if (!successData) return;
    if (bookingFormRef.current?.scrollIntoView) {
      bookingFormRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [successData]);

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

  const currentStep =
    bookingMode === "auto_assign"
      ? slotIso
        ? 3
        : serviceId
          ? 2
          : 1
      : slotIso
        ? 3
        : staffId
          ? 2
          : serviceId
            ? 1
            : 1;

  const summary = {
    service: selectedService?.name || t("booking.notSelected"),
    staff:
      bookingMode === "auto_assign"
        ? t("booking.autoAssignByAvailability")
        : selectedStaff?.name || t("booking.notSelected"),
    price: selectedService ? formatSalonOperationalCurrency(selectedService.price, salon, i18n.language) : "-",
    time: slotIso ? formatDateTime(slotIso) : t("booking.pickTime"),
  };

  function resetBookingFlow() {
    setSuccessData(null);
    if (bookingFormRef.current?.scrollIntoView) {
      bookingFormRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function verifySlotStillAvailable({ targetStaffId, selectedSlot }) {
    if (!supabase || !salon?.id || !targetStaffId || !selectedSlot || !selectedService || !dateValue) {
      return { ok: false, reason: t("booking.errors.slotVerifyFailed") };
    }

    const dayDate = new Date(`${dateValue}T00:00:00`);
    const dayIndex = dayDate.getDay();
    const dayRule = hoursByDay[dayIndex];
    if (!dayRule || dayRule.is_closed) {
      return { ok: false, reason: t("booking.errors.salonClosedDay") };
    }

    const slotStart = new Date(selectedSlot.startIso);
    const slotEnd = new Date(selectedSlot.endIso);
    if (Number.isNaN(slotStart.getTime()) || Number.isNaN(slotEnd.getTime()) || slotEnd <= slotStart) {
      return { ok: false, reason: t("booking.errors.invalidAppointmentTime") };
    }

    const slotStartMin = slotStart.getHours() * 60 + slotStart.getMinutes();
    const slotEndMin = slotEnd.getHours() * 60 + slotEnd.getMinutes();
    const salonOpen = toMinutesOfDay(dayRule.open_time);
    const salonClose = toMinutesOfDay(dayRule.close_time);
    if (slotStartMin < salonOpen || slotEndMin > salonClose) {
      return { ok: false, reason: t("booking.errors.outsideSalonHours") };
    }

    const [employeeHoursRes, bookingsRes, timeOffRes] = await Promise.all([
      supabase
        .from("employee_hours")
        .select("staff_id, day_of_week, start_time, end_time, is_off, break_start, break_end")
        .eq("salon_id", salon.id)
        .eq("staff_id", targetStaffId)
        .eq("day_of_week", dayIndex),
      supabase
        .from("bookings")
        .select("id")
        .eq("salon_id", salon.id)
        .eq("staff_id", targetStaffId)
        .in("status", ["pending", "confirmed"])
        .lt("appointment_start", selectedSlot.endIso)
        .gt("appointment_end", selectedSlot.startIso)
        .limit(1),
      supabase
        .from("employee_time_off")
        .select("id")
        .eq("salon_id", salon.id)
        .eq("staff_id", targetStaffId)
        .lt("start_at", selectedSlot.endIso)
        .gt("end_at", selectedSlot.startIso)
        .limit(1),
    ]);

    if (employeeHoursRes.error) throw employeeHoursRes.error;
    if (bookingsRes.error) throw bookingsRes.error;
    if (timeOffRes.error) throw timeOffRes.error;

    const staffDayRules = employeeHoursRes.data || [];
    if (staffDayRules.some((row) => Boolean(row.is_off))) {
      return { ok: false, reason: t("booking.errors.staffOffThisDay") };
    }

    const effectiveRule = staffDayRules[0];
    if (effectiveRule) {
      const empStart = toMinutesOfDay(effectiveRule.start_time || dayRule.open_time);
      const empEnd = toMinutesOfDay(effectiveRule.end_time || dayRule.close_time);
      if (slotStartMin < empStart || slotEndMin > empEnd) {
        return { ok: false, reason: t("booking.errors.outsideStaffHours") };
      }

      const breakStart = effectiveRule.break_start ? toMinutesOfDay(effectiveRule.break_start) : null;
      const breakEnd = effectiveRule.break_end ? toMinutesOfDay(effectiveRule.break_end) : null;
      if (
        Number.isFinite(breakStart) &&
        Number.isFinite(breakEnd) &&
        breakEnd > breakStart &&
        slotStartMin < breakEnd &&
        slotEndMin > breakStart
      ) {
        return { ok: false, reason: t("booking.errors.insideBreakTime") };
      }
    }

    if ((timeOffRes.data || []).length > 0) {
      return { ok: false, reason: t("booking.errors.staffOffThisTime") };
    }

    if ((bookingsRes.data || []).length > 0) {
      return { ok: false, reason: t("booking.errors.slotJustBooked") };
    }

    return { ok: true };
  }

  async function submitBooking(e) {
    e.preventDefault();

    if (!supabase || !salon) {
      showToast("error", t("booking.errors.dbConnectionFailed"));
      return;
    }

    if (customerName.trim().length < 2) {
      showToast("error", t("booking.errors.invalidName"));
      return;
    }

    const normalizedPhone = normalizeIraqiPhone(customerPhone);
    if (!isValidE164WithoutPlus(normalizedPhone)) {
      showToast("error", t("booking.errors.invalidPhone"));
      return;
    }

    if (!selectedService || !slotIso) {
      showToast("error", t("booking.errors.selectServiceAndTime"));
      return;
    }

    if (!salonAccess.canCreateBookings) {
      showToast("error", salonAccess.lockMessage || t("booking.errors.bookingUnavailable"));
      return;
    }

    if (bookingMode === "choose_employee" && !selectedStaff) {
      showToast("error", t("booking.errors.selectStaff"));
      return;
    }

    if (bookingMode === "choose_employee" && !assignmentSet.has(`${selectedStaff.id}:${selectedService.id}`)) {
      showToast("error", t("booking.errors.staffServiceMismatch"));
      return;
    }

    const selectedSlot = availableSlots.find((s) => s.startIso === slotIso);
    if (!selectedSlot) {
      showToast("error", t("booking.errors.slotNoLongerAvailable"));
      return;
    }

    const assignedStaff = staffById[selectedSlot.staffId] || selectedStaff || null;
    if (!assignedStaff) {
      showToast("error", t("booking.errors.staffAssignFailed"));
      return;
    }

    setSubmitting(true);
    try {
      const availabilityCheck = await verifySlotStillAvailable({
        targetStaffId: assignedStaff.id,
        selectedSlot,
      });
      if (!availabilityCheck.ok) {
        showToast("error", availabilityCheck.reason || t("booking.errors.slotNoLongerAvailable"));
        return;
      }

      const salonWhatsapp = normalizeIraqiPhone(salon.whatsapp || import.meta.env.VITE_WHATSAPP_NUMBER || "");
      let clientId = null;

      const clientRes = await supabase
        .from("clients")
        .upsert(
          [
            {
              salon_id: salon.id,
              phone: normalizedPhone,
              name: customerName.trim(),
            },
          ],
          { onConflict: "salon_id,phone" }
        )
        .select("id")
        .single();
      if (clientRes.error) throw clientRes.error;
      clientId = clientRes.data?.id || null;

      const ins = await supabase
        .from("bookings")
        .insert([
          {
            // New schema fields
            salon_id: salon.id,
            service_id: selectedService.id,
            staff_id: assignedStaff.id,
            client_id: clientId,
            customer_name: customerName.trim(),
            customer_phone: normalizedPhone,
            notes: notes.trim() || null,
            status: "pending",
            appointment_start: selectedSlot.startIso,
            appointment_end: selectedSlot.endIso,
            price_amount: Number(selectedService.price || 0),
            currency: "IQD",
            // Backward-compat fields for older migrations/schemas
            salon_slug: salon.slug || salon.name || "",
            salon_whatsapp: salonWhatsapp || normalizedPhone,
            service: selectedService.name,
            staff: assignedStaff.name,
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
      const manualMessage = `${t("booking.whatsappFallback.greeting")}
${t("booking.whatsappFallback.name")}: ${customerName.trim()}
${t("booking.whatsappFallback.service")}: ${selectedService.name}
${t("booking.whatsappFallback.time")}: ${appointmentLocal}
${t("booking.whatsappFallback.phone")}: ${normalizedPhone}`;
      const manualWhatsappHref = isValidE164WithoutPlus(salonWhatsapp)
        ? `https://wa.me/${salonWhatsapp}?text=${encodeURIComponent(manualMessage)}`
        : "";

      setSuccessData({
        id: ins.data.id,
        service: selectedService.name,
        staff: assignedStaff.name,
        time: ins.data.appointment_start || ins.data.appointment_at || selectedSlot.startIso,
        phone: normalizedPhone,
        whatsappHref: manualWhatsappHref,
      });
      if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
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
        showToast("success", t("booking.messages.savedWhatsappOff"));
      } else {
        showToast("success", t("booking.messages.sentSuccess"));
      }
    } catch (err) {
      showToast("error", t("booking.errors.sendFailed", { message: err?.message || err }));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <PageShell title={t("booking.pageTitle")} subtitle={t("booking.loadingSalonData")}>
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
      <PageShell title={t("booking.linkUnavailableTitle")} subtitle={t("booking.linkUnavailableText")}>
        <Card>
          <p className="muted">{t("booking.linkUnavailableText")}</p>
          <Button as={Link} to="/explore" variant="secondary">
            {t("booking.backToExplore")}
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
      subtitle={t("booking.subtitle")}
      mobileMenuContent={({ closeMenu }) => (
        <div className="platform-mobile-drawer-links">
          <Link className="platform-mobile-link" to="/explore" onClick={closeMenu}>
            {t("common.explore")}
          </Link>
          <Link className="platform-mobile-link" to="/pricing" onClick={closeMenu}>
            {t("nav.pricing")}
          </Link>
          <Link className="platform-mobile-link" to={`/s/${salon.slug}/admin`} onClick={closeMenu}>
            {t("booking.salonAdmin")}
          </Link>
          {hasWhatsapp ? (
            <a
              className="platform-mobile-link"
              href={`https://wa.me/${whatsappPhone}`}
              target="_blank"
              rel="noreferrer"
              onClick={closeMenu}
            >
              {t("booking.contactWhatsapp")}
            </a>
          ) : null}
        </div>
      )}
      right={
        <Button as={Link} variant="ghost" to={`/s/${salon.slug}/admin`}>
          {t("booking.salonAdmin")}
        </Button>
      }
    >
      <section className="salon-hero" style={{ backgroundImage: `url('${media.cover}')` }}>
        <div className="salon-hero-overlay">
          <div className="salon-hero-content">
            <div className="salon-hero-brand">
              <SafeImage
                src={salon.logo_url || ""}
                alt={`${t("booking.salonLogo")} ${salon.name}`}
                className="salon-hero-logo"
                fallbackText={getInitials(salon.name)}
              />
              <div>
                <h2>{salon.name}</h2>
                <p>{salon.area ? `${salon.area}` : t("booking.defaultCity")}</p>
              </div>
            </div>
            <div className="row-actions">
              <Button as="a" href="#booking-form" variant="primary">
                {t("booking.bookNow")}
              </Button>
              {hasWhatsapp ? (
                <Button as="a" variant="secondary" href={`https://wa.me/${whatsappPhone}`} target="_blank" rel="noreferrer">
                  {t("booking.contactWhatsapp")}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <Card>
        <h3 className="section-title">{t("booking.whyTitle")}</h3>
        <div className="trust-grid">
          <div className="trust-item">
            <b>{t("booking.trust.fastConfirm.title")}</b>
            <p>{t("booking.trust.fastConfirm.text")}</p>
          </div>
          <div className="trust-item">
            <b>{t("booking.trust.scheduling.title")}</b>
            <p>{t("booking.trust.scheduling.text")}</p>
          </div>
          <div className="trust-item">
            <b>{t("booking.trust.noCalls.title")}</b>
            <p>{t("booking.trust.noCalls.text")}</p>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="section-title">{t("booking.galleryTitle")}</h3>
        <div className="gallery-grid">
          {galleryImages.map((img, idx) => (
            <button
              type="button"
              key={`${img}-${idx}`}
              className="gallery-lightbox-btn"
              onClick={() => setLightboxIndex(idx)}
            >
              <SafeImage src={img} alt={`${t("booking.image")} ${idx + 1}`} className="gallery-tile" fallbackIcon="🌸" />
            </button>
          ))}
        </div>
      </Card>

      <div id="booking-form" ref={bookingFormRef}>
      <Card>
        {!successData ? (
          <form onSubmit={submitBooking} className="booking-form-modern">
            {!salonAccess.canCreateBookings ? (
              <div className="full lock-banner">
                <b>{t("booking.accountInactive")}</b>
                <p>{salonAccess.lockMessage || t("booking.errors.bookingUnavailable")}</p>
              </div>
            ) : null}
            <div className="steps-wrap full">
              <Step index={1} label={t("booking.stepService")} active={currentStep === 1} done={Boolean(serviceId)} />
              <Step
                index={2}
                label={bookingMode === "auto_assign" ? t("booking.stepAutoAssign") : t("booking.stepStaff")}
                active={currentStep === 2}
                done={bookingMode === "auto_assign" ? Boolean(serviceId) : Boolean(staffId)}
              />
              <Step index={3} label={t("booking.stepTime")} active={currentStep === 3} done={Boolean(slotIso)} />
            </div>

            <TextInput className="full" label={t("booking.name")} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />

            <TextInput
              className="full"
              label={t("booking.phone")}
              inputMode="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="07xxxxxxxxx"
            />

            <div className="field full">
              <span>{t("booking.service")}</span>
              {services.length === 0 ? (
                <div className="empty-box">{t("booking.noActiveServices")}</div>
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
                          <small>{t("booking.minutes", { count: srv.duration_minutes })}</small>
                          <span>{formatSalonOperationalCurrency(srv.price, salon, i18n.language)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {bookingMode === "choose_employee" ? (
              <div className="field full">
                <span>{t("booking.staff")}</span>
                {filteredStaff.length === 0 ? (
                  <div className="empty-box">{t("booking.noAssignedStaffForService")}</div>
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
            ) : (
              <div className="field full">
                <span>{t("booking.staffAssignment")}</span>
                <div className="empty-box">{t("booking.autoAssignNote")}</div>
              </div>
            )}

            <div className="field full">
              <span>{t("booking.pickDay")}</span>
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
              <span>{t("booking.availableSlots", { step: SLOT_STEP_MINUTES })}</span>
              {!salonAccess.canCreateBookings ? (
                <div className="empty-box">{salonAccess.lockMessage || t("booking.errors.bookingUnavailable")}</div>
              ) : !isValidPair && selectedService ? (
                <div className="empty-box">
                  {bookingMode === "auto_assign"
                    ? t("booking.noAvailableStaffForService")
                    : t("booking.serviceStaffInvalidSelection")}
                </div>
              ) : availabilityLoading ? (
                <div className="slots-wrap">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={`slot-sk-${i}`} className="skeleton-slot" />
                  ))}
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="empty-box">{t("booking.noSlotsThisDay")}</div>
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
              <span>{t("booking.notesOptional")}</span>
              <textarea className="input textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>

            <Card className="summary-card full">
              <h4>{t("booking.summaryTitle")}</h4>
              <p>
                <b>{t("booking.service")}:</b> {summary.service}
              </p>
              <p>
                <b>{t("booking.staff")}:</b> {summary.staff}
              </p>
              <p>
                <b>{t("booking.price")}:</b> {summary.price}
              </p>
              <p>
                <b>{t("booking.time")}:</b> {summary.time}
              </p>
            </Card>

            <Button
              type="submit"
              className="full"
              disabled={submitting || !slotIso || !isValidPair || !salonAccess.canCreateBookings}
            >
              {submitting ? t("booking.submitting") : t("booking.confirmBooking")}
            </Button>
          </form>
        ) : (
          <div className="success-screen">
            <div className="success-icon">✓</div>
            <h3>{t("booking.successTitle")}</h3>
            <p>{t("booking.successSubtitle")}</p>
            <div className="success-details">
              <p>
                <b>{t("booking.requestId")}:</b> {successData.id}
              </p>
              <p>
                <b>{t("booking.service")}:</b> {successData.service}
              </p>
              <p>
                <b>{t("booking.staff")}:</b> {successData.staff}
              </p>
              <p>
                <b>{t("booking.time")}:</b> {formatDateTime(successData.time)}
              </p>
              <p>
                <b>{t("booking.phone")}:</b> {successData.phone}
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
                  {t("booking.contactWhatsappSalon")}
                </Button>
              ) : (
                <Button type="button" variant="ghost" disabled>
                  {t("booking.salonWhatsappMissing")}
                </Button>
              )}
              <Button type="button" variant="secondary" onClick={resetBookingFlow}>
                {t("booking.backOrEdit")}
              </Button>
            </div>
          </div>
        )}
      </Card>
      </div>

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
            alt={`${t("booking.image")} ${lightboxIndex + 1}`}
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
