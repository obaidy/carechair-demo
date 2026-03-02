'use client';

import {useCallback, useEffect, useMemo, useState} from 'react';
import {addDays, endOfDay, endOfWeek, startOfDay, startOfWeek} from 'date-fns';
import {dateFnsLocalizer, Views, Calendar as BigCalendar} from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import {DndProvider} from 'react-dnd';
import {HTML5Backend} from 'react-dnd-html5-backend';
import {format, getDay, parse} from 'date-fns';
import {arSA, cs, enUS, ru} from 'date-fns/locale';
import {useLocale} from 'next-intl';
import SafeImage from '@/components/SafeImage';
import {Card} from '@/components/ui';
import CalendarToolbar from '@/components/calendar/CalendarToolbar';
import BookingDrawer from '@/components/calendar/BookingDrawer';
import {createBrowserSupabaseClient} from '@/lib/supabase/browser';
import {mapBookingsToEvents, toBookingPayloadFromDraft, toDateRangeParams, type CalendarEventRecord} from '@/lib/calendar/transform';
import {snapDate, validateBooking} from '@/lib/calendar/availability';
import {useTx} from '@/lib/messages-client';

const DnDCalendar = withDragAndDrop(BigCalendar);
const AnyDnDCalendar = DnDCalendar as any;

const localeMap = {
  ar: arSA,
  en: enUS,
  cs,
  ru
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date, options?: {weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6}) =>
    startOfWeek(date, {weekStartsOn: 1, ...(options || {})}),
  getDay,
  locales: localeMap
});

type SalonInput = {id: string};
type StaffRow = {id: string; name: string; photo_url?: string | null; is_active?: boolean | null; sort_order?: number | null};
type ServiceRow = {id: string; name: string; duration_minutes: number; is_active?: boolean | null; sort_order?: number | null};
type BookingRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  service_id: string | null;
  staff_id: string | null;
  status: string;
  appointment_start: string;
  appointment_end: string;
  notes?: string | null;
};
type HourRow = {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed?: boolean | null;
};
type EmployeeHourRow = {
  staff_id: string | null;
  day_of_week: number;
  start_time: string | null;
  end_time: string | null;
  is_off?: boolean | null;
  is_closed?: boolean | null;
  break_start?: string | null;
  break_end?: string | null;
};
type StaffServiceRow = {staff_id: string | null; service_id: string | null};
type TimeOffRow = {staff_id: string | null; start_at: string | null; end_at: string | null};
type CreateSlotInfo = {start?: Date; resourceId?: string | number | null};
type CalendarBackgroundBlock = {
  id: string;
  start: Date;
  end: Date;
  resourceId?: string;
  kind: 'unavailable';
};
type EmployeeToneStyle = Record<string, string>;

const EMPLOYEE_TONE_PRESETS: Array<{bg: string; border: string; text: string; subtext: string; label: string}> = [
  {bg: '#e8f1ff', border: '#3b82f6', text: '#1e3a8a', subtext: '#1d4ed8', label: '#1e40af'},
  {bg: '#fff1e8', border: '#f97316', text: '#9a3412', subtext: '#c2410c', label: '#9a3412'},
  {bg: '#f3e8ff', border: '#a855f7', text: '#581c87', subtext: '#7e22ce', label: '#581c87'},
  {bg: '#ffe4e6', border: '#f43f5e', text: '#9f1239', subtext: '#be123c', label: '#9f1239'},
  {bg: '#e0f2fe', border: '#0284c7', text: '#0c4a6e', subtext: '#0369a1', label: '#0c4a6e'},
  {bg: '#fef3c7', border: '#f59e0b', text: '#78350f', subtext: '#b45309', label: '#78350f'},
  {bg: '#ede9fe', border: '#6366f1', text: '#312e81', subtext: '#4338ca', label: '#312e81'},
  {bg: '#fdf2f8', border: '#ec4899', text: '#831843', subtext: '#be185d', label: '#831843'},
  {bg: '#dcfce7', border: '#22c55e', text: '#14532d', subtext: '#15803d', label: '#14532d'},
  {bg: '#cffafe', border: '#06b6d4', text: '#164e63', subtext: '#0e7490', label: '#164e63'}
];

const DEFAULT_EMPLOYEE_TONE: EmployeeToneStyle = {
  '--employee-bg': '#eef2ff',
  '--employee-border': '#818cf8',
  '--employee-text': '#312e81',
  '--employee-subtext': '#4338ca',
  '--employee-label': '#312e81'
};

function initials(name: string) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'ST';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function useMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => setIsMobile(window.innerWidth < breakpoint);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  return isMobile;
}

function CalendarEvent({
  event,
  toneStyle
}: {
  event: CalendarEventRecord;
  toneStyle?: EmployeeToneStyle;
}) {
  const style = toneStyle || DEFAULT_EMPLOYEE_TONE;
  const serviceName = String(event.serviceName || '-');
  const employeeName = String(event.employeeName || '-');

  return (
    <div className="calendar-event-chip calendar-employee-tone-chip" style={style as any}>
      <span className={`calendar-status-dot ${event.status || 'pending'}`} />
      <div className="calendar-event-copy">
        <b>{event.customerName || event.title}</b>
        <small className="calendar-event-detail">{serviceName}</small>
        <small className="calendar-event-detail secondary">{employeeName}</small>
      </div>
    </div>
  );
}

function ResourceHeader({
  label,
  resource
}: {
  label?: string;
  resource?: {name?: string; photo_url?: string | null};
}) {
  const name = String(resource?.name || label || '');
  return (
    <div className="calendar-resource-head">
      <SafeImage src={String(resource?.photo_url || '')} alt={name} className="calendar-resource-avatar" fallbackText={initials(name)} />
      <span className="calendar-resource-name">{name}</span>
    </div>
  );
}

function hashValue(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h << 5) - h + value.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function toneFromHsl(hue: number): EmployeeToneStyle {
  return {
    '--employee-bg': `hsl(${hue} 82% 91%)`,
    '--employee-border': `hsl(${hue} 72% 47%)`,
    '--employee-text': `hsl(${hue} 60% 20%)`,
    '--employee-subtext': `hsl(${hue} 52% 28%)`,
    '--employee-label': `hsl(${hue} 50% 24%)`
  };
}

function setDayMinutes(date: Date, minutes: number) {
  const next = new Date(date);
  next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return next;
}

function mergeUnavailableBlocks(
  blocks: Array<{
    start: Date;
    end: Date;
    resourceId?: string;
  }>
): CalendarBackgroundBlock[] {
  const sorted = [...blocks].sort((a, b) => {
    const aResource = String(a.resourceId || '');
    const bResource = String(b.resourceId || '');
    if (aResource !== bResource) return aResource.localeCompare(bResource);
    return a.start.getTime() - b.start.getTime();
  });

  const merged: Array<{start: Date; end: Date; resourceId?: string}> = [];
  for (const block of sorted) {
    const prev = merged[merged.length - 1];
    if (!prev) {
      merged.push({...block});
      continue;
    }

    const sameResource = String(prev.resourceId || '') === String(block.resourceId || '');
    if (sameResource && prev.end.getTime() === block.start.getTime()) {
      prev.end = block.end;
      continue;
    }

    merged.push({...block});
  }

  return merged.map((row, index) => ({
    id: `unavailable-${String(row.resourceId || 'all')}-${row.start.getTime()}-${index}`,
    start: row.start,
    end: row.end,
    resourceId: row.resourceId,
    kind: 'unavailable'
  }));
}

async function selectWorkingHoursWithFallback(supabase: ReturnType<typeof createBrowserSupabaseClient>, salonId: string) {
  if (!supabase) return {salonHours: [] as HourRow[], employeeHours: [] as EmployeeHourRow[]};

  const salonPrimary = await supabase.from('salon_working_hours').select('*').eq('salon_id', salonId);
  const salonHours = salonPrimary.error ? await supabase.from('salon_hours').select('*').eq('salon_id', salonId) : salonPrimary;

  const employeePrimary = await supabase.from('employee_working_hours').select('*').eq('salon_id', salonId);
  const employeeHours = employeePrimary.error ? await supabase.from('employee_hours').select('*').eq('salon_id', salonId) : employeePrimary;

  return {
    salonHours: ((salonHours.data || []) as HourRow[]),
    employeeHours: ((employeeHours.data || []) as EmployeeHourRow[])
  };
}

export default function SalonCalendar({
  salon,
  writeLocked = false,
  onChanged
}: {
  salon: SalonInput;
  writeLocked?: boolean;
  onChanged?: () => Promise<void> | void;
}) {
  const locale = useLocale();
  const t = useTx();
  const isMobile = useMobile();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const currentLang = String(locale || 'en').slice(0, 2);

  const [view, setView] = useState<string>(Views.WEEK);
  const [date, setDate] = useState<Date>(new Date());
  const [range, setRange] = useState<{start: Date; end: Date}>(() => {
    const start = startOfWeek(new Date(), {weekStartsOn: 1});
    return {start, end: endOfWeek(start, {weekStartsOn: 1})};
  });

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<StaffRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [staffServices, setStaffServices] = useState<StaffServiceRow[]>([]);
  const [salonHours, setSalonHours] = useState<HourRow[]>([]);
  const [employeeHours, setEmployeeHours] = useState<EmployeeHourRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOffRow[]>([]);
  const [events, setEvents] = useState<CalendarEventRecord[]>([]);
  const [error, setError] = useState('');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('edit');
  const [selectedBooking, setSelectedBooking] = useState<Record<string, unknown> | null>(null);

  const [filters, setFilters] = useState({
    employeeIds: [] as string[],
    employeeSingle: 'all',
    status: 'all',
    serviceId: 'all'
  });

  useEffect(() => {
    if (!isMobile) return;
    setView((prev) => (prev === Views.WEEK ? Views.DAY : prev));
  }, [isMobile]);

  const availableViews = useMemo(
    () => (isMobile ? [Views.DAY, Views.AGENDA] : [Views.DAY, Views.WEEK, Views.AGENDA]),
    [isMobile]
  );

  const resolvedView = useMemo(() => {
    const current = String(view || '');
    return availableViews.includes(current as any) ? current : String(availableViews[0]);
  }, [availableViews, view]);

  useEffect(() => {
    if (resolvedView !== view) setView(resolvedView);
  }, [resolvedView, view]);

  const setFilter = useCallback((key: 'employeeIds' | 'employeeSingle' | 'status' | 'serviceId', value: string[] | string) => {
    setFilters((prev) => ({...prev, [key]: value}));
  }, []);

  const loadStatic = useCallback(async () => {
    if (!supabase || !salon?.id) return;

    const [staffRes, servicesRes, staffServicesRes, hours] = await Promise.all([
      supabase.from('staff').select('*').eq('salon_id', salon.id).eq('is_active', true).order('sort_order', {ascending: true}),
      supabase.from('services').select('*').eq('salon_id', salon.id).order('sort_order', {ascending: true}),
      supabase.from('staff_services').select('staff_id,service_id').eq('salon_id', salon.id),
      selectWorkingHoursWithFallback(supabase, salon.id)
    ]);

    if (staffRes.error) throw staffRes.error;
    if (servicesRes.error) throw servicesRes.error;

    setEmployees((staffRes.data || []) as StaffRow[]);
    setServices((servicesRes.data || []) as ServiceRow[]);
    setStaffServices(staffServicesRes.error ? [] : ((staffServicesRes.data || []) as StaffServiceRow[]));
    setSalonHours(hours.salonHours || []);
    setEmployeeHours(hours.employeeHours || []);
  }, [supabase, salon?.id]);

  const loadBookingsForRange = useCallback(
    async (currentRange: {start: Date; end: Date}) => {
      if (!supabase || !salon?.id || !currentRange?.start || !currentRange?.end) return;

      const rangeStart = startOfDay(currentRange.start).toISOString();
      const rangeEnd = endOfDay(currentRange.end).toISOString();

      const [bookingsRes, timeOffRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('*')
          .eq('salon_id', salon.id)
          .lt('appointment_start', rangeEnd)
          .gt('appointment_end', rangeStart)
          .order('appointment_start', {ascending: true}),
        supabase
          .from('employee_time_off')
          .select('staff_id,start_at,end_at')
          .eq('salon_id', salon.id)
          .lt('start_at', rangeEnd)
          .gt('end_at', rangeStart)
      ]);

      if (bookingsRes.error) throw bookingsRes.error;
      setBookings((bookingsRes.data || []) as BookingRow[]);
      setTimeOff(timeOffRes.error ? [] : ((timeOffRes.data || []) as TimeOffRow[]));
    },
    [supabase, salon?.id]
  );

  useEffect(() => {
    async function init() {
      if (!salon?.id || !supabase) return;
      setLoading(true);
      setError('');
      try {
        await loadStatic();
        await loadBookingsForRange(range);
      } catch (loadError) {
        setError((loadError as Error)?.message || t('calendar.errors.load', 'Failed to load calendar data'));
      } finally {
        setLoading(false);
      }
    }

    void init();
  }, [salon?.id, supabase, range.start, range.end, loadStatic, loadBookingsForRange, t]);

  useEffect(() => {
    setEvents(mapBookingsToEvents(bookings, employees, services));
  }, [bookings, employees, services]);

  const filteredEmployees = useMemo(() => {
    if (isMobile) {
      if (filters.employeeSingle === 'all') return employees;
      return employees.filter((row) => String(row.id) === String(filters.employeeSingle));
    }
    if (!filters.employeeIds.length) return employees;
    return employees.filter((row) => filters.employeeIds.includes(String(row.id)));
  }, [employees, filters.employeeIds, filters.employeeSingle, isMobile]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (filters.status !== 'all' && String(event.status) !== String(filters.status)) return false;
      if (filters.serviceId !== 'all' && String(event.booking?.service_id || '') !== String(filters.serviceId)) return false;

      if (isMobile) {
        if (filters.employeeSingle !== 'all' && String(event.resourceId) !== String(filters.employeeSingle)) return false;
      } else if (filters.employeeIds.length > 0) {
        if (!filters.employeeIds.includes(String(event.resourceId))) return false;
      }

      return true;
    });
  }, [events, filters.status, filters.serviceId, filters.employeeSingle, filters.employeeIds, isMobile]);

  const resources = useMemo(
    () => filteredEmployees.map((row) => ({resourceId: row.id, resourceTitle: row.name, ...row})),
    [filteredEmployees]
  );

  const allEmployeesSelected = useMemo(() => {
    if (isMobile) return filters.employeeSingle === 'all';
    return filters.employeeIds.length === 0;
  }, [filters.employeeIds, filters.employeeSingle, isMobile]);

  const employeeScopeLabel = useMemo(() => {
    if (allEmployeesSelected) return t('calendar.filters.allEmployees', 'All employees');

    if (isMobile) {
      const name = employees.find((row) => String(row.id) === String(filters.employeeSingle))?.name;
      return name || t('calendar.filters.employee', 'Employee');
    }

    if (filters.employeeIds.length === 1) {
      const name = employees.find((row) => String(row.id) === String(filters.employeeIds[0]))?.name;
      return name || t('calendar.filters.employee', 'Employee');
    }

    return t('calendar.filters.employee', 'Employee');
  }, [allEmployeesSelected, employees, filters.employeeIds, filters.employeeSingle, isMobile, t]);

  const employeeToneById = useMemo(() => {
    const map: Record<string, EmployeeToneStyle> = {};
    (employees || []).forEach((employee, index) => {
      const id = String(employee.id || '');
      if (!id) return;

      const preset = EMPLOYEE_TONE_PRESETS[index % EMPLOYEE_TONE_PRESETS.length];
      if (index < EMPLOYEE_TONE_PRESETS.length) {
        map[id] = {
          '--employee-bg': preset.bg,
          '--employee-border': preset.border,
          '--employee-text': preset.text,
          '--employee-subtext': preset.subtext,
          '--employee-label': preset.label
        };
        return;
      }

      const hue = (index * 137.508 + hashValue(id)) % 360;
      map[id] = toneFromHsl(hue);
    });
    return map;
  }, [employees]);

  const getEmployeeToneForEvent = useCallback(
    (event: CalendarEventRecord): EmployeeToneStyle => {
      const employeeId = String(event.resourceId || event.booking?.staff_id || '');
      if (employeeId && employeeToneById[employeeId]) return employeeToneById[employeeId];

      if (employeeId) {
        const hue = hashValue(employeeId) % 360;
        return toneFromHsl(hue);
      }

      return DEFAULT_EMPLOYEE_TONE;
    },
    [employeeToneById]
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

  const activeServices = useMemo(() => {
    return (services || []).filter((row) => row.is_active !== false);
  }, [services]);

  const selectedServiceForCreate = useMemo(() => {
    if (filters.serviceId !== 'all') {
      const picked = services.find((row) => String(row.id) === String(filters.serviceId));
      if (picked) return picked;
    }
    return activeServices[0] || services[0] || null;
  }, [activeServices, services, filters.serviceId]);

  const hasAssignments = useMemo(() => {
    return (staffServices || []).some((row) => String(row.staff_id || '') && String(row.service_id || ''));
  }, [staffServices]);

  const assignmentSet = useMemo(() => {
    return new Set(
      (staffServices || [])
        .map((row) => {
          const staffId = String(row.staff_id || '');
          const serviceId = String(row.service_id || '');
          if (!staffId || !serviceId) return '';
          return `${staffId}:${serviceId}`;
        })
        .filter(Boolean)
    );
  }, [staffServices]);

  const visibleEmployeeIds = useMemo(() => {
    if (isMobile) {
      if (filters.employeeSingle !== 'all') return [String(filters.employeeSingle)];
      return employees.map((row) => String(row.id));
    }
    if (filters.employeeIds.length > 0) return filters.employeeIds.map((id) => String(id));
    return employees.map((row) => String(row.id));
  }, [employees, filters.employeeIds, filters.employeeSingle, isMobile]);

  const employeeIdSet = useMemo(() => {
    return new Set((employees || []).map((row) => String(row.id)));
  }, [employees]);

  const isEmployeeEligibleForService = useCallback(
    (employeeId: string, serviceId: string) => {
      if (!employeeId) return false;
      if (!serviceId) return true;
      if (!hasAssignments) return true;
      return assignmentSet.has(`${employeeId}:${serviceId}`);
    },
    [assignmentSet, hasAssignments]
  );

  const getCandidateEmployeeIds = useCallback(
    (slotInfo: CreateSlotInfo, serviceId: string) => {
      const fromResource = slotInfo?.resourceId != null ? [String(slotInfo.resourceId)] : [];
      const base = fromResource.length > 0 ? fromResource : visibleEmployeeIds;
      const unique = Array.from(new Set(base.filter(Boolean)));
      return unique.filter((employeeId) => employeeIdSet.has(employeeId) && isEmployeeEligibleForService(employeeId, serviceId));
    },
    [visibleEmployeeIds, employeeIdSet, isEmployeeEligibleForService]
  );

  const findBookableEmployeeForSlot = useCallback(
    (slotInfo: CreateSlotInfo, service: ServiceRow | null) => {
      if (!service) return null;

      const start = snapDate(slotInfo.start || new Date());
      const duration = Math.max(5, Number(service.duration_minutes || 30));
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + duration);
      const employeeIds = getCandidateEmployeeIds(slotInfo, String(service.id || ''));
      if (!employeeIds.length) return null;

      for (const employeeId of employeeIds) {
        const validation = validateBooking({
          employeeId,
          start,
          end,
          bookings,
          timeOff,
          salonHours,
          employeeHours,
          t
        });
        if (validation.ok) {
          return {employeeId, start, end, duration};
        }
      }

      return null;
    },
    [bookings, timeOff, salonHours, employeeHours, t, getCandidateEmployeeIds]
  );

  const canSelectSlot = useCallback(
    (slotInfo: CreateSlotInfo) => {
      if (writeLocked) return false;
      if (!selectedServiceForCreate) return false;
      if (!slotInfo?.start) return false;
      return Boolean(findBookableEmployeeForSlot(slotInfo, selectedServiceForCreate));
    },
    [writeLocked, selectedServiceForCreate, findBookableEmployeeForSlot]
  );

  const openCreateDraft = useCallback(
    (input?: {start?: Date; service?: ServiceRow | null; employeeId?: string}) => {
      if (writeLocked) return;

      const service = input?.service || selectedServiceForCreate || activeServices[0] || services[0] || null;

      const duration = Math.max(5, Number(service?.duration_minutes || 30));
      const providedStart = input?.start ? snapDate(input.start) : null;
      const now = snapDate(new Date());
      const start = providedStart && providedStart.getTime() > now.getTime() ? providedStart : now;
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + duration);

      const scopedEmployeeIds =
        isMobile && String(filters.employeeSingle || '') !== 'all'
          ? [String(filters.employeeSingle)]
          : visibleEmployeeIds.map((id) => String(id));
      const eligibleEmployeeIds = scopedEmployeeIds.filter(
        (employeeId) =>
          employeeIdSet.has(String(employeeId)) &&
          isEmployeeEligibleForService(String(employeeId), String(service?.id || ''))
      );
      const employeeId = String(input?.employeeId || eligibleEmployeeIds[0] || '');

      setError('');
      setDrawerMode('create');
      setSelectedBooking({
        start,
        end,
        service_id: String(service?.id || ''),
        employee_id: employeeId,
        status: 'pending',
        duration
      });
      setDrawerOpen(true);
    },
    [
      writeLocked,
      selectedServiceForCreate,
      activeServices,
      services,
      isMobile,
      filters.employeeSingle,
      visibleEmployeeIds,
      employeeIdSet,
      isEmployeeEligibleForService
    ]
  );

  const unavailableBackgroundEvents = useMemo(() => {
    if (view === Views.AGENDA) return [] as CalendarBackgroundBlock[];
    if (!selectedServiceForCreate || !range?.start || !range?.end) return [] as CalendarBackgroundBlock[];

    const slotStepMinutes = 10;
    const serviceDuration = Math.max(slotStepMinutes, Number(selectedServiceForCreate.duration_minutes || 30));
    const serviceId = String(selectedServiceForCreate.id || '');
    const minMinutes = minTime.getHours() * 60 + minTime.getMinutes();
    const maxMinutes = maxTime.getHours() * 60 + maxTime.getMinutes();
    if (maxMinutes <= minMinutes) return [] as CalendarBackgroundBlock[];

    const dayStart = startOfDay(range.start);
    const endDayBase = startOfDay(range.end);
    const endDayExclusive = endDayBase.getTime() <= dayStart.getTime() ? addDays(dayStart, 1) : endDayBase;

    const scopedEmployeeIds = visibleEmployeeIds.filter((id) => employeeIdSet.has(String(id)));
    const resourceScopes = allEmployeesSelected ? [null] : scopedEmployeeIds;
    if (!allEmployeesSelected && resourceScopes.length === 0) return [] as CalendarBackgroundBlock[];

    const rawBlocks: Array<{start: Date; end: Date; resourceId?: string}> = [];
    let dayCursor = new Date(dayStart);

    while (dayCursor < endDayExclusive) {
      for (let minute = minMinutes; minute + slotStepMinutes <= maxMinutes; minute += slotStepMinutes) {
        const start = setDayMinutes(dayCursor, minute);
        const endForSlot = setDayMinutes(dayCursor, minute + slotStepMinutes);
        const endForBooking = new Date(start);
        endForBooking.setMinutes(endForBooking.getMinutes() + serviceDuration);

        if (allEmployeesSelected) {
          const eligibleEmployeeIds = scopedEmployeeIds.filter((employeeId) =>
            isEmployeeEligibleForService(employeeId, serviceId)
          );

          const isUnavailable =
            eligibleEmployeeIds.length === 0 ||
            eligibleEmployeeIds.every((employeeId) => {
              const validation = validateBooking({
                employeeId,
                start,
                end: endForBooking,
                bookings,
                timeOff,
                salonHours,
                employeeHours
              });
              return !validation.ok;
            });

          if (isUnavailable) {
            rawBlocks.push({start, end: endForSlot});
          }
          continue;
        }

        for (const employeeId of resourceScopes as string[]) {
          let isUnavailable = true;
          if (isEmployeeEligibleForService(employeeId, serviceId)) {
            const validation = validateBooking({
              employeeId,
              start,
              end: endForBooking,
              bookings,
              timeOff,
              salonHours,
              employeeHours
            });
            isUnavailable = !validation.ok;
          }

          if (isUnavailable) {
            rawBlocks.push({start, end: endForSlot, resourceId: employeeId});
          }
        }
      }

      dayCursor = addDays(dayCursor, 1);
    }

    return mergeUnavailableBlocks(rawBlocks);
  }, [
    view,
    selectedServiceForCreate,
    range.start,
    range.end,
    minTime,
    maxTime,
    visibleEmployeeIds,
    employeeIdSet,
    allEmployeesSelected,
    isEmployeeEligibleForService,
    bookings,
    timeOff,
    salonHours,
    employeeHours
  ]);

  const openCreate = useCallback(
    (slotInfo: CreateSlotInfo) => {
      if (writeLocked) return;

      const selectedService = selectedServiceForCreate;
      if (!selectedService) {
        setError(t('calendar.errors.noServices', 'Add at least one active service before creating bookings.'));
        return;
      }

      const match = findBookableEmployeeForSlot(slotInfo, selectedService);
      if (!match) {
        if (!isMobile) {
          setError(
            t(
              'calendar.errors.unavailableSlot',
              'This time slot is not bookable for the selected scope. Choose another available slot.'
            )
          );
        }
        return;
      }

      setError('');
      setDrawerMode('create');
      setSelectedBooking({
        start: match.start,
        end: match.end,
        service_id: selectedService.id,
        employee_id: match.employeeId,
        status: 'pending',
        duration: match.duration
      });
      setDrawerOpen(true);
    },
    [writeLocked, selectedServiceForCreate, findBookableEmployeeForSlot, t, isMobile]
  );

  const openEdit = useCallback((event: CalendarEventRecord) => {
    setDrawerMode('edit');
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
      duration: Math.max(5, Math.round((event.end.getTime() - event.start.getTime()) / 60000))
    });
    setDrawerOpen(true);
  }, []);

  const saveBooking = useCallback(
    async (draft: {
      id: string;
      customer_name: string;
      customer_phone: string;
      service_id: string;
      employee_id: string;
      status: string;
      notes: string;
      start: Date;
      end: Date;
      duration: number;
    }) => {
      if (!supabase || !salon?.id) return;

      if (!isEmployeeEligibleForService(String(draft.employee_id || ''), String(draft.service_id || ''))) {
        setError(t('calendar.errors.invalidServiceStaff', 'Selected employee does not provide this service.'));
        return;
      }

      const validation = validateBooking({
        employeeId: draft.employee_id,
        start: draft.start,
        end: draft.end,
        bookings,
        timeOff,
        salonHours,
        employeeHours,
        excludeBookingId: draft.id,
        t
      });

      if (!validation.ok) {
        setError(validation.reason || t('calendar.errors.invalid', 'Invalid booking'));
        return;
      }

      setError('');
      if (drawerMode === 'create') {
        const payload = toBookingPayloadFromDraft(draft, salon.id);
        const optimisticId = `tmp-${Date.now()}`;
        const optimisticRow = {...payload, id: optimisticId};
        setBookings((prev) => [...prev, optimisticRow as unknown as BookingRow]);

        const insertRes = await supabase.from('bookings').insert([payload]).select('*').single();
        if (insertRes.error) {
          setBookings((prev) => prev.filter((row) => String(row.id) !== optimisticId));
          setError(`${t('calendar.errors.save', 'Failed to save booking')}: ${insertRes.error.message}`);
          return;
        }

        setBookings((prev) => prev.map((row) => (String(row.id) === optimisticId ? (insertRes.data as BookingRow) : row)));
        void fetch('/api/notify-booking-event', {
          method: 'POST',
          headers: {'content-type': 'application/json'},
          body: JSON.stringify({
            salonId: salon.id,
            bookingId: String((insertRes.data as any)?.id || ''),
            title: 'New booking',
            body: `${draft.customer_name} • ${draft.start.toISOString()}`
          })
        }).catch(() => undefined);
      } else {
        const payload = {
          customer_name: draft.customer_name,
          customer_phone: draft.customer_phone,
          service_id: draft.service_id,
          staff_id: draft.employee_id,
          appointment_start: draft.start.toISOString(),
          appointment_end: draft.end.toISOString(),
          status: draft.status,
          notes: draft.notes || null
        };

        const previous = bookings.find((row) => String(row.id) === String(draft.id)) || null;
        setBookings((prev) => prev.map((row) => (String(row.id) === String(draft.id) ? ({...row, ...payload} as BookingRow) : row)));

        const updateRes = await supabase
          .from('bookings')
          .update(payload)
          .eq('id', draft.id)
          .eq('salon_id', salon.id)
          .select('*')
          .single();

        if (updateRes.error) {
          setBookings((prev) => prev.map((row) => (String(row.id) === String(draft.id) ? ((previous as BookingRow) || row) : row)));
          setError(`${t('calendar.errors.update', 'Failed to update booking')}: ${updateRes.error.message}`);
          return;
        }

        setBookings((prev) => prev.map((row) => (String(row.id) === String(draft.id) ? (updateRes.data as BookingRow) : row)));
        void fetch('/api/notify-booking-event', {
          method: 'POST',
          headers: {'content-type': 'application/json'},
          body: JSON.stringify({
            salonId: salon.id,
            bookingId: String(draft.id),
            title: 'Booking updated',
            body: `${draft.customer_name} • ${draft.start.toISOString()}`
          })
        }).catch(() => undefined);
      }

      setDrawerOpen(false);
      setSelectedBooking(null);
      await onChanged?.();
    },
    [supabase, salon?.id, bookings, timeOff, salonHours, employeeHours, t, drawerMode, onChanged, isEmployeeEligibleForService]
  );

  const deleteBooking = useCallback(
    async (draft: {id: string}) => {
      if (!supabase || !salon?.id || !draft?.id) return;

      const previous = bookings;
      setBookings((prev) => prev.filter((row) => String(row.id) !== String(draft.id)));

      const deleteRes = await supabase.from('bookings').update({status: 'cancelled'}).eq('id', draft.id).eq('salon_id', salon.id);
      if (deleteRes.error) {
        setBookings(previous);
        setError(`${t('calendar.errors.delete', 'Failed to cancel booking')}: ${deleteRes.error.message}`);
        return;
      }

      void fetch('/api/notify-booking-event', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({
          salonId: salon.id,
          bookingId: String(draft.id),
          title: 'Booking cancelled',
          body: `Booking ${draft.id} was cancelled`
        })
      }).catch(() => undefined);

      setDrawerOpen(false);
      setSelectedBooking(null);
      await onChanged?.();
    },
    [supabase, salon?.id, bookings, t, onChanged]
  );

  const handleDrop = useCallback(
    async ({event, start, end, resourceId}: {event: CalendarEventRecord; start: Date; end: Date; resourceId?: string}) => {
      if (writeLocked) return;
      const employeeId = String(resourceId || event.resourceId || '');
      const serviceId = String(event.booking?.service_id || '');

      if (!isEmployeeEligibleForService(employeeId, serviceId)) {
        setError(t('calendar.errors.invalidServiceStaff', 'Selected employee does not provide this service.'));
        return;
      }

      const validation = validateBooking({
        employeeId,
        start,
        end,
        bookings,
        timeOff,
        salonHours,
        employeeHours,
        excludeBookingId: event.id,
        t
      });
      if (!validation.ok) {
        setError(validation.reason || t('calendar.errors.overlap', 'Conflict detected'));
        return;
      }

      setError('');
      setDrawerMode('edit');
      setSelectedBooking({
        id: event.id,
        customer_name: event.customerName,
        customer_phone: event.customerPhone,
        service_id: event.booking?.service_id,
        employee_id: employeeId,
        status: event.status,
        notes: event.notes,
        start,
        end,
        duration: Math.max(5, Math.round((end.getTime() - start.getTime()) / 60000))
      });
      setDrawerOpen(true);
    },
    [writeLocked, bookings, timeOff, salonHours, employeeHours, t, isEmployeeEligibleForService]
  );

  const calendarMessages = useMemo(
    () => ({
      date: t('calendar.labels.date', 'Date'),
      time: t('calendar.labels.time', 'Time'),
      event: t('calendar.labels.event', 'Event'),
      allDay: t('calendar.labels.allDay', 'All Day'),
      week: t('calendar.views.week', 'Week'),
      day: t('calendar.views.day', 'Day'),
      agenda: t('calendar.views.agenda', 'Agenda'),
      previous: t('calendar.toolbar.prev', 'Prev'),
      next: t('calendar.toolbar.next', 'Next'),
      today: t('calendar.toolbar.today', 'Today'),
      noEventsInRange: t('calendar.labels.noEvents', 'No events in this range')
    }),
    [t]
  );

  return (
    <Card className="calendar-root-card">
      <div className="calendar-shell" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        {loading ? <div className="calendar-loading">{t('common.loading', 'Loading...')}</div> : null}
        {error ? <p className="muted" style={{color: 'var(--danger)'}}>{error}</p> : null}

        <DndProvider backend={HTML5Backend}>
          <AnyDnDCalendar
            localizer={localizer}
            culture={currentLang}
            events={filteredEvents}
            backgroundEvents={unavailableBackgroundEvents}
            resources={allEmployeesSelected ? undefined : resources}
            resourceIdAccessor="resourceId"
            resourceTitleAccessor="resourceTitle"
            date={date}
            view={resolvedView as any}
            views={availableViews as any}
            dayLayoutAlgorithm={isMobile ? 'no-overlap' : 'overlap'}
            step={10}
            timeslots={6}
            selectable={writeLocked ? false : 'ignoreEvents'}
            longPressThreshold={1}
            popup
            showMultiDayTimes
            min={minTime}
            max={maxTime}
            messages={calendarMessages}
            onView={(nextView: unknown) => {
              const parsed = String(nextView);
              if (isMobile && parsed === Views.WEEK) {
                setView(Views.DAY);
                return;
              }
              setView(parsed);
            }}
            onNavigate={(nextDate: unknown) => setDate(nextDate as Date)}
            onRangeChange={(nextRange: unknown) => {
              const parsed = toDateRangeParams(nextRange, resolvedView);
              if (parsed?.start && parsed?.end) {
                setRange((prev) => {
                  const nextStart = parsed.start.getTime();
                  const nextEnd = parsed.end.getTime();
                  if (prev.start.getTime() === nextStart && prev.end.getTime() === nextEnd) {
                    return prev;
                  }
                  return parsed;
                });
              }
            }}
            onSelectEvent={(event: unknown) => {
              const row = event as {kind?: string};
              if (row?.kind === 'unavailable') return;
              openEdit(event as CalendarEventRecord);
            }}
            onSelecting={(slotInfo: unknown) => canSelectSlot(slotInfo as CreateSlotInfo)}
            onSelectSlot={(slotInfo: unknown) => {
              const parsed = slotInfo as CreateSlotInfo;
              if (!canSelectSlot(parsed)) return;
              openCreate(parsed);
            }}
            onEventDrop={(dropInfo: unknown) => void handleDrop(dropInfo as {event: CalendarEventRecord; start: Date; end: Date; resourceId?: string})}
            draggableAccessor={() => !writeLocked}
            eventPropGetter={(event: unknown) => {
              const row = event as CalendarEventRecord;
              const status = String(row.status || 'pending');
              const toneStyle = getEmployeeToneForEvent(row);
              return {className: `rbc-event-status-${status} calendar-employee-tone`, style: toneStyle};
            }}
            backgroundEventPropGetter={(event: unknown) => {
              const row = event as {kind?: string};
              if (row.kind === 'unavailable') {
                return {className: 'calendar-unavailable-bg'};
              }
              return {};
            }}
            components={{
              toolbar: (props: any) => (
                <CalendarToolbar
                  label={String(props.label || '')}
                  employeeScopeLabel={employeeScopeLabel}
                  onNavigate={(action) => props.onNavigate(action)}
                  onView={(nextView) => props.onView(nextView)}
                  view={String(props.view || resolvedView)}
                  t={t}
                  isMobile={isMobile}
                  filters={filters}
                  employees={employees}
                  services={services}
                  setFilter={setFilter}
                />
              ),
              resourceHeader: (props: {label?: string; resource?: {name?: string; photo_url?: string | null}}) => (
                <ResourceHeader label={props.label} resource={props.resource} />
              ),
              event: (props: any) => (
                <CalendarEvent
                  event={props.event as CalendarEventRecord}
                  toneStyle={getEmployeeToneForEvent(props.event as CalendarEventRecord)}
                />
              ),
              agenda: {
                event: (props: {event: CalendarEventRecord}) => (
                  <CalendarEvent event={props.event} toneStyle={getEmployeeToneForEvent(props.event)} />
                )
              }
            }}
          />
        </DndProvider>

        {isMobile ? (
          <button
            type="button"
            className="calendar-fab"
            onClick={() => openCreateDraft({start: new Date()})}
          >
            {t('calendar.actions.addBooking', '+ Add booking')}
          </button>
        ) : null}

        <BookingDrawer
          open={drawerOpen}
          mode={drawerMode}
          initialData={selectedBooking as any}
          employees={employees}
          services={services}
          staffServices={staffServices}
          writeLocked={writeLocked}
          t={t}
          onClose={() => {
            setDrawerOpen(false);
            setSelectedBooking(null);
          }}
          onSave={saveBooking as any}
          onDelete={deleteBooking as any}
        />
      </div>
    </Card>
  );
}
