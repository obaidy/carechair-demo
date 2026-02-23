import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PageShell from "../components/PageShell";
import BillingGate from "../components/BillingGate";
import CalendarPage from "./admin/CalendarPage";
import MobileDrawer from "../components/MobileDrawer";
import SafeImage from "../components/SafeImage";
import Toast from "../components/Toast";
import { Badge, Button, Card, ConfirmModal, SelectInput, Skeleton, TextInput } from "../components/ui";
import {
  csvEscape,
  DAYS,
  DEFAULT_HOURS,
  formatSalonOperationalCurrency,
  formatDate,
  formatDateKey,
  formatTime,
  isValidE164WithoutPlus,
  normalizeIraqiPhone,
  sortByOrderThenName,
} from "../lib/utils";
import { toHHMM } from "../lib/slots";
import { useToast } from "../lib/useToast";
import { supabase } from "../lib/supabase";
import { compressImage } from "../lib/imageCompression";
import { formatWhatsappAppointment, sendWhatsappTemplate } from "../lib/whatsapp";
import { createCountryCheckout } from "../lib/stripeBilling";
import { deriveSalonAccess, formatBillingDate, getBillingStatusLabel, getTrialRemainingLabel } from "../lib/billing";
import {
  galleryToTextareaValue,
  getDefaultAvatar,
  getInitials,
  getServiceImage,
  textareaToGalleryArray,
} from "../lib/media";

const MEDIA_BUCKET = "carechair-media";
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const ADMIN_SIDEBAR_ITEMS = [
  { key: "dashboard", labelKey: "admin.sections.dashboard" },
  { key: "bookings", labelKey: "admin.sections.bookings" },
  { key: "calendar", labelKey: "admin.sections.calendar" },
  { key: "billing", labelKey: "admin.sections.billing" },
  { key: "clients", labelKey: "admin.sections.clients" },
  { key: "employees", labelKey: "admin.sections.employees" },
  { key: "services", labelKey: "admin.sections.services" },
  { key: "schedules", labelKey: "admin.sections.schedules" },
  { key: "commissions", labelKey: "admin.sections.commissions" },
  { key: "expenses", labelKey: "admin.sections.expenses" },
  { key: "reports", labelKey: "admin.sections.reports" },
  { key: "settings", labelKey: "admin.sections.settings" },
];

const SETTINGS_SECTIONS = [
  { key: "assign", labelKey: "admin.settings.assign" },
  { key: "media", labelKey: "admin.settings.media" },
  { key: "salon", labelKey: "admin.settings.salon" },
];

const CHART_COLORS = ["#2563eb", "#1d4ed8", "#0ea5e9", "#14b8a6", "#22c55e", "#f59e0b", "#ef4444"];
const SUNDAY_REF = new Date("2024-01-07T00:00:00Z");

function formatMonthLabel(monthKey, locale = "en") {
  const [year, month] = String(monthKey || "")
    .split("-")
    .map((x) => Number(x));
  if (!year || !month) return monthKey;
  const date = new Date(year, month - 1, 1);
  const safeLocale = String(locale || "en").startsWith("ar") ? "ar-IQ" : String(locale || "en");
  return new Intl.DateTimeFormat(safeLocale, { month: "long", year: "numeric" }).format(date);
}

const BOOKINGS_PAGE_SIZE = 20;

export default function SalonAdminPage() {
  const { t, i18n } = useTranslation();
  const { slug, module } = useParams();
  const navigate = useNavigate();
  const { toast, showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [salon, setSalon] = useState(null);
  const [adminPass, setAdminPass] = useState("");
  const [unlocked, setUnlocked] = useState(false);

  const [bookings, setBookings] = useState([]);
  const [bookingStatusFilter, setBookingStatusFilter] = useState("all");
  const [bookingDateFilter, setBookingDateFilter] = useState("today");
  const [bookingSearch, setBookingSearch] = useState("");
  const [visibleBookingCount, setVisibleBookingCount] = useState(BOOKINGS_PAGE_SIZE);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState({});

  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [staffServices, setStaffServices] = useState([]);
  const [employeeHours, setEmployeeHours] = useState([]);
  const [employeeTimeOff, setEmployeeTimeOff] = useState([]);

  const [hoursDraft, setHoursDraft] = useState({});
  const [saveHoursLoading, setSaveHoursLoading] = useState(false);
  const [savingSalonFlags, setSavingSalonFlags] = useState(false);

  const [activeSection, setActiveSection] = useState("dashboard");
  const [activeSettingsSection, setActiveSettingsSection] = useState("assign");
  const [analyticsPeriod, setAnalyticsPeriod] = useState("last30");
  const [calendarDate, setCalendarDate] = useState(formatDateKey(new Date()));
  const [scheduleStaffId, setScheduleStaffId] = useState("");
  const [scheduleDraft, setScheduleDraft] = useState({});
  const [saveScheduleLoading, setSaveScheduleLoading] = useState(false);
  const [timeOffForm, setTimeOffForm] = useState({ start_at: "", end_at: "", reason: "" });
  const [savingTimeOff, setSavingTimeOff] = useState(false);
  const [deletingTimeOffId, setDeletingTimeOffId] = useState("");

  const [serviceForm, setServiceForm] = useState({ name: "", duration_minutes: "", price: "", sort_order: "" });
  const [staffForm, setStaffForm] = useState({ name: "", sort_order: "0", photo_url: "" });
  const [addingService, setAddingService] = useState(false);
  const [addingStaff, setAddingStaff] = useState(false);

  const [editingServiceId, setEditingServiceId] = useState("");
  const [editingService, setEditingService] = useState({ name: "", duration_minutes: "45", price: "0", sort_order: "0", is_active: true });
  const [editingStaffId, setEditingStaffId] = useState("");
  const [editingStaff, setEditingStaff] = useState({ name: "", sort_order: "0", is_active: true, photo_url: "" });

  const [rowLoading, setRowLoading] = useState("");

  const [assignStaffId, setAssignStaffId] = useState("");
  const [assignDraft, setAssignDraft] = useState([]);
  const [saveAssignLoading, setSaveAssignLoading] = useState(false);
  const [serviceAssignOpenId, setServiceAssignOpenId] = useState("");
  const [serviceAssignDraft, setServiceAssignDraft] = useState([]);
  const [serviceAssignSavingId, setServiceAssignSavingId] = useState("");

  const [deleteDialog, setDeleteDialog] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [mediaDraft, setMediaDraft] = useState({
    logo_url: "",
    cover_image_url: "",
    gallery_text: "",
  });
  const [savingMedia, setSavingMedia] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoCompressing, setLogoCompressing] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverCompressing, setCoverCompressing] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryCompressing, setGalleryCompressing] = useState(false);
  const [galleryDeletingUrl, setGalleryDeletingUrl] = useState("");
  const [serviceImageLoading, setServiceImageLoading] = useState({});
  const [serviceImageCompressing, setServiceImageCompressing] = useState({});
  const [staffImageLoading, setStaffImageLoading] = useState({});
  const [staffImageCompressing, setStaffImageCompressing] = useState({});
  const [copyingLink, setCopyingLink] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutPlanType, setCheckoutPlanType] = useState("basic");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const tr = useCallback(
    (key, defaultValue, options = {}) =>
      t(key, {
        defaultValue,
        ...options,
      }),
    [t]
  );

  const numberLocale = useMemo(() => {
    const lang = String(i18n.language || "en-US");
    return lang.startsWith("ar") ? "ar-IQ-u-nu-latn" : lang;
  }, [i18n.language]);

  const formatMoney = useCallback(
    (value) => formatSalonOperationalCurrency(value, salon, numberLocale),
    [numberLocale, salon]
  );

  const localizedDays = useMemo(() => {
    const locale = String(i18n.language || "en");
    return DAYS.map((day) => {
      const d = new Date(SUNDAY_REF);
      d.setUTCDate(SUNDAY_REF.getUTCDate() + day.index);
      let label = day.label;
      try {
        const safeLocale = locale.startsWith("ar") ? "ar-IQ" : locale;
        label = new Intl.DateTimeFormat(safeLocale, { weekday: "long" }).format(d);
      } catch {
        // Keep Arabic fallback from constants.
      }
      return { ...day, label };
    });
  }, [i18n.language]);

  useEffect(() => {
    const validKeys = new Set(ADMIN_SIDEBAR_ITEMS.map((x) => x.key));
    const target = module || "dashboard";
    if (!validKeys.has(target)) {
      navigate(`/s/${slug}/admin/dashboard`, { replace: true });
      return;
    }
    setActiveSection(target);
  }, [module, navigate, slug]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [activeSection]);

  useEffect(() => {
    async function loadSalon() {
      if (!supabase) {
        setLoading(false);
        showToast("error", tr("admin.errors.supabaseIncomplete", "Supabase configuration is incomplete."));
        return;
      }

      setLoading(true);
      try {
        const salonRes = await supabase.from("salons").select("*").eq("slug", slug).maybeSingle();

        if (salonRes.error) throw salonRes.error;
        if (!salonRes.data) {
          setSalon(null);
          setLoading(false);
          return;
        }

        setSalon(salonRes.data);
        setMediaDraft({
          logo_url: String(salonRes.data.logo_url || ""),
          cover_image_url: String(salonRes.data.cover_image_url || ""),
          gallery_text: galleryToTextareaValue(salonRes.data.gallery_image_urls),
        });
      } catch (err) {
        showToast(
          "error",
          tr("admin.errors.loadSalonFailed", "Failed to load salon: {{message}}", {
            message: err?.message || err,
          })
        );
      } finally {
        setLoading(false);
      }
    }

    loadSalon();
  }, [slug, showToast]);

  async function loadAdminData(salonId) {
    if (!supabase || !salonId) return;

    setBookingsLoading(true);
    try {
      const [bookingsRes, servicesRes, staffRes, staffServicesRes, hoursRes, employeeHoursRes, employeeTimeOffRes] = await Promise.all([
        supabase.from("bookings").select("*").eq("salon_id", salonId).order("appointment_start", { ascending: true }).limit(2000),
        supabase.from("services").select("*").eq("salon_id", salonId),
        supabase.from("staff").select("*").eq("salon_id", salonId),
        supabase.from("staff_services").select("*").eq("salon_id", salonId),
        supabase.from("salon_hours").select("*").eq("salon_id", salonId),
        supabase.from("employee_hours").select("*").eq("salon_id", salonId),
        supabase
          .from("employee_time_off")
          .select("*")
          .eq("salon_id", salonId)
          .order("start_at", { ascending: true })
          .limit(800),
      ]);

      if (bookingsRes.error) throw bookingsRes.error;
      if (servicesRes.error) throw servicesRes.error;
      if (staffRes.error) throw staffRes.error;
      if (staffServicesRes.error) throw staffServicesRes.error;
      if (hoursRes.error) throw hoursRes.error;
      if (employeeHoursRes.error) throw employeeHoursRes.error;
      if (employeeTimeOffRes.error) throw employeeTimeOffRes.error;

      setBookings(bookingsRes.data || []);
      setServices((servicesRes.data || []).sort(sortByOrderThenName));
      setStaff((staffRes.data || []).sort(sortByOrderThenName));
      setStaffServices(staffServicesRes.data || []);
      setEmployeeHours(employeeHoursRes.data || []);
      setEmployeeTimeOff(employeeTimeOffRes.data || []);

      const dayMap = {};
      for (const day of localizedDays) {
        dayMap[day.index] = { is_closed: false, open_time: "10:00", close_time: "20:00" };
      }
      for (const row of hoursRes.data || []) {
        dayMap[row.day_of_week] = {
          is_closed: Boolean(row.is_closed),
          open_time: toHHMM(row.open_time),
          close_time: toHHMM(row.close_time),
        };
      }

      if ((hoursRes.data || []).length === 0) {
        const payload = DEFAULT_HOURS.map((x) => ({
          salon_id: salonId,
          day_of_week: x.day_of_week,
          open_time: `${x.open_time}:00`,
          close_time: `${x.close_time}:00`,
          is_closed: x.is_closed,
        }));
        const up = await supabase.from("salon_hours").upsert(payload, { onConflict: "salon_id,day_of_week" });
        if (!up.error) {
          // Keep draft synced to defaults.
        }
      }

      setHoursDraft(dayMap);

      const firstStaff = (staffRes.data || []).sort(sortByOrderThenName)[0];
      setAssignStaffId((prev) => {
        if (prev && (staffRes.data || []).some((x) => x.id === prev)) return prev;
        return firstStaff?.id || "";
      });
      setScheduleStaffId((prev) => {
        if (prev && (staffRes.data || []).some((x) => x.id === prev)) return prev;
        return firstStaff?.id || "";
      });
    } catch (err) {
      showToast(
        "error",
        tr("admin.errors.loadAdminDataFailed", "Failed to load admin data: {{message}}", {
          message: err?.message || err,
        })
      );
    } finally {
      setBookingsLoading(false);
    }
  }

  useEffect(() => {
    if (unlocked && salon?.id) {
      loadAdminData(salon.id);
    }
  }, [unlocked, salon?.id]);

  const servicesById = useMemo(() => Object.fromEntries(services.map((x) => [x.id, x])), [services]);
  const staffById = useMemo(() => Object.fromEntries(staff.map((x) => [x.id, x])), [staff]);

  const assignmentSet = useMemo(
    () => new Set(staffServices.map((x) => `${x.staff_id}:${x.service_id}`)),
    [staffServices]
  );

  const staffByServiceId = useMemo(() => {
    const map = {};
    for (const row of staffServices) {
      if (!map[row.service_id]) map[row.service_id] = [];
      const member = staffById[row.staff_id];
      if (member) map[row.service_id].push(member);
    }
    for (const key of Object.keys(map)) {
      map[key] = [...map[key]].sort(sortByOrderThenName);
    }
    return map;
  }, [staffServices, staffById]);

  useEffect(() => {
    if (!assignStaffId) {
      setAssignDraft([]);
      return;
    }
    setAssignDraft(
      staffServices
        .filter((x) => x.staff_id === assignStaffId)
        .map((x) => x.service_id)
    );
  }, [assignStaffId, staffServices]);

  useEffect(() => {
    if (!scheduleStaffId) {
      setScheduleDraft({});
      return;
    }

    const base = {};
    for (const day of localizedDays) {
      base[day.index] = {
        is_off: false,
        start_time: "10:00",
        end_time: "20:00",
        break_start: "",
        break_end: "",
      };
    }

    for (const row of employeeHours.filter((x) => x.staff_id === scheduleStaffId)) {
      base[row.day_of_week] = {
        is_off: Boolean(row.is_off),
        start_time: toHHMM(row.start_time),
        end_time: toHHMM(row.end_time),
        break_start: row.break_start ? toHHMM(row.break_start) : "",
        break_end: row.break_end ? toHHMM(row.break_end) : "",
      };
    }

    setScheduleDraft(base);
  }, [scheduleStaffId, employeeHours]);

  useEffect(() => {
    if (!serviceAssignOpenId) return;
    const stillExists = services.some((row) => row.id === serviceAssignOpenId);
    if (!stillExists) {
      setServiceAssignOpenId("");
      setServiceAssignDraft([]);
      return;
    }
    const assignedIds = staffServices
      .filter((row) => row.service_id === serviceAssignOpenId)
      .map((row) => row.staff_id);
    setServiceAssignDraft(assignedIds);
  }, [serviceAssignOpenId, services, staffServices]);

  const todayKey = formatDateKey(new Date());

  const filteredBookings = useMemo(() => {
    const query = bookingSearch.trim().toLowerCase();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfToday);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    return [...bookings]
      .filter((row) => {
        if (bookingStatusFilter !== "all" && row.status !== bookingStatusFilter) return false;

        const rowDate = new Date(row.appointment_start);
        if (bookingDateFilter === "today" && formatDateKey(rowDate) !== todayKey) return false;
        if (bookingDateFilter === "week" && (rowDate < startOfToday || rowDate >= endOfWeek)) return false;

        if (!query) return true;
        const haystack = `${String(row.customer_name || "").toLowerCase()} ${String(row.customer_phone || "").toLowerCase()}`;
        return haystack.includes(query);
      })
      .sort((a, b) => new Date(a.appointment_start).getTime() - new Date(b.appointment_start).getTime());
  }, [bookings, bookingStatusFilter, bookingDateFilter, bookingSearch, todayKey]);

  const visibleBookings = useMemo(
    () => filteredBookings.slice(0, visibleBookingCount),
    [filteredBookings, visibleBookingCount]
  );

  const hasMoreBookings = filteredBookings.length > visibleBookingCount;

  const groupedBookings = useMemo(() => {
    const map = {};
    for (const row of visibleBookings) {
      const key = formatDateKey(row.appointment_start);
      if (!map[key]) {
        map[key] = { key, label: formatDate(row.appointment_start), items: [] };
      }
      map[key].items.push(row);
    }
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
  }, [visibleBookings]);

  const kpis = useMemo(() => {
    const today = bookings.filter((x) => formatDateKey(x.appointment_start) === todayKey).length;
    const pending = bookings.filter((x) => x.status === "pending").length;
    const confirmed = bookings.filter((x) => x.status === "confirmed").length;
    const cancelled = bookings.filter((x) => x.status === "cancelled").length;
    return { today, pending, confirmed, cancelled };
  }, [bookings, todayKey]);

  const statusLabels = useMemo(
    () => ({
      pending: tr("booking.status.pending", "Pending"),
      confirmed: tr("booking.status.confirmed", "Confirmed"),
      cancelled: tr("booking.status.cancelled", "Cancelled"),
    }),
    [tr]
  );

  const calendarGroups = useMemo(() => {
    const targetDate = calendarDate || formatDateKey(new Date());
    const rows = bookings
      .filter((b) => formatDateKey(b.appointment_start) === targetDate)
      .sort((a, b) => new Date(a.appointment_start).getTime() - new Date(b.appointment_start).getTime());

    const map = {};
    for (const member of staff) {
      map[member.id] = { staff: member, items: [] };
    }
    for (const row of rows) {
      if (!map[row.staff_id]) {
        map[row.staff_id] = {
          staff: { id: row.staff_id, name: tr("admin.common.unknownStaff", "Unassigned") },
          items: [],
        };
      }
      map[row.staff_id].items.push(row);
    }
    const sortLocale = String(i18n.language || "en").startsWith("ar") ? "ar" : "en";
    return Object.values(map).sort((a, b) =>
      String(a.staff?.name || "").localeCompare(String(b.staff?.name || ""), sortLocale)
    );
  }, [bookings, calendarDate, i18n.language, staff, tr]);

  const analyticsMonthOptions = useMemo(() => {
    if (!salon?.created_at) return [];

    const created = new Date(salon.created_at);
    const start = new Date(created.getFullYear(), created.getMonth(), 1);
    const end = new Date();
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
    const rows = [];

    const cursor = new Date(start);
    while (cursor <= endMonth) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      rows.push({ value: key, label: formatMonthLabel(key, i18n.language) });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return rows.reverse();
  }, [i18n.language, salon?.created_at]);

  useEffect(() => {
    if (analyticsPeriod === "last30") return;
    if (analyticsMonthOptions.some((x) => x.value === analyticsPeriod)) return;
    setAnalyticsPeriod("last30");
  }, [analyticsMonthOptions, analyticsPeriod]);

  const analyticsRange = useMemo(() => {
    const now = new Date();
    if (analyticsPeriod === "last30") {
      const end = new Date(now);
      end.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() + 1);
      const start = new Date(end);
      start.setDate(start.getDate() - 30);
      return { start, end, label: tr("admin.analytics.last30Days", "Last 30 days") };
    }

    const [year, month] = String(analyticsPeriod).split("-").map((x) => Number(x));
    if (!year || !month) {
      const end = new Date(now);
      end.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() + 1);
      const start = new Date(end);
      start.setDate(start.getDate() - 30);
      return { start, end, label: tr("admin.analytics.last30Days", "Last 30 days") };
    }

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    return { start, end, label: formatMonthLabel(analyticsPeriod, i18n.language) };
  }, [analyticsPeriod, i18n.language, tr]);

  const analytics = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const { start: periodStart, end: periodEnd, label: periodLabel } = analyticsRange;
    const dayKeys = [];
    const dayRevenueMap = {};

    const cursor = new Date(periodStart);
    while (cursor < periodEnd) {
      const d = new Date(cursor);
      d.setHours(0, 0, 0, 0);
      const key = formatDateKey(d);
      dayKeys.push({ key, date: d });
      dayRevenueMap[key] = 0;
      cursor.setDate(cursor.getDate() + 1);
    }

    const todayBookings = bookings.filter((x) => formatDateKey(x.appointment_start) === todayKey);
    const confirmedBookings = bookings.filter((x) => x.status === "confirmed");
    const bookingsInPeriod = bookings.filter((x) => {
      const date = new Date(x.appointment_start || x.created_at);
      return date >= periodStart && date < periodEnd;
    });
    const confirmedInPeriod = confirmedBookings.filter((x) => {
      const date = new Date(x.appointment_start || x.created_at);
      return date >= periodStart && date < periodEnd;
    });

    const revenueFor = (booking) =>
      Number(servicesById[booking.service_id]?.price || booking.price || booking.service_price || 0);

    let todayRevenue = 0;
    let monthRevenue = 0;
    const serviceRevenueMap = {};
    const employeeMap = {};

    for (const member of staff) {
      employeeMap[member.id] = {
        id: member.id,
        name: member.name,
        bookings: 0,
        revenue: 0,
        minutes: 0,
      };
    }

    for (const booking of confirmedBookings) {
      const amount = revenueFor(booking);
      const bookingDate = new Date(booking.appointment_start);
      const bookingKey = formatDateKey(bookingDate);

      if (bookingKey === todayKey) todayRevenue += amount;
      if (bookingDate >= monthStart) monthRevenue += amount;
    }

    for (const booking of confirmedInPeriod) {
      const amount = revenueFor(booking);
      const bookingDate = new Date(booking.appointment_start);
      const bookingKey = formatDateKey(bookingDate);

      if (Object.prototype.hasOwnProperty.call(dayRevenueMap, bookingKey)) {
        dayRevenueMap[bookingKey] += amount;
      }

      const serviceName =
        servicesById[booking.service_id]?.name || tr("admin.common.unknownService", "Unknown service");
      serviceRevenueMap[serviceName] = (serviceRevenueMap[serviceName] || 0) + amount;

      const employee = employeeMap[booking.staff_id];
      if (employee) {
        employee.bookings += 1;
        employee.revenue += amount;
        const start = booking.appointment_start ? new Date(booking.appointment_start).getTime() : 0;
        const end = booking.appointment_end ? new Date(booking.appointment_end).getTime() : 0;
        const derivedMinutes =
          Number(servicesById[booking.service_id]?.duration_minutes || 0) ||
          Math.max(0, Math.round((end - start) / 60000));
        employee.minutes += Number.isFinite(derivedMinutes) ? derivedMinutes : 0;
      }
    }

    const openMinutesByDay = DAYS.reduce((acc, day) => {
      const row = hoursDraft[day.index];
      if (!row || row.is_closed) return { ...acc, [day.index]: 0 };
      const open = String(row.open_time || "10:00").split(":").map(Number);
      const close = String(row.close_time || "20:00").split(":").map(Number);
      const minutes = Math.max(0, (close[0] * 60 + close[1]) - (open[0] * 60 + open[1]));
      return { ...acc, [day.index]: minutes };
    }, {});

    let totalAvailableMinutes = 0;
    for (const row of dayKeys) {
      totalAvailableMinutes += openMinutesByDay[row.date.getDay()] || 0;
    }

    const employeesPerformance = Object.values(employeeMap)
      .map((row) => {
        const utilization = totalAvailableMinutes > 0 ? (row.minutes / totalAvailableMinutes) * 100 : 0;
        const baseRating = 4 + Math.min(1, row.bookings / 35);
        return {
          ...row,
          utilization: Math.max(0, Math.min(100, utilization)),
          rating: Math.min(5, baseRating).toFixed(1),
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    const servicesBreakdown = Object.entries(serviceRevenueMap)
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    const totalServiceRevenue = servicesBreakdown.reduce((sum, x) => sum + x.revenue, 0);
    const pieSegments = servicesBreakdown.map((item, idx) => {
      const pct = totalServiceRevenue > 0 ? (item.revenue / totalServiceRevenue) * 100 : 0;
      return { ...item, color: CHART_COLORS[idx % CHART_COLORS.length], pct };
    });

    let startPct = 0;
    const pieGradient = pieSegments.length
      ? `conic-gradient(${pieSegments
          .map((segment) => {
            const from = startPct;
            startPct += segment.pct;
            return `${segment.color} ${from}% ${startPct}%`;
          })
          .join(",")})`
      : "conic-gradient(#e2e8f0 0% 100%)";

    const revenueSeries = dayKeys.map((row) => ({ ...row, revenue: dayRevenueMap[row.key] || 0 }));
    const seriesMax = Math.max(1, ...revenueSeries.map((x) => x.revenue));
    const chartWidth = 920;
    const chartHeight = 260;
    const padX = 30;
    const padY = 22;
    const stepX = revenueSeries.length > 1 ? (chartWidth - padX * 2) / (revenueSeries.length - 1) : 0;
    const points = revenueSeries.map((row, idx) => {
      const x = padX + idx * stepX;
      const y = chartHeight - padY - (row.revenue / seriesMax) * (chartHeight - padY * 2);
      return { x, y, ...row };
    });
    const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
    const areaPath = points.length
      ? `M ${points[0].x} ${chartHeight - padY} L ${points
          .map((p) => `${p.x} ${p.y}`)
          .join(" L ")} L ${points[points.length - 1].x} ${chartHeight - padY} Z`
      : "";

    const clientsMap = {};
    for (const b of bookingsInPeriod) {
      const key = String(b.customer_phone || b.customer_name || b.id);
      if (!clientsMap[key]) {
        clientsMap[key] = {
          name: b.customer_name || tr("admin.common.customer", "Customer"),
          phone: b.customer_phone || "-",
          bookings: 0,
          revenue: 0,
          lastVisit: b.appointment_start || b.created_at,
        };
      }
      clientsMap[key].bookings += 1;
      if (b.status === "confirmed") clientsMap[key].revenue += revenueFor(b);
      if (new Date(b.appointment_start || b.created_at) > new Date(clientsMap[key].lastVisit)) {
        clientsMap[key].lastVisit = b.appointment_start || b.created_at;
      }
    }
    const clients = Object.values(clientsMap).sort((a, b) => b.bookings - a.bookings);

    return {
      todayRevenue,
      monthRevenue,
      totalBookingsToday: todayBookings.length,
      activeEmployees: staff.filter((x) => x.is_active).length,
      revenueSeries,
      seriesMax,
      polylinePoints,
      areaPath,
      chartWidth,
      chartHeight,
      padX,
      padY,
      employeesPerformance,
      pieSegments,
      pieGradient,
      clients,
      totalServiceRevenue,
      periodLabel,
    };
  }, [analyticsRange, bookings, hoursDraft, servicesById, staff, todayKey]);

  useEffect(() => {
    setVisibleBookingCount(BOOKINGS_PAGE_SIZE);
  }, [bookingStatusFilter, bookingDateFilter, bookingSearch, bookings]);

  const galleryUrls = useMemo(() => textareaToGalleryArray(mediaDraft.gallery_text), [mediaDraft.gallery_text]);
  const bookingPageUrl = useMemo(() => {
    if (!salon?.slug) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return origin ? `${origin}/s/${salon.slug}` : `/s/${salon.slug}`;
  }, [salon?.slug]);
  const shareBookingWhatsappHref = useMemo(() => {
    if (!bookingPageUrl) return "";
    return `https://wa.me/?text=${encodeURIComponent(
      `${tr("admin.share.bookingLinkMessage", "This is your salon booking link:")}\n${bookingPageUrl}`
    )}`;
  }, [bookingPageUrl, tr]);

  const onboardingChecklist = useMemo(() => {
    const hasServices = services.some((row) => row.is_active);
    const hasStaff = staff.some((row) => row.is_active);
    const hasAssignments = staffServices.length > 0;
    const hasHours = Object.values(hoursDraft || {}).some(
      (row) => row && !row.is_closed && row.open_time && row.close_time
    );
    const hasMedia =
      Boolean(String(salon?.logo_url || "").trim()) ||
      Boolean(String(salon?.cover_image_url || "").trim()) ||
      galleryUrls.length > 0;
    return [
      { key: "services", label: tr("admin.checklist.services", "Add services"), done: hasServices },
      { key: "staff", label: tr("admin.checklist.staff", "Add employees"), done: hasStaff },
      { key: "assign", label: tr("admin.checklist.assign", "Assign services to employees"), done: hasAssignments },
      { key: "hours", label: tr("admin.checklist.hours", "Set working hours"), done: hasHours },
      { key: "media", label: tr("admin.checklist.media", "Add salon photos (optional)"), done: hasMedia },
    ];
  }, [services, staff, staffServices, hoursDraft, salon?.logo_url, salon?.cover_image_url, galleryUrls.length, tr]);

  const selectedStaffTimeOff = useMemo(
    () =>
      employeeTimeOff
        .filter((row) => row.staff_id === scheduleStaffId)
        .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()),
    [employeeTimeOff, scheduleStaffId]
  );

  const salonAccess = useMemo(() => deriveSalonAccess(salon), [salon]);
  const writeLocked = unlocked && !salonAccess.canManage;
  const setupPaymentLink = String(import.meta.env.VITE_SETUP_PAYMENT_LINK || "").trim();
  const trialRemaining = getTrialRemainingLabel(salon?.trial_end_at || salon?.trial_end);

  function ensureWriteAccess() {
    if (!writeLocked) return true;
    showToast("error", salonAccess.lockMessage || tr("admin.errors.accountLockedForEdits", "Account is not active for edits right now."));
    return false;
  }

  function scrollTopInstant() {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  function goToSection(sectionKey, closeMobile = false) {
    setActiveSection(sectionKey);
    if (closeMobile) setMobileNavOpen(false);
    navigate(`/s/${slug}/admin/${sectionKey}`);
    requestAnimationFrame(scrollTopInstant);
  }

  function validateImageFile(file) {
    if (!file) {
      showToast("error", tr("admin.errors.pickImageFirst", "Select an image first."));
      return false;
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      showToast("error", tr("admin.errors.invalidImageType", "File type must be JPG, PNG, or WEBP."));
      return false;
    }
    return true;
  }

  function getStoragePathFromPublicUrl(url) {
    const marker = `/storage/v1/object/public/${MEDIA_BUCKET}/`;
    const raw = String(url || "");
    const idx = raw.indexOf(marker);
    if (idx === -1) return "";
    return raw.slice(idx + marker.length);
  }

async function uploadToStorage(path, fileOrBlob, contentType) {
  const storage = supabase.storage.from(MEDIA_BUCKET);
  const up = await storage.upload(path, fileOrBlob, {
    upsert: true,
    contentType: contentType || "image/jpeg",
  });
  if (up.error) {
    const msg = String(up.error.message || "");
    if (msg.toLowerCase().includes("bucket not found")) {
      throw new Error(
        tr(
          "admin.errors.mediaBucketMissing",
          "Media bucket was not found. Run storage migration or create bucket carechair-media."
        )
      );
    }
    throw up.error;
  }
  const pub = storage.getPublicUrl(path);
  return pub?.data?.publicUrl || "";
}

  async function prepareCompressedImage(file) {
    // Integration note:
    // Keep type validation before this call, then upload `compressed.blob`.
    try {
      return await compressImage(file);
    } catch (err) {
      throw new Error(err?.message || tr("admin.errors.imageCompressionFailed", "Failed to compress image before upload."));
    }
  }

  async function saveGalleryUrls(nextUrls) {
    if (!supabase || !salon?.id) return null;
    const up = await supabase
      .from("salons")
      .update({ gallery_image_urls: nextUrls })
      .eq("id", salon.id)
      .select("*")
      .single();
    if (up.error) throw up.error;
    setSalon(up.data);
    setMediaDraft((prev) => ({ ...prev, gallery_text: (nextUrls || []).join("\n") }));
    return up.data;
  }

  async function handleLogoUpload(file) {
    if (!supabase || !salon?.id) return;
    if (!ensureWriteAccess()) return;
    if (!validateImageFile(file)) return;

    setLogoCompressing(true);
    try {
      const compressed = await prepareCompressedImage(file);
      setLogoCompressing(false);
      setLogoUploading(true);

      const path = `salons/${salon.id}/logo.png`;
      const publicUrl = await uploadToStorage(path, compressed.blob, compressed.contentType);
      const up = await supabase
        .from("salons")
        .update({ logo_url: publicUrl })
        .eq("id", salon.id)
        .select("*")
        .single();
      if (up.error) throw up.error;

      setSalon(up.data);
      setMediaDraft((prev) => ({ ...prev, logo_url: publicUrl }));
      showToast("success", tr("admin.messages.logoUploaded", "Salon logo uploaded."));
    } catch (err) {
      showToast(
        "error",
        tr("admin.errors.logoUploadFailed", "Failed to upload logo after compression: {{message}}", {
          message: err?.message || err,
        })
      );
    } finally {
      setLogoCompressing(false);
      setLogoUploading(false);
    }
  }

  async function handleCoverUpload(file) {
    if (!supabase || !salon?.id) return;
    if (!ensureWriteAccess()) return;
    if (!validateImageFile(file)) return;

    setCoverCompressing(true);
    try {
      const compressed = await prepareCompressedImage(file);
      setCoverCompressing(false);
      setCoverUploading(true);

      const path = `salons/${salon.id}/cover.${compressed.ext}`;
      const publicUrl = await uploadToStorage(path, compressed.blob, compressed.contentType);
      const up = await supabase
        .from("salons")
        .update({ cover_image_url: publicUrl })
        .eq("id", salon.id)
        .select("*")
        .single();
      if (up.error) throw up.error;

      setSalon(up.data);
      setMediaDraft((prev) => ({ ...prev, cover_image_url: publicUrl }));
      showToast("success", tr("admin.messages.coverUploaded", "Cover image uploaded."));
    } catch (err) {
      showToast(
        "error",
        tr("admin.errors.coverUploadFailed", "Failed to upload cover image after compression: {{message}}", {
          message: err?.message || err,
        })
      );
    } finally {
      setCoverCompressing(false);
      setCoverUploading(false);
    }
  }

  async function handleGalleryUpload(fileList) {
    if (!supabase || !salon?.id) return;
    if (!ensureWriteAccess()) return;
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    const current = [...galleryUrls];
    if (current.length >= 8) {
      showToast("error", tr("admin.errors.galleryMaxReached", "You reached the maximum gallery limit (8 images)."));
      return;
    }

    try {
      const remaining = 8 - current.length;
      const toUpload = files.slice(0, remaining);
      const uploadedUrls = [];

      for (const file of toUpload) {
        if (!validateImageFile(file)) continue;
        setGalleryCompressing(true);
        const compressed = await prepareCompressedImage(file);
        setGalleryCompressing(false);
        const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const path = `salons/${salon.id}/gallery/${id}.${compressed.ext}`;
        setGalleryUploading(true);
        const publicUrl = await uploadToStorage(path, compressed.blob, compressed.contentType);
        setGalleryUploading(false);
        if (publicUrl) uploadedUrls.push(publicUrl);
      }

      if (uploadedUrls.length === 0) {
        showToast("error", tr("admin.errors.noImageUploaded", "No image was uploaded."));
        return;
      }

      const next = [...current, ...uploadedUrls].slice(0, 8);
      await saveGalleryUrls(next);
      showToast("success", tr("admin.messages.galleryUploaded", "Gallery images uploaded."));
    } catch (err) {
      showToast(
        "error",
        tr("admin.errors.galleryUploadFailed", "Failed to compress/upload gallery images: {{message}}", {
          message: err?.message || err,
        })
      );
    } finally {
      setGalleryCompressing(false);
      setGalleryUploading(false);
    }
  }

  async function handleRemoveGalleryImage(url) {
    if (!supabase || !salon?.id) return;
    if (!ensureWriteAccess()) return;

    setGalleryDeletingUrl(url);
    try {
      const next = galleryUrls.filter((x) => x !== url);
      await saveGalleryUrls(next);

      const path = getStoragePathFromPublicUrl(url);
      if (path) {
        await supabase.storage.from(MEDIA_BUCKET).remove([path]);
      }

      showToast("success", tr("admin.messages.galleryImageDeleted", "Image removed from gallery."));
    } catch (err) {
      showToast("error", tr("admin.errors.deleteImageFailed", "Failed to delete image: {{message}}", { message: err?.message || err }));
    } finally {
      setGalleryDeletingUrl("");
    }
  }

  async function handleServiceImageUpload(serviceId, file) {
    if (!supabase || !salon?.id || !serviceId) return;
    if (!ensureWriteAccess()) return;
    if (!validateImageFile(file)) return;

    setServiceImageCompressing((prev) => ({ ...prev, [serviceId]: true }));
    setServiceImageLoading((prev) => ({ ...prev, [serviceId]: true }));
    try {
      const compressed = await prepareCompressedImage(file);
      setServiceImageCompressing((prev) => ({ ...prev, [serviceId]: false }));

      const path = `services/${serviceId}/image.${compressed.ext}`;
      const publicUrl = await uploadToStorage(path, compressed.blob, compressed.contentType);
      const up = await supabase
        .from("services")
        .update({ image_url: publicUrl })
        .eq("id", serviceId)
        .eq("salon_id", salon.id)
        .select("*")
        .single();
      if (up.error) throw up.error;

      setServices((prev) => prev.map((row) => (row.id === serviceId ? { ...row, image_url: publicUrl } : row)));
      showToast("success", tr("admin.messages.serviceImageUploaded", "Service image uploaded."));
    } catch (err) {
      showToast(
        "error",
        tr("admin.errors.serviceImageUploadFailed", "Failed to compress/upload service image: {{message}}", {
          message: err?.message || err,
        })
      );
    } finally {
      setServiceImageCompressing((prev) => ({ ...prev, [serviceId]: false }));
      setServiceImageLoading((prev) => ({ ...prev, [serviceId]: false }));
    }
  }

  async function handleStaffImageUpload(staffId, file) {
    if (!supabase || !salon?.id || !staffId) return;
    if (!ensureWriteAccess()) return;
    if (!validateImageFile(file)) return;

    setStaffImageCompressing((prev) => ({ ...prev, [staffId]: true }));
    setStaffImageLoading((prev) => ({ ...prev, [staffId]: true }));
    try {
      const compressed = await prepareCompressedImage(file);
      setStaffImageCompressing((prev) => ({ ...prev, [staffId]: false }));

      const path = `staff/${staffId}/avatar.${compressed.ext}`;
      const publicUrl = await uploadToStorage(path, compressed.blob, compressed.contentType);
      const up = await supabase
        .from("staff")
        .update({ photo_url: publicUrl })
        .eq("id", staffId)
        .eq("salon_id", salon.id)
        .select("*")
        .single();
      if (up.error) throw up.error;

      setStaff((prev) => prev.map((row) => (row.id === staffId ? { ...row, photo_url: publicUrl } : row)));
      showToast("success", tr("admin.messages.staffImageUploaded", "Employee image uploaded."));
    } catch (err) {
      showToast(
        "error",
        tr("admin.errors.staffImageUploadFailed", "Failed to compress/upload employee image: {{message}}", {
          message: err?.message || err,
        })
      );
    } finally {
      setStaffImageCompressing((prev) => ({ ...prev, [staffId]: false }));
      setStaffImageLoading((prev) => ({ ...prev, [staffId]: false }));
    }
  }

  async function updateBookingStatus(id, nextStatus) {
    if (!supabase || !salon?.id || statusUpdating[id]) return;
    if (!ensureWriteAccess()) return;

    const prev = bookings.find((x) => x.id === id);
    if (!prev) return;

    setStatusUpdating((p) => ({ ...p, [id]: nextStatus }));
    setBookings((p) => p.map((x) => (x.id === id ? { ...x, status: nextStatus } : x)));

    try {
      const res = await supabase
        .from("bookings")
        .update({ status: nextStatus })
        .eq("id", id)
        .eq("salon_id", salon.id)
        .select("*")
        .single();
      if (res.error) throw res.error;

      setBookings((p) => p.map((x) => (x.id === id ? { ...x, ...res.data } : x)));
      showToast(
        "success",
        nextStatus === "confirmed"
          ? tr("admin.messages.bookingAccepted", "Booking accepted.")
          : tr("admin.messages.bookingRejected", "Booking rejected.")
      );

      const notifyTemplate = nextStatus === "confirmed" ? "booking_confirmed" : "booking_cancelled";
      const serviceName =
        servicesById[res.data.service_id]?.name ||
        servicesById[prev.service_id]?.name ||
        res.data.service ||
        prev.service ||
        tr("admin.bookings.service", "Service");
      const appointmentLocal = formatWhatsappAppointment(
        res.data.appointment_start || prev.appointment_start,
        salon.timezone || "Asia/Baghdad"
      );
      const toCustomer = normalizeIraqiPhone(res.data.customer_phone || prev.customer_phone || "");

      if (isValidE164WithoutPlus(toCustomer)) {
        try {
          await sendWhatsappTemplate({
            to: toCustomer,
            template: notifyTemplate,
            params: [serviceName, appointmentLocal],
          });
        } catch (notifyErr) {
          console.error("Failed to send customer WhatsApp status notification:", notifyErr);
          showToast("success", tr("admin.messages.savedWhatsappOff", "Saved ✅ (automatic WhatsApp notification is currently disabled)"));
        }
      }
    } catch (err) {
      setBookings((p) => p.map((x) => (x.id === id ? prev : x)));
      showToast("error", tr("admin.errors.updateBookingStatusFailed", "Failed to update booking status: {{message}}", { message: err?.message || err }));
    } finally {
      setStatusUpdating((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
    }
  }

  async function saveHours() {
    if (!supabase || !salon?.id) return;
    if (!ensureWriteAccess()) return;

    for (const day of DAYS) {
      const row = hoursDraft[day.index];
      if (!row) continue;
      if (!row.is_closed && row.close_time <= row.open_time) {
        showToast("error", tr("admin.errors.closeAfterOpen", "Closing time must be after opening time ({{day}}).", { day: day.label }));
        return;
      }
    }

    setSaveHoursLoading(true);
    try {
      const payload = localizedDays.map((day) => {
        const row = hoursDraft[day.index];
        return {
          salon_id: salon.id,
          day_of_week: day.index,
          open_time: `${row.open_time}:00`,
          close_time: `${row.close_time}:00`,
          is_closed: Boolean(row.is_closed),
        };
      });

      const up = await supabase.from("salon_hours").upsert(payload, { onConflict: "salon_id,day_of_week" });
      if (up.error) throw up.error;

      showToast("success", tr("admin.messages.workingHoursSaved", "Working hours saved."));
      await loadAdminData(salon.id);
    } catch (err) {
      showToast("error", tr("admin.errors.saveWorkingHoursFailed", "Failed to save working hours: {{message}}", { message: err?.message || err }));
    } finally {
      setSaveHoursLoading(false);
    }
  }

  async function saveEmployeeSchedule() {
    if (!supabase || !salon?.id || !scheduleStaffId) return;
    if (!ensureWriteAccess()) return;

    for (const day of localizedDays) {
      const row = scheduleDraft[day.index];
      if (!row) continue;
      if (!row.is_off && row.end_time <= row.start_time) {
        showToast("error", tr("admin.errors.closeAfterOpen", "Closing time must be after opening time ({{day}}).", { day: day.label }));
        return;
      }
      if (row.break_start && row.break_end && row.break_end <= row.break_start) {
        showToast("error", tr("admin.errors.invalidBreakPeriod", "Invalid break period ({{day}}).", { day: day.label }));
        return;
      }
    }

    setSaveScheduleLoading(true);
    try {
      const payload = localizedDays.map((day) => {
        const row = scheduleDraft[day.index] || {};
        return {
          salon_id: salon.id,
          staff_id: scheduleStaffId,
          day_of_week: day.index,
          start_time: `${row.start_time || "10:00"}:00`,
          end_time: `${row.end_time || "20:00"}:00`,
          is_off: Boolean(row.is_off),
          break_start: row.break_start ? `${row.break_start}:00` : null,
          break_end: row.break_end ? `${row.break_end}:00` : null,
        };
      });

      const up = await supabase.from("employee_hours").upsert(payload, { onConflict: "staff_id,day_of_week" });
      if (up.error) throw up.error;

      showToast("success", tr("admin.messages.employeeScheduleSaved", "Employee schedule saved."));
      await loadAdminData(salon.id);
    } catch (err) {
      showToast("error", tr("admin.errors.saveEmployeeScheduleFailed", "Failed to save employee schedule: {{message}}", { message: err?.message || err }));
    } finally {
      setSaveScheduleLoading(false);
    }
  }

  async function addEmployeeTimeOff() {
    if (!supabase || !salon?.id || !scheduleStaffId) return;
    if (!ensureWriteAccess()) return;

    const startAt = timeOffForm.start_at ? new Date(timeOffForm.start_at) : null;
    const endAt = timeOffForm.end_at ? new Date(timeOffForm.end_at) : null;
    if (!startAt || !endAt || Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
      showToast("error", tr("admin.errors.selectValidTimeOffPeriod", "Choose a valid time-off period."));
      return;
    }

    setSavingTimeOff(true);
    try {
      const ins = await supabase.from("employee_time_off").insert([
        {
          salon_id: salon.id,
          staff_id: scheduleStaffId,
          start_at: startAt.toISOString(),
          end_at: endAt.toISOString(),
          reason: timeOffForm.reason.trim() || null,
        },
      ]);
      if (ins.error) throw ins.error;

      setTimeOffForm({ start_at: "", end_at: "", reason: "" });
      showToast("success", tr("admin.messages.timeOffAdded", "Time off added."));
      await loadAdminData(salon.id);
    } catch (err) {
      showToast("error", tr("admin.errors.addTimeOffFailed", "Failed to add time off: {{message}}", { message: err?.message || err }));
    } finally {
      setSavingTimeOff(false);
    }
  }

  async function deleteEmployeeTimeOff(rowId) {
    if (!supabase || !salon?.id || !rowId) return;
    if (!ensureWriteAccess()) return;

    setDeletingTimeOffId(rowId);
    try {
      const del = await supabase
        .from("employee_time_off")
        .delete()
        .eq("id", rowId)
        .eq("salon_id", salon.id);
      if (del.error) throw del.error;

      showToast("success", tr("admin.messages.timeOffDeleted", "Time off deleted."));
      await loadAdminData(salon.id);
    } catch (err) {
      showToast("error", tr("admin.errors.deleteTimeOffFailed", "Failed to delete time off: {{message}}", { message: err?.message || err }));
    } finally {
      setDeletingTimeOffId("");
    }
  }

  async function saveSalonFlags(patch) {
    if (!supabase || !salon?.id) return;
    if (!ensureWriteAccess()) return;

    const previous = salon;
    const nextSalon = { ...salon, ...patch };
    setSalon(nextSalon);
    setSavingSalonFlags(true);
    try {
      const up = await supabase.from("salons").update(patch).eq("id", salon.id).select("*").single();
      if (up.error) throw up.error;

      setSalon(up.data);
      showToast("success", tr("admin.messages.salonSettingsSaved", "Salon visibility settings saved."));
    } catch (err) {
      setSalon(previous);
      showToast("error", tr("admin.errors.saveSettingsFailed", "Failed to save settings: {{message}}", { message: err?.message || err }));
    } finally {
      setSavingSalonFlags(false);
    }
  }

  async function saveSalonMedia() {
    if (!supabase || !salon?.id) return;
    if (!ensureWriteAccess()) return;

    setSavingMedia(true);
    try {
      const payload = {
        logo_url: mediaDraft.logo_url.trim() || null,
        cover_image_url: mediaDraft.cover_image_url.trim() || null,
        gallery_image_urls: textareaToGalleryArray(mediaDraft.gallery_text),
      };

      const up = await supabase.from("salons").update(payload).eq("id", salon.id).select("*").single();
      if (up.error) throw up.error;

      setSalon(up.data);
      showToast("success", tr("admin.messages.salonMediaSaved", "Salon media saved."));
    } catch (err) {
      showToast("error", tr("admin.errors.saveMediaFailed", "Failed to save media: {{message}}", { message: err?.message || err }));
    } finally {
      setSavingMedia(false);
    }
  }

  async function addService() {
    if (!supabase || !salon?.id) return;
    if (!ensureWriteAccess()) return;

    const name = serviceForm.name.trim();
    const durationRaw = String(serviceForm.duration_minutes || "").trim();
    const priceRaw = String(serviceForm.price || "").trim();
    const sortRaw = String(serviceForm.sort_order || "").trim();
    const duration = Number(durationRaw);
    const price = Number(priceRaw);
    const sort = Number(sortRaw);

    if (name.length < 2) return showToast("error", tr("admin.errors.validServiceName", "Enter a valid service name."));
    if (!durationRaw) return showToast("error", tr("admin.errors.validDurationNumber", "Duration must be a valid number."));
    if (!priceRaw) return showToast("error", tr("admin.errors.validPriceNumber", "Price must be a valid number."));
    if (!sortRaw) return showToast("error", tr("admin.errors.validSortNumber", "Sort order must be a number."));
    if (!Number.isFinite(duration) || duration <= 0) return showToast("error", tr("admin.errors.validDurationNumber", "Duration must be a valid number."));
    if (!Number.isFinite(price) || price < 0) return showToast("error", tr("admin.errors.validPriceNumber", "Price must be a valid number."));
    if (!Number.isFinite(sort)) return showToast("error", tr("admin.errors.validSortNumber", "Sort order must be a number."));

    setAddingService(true);
    try {
      const ins = await supabase
        .from("services")
        .insert([
          {
            salon_id: salon.id,
            name,
            duration_minutes: duration,
            price,
            sort_order: sort,
            is_active: true,
          },
        ])
        .select("*")
        .single();

      if (ins.error) throw ins.error;
      setServiceForm({ name: "", duration_minutes: "", price: "", sort_order: "" });
      showToast("success", tr("admin.messages.serviceAdded", "Service added."));
      await loadAdminData(salon.id);
    } catch (err) {
      showToast("error", tr("admin.errors.addServiceFailed", "Failed to add service: {{message}}", { message: err?.message || err }));
    } finally {
      setAddingService(false);
    }
  }

  async function addStaff() {
    if (!supabase || !salon?.id) return;
    if (!ensureWriteAccess()) return;

    const name = staffForm.name.trim();
    const sort = Number(staffForm.sort_order);
    if (name.length < 2) return showToast("error", tr("admin.errors.validEmployeeName", "Enter a valid employee name."));
    if (!Number.isFinite(sort)) return showToast("error", tr("admin.errors.validSortNumber", "Sort order must be a number."));

    setAddingStaff(true);
    try {
      const ins = await supabase
        .from("staff")
        .insert([
          {
            salon_id: salon.id,
            name,
            sort_order: sort,
            is_active: true,
            photo_url: staffForm.photo_url.trim() || null,
          },
        ])
        .select("*")
        .single();
      if (ins.error) throw ins.error;

      setStaffForm({ name: "", sort_order: "0", photo_url: "" });
      showToast("success", tr("admin.messages.employeeAdded", "Employee added."));
      await loadAdminData(salon.id);
    } catch (err) {
      showToast("error", tr("admin.errors.addEmployeeFailed", "Failed to add employee: {{message}}", { message: err?.message || err }));
    } finally {
      setAddingStaff(false);
    }
  }

  function startEditService(row) {
    setEditingServiceId(row.id);
    setEditingService({
      name: row.name,
      duration_minutes: String(row.duration_minutes || 45),
      price: String(row.price || 0),
      sort_order: String(row.sort_order || 0),
      is_active: Boolean(row.is_active),
    });
  }

  function startEditStaff(row) {
    setEditingStaffId(row.id);
    setEditingStaff({
      name: row.name,
      sort_order: String(row.sort_order || 0),
      is_active: Boolean(row.is_active),
      photo_url: row.photo_url || "",
    });
  }

  async function saveServiceEdit(id) {
    if (!supabase || !salon?.id) return;
    if (!ensureWriteAccess()) return;

    const patch = {
      name: editingService.name.trim(),
      duration_minutes: Number(editingService.duration_minutes),
      price: Number(editingService.price),
      sort_order: Number(editingService.sort_order),
      is_active: Boolean(editingService.is_active),
    };

    if (patch.name.length < 2) return showToast("error", tr("admin.errors.validServiceName", "Enter a valid service name."));
    if (!Number.isFinite(patch.duration_minutes) || patch.duration_minutes <= 0) return showToast("error", tr("admin.errors.invalidDuration", "Invalid duration."));
    if (!Number.isFinite(patch.price) || patch.price < 0) return showToast("error", tr("admin.errors.invalidPrice", "Invalid price."));
    if (!Number.isFinite(patch.sort_order)) return showToast("error", tr("admin.errors.invalidSort", "Invalid sort order."));

    setRowLoading(`service-save-${id}`);
    try {
      const up = await supabase.from("services").update(patch).eq("id", id).eq("salon_id", salon.id);
      if (up.error) throw up.error;

      setEditingServiceId("");
      showToast("success", tr("admin.messages.serviceUpdated", "Service updated."));
      await loadAdminData(salon.id);
    } catch (err) {
      showToast("error", tr("admin.errors.updateServiceFailed", "Failed to update service: {{message}}", { message: err?.message || err }));
    } finally {
      setRowLoading("");
    }
  }

  async function saveStaffEdit(id) {
    if (!supabase || !salon?.id) return;
    if (!ensureWriteAccess()) return;

    const patch = {
      name: editingStaff.name.trim(),
      sort_order: Number(editingStaff.sort_order),
      is_active: Boolean(editingStaff.is_active),
      photo_url: editingStaff.photo_url.trim() || null,
    };

    if (patch.name.length < 2) return showToast("error", tr("admin.errors.validEmployeeName", "Enter a valid employee name."));
    if (!Number.isFinite(patch.sort_order)) return showToast("error", tr("admin.errors.invalidSort", "Invalid sort order."));

    setRowLoading(`staff-save-${id}`);
    try {
      const up = await supabase.from("staff").update(patch).eq("id", id).eq("salon_id", salon.id);
      if (up.error) throw up.error;

      setEditingStaffId("");
      showToast("success", tr("admin.messages.employeeUpdated", "Employee updated."));
      await loadAdminData(salon.id);
    } catch (err) {
      showToast("error", tr("admin.errors.updateEmployeeFailed", "Failed to update employee: {{message}}", { message: err?.message || err }));
    } finally {
      setRowLoading("");
    }
  }

  async function toggleServiceActive(row) {
    if (!supabase || !salon?.id) return;
    if (!ensureWriteAccess()) return;

    setRowLoading(`service-toggle-${row.id}`);
    try {
      const up = await supabase
        .from("services")
        .update({ is_active: !row.is_active })
        .eq("id", row.id)
        .eq("salon_id", salon.id);
      if (up.error) throw up.error;

      showToast(
        "success",
        !row.is_active
          ? tr("admin.messages.serviceShown", "Service is now visible.")
          : tr("admin.messages.serviceHidden", "Service is now hidden.")
      );
      await loadAdminData(salon.id);
    } catch (err) {
      showToast("error", tr("admin.errors.toggleServiceFailed", "Failed to update service: {{message}}", { message: err?.message || err }));
    } finally {
      setRowLoading("");
    }
  }

  async function toggleStaffActive(row) {
    if (!supabase || !salon?.id) return;
    if (!ensureWriteAccess()) return;

    setRowLoading(`staff-toggle-${row.id}`);
    try {
      const up = await supabase
        .from("staff")
        .update({ is_active: !row.is_active })
        .eq("id", row.id)
        .eq("salon_id", salon.id);
      if (up.error) throw up.error;

      showToast(
        "success",
        !row.is_active
          ? tr("admin.messages.employeeShown", "Employee is now visible.")
          : tr("admin.messages.employeeHidden", "Employee is now hidden.")
      );
      await loadAdminData(salon.id);
    } catch (err) {
      showToast("error", tr("admin.errors.toggleEmployeeFailed", "Failed to update employee: {{message}}", { message: err?.message || err }));
    } finally {
      setRowLoading("");
    }
  }

  async function deleteRow() {
    if (!supabase || !salon?.id || !deleteDialog) return;
    if (!ensureWriteAccess()) return;

    setDeleteLoading(true);
    try {
      if (deleteDialog.type === "service") {
        const del = await supabase.from("services").delete().eq("id", deleteDialog.row.id).eq("salon_id", salon.id);
        if (del.error) throw del.error;
        showToast("success", tr("admin.messages.serviceDeleted", "Service deleted."));
      } else {
        const del = await supabase.from("staff").delete().eq("id", deleteDialog.row.id).eq("salon_id", salon.id);
        if (del.error) throw del.error;
        showToast("success", tr("admin.messages.employeeDeleted", "Employee deleted."));
      }

      setDeleteDialog(null);
      await loadAdminData(salon.id);
    } catch (err) {
      showToast("error", tr("admin.errors.deleteFailed", "Delete failed: {{message}}", { message: err?.message || err }));
    } finally {
      setDeleteLoading(false);
    }
  }

  function toggleAssign(serviceId) {
    setAssignDraft((prev) => {
      if (prev.includes(serviceId)) return prev.filter((x) => x !== serviceId);
      return [...prev, serviceId];
    });
  }

  function selectAllAssign() {
    setAssignDraft(services.filter((x) => x.is_active).map((x) => x.id));
  }

  function clearAllAssign() {
    setAssignDraft([]);
  }

  async function saveAssignments() {
    if (!supabase || !salon?.id || !assignStaffId) return;
    if (!ensureWriteAccess()) return;

    setSaveAssignLoading(true);
    try {
      const currentRows = staffServices.filter((x) => x.staff_id === assignStaffId);
      const currentSet = new Set(currentRows.map((x) => x.service_id));
      const nextSet = new Set(assignDraft);

      const toDelete = Array.from(currentSet).filter((x) => !nextSet.has(x));
      const toInsert = Array.from(nextSet).filter((x) => !currentSet.has(x));

      if (toDelete.length > 0) {
        const del = await supabase
          .from("staff_services")
          .delete()
          .eq("salon_id", salon.id)
          .eq("staff_id", assignStaffId)
          .in("service_id", toDelete);
        if (del.error) throw del.error;
      }

      if (toInsert.length > 0) {
        const payload = toInsert.map((service_id) => ({
          salon_id: salon.id,
          staff_id: assignStaffId,
          service_id,
        }));
        const ins = await supabase.from("staff_services").upsert(payload, { onConflict: "staff_id,service_id" });
        if (ins.error) throw ins.error;
      }

      showToast("success", tr("admin.messages.staffAssignmentsSaved", "Service assignments saved for employee."));
      await loadAdminData(salon.id);
    } catch (err) {
      showToast("error", tr("admin.errors.saveAssignmentsFailed", "Failed to save assignments: {{message}}", { message: err?.message || err }));
    } finally {
      setSaveAssignLoading(false);
    }
  }

  function toggleServiceAssignEditor(serviceId) {
    if (!serviceId) return;
    if (serviceAssignOpenId === serviceId) {
      setServiceAssignOpenId("");
      setServiceAssignDraft([]);
      return;
    }
    const assignedIds = staffServices
      .filter((row) => row.service_id === serviceId)
      .map((row) => row.staff_id);
    setServiceAssignOpenId(serviceId);
    setServiceAssignDraft(assignedIds);
  }

  function toggleServiceAssignStaff(staffId) {
    setServiceAssignDraft((prev) => {
      if (prev.includes(staffId)) return prev.filter((x) => x !== staffId);
      return [...prev, staffId];
    });
  }

  function selectAllServiceAssignees() {
    const activeStaffIds = staff.filter((row) => row.is_active).map((row) => row.id);
    setServiceAssignDraft(activeStaffIds);
  }

  function clearServiceAssignees() {
    setServiceAssignDraft([]);
  }

  async function saveServiceAssignments(serviceId) {
    if (!supabase || !salon?.id || !serviceId) return;
    if (!ensureWriteAccess()) return;

    setServiceAssignSavingId(serviceId);
    try {
      const currentRows = staffServices.filter((row) => row.service_id === serviceId);
      const currentSet = new Set(currentRows.map((row) => row.staff_id));
      const nextSet = new Set(serviceAssignDraft);

      const toDelete = Array.from(currentSet).filter((staffId) => !nextSet.has(staffId));
      const toInsert = Array.from(nextSet).filter((staffId) => !currentSet.has(staffId));

      if (toDelete.length > 0) {
        const del = await supabase
          .from("staff_services")
          .delete()
          .eq("salon_id", salon.id)
          .eq("service_id", serviceId)
          .in("staff_id", toDelete);
        if (del.error) throw del.error;
      }

      if (toInsert.length > 0) {
        const payload = toInsert.map((staff_id) => ({
          salon_id: salon.id,
          staff_id,
          service_id: serviceId,
        }));
        const ins = await supabase.from("staff_services").upsert(payload, { onConflict: "staff_id,service_id" });
        if (ins.error) throw ins.error;
      }

      showToast("success", tr("admin.messages.serviceAssigneesSaved", "Assigned employees saved for this service."));
      await loadAdminData(salon.id);
      setServiceAssignOpenId("");
      setServiceAssignDraft([]);
    } catch (err) {
      showToast("error", tr("admin.errors.saveServiceAssignmentsFailed", "Failed to save service assignments: {{message}}", { message: err?.message || err }));
    } finally {
      setServiceAssignSavingId("");
    }
  }

  function exportCsv() {
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

    const rows = bookings.map((b) => [
      b.id,
      b.customer_name,
      b.customer_phone,
      servicesById[b.service_id]?.name || "",
      staffById[b.staff_id]?.name || "",
      b.appointment_start,
      b.appointment_end,
      b.status,
      b.notes || "",
    ]);

    const csv = [headers.map(csvEscape).join(","), ...rows.map((row) => row.map(csvEscape).join(","))].join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookings-${slug}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("success", tr("admin.messages.csvDownloaded", "CSV downloaded."));
  }

  async function copyBookingLink() {
    if (!bookingPageUrl || copyingLink) return;
    setCopyingLink(true);
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(bookingPageUrl);
      } else {
        const el = document.createElement("textarea");
        el.value = bookingPageUrl;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      showToast("success", tr("admin.messages.bookingLinkCopied", "Booking link copied."));
    } catch (err) {
      showToast("error", tr("admin.errors.copyLinkFailed", "Failed to copy link: {{message}}", { message: err?.message || err }));
    } finally {
      setCopyingLink(false);
    }
  }

  async function startMonthlySubscriptionCheckout() {
    if (!salon?.id || !salon?.slug) return;

    setCheckoutLoading(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const encodedSlug = encodeURIComponent(salon.slug);
      const successUrl = `${origin}/s/${encodedSlug}/admin/billing?checkout=success`;
      const cancelUrl = `${origin}/s/${encodedSlug}/admin/billing?checkout=cancel`;

      const checkoutUrl = await createCountryCheckout({
        salonId: salon.id,
        planType: checkoutPlanType,
        successUrl,
        cancelUrl,
      });

      if (typeof window !== "undefined") {
        window.location.href = checkoutUrl;
      }
    } catch (err) {
      showToast("error", tr("admin.errors.openCheckoutFailed", "Failed to open subscription checkout: {{message}}", { message: err?.message || err }));
    } finally {
      setCheckoutLoading(false);
    }
  }

  if (loading) {
    return (
      <PageShell title={t("admin.manageSalon")} subtitle={t("common.loading")}>
        <Card>
          <Skeleton className="skeleton-line" />
          <Skeleton className="skeleton-line short" />
          <Skeleton className="skeleton-cover" />
        </Card>
      </PageShell>
    );
  }

  if (!salon) {
    return (
      <PageShell title={t("admin.manageSalon")} subtitle={t("booking.linkUnavailableText")}>
        <Card>
          <p className="muted">{t("booking.linkUnavailableText")}</p>
          <Button as={Link} to="/explore" variant="secondary">
            {t("booking.backToExplore")}
          </Button>
        </Card>
      </PageShell>
    );
  }

  const activeSectionLabel = t(ADMIN_SIDEBAR_ITEMS.find((x) => x.key === activeSection)?.labelKey || "admin.sections.dashboard");

  return (
    <PageShell
      title={`${t("admin.manage")} ${salon.name}`}
      subtitle={t("admin.dailyOpsSubtitle")}
      mobileMenuDisabled
      right={
        <Button as={Link} variant="secondary" to={`/s/${salon.slug}`}>
          {t("admin.openBookingPage")}
        </Button>
      }
    >
      {!unlocked ? (
        <Card>
          <form
            className="admin-lock"
            onSubmit={(e) => {
              e.preventDefault();
              if (adminPass === salon.admin_passcode) {
                setUnlocked(true);
                showToast("success", t("admin.messages.unlocked"));
              } else {
                showToast("error", t("admin.errors.invalidPasscode"));
              }
            }}
          >
            <TextInput label={t("admin.passcodeLabel")} value={adminPass} onChange={(e) => setAdminPass(e.target.value)} />
            <Button type="submit">{t("admin.login")}</Button>
          </form>
        </Card>
      ) : (
        <BillingGate salon={salon} module={activeSection}>
        <>
          {writeLocked ? (
            <Card className="billing-lock-banner">
              <div className="row-actions space-between" style={{ alignItems: "center" }}>
                <div>
                  <h4>{t("admin.accountInactiveTitle")}</h4>
                  <p className="muted">{salonAccess.lockMessage}</p>
                </div>
                <Button
                  variant="primary"
                  onClick={() => {
                    goToSection("billing");
                  }}
                >
                  {t("billingGate.openBilling")}
                </Button>
              </div>
            </Card>
          ) : null}

          <div className="admin-mobile-nav">
            <div className="admin-mobile-nav-head">
              <div className="admin-mobile-nav-copy">
                <small>{t("admin.manageSalon")}</small>
                <b>{activeSectionLabel}</b>
              </div>
              <button
                type="button"
                className="admin-mobile-nav-toggle"
                onClick={() => setMobileNavOpen((v) => !v)}
                aria-expanded={mobileNavOpen}
                aria-controls="admin-mobile-drawer"
              >
                {mobileNavOpen ? "✕" : "☰"}
              </button>
            </div>
          </div>

          <MobileDrawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} id="admin-mobile-drawer" title={salon.name}>
            <div className="admin-mobile-drawer-links">
              {ADMIN_SIDEBAR_ITEMS.map((tab) => (
                <Button
                  key={`mobile-${tab.key}`}
                  type="button"
                  variant={activeSection === tab.key ? "primary" : "ghost"}
                  className="admin-mobile-link-btn"
                  onClick={() => goToSection(tab.key, true)}
                >
                  {t(tab.labelKey)}
                </Button>
              ))}
              <Button as={Link} variant="secondary" to={`/s/${salon.slug}`} onClick={() => setMobileNavOpen(false)}>
                {t("admin.openBookingPage")}
              </Button>
            </div>
          </MobileDrawer>

          <Card className="admin-topbar">
            <div>
              <div className="row-actions" style={{ alignItems: "center" }}>
                <h3>{salon.name}</h3>
                <Badge variant={salonAccess.badgeVariant}>
                  {salonAccess.badgeLabel}
                </Badge>
              </div>
              <p className="muted">{t("admin.topbarSubtitle")}</p>
            </div>
            <div className="row-actions">
              <Button variant="secondary" onClick={() => loadAdminData(salon.id)}>
                {bookingsLoading ? t("admin.refreshing") : t("common.refresh")}
              </Button>
              <Button variant="secondary" onClick={exportCsv}>
                {t("admin.exportCsv")}
              </Button>
            </div>
          </Card>

          <div className="admin-layout">
            <aside className="admin-sidebar">
              <div className="settings-tabs-wrap admin-tabs-sticky admin-enterprise-sidebar">
                {ADMIN_SIDEBAR_ITEMS.map((tab) => (
                  <Button
                    key={tab.key}
                    type="button"
                    variant={activeSection === tab.key ? "primary" : "ghost"}
                    onClick={() => goToSection(tab.key)}
                    className="admin-sidebar-item"
                  >
                    {t(tab.labelKey)}
                  </Button>
                ))}
              </div>
            </aside>

            <div className="admin-content">
              {activeSection === "dashboard" ? (
                <div className="admin-dashboard-shell">
                  <Card className="enterprise-period-card">
                    <div className="enterprise-card-head">
                      <h4>{tr("admin.analytics.periodTitle", "Analytics period")}</h4>
                      <Badge variant="neutral">{analytics.periodLabel}</Badge>
                    </div>
                    <div className="analytics-period-control">
                      <label htmlFor="analytics-period">{tr("admin.analytics.selectPeriod", "Select period")}</label>
                      <select
                        id="analytics-period"
                        className="input"
                        value={analyticsPeriod}
                        onChange={(e) => setAnalyticsPeriod(e.target.value)}
                      >
                        <option value="last30">{tr("admin.analytics.last30Days", "Last 30 days")}</option>
                        {analyticsMonthOptions.map((row) => (
                          <option key={row.value} value={row.value}>
                            {row.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </Card>

                  <section className="enterprise-summary-grid">
                    <Card className="enterprise-summary-card">
                      <span>{tr("admin.kpis.todayRevenue", "Today revenue")}</span>
                      <strong>{formatMoney(analytics.todayRevenue)}</strong>
                    </Card>
                    <Card className="enterprise-summary-card">
                      <span>{tr("admin.kpis.monthRevenue", "This month revenue")}</span>
                      <strong>{formatMoney(analytics.monthRevenue)}</strong>
                    </Card>
                    <Card className="enterprise-summary-card">
                      <span>{tr("admin.kpis.todayBookings", "Total bookings today")}</span>
                      <strong>{analytics.totalBookingsToday}</strong>
                    </Card>
                    <Card className="enterprise-summary-card">
                      <span>{tr("admin.kpis.activeEmployees", "Active employees")}</span>
                      <strong>{analytics.activeEmployees}</strong>
                    </Card>
                  </section>

                  <Card className="enterprise-chart-card">
                    <div className="enterprise-card-head">
                      <h4>{tr("admin.analytics.revenueByPeriod", "Revenue by period")}</h4>
                      <Badge variant="neutral">{analytics.periodLabel}</Badge>
                    </div>
                    <div className="revenue-chart-wrap">
                      <svg
                        viewBox={`0 0 ${analytics.chartWidth} ${analytics.chartHeight}`}
                        className="revenue-chart-svg"
                        role="img"
                        aria-label={tr("admin.analytics.revenueChart", "Revenue chart")}
                      >
                        {[0, 1, 2, 3, 4].map((idx) => {
                          const y =
                            analytics.padY +
                            ((analytics.chartHeight - analytics.padY * 2) / 4) * idx;
                          return (
                            <line
                              key={`grid-${idx}`}
                              x1={analytics.padX}
                              y1={y}
                              x2={analytics.chartWidth - analytics.padX}
                              y2={y}
                              className="chart-grid-line"
                            />
                          );
                        })}
                        {analytics.areaPath ? <path d={analytics.areaPath} className="chart-area" /> : null}
                        <polyline points={analytics.polylinePoints} className="chart-line" />
                      </svg>
                      <div className="chart-axis-row">
                        <span>{analytics.revenueSeries[0]?.key || ""}</span>
                        <span>{analytics.revenueSeries[analytics.revenueSeries.length - 1]?.key || ""}</span>
                      </div>
                    </div>
                  </Card>

                  <div className="enterprise-two-col">
                    <Card className="enterprise-table-card">
                      <div className="enterprise-card-head">
                        <h4>{tr("admin.analytics.employeePerformance", "Employee performance")}</h4>
                      </div>
                      <div className="table-scroll">
                        <table className="enterprise-table">
                          <thead>
                            <tr>
                              <th>{tr("admin.analytics.employeeName", "Employee name")}</th>
                              <th>{tr("admin.analytics.bookings", "Bookings")}</th>
                              <th>{tr("admin.analytics.revenue", "Revenue")}</th>
                              <th>{tr("admin.analytics.utilization", "Utilization %")}</th>
                              <th>{tr("admin.analytics.rating", "Rating")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analytics.employeesPerformance.length === 0 ? (
                              <tr>
                                <td colSpan={5}>{tr("admin.common.noData", "No data.")}</td>
                              </tr>
                            ) : (
                              analytics.employeesPerformance.map((row) => (
                                <tr key={row.id}>
                                  <td>{row.name}</td>
                                  <td>{row.bookings}</td>
                                  <td>{formatMoney(row.revenue)}</td>
                                  <td>{row.utilization.toFixed(0)}%</td>
                                  <td>{row.rating}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </Card>

                    <Card className="enterprise-pie-card">
                      <div className="enterprise-card-head">
                        <h4>{tr("admin.analytics.servicesRevenueDistribution", "Revenue split by services")}</h4>
                      </div>
                      <div className="services-pie-wrap">
                        <div className="services-pie" style={{ background: analytics.pieGradient }} />
                        <div className="services-pie-legend">
                          {analytics.pieSegments.length === 0 ? (
                            <p className="muted">{tr("admin.analytics.noConfirmedRevenueData", "No confirmed revenue data.")}</p>
                          ) : (
                            analytics.pieSegments.map((item) => (
                              <div key={item.name} className="legend-row">
                                <span className="legend-dot" style={{ background: item.color }} />
                                <span>{item.name}</span>
                                <b>{item.pct.toFixed(0)}%</b>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              ) : null}

              {activeSection === "bookings" ? (
                <>
                  <Card className="admin-onboarding-card">
                    <div className="admin-onboarding-grid">
                      <section className="admin-checklist-block">
                        <h4>{tr("admin.quickStartTitle", "Quick setup checklist")}</h4>
                        <div className="admin-checklist">
                          {onboardingChecklist.map((item) => (
                            <div key={item.key} className={`admin-checklist-item ${item.done ? "done" : ""}`}>
                              <span>{item.done ? "✅" : "⬜"}</span>
                              <b>{item.label}</b>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section className="admin-share-block">
                        <h4>{tr("admin.share.title", "Share booking link")}</h4>
                        <input className="input" value={bookingPageUrl} readOnly />
                        <div className="row-actions">
                          <Button variant="secondary" onClick={copyBookingLink} disabled={copyingLink || !bookingPageUrl}>
                            {copyingLink
                              ? tr("admin.share.copying", "Copying...")
                              : tr("admin.share.copyBookingLink", "Copy booking link")}
                          </Button>
                          {shareBookingWhatsappHref ? (
                            <Button as="a" variant="primary" href={shareBookingWhatsappHref} target="_blank" rel="noreferrer">
                              {tr("admin.share.shareWhatsapp", "Share on WhatsApp")}
                            </Button>
                          ) : (
                            <Button variant="ghost" disabled>
                              {tr("admin.share.shareWhatsapp", "Share on WhatsApp")}
                            </Button>
                          )}
                        </div>

                        <div className="admin-wa-status">
                          <Badge variant="neutral">
                            {tr("admin.share.whatsappAutoOff", "Automatic WhatsApp notifications are currently disabled")}
                          </Badge>
                        </div>

                        <div className="admin-pricing-mini">
                          <b>{tr("admin.pricingMini.title", "CareChair pricing")}</b>
                          <p>{tr("admin.pricingMini.setup", "Setup fee: $300–$500 (non-refundable)")}</p>
                          <p>{tr("admin.pricingMini.monthly", "Monthly subscription: $30–$50")}</p>
                          <p>{tr("admin.pricingMini.cancel", "Cancel anytime. Access remains active until end of paid period.")}</p>
                        </div>
                      </section>
                    </div>
                  </Card>

                  <section className="kpi-grid">
                    <Card className="kpi-card">
                      <span>{tr("admin.kpis.todayRequests", "Today's requests")}</span>
                      <strong>{kpis.today}</strong>
                    </Card>
                    <Card className="kpi-card">
                      <span>{tr("admin.kpis.pending", "Pending confirmation")}</span>
                      <strong>{kpis.pending}</strong>
                    </Card>
                    <Card className="kpi-card">
                      <span>{tr("admin.kpis.confirmed", "Confirmed")}</span>
                      <strong>{kpis.confirmed}</strong>
                    </Card>
                    <Card className="kpi-card">
                      <span>{tr("admin.kpis.cancelled", "Cancelled")}</span>
                      <strong>{kpis.cancelled}</strong>
                    </Card>
                  </section>

                  <Card>
                    <div className="bookings-filters-grid">
                      <div className="bookings-filter-group">
                        <b>{tr("admin.filters.status", "Status")}</b>
                        <div className="tabs-inline">
                          <Button
                            type="button"
                            variant={bookingStatusFilter === "all" ? "primary" : "ghost"}
                            onClick={() => setBookingStatusFilter("all")}
                          >
                            {tr("admin.filters.all", "All")}
                          </Button>
                          <Button
                            type="button"
                            variant={bookingStatusFilter === "pending" ? "primary" : "ghost"}
                            onClick={() => setBookingStatusFilter("pending")}
                          >
                            {tr("booking.status.pending", "Pending")}
                          </Button>
                          <Button
                            type="button"
                            variant={bookingStatusFilter === "confirmed" ? "primary" : "ghost"}
                            onClick={() => setBookingStatusFilter("confirmed")}
                          >
                            {tr("booking.status.confirmed", "Confirmed")}
                          </Button>
                          <Button
                            type="button"
                            variant={bookingStatusFilter === "cancelled" ? "primary" : "ghost"}
                            onClick={() => setBookingStatusFilter("cancelled")}
                          >
                            {tr("booking.status.cancelled", "Cancelled")}
                          </Button>
                        </div>
                      </div>

                      <div className="bookings-filter-group">
                        <b>{tr("admin.filters.date", "Date")}</b>
                        <div className="tabs-inline">
                          <Button
                            type="button"
                            variant={bookingDateFilter === "today" ? "primary" : "ghost"}
                            onClick={() => setBookingDateFilter("today")}
                          >
                            {tr("admin.filters.today", "Today")}
                          </Button>
                          <Button
                            type="button"
                            variant={bookingDateFilter === "week" ? "primary" : "ghost"}
                            onClick={() => setBookingDateFilter("week")}
                          >
                            {tr("admin.filters.thisWeek", "This week")}
                          </Button>
                          <Button
                            type="button"
                            variant={bookingDateFilter === "all" ? "primary" : "ghost"}
                            onClick={() => setBookingDateFilter("all")}
                          >
                            {tr("admin.filters.all", "All")}
                          </Button>
                        </div>
                      </div>

                      <TextInput
                        label={tr("admin.filters.searchByNamePhone", "Search by name or phone")}
                        value={bookingSearch}
                        onChange={(e) => setBookingSearch(e.target.value)}
                        placeholder={tr("admin.filters.searchPlaceholder", "Example: 07xxxxxxxxx")}
                      />
                    </div>

                    <div className="calendar-list">
                      {bookingsLoading ? (
                        <div className="bookings-stack">
                          {Array.from({ length: 4 }).map((_, idx) => (
                            <Card className="booking-card" key={`bsk-${idx}`}>
                              <Skeleton className="skeleton-line" />
                              <Skeleton className="skeleton-line short" />
                            </Card>
                          ))}
                        </div>
                      ) : groupedBookings.length === 0 ? (
                        <div className="empty-box">{tr("admin.bookings.noFilteredBookings", "No bookings match current filters.")}</div>
                      ) : (
                        groupedBookings.map((group) => (
                          <div className="date-group panel-soft" key={group.key}>
                            <div className="date-header">
                              <h5>{group.label}</h5>
                              <span>{tr("admin.bookings.bookingsCount", "{{count}} bookings", { count: group.items.length })}</span>
                            </div>
                            <div className="bookings-stack">
                              {group.items.map((row) => {
                                const loadingRow = Boolean(statusUpdating[row.id]);
                                const target = statusUpdating[row.id];
                                return (
                                  <article key={row.id} className="booking-card panel-soft compact-booking-card">
                                    <div className="booking-top">
                                      <div>
                                        <h6>{row.customer_name}</h6>
                                        <p>{row.customer_phone}</p>
                                      </div>
                                      <Badge variant={row.status || "pending"}>
                                        {statusLabels[row.status] || tr("admin.common.unknown", "Unknown")}
                                      </Badge>
                                    </div>
                                    <div className="booking-info">
                                      <p>
                                        <b>{tr("admin.bookings.service", "Service")}:</b> {servicesById[row.service_id]?.name || "-"}
                                      </p>
                                      <p>
                                        <b>{tr("admin.bookings.employee", "Employee")}:</b> {staffById[row.staff_id]?.name || "-"}
                                      </p>
                                      <p>
                                        <b>{tr("admin.bookings.time", "Time")}:</b> {formatTime(row.appointment_start)}
                                      </p>
                                    </div>
                                    <div className="booking-actions sticky">
                                      <Button
                                        type="button"
                                        variant="success"
                                        disabled={loadingRow || writeLocked}
                                        onClick={() => updateBookingStatus(row.id, "confirmed")}
                                      >
                                        {target === "confirmed"
                                          ? tr("admin.bookings.accepting", "Accepting...")
                                          : tr("admin.bookings.accept", "Accept")}
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="danger"
                                        disabled={loadingRow || writeLocked}
                                        onClick={() => updateBookingStatus(row.id, "cancelled")}
                                      >
                                        {target === "cancelled"
                                          ? tr("admin.bookings.rejecting", "Rejecting...")
                                          : tr("admin.bookings.reject", "Reject")}
                                      </Button>
                                    </div>
                                  </article>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {hasMoreBookings ? (
                      <div className="row-actions center" style={{ marginTop: 10 }}>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setVisibleBookingCount((prev) => prev + BOOKINGS_PAGE_SIZE)}
                        >
                          {tr("admin.bookings.loadMore", "Load more")}
                        </Button>
                      </div>
                    ) : null}
                  </Card>
                </>
              ) : null}

              {activeSection === "clients" ? (
                <Card>
                  <div className="enterprise-card-head">
                    <h3>{tr("admin.clients.title", "Clients")}</h3>
                    <div className="row-actions">
                      <Badge variant="neutral">{analytics.periodLabel}</Badge>
                      <Badge variant="neutral">
                        {tr("admin.clients.count", "{{count}} clients", { count: analytics.clients.length })}
                      </Badge>
                    </div>
                  </div>
                  <div className="table-scroll">
                    <table className="enterprise-table">
                      <thead>
                        <tr>
                          <th>{tr("admin.clients.name", "Name")}</th>
                          <th>{tr("admin.clients.phone", "Phone")}</th>
                          <th>{tr("admin.clients.bookings", "Bookings")}</th>
                          <th>{tr("admin.clients.revenue", "Revenue")}</th>
                          <th>{tr("admin.clients.lastVisit", "Last visit")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.clients.length === 0 ? (
                          <tr>
                            <td colSpan={5}>{tr("admin.clients.empty", "No clients yet.")}</td>
                          </tr>
                        ) : (
                          analytics.clients.map((client) => (
                            <tr key={`${client.phone}-${client.name}`}>
                              <td>{client.name}</td>
                              <td>{client.phone}</td>
                              <td>{client.bookings}</td>
                              <td>{formatMoney(client.revenue)}</td>
                              <td>{formatDate(client.lastVisit)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ) : null}

              {activeSection === "reports" ? (
                <div className="admin-dashboard-shell">
                  <Card className="enterprise-period-card">
                    <div className="enterprise-card-head">
                      <h4>{tr("admin.analytics.periodTitle", "Analytics period")}</h4>
                      <Badge variant="neutral">{analytics.periodLabel}</Badge>
                    </div>
                    <div className="analytics-period-control">
                      <label htmlFor="analytics-period-reports">{tr("admin.analytics.selectPeriod", "Select period")}</label>
                      <select
                        id="analytics-period-reports"
                        className="input"
                        value={analyticsPeriod}
                        onChange={(e) => setAnalyticsPeriod(e.target.value)}
                      >
                        <option value="last30">{tr("admin.analytics.last30Days", "Last 30 days")}</option>
                        {analyticsMonthOptions.map((row) => (
                          <option key={`reports-${row.value}`} value={row.value}>
                            {row.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </Card>

                  <Card className="enterprise-chart-card">
                    <div className="enterprise-card-head">
                      <h3>{tr("admin.reports.revenueTitle", "Revenue reports")}</h3>
                      <Button variant="secondary" onClick={exportCsv}>
                        {t("admin.exportCsv")}
                      </Button>
                    </div>
                    <div className="revenue-chart-wrap">
                      <svg
                        viewBox={`0 0 ${analytics.chartWidth} ${analytics.chartHeight}`}
                        className="revenue-chart-svg"
                        role="img"
                        aria-label={tr("admin.analytics.revenueChart", "Revenue chart")}
                      >
                        {[0, 1, 2, 3, 4].map((idx) => {
                          const y =
                            analytics.padY +
                            ((analytics.chartHeight - analytics.padY * 2) / 4) * idx;
                          return (
                            <line
                              key={`reports-grid-${idx}`}
                              x1={analytics.padX}
                              y1={y}
                              x2={analytics.chartWidth - analytics.padX}
                              y2={y}
                              className="chart-grid-line"
                            />
                          );
                        })}
                        {analytics.areaPath ? <path d={analytics.areaPath} className="chart-area" /> : null}
                        <polyline points={analytics.polylinePoints} className="chart-line" />
                      </svg>
                    </div>
                  </Card>

                    <Card className="enterprise-pie-card">
                      <div className="enterprise-card-head">
                        <h4>{tr("admin.analytics.servicesRevenueDistribution", "Revenue split by services")}</h4>
                        <Badge variant="neutral">{formatMoney(analytics.totalServiceRevenue)}</Badge>
                      </div>
                    <div className="services-pie-wrap">
                      <div className="services-pie" style={{ background: analytics.pieGradient }} />
                      <div className="services-pie-legend">
                        {analytics.pieSegments.length === 0 ? (
                          <p className="muted">{tr("admin.analytics.noConfirmedRevenueData", "No confirmed revenue data.")}</p>
                        ) : (
                          analytics.pieSegments.map((item) => (
                            <div key={`rep-${item.name}`} className="legend-row">
                              <span className="legend-dot" style={{ background: item.color }} />
                              <span>{item.name}</span>
                              <b>{formatMoney(item.revenue)}</b>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </Card>
                </div>
              ) : null}

              {activeSection === "calendar" ? (
                <CalendarPage
                  salon={salon}
                  writeLocked={writeLocked}
                  t={t}
                  showToast={showToast}
                  onChanged={async () => {
                    if (salon?.id) {
                      await loadAdminData(salon.id);
                    }
                  }}
                />
              ) : null}

              {activeSection === "billing" ? (
                <Card>
                  <div className="enterprise-card-head">
                    <h3>{tr("admin.billing.title", "Billing & activation")}</h3>
                    <Badge variant={salonAccess.badgeVariant}>{salonAccess.badgeLabel}</Badge>
                  </div>

                  {writeLocked ? (
                    <div className="billing-warning-box">
                      <b>{tr("admin.billing.accountInactive", "Your account is not active")}</b>
                      <p>{salonAccess.lockMessage}</p>
                    </div>
                  ) : null}

                  <div className="billing-stats-grid">
                    <div className="billing-stat-card">
                      <span>{tr("admin.billing.setupFee", "Setup fee")}</span>
                      <b>{salon.setup_paid ? tr("admin.billing.paid", "Paid") : tr("admin.billing.unpaid", "Unpaid")}</b>
                    </div>
                    <div className="billing-stat-card">
                      <span>{tr("admin.billing.monthlySubscription", "Monthly subscription")}</span>
                      <b>{getBillingStatusLabel(salon.subscription_status || salon.billing_status)}</b>
                    </div>
                    <div className="billing-stat-card">
                      <span>{tr("admin.billing.subscriptionEnds", "Subscription ends")}</span>
                      <b>{formatBillingDate(salon.current_period_end)}</b>
                    </div>
                    <div className="billing-stat-card">
                      <span>{tr("admin.billing.trial", "Trial period")}</span>
                      <b>
                        {salon.trial_end_at || salon.trial_end
                          ? `${trialRemaining || tr("admin.billing.running", "Running")} (${tr(
                              "admin.billing.ends",
                              "Ends {{date}}",
                              { date: formatBillingDate(salon.trial_end_at || salon.trial_end) }
                            )})`
                          : tr("admin.billing.disabled", "Disabled")}
                      </b>
                    </div>
                    <div className="billing-stat-card">
                      <span>{tr("admin.billing.countryCurrency", "Country / currency")}</span>
                      <b>{String(salon.country_code || "IQ")} / {String(salon.currency_code || "USD")}</b>
                    </div>
                  </div>

                  {!salon.setup_paid ? (
                    <div className="billing-warning-box">
                      <b>{tr("admin.billing.setupViaAdmin", "Setup fee is paid via admin payment link")}</b>
                      {setupPaymentLink ? (
                        <a href={setupPaymentLink} target="_blank" rel="noreferrer">
                          {tr("admin.billing.openSetupLink", "Open setup payment link")}
                        </a>
                      ) : (
                        <p className="muted">{tr("admin.billing.contactAdminSetup", "Contact admin to get manual setup payment link.")}</p>
                      )}
                    </div>
                  ) : null}

                  <div className="row-actions" style={{ marginTop: 10 }}>
                    <SelectInput label={tr("admin.billing.plan", "Plan")} value={checkoutPlanType} onChange={(e) => setCheckoutPlanType(e.target.value)}>
                      <option value="basic">Basic</option>
                      <option value="pro">Pro</option>
                    </SelectInput>
                    <Button
                      type="button"
                      onClick={startMonthlySubscriptionCheckout}
                      disabled={checkoutLoading}
                    >
                      {checkoutLoading ? t("common.loading") : t("admin.activateMonthlySubscription")}
                    </Button>
                  </div>
                </Card>
              ) : null}

              {activeSection === "settings" ? (
                <Card>
                  <div className="settings-tabs-wrap">
                    {SETTINGS_SECTIONS.map((tab) => (
                      <Button
                        key={tab.key}
                        type="button"
                        variant={activeSettingsSection === tab.key ? "primary" : "ghost"}
                        onClick={() => {
                          setActiveSettingsSection(tab.key);
                          scrollTopInstant();
                        }}
                      >
                        {t(tab.labelKey)}
                      </Button>
                    ))}
                  </div>
                </Card>
              ) : null}

          {activeSection === "schedules" ? (
            <Card>
              <h3>{tr("admin.schedules.title", "Employee schedules")}</h3>
              <fieldset disabled={writeLocked} className="locked-fieldset">
              <SelectInput
                label={tr("admin.schedules.selectEmployee", "Select employee")}
                value={scheduleStaffId}
                onChange={(e) => setScheduleStaffId(e.target.value)}
              >
                <option value="">{tr("admin.common.select", "Select")}</option>
                {staff.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </SelectInput>

              <div className="hours-list" style={{ marginTop: 12 }}>
                {localizedDays.map((day) => {
                  const row = scheduleDraft[day.index] || {
                    is_off: false,
                    open_time: "10:00",
                    close_time: "20:00",
                    break_start: "",
                    break_end: "",
                  };
                  return (
                    <div className="day-row" key={day.index}>
                      <div className="day-name">{day.label}</div>
                      <label className="day-toggle">
                        <input
                          type="checkbox"
                          checked={row.is_off}
                          onChange={(e) =>
                            setScheduleDraft((prev) => ({
                              ...prev,
                              [day.index]: { ...row, is_off: e.target.checked },
                            }))
                          }
                          disabled={!scheduleStaffId}
                        />
                        <span>{tr("admin.schedules.dayOff", "Day off")}</span>
                      </label>
                      <div className="time-grid">
                        <input
                          type="time"
                          className="input"
                          value={row.start_time}
                          disabled={row.is_off || !scheduleStaffId}
                          onChange={(e) =>
                            setScheduleDraft((prev) => ({
                              ...prev,
                              [day.index]: { ...row, start_time: e.target.value },
                            }))
                          }
                        />
                        <input
                          type="time"
                          className="input"
                          value={row.end_time}
                          disabled={row.is_off || !scheduleStaffId}
                          onChange={(e) =>
                            setScheduleDraft((prev) => ({
                              ...prev,
                              [day.index]: { ...row, end_time: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div className="time-grid">
                        <input
                          type="time"
                          className="input"
                          value={row.break_start || ""}
                          disabled={row.is_off || !scheduleStaffId}
                          onChange={(e) =>
                            setScheduleDraft((prev) => ({
                              ...prev,
                              [day.index]: { ...row, break_start: e.target.value },
                            }))
                          }
                        />
                        <input
                          type="time"
                          className="input"
                          value={row.break_end || ""}
                          disabled={row.is_off || !scheduleStaffId}
                          onChange={(e) =>
                            setScheduleDraft((prev) => ({
                              ...prev,
                              [day.index]: { ...row, break_end: e.target.value },
                            }))
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button type="button" onClick={saveEmployeeSchedule} disabled={saveScheduleLoading || !scheduleStaffId}>
                {saveScheduleLoading ? tr("admin.common.saving", "Saving...") : tr("admin.schedules.save", "Save schedule")}
              </Button>

              <Card className="panel-soft" style={{ marginTop: 14 }}>
                <h4>{tr("admin.schedules.timeOffTitle", "Time off & exceptions")}</h4>
                <div className="grid two" style={{ marginTop: 8 }}>
                  <input
                    type="datetime-local"
                    className="input"
                    value={timeOffForm.start_at}
                    onChange={(e) => setTimeOffForm((p) => ({ ...p, start_at: e.target.value }))}
                    disabled={!scheduleStaffId}
                  />
                  <input
                    type="datetime-local"
                    className="input"
                    value={timeOffForm.end_at}
                    onChange={(e) => setTimeOffForm((p) => ({ ...p, end_at: e.target.value }))}
                    disabled={!scheduleStaffId}
                  />
                  <input
                    className="input"
                    placeholder={tr("admin.schedules.timeOffReasonOptional", "Time off reason (optional)")}
                    value={timeOffForm.reason}
                    onChange={(e) => setTimeOffForm((p) => ({ ...p, reason: e.target.value }))}
                    disabled={!scheduleStaffId}
                  />
                  <Button type="button" onClick={addEmployeeTimeOff} disabled={!scheduleStaffId || savingTimeOff}>
                    {savingTimeOff ? tr("admin.common.adding", "Adding...") : tr("admin.schedules.addTimeOff", "Add time off")}
                  </Button>
                </div>

                <div className="settings-list" style={{ marginTop: 10 }}>
                  {selectedStaffTimeOff.length === 0 ? (
                    <div className="empty-box">{tr("admin.schedules.noTimeOff", "No time off records.")}</div>
                  ) : (
                    selectedStaffTimeOff.map((row) => (
                      <div key={row.id} className="settings-row">
                        <div>
                          <b>{formatDate(row.start_at)} - {formatDate(row.end_at)}</b>
                          <p className="muted">{row.reason || tr("admin.common.noNote", "No note")}</p>
                        </div>
                        <Button
                          type="button"
                          variant="danger"
                          disabled={deletingTimeOffId === row.id}
                          onClick={() => deleteEmployeeTimeOff(row.id)}
                        >
                          {deletingTimeOffId === row.id ? "..." : tr("common.delete", "Delete")}
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </Card>
              </fieldset>
            </Card>
          ) : null}

          {activeSection === "services" ? (
            <Card>
              <h3>{tr("admin.services.title", "Services management")}</h3>
              <fieldset disabled={writeLocked} className="locked-fieldset">
              <div className="grid service-form-grid">
                <input
                  className="input"
                  placeholder={tr("admin.services.serviceName", "Service name")}
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm((p) => ({ ...p, name: e.target.value }))}
                />
                <input
                  className="input"
                  type="number"
                  placeholder={tr("admin.services.durationPlaceholder", "Duration: 45")}
                  value={serviceForm.duration_minutes}
                  onChange={(e) => setServiceForm((p) => ({ ...p, duration_minutes: e.target.value }))}
                />
                <input
                  className="input"
                  type="number"
                  placeholder={tr("admin.services.pricePlaceholder", "Price: 20000")}
                  value={serviceForm.price}
                  onChange={(e) => setServiceForm((p) => ({ ...p, price: e.target.value }))}
                />
                <input
                  className="input"
                  type="number"
                  placeholder={tr("admin.services.sortPlaceholder", "Rank: 10")}
                  value={serviceForm.sort_order}
                  onChange={(e) => setServiceForm((p) => ({ ...p, sort_order: e.target.value }))}
                />
                <Button type="button" variant="secondary" onClick={addService} disabled={addingService}>
                  {addingService ? tr("admin.common.adding", "Adding...") : tr("admin.services.addService", "Add service")}
                </Button>
              </div>

              <div className="settings-list">
                {services.length === 0 ? (
                  <div className="empty-box">{tr("admin.services.noServices", "No services.")}</div>
                ) : (
                  services.map((row) => {
                    const isEditing = editingServiceId === row.id;
                    const assignedStaff = staffByServiceId[row.id] || [];
                    const inlineAssignOpen = serviceAssignOpenId === row.id;
                    const inlineAssignSaving = serviceAssignSavingId === row.id;
                    return (
                      <div className="settings-row" key={row.id}>
                        {isEditing ? (
                          <div className="edit-box">
                            <input
                              className="input"
                              value={editingService.name}
                              onChange={(e) => setEditingService((p) => ({ ...p, name: e.target.value }))}
                            />
                            <div className="grid three">
                              <input
                                className="input"
                                type="number"
                                value={editingService.duration_minutes}
                                onChange={(e) =>
                                  setEditingService((p) => ({ ...p, duration_minutes: e.target.value }))
                                }
                              />
                              <input
                                className="input"
                                type="number"
                                value={editingService.price}
                                onChange={(e) => setEditingService((p) => ({ ...p, price: e.target.value }))}
                              />
                              <input
                                className="input"
                                type="number"
                                value={editingService.sort_order}
                                onChange={(e) => setEditingService((p) => ({ ...p, sort_order: e.target.value }))}
                              />
                            </div>
                            <label className="switch-pill">
                              <input
                                type="checkbox"
                                checked={editingService.is_active}
                                onChange={(e) =>
                                  setEditingService((p) => ({ ...p, is_active: e.target.checked }))
                                }
                              />
                              {editingService.is_active ? tr("admin.common.visible", "Visible") : tr("admin.common.hidden", "Hidden")}
                            </label>
                            <div className="row-actions service-row-actions">
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => saveServiceEdit(row.id)}
                                disabled={rowLoading === `service-save-${row.id}`}
                              >
                                {rowLoading === `service-save-${row.id}` ? tr("admin.common.saving", "Saving...") : tr("common.save", "Save")}
                              </Button>
                              <Button type="button" variant="ghost" onClick={() => setEditingServiceId("")}>
                                {tr("common.cancel", "Cancel")}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="service-row-content">
                              <div className="service-row-main">
                                <SafeImage
                                  src={row.image_url || getServiceImage(row.name)}
                                  alt={row.name}
                                  className="service-row-image"
                                  fallbackIcon="✨"
                                />
                                <div>
                                  <b>{row.name}</b>
                                  <p className="muted">
                                    {tr("admin.services.durationValue", "{{count}} min", { count: row.duration_minutes })} •{" "}
                                    {formatMoney(row.price)}
                                  </p>
                                  <p className="muted">
                                    {row.is_active ? tr("admin.common.visible", "Visible") : tr("admin.common.hidden", "Hidden")} • {tr("admin.common.sortOrder", "Sort order")}: {row.sort_order || 0}
                                  </p>
                                </div>
                              </div>

                              <div className="service-staff-meta">
                                <small className="muted">{tr("admin.services.providedBy", "Provided by:")}</small>
                                <div className="service-staff-badges">
                                  {assignedStaff.length === 0 ? (
                                    <span className="service-staff-empty">{tr("admin.services.noAssignment", "No assignment")}</span>
                                  ) : (
                                    assignedStaff.map((member) => (
                                      <span className="service-staff-badge" key={`${row.id}-${member.id}`}>
                                        {member.name}
                                      </span>
                                    ))
                                  )}
                                </div>
                              </div>

                              {inlineAssignOpen ? (
                                <div className="service-assign-inline">
                                  <div className="row-actions" style={{ marginTop: 0 }}>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      onClick={selectAllServiceAssignees}
                                      disabled={inlineAssignSaving || staff.length === 0}
                                    >
                                      {tr("admin.common.selectAll", "Select all")}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      onClick={clearServiceAssignees}
                                      disabled={inlineAssignSaving}
                                    >
                                      {tr("admin.common.clearAll", "Clear all")}
                                    </Button>
                                    <Button
                                      type="button"
                                      onClick={() => saveServiceAssignments(row.id)}
                                      disabled={inlineAssignSaving}
                                    >
                                      {inlineAssignSaving ? tr("admin.common.saving", "Saving...") : tr("admin.services.saveAssignment", "Save assignment")}
                                    </Button>
                                  </div>
                                  {staff.length === 0 ? (
                                    <div className="empty-box" style={{ marginTop: 8 }}>
                                      {tr("admin.services.addStaffFirst", "Add employees first to assign this service.")}
                                    </div>
                                  ) : (
                                    <div className="service-assign-grid">
                                      {staff.map((member) => {
                                        const checked = serviceAssignDraft.includes(member.id);
                                        return (
                                          <label
                                            key={`${row.id}-${member.id}`}
                                            className={`service-assign-chip${member.is_active ? "" : " off"}`}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={checked}
                                              disabled={!member.is_active || inlineAssignSaving}
                                              onChange={() => toggleServiceAssignStaff(member.id)}
                                            />
                                            <span>{member.name}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              ) : null}
                            </div>
                            <div className="row-actions service-row-actions">
                              <label
                                className={`upload-mini ${
                                  serviceImageLoading[row.id] || serviceImageCompressing[row.id] ? "disabled" : ""
                                }`}
                              >
                                {serviceImageCompressing[row.id] ? (
                                  <>
                                    <span className="inline-spinner" />
                                    {tr("admin.media.compressingImage", "Compressing image...")}
                                  </>
                                ) : serviceImageLoading[row.id] ? (
                                  <>
                                    <span className="inline-spinner" />
                                    {tr("admin.media.uploadingImage", "Uploading image...")}
                                  </>
                                ) : (
                                  tr("admin.media.uploadImage", "Upload image")
                                )}
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/webp"
                                  disabled={Boolean(serviceImageLoading[row.id] || serviceImageCompressing[row.id])}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleServiceImageUpload(row.id, file);
                                    e.target.value = "";
                                  }}
                                />
                              </label>
                              <Button type="button" variant="secondary" onClick={() => startEditService(row)}>
                                {tr("common.edit", "Edit")}
                              </Button>
                              <Button
                                type="button"
                                variant={inlineAssignOpen ? "primary" : "ghost"}
                                onClick={() => toggleServiceAssignEditor(row.id)}
                              >
                                {inlineAssignOpen ? tr("admin.services.closeAssign", "Close assignment") : tr("admin.services.assignEmployees", "Assign employees")}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => toggleServiceActive(row)}
                                disabled={rowLoading === `service-toggle-${row.id}`}
                              >
                                {rowLoading === `service-toggle-${row.id}`
                                  ? tr("common.loading", "Loading...")
                                  : row.is_active
                                    ? tr("common.hide", "Hide")
                                    : tr("common.show", "Show")}
                              </Button>
                              <Button type="button" variant="danger" onClick={() => setDeleteDialog({ type: "service", row })}>
                                {tr("common.delete", "Delete")}
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              </fieldset>
            </Card>
          ) : null}

          {activeSection === "employees" ? (
            <Card>
              <h3>{tr("admin.employees.title", "Employees management")}</h3>
              <fieldset disabled={writeLocked} className="locked-fieldset">
              <div className="grid two">
                <input
                  className="input"
                  placeholder={tr("admin.employees.name", "Employee name")}
                  value={staffForm.name}
                  onChange={(e) => setStaffForm((p) => ({ ...p, name: e.target.value }))}
                />
                <input
                  className="input"
                  type="number"
                  placeholder={tr("admin.common.sortOrder", "Sort order")}
                  value={staffForm.sort_order}
                  onChange={(e) => setStaffForm((p) => ({ ...p, sort_order: e.target.value }))}
                />
                <input
                  className="input"
                  placeholder={tr("admin.employees.photoUrlOptional", "Photo URL (optional)")}
                  value={staffForm.photo_url}
                  onChange={(e) => setStaffForm((p) => ({ ...p, photo_url: e.target.value }))}
                />
                <Button type="button" variant="secondary" onClick={addStaff} disabled={addingStaff}>
                  {addingStaff ? tr("admin.common.adding", "Adding...") : tr("common.add", "Add")}
                </Button>
              </div>

              <div className="settings-list">
                {staff.length === 0 ? (
                  <div className="empty-box">{tr("admin.employees.noEmployees", "No employees.")}</div>
                ) : (
                  staff.map((row) => {
                    const isEditing = editingStaffId === row.id;
                    return (
                      <div className="settings-row" key={row.id}>
                        {isEditing ? (
                          <div className="edit-box">
                            <input
                              className="input"
                              value={editingStaff.name}
                              onChange={(e) => setEditingStaff((p) => ({ ...p, name: e.target.value }))}
                            />
                            <input
                              className="input"
                              type="number"
                              value={editingStaff.sort_order}
                              onChange={(e) => setEditingStaff((p) => ({ ...p, sort_order: e.target.value }))}
                            />
                            <input
                              className="input"
                              placeholder={tr("admin.employees.photoUrlOptional", "Photo URL (optional)")}
                              value={editingStaff.photo_url}
                              onChange={(e) => setEditingStaff((p) => ({ ...p, photo_url: e.target.value }))}
                            />
                            <label className="switch-pill">
                              <input
                                type="checkbox"
                                checked={editingStaff.is_active}
                                onChange={(e) =>
                                  setEditingStaff((p) => ({ ...p, is_active: e.target.checked }))
                                }
                              />
                              {editingStaff.is_active ? tr("admin.common.visible", "Visible") : tr("admin.common.hidden", "Hidden")}
                            </label>
                            <div className="row-actions">
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => saveStaffEdit(row.id)}
                                disabled={rowLoading === `staff-save-${row.id}`}
                              >
                                {rowLoading === `staff-save-${row.id}` ? tr("admin.common.saving", "Saving...") : tr("common.save", "Save")}
                              </Button>
                              <Button type="button" variant="ghost" onClick={() => setEditingStaffId("")}>
                                {tr("common.cancel", "Cancel")}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="staff-row-main">
                              <SafeImage
                                src={row.photo_url || getDefaultAvatar(row.id || row.name)}
                                alt={row.name}
                                className="staff-row-avatar"
                                fallbackText={getInitials(row.name)}
                              />
                              <div>
                                <b>{row.name}</b>
                                <p className="muted">
                                  {row.is_active ? tr("admin.common.visible", "Visible") : tr("admin.common.hidden", "Hidden")} • {tr("admin.common.sortOrder", "Sort order")}: {row.sort_order || 0}
                                </p>
                              </div>
                            </div>
                            <div className="row-actions">
                              <label
                                className={`upload-mini ${
                                  staffImageLoading[row.id] || staffImageCompressing[row.id] ? "disabled" : ""
                                }`}
                              >
                                {staffImageCompressing[row.id] ? (
                                  <>
                                    <span className="inline-spinner" />
                                    {tr("admin.media.compressingImage", "Compressing image...")}
                                  </>
                                ) : staffImageLoading[row.id] ? (
                                  <>
                                    <span className="inline-spinner" />
                                    {tr("admin.media.uploadingImage", "Uploading image...")}
                                  </>
                                ) : (
                                  tr("admin.media.uploadImage", "Upload image")
                                )}
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/webp"
                                  disabled={Boolean(staffImageLoading[row.id] || staffImageCompressing[row.id])}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleStaffImageUpload(row.id, file);
                                    e.target.value = "";
                                  }}
                                />
                              </label>
                              <Button type="button" variant="secondary" onClick={() => startEditStaff(row)}>
                                {tr("common.edit", "Edit")}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => toggleStaffActive(row)}
                                disabled={rowLoading === `staff-toggle-${row.id}`}
                              >
                                {rowLoading === `staff-toggle-${row.id}`
                                  ? tr("common.loading", "Loading...")
                                  : row.is_active
                                    ? tr("common.hide", "Hide")
                                    : tr("common.show", "Show")}
                              </Button>
                              <Button type="button" variant="danger" onClick={() => setDeleteDialog({ type: "staff", row })}>
                                {tr("common.delete", "Delete")}
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              </fieldset>
            </Card>
          ) : null}

              {activeSection === "commissions" ? (
                <Card>
                  <h3>{tr("admin.sections.commissions", "Commissions")}</h3>
                  <p className="muted">
                    {tr(
                      "admin.commissionsComingSoon",
                      "This section is phase-ready. Database foundation is prepared for staff commissions per service/booking."
                    )}
                  </p>
                </Card>
              ) : null}

              {activeSection === "expenses" ? (
                <Card>
                  <h3>{tr("admin.sections.expenses", "Expenses")}</h3>
                  <p className="muted">
                    {tr(
                      "admin.expensesComingSoon",
                      "This section is phase-ready. Database foundation is prepared for daily expenses and net-profit analysis."
                    )}
                  </p>
                </Card>
              ) : null}

          {activeSection === "settings" && activeSettingsSection === "assign" ? (
            <Card>
              <h3>{t("admin.settings.assign")}</h3>
              <fieldset disabled={writeLocked} className="locked-fieldset">
              <SelectInput label={tr("admin.schedules.selectEmployee", "Select employee")} value={assignStaffId} onChange={(e) => setAssignStaffId(e.target.value)}>
                <option value="">{tr("admin.common.select", "Select")}</option>
                {staff.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </SelectInput>

              <div className="row-actions" style={{ marginTop: 10 }}>
                <Button type="button" variant="ghost" onClick={selectAllAssign} disabled={!assignStaffId}>
                  {tr("admin.common.selectAll", "Select all")}
                </Button>
                <Button type="button" variant="ghost" onClick={clearAllAssign} disabled={!assignStaffId}>
                  {tr("admin.common.clearAll", "Clear all")}
                </Button>
                <Button type="button" onClick={saveAssignments} disabled={!assignStaffId || saveAssignLoading}>
                  {saveAssignLoading ? tr("admin.common.saving", "Saving...") : tr("admin.services.saveAssignment", "Save assignment")}
                </Button>
              </div>

              {services.length === 0 ? (
                <div className="empty-box" style={{ marginTop: 10 }}>
                  {tr("admin.settings.noServicesToAssign", "No services to assign.")}
                </div>
              ) : (
                <div className="assign-grid">
                  {services.map((srv) => {
                    const checked = assignDraft.includes(srv.id);
                    const disabled = !srv.is_active;
                    const currentlyAssigned = assignmentSet.has(`${assignStaffId}:${srv.id}`);
                    return (
                      <div className={`assign-item${disabled ? " off" : ""}`} key={srv.id}>
                        <label>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled || !assignStaffId || saveAssignLoading}
                            onChange={() => toggleAssign(srv.id)}
                          />
                          {srv.name}
                        </label>
                        <small>
                          {tr("admin.services.durationValue", "{{count}} min", { count: srv.duration_minutes })} •{" "}
                          {formatMoney(srv.price)}
                          {disabled
                            ? ` • ${tr("admin.services.inactive", "Inactive")}`
                            : currentlyAssigned
                              ? ` • ${tr("admin.services.assigned", "Assigned")}`
                              : ""}
                        </small>
                      </div>
                    );
                  })}
                </div>
              )}
              </fieldset>
            </Card>
          ) : null}

          {activeSection === "settings" && activeSettingsSection === "media" ? (
            <Card>
              <h3>{t("admin.settings.media")}</h3>
              <p className="muted">{tr("admin.media.subtitle", "Upload salon media. If empty, default images are used automatically.")}</p>
              <fieldset disabled={writeLocked} className="locked-fieldset">

              <div className="media-admin-grid">
                <div className="media-block">
                  <h4>{tr("admin.media.logo", "Salon logo")}</h4>
                  <SafeImage
                    src={mediaDraft.logo_url}
                    alt={tr("admin.media.logoAlt", "Salon logo")}
                    className="logo-preview"
                    fallbackText={getInitials(salon.name)}
                  />
                  <label className={`upload-main ${logoUploading || logoCompressing ? "disabled" : ""}`}>
                    {logoCompressing ? (
                      <>
                        <span className="inline-spinner" />
                        {tr("admin.media.compressingImage", "Compressing image...")}
                      </>
                    ) : logoUploading ? (
                      <>
                        <span className="inline-spinner" />
                        {tr("admin.media.uploadingLogo", "Uploading logo...")}
                      </>
                    ) : (
                      tr("admin.media.uploadOrReplaceLogo", "Upload/replace logo")
                    )}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={logoUploading || logoCompressing}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleLogoUpload(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>

                <div className="media-block">
                  <h4>{tr("admin.media.cover", "Cover image")}</h4>
                  <SafeImage src={mediaDraft.cover_image_url} alt={tr("admin.media.coverAlt", "Salon cover")} className="cover-preview" fallbackIcon="✨" />
                  <label className={`upload-main ${coverUploading || coverCompressing ? "disabled" : ""}`}>
                    {coverCompressing ? (
                      <>
                        <span className="inline-spinner" />
                        {tr("admin.media.compressingImage", "Compressing image...")}
                      </>
                    ) : coverUploading ? (
                      <>
                        <span className="inline-spinner" />
                        {tr("admin.media.uploadingCover", "Uploading cover...")}
                      </>
                    ) : (
                      tr("admin.media.uploadOrReplaceCover", "Upload/replace cover")
                    )}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={coverUploading || coverCompressing}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleCoverUpload(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>

                <div className="media-block">
                  <h4>{tr("admin.media.galleryMax", "Gallery (max 8)")}</h4>
                  <label className={`upload-main ${galleryUploading || galleryCompressing ? "disabled" : ""}`}>
                    {galleryCompressing ? (
                      <>
                        <span className="inline-spinner" />
                        {tr("admin.media.compressingImage", "Compressing image...")}
                      </>
                    ) : galleryUploading ? (
                      <>
                        <span className="inline-spinner" />
                        {tr("admin.media.uploadingImages", "Uploading images...")}
                      </>
                    ) : (
                      tr("admin.media.uploadGalleryImages", "Upload gallery images")
                    )}
                    <input
                      type="file"
                      multiple
                      accept="image/png,image/jpeg,image/webp"
                      disabled={galleryUploading || galleryCompressing}
                      onChange={(e) => {
                        handleGalleryUpload(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>

                  {galleryUrls.length === 0 ? (
                    <div className="empty-box">{tr("admin.media.noUploadedImages", "No uploaded images yet.")}</div>
                  ) : (
                    <div className="admin-gallery-grid">
                      {galleryUrls.map((url) => (
                        <div className="admin-gallery-item" key={url}>
                          <SafeImage src={url} alt={tr("admin.media.galleryImageAlt", "Gallery image")} className="admin-gallery-thumb" fallbackIcon="🌸" />
                          <Button
                            type="button"
                            variant="danger"
                            className="admin-gallery-delete"
                            disabled={galleryDeletingUrl === url}
                            onClick={() => handleRemoveGalleryImage(url)}
                          >
                            {galleryDeletingUrl === url ? "..." : tr("common.delete", "Delete")}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid">
                <TextInput
                  label={tr("admin.media.logoUrlOptional", "Salon logo URL (optional)")}
                  value={mediaDraft.logo_url}
                  onChange={(e) => setMediaDraft((p) => ({ ...p, logo_url: e.target.value }))}
                  placeholder="https://..."
                />
                <TextInput
                  label={tr("admin.media.coverUrlOptional", "Cover image URL (optional)")}
                  value={mediaDraft.cover_image_url}
                  onChange={(e) => setMediaDraft((p) => ({ ...p, cover_image_url: e.target.value }))}
                  placeholder="https://..."
                />
                <label className="field">
                  <span>{tr("admin.media.galleryUrlsLineByLine", "Gallery URLs (one URL per line)")}</span>
                  <textarea
                    className="input textarea"
                    value={mediaDraft.gallery_text}
                    onChange={(e) => setMediaDraft((p) => ({ ...p, gallery_text: e.target.value }))}
                    placeholder={"https://...\nhttps://..."}
                  />
                </label>
              </div>

              <Button type="button" onClick={saveSalonMedia} disabled={savingMedia}>
                {savingMedia ? tr("admin.common.saving", "Saving...") : tr("admin.media.saveImages", "Save images")}
              </Button>
              </fieldset>
            </Card>
          ) : null}

          {activeSection === "settings" && activeSettingsSection === "salon" ? (
            <Card>
              <h3>{t("admin.settings.salon")}</h3>
              <p className="muted">{tr("admin.settings.salonSubtitle", "Control salon visibility and general status.")}</p>
              <fieldset disabled={writeLocked} className="locked-fieldset">

              <div className="stack-sm" style={{ marginTop: 10 }}>
                <label className="field">
                  <span>{tr("admin.settings.bookingMode", "Booking mode")}</span>
                  <select
                    className="input"
                    value={salon.booking_mode || "choose_employee"}
                    onChange={(e) => saveSalonFlags({ booking_mode: e.target.value })}
                    disabled={savingSalonFlags}
                  >
                    <option value="choose_employee">{tr("admin.settings.bookingModeChoose", "Customer chooses employee")}</option>
                    <option value="auto_assign">{tr("admin.settings.bookingModeAuto", "Auto assign by availability")}</option>
                  </select>
                </label>
                <label className="field">
                  <span>{tr("admin.settings.defaultLanguage", "Default language")}</span>
                  <select
                    className="input"
                    value={salon.language_default || "en"}
                    onChange={(e) => saveSalonFlags({ language_default: e.target.value })}
                    disabled={savingSalonFlags}
                  >
                    <option value="ar">العربية</option>
                    <option value="en">English</option>
                    <option value="cs">Čeština</option>
                    <option value="ru">Русский</option>
                  </select>
                </label>
                <label className="switch-pill">
                  <input
                    type="checkbox"
                    checked={Boolean(salon.is_listed)}
                    onChange={(e) => saveSalonFlags({ is_listed: e.target.checked })}
                    disabled={savingSalonFlags}
                  />
                  {tr("admin.settings.showInExplore", "Show in explore page")}
                </label>
              </div>

              <div className="admin-share-block" style={{ marginTop: 12 }}>
                <h4>{tr("admin.share.directBookingLink", "Direct booking link")}</h4>
                <input className="input" value={bookingPageUrl} readOnly />
                <div className="row-actions">
                  <Button variant="secondary" onClick={copyBookingLink} disabled={copyingLink || !bookingPageUrl}>
                    {copyingLink ? tr("admin.share.copying", "Copying...") : tr("admin.share.copyBookingLink", "Copy booking link")}
                  </Button>
                  {shareBookingWhatsappHref ? (
                    <Button as="a" variant="primary" href={shareBookingWhatsappHref} target="_blank" rel="noreferrer">
                      {tr("admin.share.shareWhatsapp", "Share on WhatsApp")}
                    </Button>
                  ) : null}
                </div>
              </div>
              </fieldset>
            </Card>
          ) : null}
            </div>
          </div>
        </>
        </BillingGate>
      )}

      <ConfirmModal
        open={Boolean(deleteDialog)}
        title={deleteDialog?.type === "service" ? tr("admin.services.deleteService", "Delete service") : tr("admin.employees.deleteEmployee", "Delete employee")}
        text={
          deleteDialog?.type === "service"
            ? tr("admin.services.deleteServiceConfirm", "Service {{name}} and all assignments will be deleted. Are you sure?", {
                name: deleteDialog?.row?.name || "",
              })
            : tr("admin.employees.deleteEmployeeConfirm", "{{name}} and all assignments will be deleted. Are you sure?", {
                name: deleteDialog?.row?.name || "",
              })
        }
        loading={deleteLoading}
        onCancel={() => !deleteLoading && setDeleteDialog(null)}
        onConfirm={deleteRow}
        confirmText={tr("admin.common.confirmDelete", "Yes, delete")}
      />

      <Toast {...toast} />
    </PageShell>
  );
}
