import {useCallback, useMemo, useState} from 'react';
import {FlatList, Pressable, ScrollView, Switch, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import {Controller, useForm} from 'react-hook-form';
import {z} from 'zod';
import {zodResolver} from '@hookform/resolvers/zod';
import {Button, Card, Chip, EmptyState, Input, Sheet} from '../components';
import {useTheme} from '../theme/provider';
import {useI18n} from '../i18n/provider';
import {textDir} from '../utils/layout';
import {useBookings, useServices, useStaff, useUpsertStaff} from '../api/hooks';
import type {Staff} from '../types/models';

const schema = z.object({
  id: z.string().optional(),
  name: z.string().min(2),
  roleTitle: z.string().min(2),
  phone: z.string().optional(),
  color: z.string().min(3),
  serviceIds: z.array(z.string()).min(1)
});

type FormValues = z.infer<typeof schema>;

type WorkingHourEditorRow = {
  start: string;
  end: string;
  off?: boolean;
  breakStart?: string;
  breakEnd?: string;
};

function buildDefaultWorkingHours(start = '08:00', end = '22:00') {
  return Array.from({length: 7}).reduce<Record<number, WorkingHourEditorRow>>((acc, _row, day) => {
    acc[day] = {start, end, off: false, breakStart: '', breakEnd: ''};
    return acc;
  }, {});
}

export function StaffScreen() {
  const {colors, spacing, typography, radius} = useTheme();
  const {t, isRTL} = useI18n();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [workingHours, setWorkingHours] = useState<Record<number, WorkingHourEditorRow>>(buildDefaultWorkingHours());

  const staffQuery = useStaff();
  const servicesQuery = useServices();
  const bookingsQuery = useBookings(new Date().toISOString(), 'list');
  const upsertStaff = useUpsertStaff();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      roleTitle: '',
      phone: '',
      color: '#2563EB',
      serviceIds: []
    }
  });

  const dayLabels = useMemo(
    () =>
      isRTL
        ? ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
        : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    [isRTL]
  );

  function openEditor(member?: Staff) {
    const defaultHours = buildDefaultWorkingHours();
    if (member) {
      setEditing(member);
      setWorkingHours({
        ...defaultHours,
        ...member.workingHours,
      });
      form.reset({
        id: member.id,
        name: member.name,
        roleTitle: member.roleTitle,
        phone: member.phone,
        color: member.color,
        serviceIds: member.serviceIds
      });
    } else {
      setEditing(null);
      setWorkingHours(buildDefaultWorkingHours());
      form.reset({name: '', roleTitle: '', phone: '', color: '#2563EB', serviceIds: []});
    }
    setEditorOpen(true);
  }

  async function onSubmit(values: FormValues) {
    await upsertStaff.mutateAsync({
      ...values,
      workingHours
    });
    setEditorOpen(false);
  }

  function patchWorkingHour(day: number, patch: Partial<WorkingHourEditorRow>) {
    setWorkingHours((prev) => ({
      ...prev,
      [day]: {
        ...(prev[day] || {start: '08:00', end: '22:00', off: false, breakStart: '', breakEnd: ''}),
        ...patch
      }
    }));
  }

  const performance = useMemo(() => {
    const bookings = bookingsQuery.data || [];
    const services = new Map((servicesQuery.data || []).map((s) => [s.id, s]));
    return (staffQuery.data || []).map((member) => {
      const mine = bookings.filter((b) => b.staffId === member.id);
      const revenue = mine.reduce((sum, row) => sum + Number(services.get(row.serviceId)?.price || 0), 0);
      return {
        member,
        bookingsCount: mine.length,
        revenue
      };
    });
  }, [bookingsQuery.data, servicesQuery.data, staffQuery.data]);

  useFocusEffect(
    useCallback(() => {
      void staffQuery.refetch();
      void servicesQuery.refetch();
      void bookingsQuery.refetch();
      return () => {};
    }, [bookingsQuery, servicesQuery, staffQuery])
  );

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: colors.background}}>
      <View style={{flex: 1, padding: spacing.lg, gap: spacing.sm}}>
        <View style={{flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center'}}>
          <Text style={[typography.h2, {color: colors.text}, textDir(isRTL)]}>{t('staff')}</Text>
          <Button title={isRTL ? 'إضافة موظفة' : 'Add staff'} onPress={() => openEditor()} />
        </View>

        <Card style={{gap: spacing.sm}}>
          <Text style={[typography.h3, {color: colors.text}, textDir(isRTL)]}>{t('staffPerformance')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: spacing.sm}}>
            {performance.map((row) => (
              <View
                key={row.member.id}
                style={{
                  minWidth: 170,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  padding: spacing.sm,
                  gap: 4,
                  backgroundColor: colors.surfaceSoft
                }}
              >
                <Text style={[typography.body, {color: colors.text, fontWeight: '700'}, textDir(isRTL)]}>{row.member.name}</Text>
                <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>{t('bookings')}: {row.bookingsCount}</Text>
                <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>{t('revenue')}: ${row.revenue}</Text>
              </View>
            ))}
          </ScrollView>
        </Card>

        <FlatList
          data={staffQuery.data || []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{gap: spacing.xs, paddingBottom: 120}}
          renderItem={({item}) => (
            <Pressable onPress={() => openEditor(item)}>
              <Card style={{gap: 4, borderLeftWidth: 4, borderLeftColor: item.color}}>
                <Text style={[typography.body, {color: colors.text, fontWeight: '700'}, textDir(isRTL)]}>{item.name}</Text>
                <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>{item.roleTitle}</Text>
                <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>{item.phone || '-'}</Text>
              </Card>
            </Pressable>
          )}
          ListEmptyComponent={<EmptyState title={t('noData')} />}
        />
      </View>

      <Sheet visible={editorOpen} onClose={() => setEditorOpen(false)}>
        <Text style={[typography.h3, {color: colors.text}, textDir(isRTL)]}>{editing ? t('update') : t('create')}</Text>
        <View style={{gap: spacing.sm}}>
          <Controller
            control={form.control}
            name="name"
            render={({field: {value, onChange}, fieldState: {error}}) => (
              <Input label={t('name')} value={value} onChangeText={onChange} error={error ? t('requiredField') : undefined} />
            )}
          />

          <Controller
            control={form.control}
            name="roleTitle"
            render={({field: {value, onChange}, fieldState: {error}}) => (
              <Input label={isRTL ? 'المسمى الوظيفي' : 'Role title'} value={value} onChangeText={onChange} error={error ? t('requiredField') : undefined} />
            )}
          />

          <Controller control={form.control} name="phone" render={({field: {value, onChange}}) => <Input label={t('phoneLabel')} value={value || ''} onChangeText={onChange} keyboardType="phone-pad" />} />

          <Controller
            control={form.control}
            name="serviceIds"
            render={({field: {value, onChange}, fieldState: {error}}) => (
              <View style={{gap: 6}}>
                <Text style={[typography.caption, {color: colors.textMuted}, textDir(isRTL)]}>{t('services')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8}}>
                  {(servicesQuery.data || []).map((service) => {
                    const active = value.includes(service.id);
                    return (
                      <Chip
                        key={service.id}
                        label={service.name}
                        active={active}
                        onPress={() => {
                          if (active) onChange(value.filter((id) => id !== service.id));
                          else onChange([...value, service.id]);
                        }}
                      />
                    );
                  })}
                </ScrollView>
                {error ? <Text style={[typography.bodySm, {color: colors.danger}]}>{t('requiredField')}</Text> : null}
              </View>
            )}
          />

          <View style={{gap: spacing.sm}}>
            <Text style={[typography.caption, {color: colors.textMuted}, textDir(isRTL)]}>{isRTL ? 'جدول العمل' : 'Working hours'}</Text>
            {dayLabels.map((label, dayIndex) => {
              const row = workingHours[dayIndex] || {start: '08:00', end: '22:00', off: false, breakStart: '', breakEnd: ''};
              return (
                <Card key={label} style={{gap: spacing.xs, backgroundColor: colors.surfaceSoft}}>
                  <View style={{flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between'}}>
                    <Text style={[typography.bodySm, {color: colors.text, fontWeight: '700'}, textDir(isRTL)]}>{label}</Text>
                    <View style={{flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: spacing.xs}}>
                      <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>{isRTL ? 'إجازة' : 'Off'}</Text>
                      <Switch value={Boolean(row.off)} onValueChange={(value) => patchWorkingHour(dayIndex, {off: value})} />
                    </View>
                  </View>
                  {!row.off ? (
                    <>
                      <View style={{flexDirection: isRTL ? 'row-reverse' : 'row', gap: spacing.sm}}>
                        <View style={{flex: 1}}>
                          <Input
                            label={isRTL ? 'من' : 'Start'}
                            value={row.start}
                            onChangeText={(value) => patchWorkingHour(dayIndex, {start: value})}
                            placeholder="08:00"
                          />
                        </View>
                        <View style={{flex: 1}}>
                          <Input
                            label={isRTL ? 'إلى' : 'End'}
                            value={row.end}
                            onChangeText={(value) => patchWorkingHour(dayIndex, {end: value})}
                            placeholder="22:00"
                          />
                        </View>
                      </View>
                      <View style={{flexDirection: isRTL ? 'row-reverse' : 'row', gap: spacing.sm}}>
                        <View style={{flex: 1}}>
                          <Input
                            label={isRTL ? 'بداية الاستراحة' : 'Break start'}
                            value={row.breakStart || ''}
                            onChangeText={(value) => patchWorkingHour(dayIndex, {breakStart: value})}
                            placeholder="13:00"
                          />
                        </View>
                        <View style={{flex: 1}}>
                          <Input
                            label={isRTL ? 'نهاية الاستراحة' : 'Break end'}
                            value={row.breakEnd || ''}
                            onChangeText={(value) => patchWorkingHour(dayIndex, {breakEnd: value})}
                            placeholder="14:00"
                          />
                        </View>
                      </View>
                    </>
                  ) : null}
                </Card>
              );
            })}
          </View>

          <Button title={t('save')} onPress={form.handleSubmit(onSubmit)} loading={upsertStaff.isPending} />
        </View>
      </Sheet>
    </SafeAreaView>
  );
}
