import {StatusBar} from 'expo-status-bar';
import {LinearGradient} from 'expo-linear-gradient';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {Pressable, ScrollView, Text, useWindowDimensions, View} from 'react-native';
import type {Session, User} from '@supabase/supabase-js';
import {hasSupabaseConfig, supabase} from './src/lib/supabase';
import {toPhoneWithPlus} from './src/lib/phone';
import {resolveIdentitySession} from './src/lib/identity';
import {
  CALENDAR_SNAP_MINUTES,
  snapDate,
  validateBooking,
  type EmployeeHourRow,
  type WorkingHourRow
} from './src/lib/availability';
import {detectLocaleFromRuntime, isRtlLocale, tr, type LocaleCode} from './src/i18n';
import type {
  AccessRole,
  AuthMethod,
  BookingRow,
  BookingView,
  CreateDraft,
  DashboardTab,
  OnboardingDraft,
  OtpChannel,
  PendingMode,
  PendingMove,
  SalonProfile,
  ScreenState,
  ServiceRow,
  StaffRow,
  StaffServiceRow,
  TimeOffRow
} from './src/types';
import {PALETTE, PIXELS_PER_MINUTE, SLOT_STEP_MINUTES, TIMELINE_END_HOUR, TIMELINE_START_HOUR} from './src/constants';
import {
  addDays,
  atHour,
  endOfDay,
  formatDayTitle,
  mapValidationReasonToMessageKey,
  minutesFromDayStart,
  randomUuid,
  startOfDay,
  toStaffColor
} from './src/utils';
import {styles} from './src/styles';
import {LocaleSwitcher} from './src/components/LocaleSwitcher';
import {DraggableBookingCard} from './src/components/DraggableBookingCard';
import {AuthScreen} from './src/components/AuthScreen';
import {PendingScreen} from './src/components/PendingScreen';
import {CreateBookingDrawer} from './src/components/CreateBookingDrawer';

async function selectWorkingHoursWithFallback(salonId: string): Promise<{salonHours: WorkingHourRow[]; employeeHours: EmployeeHourRow[]}> {
  if (!supabase) return {salonHours: [], employeeHours: []};

  const salonPrimary = await supabase.from('salon_working_hours').select('*').eq('salon_id', salonId);
  const salonHoursRes = salonPrimary.error ? await supabase.from('salon_hours').select('*').eq('salon_id', salonId) : salonPrimary;

  const employeePrimary = await supabase.from('employee_working_hours').select('*').eq('salon_id', salonId);
  const employeeHoursRes = employeePrimary.error ? await supabase.from('employee_hours').select('*').eq('salon_id', salonId) : employeePrimary;

  return {
    salonHours: (salonHoursRes.data || []) as WorkingHourRow[],
    employeeHours: (employeeHoursRes.data || []) as EmployeeHourRow[]
  };
}

export default function App() {
  const {width} = useWindowDimensions();
  const isTablet = width >= 900;

  const [locale, setLocale] = useState<LocaleCode>(detectLocaleFromRuntime());
  const rtl = isRtlLocale(locale);
  const t = useCallback((key: string, params?: Record<string, string | number>) => tr(locale, key, params), [locale]);

  const [screen, setScreen] = useState<ScreenState>('loading');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('phone');
  const [role, setRole] = useState<AccessRole>('salon_admin');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpChannel, setOtpChannel] = useState<OtpChannel>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [pendingMode, setPendingMode] = useState<PendingMode>('approval');
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const [onboardingDraft, setOnboardingDraft] = useState<OnboardingDraft>({
    salonName: '',
    countryCode: 'IQ',
    city: '',
    whatsapp: '',
    adminPasscode: ''
  });

  const [session, setSession] = useState<Session | null>(null);
  const [salonProfile, setSalonProfile] = useState<SalonProfile | null>(null);

  const [tab, setTab] = useState<DashboardTab>('calendar');
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [selectedStaff, setSelectedStaff] = useState<string>('all');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');

  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [staffServices, setStaffServices] = useState<StaffServiceRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOffRow[]>([]);
  const [salonHours, setSalonHours] = useState<WorkingHourRow[]>([]);
  const [employeeHours, setEmployeeHours] = useState<EmployeeHourRow[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<CreateDraft | null>(null);
  const [savingCreate, setSavingCreate] = useState(false);

  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [savingMove, setSavingMove] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const staffColorById = useMemo(() => {
    const next: Record<string, string> = {};
    staff.forEach((member, index) => {
      next[String(member.id)] = toStaffColor(String(member.id), index);
    });
    return next;
  }, [staff]);

  const assignmentSet = useMemo(() => {
    return new Set(
      staffServices
        .map((row) => {
          const staffId = String(row.staff_id || '');
          const serviceId = String(row.service_id || '');
          return staffId && serviceId ? `${staffId}:${serviceId}` : '';
        })
        .filter(Boolean)
    );
  }, [staffServices]);

  const hasAssignments = useMemo(() => assignmentSet.size > 0, [assignmentSet]);

  const isEmployeeEligibleForService = useCallback(
    (employeeId: string, serviceId: string): boolean => {
      if (!employeeId) return false;
      if (!serviceId) return true;
      if (!hasAssignments) return true;
      return assignmentSet.has(`${employeeId}:${serviceId}`);
    },
    [assignmentSet, hasAssignments]
  );

  const activeServices = useMemo(() => services.filter((row) => row.is_active !== false), [services]);

  const selectedService = useMemo(() => {
    if (selectedServiceId) {
      const found = services.find((row) => String(row.id) === String(selectedServiceId));
      if (found) return found;
    }
    return activeServices[0] || services[0] || null;
  }, [activeServices, selectedServiceId, services]);

  const bookingsWithMove = useMemo(() => {
    if (!pendingMove) return bookings;
    return bookings.map((row) => {
      if (String(row.id) !== String(pendingMove.bookingId)) return row;
      return {
        ...row,
        staff_id: pendingMove.employeeId,
        appointment_start: pendingMove.start.toISOString(),
        appointment_end: pendingMove.end.toISOString()
      };
    });
  }, [bookings, pendingMove]);

  const bookingsView = useMemo<BookingView[]>(() => {
    const serviceById = new Map(services.map((row) => [String(row.id), row]));
    const staffById = new Map(staff.map((row) => [String(row.id), row]));

    const mapped = bookingsWithMove
      .map((row) => {
        const startsAt = new Date(row.appointment_start);
        const endsAt = new Date(row.appointment_end);
        if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return null;

        const staffId = String(row.staff_id || '');
        const serviceId = String(row.service_id || '');
        const serviceName = serviceById.get(serviceId)?.name || '-';
        const staffName = staffById.get(staffId)?.name || '-';
        const color = staffColorById[staffId] || '#64748b';

        return {
          id: String(row.id),
          customerName: String(row.customer_name || ''),
          customerPhone: String(row.customer_phone || ''),
          serviceName,
          serviceId,
          staffName,
          staffId,
          startsAt,
          endsAt,
          status: String(row.status || 'pending'),
          color
        } as BookingView;
      })
      .filter((row): row is BookingView => Boolean(row));

    if (selectedStaff === 'all') return mapped;
    return mapped.filter((row) => String(row.staffId) === String(selectedStaff));
  }, [bookingsWithMove, services, staff, selectedStaff, staffColorById]);

  const upcoming = useMemo(() => {
    return [...bookingsView].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }, [bookingsView]);

  const todayKpis = useMemo(() => {
    const total = bookingsView.length;
    const confirmed = bookingsView.filter((row) => row.status === 'confirmed').length;
    const pending = bookingsView.filter((row) => row.status === 'pending').length;
    const occupancy = Math.min(99, Math.round((total / 14) * 100));
    return {total, confirmed, pending, occupancy};
  }, [bookingsView]);

  const visibleEmployeeIds = useMemo(() => {
    if (selectedStaff !== 'all') return [selectedStaff];
    return staff.map((row) => String(row.id));
  }, [selectedStaff, staff]);

  const resolveBookableEmployee = useCallback(
    (start: Date, duration: number, serviceId: string, forcedEmployeeId?: string) => {
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + duration);

      const candidates = (forcedEmployeeId ? [forcedEmployeeId] : visibleEmployeeIds)
        .filter(Boolean)
        .filter((employeeId) => isEmployeeEligibleForService(employeeId, serviceId));

      if (!candidates.length) {
        return {ok: false as const, reason: 'outsideHours'};
      }

      for (const employeeId of candidates) {
        const validation = validateBooking({
          employeeId,
          start,
          end,
          bookings: bookingsWithMove,
          timeOff,
          salonHours,
          employeeHours
        });
        if (validation.ok) {
          return {
            ok: true as const,
            employeeId,
            start,
            end
          };
        }
      }

      const sampleValidation = validateBooking({
        employeeId: candidates[0],
        start,
        end,
        bookings: bookingsWithMove,
        timeOff,
        salonHours,
        employeeHours
      });

      return {
        ok: false as const,
        reason: mapValidationReasonToMessageKey(sampleValidation.reason || 'slotUnavailable')
      };
    },
    [bookingsWithMove, employeeHours, isEmployeeEligibleForService, salonHours, timeOff, visibleEmployeeIds]
  );

  const timelineSlots = useMemo(() => {
    const slots: Array<{start: Date; blocked: boolean}> = [];
    const base = startOfDay(selectedDate);
    const duration = Math.max(CALENDAR_SNAP_MINUTES, Number(selectedService?.duration_minutes || 30));

    for (let minute = TIMELINE_START_HOUR * 60; minute <= TIMELINE_END_HOUR * 60 - SLOT_STEP_MINUTES; minute += SLOT_STEP_MINUTES) {
      const start = new Date(base);
      start.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
      if (!selectedService?.id) {
        slots.push({start, blocked: true});
      } else {
        const bookable = resolveBookableEmployee(start, duration, String(selectedService.id), selectedStaff !== 'all' ? selectedStaff : undefined);
        slots.push({start, blocked: !bookable.ok});
      }
    }

    return slots;
  }, [resolveBookableEmployee, selectedDate, selectedService?.duration_minutes, selectedService?.id, selectedStaff]);

  const prefillOnboarding = useCallback(
    (user?: User | null) => {
      const rawPhone = String(user?.phone || phone || '').trim();
      const rawEmail = String(user?.email || email || '').trim();
      const guessedName = rawEmail ? rawEmail.split('@')[0].replace(/[._-]+/g, ' ').trim() : '';
      setOnboardingDraft((prev) => ({
        salonName: prev.salonName || (guessedName ? `${guessedName} Salon` : ''),
        countryCode: prev.countryCode || 'IQ',
        city: prev.city || '',
        whatsapp: prev.whatsapp || rawPhone,
        adminPasscode: prev.adminPasscode || ''
      }));
    },
    [email, phone]
  );

  const hydrateFromUser = useCallback(
    async (user: User, requestedRole?: AccessRole) => {
      if (!supabase) {
        setScreen('auth');
        return;
      }

      setBusy(true);
      setError('');
      setInfo('');

      try {
        let result;
        let roleUsed: AccessRole;

        if (requestedRole) {
          result = await resolveIdentitySession(supabase, user, requestedRole);
          roleUsed = requestedRole;
        } else {
          const salonTry = await resolveIdentitySession(supabase, user, 'salon_admin');
          if (salonTry.ok) {
            result = salonTry;
            roleUsed = 'salon_admin';
          } else {
            const saTry = await resolveIdentitySession(supabase, user, 'superadmin');
            result = saTry;
            roleUsed = 'superadmin';
          }
        }

        if (!result.ok) {
          if (result.error === 'onboarding_required') {
            setPendingMode('onboarding_required');
            prefillOnboarding(user);
            setScreen('pending');
            setInfo(t('onboardingSubtitle'));
            return;
          }
          setScreen('auth');
          setError(t('accessDenied'));
          return;
        }

        setRole(roleUsed);
        if (result.role === 'superadmin') {
          setSalonProfile(null);
          setScreen('dashboard');
          return;
        }

        setSalonProfile({
          id: result.salonId,
          slug: result.salonSlug,
          name: result.salonName,
          status: result.salonStatus
        });

        if (result.needsApproval) {
          setPendingMode('approval');
          setScreen('pending');
          return;
        }

        setScreen('dashboard');
      } catch (loadError) {
        setScreen('auth');
        setError((loadError as Error)?.message || t('accessDenied'));
      } finally {
        setBusy(false);
      }
    },
    [prefillOnboarding, t]
  );

  const loadSalonData = useCallback(
    async (salonId: string, day: Date) => {
      if (!supabase) return;

      setLoadingData(true);
      setError('');
      try {
        const rangeStart = startOfDay(day).toISOString();
        const rangeEnd = endOfDay(day).toISOString();

        const [staffRes, servicesRes, staffServicesRes, bookingsRes, hours, timeOffRes] = await Promise.all([
          supabase.from('staff').select('id,name,is_active,sort_order,photo_url').eq('salon_id', salonId).eq('is_active', true).order('sort_order', {ascending: true}),
          supabase.from('services').select('id,name,duration_minutes,price,is_active,sort_order').eq('salon_id', salonId).order('sort_order', {ascending: true}),
          supabase.from('staff_services').select('staff_id,service_id').eq('salon_id', salonId),
          supabase
            .from('bookings')
            .select('id,salon_id,staff_id,service_id,customer_name,customer_phone,status,appointment_start,appointment_end,created_at,notes')
            .eq('salon_id', salonId)
            .lt('appointment_start', rangeEnd)
            .gt('appointment_end', rangeStart)
            .order('appointment_start', {ascending: true}),
          selectWorkingHoursWithFallback(salonId),
          supabase
            .from('employee_time_off')
            .select('staff_id,start_at,end_at')
            .eq('salon_id', salonId)
            .lt('start_at', rangeEnd)
            .gt('end_at', rangeStart)
        ]);

        if (staffRes.error) throw staffRes.error;
        if (servicesRes.error) throw servicesRes.error;
        if (bookingsRes.error) throw bookingsRes.error;

        setStaff((staffRes.data || []) as StaffRow[]);
        setServices((servicesRes.data || []) as ServiceRow[]);
        setStaffServices(staffServicesRes.error ? [] : ((staffServicesRes.data || []) as StaffServiceRow[]));
        setBookings((bookingsRes.data || []) as BookingRow[]);
        setSalonHours(hours.salonHours || []);
        setEmployeeHours(hours.employeeHours || []);
        setTimeOff(timeOffRes.error ? [] : ((timeOffRes.data || []) as TimeOffRow[]));

        if (selectedStaff !== 'all' && !(staffRes.data || []).find((row) => String(row.id) === String(selectedStaff))) {
          setSelectedStaff('all');
        }

        if (!selectedServiceId) {
          const active = ((servicesRes.data || []) as ServiceRow[]).find((row) => row.is_active !== false);
          if (active?.id) setSelectedServiceId(String(active.id));
        }
      } catch (loadError) {
        setError(`${t('dataLoadFailed')} ${(loadError as Error)?.message || ''}`.trim());
      } finally {
        setLoadingData(false);
      }
    },
    [selectedServiceId, selectedStaff, t]
  );

  useEffect(() => {
    if (!supabase) {
      setScreen('auth');
      return;
    }

    let mounted = true;
    void supabase.auth
      .getSession()
      .then(async ({data}) => {
        if (!mounted) return;
        setSession(data.session || null);
        if (data.session?.user) {
          await hydrateFromUser(data.session.user);
        } else {
          setScreen('auth');
        }
      })
      .catch(() => {
        if (!mounted) return;
        setScreen('auth');
      });

    const {data} = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
      if (!nextSession?.user) {
        setScreen('auth');
        setSalonProfile(null);
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [hydrateFromUser]);

  useEffect(() => {
    if (screen !== 'dashboard' || role !== 'salon_admin' || !salonProfile?.id) return;
    void loadSalonData(salonProfile.id, selectedDate);
  }, [loadSalonData, role, salonProfile?.id, screen, selectedDate]);

  useEffect(() => {
    if (!createDraft) return;
    const selected = services.find((row) => String(row.id) === String(createDraft.serviceId));
    if (!selected) return;

    const nextDuration = Math.max(CALENDAR_SNAP_MINUTES, Number(selected.duration_minutes || createDraft.duration || 30));
    const eligibleEmployees = staff
      .map((row) => String(row.id))
      .filter((employeeId) => isEmployeeEligibleForService(employeeId, String(selected.id || '')));

    let nextEmployeeId = createDraft.employeeId;
    if (!eligibleEmployees.includes(nextEmployeeId)) {
      nextEmployeeId = eligibleEmployees[0] || '';
    }

    if (nextDuration === createDraft.duration && nextEmployeeId === createDraft.employeeId) return;
    setCreateDraft((prev) => (prev ? {...prev, duration: nextDuration, employeeId: nextEmployeeId} : prev));
  }, [createDraft, isEmployeeEligibleForService, services, staff]);

  const sendOtpCode = useCallback(async () => {
    const phoneWithPlus = toPhoneWithPlus(phone);
    if (!phoneWithPlus) {
      setError(t('invalidPhone'));
      return;
    }

    if (!supabase) {
      setError(t('missingConfig'));
      return;
    }

    setBusy(true);
    setError('');
    setInfo('');

    try {
      const shouldCreateUser = role === 'salon_admin';
      const waRes = await supabase.auth.signInWithOtp({
        phone: phoneWithPlus,
        options: {shouldCreateUser, channel: 'whatsapp'}
      });

      if (!waRes.error) {
        setOtpChannel('whatsapp');
        setInfo(t('otpWhatsapp'));
        return;
      }

      const smsRes = await supabase.auth.signInWithOtp({
        phone: phoneWithPlus,
        options: {shouldCreateUser, channel: 'sms'}
      });

      if (smsRes.error) throw smsRes.error;
      setOtpChannel('sms');
      setInfo(t('otpSmsFallback'));
    } catch (sendError) {
      setError((sendError as Error)?.message || t('dataLoadFailed'));
    } finally {
      setBusy(false);
    }
  }, [phone, role, t]);

  const verifyOtpCode = useCallback(async () => {
    const phoneWithPlus = toPhoneWithPlus(phone);
    if (!phoneWithPlus) {
      setError(t('invalidPhone'));
      return;
    }
    if (!otpCode.trim()) {
      setError(t('enterCode'));
      return;
    }
    if (!supabase) {
      setError(t('missingConfig'));
      return;
    }

    setBusy(true);
    setError('');
    setInfo('');

    try {
      const verifyRes = await supabase.auth.verifyOtp({
        phone: phoneWithPlus,
        token: otpCode.trim(),
        type: 'sms'
      });
      if (verifyRes.error) throw verifyRes.error;

      if (!verifyRes.data.user) {
        setError(t('accessDenied'));
        return;
      }

      await hydrateFromUser(verifyRes.data.user, role);
    } catch (verifyError) {
      setError((verifyError as Error)?.message || t('accessDenied'));
    } finally {
      setBusy(false);
    }
  }, [hydrateFromUser, otpCode, phone, role, t]);

  const signInWithEmail = useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      setError(t('enterEmailPassword'));
      return;
    }
    if (!supabase) {
      setError(t('missingConfig'));
      return;
    }

    setBusy(true);
    setError('');
    setInfo('');

    try {
      const response = await supabase.auth.signInWithPassword({email: email.trim(), password});
      if (response.error) throw response.error;
      if (!response.data.user) {
        setError(t('accessDenied'));
        return;
      }
      await hydrateFromUser(response.data.user, role);
    } catch (signInError) {
      setError((signInError as Error)?.message || t('accessDenied'));
    } finally {
      setBusy(false);
    }
  }, [email, password, role, hydrateFromUser, t]);

  const submitOnboarding = useCallback(async () => {
    if (!supabase || !session?.user) {
      setError(t('accessDenied'));
      return;
    }

    const salonName = onboardingDraft.salonName.trim();
    const countryCode = onboardingDraft.countryCode.trim().toUpperCase();
    const city = onboardingDraft.city.trim();
    const whatsapp = onboardingDraft.whatsapp.trim() || String(session.user.phone || '').trim();
    const adminPasscode = onboardingDraft.adminPasscode.trim();

    if (!salonName) {
      setError(t('onboardingNameRequired'));
      return;
    }
    if (!countryCode) {
      setError(t('onboardingCountryRequired'));
      return;
    }

    const ownerId = randomUuid();
    const serviceId = randomUuid();
    const defaultHours = Array.from({length: 7}, (_row, day) => ({
      day_of_week: day,
      is_closed: false,
      open_time: '10:00',
      close_time: '20:00'
    }));

    const payload = {
      salon: {
        name: salonName,
        slug: salonName,
        country_code: countryCode,
        city: city || 'Unknown',
        whatsapp: whatsapp || null,
        admin_passcode: adminPasscode || null,
        language_default: locale
      },
      working_hours: defaultHours,
      employees: [
        {
          id: ownerId,
          name: 'Owner',
          role: 'Owner',
          phone: whatsapp || null,
          same_hours_as_salon: true,
          sort_order: 10
        }
      ],
      services: [
        {
          id: serviceId,
          name: 'General Service',
          duration_minutes: 45,
          price: 0,
          category: 'General',
          sort_order: 10,
          employee_ids: [ownerId]
        }
      ]
    };

    setOnboardingSaving(true);
    setError('');
    setInfo('');

    try {
      const {data, error: rpcError} = await supabase.rpc('create_salon_onboarding', {payload});
      if (rpcError) throw rpcError;

      const createdSalonId = String(data?.salon_id || '').trim();
      const createdSlug = String(data?.slug || '').trim();
      const createdName = salonName;

      if (createdSalonId && createdSlug) {
        const {error: metaError} = await supabase.auth.updateUser({
          data: {
            salon_id: createdSalonId,
            salon_slug: createdSlug,
            role: 'salon_admin',
            web_role: 'salon_admin',
            dashboard_role: 'salon_admin'
          }
        });
        if (metaError) {
          // Non-blocking: contact fallback can still resolve identity.
        }

        setSalonProfile({
          id: createdSalonId,
          slug: createdSlug,
          name: createdName,
          status: 'pending_approval'
        });
      }

      setPendingMode('onboarding_submitted');
      setInfo(t('onboardingSubmitted'));

      const userRes = await supabase.auth.getUser();
      if (userRes.data?.user) {
        await hydrateFromUser(userRes.data.user, 'salon_admin');
      } else {
        setScreen('pending');
      }
    } catch (submitError) {
      setError(`${t('dataLoadFailed')} ${(submitError as Error)?.message || ''}`.trim());
    } finally {
      setOnboardingSaving(false);
    }
  }, [hydrateFromUser, locale, onboardingDraft.adminPasscode, onboardingDraft.city, onboardingDraft.countryCode, onboardingDraft.salonName, onboardingDraft.whatsapp, session?.user, t]);

  const resetSession = useCallback(async () => {
    setOtpCode('');
    setOtpChannel(null);
    setError('');
    setInfo('');
    setPendingMove(null);
    setCreateOpen(false);
    setCreateDraft(null);
    setSalonProfile(null);
    setPendingMode('approval');
    setOnboardingSaving(false);
    setOnboardingDraft({
      salonName: '',
      countryCode: 'IQ',
      city: '',
      whatsapp: '',
      adminPasscode: ''
    });
    setStaff([]);
    setServices([]);
    setStaffServices([]);
    setBookings([]);

    if (supabase) {
      await supabase.auth.signOut();
    }

    setScreen('auth');
  }, []);

  const openCreateFromSlot = useCallback(
    (slotStart: Date) => {
      if (!selectedService) {
        setError(t('noServices'));
        return;
      }
      if (!staff.length) {
        setError(t('noStaff'));
        return;
      }

      const start = snapDate(slotStart);
      const duration = Math.max(CALENDAR_SNAP_MINUTES, Number(selectedService.duration_minutes || 30));
      const match = resolveBookableEmployee(start, duration, String(selectedService.id || ''), selectedStaff !== 'all' ? selectedStaff : undefined);

      if (!match.ok) {
        setError(t(match.reason));
        return;
      }

      setError('');
      setCreateDraft({
        customerName: '',
        customerPhone: '',
        serviceId: String(selectedService.id),
        employeeId: match.employeeId,
        start: match.start,
        duration
      });
      setCreateOpen(true);
    },
    [resolveBookableEmployee, selectedService, selectedStaff, staff.length, t]
  );

  const openCreateQuick = useCallback(() => {
    const base = selectedDate;
    const now = new Date();
    const seed = startOfDay(base).getTime() === startOfDay(now).getTime() ? snapDate(now) : atHour(base, 10, 0);
    openCreateFromSlot(seed);
  }, [openCreateFromSlot, selectedDate]);

  const saveCreateBooking = useCallback(async () => {
    if (!supabase || !salonProfile?.id || !createDraft) return;
    if (!createDraft.customerName.trim() || !createDraft.customerPhone.trim()) {
      setError(t('checkNamePhone'));
      return;
    }

    const serviceId = String(createDraft.serviceId || '');
    const employeeId = String(createDraft.employeeId || '');

    if (!isEmployeeEligibleForService(employeeId, serviceId)) {
      setError(t('invalidServiceStaff'));
      return;
    }

    const start = snapDate(createDraft.start);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + Math.max(CALENDAR_SNAP_MINUTES, Number(createDraft.duration || 30)));

    const validation = validateBooking({
      employeeId,
      start,
      end,
      bookings: bookingsWithMove,
      timeOff,
      salonHours,
      employeeHours
    });

    if (!validation.ok) {
      setError(t(mapValidationReasonToMessageKey(validation.reason || 'slotUnavailable')));
      return;
    }

    setSavingCreate(true);
    setError('');
    try {
      const payload = {
        salon_id: salonProfile.id,
        staff_id: employeeId,
        service_id: serviceId,
        customer_name: createDraft.customerName.trim(),
        customer_phone: createDraft.customerPhone.trim(),
        status: 'pending',
        appointment_start: start.toISOString(),
        appointment_end: end.toISOString(),
        notes: null
      };

      const res = await supabase.from('bookings').insert([payload]).select('*').single();
      if (res.error) throw res.error;

      setBookings((prev) => [...prev, res.data as BookingRow]);
      setCreateOpen(false);
      setCreateDraft(null);
      setInfo(t('saved'));
    } catch (saveError) {
      setError(`${t('saveFailed')} ${(saveError as Error)?.message || ''}`.trim());
    } finally {
      setSavingCreate(false);
    }
  }, [bookingsWithMove, createDraft, employeeHours, isEmployeeEligibleForService, salonHours, salonProfile?.id, t, timeOff]);

  const onDropBooking = useCallback(
    (item: BookingView, deltaY: number) => {
      if (Math.abs(deltaY) < 6) return;

      const deltaMinutesRaw = deltaY / PIXELS_PER_MINUTE;
      const deltaMinutes = Math.round(deltaMinutesRaw / CALENDAR_SNAP_MINUTES) * CALENDAR_SNAP_MINUTES;
      if (deltaMinutes === 0) return;

      const nextStart = new Date(item.startsAt);
      const nextEnd = new Date(item.endsAt);
      nextStart.setMinutes(nextStart.getMinutes() + deltaMinutes);
      nextEnd.setMinutes(nextEnd.getMinutes() + deltaMinutes);

      const validation = validateBooking({
        employeeId: item.staffId,
        start: nextStart,
        end: nextEnd,
        bookings,
        timeOff,
        salonHours,
        employeeHours,
        excludeBookingId: item.id
      });

      if (!validation.ok) {
        setError(t(mapValidationReasonToMessageKey(validation.reason || 'slotUnavailable')));
        return;
      }

      setError('');
      setPendingMove({
        bookingId: item.id,
        start: nextStart,
        end: nextEnd,
        employeeId: item.staffId
      });
    },
    [bookings, employeeHours, salonHours, t, timeOff]
  );

  const savePendingMove = useCallback(async () => {
    if (!supabase || !salonProfile?.id || !pendingMove) return;
    setSavingMove(true);
    setError('');

    try {
      const res = await supabase
        .from('bookings')
        .update({
          staff_id: pendingMove.employeeId,
          appointment_start: pendingMove.start.toISOString(),
          appointment_end: pendingMove.end.toISOString()
        })
        .eq('id', pendingMove.bookingId)
        .eq('salon_id', salonProfile.id)
        .select('*')
        .single();

      if (res.error) throw res.error;
      setBookings((prev) => prev.map((row) => (String(row.id) === String(pendingMove.bookingId) ? (res.data as BookingRow) : row)));
      setPendingMove(null);
      setInfo(t('saved'));
    } catch (updateError) {
      setError(`${t('updateFailed')} ${(updateError as Error)?.message || ''}`.trim());
    } finally {
      setSavingMove(false);
    }
  }, [pendingMove, salonProfile?.id, t]);

  const shellPadding = isTablet ? 24 : 14;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <LinearGradient colors={['#e7f2fb', '#f2f8ff', '#f8fbff']} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={styles.backgroundGradient} />

      {screen === 'loading' ? (
        <View style={[styles.centerContainer, {padding: shellPadding}]}> 
          <View style={styles.card}>
            <Text style={[styles.kicker, rtl && styles.textRtl]}>{t('appName')}</Text>
            <Text style={[styles.heroTitle, rtl && styles.textRtl]}>{t('loading')}</Text>
          </View>
        </View>
      ) : null}

      {screen === 'auth' ? (
        <AuthScreen
          shellPadding={shellPadding}
          isTablet={isTablet}
          locale={locale}
          rtl={rtl}
          t={t}
          busy={busy}
          error={error}
          info={info}
          hasSupabaseConfig={hasSupabaseConfig}
          authMethod={authMethod}
          role={role}
          phone={phone}
          email={email}
          password={password}
          otpCode={otpCode}
          otpChannel={otpChannel}
          setLocale={setLocale}
          setAuthMethod={setAuthMethod}
          setRole={setRole}
          setPhone={setPhone}
          setEmail={setEmail}
          setPassword={setPassword}
          setOtpCode={setOtpCode}
          sendOtpCode={() => {
            void sendOtpCode();
          }}
          verifyOtpCode={() => {
            void verifyOtpCode();
          }}
          signInWithEmail={() => {
            void signInWithEmail();
          }}
        />
      ) : null}

      {screen === 'pending' ? (
        <PendingScreen
          shellPadding={shellPadding}
          isTablet={isTablet}
          rtl={rtl}
          t={t}
          pendingMode={pendingMode}
          onboardingDraft={onboardingDraft}
          onboardingSaving={onboardingSaving}
          setOnboardingDraft={setOnboardingDraft}
          submitOnboarding={() => {
            void submitOnboarding();
          }}
          resetSession={() => {
            void resetSession();
          }}
        />
      ) : null}

      {screen === 'dashboard' ? (
        <View style={[styles.dashboardRoot, {paddingHorizontal: shellPadding, paddingTop: shellPadding}]}> 
          <View style={[styles.dashboardHeader, rtl && styles.rowRtl]}>
            <View style={{flex: 1}}>
              <Text style={[styles.kicker, rtl && styles.textRtl]}>{t('appName')}</Text>
              <Text style={[styles.dashboardTitle, rtl && styles.textRtl]}>
                {role === 'salon_admin' ? t('appointmentCalendar') : t('superadmin')}
              </Text>
              <Text style={[styles.dashboardSubtitle, rtl && styles.textRtl]}>
                {role === 'salon_admin' && salonProfile ? `${salonProfile.name} • ${formatDayTitle(selectedDate, locale)}` : t('superadminOnly')}
              </Text>
            </View>
            <Pressable style={styles.secondaryBtn} onPress={() => void resetSession()}>
              <Text style={styles.secondaryBtnText}>{t('logout')}</Text>
            </Pressable>
          </View>

          <LocaleSwitcher locale={locale} onChange={setLocale} rtl={rtl} />

          {role === 'salon_admin' ? (
            <>
              <View style={[styles.dayNav, rtl && styles.rowRtl]}>
                <Pressable style={styles.secondaryBtnSm} onPress={() => setSelectedDate((prev) => addDays(prev, -1))}>
                  <Text style={styles.secondaryBtnText}>{t('prev')}</Text>
                </Pressable>
                <Pressable style={styles.secondaryBtnSm} onPress={() => setSelectedDate(startOfDay(new Date()))}>
                  <Text style={styles.secondaryBtnText}>{t('today')}</Text>
                </Pressable>
                <Pressable style={styles.secondaryBtnSm} onPress={() => setSelectedDate((prev) => addDays(prev, 1))}>
                  <Text style={styles.secondaryBtnText}>{t('next')}</Text>
                </Pressable>
              </View>

              <View style={styles.kpiRow}>
                <View style={styles.kpiCard}>
                  <Text style={[styles.kpiLabel, rtl && styles.textRtl]}>{t('bookings')}</Text>
                  <Text style={styles.kpiValue}>{todayKpis.total}</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={[styles.kpiLabel, rtl && styles.textRtl]}>{t('confirmed')}</Text>
                  <Text style={styles.kpiValue}>{todayKpis.confirmed}</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={[styles.kpiLabel, rtl && styles.textRtl]}>{t('pending')}</Text>
                  <Text style={styles.kpiValue}>{todayKpis.pending}</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={[styles.kpiLabel, rtl && styles.textRtl]}>{t('occupancy')}</Text>
                  <Text style={styles.kpiValue}>{todayKpis.occupancy}%</Text>
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.staffScroller} contentContainerStyle={styles.staffScrollerContent}>
                <Pressable style={[styles.staffChip, selectedStaff === 'all' && styles.staffChipActive]} onPress={() => setSelectedStaff('all')}>
                  <Text style={[styles.staffChipText, selectedStaff === 'all' && styles.staffChipTextActive]}>{t('all')}</Text>
                </Pressable>
                {staff.map((member) => (
                  <Pressable
                    key={member.id}
                    style={[
                      styles.staffChip,
                      selectedStaff === member.id && styles.staffChipActive,
                      selectedStaff === member.id && {borderColor: staffColorById[String(member.id)] || PALETTE.accent}
                    ]}
                    onPress={() => setSelectedStaff(String(member.id))}
                  >
                    <View style={[styles.avatarDot, {backgroundColor: staffColorById[String(member.id)] || '#64748b'}]} />
                    <Text style={[styles.staffChipText, selectedStaff === member.id && styles.staffChipTextActive]}>{member.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.staffScrollerContent}>
                {activeServices.map((service) => (
                  <Pressable
                    key={service.id}
                    style={[styles.serviceChip, selectedService?.id === service.id && styles.serviceChipActive]}
                    onPress={() => setSelectedServiceId(String(service.id))}
                  >
                    <Text style={[styles.serviceChipText, selectedService?.id === service.id && styles.serviceChipTextActive]} numberOfLines={1}>
                      {service.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <View style={styles.segmentRow}>
                <Pressable style={[styles.segmentBtn, tab === 'calendar' && styles.segmentBtnActive]} onPress={() => setTab('calendar')}>
                  <Text style={[styles.segmentText, tab === 'calendar' && styles.segmentTextActive]}>{t('calendar')}</Text>
                </Pressable>
                <Pressable style={[styles.segmentBtn, tab === 'agenda' && styles.segmentBtnActive]} onPress={() => setTab('agenda')}>
                  <Text style={[styles.segmentText, tab === 'agenda' && styles.segmentTextActive]}>{t('agenda')}</Text>
                </Pressable>
                <Pressable style={[styles.segmentBtn, tab === 'team' && styles.segmentBtnActive]} onPress={() => setTab('team')}>
                  <Text style={[styles.segmentText, tab === 'team' && styles.segmentTextActive]}>{t('team')}</Text>
                </Pressable>
              </View>

              {loadingData ? <Text style={[styles.helperText, rtl && styles.textRtl]}>{t('loading')}</Text> : null}
              {error ? <Text style={[styles.errorText, rtl && styles.textRtl]}>{error}</Text> : null}
              {info ? <Text style={[styles.successText, rtl && styles.textRtl]}>{info}</Text> : null}

              {tab === 'calendar' ? (
                <View style={styles.calendarCard}>
                  <View style={[styles.calendarTopRow, rtl && styles.rowRtl]}>
                    <Text style={[styles.panelTitle, rtl && styles.textRtl]}>{t('calendar')}</Text>
                    <Pressable style={styles.primaryBtnSm} onPress={openCreateQuick}>
                      <Text style={styles.primaryBtnText}>{t('addBooking')}</Text>
                    </Pressable>
                  </View>
                  <Text style={[styles.helperText, rtl && styles.textRtl]}>{t('moveHint')}</Text>

                  <ScrollView style={styles.timelineScroll} scrollEnabled={scrollEnabled}>
                    <View style={styles.timelineWrap}>
                      <View style={styles.timelineLabels}>
                        {Array.from({length: TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1}, (_v, idx) => TIMELINE_START_HOUR + idx).map((hour) => (
                          <View key={`label-${hour}`} style={styles.hourLabelRow}>
                            <Text style={styles.hourLabel}>{String(hour).padStart(2, '0')}:00</Text>
                          </View>
                        ))}
                      </View>

                      <View style={styles.timelineGrid}>
                        <View style={[styles.timelineGridCanvas, {height: (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60 * PIXELS_PER_MINUTE}]}>
                          {timelineSlots.map((slot) => {
                            const minute = minutesFromDayStart(slot.start);
                            const top = (minute - TIMELINE_START_HOUR * 60) * PIXELS_PER_MINUTE;
                            return (
                              <Pressable
                                key={`slot-${slot.start.toISOString()}`}
                                style={[styles.timelineSlot, {top, height: SLOT_STEP_MINUTES * PIXELS_PER_MINUTE}, slot.blocked && styles.timelineSlotBlocked]}
                                onPress={() => {
                                  if (slot.blocked) return;
                                  openCreateFromSlot(slot.start);
                                }}
                              >
                                {slot.blocked ? <Text style={styles.slotBlockedX}>X</Text> : null}
                              </Pressable>
                            );
                          })}

                          {Array.from({length: TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1}, (_v, idx) => TIMELINE_START_HOUR + idx).map((hour) => {
                            const top = (hour - TIMELINE_START_HOUR) * 60 * PIXELS_PER_MINUTE;
                            return <View key={`line-${hour}`} style={[styles.hourLine, {top}]} />;
                          })}

                          {bookingsView.map((item) => {
                            const startMinutes = minutesFromDayStart(item.startsAt);
                            const endMinutes = minutesFromDayStart(item.endsAt);
                            const top = (startMinutes - TIMELINE_START_HOUR * 60) * PIXELS_PER_MINUTE;
                            const height = Math.max(42, (endMinutes - startMinutes) * PIXELS_PER_MINUTE);

                            if (top + height < 0) return null;
                            if (top > (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60 * PIXELS_PER_MINUTE) return null;

                            return (
                              <DraggableBookingCard
                                key={item.id}
                                booking={item}
                                top={top}
                                height={height}
                                showStaff={selectedStaff === 'all'}
                                locale={locale}
                                isRtl={rtl}
                                onDrop={(deltaY) => onDropBooking(item, deltaY)}
                                onDragStateChange={(active) => setScrollEnabled(!active)}
                              />
                            );
                          })}
                        </View>
                      </View>
                    </View>
                  </ScrollView>

                  {pendingMove ? (
                    <View style={[styles.moveBar, rtl && styles.rowRtl]}>
                      <Text style={[styles.moveBarText, rtl && styles.textRtl]}>{t('movePending')}</Text>
                      <View style={[styles.rowWrap, rtl && styles.rowRtl]}>
                        <Pressable style={[styles.primaryBtnSm, savingMove && styles.disabledBtn]} onPress={() => void savePendingMove()} disabled={savingMove}>
                          <Text style={styles.primaryBtnText}>{savingMove ? t('saving') : t('saveMove')}</Text>
                        </Pressable>
                        <Pressable style={styles.secondaryBtnSm} onPress={() => setPendingMove(null)}>
                          <Text style={styles.secondaryBtnText}>{t('cancelMove')}</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {tab === 'agenda' ? (
                <View style={styles.panelCard}>
                  <Text style={[styles.panelTitle, rtl && styles.textRtl]}>{t('agenda')}</Text>
                  <View style={styles.stackSm}>
                    {upcoming.length === 0 ? <Text style={[styles.helperText, rtl && styles.textRtl]}>{t('noData')}</Text> : null}
                    {upcoming.map((item) => (
                      <View key={item.id} style={styles.agendaRow}>
                        <View style={[styles.statusDot, {backgroundColor: item.color}]} />
                        <View style={styles.agendaTextWrap}>
                          <Text style={[styles.agendaCustomer, rtl && styles.textRtl]}>{item.customerName}</Text>
                          <Text style={[styles.agendaMeta, rtl && styles.textRtl]}>{item.serviceName}</Text>
                          <Text style={[styles.agendaMeta, rtl && styles.textRtl]}>{item.staffName}</Text>
                        </View>
                        <Text style={styles.agendaTime}>{new Date(item.startsAt).toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit'})}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {tab === 'team' ? (
                <View style={styles.panelCard}>
                  <Text style={[styles.panelTitle, rtl && styles.textRtl]}>{t('teamLoad')}</Text>
                  <View style={styles.stackSm}>
                    {staff.map((member) => {
                      const count = bookingsWithMove.filter((booking) => String(booking.staff_id || '') === String(member.id)).length;
                      const color = staffColorById[String(member.id)] || '#64748b';
                      return (
                        <View key={member.id} style={styles.teamRow}>
                          <View style={[styles.avatarBadge, {backgroundColor: color}]}>
                            <Text style={styles.avatarBadgeText}>{String(member.name || '?').slice(0, 1).toUpperCase()}</Text>
                          </View>
                          <View style={styles.agendaTextWrap}>
                            <Text style={[styles.agendaCustomer, rtl && styles.textRtl]}>{member.name}</Text>
                            <Text style={[styles.agendaMeta, rtl && styles.textRtl]}>{t('employee')}</Text>
                          </View>
                          <Text style={styles.agendaTime}>
                            {count} {t('slots')}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.panelCard}>
              <Text style={[styles.panelTitle, rtl && styles.textRtl]}>{t('superadmin')}</Text>
              <Text style={[styles.helperText, rtl && styles.textRtl]}>{t('superadminOnly')}</Text>
            </View>
          )}
        </View>
      ) : null}

      <CreateBookingDrawer
        open={createOpen}
        draft={createDraft}
        activeServices={activeServices}
        staff={staff}
        staffColorById={staffColorById}
        rtl={rtl}
        locale={locale}
        savingCreate={savingCreate}
        t={t}
        isEmployeeEligibleForService={isEmployeeEligibleForService}
        setDraft={setCreateDraft}
        onSave={() => {
          void saveCreateBooking();
        }}
        onClose={() => {
          setCreateOpen(false);
          setCreateDraft(null);
        }}
      />
    </View>
  );
}
