'use client';

import {useEffect, useMemo, useState, type FormEvent} from 'react';
import {useLocale} from 'next-intl';
import {z} from 'zod';
import {createBrowserSupabaseClient} from '@/lib/supabase/browser';
import SafeImage from '@/components/SafeImage';
import {useTx} from '@/lib/messages-client';
import {
  combineDateTime,
  generateSlots,
  isValidE164WithoutPlus,
  normalizePhone,
  SLOT_STEP_MINUTES,
  toDateInput
} from '@/lib/booking';
import {formatSalonOperationalCurrency} from '@/lib/format';
import {getDefaultAvatar, getInitials, getServiceImage} from '@/lib/media';
import type {
  EmployeeHourRow,
  SalonHourRow,
  SalonRow,
  ServiceRow,
  StaffRow,
  StaffServiceRow
} from '@/lib/data/public';

type BookingFormProps = {
  salon: SalonRow;
  services: ServiceRow[];
  staff: StaffRow[];
  staffServices: StaffServiceRow[];
  hours: SalonHourRow[];
  employeeHours: EmployeeHourRow[];
};

type Slot = {
  startIso: string;
  endIso: string;
  staffId: string;
};

const bookingSchema = z.object({
  customerName: z.string().trim().min(2),
  customerPhone: z.string().trim().refine((value) => isValidE164WithoutPlus(normalizePhone(value)), {
    message: 'invalid_phone'
  })
});

function formatTime(iso: string, locale = 'en-US', timezone = 'UTC') {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--';

  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone
  }).format(date);
}

function formatDateTime(iso: string, locale = 'en-US', timezone = 'UTC') {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone
  }).format(date);
}

function toMinutes(value: string | null | undefined): number {
  const [h, m] = String(value || '00:00')
    .slice(0, 5)
    .split(':')
    .map((part) => Number(part || 0));
  return h * 60 + m;
}

export default function BookingForm({
  salon,
  services,
  staff,
  staffServices,
  hours,
  employeeHours
}: BookingFormProps) {
  const locale = useLocale();
  const tx = useTx();
  const t = (key: string, vars?: Record<string, string | number | boolean | null | undefined>) =>
    tx(`booking.${key}`, key, vars);
  const tCommon = (key: string, vars?: Record<string, string | number | boolean | null | undefined>) =>
    tx(`common.${key}`, key, vars);
  const [mounted, setMounted] = useState(false);

  const [serviceId, setServiceId] = useState<string>('');
  const [staffId, setStaffId] = useState<string>('');
  const [dateValue, setDateValue] = useState<string>('');
  const [slotIso, setSlotIso] = useState<string>('');
  const [dayBookings, setDayBookings] = useState<Array<{staff_id: string; appointment_start: string; appointment_end: string}>>([]);
  const [dayTimeOff, setDayTimeOff] = useState<Array<{staff_id: string; start_at: string; end_at: string}>>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);

  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<null | {id: string; appointment: string; staff: string; service: string}>(null);

  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!serviceId) setServiceId(services[0]?.id || '');
    if (!staffId) setStaffId(staff[0]?.id || '');
    if (!dateValue) setDateValue(toDateInput(new Date()));
  }, [mounted, serviceId, staffId, dateValue, services, staff]);

  const servicesById = useMemo(() => Object.fromEntries(services.map((item) => [item.id, item])), [services]);
  const staffById = useMemo(() => Object.fromEntries(staff.map((item) => [item.id, item])), [staff]);

  const assignmentSet = useMemo(() => {
    return new Set(staffServices.map((item) => `${item.staff_id}:${item.service_id}`));
  }, [staffServices]);

  const bookingMode = salon.booking_mode === 'auto_assign' ? 'auto_assign' : 'choose_employee';
  const selectedService = servicesById[serviceId] || null;
  const selectedStaff = staffById[staffId] || null;

  const filteredStaff = useMemo(() => {
    if (!serviceId) return staff;
    return staff.filter((item) => assignmentSet.has(`${item.id}:${serviceId}`));
  }, [serviceId, staff, assignmentSet]);

  const filteredServices = useMemo(() => {
    if (bookingMode === 'auto_assign') return services;
    if (!staffId) return services;
    return services.filter((item) => assignmentSet.has(`${staffId}:${item.id}`));
  }, [bookingMode, services, staffId, assignmentSet]);

  const eligibleStaffIds = useMemo(() => filteredStaff.map((item) => item.id), [filteredStaff]);

  const isValidPair = bookingMode === 'auto_assign'
    ? Boolean(serviceId && eligibleStaffIds.length > 0)
    : Boolean(serviceId && staffId && assignmentSet.has(`${staffId}:${serviceId}`));

  useEffect(() => {
    if (serviceId && !filteredServices.some((row) => row.id === serviceId)) {
      setServiceId(filteredServices[0]?.id || '');
    }
  }, [serviceId, filteredServices]);

  useEffect(() => {
    if (bookingMode === 'auto_assign') return;
    if (staffId && !filteredStaff.some((row) => row.id === staffId)) {
      setStaffId(filteredStaff[0]?.id || '');
    }
  }, [bookingMode, staffId, filteredStaff]);

  useEffect(() => {
    setSlotIso('');
  }, [serviceId, staffId, dateValue, bookingMode]);

  useEffect(() => {
    async function loadDayLoad() {
      if (!supabase || !salon.id || !dateValue || !isValidPair) {
        setDayBookings([]);
        setDayTimeOff([]);
        return;
      }

      const targetStaffIds = bookingMode === 'auto_assign' ? eligibleStaffIds : [staffId].filter(Boolean);
      if (!targetStaffIds.length) {
        setDayBookings([]);
        setDayTimeOff([]);
        return;
      }

      setLoadingSlots(true);
      setError('');

      try {
        const dayStart = combineDateTime(dateValue, '00:00');
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const [bookingsRes, timeOffRes] = await Promise.all([
          supabase
            .from('bookings')
            .select('staff_id,appointment_start,appointment_end,status')
            .eq('salon_id', salon.id)
            .in('staff_id', targetStaffIds)
            .in('status', ['pending', 'confirmed'])
            .lt('appointment_start', dayEnd.toISOString())
            .gt('appointment_end', dayStart.toISOString()),
          supabase
            .from('employee_time_off')
            .select('staff_id,start_at,end_at')
            .eq('salon_id', salon.id)
            .in('staff_id', targetStaffIds)
            .lt('start_at', dayEnd.toISOString())
            .gt('end_at', dayStart.toISOString())
        ]);

        if (bookingsRes.error) throw bookingsRes.error;
        if (timeOffRes.error) throw timeOffRes.error;

        setDayBookings((bookingsRes.data || []) as Array<{staff_id: string; appointment_start: string; appointment_end: string}>);
        setDayTimeOff((timeOffRes.data || []) as Array<{staff_id: string; start_at: string; end_at: string}>);
      } catch (loadError) {
        setError((loadError as Error)?.message || t('errors.loadSlots'));
      } finally {
        setLoadingSlots(false);
      }
    }

    void loadDayLoad();
  }, [
    supabase,
    salon.id,
    dateValue,
    isValidPair,
    bookingMode,
    eligibleStaffIds,
    staffId,
    t
  ]);

  const hoursByDay = useMemo(() => {
    const map: Record<number, SalonHourRow> = {};
    for (const row of hours) map[row.day_of_week] = row;
    return map;
  }, [hours]);

  const employeeHoursByStaffDay = useMemo(() => {
    const map: Record<string, EmployeeHourRow> = {};
    for (const row of employeeHours) {
      const key = `${row.staff_id}:${row.day_of_week}`;
      if (!map[key]) {
        map[key] = row;
      }
    }
    return map;
  }, [employeeHours]);

  const availableSlots = useMemo(() => {
    if (!selectedService || !dateValue || !isValidPair) return [] as Slot[];

    const dayDate = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(dayDate.getTime())) return [];

    const dayIndex = dayDate.getDay();
    const dayRule = hoursByDay[dayIndex] || null;
    const nowMs = Date.now();

    if (bookingMode === 'auto_assign') {
      const byStart = new Map<string, Slot>();

      for (const staffRow of filteredStaff) {
        const generated = generateSlots({
          date: dateValue,
          dayRule,
          employeeRule: employeeHoursByStaffDay[`${staffRow.id}:${dayIndex}`] || null,
          durationMinutes: selectedService.duration_minutes,
          bookings: dayBookings.filter((item) => item.staff_id === staffRow.id),
          timeOff: dayTimeOff.filter((item) => item.staff_id === staffRow.id),
          nowMs
        });

        for (const slot of generated) {
          if (!byStart.has(slot.startIso)) {
            byStart.set(slot.startIso, {
              ...slot,
              staffId: staffRow.id
            });
          }
        }
      }

      return Array.from(byStart.values()).sort((a, b) => a.startIso.localeCompare(b.startIso));
    }

    const generated = generateSlots({
      date: dateValue,
      dayRule,
      employeeRule: employeeHoursByStaffDay[`${staffId}:${dayIndex}`] || null,
      durationMinutes: selectedService.duration_minutes,
      bookings: dayBookings.filter((item) => item.staff_id === staffId),
      timeOff: dayTimeOff.filter((item) => item.staff_id === staffId),
      nowMs
    });

    return generated.map((slot) => ({...slot, staffId}));
  }, [
    selectedService,
    dateValue,
    isValidPair,
    hoursByDay,
    bookingMode,
    filteredStaff,
    employeeHoursByStaffDay,
    dayBookings,
    dayTimeOff,
    staffId
  ]);

  useEffect(() => {
    if (slotIso && !availableSlots.some((slot) => slot.startIso === slotIso)) {
      setSlotIso('');
    }
  }, [slotIso, availableSlots]);

  async function verifySlotStillAvailable(targetStaffId: string, selectedSlot: Slot) {
    if (!supabase || !salon.id || !selectedService) return {ok: false, reason: t('errors.slotUnavailable')};

    const dayDate = new Date(`${dateValue}T00:00:00`);
    const dayIndex = dayDate.getDay();
    const dayRule = hoursByDay[dayIndex];

    if (!dayRule || dayRule.is_closed) {
      return {ok: false, reason: t('errors.closedDay')};
    }

    const startAt = new Date(selectedSlot.startIso);
    const endAt = new Date(selectedSlot.endIso);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
      return {ok: false, reason: t('errors.slotUnavailable')};
    }

    const slotStartMin = startAt.getHours() * 60 + startAt.getMinutes();
    const slotEndMin = endAt.getHours() * 60 + endAt.getMinutes();
    if (slotStartMin < toMinutes(dayRule.open_time) || slotEndMin > toMinutes(dayRule.close_time)) {
      return {ok: false, reason: t('errors.closedHour')};
    }

    const [employeeRes, bookingRes, timeOffRes] = await Promise.all([
      supabase
        .from('employee_hours')
        .select('start_time,end_time,is_off,break_start,break_end')
        .eq('salon_id', salon.id)
        .eq('staff_id', targetStaffId)
        .eq('day_of_week', dayIndex),
      supabase
        .from('bookings')
        .select('id')
        .eq('salon_id', salon.id)
        .eq('staff_id', targetStaffId)
        .in('status', ['pending', 'confirmed'])
        .lt('appointment_start', selectedSlot.endIso)
        .gt('appointment_end', selectedSlot.startIso)
        .limit(1),
      supabase
        .from('employee_time_off')
        .select('id')
        .eq('salon_id', salon.id)
        .eq('staff_id', targetStaffId)
        .lt('start_at', selectedSlot.endIso)
        .gt('end_at', selectedSlot.startIso)
        .limit(1)
    ]);

    if (employeeRes.error) throw employeeRes.error;
    if (bookingRes.error) throw bookingRes.error;
    if (timeOffRes.error) throw timeOffRes.error;

    const staffRule = (employeeRes.data?.[0] || null) as
      | {
          start_time: string | null;
          end_time: string | null;
          is_off: boolean;
          break_start: string | null;
          break_end: string | null;
        }
      | null;
    if (staffRule?.is_off) {
      return {ok: false, reason: t('errors.staffOff')};
    }

    if (staffRule) {
      const staffStart = toMinutes(staffRule.start_time || dayRule.open_time);
      const staffEnd = toMinutes(staffRule.end_time || dayRule.close_time);
      if (slotStartMin < staffStart || slotEndMin > staffEnd) {
        return {ok: false, reason: t('errors.staffHour')};
      }

      const breakStart = staffRule.break_start ? toMinutes(staffRule.break_start) : null;
      const breakEnd = staffRule.break_end ? toMinutes(staffRule.break_end) : null;
      if (
        Number.isFinite(breakStart) &&
        Number.isFinite(breakEnd) &&
        (breakEnd as number) > (breakStart as number) &&
        slotStartMin < (breakEnd as number) &&
        slotEndMin > (breakStart as number)
      ) {
        return {ok: false, reason: t('errors.staffBreak')};
      }
    }

    if ((bookingRes.data || []).length > 0) {
      return {ok: false, reason: t('errors.slotTaken')};
    }

    if ((timeOffRes.data || []).length > 0) {
      return {ok: false, reason: t('errors.staffOffTime')};
    }

    return {ok: true};
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!supabase || !selectedService) {
      setError(t('errors.misconfigured'));
      return;
    }

    const selectedSlot = availableSlots.find((item) => item.startIso === slotIso);
    const selectedStaffBySlot = selectedSlot ? staffById[selectedSlot.staffId] : null;
    const resolvedStaff = selectedStaffBySlot || selectedStaff;

    if (!selectedSlot || !resolvedStaff) {
      setError(t('errors.slotUnavailable'));
      return;
    }

    const parsed = bookingSchema.safeParse({customerName, customerPhone});
    if (!parsed.success) {
      setError(t('errors.invalidForm'));
      return;
    }

    if (bookingMode === 'choose_employee' && !assignmentSet.has(`${resolvedStaff.id}:${selectedService.id}`)) {
      setError(t('errors.invalidServiceStaff'));
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const availabilityCheck = await verifySlotStillAvailable(resolvedStaff.id, selectedSlot);
      if (!availabilityCheck.ok) {
        setError(availabilityCheck.reason || t('errors.slotUnavailable'));
        return;
      }

      const normalizedPhone = normalizePhone(customerPhone);
      let clientId: string | null = null;

      const clientRes = await supabase
        .from('clients')
        .upsert(
          [
            {
              salon_id: salon.id,
              phone: normalizedPhone,
              name: customerName.trim()
            }
          ],
          {onConflict: 'salon_id,phone'}
        )
        .select('id')
        .single();

      if (clientRes.error) throw clientRes.error;
      clientId = clientRes.data?.id || null;

      const bookingRes = await supabase
        .from('bookings')
        .insert([
          {
            salon_id: salon.id,
            service_id: selectedService.id,
            staff_id: resolvedStaff.id,
            client_id: clientId,
            customer_name: customerName.trim(),
            customer_phone: normalizedPhone,
            notes: notes.trim() || null,
            status: 'pending',
            appointment_start: selectedSlot.startIso,
            appointment_end: selectedSlot.endIso,
            price_amount: Number(selectedService.price || 0),
            currency: String(salon.currency_code || 'USD').toUpperCase(),
            salon_slug: salon.slug,
            salon_whatsapp: normalizePhone(String(salon.whatsapp || '')),
            service: selectedService.name,
            staff: resolvedStaff.name,
            appointment_at: selectedSlot.startIso
          }
        ])
        .select('id,appointment_start')
        .single();

      if (bookingRes.error) throw bookingRes.error;

      const whatsapp = normalizePhone(String(salon.whatsapp || ''));
      if (isValidE164WithoutPlus(whatsapp)) {
        await supabase.functions.invoke('send-whatsapp', {
          body: {
            to: whatsapp,
            template: 'booking_created',
            params: [
              customerName.trim(),
              selectedService.name,
              formatDateTime(selectedSlot.startIso, undefined, salon.timezone || 'UTC'),
              normalizedPhone
            ]
          }
        });
      }

      setSuccess({
        id: bookingRes.data.id,
        appointment: bookingRes.data.appointment_start || selectedSlot.startIso,
        staff: resolvedStaff.name,
        service: selectedService.name
      });

      setNotes('');
      setSlotIso('');
    } catch (submitError) {
      setError((submitError as Error)?.message || t('errors.generic'));
    } finally {
      setSubmitting(false);
    }
  }

  const quickDates = useMemo(() => {
    return Array.from({length: 5}).map((_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + index);
      return {
        value: toDateInput(date),
        label: date.toLocaleDateString(locale.startsWith('ar') ? 'ar-IQ' : locale, {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        })
      };
    });
  }, [locale]);

  const currentStep =
    bookingMode === 'auto_assign'
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
    service: selectedService?.name || t('notSelected'),
    staff: bookingMode === 'auto_assign' ? t('autoAssignByAvailability') : selectedStaff?.name || t('notSelected'),
    price: selectedService ? formatSalonOperationalCurrency(selectedService.price, salon, locale) : '-',
    time: slotIso ? formatDateTime(slotIso, locale, salon.timezone || 'UTC') : t('pickTime')
  };

  if (!mounted) {
    return (
      <section className="booking-form-modern" aria-busy="true" aria-live="polite">
        <h3>{t('formTitle')}</h3>
        <div className="empty-box">{tCommon('loading')}</div>
      </section>
    );
  }

  if (success) {
    return (
      <section className="success-screen">
        <div className="success-icon">✓</div>
        <h3>{t('success.title')}</h3>
        <p>{t('success.message')}</p>
        <div className="success-details">
          <p><b>{t('success.id')}:</b> {success.id}</p>
          <p><b>{t('success.service')}:</b> {success.service}</p>
          <p><b>{t('success.staff')}:</b> {success.staff}</p>
          <p><b>{t('success.time')}:</b> {formatDateTime(success.appointment, locale, salon.timezone || 'UTC')}</p>
        </div>
        <div className="row-actions center">
          <button type="button" className="btn btn-secondary" onClick={() => setSuccess(null)}>
            {t('success.newBooking')}
          </button>
        </div>
      </section>
    );
  }

  return (
    <form className="booking-form-modern" onSubmit={submit}>
      <div className="steps-wrap full">
        <div className={`step-item${currentStep === 1 ? ' active' : ''}${serviceId ? ' done' : ''}`}>
          <span className="step-index">{serviceId ? '✓' : 1}</span>
          <b>{t('stepService')}</b>
        </div>
        <div
          className={`step-item${currentStep === 2 ? ' active' : ''}${
            bookingMode === 'auto_assign' ? (serviceId ? ' done' : '') : (staffId ? ' done' : '')
          }`}
        >
          <span className="step-index">{bookingMode === 'auto_assign' ? (serviceId ? '✓' : 2) : (staffId ? '✓' : 2)}</span>
          <b>{bookingMode === 'auto_assign' ? t('stepAutoAssign') : t('stepStaff')}</b>
        </div>
        <div className={`step-item${currentStep === 3 ? ' active' : ''}${slotIso ? ' done' : ''}`}>
          <span className="step-index">{slotIso ? '✓' : 3}</span>
          <b>{t('stepTime')}</b>
        </div>
      </div>

      <label className="field full">
        <span>{t('name')}</span>
        <input type="text" value={customerName} onChange={(event) => setCustomerName(event.target.value)} className="input" required />
      </label>

      <label className="field full">
        <span>{t('phone')}</span>
        <input
          type="tel"
          value={customerPhone}
          onChange={(event) => setCustomerPhone(event.target.value)}
          className="input"
          placeholder="07xxxxxxxxx"
          required
        />
      </label>

      <div className="field full">
        <span>{t('service')}</span>
        {filteredServices.length === 0 ? (
          <div className="empty-box">{t('noActiveServices')}</div>
        ) : (
          <div className="service-grid-compact">
            {filteredServices.map((service) => {
              const disabled = bookingMode === 'choose_employee' && Boolean(staffId) && !assignmentSet.has(`${staffId}:${service.id}`);
              const active = serviceId === service.id;

              return (
                <button
                  type="button"
                  key={service.id}
                  disabled={disabled}
                  className={`service-mini-card${active ? ' active' : ''}${disabled ? ' disabled' : ''}`}
                  onClick={() => setServiceId(service.id)}
                >
                  <SafeImage
                    src={service.image_url || getServiceImage(service.name)}
                    alt={service.name}
                    className="service-mini-image"
                    fallbackIcon="✨"
                    fallbackKey="service"
                  />
                  <div className="service-mini-meta">
                    <b>{service.name}</b>
                    <small>{t('minutes', {count: service.duration_minutes})}</small>
                    <span>{formatSalonOperationalCurrency(service.price, salon, locale)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {bookingMode === 'choose_employee' ? (
        <div className="field full">
          <span>{t('staff')}</span>
          {filteredStaff.length === 0 ? (
            <div className="empty-box">{t('noAssignedStaffForService')}</div>
          ) : (
            <div className="staff-avatar-grid">
              {filteredStaff.map((member) => {
                const active = staffId === member.id;
                return (
                  <button
                    type="button"
                    key={member.id}
                    className={`staff-avatar-card${active ? ' active' : ''}`}
                    onClick={() => setStaffId(member.id)}
                  >
                    <SafeImage
                      src={member.photo_url || getDefaultAvatar(member.id || member.name)}
                      alt={member.name}
                      className="staff-avatar-image"
                      fallbackText={getInitials(member.name)}
                      fallbackKey="staff"
                    />
                    <b>{member.name}</b>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="field full">
          <span>{t('staffAssignment')}</span>
          <div className="empty-box">{t('autoAssignNote')}</div>
        </div>
      )}

      <div className="field full">
        <span>{t('pickDay')}</span>
        <div className="quick-dates-wrap">
          {quickDates.map((day) => (
            <button
              type="button"
              key={day.value}
              className={`date-pill${dateValue === day.value ? ' active' : ''}`}
              onClick={() => setDateValue(day.value)}
            >
              {day.label}
            </button>
          ))}
        </div>
        <input type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value)} className="input" required />
      </div>

      <div className="field full">
        <span>{t('timeSlots', {step: SLOT_STEP_MINUTES})}</span>
        {!isValidPair ? (
          <div className="empty-box">{t('errors.invalidServiceStaff')}</div>
        ) : loadingSlots ? (
          <div className="slots-wrap">
            {Array.from({length: 4}).map((_, index) => (
              <div key={`slot-sk-${index}`} className="skeleton skeleton-slot" />
            ))}
          </div>
        ) : availableSlots.length === 0 ? (
          <div className="empty-box">{t('errors.noSlots')}</div>
        ) : (
          <div className="slots-wrap">
            {availableSlots.map((slot) => (
              <button
                key={slot.startIso}
                type="button"
                className={`slot-pill${slotIso === slot.startIso ? ' active' : ''}`}
                onClick={() => setSlotIso(slot.startIso)}
              >
                <b>{formatTime(slot.startIso, locale, salon.timezone || 'UTC')}</b>
              </button>
            ))}
          </div>
        )}
      </div>

      <label className="field full">
        <span>{t('notes')}</span>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="input textarea" rows={3} />
      </label>

      <section className="summary-card full">
        <h4>{t('summaryTitle')}</h4>
        <p><b>{t('service')}:</b> {summary.service}</p>
        <p><b>{t('staff')}:</b> {summary.staff}</p>
        <p><b>{t('price')}:</b> {summary.price}</p>
        <p><b>{t('time')}:</b> {summary.time}</p>
      </section>

      {error ? <p className="muted" style={{color: 'var(--danger)'}}>{error}</p> : null}

      <button type="submit" className="btn btn-primary full" disabled={submitting || !slotIso || !isValidPair}>
        {submitting ? tCommon('saving') : t('confirmBooking')}
      </button>
    </form>
  );
}
