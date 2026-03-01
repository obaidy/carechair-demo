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
import type {Booking, BookingStatus, Salon, Service, Staff} from '../types/models';

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

type DayWindow = {startMin: number; endMin: number};

type SlotOption = {label: string; value: string};

function parseHmToMinutes(value: string, fallback: number) {
  const [hRaw, mRaw] = String(value || '').split(':');
  const hours = Number(hRaw);
  const mins = Number(mRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return fallback;
  return hours * 60 + mins;
}

function minutesToDate(baseDay: Date, totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return setMinutes(setHours(baseDay, hours), mins);
}

function overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && endA > startB;
}

function getSalonWindow(salon: Salon | null): DayWindow {
  return {
    startMin: parseHmToMinutes(salon?.workdayStart || '08:00', 8 * 60),
    endMin: parseHmToMinutes(salon?.workdayEnd || '22:00', 22 * 60)
  };
}

function getStaffDayWindow(staff: Staff | undefined, date: Date, salonWindow: DayWindow): DayWindow | null {
  if (!staff) return salonWindow;
  const day = date.getDay();
  const rule = staff.workingHours?.[day];
  if (!rule) return salonWindow;
  if (rule.off) return null;

  const start = Math.max(salonWindow.startMin, parseHmToMinutes(rule.start, salonWindow.startMin));
  const end = Math.min(salonWindow.endMin, parseHmToMinutes(rule.end, salonWindow.endMin));
  if (end <= start) return null;
  return {startMin: start, endMin: end};
}

function slotOptionsForStaff(params: {
  date: Date;
  staff: Staff | undefined;
  durationMin: number;
  bookings: Booking[];
  salon: Salon | null;
  excludeBookingId?: string;
}): SlotOption[] {
  const {date, staff, durationMin, bookings, salon, excludeBookingId} = params;
  const salonWindow = getSalonWindow(salon);
  const staffWindow = getStaffDayWindow(staff, date, salonWindow);
  if (!staffWindow || !staff) return [];

  const dayBase = startOfDay(date);
  const start = minutesToDate(dayBase, staffWindow.startMin);
  const close = minutesToDate(dayBase, staffWindow.endMin);

  const out: SlotOption[] = [];
  for (let cursor = start; cursor < close; cursor = addMinutes(cursor, 30)) {
    const end = addMinutes(cursor, durationMin);
    if (end > close) continue;

    const conflict = bookings.some((row) => {
      if (row.staffId !== staff.id) return false;
      if (row.id === excludeBookingId) return false;
      if (row.status === 'canceled') return false;
      return overlaps(cursor, end, parseISO(row.startAt), parseISO(row.endAt));
    });

    if (!conflict) {
      out.push({label: format(cursor, 'HH:mm'), value: cursor.toISOString()});
    }
  }

  return out;
}

export function CalendarScreen() {
  const {colors, spacing, typography, radius} = useTheme();
  const {t, isRTL} = useI18n();

  const view = useUiStore((state) => state.calendarView);
  const setView = useUiStore((state) => state.setCalendarView);
  const selectedDateIso = useUiStore((state) => state.selectedDateIso);
  const setSelectedDateIso = useUiStore((state) => state.setSelectedDateIso);

  const salon = useAuthStore((state) => state.context?.salon || null);

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

  const createMutation = useCreateBooking(selectedDate.toISOString(), view, selectedStaffId === 'all' ? undefined : selectedStaffId);
  const statusMutation = useUpdateBookingStatus(selectedDate.toISOString(), view, selectedStaffId === 'all' ? undefined : selectedStaffId);
  const rescheduleMutation = useRescheduleBooking(selectedDate.toISOString(), view, selectedStaffId === 'all' ? undefined : selectedStaffId);
  const blockMutation = useBlockTime(selectedDate.toISOString(), view, selectedStaffId === 'all' ? undefined : selectedStaffId);

  const staffRows = staffQuery.data || [];
  const servicesRows = servicesQuery.data || [];
  const bookingRows = bookingsQuery.data || [];

  useFocusEffect(
    useCallback(() => {
      void staffQuery.refetch();
      void servicesQuery.refetch();
      void bookingsQuery.refetch();
      return () => {};
    }, [bookingsQuery, servicesQuery, staffQuery])
  );

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

  const salonWindow = useMemo(() => getSalonWindow(salon), [salon]);

  const timelineSlots = useMemo(() => {
    const dayBase = startOfDay(selectedDate);
    const selectedStaff = selectedStaffId === 'all' ? undefined : staffById.get(selectedStaffId);
    const dayWindow = selectedStaff ? getStaffDayWindow(selectedStaff, selectedDate, salonWindow) : salonWindow;
    if (!dayWindow) return [] as Date[];

    const out: Date[] = [];
    for (let minute = dayWindow.startMin; minute < dayWindow.endMin; minute += 30) {
      out.push(minutesToDate(dayBase, minute));
    }
    return out;
  }, [selectedDate, selectedStaffId, staffById, salonWindow]);

  const bookingsBySlot = useMemo(() => {
    const map = new Map<number, Booking[]>();
    for (const booking of bookingRows) {
      const key = +new Date(booking.startAt);
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
      salon
    });
  }, [bookingRows, createStaffId, selectedCreateService?.durationMin, selectedDate, salon, staffById]);

  const blockSlotOptions = useMemo(() => {
    const staff = staffById.get(blockStaffId || '');
    return slotOptionsForStaff({
      date: selectedDate,
      staff,
      durationMin: 30,
      bookings: bookingRows,
      salon
    });
  }, [bookingRows, blockStaffId, selectedDate, salon, staffById]);

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
      salon,
      excludeBookingId: rescheduleTarget.id
    });
  }, [bookingRows, rescheduleTarget, detailService?.durationMin, rescheduleStaffId, selectedDate, salon, staffById]);

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
      setActionError(String(error?.message || t('requiredField')));
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
      setActionError(String(error?.message || t('requiredField')));
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
      setActionError(String(error?.message || t('requiredField')));
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
      setActionError(String(error?.message || t('requiredField')));
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
        <Chip label={t('allStaff')} active={selectedStaffId === 'all'} onPress={() => setSelectedStaffId('all')} />
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
            <Button title={t('addBooking')} onPress={() => setCreateOpen(true)} />
            <Button title={t('blockTime')} variant="secondary" onPress={() => setBlockOpen(true)} />
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
              <Chip label={t('allStaff')} active={selectedStaffId === 'all'} onPress={() => setSelectedStaffId('all')} />
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
              <Button title={t('markCompleted')} onPress={() => void changeStatus('completed')} loading={statusMutation.isPending} />
              <Button title={t('markNoShow')} variant="secondary" onPress={() => void changeStatus('no_show')} loading={statusMutation.isPending} />
              <Button title={t('cancelBooking')} variant="danger" onPress={() => void changeStatus('canceled')} loading={statusMutation.isPending} />
              <Button
                title={t('reschedule')}
                variant="ghost"
                onPress={() => {
                  openReschedule(detailBooking);
                  setDetailBooking(null);
                }}
                loading={rescheduleMutation.isPending}
              />
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
