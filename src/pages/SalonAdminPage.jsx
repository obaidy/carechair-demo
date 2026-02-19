import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PageShell from "../components/PageShell";
import SafeImage from "../components/SafeImage";
import Toast from "../components/Toast";
import { Badge, Button, Card, ConfirmModal, SelectInput, Skeleton, TextInput } from "../components/ui";
import {
  csvEscape,
  DAYS,
  DEFAULT_HOURS,
  formatCurrencyIQD,
  formatDate,
  formatDateKey,
  formatTime,
  isValidE164WithoutPlus,
  normalizeIraqiPhone,
  sortByOrderThenName,
  STATUS_LABELS,
} from "../lib/utils";
import { toHHMM } from "../lib/slots";
import { useToast } from "../lib/useToast";
import { supabase } from "../lib/supabase";
import { compressImage } from "../lib/imageCompression";
import { formatWhatsappAppointment, sendWhatsappTemplate } from "../lib/whatsapp";
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
  { key: "dashboard", label: "لوحة التحكم" },
  { key: "bookings", label: "الحجوزات" },
  { key: "calendar", label: "التقويم" },
  { key: "clients", label: "العملاء" },
  { key: "employees", label: "الموظفين" },
  { key: "services", label: "الخدمات" },
  { key: "schedules", label: "جداول الدوام" },
  { key: "commissions", label: "العمولات" },
  { key: "expenses", label: "المصروفات" },
  { key: "reports", label: "التقارير" },
  { key: "settings", label: "الإعدادات" },
];

const SETTINGS_SECTIONS = [
  { key: "assign", label: "ربط الخدمات بالموظفين" },
  { key: "media", label: "الصور" },
  { key: "salon", label: "إعدادات المركز" },
];

const CHART_COLORS = ["#2563eb", "#1d4ed8", "#0ea5e9", "#14b8a6", "#22c55e", "#f59e0b", "#ef4444"];

function formatMonthLabel(monthKey) {
  const [year, month] = String(monthKey || "")
    .split("-")
    .map((x) => Number(x));
  if (!year || !month) return monthKey;
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat("ar-IQ", { month: "long", year: "numeric" }).format(date);
}

const BOOKINGS_PAGE_SIZE = 20;

export default function SalonAdminPage() {
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

  const [serviceForm, setServiceForm] = useState({ name: "", duration_minutes: "45", price: "20000", sort_order: "0" });
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
    async function loadSalon() {
      if (!supabase) {
        setLoading(false);
        showToast("error", "إعدادات Supabase غير مكتملة.");
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
        showToast("error", `تعذر تحميل الصالون: ${err?.message || err}`);
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
      for (const day of DAYS) {
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
      showToast("error", `تعذر تحميل بيانات الإدارة: ${err?.message || err}`);
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
    for (const day of DAYS) {
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
        map[row.staff_id] = { staff: { id: row.staff_id, name: "غير محدد" }, items: [] };
      }
      map[row.staff_id].items.push(row);
    }
    return Object.values(map).sort((a, b) => String(a.staff?.name || "").localeCompare(String(b.staff?.name || ""), "ar"));
  }, [bookings, calendarDate, staff]);

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
      rows.push({ value: key, label: formatMonthLabel(key) });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return rows.reverse();
  }, [salon?.created_at]);

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
      return { start, end, label: "آخر 30 يوم" };
    }

    const [year, month] = String(analyticsPeriod).split("-").map((x) => Number(x));
    if (!year || !month) {
      const end = new Date(now);
      end.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() + 1);
      const start = new Date(end);
      start.setDate(start.getDate() - 30);
      return { start, end, label: "آخر 30 يوم" };
    }

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    return { start, end, label: formatMonthLabel(analyticsPeriod) };
  }, [analyticsPeriod]);

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

      const serviceName = servicesById[booking.service_id]?.name || "خدمة غير معروفة";
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
          name: b.customer_name || "عميلة",
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
    return `https://wa.me/?text=${encodeURIComponent(`هذا رابط الحجز الخاص بالمركز:\n${bookingPageUrl}`)}`;
  }, [bookingPageUrl]);

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
      { key: "services", label: "إضافة الخدمات", done: hasServices },
      { key: "staff", label: "إضافة الموظفين", done: hasStaff },
      { key: "assign", label: "ربط الخدمات بالموظفين", done: hasAssignments },
      { key: "hours", label: "تحديد ساعات العمل", done: hasHours },
      { key: "media", label: "إضافة صور المركز (اختياري)", done: hasMedia },
    ];
  }, [services, staff, staffServices, hoursDraft, salon?.logo_url, salon?.cover_image_url, galleryUrls.length]);

  const selectedStaffTimeOff = useMemo(
    () =>
      employeeTimeOff
        .filter((row) => row.staff_id === scheduleStaffId)
        .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()),
    [employeeTimeOff, scheduleStaffId]
  );

  function validateImageFile(file) {
    if (!file) {
      showToast("error", "اختاري صورة أولاً.");
      return false;
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      showToast("error", "الملف لازم يكون JPG أو PNG أو WEBP.");
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
      throw new Error("حاوية الصور غير موجودة. شغّل migration التخزين أو أنشئ bucket باسم carechair-media.");
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
      throw new Error(err?.message || "تعذر ضغط الصورة قبل الرفع.");
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
      showToast("success", "تم رفع شعار المركز.");
    } catch (err) {
      showToast("error", `تعذر رفع الشعار بعد الضغط: ${err?.message || err}`);
    } finally {
      setLogoCompressing(false);
      setLogoUploading(false);
    }
  }

  async function handleCoverUpload(file) {
    if (!supabase || !salon?.id) return;
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
      showToast("success", "تم رفع صورة الغلاف.");
    } catch (err) {
      showToast("error", `تعذر رفع صورة الغلاف بعد الضغط: ${err?.message || err}`);
    } finally {
      setCoverCompressing(false);
      setCoverUploading(false);
    }
  }

  async function handleGalleryUpload(fileList) {
    if (!supabase || !salon?.id) return;
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    const current = [...galleryUrls];
    if (current.length >= 8) {
      showToast("error", "وصلتي الحد الأقصى للمعرض (8 صور).");
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
        showToast("error", "ما تم رفع أي صورة.");
        return;
      }

      const next = [...current, ...uploadedUrls].slice(0, 8);
      await saveGalleryUrls(next);
      showToast("success", "تم رفع صور المعرض.");
    } catch (err) {
      showToast("error", `تعذر ضغط/رفع صور المعرض: ${err?.message || err}`);
    } finally {
      setGalleryCompressing(false);
      setGalleryUploading(false);
    }
  }

  async function handleRemoveGalleryImage(url) {
    if (!supabase || !salon?.id) return;

    setGalleryDeletingUrl(url);
    try {
      const next = galleryUrls.filter((x) => x !== url);
      await saveGalleryUrls(next);

      const path = getStoragePathFromPublicUrl(url);
      if (path) {
        await supabase.storage.from(MEDIA_BUCKET).remove([path]);
      }

      showToast("success", "تم حذف الصورة من المعرض.");
    } catch (err) {
      showToast("error", `تعذر حذف الصورة: ${err?.message || err}`);
    } finally {
      setGalleryDeletingUrl("");
    }
  }

  async function handleServiceImageUpload(serviceId, file) {
    if (!supabase || !salon?.id || !serviceId) return;
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
      showToast("success", "تم رفع صورة الخدمة.");
    } catch (err) {
      showToast("error", `تعذر ضغط/رفع صورة الخدمة: ${err?.message || err}`);
    } finally {
      setServiceImageCompressing((prev) => ({ ...prev, [serviceId]: false }));
      setServiceImageLoading((prev) => ({ ...prev, [serviceId]: false }));
    }
  }

  async function handleStaffImageUpload(staffId, file) {
    if (!supabase || !salon?.id || !staffId) return;
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
      showToast("success", "تم رفع صورة الموظف/الموظفة.");
    } catch (err) {
      showToast("error", `تعذر ضغط/رفع صورة الموظف/الموظفة: ${err?.message || err}`);
    } finally {
      setStaffImageCompressing((prev) => ({ ...prev, [staffId]: false }));
      setStaffImageLoading((prev) => ({ ...prev, [staffId]: false }));
    }
  }

  async function updateBookingStatus(id, nextStatus) {
    if (!supabase || !salon?.id || statusUpdating[id]) return;

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
      showToast("success", nextStatus === "confirmed" ? "تم قبول الحجز." : "تم رفض الحجز.");

      const notifyTemplate = nextStatus === "confirmed" ? "booking_confirmed" : "booking_cancelled";
      const serviceName =
        servicesById[res.data.service_id]?.name ||
        servicesById[prev.service_id]?.name ||
        res.data.service ||
        prev.service ||
        "الخدمة";
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
          showToast("error", "تم الحفظ، لكن تعذر إرسال إشعار واتساب.");
        }
      }
    } catch (err) {
      setBookings((p) => p.map((x) => (x.id === id ? prev : x)));
      showToast("error", `تعذر تحديث حالة الحجز: ${err?.message || err}`);
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

    for (const day of DAYS) {
      const row = hoursDraft[day.index];
      if (!row) continue;
      if (!row.is_closed && row.close_time <= row.open_time) {
        showToast("error", `وقت الإغلاق لازم يكون بعد الفتح (${day.label}).`);
        return;
      }
    }

    setSaveHoursLoading(true);
    try {
      const payload = DAYS.map((day) => {
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

      showToast("success", "تم حفظ ساعات العمل.");
      await loadAdminData(salon.id);
    } catch (err) {
      showToast("error", `تعذر حفظ ساعات العمل: ${err?.message || err}`);
    } finally {
      setSaveHoursLoading(false);
    }
  }

  async function saveEmployeeSchedule() {
    if (!supabase || !salon?.id || !scheduleStaffId) return;

    for (const day of DAYS) {
      const row = scheduleDraft[day.index];
      if (!row) continue;
      if (!row.is_off && row.end_time <= row.start_time) {
        showToast("error", `وقت الإغلاق لازم يكون بعد الفتح (${day.label}).`);
        return;
      }
      if (row.break_start && row.break_end && row.break_end <= row.break_start) {
        showToast("error", `فترة الاستراحة غير صحيحة (${day.label}).`);
        return;
      }
    }

    setSaveScheduleLoading(true);
    try {
      const payload = DAYS.map((day) => {
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

      showToast("success", "تم حفظ جدول دوام الموظف.");
      await loadAdminData(salon.id);
    } catch (err) {
      showToast("error", `تعذر حفظ جدول الدوام: ${err?.message || err}`);
    } finally {
      setSaveScheduleLoading(false);
    }
  }

  async function addEmployeeTimeOff() {
    if (!supabase || !salon?.id || !scheduleStaffId) return;

    const startAt = timeOffForm.start_at ? new Date(timeOffForm.start_at) : null;
    const endAt = timeOffForm.end_at ? new Date(timeOffForm.end_at) : null;
    if (!startAt || !endAt || Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
      showToast("error", "اختاري فترة إجازة صحيحة.");
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
      showToast("success", "تمت إضافة الإجازة.");
      await loadAdminData(salon.id);
    } catch (err) {
      showToast("error", `تعذر إضافة الإجازة: ${err?.message || err}`);
    } finally {
      setSavingTimeOff(false);
    }
  }

  async function deleteEmployeeTimeOff(rowId) {
    if (!supabase || !salon?.id || !rowId) return;

    setDeletingTimeOffId(rowId);
    try {
      const del = await supabase
        .from("employee_time_off")
        .delete()
        .eq("id", rowId)
        .eq("salon_id", salon.id);
      if (del.error) throw del.error;

      showToast("success", "تم حذف الإجازة.");
      await loadAdminData(salon.id);
    } catch (err) {
      showToast("error", `تعذر حذف الإجازة: ${err?.message || err}`);
    } finally {
      setDeletingTimeOffId("");
    }
  }

  async function saveSalonFlags(patch) {
    if (!supabase || !salon?.id) return;

    const previous = salon;
    const nextSalon = { ...salon, ...patch };
    setSalon(nextSalon);
    setSavingSalonFlags(true);
    try {
      const up = await supabase.from("salons").update(patch).eq("id", salon.id).select("*").single();
      if (up.error) throw up.error;

      setSalon(up.data);
      showToast("success", "تم حفظ إعدادات ظهور الصالون.");
    } catch (err) {
      setSalon(previous);
      showToast("error", `تعذر حفظ الإعدادات: ${err?.message || err}`);
    } finally {
      setSavingSalonFlags(false);
    }
  }

  async function saveSalonMedia() {
    if (!supabase || !salon?.id) return;

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
      showToast("success", "تم حفظ صور المركز.");
    } catch (err) {
      showToast("error", `تعذر حفظ الصور: ${err?.message || err}`);
    } finally {
      setSavingMedia(false);
    }
  }

  async function addService() {
    if (!supabase || !salon?.id) return;

    const name = serviceForm.name.trim();
    const duration = Number(serviceForm.duration_minutes);
    const price = Number(serviceForm.price);
    const sort = Number(serviceForm.sort_order);

    if (name.length < 2) return showToast("error", "اكتبي اسم خدمة صحيح.");
    if (!Number.isFinite(duration) || duration <= 0) return showToast("error", "المدة لازم تكون رقم صحيح.");
    if (!Number.isFinite(price) || price < 0) return showToast("error", "السعر لازم يكون رقم صحيح.");
    if (!Number.isFinite(sort)) return showToast("error", "الترتيب لازم يكون رقم.");

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
      setServiceForm({ name: "", duration_minutes: "45", price: "20000", sort_order: "0" });
      showToast("success", "تمت إضافة الخدمة.");
      await loadAdminData(salon.id);
    } catch (err) {
      showToast("error", `تعذر إضافة الخدمة: ${err?.message || err}`);
    } finally {
      setAddingService(false);
    }
  }

  async function addStaff() {
    if (!supabase || !salon?.id) return;

    const name = staffForm.name.trim();
    const sort = Number(staffForm.sort_order);
    if (name.length < 2) return showToast("error", "اكتبي اسم موظفة صحيح.");
    if (!Number.isFinite(sort)) return showToast("error", "الترتيب لازم يكون رقم.");

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
      showToast("success", "تمت إضافة الموظفة.");
      await loadAdminData(salon.id);
    } catch (err) {
      showToast("error", `تعذر إضافة الموظفة: ${err?.message || err}`);
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

    const patch = {
      name: editingService.name.trim(),
      duration_minutes: Number(editingService.duration_minutes),
      price: Number(editingService.price),
      sort_order: Number(editingService.sort_order),
      is_active: Boolean(editingService.is_active),
    };

    if (patch.name.length < 2) return showToast("error", "اكتبي اسم خدمة صحيح.");
    if (!Number.isFinite(patch.duration_minutes) || patch.duration_minutes <= 0) return showToast("error", "المدة غير صحيحة.");
    if (!Number.isFinite(patch.price) || patch.price < 0) return showToast("error", "السعر غير صحيح.");
    if (!Number.isFinite(patch.sort_order)) return showToast("error", "الترتيب غير صحيح.");

    setRowLoading(`service-save-${id}`);
    try {
      const up = await supabase.from("services").update(patch).eq("id", id).eq("salon_id", salon.id);
      if (up.error) throw up.error;

      setEditingServiceId("");
      showToast("success", "تم تعديل الخدمة.");
      await loadAdminData(salon.id);
    } catch (err) {
      showToast("error", `تعذر تعديل الخدمة: ${err?.message || err}`);
    } finally {
      setRowLoading("");
    }
  }

  async function saveStaffEdit(id) {
    if (!supabase || !salon?.id) return;

    const patch = {
      name: editingStaff.name.trim(),
      sort_order: Number(editingStaff.sort_order),
      is_active: Boolean(editingStaff.is_active),
      photo_url: editingStaff.photo_url.trim() || null,
    };

    if (patch.name.length < 2) return showToast("error", "اكتبي اسم موظفة صحيح.");
    if (!Number.isFinite(patch.sort_order)) return showToast("error", "الترتيب غير صحيح.");

    setRowLoading(`staff-save-${id}`);
    try {
      const up = await supabase.from("staff").update(patch).eq("id", id).eq("salon_id", salon.id);
      if (up.error) throw up.error;

      setEditingStaffId("");
      showToast("success", "تم تعديل الموظفة.");
      await loadAdminData(salon.id);
    } catch (err) {
      showToast("error", `تعذر تعديل الموظفة: ${err?.message || err}`);
    } finally {
      setRowLoading("");
    }
  }

  async function toggleServiceActive(row) {
    if (!supabase || !salon?.id) return;

    setRowLoading(`service-toggle-${row.id}`);
    try {
      const up = await supabase
        .from("services")
        .update({ is_active: !row.is_active })
        .eq("id", row.id)
        .eq("salon_id", salon.id);
      if (up.error) throw up.error;

      showToast("success", !row.is_active ? "تم إظهار الخدمة." : "تم إخفاء الخدمة.");
      await loadAdminData(salon.id);
    } catch (err) {
      showToast("error", `تعذر تحديث الخدمة: ${err?.message || err}`);
    } finally {
      setRowLoading("");
    }
  }

  async function toggleStaffActive(row) {
    if (!supabase || !salon?.id) return;

    setRowLoading(`staff-toggle-${row.id}`);
    try {
      const up = await supabase
        .from("staff")
        .update({ is_active: !row.is_active })
        .eq("id", row.id)
        .eq("salon_id", salon.id);
      if (up.error) throw up.error;

      showToast("success", !row.is_active ? "تم إظهار الموظفة." : "تم إخفاء الموظفة.");
      await loadAdminData(salon.id);
    } catch (err) {
      showToast("error", `تعذر تحديث الموظفة: ${err?.message || err}`);
    } finally {
      setRowLoading("");
    }
  }

  async function deleteRow() {
    if (!supabase || !salon?.id || !deleteDialog) return;

    setDeleteLoading(true);
    try {
      if (deleteDialog.type === "service") {
        const del = await supabase.from("services").delete().eq("id", deleteDialog.row.id).eq("salon_id", salon.id);
        if (del.error) throw del.error;
        showToast("success", "تم حذف الخدمة.");
      } else {
        const del = await supabase.from("staff").delete().eq("id", deleteDialog.row.id).eq("salon_id", salon.id);
        if (del.error) throw del.error;
        showToast("success", "تم حذف الموظفة.");
      }

      setDeleteDialog(null);
      await loadAdminData(salon.id);
    } catch (err) {
      showToast("error", `تعذر الحذف: ${err?.message || err}`);
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

      showToast("success", "تم حفظ تعيين الخدمات للموظفة.");
      await loadAdminData(salon.id);
    } catch (err) {
      showToast("error", `تعذر حفظ التعيينات: ${err?.message || err}`);
    } finally {
      setSaveAssignLoading(false);
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
    showToast("success", "تم تنزيل ملف CSV.");
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
      showToast("success", "تم نسخ رابط الحجز.");
    } catch (err) {
      showToast("error", `تعذر نسخ الرابط: ${err?.message || err}`);
    } finally {
      setCopyingLink(false);
    }
  }

  if (loading) {
    return (
      <PageShell title="إدارة الصالون" subtitle="جاري التحميل">
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
      <PageShell title="إدارة الصالون" subtitle="الرابط غير متوفر">
        <Card>
          <p className="muted">هذا الرابط غير متوفر</p>
          <Button as={Link} to="/explore" variant="secondary">
            العودة للاستكشاف
          </Button>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={`إدارة ${salon.name}`}
      subtitle="لوحة تشغيل يومية للمواعيد والخدمات"
      right={
        <Button as={Link} variant="secondary" to={`/s/${salon.slug}`}>
          فتح صفحة الحجز
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
                showToast("success", "تم فتح لوحة الإدارة.");
              } else {
                showToast("error", "رمز الإدارة غير صحيح.");
              }
            }}
          >
            <TextInput label="رمز إدارة الصالون" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} />
            <Button type="submit">دخول</Button>
          </form>
        </Card>
      ) : (
        <>
          <Card className="admin-topbar">
            <div>
              <div className="row-actions" style={{ alignItems: "center" }}>
                <h3>{salon.name}</h3>
                <Badge variant={salon.is_active ? "confirmed" : "cancelled"}>
                  {salon.is_active ? "نشط" : "متوقف"}
                </Badge>
              </div>
              <p className="muted">تحكم بالحجوزات والإعدادات من مكان واحد.</p>
            </div>
            <div className="row-actions">
              <Button variant="secondary" onClick={() => loadAdminData(salon.id)}>
                {bookingsLoading ? "جاري التحديث..." : "تحديث"}
              </Button>
              <Button variant="secondary" onClick={exportCsv}>
                تصدير CSV
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
                    onClick={() => {
                      setActiveSection(tab.key);
                      navigate(`/s/${slug}/admin/${tab.key}`);
                    }}
                    className="admin-sidebar-item"
                  >
                    {tab.label}
                  </Button>
                ))}
              </div>
            </aside>

            <div className="admin-content">
              {activeSection === "dashboard" ? (
                <div className="admin-dashboard-shell">
                  <Card className="enterprise-period-card">
                    <div className="enterprise-card-head">
                      <h4>الفترة التحليلية</h4>
                      <Badge variant="neutral">{analytics.periodLabel}</Badge>
                    </div>
                    <div className="analytics-period-control">
                      <label htmlFor="analytics-period">اختيار الفترة</label>
                      <select
                        id="analytics-period"
                        className="input"
                        value={analyticsPeriod}
                        onChange={(e) => setAnalyticsPeriod(e.target.value)}
                      >
                        <option value="last30">آخر 30 يوم</option>
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
                      <span>إيراد اليوم</span>
                      <strong>{formatCurrencyIQD(analytics.todayRevenue)}</strong>
                    </Card>
                    <Card className="enterprise-summary-card">
                      <span>إيراد هذا الشهر</span>
                      <strong>{formatCurrencyIQD(analytics.monthRevenue)}</strong>
                    </Card>
                    <Card className="enterprise-summary-card">
                      <span>إجمالي حجوزات اليوم</span>
                      <strong>{analytics.totalBookingsToday}</strong>
                    </Card>
                    <Card className="enterprise-summary-card">
                      <span>الموظفون النشطون</span>
                      <strong>{analytics.activeEmployees}</strong>
                    </Card>
                  </section>

                  <Card className="enterprise-chart-card">
                    <div className="enterprise-card-head">
                      <h4>الإيراد حسب الفترة</h4>
                      <Badge variant="neutral">{analytics.periodLabel}</Badge>
                    </div>
                    <div className="revenue-chart-wrap">
                      <svg viewBox={`0 0 ${analytics.chartWidth} ${analytics.chartHeight}`} className="revenue-chart-svg" role="img" aria-label="مخطط الإيراد">
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
                        <h4>أداء الموظفين</h4>
                      </div>
                      <div className="table-scroll">
                        <table className="enterprise-table">
                          <thead>
                            <tr>
                              <th>اسم الموظف</th>
                              <th>الحجوزات</th>
                              <th>الإيراد</th>
                              <th>نسبة الإشغال %</th>
                              <th>التقييم</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analytics.employeesPerformance.length === 0 ? (
                              <tr>
                                <td colSpan={5}>لا توجد بيانات.</td>
                              </tr>
                            ) : (
                              analytics.employeesPerformance.map((row) => (
                                <tr key={row.id}>
                                  <td>{row.name}</td>
                                  <td>{row.bookings}</td>
                                  <td>{formatCurrencyIQD(row.revenue)}</td>
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
                        <h4>توزيع الإيراد حسب الخدمات</h4>
                      </div>
                      <div className="services-pie-wrap">
                        <div className="services-pie" style={{ background: analytics.pieGradient }} />
                        <div className="services-pie-legend">
                          {analytics.pieSegments.length === 0 ? (
                            <p className="muted">لا توجد بيانات إيرادات مؤكدة.</p>
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
                        <h4>دليل تشغيل سريع</h4>
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
                        <h4>مشاركة رابط الحجز</h4>
                        <input className="input" value={bookingPageUrl} readOnly />
                        <div className="row-actions">
                          <Button variant="secondary" onClick={copyBookingLink} disabled={copyingLink || !bookingPageUrl}>
                            {copyingLink ? "جاري النسخ..." : "نسخ رابط الحجز"}
                          </Button>
                          {shareBookingWhatsappHref ? (
                            <Button as="a" variant="primary" href={shareBookingWhatsappHref} target="_blank" rel="noreferrer">
                              مشاركة واتساب
                            </Button>
                          ) : (
                            <Button variant="ghost" disabled>
                              مشاركة واتساب
                            </Button>
                          )}
                        </div>

                        <div className="admin-wa-status">
                          <Badge variant="neutral">إشعارات واتساب التلقائية: غير مفعلة حالياً</Badge>
                        </div>

                        <div className="admin-pricing-mini">
                          <b>تسعير CareChair</b>
                          <p>تجهيز أول مرة: $300–$500 (غير مسترجع)</p>
                          <p>اشتراك شهري: $30–$50</p>
                          <p>إلغاء بأي وقت، والاشتراك يبقى فعال لحد نهاية الشهر المدفوع.</p>
                        </div>
                      </section>
                    </div>
                  </Card>

                  <section className="kpi-grid">
                    <Card className="kpi-card">
                      <span>طلبات اليوم</span>
                      <strong>{kpis.today}</strong>
                    </Card>
                    <Card className="kpi-card">
                      <span>بانتظار التأكيد</span>
                      <strong>{kpis.pending}</strong>
                    </Card>
                    <Card className="kpi-card">
                      <span>مؤكد</span>
                      <strong>{kpis.confirmed}</strong>
                    </Card>
                    <Card className="kpi-card">
                      <span>ملغي</span>
                      <strong>{kpis.cancelled}</strong>
                    </Card>
                  </section>

                  <Card>
                    <div className="bookings-filters-grid">
                      <div className="bookings-filter-group">
                        <b>الحالة</b>
                        <div className="tabs-inline">
                          <Button
                            type="button"
                            variant={bookingStatusFilter === "all" ? "primary" : "ghost"}
                            onClick={() => setBookingStatusFilter("all")}
                          >
                            الكل
                          </Button>
                          <Button
                            type="button"
                            variant={bookingStatusFilter === "pending" ? "primary" : "ghost"}
                            onClick={() => setBookingStatusFilter("pending")}
                          >
                            بانتظار
                          </Button>
                          <Button
                            type="button"
                            variant={bookingStatusFilter === "confirmed" ? "primary" : "ghost"}
                            onClick={() => setBookingStatusFilter("confirmed")}
                          >
                            مؤكد
                          </Button>
                          <Button
                            type="button"
                            variant={bookingStatusFilter === "cancelled" ? "primary" : "ghost"}
                            onClick={() => setBookingStatusFilter("cancelled")}
                          >
                            ملغي
                          </Button>
                        </div>
                      </div>

                      <div className="bookings-filter-group">
                        <b>التاريخ</b>
                        <div className="tabs-inline">
                          <Button
                            type="button"
                            variant={bookingDateFilter === "today" ? "primary" : "ghost"}
                            onClick={() => setBookingDateFilter("today")}
                          >
                            اليوم
                          </Button>
                          <Button
                            type="button"
                            variant={bookingDateFilter === "week" ? "primary" : "ghost"}
                            onClick={() => setBookingDateFilter("week")}
                          >
                            هذا الأسبوع
                          </Button>
                          <Button
                            type="button"
                            variant={bookingDateFilter === "all" ? "primary" : "ghost"}
                            onClick={() => setBookingDateFilter("all")}
                          >
                            الكل
                          </Button>
                        </div>
                      </div>

                      <TextInput
                        label="بحث بالاسم أو الهاتف"
                        value={bookingSearch}
                        onChange={(e) => setBookingSearch(e.target.value)}
                        placeholder="مثال: 07xxxxxxxxx"
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
                        <div className="empty-box">لا توجد حجوزات ضمن الفلاتر الحالية.</div>
                      ) : (
                        groupedBookings.map((group) => (
                          <div className="date-group panel-soft" key={group.key}>
                            <div className="date-header">
                              <h5>{group.label}</h5>
                              <span>{group.items.length} حجز</span>
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
                                        {STATUS_LABELS[row.status] || "غير معروف"}
                                      </Badge>
                                    </div>
                                    <div className="booking-info">
                                      <p>
                                        <b>الخدمة:</b> {servicesById[row.service_id]?.name || "-"}
                                      </p>
                                      <p>
                                        <b>الموظفة:</b> {staffById[row.staff_id]?.name || "-"}
                                      </p>
                                      <p>
                                        <b>الوقت:</b> {formatTime(row.appointment_start)}
                                      </p>
                                    </div>
                                    <div className="booking-actions sticky">
                                      <Button
                                        type="button"
                                        variant="success"
                                        disabled={loadingRow}
                                        onClick={() => updateBookingStatus(row.id, "confirmed")}
                                      >
                                        {target === "confirmed" ? "جاري القبول..." : "قبول"}
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="danger"
                                        disabled={loadingRow}
                                        onClick={() => updateBookingStatus(row.id, "cancelled")}
                                      >
                                        {target === "cancelled" ? "جاري الرفض..." : "رفض"}
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
                          تحميل المزيد
                        </Button>
                      </div>
                    ) : null}
                  </Card>
                </>
              ) : null}

              {activeSection === "clients" ? (
                <Card>
                  <div className="enterprise-card-head">
                    <h3>العملاء</h3>
                    <div className="row-actions">
                      <Badge variant="neutral">{analytics.periodLabel}</Badge>
                      <Badge variant="neutral">{analytics.clients.length} عميلة</Badge>
                    </div>
                  </div>
                  <div className="table-scroll">
                    <table className="enterprise-table">
                      <thead>
                        <tr>
                          <th>الاسم</th>
                          <th>الهاتف</th>
                          <th>عدد الحجوزات</th>
                          <th>الإيراد</th>
                          <th>آخر زيارة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.clients.length === 0 ? (
                          <tr>
                            <td colSpan={5}>لا يوجد عملاء بعد.</td>
                          </tr>
                        ) : (
                          analytics.clients.map((client) => (
                            <tr key={`${client.phone}-${client.name}`}>
                              <td>{client.name}</td>
                              <td>{client.phone}</td>
                              <td>{client.bookings}</td>
                              <td>{formatCurrencyIQD(client.revenue)}</td>
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
                      <h4>الفترة التحليلية</h4>
                      <Badge variant="neutral">{analytics.periodLabel}</Badge>
                    </div>
                    <div className="analytics-period-control">
                      <label htmlFor="analytics-period-reports">اختيار الفترة</label>
                      <select
                        id="analytics-period-reports"
                        className="input"
                        value={analyticsPeriod}
                        onChange={(e) => setAnalyticsPeriod(e.target.value)}
                      >
                        <option value="last30">آخر 30 يوم</option>
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
                      <h3>تقارير الإيراد</h3>
                      <Button variant="secondary" onClick={exportCsv}>
                        تصدير CSV
                      </Button>
                    </div>
                    <div className="revenue-chart-wrap">
                      <svg viewBox={`0 0 ${analytics.chartWidth} ${analytics.chartHeight}`} className="revenue-chart-svg" role="img" aria-label="مخطط الإيراد">
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
                        <h4>توزيع الإيراد حسب الخدمات</h4>
                        <Badge variant="neutral">{formatCurrencyIQD(analytics.totalServiceRevenue)}</Badge>
                      </div>
                    <div className="services-pie-wrap">
                      <div className="services-pie" style={{ background: analytics.pieGradient }} />
                      <div className="services-pie-legend">
                        {analytics.pieSegments.length === 0 ? (
                          <p className="muted">لا توجد بيانات إيرادات مؤكدة.</p>
                        ) : (
                          analytics.pieSegments.map((item) => (
                            <div key={`rep-${item.name}`} className="legend-row">
                              <span className="legend-dot" style={{ background: item.color }} />
                              <span>{item.name}</span>
                              <b>{formatCurrencyIQD(item.revenue)}</b>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </Card>
                </div>
              ) : null}

              {activeSection === "calendar" ? (
                <Card>
                  <div className="enterprise-card-head">
                    <h3>تقويم اليوم</h3>
                    <input
                      type="date"
                      className="input"
                      value={calendarDate}
                      onChange={(e) => setCalendarDate(e.target.value)}
                      style={{ maxWidth: 220 }}
                    />
                  </div>
                  <div className="calendar-list">
                    {calendarGroups.length === 0 ? (
                      <div className="empty-box">لا توجد بيانات لهذا اليوم.</div>
                    ) : (
                      calendarGroups.map((group) => (
                        <div className="date-group panel-soft" key={group.staff?.id || group.staff?.name}>
                          <div className="date-header">
                            <h5>{group.staff?.name || "غير محدد"}</h5>
                            <span>{group.items.length} حجز</span>
                          </div>
                          <div className="bookings-stack">
                            {group.items.length === 0 ? (
                              <div className="empty-box">لا توجد حجوزات.</div>
                            ) : (
                              group.items.map((row) => (
                                <article key={row.id} className="booking-card panel-soft compact-booking-card">
                                  <div className="booking-top">
                                    <div>
                                      <h6>{row.customer_name}</h6>
                                      <p>{row.customer_phone}</p>
                                    </div>
                                    <Badge variant={row.status || "pending"}>
                                      {STATUS_LABELS[row.status] || "غير معروف"}
                                    </Badge>
                                  </div>
                                  <div className="booking-info">
                                    <p>
                                      <b>الخدمة:</b> {servicesById[row.service_id]?.name || "-"}
                                    </p>
                                    <p>
                                      <b>الوقت:</b> {formatTime(row.appointment_start)}
                                    </p>
                                  </div>
                                </article>
                              ))
                            )}
                          </div>
                        </div>
                      ))
                    )}
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
                        onClick={() => setActiveSettingsSection(tab.key)}
                      >
                        {tab.label}
                      </Button>
                    ))}
                  </div>
                </Card>
              ) : null}

          {activeSection === "schedules" ? (
            <Card>
              <h3>جداول دوام الموظفين</h3>
              <SelectInput
                label="اختاري الموظف/الموظفة"
                value={scheduleStaffId}
                onChange={(e) => setScheduleStaffId(e.target.value)}
              >
                <option value="">اختيار</option>
                {staff.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </SelectInput>

              <div className="hours-list" style={{ marginTop: 12 }}>
                {DAYS.map((day) => {
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
                        <span>إجازة</span>
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
                {saveScheduleLoading ? "جاري الحفظ..." : "حفظ جدول الدوام"}
              </Button>

              <Card className="panel-soft" style={{ marginTop: 14 }}>
                <h4>إجازات واستثناءات</h4>
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
                    placeholder="سبب الإجازة (اختياري)"
                    value={timeOffForm.reason}
                    onChange={(e) => setTimeOffForm((p) => ({ ...p, reason: e.target.value }))}
                    disabled={!scheduleStaffId}
                  />
                  <Button type="button" onClick={addEmployeeTimeOff} disabled={!scheduleStaffId || savingTimeOff}>
                    {savingTimeOff ? "جاري الإضافة..." : "إضافة إجازة"}
                  </Button>
                </div>

                <div className="settings-list" style={{ marginTop: 10 }}>
                  {selectedStaffTimeOff.length === 0 ? (
                    <div className="empty-box">لا توجد إجازات مسجلة.</div>
                  ) : (
                    selectedStaffTimeOff.map((row) => (
                      <div key={row.id} className="settings-row">
                        <div>
                          <b>{formatDate(row.start_at)} - {formatDate(row.end_at)}</b>
                          <p className="muted">{row.reason || "بدون ملاحظة"}</p>
                        </div>
                        <Button
                          type="button"
                          variant="danger"
                          disabled={deletingTimeOffId === row.id}
                          onClick={() => deleteEmployeeTimeOff(row.id)}
                        >
                          {deletingTimeOffId === row.id ? "..." : "حذف"}
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </Card>
          ) : null}

          {activeSection === "services" ? (
            <Card>
              <h3>إدارة الخدمات</h3>
              <div className="grid service-form-grid">
                <input
                  className="input"
                  placeholder="اسم الخدمة"
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm((p) => ({ ...p, name: e.target.value }))}
                />
                <input
                  className="input"
                  type="number"
                  placeholder="المدة"
                  value={serviceForm.duration_minutes}
                  onChange={(e) => setServiceForm((p) => ({ ...p, duration_minutes: e.target.value }))}
                />
                <input
                  className="input"
                  type="number"
                  placeholder="السعر"
                  value={serviceForm.price}
                  onChange={(e) => setServiceForm((p) => ({ ...p, price: e.target.value }))}
                />
                <input
                  className="input"
                  type="number"
                  placeholder="الترتيب"
                  value={serviceForm.sort_order}
                  onChange={(e) => setServiceForm((p) => ({ ...p, sort_order: e.target.value }))}
                />
                <Button type="button" variant="secondary" onClick={addService} disabled={addingService}>
                  {addingService ? "جاري الإضافة..." : "إضافة خدمة"}
                </Button>
              </div>

              <div className="settings-list">
                {services.length === 0 ? (
                  <div className="empty-box">لا توجد خدمات.</div>
                ) : (
                  services.map((row) => {
                    const isEditing = editingServiceId === row.id;
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
                              {editingService.is_active ? "مرئية" : "مخفية"}
                            </label>
                            <div className="row-actions">
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => saveServiceEdit(row.id)}
                                disabled={rowLoading === `service-save-${row.id}`}
                              >
                                {rowLoading === `service-save-${row.id}` ? "جاري الحفظ..." : "حفظ"}
                              </Button>
                              <Button type="button" variant="ghost" onClick={() => setEditingServiceId("")}>
                                إلغاء
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
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
                                  {row.duration_minutes} دقيقة • {formatCurrencyIQD(row.price)}
                                </p>
                                <p className="muted">
                                  {row.is_active ? "مرئية" : "مخفية"} • ترتيب: {row.sort_order || 0}
                                </p>
                              </div>
                            </div>
                            <div className="row-actions">
                              <label
                                className={`upload-mini ${
                                  serviceImageLoading[row.id] || serviceImageCompressing[row.id] ? "disabled" : ""
                                }`}
                              >
                                {serviceImageCompressing[row.id] ? (
                                  <>
                                    <span className="inline-spinner" />
                                    جاري ضغط الصورة...
                                  </>
                                ) : serviceImageLoading[row.id] ? (
                                  <>
                                    <span className="inline-spinner" />
                                    جاري رفع الصورة...
                                  </>
                                ) : (
                                  "رفع صورة"
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
                                تعديل
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => toggleServiceActive(row)}
                                disabled={rowLoading === `service-toggle-${row.id}`}
                              >
                                {rowLoading === `service-toggle-${row.id}`
                                  ? "جاري..."
                                  : row.is_active
                                    ? "إخفاء"
                                    : "إظهار"}
                              </Button>
                              <Button type="button" variant="danger" onClick={() => setDeleteDialog({ type: "service", row })}>
                                حذف
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          ) : null}

          {activeSection === "employees" ? (
            <Card>
              <h3>إدارة الموظفين</h3>
              <div className="grid two">
                <input
                  className="input"
                  placeholder="اسم الموظف/الموظفة"
                  value={staffForm.name}
                  onChange={(e) => setStaffForm((p) => ({ ...p, name: e.target.value }))}
                />
                <input
                  className="input"
                  type="number"
                  placeholder="الترتيب"
                  value={staffForm.sort_order}
                  onChange={(e) => setStaffForm((p) => ({ ...p, sort_order: e.target.value }))}
                />
                <input
                  className="input"
                  placeholder="رابط صورة (اختياري)"
                  value={staffForm.photo_url}
                  onChange={(e) => setStaffForm((p) => ({ ...p, photo_url: e.target.value }))}
                />
                <Button type="button" variant="secondary" onClick={addStaff} disabled={addingStaff}>
                  {addingStaff ? "جاري الإضافة..." : "إضافة"}
                </Button>
              </div>

              <div className="settings-list">
                {staff.length === 0 ? (
                  <div className="empty-box">لا توجد موظفات/موظفين.</div>
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
                              placeholder="رابط صورة (اختياري)"
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
                              {editingStaff.is_active ? "مرئي" : "مخفي"}
                            </label>
                            <div className="row-actions">
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => saveStaffEdit(row.id)}
                                disabled={rowLoading === `staff-save-${row.id}`}
                              >
                                {rowLoading === `staff-save-${row.id}` ? "جاري الحفظ..." : "حفظ"}
                              </Button>
                              <Button type="button" variant="ghost" onClick={() => setEditingStaffId("")}>
                                إلغاء
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
                                  {row.is_active ? "مرئي" : "مخفي"} • ترتيب: {row.sort_order || 0}
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
                                    جاري ضغط الصورة...
                                  </>
                                ) : staffImageLoading[row.id] ? (
                                  <>
                                    <span className="inline-spinner" />
                                    جاري رفع الصورة...
                                  </>
                                ) : (
                                  "رفع صورة"
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
                                تعديل
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => toggleStaffActive(row)}
                                disabled={rowLoading === `staff-toggle-${row.id}`}
                              >
                                {rowLoading === `staff-toggle-${row.id}`
                                  ? "جاري..."
                                  : row.is_active
                                    ? "إخفاء"
                                    : "إظهار"}
                              </Button>
                              <Button type="button" variant="danger" onClick={() => setDeleteDialog({ type: "staff", row })}>
                                حذف
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          ) : null}

              {activeSection === "commissions" ? (
                <Card>
                  <h3>العمولات</h3>
                  <p className="muted">هذا القسم جاهز كمرحلة قادمة. تمت تهيئة قاعدة البيانات لحساب عمولات الموظفين لكل خدمة/حجز.</p>
                </Card>
              ) : null}

              {activeSection === "expenses" ? (
                <Card>
                  <h3>المصروفات</h3>
                  <p className="muted">هذا القسم جاهز كمرحلة قادمة. تمت تهيئة قاعدة البيانات لإدخال المصروفات اليومية وتحليل صافي الربح.</p>
                </Card>
              ) : null}

          {activeSection === "settings" && activeSettingsSection === "assign" ? (
            <Card>
              <h3>ربط الخدمات بالموظفين</h3>
              <SelectInput label="اختاري الموظف/الموظفة" value={assignStaffId} onChange={(e) => setAssignStaffId(e.target.value)}>
                <option value="">اختيار</option>
                {staff.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </SelectInput>

              <div className="row-actions" style={{ marginTop: 10 }}>
                <Button type="button" variant="ghost" onClick={selectAllAssign} disabled={!assignStaffId}>
                  اختيار الكل
                </Button>
                <Button type="button" variant="ghost" onClick={clearAllAssign} disabled={!assignStaffId}>
                  مسح الكل
                </Button>
                <Button type="button" onClick={saveAssignments} disabled={!assignStaffId || saveAssignLoading}>
                  {saveAssignLoading ? "جاري الحفظ..." : "حفظ التعيين"}
                </Button>
              </div>

              {services.length === 0 ? (
                <div className="empty-box" style={{ marginTop: 10 }}>
                  لا توجد خدمات لتعيينها.
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
                          {srv.duration_minutes} دقيقة • {formatCurrencyIQD(srv.price)}
                          {disabled ? " • غير مفعلة" : currentlyAssigned ? " • معينة" : ""}
                        </small>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          ) : null}

          {activeSection === "settings" && activeSettingsSection === "media" ? (
            <Card>
              <h3>الصور</h3>
              <p className="muted">ارفعي صور للمركز، وإذا ماكو صور راح تظهر صور افتراضية تلقائياً.</p>

              <div className="media-admin-grid">
                <div className="media-block">
                  <h4>شعار المركز</h4>
                  <SafeImage
                    src={mediaDraft.logo_url}
                    alt="شعار الصالون"
                    className="logo-preview"
                    fallbackText={getInitials(salon.name)}
                  />
                  <label className={`upload-main ${logoUploading || logoCompressing ? "disabled" : ""}`}>
                    {logoCompressing ? (
                      <>
                        <span className="inline-spinner" />
                        جاري ضغط الصورة...
                      </>
                    ) : logoUploading ? (
                      <>
                        <span className="inline-spinner" />
                        جاري رفع الشعار...
                      </>
                    ) : (
                      "رفع/تبديل الشعار"
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
                  <h4>صورة الغلاف</h4>
                  <SafeImage src={mediaDraft.cover_image_url} alt="غلاف الصالون" className="cover-preview" fallbackIcon="✨" />
                  <label className={`upload-main ${coverUploading || coverCompressing ? "disabled" : ""}`}>
                    {coverCompressing ? (
                      <>
                        <span className="inline-spinner" />
                        جاري ضغط الصورة...
                      </>
                    ) : coverUploading ? (
                      <>
                        <span className="inline-spinner" />
                        جاري رفع الغلاف...
                      </>
                    ) : (
                      "رفع/تبديل الغلاف"
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
                  <h4>معرض الصور (حد أقصى 8)</h4>
                  <label className={`upload-main ${galleryUploading || galleryCompressing ? "disabled" : ""}`}>
                    {galleryCompressing ? (
                      <>
                        <span className="inline-spinner" />
                        جاري ضغط الصورة...
                      </>
                    ) : galleryUploading ? (
                      <>
                        <span className="inline-spinner" />
                        جاري رفع الصور...
                      </>
                    ) : (
                      "رفع صور للمعرض"
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
                    <div className="empty-box">لا توجد صور مرفوعة حالياً.</div>
                  ) : (
                    <div className="admin-gallery-grid">
                      {galleryUrls.map((url) => (
                        <div className="admin-gallery-item" key={url}>
                          <SafeImage src={url} alt="صورة المعرض" className="admin-gallery-thumb" fallbackIcon="🌸" />
                          <Button
                            type="button"
                            variant="danger"
                            className="admin-gallery-delete"
                            disabled={galleryDeletingUrl === url}
                            onClick={() => handleRemoveGalleryImage(url)}
                          >
                            {galleryDeletingUrl === url ? "..." : "حذف"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid">
                <TextInput
                  label="رابط شعار المركز (اختياري)"
                  value={mediaDraft.logo_url}
                  onChange={(e) => setMediaDraft((p) => ({ ...p, logo_url: e.target.value }))}
                  placeholder="https://..."
                />
                <TextInput
                  label="رابط صورة الغلاف (اختياري)"
                  value={mediaDraft.cover_image_url}
                  onChange={(e) => setMediaDraft((p) => ({ ...p, cover_image_url: e.target.value }))}
                  placeholder="https://..."
                />
                <label className="field">
                  <span>روابط المعرض (رابط بكل سطر)</span>
                  <textarea
                    className="input textarea"
                    value={mediaDraft.gallery_text}
                    onChange={(e) => setMediaDraft((p) => ({ ...p, gallery_text: e.target.value }))}
                    placeholder={"https://...\nhttps://..."}
                  />
                </label>
              </div>

              <Button type="button" onClick={saveSalonMedia} disabled={savingMedia}>
                {savingMedia ? "جاري الحفظ..." : "حفظ الصور"}
              </Button>
            </Card>
          ) : null}

          {activeSection === "settings" && activeSettingsSection === "salon" ? (
            <Card>
              <h3>إعدادات المركز</h3>
              <p className="muted">تحكم بظهور المركز وحالته العامة.</p>

              <div className="stack-sm" style={{ marginTop: 10 }}>
                <label className="field">
                  <span>وضع الحجز</span>
                  <select
                    className="input"
                    value={salon.booking_mode || "choose_employee"}
                    onChange={(e) => saveSalonFlags({ booking_mode: e.target.value })}
                    disabled={savingSalonFlags}
                  >
                    <option value="choose_employee">العميلة تختار الموظف/الموظفة</option>
                    <option value="auto_assign">توزيع تلقائي حسب التوفر</option>
                  </select>
                </label>
                <label className="switch-pill">
                  <input
                    type="checkbox"
                    checked={Boolean(salon.is_listed)}
                    onChange={(e) => saveSalonFlags({ is_listed: e.target.checked })}
                    disabled={savingSalonFlags}
                  />
                  يظهر في صفحة الاستكشاف
                </label>
                <label className="switch-pill">
                  <input
                    type="checkbox"
                    checked={Boolean(salon.is_active)}
                    onChange={(e) => saveSalonFlags({ is_active: e.target.checked })}
                    disabled={savingSalonFlags}
                  />
                  المركز فعّال ويستقبل حجوزات
                </label>
              </div>

              <div className="admin-share-block" style={{ marginTop: 12 }}>
                <h4>رابط الحجز المباشر</h4>
                <input className="input" value={bookingPageUrl} readOnly />
                <div className="row-actions">
                  <Button variant="secondary" onClick={copyBookingLink} disabled={copyingLink || !bookingPageUrl}>
                    {copyingLink ? "جاري النسخ..." : "نسخ رابط الحجز"}
                  </Button>
                  {shareBookingWhatsappHref ? (
                    <Button as="a" variant="primary" href={shareBookingWhatsappHref} target="_blank" rel="noreferrer">
                      مشاركة واتساب
                    </Button>
                  ) : null}
                </div>
              </div>
            </Card>
          ) : null}
            </div>
          </div>
        </>
      )}

      <ConfirmModal
        open={Boolean(deleteDialog)}
        title={deleteDialog?.type === "service" ? "حذف الخدمة" : "حذف الموظفة"}
        text={
          deleteDialog?.type === "service"
            ? `راح يتم حذف خدمة ${deleteDialog?.row?.name || ""} وكل ربطها. متأكدة؟`
            : `راح يتم حذف ${deleteDialog?.row?.name || ""} وكل تعييناته. متأكد/ة؟`
        }
        loading={deleteLoading}
        onCancel={() => !deleteLoading && setDeleteDialog(null)}
        onConfirm={deleteRow}
        confirmText="نعم، حذف"
      />

      <Toast {...toast} />
    </PageShell>
  );
}
