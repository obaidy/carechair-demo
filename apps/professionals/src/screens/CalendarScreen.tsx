import {useCallback, useEffect, useMemo, useState} from 'react';
import {FlatList, Pressable, ScrollView, Text, View, useWindowDimensions} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import {Controller, useForm, useWatch} from 'react-hook-form';
import {z} from 'zod';
import {zodResolver} from '@hookform/resolvers/zod';
import {addDays, addMinutes, format, isSameDay, parseISO, setHours, setMinutes, startOfDay} from 'date-fns';
import {Button, Card, Chip, EmptyState, Input, Sheet} from '../components';
import {useTheme} from '../theme/provider';
import {useI18n} from '../i18n/provider';
import {useUiStore} from '../state/uiStore';
import {
  useBlockTime,
  useAvailabilityContext,
  useBookings,
  useClients,
  useCreateBooking,
  useRescheduleBooking,
  useServices,
  useStaff,
  useUpdateBookingStatus
} from '../api/hooks';
import {textDir} from '../utils/layout';
import {useAuthStore} from '../state/authStore';
import type {AvailabilityContext, Booking, BookingStatus, Service, Staff} from '../types/models';
import {getWorkingWindow, validateBooking} from '../lib/availability';

const createBookingSchema = z.object({
  clientName: z.string().min(2),
  clientPhone: z.string().min(8),
  serviceId: z.string().min(1),
  staffId: z.string().min(1),
  startAt: z.string().min(1)
});

type CreateBookingValues = z.infer<typeof createBookingSchema>;

const blockSchema = z.object({
  staffId: z.string().min(1),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  reason: z.string().optional()
});

type BlockValues = z.infer<typeof blockSchema>;

const rescheduleSchema = z.object({
  staffId: z.string().min(1),
  startAt: z.string().min(1)
});

type RescheduleValues = z.infer<typeof rescheduleSchema>;

type SlotOption = {label: string; value: string};

function minutesToDate(baseDay: Date, totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return setMinutes(setHours(baseDay, hours), mins);
}

function floorToHalfHour(date: Date) {
  const next = new Date(date);
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() < 30 ? 0 : 30);
  return next;
}

function normalizePhoneDigits(value: string | undefined | null) {
  return String(value || '').replace(/\D/g, '');
}

function slotOptionsForStaff(params: {
  date: Date;
  staff: Staff | undefined;
  durationMin: number;
  bookings: Booking[];
  availability: AvailabilityContext | null;
  excludeBookingId?: string;
}): SlotOption[] {
  const {date, staff, durationMin, bookings, availability, excludeBookingId} = params;
  if (!staff || !availability) return [];

  const window = getWorkingWindow(
    availability.salonHours.map((row) => ({
      day_of_week: row.dayOfWeek,
      open_time: row.openTime || null,
      close_time: row.closeTime || null,
      is_closed: row.isClosed || false
    })),
    availability.employeeHours.map((row) => ({
      staff_id: row.staffId,
      day_of_week: row.dayOfWeek,
      start_time: row.startTime || null,
      end_time: row.endTime || null,
      is_off: row.isOff || false,
      break_start: row.breakStart || null,
      break_end: row.breakEnd || null
    })),
    staff.id,
    date
  );
  if (!window) return [];

  const out: SlotOption[] = [];
  for (let cursor = new Date(window.start); cursor < window.end; cursor = addMinutes(cursor, 30)) {
    const end = addMinutes(cursor, durationMin);
    if (end > window.end) continue;

    const result = validateBooking({
      employeeId: staff.id,
      start: cursor,
      end,
      bookings: bookings.map((row) => ({
        id: row.id,
        staff_id: row.staffId,
        appointment_start: row.startAt,
        appointment_end: row.endAt,
        status: row.status === 'canceled' ? 'cancelled' : row.status
      })),
      timeOff: availability.timeOff.map((row) => ({
        id: row.id,
        staff_id: row.staffId,
        start_at: row.startAt,
        end_at: row.endAt
      })),
      salonHours: availability.salonHours.map((row) => ({
        day_of_week: row.dayOfWeek,
        open_time: row.openTime || null,
        close_time: row.closeTime || null,
        is_closed: row.isClosed || false
      })),
      employeeHours: availability.employeeHours.map((row) => ({
        staff_id: row.staffId,
        day_of_week: row.dayOfWeek,
        start_time: row.startTime || null,
        end_time: row.endTime || null,
        is_off: row.isOff || false,
        break_start: row.breakStart || null,
        break_end: row.breakEnd || null
      })),
      excludeBookingId
    });

    if (result.ok) {
      out.push({label: format(cursor, 'HH:mm'), value: cursor.toISOString()});
    }
  }

  return out;
}

export function CalendarScreen({route, navigation}: any) {
  const {colors, spacing, typography, radius} = useTheme();
  const {t, isRTL} = useI18n();

  const view = useUiStore((state) => state.calendarView);
  const setView = useUiStore((state) => state.setCalendarView);
  const selectedDateIso = useUiStore((state) => state.selectedDateIso);
  const setSelectedDateIso = useUiStore((state) => state.setSelectedDateIso);
  const salon = useAuthStore((state) => state.context?.salon || null);
  const userPhone = useAuthStore((state) => state.context?.user.phone || '');
  const memberships = useAuthStore((state) => state.memberships);

  const selectedDate = useMemo(() => new Date(selectedDateIso), [selectedDateIso]);
  const {width} = useWindowDimensions();
  const isTablet = width >= 768;

  const [selectedStaffId, setSelectedStaffId] = useState<string>('all');
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<Booking | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [clientQuery, setClientQuery] = useState('');
  const [actionError, setActionError] = useState('');

  const staffQuery = useStaff();
  const servicesQuery = useServices();
  const clientsQuery = useClients();

  const bookingsQuery = useBookings(selectedDate.toISOString(), view, selectedStaffId === 'all' ? undefined : selectedStaffId);
  const availabilityQuery = useAvailabilityContext(selectedDate.toISOString());

  const createMutation = useCreateBooking(selectedDate.toISOString(), view, selectedStaffId === 'all' ? undefined : selectedStaffId);
  const statusMutation = useUpdateBookingStatus(selectedDate.toISOString(), view, selectedStaffId === 'all' ? undefined : selectedStaffId);
  const rescheduleMutation = useRescheduleBooking(selectedDate.toISOString(), view, selectedStaffId === 'all' ? undefined : selectedStaffId);
  const blockMutation = useBlockTime(selectedDate.toISOString(), view, selectedStaffId === 'all' ? undefined : selectedStaffId);

  const staffRows = staffQuery.data || [];
  const servicesRows = servicesQuery.data || [];
  const bookingRows = bookingsQuery.data || [];
  const currentMembership = memberships.find((membership) => membership.salonId === salon?.id && membership.status === 'ACTIVE');
  const canManageBookings = currentMembership?.role !== 'STAFF';
  const ownStaffRecord = useMemo(() => {
    const phone = normalizePhoneDigits(userPhone);
    if (!phone) return null;
    return staffRows.find((row) => normalizePhoneDigits(row.phone) === phone) || null;
  }, [staffRows, userPhone]);

  useFocusEffect(
    useCallback(() => {
      void staffQuery.refetch();
      void servicesQuery.refetch();
      void bookingsQuery.refetch();
      void availabilityQuery.refetch();
      return () => {};
    }, [availabilityQuery, bookingsQuery, servicesQuery, staffQuery])
  );

  useEffect(() => {
    if (currentMembership?.role === 'STAFF' && ownStaffRecord?.id && selectedStaffId !== ownStaffRecord.id) {
      setSelectedStaffId(ownStaffRecord.id);
    }
  }, [currentMembership?.role, ownStaffRecord?.id, selectedStaffId]);

  useEffect(() => {
    const action = route?.params?.action;
    if (!action) return;
    if (action === 'createBooking' && canManageBookings) setCreateOpen(true);
    if (action === 'blockTime' && canManageBookings) setBlockOpen(true);
    navigation?.setParams?.({action: undefined, walkIn: undefined});
  }, [canManageBookings, navigation, route?.params?.action]);

  const activeServices = useMemo(() => servicesRows.filter((s) => s.isActive), [servicesRows]);
  const staffById = useMemo(() => new Map(staffRows.map((row) => [row.id, row])), [staffRows]);
  const serviceById = useMemo(() => new Map(servicesRows.map((row) => [row.id, row])), [servicesRows]);

  const staffByService = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const service of servicesRows) {
      map.set(service.id, service.assignedStaffIds || []);
    }
    return map;
  }, [servicesRows]);

  const availability = availabilityQuery.data || null;

  const timelineSlots = useMemo(() => {
    const dayBase = startOfDay(selectedDate);
    const window = availability && (selectedStaffId === 'all' || selectedStaffId)
      ? getWorkingWindow(
          availability.salonHours.map((row) => ({
            day_of_week: row.dayOfWeek,
            open_time: row.openTime || null,
            close_time: row.closeTime || null,
            is_closed: row.isClosed || false
          })),
          availability.employeeHours.map((row) => ({
            staff_id: row.staffId,
            day_of_week: row.dayOfWeek,
            start_time: row.startTime || null,
            end_time: row.endTime || null,
            is_off: row.isOff || false,
            break_start: row.breakStart || null,
            break_end: row.breakEnd || null
          })),
          selectedStaffId === 'all' ? '__salon__' : selectedStaffId,
          selectedDate
        )
      : null;
    if (!window) return [] as Date[];

    const out: Date[] = [];
    for (let cursor = new Date(window.start); cursor < window.end; cursor = addMinutes(cursor, 30)) {
      out.push(minutesToDate(dayBase, cursor.getHours() * 60 + cursor.getMinutes()));
    }
    return out;
  }, [availability, selectedDate, selectedStaffId, staffRows]);

  const bookingsBySlot = useMemo(() => {
    const map = new Map<number, Booking[]>();
    for (const booking of bookingRows) {
      const key = +floorToHalfHour(parseISO(booking.startAt));
      const existing = map.get(key);
      if (existing) existing.push(booking);
      else map.set(key, [booking]);
    }
    return map;
  }, [bookingRows]);

  const createForm = useForm<CreateBookingValues>({
    resolver: zodResolver(createBookingSchema),
    defaultValues: {
      clientName: '',
      clientPhone: '',
      serviceId: '',
      staffId: '',
      startAt: ''
    }
  });

  const blockForm = useForm<BlockValues>({
    resolver: zodResolver(blockSchema),
    defaultValues: {
      staffId: '',
      startAt: '',
      endAt: '',
      reason: ''
    }
  });

  const rescheduleForm = useForm<RescheduleValues>({
    resolver: zodResolver(rescheduleSchema),
    defaultValues: {
      staffId: '',
      startAt: ''
    }
  });

  const createServiceId = useWatch({control: createForm.control, name: 'serviceId'});
  const createStaffId = useWatch({control: createForm.control, name: 'staffId'});
  const createStartAt = useWatch({control: createForm.control, name: 'startAt'});

  const blockStaffId = useWatch({control: blockForm.control, name: 'staffId'});
  const blockStartAt = useWatch({control: blockForm.control, name: 'startAt'});

  const rescheduleStaffId = useWatch({control: rescheduleForm.control, name: 'staffId'});
  const rescheduleStartAt = useWatch({control: rescheduleForm.control, name: 'startAt'});

  const selectedCreateService = useMemo(() => activeServices.find((row) => row.id === createServiceId), [activeServices, createServiceId]);

  const createStaffOptions = useMemo(() => {
    if (!createServiceId) return [];
    const assigned = staffByService.get(createServiceId) || [];
    if (!assigned.length) return staffRows;
    return staffRows.filter((row) => assigned.includes(row.id));
  }, [createServiceId, staffByService, staffRows]);

  const createSlotOptions = useMemo(() => {
    const staff = staffById.get(createStaffId || '');
    return slotOptionsForStaff({
      date: selectedDate,
      staff,
      durationMin: selectedCreateService?.durationMin || 30,
      bookings: bookingRows,
      availability
    });
  }, [availability, bookingRows, createStaffId, selectedCreateService?.durationMin, selectedDate, staffById]);

  const blockSlotOptions = useMemo(() => {
    const staff = staffById.get(blockStaffId || '');
    return slotOptionsForStaff({
      date: selectedDate,
      staff,
      durationMin: 30,
      bookings: bookingRows,
      availability
    });
  }, [availability, bookingRows, blockStaffId, selectedDate, staffById]);

  const detailService = useMemo<Service | undefined>(() => {
    if (!rescheduleTarget) return undefined;
    return serviceById.get(rescheduleTarget.serviceId);
  }, [rescheduleTarget, serviceById]);

  const rescheduleSlotOptions = useMemo(() => {
    if (!rescheduleTarget) return [];
    const staff = staffById.get(rescheduleStaffId || '');
    return slotOptionsForStaff({
      date: selectedDate,
      staff,
      durationMin: detailService?.durationMin || 30,
      bookings: bookingRows,
      availability,
      excludeBookingId: rescheduleTarget.id
    });
  }, [availability, bookingRows, rescheduleTarget, detailService?.durationMin, rescheduleStaffId, selectedDate, staffById]);

  const clientCandidates = useMemo(() => {
    const list = clientsQuery.data || [];
    const key = clientQuery.trim().toLowerCase();
    if (!key) return list.slice(0, 8);
    return list
      .filter((row) => row.name.toLowerCase().includes(key) || row.phone.includes(key))
      .slice(0, 8);
  }, [clientQuery, clientsQuery.data]);

  useEffect(() => {
    if (!activeServices.length) return;
    if (!createForm.getValues('serviceId')) {
      createForm.setValue('serviceId', activeServices[0].id, {shouldValidate: true});
    }
  }, [activeServices, createForm]);

  useEffect(() => {
    if (!createStaffOptions.length) {
      if (createForm.getValues('staffId')) createForm.setValue('staffId', '', {shouldValidate: true});
      return;
    }
    if (!createStaffOptions.some((row) => row.id === createStaffId)) {
      createForm.setValue('staffId', createStaffOptions[0].id, {shouldValidate: true});
    }
  }, [createForm, createStaffId, createStaffOptions]);

  useEffect(() => {
    if (!createSlotOptions.length) {
      if (createForm.getValues('startAt')) createForm.setValue('startAt', '', {shouldValidate: true});
      return;
    }
    if (!createSlotOptions.some((row) => row.value === createStartAt)) {
      createForm.setValue('startAt', createSlotOptions[0].value, {shouldValidate: true});
    }
  }, [createForm, createSlotOptions, createStartAt]);

  useEffect(() => {
    const preferred = selectedStaffId !== 'all' ? selectedStaffId : staffRows[0]?.id || '';
    if (preferred && blockForm.getValues('staffId') !== preferred) {
      blockForm.setValue('staffId', preferred, {shouldValidate: true});
    }
  }, [blockForm, selectedStaffId, staffRows]);

  useEffect(() => {
    if (!blockSlotOptions.length) {
      if (blockForm.getValues('startAt')) blockForm.setValue('startAt', '', {shouldValidate: true});
      if (blockForm.getValues('endAt')) blockForm.setValue('endAt', '', {shouldValidate: true});
      return;
    }

    if (!blockSlotOptions.some((row) => row.value === blockStartAt)) {
      const start = blockSlotOptions[0].value;
      blockForm.setValue('startAt', start, {shouldValidate: true});
      blockForm.setValue('endAt', addMinutes(parseISO(start), 30).toISOString(), {shouldValidate: true});
      return;
    }

    const end = addMinutes(parseISO(blockStartAt), 30).toISOString();
    if (blockForm.getValues('endAt') !== end) {
      blockForm.setValue('endAt', end, {shouldValidate: true});
    }
  }, [blockForm, blockSlotOptions, blockStartAt]);

  useEffect(() => {
    if (!rescheduleTarget || !rescheduleOpen) return;
    const currentStaff = rescheduleForm.getValues('staffId');
    if (!currentStaff) {
      rescheduleForm.setValue('staffId', rescheduleTarget.staffId, {shouldValidate: true});
      rescheduleForm.setValue('startAt', rescheduleTarget.startAt, {shouldValidate: true});
    }
  }, [rescheduleTarget, rescheduleForm, rescheduleOpen]);

  useEffect(() => {
    if (!rescheduleOpen) return;
    if (!rescheduleSlotOptions.length) {
      if (rescheduleForm.getValues('startAt')) {
        rescheduleForm.setValue('startAt', '', {shouldValidate: true});
      }
      return;
    }
    if (!rescheduleSlotOptions.some((row) => row.value === rescheduleStartAt)) {
      rescheduleForm.setValue('startAt', rescheduleSlotOptions[0].value, {shouldValidate: true});
    }
  }, [rescheduleForm, rescheduleOpen, rescheduleSlotOptions, rescheduleStartAt]);

  function statusColor(status: BookingStatus) {
    return colors.status[status] || colors.textMuted;
  }

  function translateActionError(error: any) {
    const message = String(error?.message || '');
    if (!message) return t('requiredField');
    if (['closed_day', 'outside_working_hours', 'inside_break', 'time_off'].includes(message)) return t('outsideHours');
    if (message === 'overlap') return t('overlap');
    if (message === 'invalid_service_staff') return t('invalidServiceStaff');
    if (message === 'select_employee') return t('requiredField');
    return message;
  }

  async function onCreate(values: CreateBookingValues) {
    setActionError('');
    try {
      const duration = selectedCreateService?.durationMin || 30;
      await createMutation.mutateAsync({
        clientName: values.clientName,
        clientPhone: values.clientPhone,
        serviceId: values.serviceId,
        staffId: values.staffId,
        startAt: values.startAt,
        endAt: addMinutes(parseISO(values.startAt), duration).toISOString(),
        status: 'confirmed'
      });

      setCreateOpen(false);
      setClientQuery('');
      createForm.reset({
        clientName: '',
        clientPhone: '',
        serviceId: activeServices[0]?.id || '',
        staffId: selectedStaffId !== 'all' ? selectedStaffId : '',
        startAt: ''
      });
    } catch (error: any) {
      setActionError(translateActionError(error));
    }
  }

  async function onBlock(values: BlockValues) {
    setActionError('');
    try {
      await blockMutation.mutateAsync(values);
      setBlockOpen(false);
      blockForm.reset({
        staffId: selectedStaffId !== 'all' ? selectedStaffId : staffRows[0]?.id || '',
        startAt: '',
        endAt: '',
        reason: ''
      });
    } catch (error: any) {
      setActionError(translateActionError(error));
    }
  }

  async function onReschedule(values: RescheduleValues) {
    if (!rescheduleTarget) return;
    setActionError('');
    try {
      const duration = detailService?.durationMin || 30;

      await rescheduleMutation.mutateAsync({
        bookingId: rescheduleTarget.id,
        staffId: values.staffId,
        startAt: values.startAt,
        endAt: addMinutes(parseISO(values.startAt), duration).toISOString()
      });

      setRescheduleOpen(false);
      setRescheduleTarget(null);
      setDetailBooking(null);
      rescheduleForm.reset({staffId: '', startAt: ''});
    } catch (error: any) {
      setActionError(translateActionError(error));
    }
  }

  function openReschedule(booking: Booking) {
    setRescheduleTarget(booking);
    setRescheduleOpen(true);
    rescheduleForm.reset({
      staffId: booking.staffId,
      startAt: booking.startAt
    });
  }

  async function changeStatus(status: BookingStatus) {
    if (!detailBooking) return;
    setActionError('');
    try {
      await statusMutation.mutateAsync({bookingId: detailBooking.id, status});
      setDetailBooking(null);
    } catch (error: any) {
      setActionError(translateActionError(error));
    }
  }

  const dayGrid = (
    <FlatList
      data={timelineSlots}
      keyExtractor={(item) => item.toISOString()}
      contentContainerStyle={{padding: 16, gap: 10, paddingBottom: 120}}
      renderItem={({item}) => {
        const matches = bookingsBySlot.get(+item) || [];
        return (
          <View style={{flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10}}>
            <Text style={[typography.bodySm, {width: 58, color: colors.textMuted}, textDir(isRTL)]}>{format(item, 'HH:mm')}</Text>
            <View style={{flex: 1, gap: 8}}>
              {!matches.length ? <View style={{borderTopWidth: 1, borderColor: colors.border, marginTop: 8}} /> : null}
              {matches.map((booking) => {
                const service = serviceById.get(booking.serviceId);
                const staff = staffById.get(booking.staffId);
                return (
                  <Pressable
                    key={booking.id}
                    onPress={() => setDetailBooking(booking)}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radius.md,
                      padding: 10,
                      backgroundColor: colors.surface,
                      borderLeftWidth: 4,
                      borderLeftColor: statusColor(booking.status)
                    }}
                  >
                    <Text style={[typography.body, {color: colors.text, fontWeight: '700'}, textDir(isRTL)]}>{booking.clientName}</Text>
                    <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>
                      {format(parseISO(booking.startAt), 'HH:mm')} - {format(parseISO(booking.endAt), 'HH:mm')}
                    </Text>
                    <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>
                      {service?.name || t('service')} • {staff?.name || t('staffMember')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      }}
      ListEmptyComponent={<EmptyState title={t('noData')} subtitle={t('noAvailableSlots')} />}
    />
  );

  const tabletSidePanel = (
    <Card style={{width: 320, gap: spacing.sm, margin: spacing.md, marginRight: isRTL ? spacing.md : 0, marginLeft: isRTL ? 0 : spacing.md}}>
      <View style={{flexDirection: isRTL ? 'row-reverse' : 'row', gap: spacing.xs, alignItems: 'center'}}>
        <Button title="<" variant="ghost" onPress={() => setSelectedDateIso(addDays(selectedDate, -1).toISOString())} />
        <Text style={[typography.body, {color: colors.text, flex: 1}, textDir(isRTL)]}>{format(selectedDate, 'PPP')}</Text>
        <Button title=">" variant="ghost" onPress={() => setSelectedDateIso(addDays(selectedDate, 1).toISOString())} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: spacing.xs}}>
        {currentMembership?.role !== 'STAFF' ? <Chip label={t('allStaff')} active={selectedStaffId === 'all'} onPress={() => setSelectedStaffId('all')} /> : null}
        {staffRows.map((staff) => (
          <Chip key={staff.id} label={staff.name} active={selectedStaffId === staff.id} onPress={() => setSelectedStaffId(staff.id)} />
        ))}
      </ScrollView>

      <Text style={[typography.caption, {color: colors.textMuted}, textDir(isRTL)]}>{t('bookings')}</Text>
      <ScrollView style={{maxHeight: 390}} contentContainerStyle={{gap: spacing.xs}}>
        {bookingRows.map((booking) => (
          <Pressable
            key={booking.id}
            onPress={() => setDetailBooking(booking)}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              padding: 8,
              borderLeftWidth: 4,
              borderLeftColor: statusColor(booking.status),
              backgroundColor: colors.surfaceSoft,
              gap: 2
            }}
          >
            <Text style={[typography.bodySm, {color: colors.text, fontWeight: '700'}, textDir(isRTL)]}>{booking.clientName}</Text>
            <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>{format(parseISO(booking.startAt), 'HH:mm')}</Text>
          </Pressable>
        ))}
        {!bookingRows.length ? <EmptyState title={t('noData')} /> : null}
      </ScrollView>
    </Card>
  );

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: colors.background}}>
      <View style={{paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm}}>
        <View style={{flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center'}}>
          <Text style={[typography.h2, {color: colors.text}, textDir(isRTL)]}>{t('calendar')}</Text>
          <View style={{flexDirection: isRTL ? 'row-reverse' : 'row', gap: spacing.xs}}>
            {canManageBookings ? <Button title={t('addBooking')} onPress={() => setCreateOpen(true)} /> : null}
            {canManageBookings ? <Button title={t('blockTime')} variant="secondary" onPress={() => setBlockOpen(true)} /> : null}
          </View>
        </View>

        {!isTablet || view !== 'day' ? (
          <>
            <View style={{flexDirection: isRTL ? 'row-reverse' : 'row', gap: spacing.xs, alignItems: 'center'}}>
              <Button title="<" variant="ghost" onPress={() => setSelectedDateIso(addDays(selectedDate, -1).toISOString())} />
              <Text style={[typography.body, {color: colors.text, flex: 1}, textDir(isRTL)]}>{format(selectedDate, 'PPP')}</Text>
              <Button title=">" variant="ghost" onPress={() => setSelectedDateIso(addDays(selectedDate, 1).toISOString())} />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: spacing.xs}}>
              {currentMembership?.role !== 'STAFF' ? <Chip label={t('allStaff')} active={selectedStaffId === 'all'} onPress={() => setSelectedStaffId('all')} /> : null}
              {staffRows.map((staff) => (
                <Chip key={staff.id} label={staff.name} active={selectedStaffId === staff.id} onPress={() => setSelectedStaffId(staff.id)} />
              ))}
            </ScrollView>
          </>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: spacing.xs}}>
          <Chip label={t('day')} active={view === 'day'} onPress={() => setView('day')} />
          <Chip label={t('week')} active={view === 'week'} onPress={() => setView('week')} />
          <Chip label={t('list')} active={view === 'list'} onPress={() => setView('list')} />
        </ScrollView>
      </View>

      {view === 'day' ? (
        isTablet ? (
          <View style={{flex: 1, flexDirection: isRTL ? 'row-reverse' : 'row'}}>
            {tabletSidePanel}
            <View style={{flex: 1}}>{dayGrid}</View>
          </View>
        ) : (
          dayGrid
        )
      ) : null}

      {view === 'week' ? (
        <ScrollView horizontal contentContainerStyle={{padding: 16, gap: spacing.sm, paddingBottom: 120}}>
          {Array.from({length: 7}).map((_, index) => {
            const day = addDays(startOfDay(selectedDate), index);
            const dayBookings = bookingRows.filter((row) => isSameDay(parseISO(row.startAt), day));
            return (
              <Card key={day.toISOString()} style={{width: 220, gap: spacing.xs}}>
                <Text style={[typography.caption, {color: colors.textMuted}, textDir(isRTL)]}>{format(day, 'EEE dd')}</Text>
                {dayBookings.map((booking) => (
                  <Pressable
                    key={booking.id}
                    onPress={() => setDetailBooking(booking)}
                    style={{padding: 8, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: statusColor(booking.status)}}
                  >
                    <Text style={[typography.bodySm, {color: colors.text}, textDir(isRTL)]}>{booking.clientName}</Text>
                    <Text style={[typography.bodySm, {color: colors.textMuted}]}>{format(parseISO(booking.startAt), 'HH:mm')}</Text>
                  </Pressable>
                ))}
                {!dayBookings.length ? <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>{t('noData')}</Text> : null}
              </Card>
            );
          })}
        </ScrollView>
      ) : null}

      {view === 'list' ? (
        <FlatList
          data={bookingRows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{padding: 16, gap: 10, paddingBottom: 120}}
          renderItem={({item}) => {
            const service = serviceById.get(item.serviceId);
            const staff = staffById.get(item.staffId);
            return (
              <Card style={{gap: 6, borderLeftWidth: 4, borderLeftColor: statusColor(item.status)}}>
                <Pressable onPress={() => setDetailBooking(item)}>
                  <Text style={[typography.body, {color: colors.text, fontWeight: '700'}, textDir(isRTL)]}>{item.clientName}</Text>
                  <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>{format(parseISO(item.startAt), 'PPP HH:mm')}</Text>
                  <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>
                    {service?.name || t('service')} • {staff?.name || t('staffMember')}
                  </Text>
                </Pressable>
              </Card>
            );
          }}
          ListEmptyComponent={<EmptyState title={t('noData')} />}
        />
      ) : null}

      <Sheet visible={Boolean(detailBooking)} onClose={() => setDetailBooking(null)}>
        {detailBooking ? (
          <View style={{gap: spacing.sm}}>
            <Text style={[typography.h3, {color: colors.text}, textDir(isRTL)]}>{detailBooking.clientName}</Text>
            <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>{format(parseISO(detailBooking.startAt), 'PPP HH:mm')}</Text>
            <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>
              {serviceById.get(detailBooking.serviceId)?.name || t('service')} • {staffById.get(detailBooking.staffId)?.name || t('staffMember')}
            </Text>
            <View style={{gap: spacing.xs}}>
              {actionError ? <Text style={[typography.bodySm, {color: colors.danger}, textDir(isRTL)]}>{actionError}</Text> : null}
              {canManageBookings && detailBooking.status === 'pending' ? (
                <Button title={t('confirmBooking')} onPress={() => void changeStatus('confirmed')} loading={statusMutation.isPending} />
              ) : null}
              {canManageBookings ? <Button title={t('markCompleted')} onPress={() => void changeStatus('completed')} loading={statusMutation.isPending} /> : null}
              {canManageBookings ? <Button title={t('markNoShow')} variant="secondary" onPress={() => void changeStatus('no_show')} loading={statusMutation.isPending} /> : null}
              {canManageBookings ? <Button title={t('cancelBooking')} variant="danger" onPress={() => void changeStatus('canceled')} loading={statusMutation.isPending} /> : null}
              {canManageBookings ? (
                <Button
                  title={t('reschedule')}
                  variant="ghost"
                  onPress={() => {
                    openReschedule(detailBooking);
                    setDetailBooking(null);
                  }}
                  loading={rescheduleMutation.isPending}
                />
              ) : null}
            </View>
          </View>
        ) : null}
      </Sheet>

      <Sheet visible={createOpen} onClose={() => setCreateOpen(false)}>
        <Text style={[typography.h3, {color: colors.text}, textDir(isRTL)]}>{t('createBookingFlow')}</Text>
        <View style={{gap: spacing.sm}}>
          {actionError ? <Text style={[typography.bodySm, {color: colors.danger}, textDir(isRTL)]}>{actionError}</Text> : null}
          <Input label={t('searchClient')} value={clientQuery} onChangeText={setClientQuery} placeholder={t('clientsSearch')} />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: spacing.xs}}>
            {clientCandidates.map((client) => (
              <Chip
                key={client.id}
                label={`${client.name} • ${client.phone}`}
                onPress={() => {
                  createForm.setValue('clientName', client.name, {shouldValidate: true});
                  createForm.setValue('clientPhone', client.phone, {shouldValidate: true});
                }}
              />
            ))}
          </ScrollView>

          <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>{t('selectClientHint')}</Text>

          <Controller
            control={createForm.control}
            name="clientName"
            render={({field: {value, onChange}, fieldState: {error}}) => (
              <Input label={t('stepClient')} value={value} onChangeText={onChange} error={error ? t('requiredField') : undefined} />
            )}
          />

          <Controller
            control={createForm.control}
            name="clientPhone"
            render={({field: {value, onChange}, fieldState: {error}}) => (
              <Input
                label={t('phoneLabel')}
                value={value}
                onChangeText={onChange}
                keyboardType="phone-pad"
                error={error ? t('requiredField') : undefined}
              />
            )}
          />

          <Controller
            control={createForm.control}
            name="serviceId"
            render={({field: {value, onChange}, fieldState: {error}}) => (
              <View style={{gap: 6}}>
                <Text style={[typography.caption, {color: colors.textMuted}, textDir(isRTL)]}>{t('stepService')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8}}>
                  {activeServices.map((service) => (
                    <Chip
                      key={service.id}
                      label={`${service.name} (${service.durationMin}${t('minutes')})`}
                      active={value === service.id}
                      onPress={() => onChange(service.id)}
                    />
                  ))}
                </ScrollView>
                {error ? <Text style={[typography.bodySm, {color: colors.danger}]}>{t('requiredField')}</Text> : null}
              </View>
            )}
          />

          <Controller
            control={createForm.control}
            name="staffId"
            render={({field: {value, onChange}, fieldState: {error}}) => (
              <View style={{gap: 6}}>
                <Text style={[typography.caption, {color: colors.textMuted}, textDir(isRTL)]}>{t('stepStaff')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8}}>
                  {createStaffOptions.map((staff) => (
                    <Chip key={staff.id} label={staff.name} active={value === staff.id} onPress={() => onChange(staff.id)} />
                  ))}
                </ScrollView>
                {error ? <Text style={[typography.bodySm, {color: colors.danger}]}>{t('requiredField')}</Text> : null}
              </View>
            )}
          />

          <Controller
            control={createForm.control}
            name="startAt"
            render={({field: {value, onChange}, fieldState: {error}}) => (
              <View style={{gap: 6}}>
                <Text style={[typography.caption, {color: colors.textMuted}, textDir(isRTL)]}>{t('stepTime')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8}}>
                  {createSlotOptions.map((option) => (
                    <Chip key={option.value} label={option.label} active={value === option.value} onPress={() => onChange(option.value)} />
                  ))}
                </ScrollView>
                {!createSlotOptions.length ? <Text style={[typography.bodySm, {color: colors.warning}, textDir(isRTL)]}>{t('noAvailableSlots')}</Text> : null}
                {error ? <Text style={[typography.bodySm, {color: colors.danger}]}>{t('requiredField')}</Text> : null}
              </View>
            )}
          />

          <Button
            title={t('complete')}
            onPress={createForm.handleSubmit(onCreate)}
            loading={createMutation.isPending}
            disabled={!createSlotOptions.length || !createStaffOptions.length}
          />
        </View>
      </Sheet>

      <Sheet visible={blockOpen} onClose={() => setBlockOpen(false)}>
        <Text style={[typography.h3, {color: colors.text}, textDir(isRTL)]}>{t('blockTime')}</Text>
        <View style={{gap: spacing.sm}}>
          {actionError ? <Text style={[typography.bodySm, {color: colors.danger}, textDir(isRTL)]}>{actionError}</Text> : null}
          <Controller
            control={blockForm.control}
            name="staffId"
            render={({field: {value, onChange}, fieldState: {error}}) => (
              <View style={{gap: 6}}>
                <Text style={[typography.caption, {color: colors.textMuted}, textDir(isRTL)]}>{t('staffMember')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8}}>
                  {staffRows.map((staff) => (
                    <Chip key={staff.id} label={staff.name} active={value === staff.id} onPress={() => onChange(staff.id)} />
                  ))}
                </ScrollView>
                {error ? <Text style={[typography.bodySm, {color: colors.danger}]}>{t('requiredField')}</Text> : null}
              </View>
            )}
          />

          <Controller
            control={blockForm.control}
            name="startAt"
            render={({field: {value, onChange}, fieldState: {error}}) => (
              <View style={{gap: 6}}>
                <Text style={[typography.caption, {color: colors.textMuted}, textDir(isRTL)]}>{t('stepTime')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8}}>
                  {blockSlotOptions.map((option) => (
                    <Chip key={option.value} label={option.label} active={value === option.value} onPress={() => onChange(option.value)} />
                  ))}
                </ScrollView>
                {!blockSlotOptions.length ? <Text style={[typography.bodySm, {color: colors.warning}, textDir(isRTL)]}>{t('noAvailableSlots')}</Text> : null}
                {error ? <Text style={[typography.bodySm, {color: colors.danger}]}>{t('requiredField')}</Text> : null}
              </View>
            )}
          />

          <Controller
            control={blockForm.control}
            name="endAt"
            render={({field: {value}, fieldState: {error}}) => (
              <Input label={t('endLabel')} value={value} editable={false} error={error ? t('requiredField') : undefined} />
            )}
          />

          <Controller control={blockForm.control} name="reason" render={({field: {value, onChange}}) => <Input label={t('clientNotes')} value={value || ''} onChangeText={onChange} />} />

          <Button title={t('save')} onPress={blockForm.handleSubmit(onBlock)} loading={blockMutation.isPending} disabled={!blockSlotOptions.length} />
        </View>
      </Sheet>

      <Sheet
        visible={rescheduleOpen}
        onClose={() => {
          setRescheduleOpen(false);
          setRescheduleTarget(null);
          rescheduleForm.reset({staffId: '', startAt: ''});
        }}
      >
        <Text style={[typography.h3, {color: colors.text}, textDir(isRTL)]}>{t('rescheduleBooking')}</Text>
        <View style={{gap: spacing.sm}}>
          {actionError ? <Text style={[typography.bodySm, {color: colors.danger}, textDir(isRTL)]}>{actionError}</Text> : null}
          <Controller
            control={rescheduleForm.control}
            name="staffId"
            render={({field: {value, onChange}, fieldState: {error}}) => {
              const serviceAssigned = rescheduleTarget ? staffByService.get(rescheduleTarget.serviceId) || [] : [];
              const options = !serviceAssigned.length ? staffRows : staffRows.filter((row) => serviceAssigned.includes(row.id));
              return (
                <View style={{gap: 6}}>
                  <Text style={[typography.caption, {color: colors.textMuted}, textDir(isRTL)]}>{t('stepStaff')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8}}>
                    {options.map((staff) => (
                      <Chip key={staff.id} label={staff.name} active={value === staff.id} onPress={() => onChange(staff.id)} />
                    ))}
                  </ScrollView>
                  {error ? <Text style={[typography.bodySm, {color: colors.danger}]}>{t('requiredField')}</Text> : null}
                </View>
              );
            }}
          />

          <Controller
            control={rescheduleForm.control}
            name="startAt"
            render={({field: {value, onChange}, fieldState: {error}}) => (
              <View style={{gap: 6}}>
                <Text style={[typography.caption, {color: colors.textMuted}, textDir(isRTL)]}>{t('stepTime')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8}}>
                  {rescheduleSlotOptions.map((option) => (
                    <Chip key={option.value} label={option.label} active={value === option.value} onPress={() => onChange(option.value)} />
                  ))}
                </ScrollView>
                {!rescheduleSlotOptions.length ? <Text style={[typography.bodySm, {color: colors.warning}, textDir(isRTL)]}>{t('noAvailableSlots')}</Text> : null}
                {error ? <Text style={[typography.bodySm, {color: colors.danger}]}>{t('requiredField')}</Text> : null}
              </View>
            )}
          />

          <Button title={t('save')} onPress={rescheduleForm.handleSubmit(onReschedule)} loading={rescheduleMutation.isPending} disabled={!rescheduleSlotOptions.length} />
        </View>
      </Sheet>
    </SafeAreaView>
  );
}
