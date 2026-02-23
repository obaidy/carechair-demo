import React, { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, endOfDay, endOfWeek, startOfDay, startOfWeek } from "date-fns";
import { dateFnsLocalizer, Views, Calendar as BigCalendar } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { format, parse, getDay } from "date-fns";
import { arSA, cs, enUS, ru } from "date-fns/locale";
import { Badge, Button, Card } from "../ui";
import CalendarToolbar from "./CalendarToolbar";
import BookingDrawer from "./BookingDrawer";
import { supabase } from "../../lib/supabase";
import {
  mapBookingsToEvents,
  toBookingPayloadFromDraft,
  toDateRangeParams,
  getBookingStart,
  getBookingEnd,
} from "../../lib/calendar/transform";
import { validateBooking, snapDate } from "../../lib/calendar/availability";

import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

const DnDCalendar = withDragAndDrop(BigCalendar);

const localeMap = {
  ar: arSA,
  en: enUS,
  cs,
  ru,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date, options) => startOfWeek(date, { weekStartsOn: 1, ...options }),
  getDay,
  locales: localeMap,
});

function useMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window === "undefined" ? false : window.innerWidth < breakpoint
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);

  return isMobile;
}

function statusVariant(status) {
  if (status === "confirmed") return "confirmed";
  if (status === "cancelled") return "cancelled";
  if (status === "no_show") return "neutral";
  return "pending";
}

function CalendarEvent({ event, t }) {
  return (
    <div className="calendar-event-chip">
      <span className={`calendar-status-dot ${event.status || "pending"}`} />
      <div className="calendar-event-copy">
        <b>{event.customerName || event.title}</b>
        <small>{event.serviceName || "-"}</small>
      </div>
    </div>
  );
}

async function selectWorkingHoursWithFallback(salonId) {
  const salonPrimary = await supabase.from("salon_working_hours").select("*").eq("salon_id", salonId);
  const salonHours = salonPrimary.error ? await supabase.from("salon_hours").select("*").eq("salon_id", salonId) : salonPrimary;

  const empPrimary = await supabase.from("employee_working_hours").select("*").eq("salon_id", salonId);
  const employeeHours = empPrimary.error ? await supabase.from("employee_hours").select("*").eq("salon_id", salonId) : empPrimary;

  return {
    salonHours: salonHours.data || [],
    employeeHours: employeeHours.data || [],
  };
}

export default function SalonCalendar({ salon, writeLocked, t, showToast, onChanged }) {
  const isMobile = useMobile();
  const currentLang = String((typeof document !== "undefined" && document.documentElement.lang) || "en").slice(0, 2);

  const [view, setView] = useState(isMobile ? Views.AGENDA : Views.WEEK);
  const [date, setDate] = useState(new Date());
  const [range, setRange] = useState(() => {
    const s = startOfWeek(new Date(), { weekStartsOn: 1 });
    return { start: s, end: endOfWeek(s, { weekStartsOn: 1 }) };
  });

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [services, setServices] = useState([]);
  const [salonHours, setSalonHours] = useState([]);
  const [employeeHours, setEmployeeHours] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [events, setEvents] = useState([]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState("edit");
  const [selectedBooking, setSelectedBooking] = useState(null);

  const [filters, setFilters] = useState({
    employeeIds: [],
    employeeSingle: "all",
    status: "all",
    serviceId: "all",
  });

  useEffect(() => {
    if (isMobile) setView(Views.AGENDA);
  }, [isMobile]);

  const setFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const loadStatic = useCallback(async () => {
    if (!supabase || !salon?.id) return;

    const [staffRes, servicesRes, hoursRes] = await Promise.all([
      supabase.from("staff").select("*").eq("salon_id", salon.id).eq("is_active", true).order("sort_order", { ascending: true }),
      supabase.from("services").select("*").eq("salon_id", salon.id).order("sort_order", { ascending: true }),
      selectWorkingHoursWithFallback(salon.id),
    ]);

    if (staffRes.error) throw staffRes.error;
    if (servicesRes.error) throw servicesRes.error;

    setEmployees(staffRes.data || []);
    setServices(servicesRes.data || []);
    setSalonHours(hoursRes.salonHours || []);
    setEmployeeHours(hoursRes.employeeHours || []);
  }, [salon?.id]);

  const loadBookingsForRange = useCallback(async (currentRange) => {
    if (!supabase || !salon?.id || !currentRange?.start || !currentRange?.end) return;

    const rangeStart = startOfDay(currentRange.start).toISOString();
    const rangeEnd = endOfDay(currentRange.end).toISOString();

    const res = await supabase
      .from("bookings")
      .select("*")
      .eq("salon_id", salon.id)
      .lt("appointment_start", rangeEnd)
      .gt("appointment_end", rangeStart)
      .order("appointment_start", { ascending: true });

    if (res.error) throw res.error;

    setBookings(res.data || []);
  }, [salon?.id]);

  useEffect(() => {
    async function init() {
      if (!salon?.id) return;
      setLoading(true);
      try {
        await loadStatic();
        await loadBookingsForRange(range);
      } catch (err) {
        showToast("error", `${t("calendar.errors.load", "Failed to load calendar data")}: ${err?.message || err}`);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [salon?.id, range.start, range.end]);

  useEffect(() => {
    setEvents(mapBookingsToEvents(bookings, employees, services));
  }, [bookings, employees, services]);

  const filteredEmployees = useMemo(() => {
    if (isMobile) {
      if (filters.employeeSingle === "all") return employees;
      return employees.filter((x) => String(x.id) === String(filters.employeeSingle));
    }
    if (!filters.employeeIds?.length) return employees;
    return employees.filter((x) => filters.employeeIds.includes(String(x.id)));
  }, [employees, filters.employeeIds, filters.employeeSingle, isMobile]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (filters.status !== "all" && String(event.status) !== String(filters.status)) return false;
      if (filters.serviceId !== "all" && String(event.booking?.service_id) !== String(filters.serviceId)) return false;

      if (isMobile) {
        if (filters.employeeSingle !== "all" && String(event.resourceId) !== String(filters.employeeSingle)) return false;
      } else if (filters.employeeIds?.length) {
        if (!filters.employeeIds.includes(String(event.resourceId))) return false;
      }

      return true;
    });
  }, [events, filters.status, filters.serviceId, filters.employeeSingle, filters.employeeIds, isMobile]);

  const resources = useMemo(
    () => filteredEmployees.map((x) => ({ resourceId: x.id, resourceTitle: x.name, ...x })),
    [filteredEmployees]
  );

  const openCreate = useCallback(
    (slotInfo) => {
      if (writeLocked) return;

      const defaultService = services?.[0] || null;
      const start = snapDate(slotInfo.start || new Date());
      const duration = Number(defaultService?.duration_minutes || 30);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + duration);

      setDrawerMode("create");
      setSelectedBooking({
        start,
        end,
        service_id: defaultService?.id || "",
        employee_id: slotInfo.resourceId || resources?.[0]?.resourceId || "",
        status: "pending",
        duration,
      });
      setDrawerOpen(true);
    },
    [resources, services, writeLocked]
  );

  const openEdit = useCallback((event) => {
    setDrawerMode("edit");
    setSelectedBooking({
      id: event.id,
      customer_name: event.customerName,
      customer_phone: event.customerPhone,
      service_id: event.booking?.service_id,
      employee_id: event.resourceId,
      status: event.status,
      notes: event.notes,
      start: event.start,
      end: event.end,
      duration: Math.max(5, Math.round((event.end.getTime() - event.start.getTime()) / 60000)),
    });
    setDrawerOpen(true);
  }, []);

  const saveBooking = useCallback(
    async (draft) => {
      const validation = validateBooking({
        employeeId: draft.employee_id,
        start: draft.start,
        end: draft.end,
        bookings,
        salonHours,
        employeeHours,
        excludeBookingId: draft.id,
        t,
      });

      if (!validation.ok) {
        showToast("error", validation.reason || t("calendar.errors.invalid", "Invalid booking"));
        return;
      }

      if (drawerMode === "create") {
        const payload = toBookingPayloadFromDraft(draft, salon.id);

        const optimisticId = `tmp-${Date.now()}`;
        const optimisticRow = { ...payload, id: optimisticId };
        setBookings((prev) => [...prev, optimisticRow]);

        const ins = await supabase.from("bookings").insert([payload]).select("*").single();
        if (ins.error) {
          setBookings((prev) => prev.filter((x) => x.id !== optimisticId));
          showToast("error", `${t("calendar.errors.save", "Failed to save booking")}: ${ins.error.message}`);
          return;
        }

        setBookings((prev) => prev.map((x) => (x.id === optimisticId ? ins.data : x)));
        showToast("success", t("calendar.messages.created", "Booking created."));
      } else {
        const payload = {
          customer_name: draft.customer_name,
          customer_phone: draft.customer_phone,
          service_id: draft.service_id,
          staff_id: draft.employee_id,
          appointment_start: draft.start.toISOString(),
          appointment_end: draft.end.toISOString(),
          status: draft.status,
          notes: draft.notes || null,
        };

        const previousRow = bookings.find((x) => String(x.id) === String(draft.id));
        setBookings((prev) =>
          prev.map((x) => (String(x.id) === String(draft.id) ? { ...x, ...payload } : x))
        );

        const up = await supabase
          .from("bookings")
          .update(payload)
          .eq("id", draft.id)
          .eq("salon_id", salon.id)
          .select("*")
          .single();

        if (up.error) {
          setBookings((prev) =>
            prev.map((x) => (String(x.id) === String(draft.id) ? previousRow || x : x))
          );
          showToast("error", `${t("calendar.errors.update", "Failed to update booking")}: ${up.error.message}`);
          return;
        }

        setBookings((prev) => prev.map((x) => (String(x.id) === String(draft.id) ? up.data : x)));
        showToast("success", t("calendar.messages.updated", "Booking updated."));
      }

      setDrawerOpen(false);
      setSelectedBooking(null);
      await onChanged?.();
    },
    [bookings, drawerMode, employeeHours, onChanged, salon?.id, salonHours, t]
  );

  const deleteBooking = useCallback(
    async (draft) => {
      if (!draft?.id) return;

      const previous = bookings;
      setBookings((prev) => prev.filter((x) => String(x.id) !== String(draft.id)));

      const del = await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", draft.id)
        .eq("salon_id", salon.id);

      if (del.error) {
        setBookings(previous);
        showToast("error", `${t("calendar.errors.delete", "Failed to cancel booking")}: ${del.error.message}`);
        return;
      }

      showToast("success", t("calendar.messages.cancelled", "Booking cancelled."));
      setDrawerOpen(false);
      setSelectedBooking(null);
      await onChanged?.();
    },
    [bookings, onChanged, salon?.id, t]
  );

  const handleDrop = useCallback(
    async ({ event, start, end, resourceId }) => {
      const employeeId = resourceId || event.resourceId;
      const validation = validateBooking({
        employeeId,
        start,
        end,
        bookings,
        salonHours,
        employeeHours,
        excludeBookingId: event.id,
        t,
      });

      if (!validation.ok) {
        showToast("error", validation.reason || t("calendar.errors.overlap", "Conflict detected"));
        return;
      }

      const previous = bookings;
      setBookings((prev) =>
        prev.map((row) =>
          String(row.id) === String(event.id)
            ? {
                ...row,
                staff_id: employeeId,
                appointment_start: new Date(start).toISOString(),
                appointment_end: new Date(end).toISOString(),
              }
            : row
        )
      );

      const up = await supabase
        .from("bookings")
        .update({
          staff_id: employeeId,
          appointment_start: new Date(start).toISOString(),
          appointment_end: new Date(end).toISOString(),
        })
        .eq("id", event.id)
        .eq("salon_id", salon.id);

      if (up.error) {
        setBookings(previous);
        showToast("error", `${t("calendar.errors.move", "Failed to move booking")}: ${up.error.message}`);
      } else {
        showToast("success", t("calendar.messages.moved", "Booking moved."));
        await onChanged?.();
      }
    },
    [bookings, employeeHours, onChanged, salon?.id, salonHours, t]
  );

  const calendarMessages = useMemo(
    () => ({
      date: t("calendar.labels.date", "Date"),
      time: t("calendar.labels.time", "Time"),
      event: t("calendar.labels.event", "Event"),
      allDay: t("calendar.labels.allDay", "All Day"),
      week: t("calendar.views.week", "Week"),
      day: t("calendar.views.day", "Day"),
      agenda: t("calendar.views.agenda", "Agenda"),
      previous: t("calendar.toolbar.prev", "Prev"),
      next: t("calendar.toolbar.next", "Next"),
      today: t("calendar.toolbar.today", "Today"),
      noEventsInRange: t("calendar.labels.noEvents", "No events in this range"),
    }),
    [t]
  );

  const minTime = useMemo(() => {
    const base = new Date();
    base.setHours(7, 0, 0, 0);
    return base;
  }, []);

  const maxTime = useMemo(() => {
    const base = new Date();
    base.setHours(22, 0, 0, 0);
    return base;
  }, []);

  return (
    <Card className="calendar-root-card">
      <div className="calendar-shell" dir={typeof document !== "undefined" ? document.documentElement.dir : "rtl"}>
        {loading ? <div className="calendar-loading">{t("common.loading", "Loading...")}</div> : null}

        <DndProvider backend={HTML5Backend}>
          <DnDCalendar
            localizer={localizer}
            culture={currentLang}
            events={filteredEvents}
            resources={resources}
            resourceIdAccessor="resourceId"
            resourceTitleAccessor="resourceTitle"
            date={date}
            view={view}
            views={[Views.DAY, Views.WEEK, Views.AGENDA]}
            step={10}
            timeslots={6}
            selectable
            popup
            showMultiDayTimes
            min={minTime}
            max={maxTime}
            messages={calendarMessages}
            onView={(nextView) => setView(nextView)}
            onNavigate={(nextDate) => setDate(nextDate)}
            onRangeChange={(nextRange) => {
              const parsed = toDateRangeParams(nextRange, view);
              if (parsed?.start && parsed?.end) setRange(parsed);
            }}
            onSelectEvent={openEdit}
            onSelectSlot={openCreate}
            onEventDrop={handleDrop}
            draggableAccessor={() => !writeLocked}
            eventPropGetter={(event) => ({
              className: `rbc-event-status-${event.status || "pending"}`,
            })}
            components={{
              toolbar: (props) => (
                <CalendarToolbar
                  {...props}
                  t={t}
                  isMobile={isMobile}
                  filters={filters}
                  employees={employees}
                  services={services}
                  setFilter={setFilter}
                />
              ),
              event: (props) => <CalendarEvent {...props} t={t} />,
              agenda: {
                event: (props) => <CalendarEvent {...props} t={t} />,
              },
            }}
          />
        </DndProvider>

        {isMobile ? (
          <button
            type="button"
            className="calendar-fab"
            onClick={() =>
              openCreate({
                start: new Date(),
                resourceId: filters.employeeSingle !== "all" ? filters.employeeSingle : employees?.[0]?.id,
              })
            }
          >
            {t("calendar.actions.addBooking", "+ Add booking")}
          </button>
        ) : null}

        <BookingDrawer
          open={drawerOpen}
          mode={drawerMode}
          initialData={selectedBooking}
          employees={employees}
          services={services}
          writeLocked={writeLocked}
          t={t}
          onClose={() => {
            setDrawerOpen(false);
            setSelectedBooking(null);
          }}
          onSave={saveBooking}
          onDelete={deleteBooking}
        />
      </div>
    </Card>
  );
}
