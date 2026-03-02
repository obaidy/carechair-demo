import {useCallback, useState} from 'react';
import {ScrollView, Share, Switch, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {Controller, useForm} from 'react-hook-form';
import {z} from 'zod';
import {zodResolver} from '@hookform/resolvers/zod';
import {Button, Card, Chip, EmptyState, Input, Sheet} from '../components';
import {useTheme} from '../theme/provider';
import {useI18n} from '../i18n/provider';
import {textDir} from '../utils/layout';
import {useAuthStore} from '../state/authStore';
import {useUiStore} from '../state/uiStore';
import {useReminders, useRequestActivation, useServices, useStaff, useUpdateReminder, useUpsertService} from '../api/hooks';
import {useSignOut} from '../api/authHooks';
import type {UpsertServiceInput} from '../types/models';
import {createInvite, type CreateInviteResult} from '../api/invites';
import {api} from '../api';
import {formatSalonOperationalCurrency} from '../utils';
import * as Clipboard from 'expo-clipboard';

const activationSchema = z.object({
  city: z.string().optional(),
  area: z.string().optional(),
  addressMode: z.enum(['LOCATION', 'MANUAL']),
  addressText: z.string().optional(),
  locationLat: z.string().optional(),
  locationLng: z.string().optional(),
  locationAccuracyM: z.string().optional(),
  locationLabel: z.string().optional(),
  storefrontPhotoUrl: z.string().optional()
});

const serviceSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2),
  durationMin: z.string().min(1),
  price: z.string().min(1),
  category: z.string().optional(),
  assignedStaffIds: z.array(z.string())
});

type ActivationValues = z.infer<typeof activationSchema>;
type ServiceValues = z.infer<typeof serviceSchema>;

export function MoreScreen() {
  const {colors, spacing, typography} = useTheme();
  const {t, isRTL, locale, setLocale} = useI18n();
  const navigation = useNavigation<any>();
  const toggleTheme = useUiStore((state) => state.toggleTheme);
  const themeMode = useUiStore((state) => state.themeMode);

  const context = useAuthStore((state) => state.context);
  const memberships = useAuthStore((state) => state.memberships);
  const setContext = useAuthStore((state) => state.setContext);

  const servicesQuery = useServices();
  const staffQuery = useStaff();
  const remindersQuery = useReminders();

  const requestActivation = useRequestActivation();
  const updateReminder = useUpdateReminder();
  const upsertService = useUpsertService();
  const signOut = useSignOut();

  const [serviceEditorOpen, setServiceEditorOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<'MANAGER' | 'STAFF'>('STAFF');
  const [inviteData, setInviteData] = useState<CreateInviteResult | null>(null);
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);

  const activationForm = useForm<ActivationValues>({
    resolver: zodResolver(activationSchema),
    defaultValues: {
      city: '',
      area: context?.salon?.locationLabel || '',
      addressMode: 'MANUAL',
      addressText: context?.salon?.locationAddress || '',
      locationLat: context?.salon?.locationLat ? String(context.salon.locationLat) : '',
      locationLng: context?.salon?.locationLng ? String(context.salon.locationLng) : '',
      locationAccuracyM: '',
      locationLabel: '',
      storefrontPhotoUrl: context?.salon?.storefrontPhotoUrl || ''
    }
  });

  const serviceForm = useForm<ServiceValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: '',
      durationMin: '45',
      price: '20',
      category: '',
      assignedStaffIds: []
    }
  });

  const isActive = context?.salon?.status === 'ACTIVE';
  const currentMembership = memberships.find((membership) => membership.salonId === context?.salon?.id && membership.status === 'ACTIVE');
  const canCreateInvite = currentMembership?.role === 'OWNER' || currentMembership?.role === 'MANAGER';
  const canManageSalon = canCreateInvite;

  useFocusEffect(
    useCallback(() => {
      void servicesQuery.refetch();
      void staffQuery.refetch();
      void remindersQuery.refetch();
      void api.owner.getContext().then((next) => {
        setContext(next);
      }).catch(() => {});
      return () => {};
    }, [remindersQuery, servicesQuery, staffQuery, setContext])
  );

  async function onRequestActivation(values: ActivationValues) {
    const salon = await requestActivation.mutateAsync({
      city: values.city || undefined,
      area: values.area || undefined,
      addressMode: values.addressMode,
      addressText: values.addressText || undefined,
      locationLat: values.locationLat ? Number(values.locationLat) : undefined,
      locationLng: values.locationLng ? Number(values.locationLng) : undefined,
      locationAccuracyM: values.locationAccuracyM ? Number(values.locationAccuracyM) : undefined,
      locationLabel: values.locationLabel || undefined,
      storefrontPhotoUrl: values.storefrontPhotoUrl
    });
    if (context) setContext({...context, salon});
  }

  async function onSaveService(values: ServiceValues) {
    const payload: UpsertServiceInput = {
      id: values.id,
      name: values.name,
      durationMin: Number(values.durationMin),
      price: Number(values.price),
      category: values.category,
      assignedStaffIds: values.assignedStaffIds
    };
    await upsertService.mutateAsync(payload);
    setServiceEditorOpen(false);
    serviceForm.reset({name: '', durationMin: '45', price: '20', category: '', assignedStaffIds: []});
  }

  async function onCreateInvite() {
    if (!context?.salon?.id || !canCreateInvite) return;
    setInviteError('');
    setInviteSaving(true);
    try {
      const data = await createInvite({
        salonId: context.salon.id,
        role: inviteRole,
        maxUses: 1,
        expiresInHours: 168
      });
      setInviteData(data);
      setInviteCopied(false);
      await Clipboard.setStringAsync(data.webLink || data.inviteLink);
      setInviteCopied(true);
    } catch (error: any) {
      setInviteError(String(error?.message || (isRTL ? 'فشل إنشاء الدعوة.' : 'Failed to create invite.')));
    } finally {
      setInviteSaving(false);
    }
  }

  async function onShareInvite() {
    if (!inviteData) return;
    const message = isRTL
      ? `انضم إلى ${context?.salon?.name || 'CareChair'} عبر كود الدعوة: ${inviteData.code}\n${inviteData.webLink || inviteData.inviteLink}`
      : `Join ${context?.salon?.name || 'CareChair'} with invite code: ${inviteData.code}\n${inviteData.webLink || inviteData.inviteLink}`;
    await Share.share({message});
  }

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: colors.background}}>
      <ScrollView contentContainerStyle={{padding: spacing.lg, gap: spacing.md, paddingBottom: 120}}>
        <Text style={[typography.h2, {color: colors.text}, textDir(isRTL)]}>{t('more')}</Text>

        <Card style={{gap: spacing.xs}}>
          <Text style={[typography.h3, {color: colors.text}, textDir(isRTL)]}>{isRTL ? 'ملف الصالون' : 'Salon profile'}</Text>
          <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>{context?.salon?.name || '-'}</Text>
          <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>{context?.salon?.locationAddress || '-'}</Text>
          {context?.salon?.status === 'ACTIVE' && context?.salon?.publicBookingUrl ? (
            <Text style={[typography.bodySm, {color: colors.primary}, textDir(isRTL)]}>{t('publishLink')}: {context.salon.publicBookingUrl}</Text>
          ) : (
            <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>{t('bookingLinkLocked')}</Text>
          )}
        </Card>

        <Card style={{gap: spacing.sm}}>
          <Text style={[typography.h3, {color: colors.text}, textDir(isRTL)]}>{t('services')}</Text>
          {(servicesQuery.data || []).map((service) => (
            <View key={service.id} style={{paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border}}>
              <Text style={[typography.body, {color: colors.text}, textDir(isRTL)]}>{service.name}</Text>
              <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>
                {service.durationMin} {t('minutes')} • {context?.salon ? formatSalonOperationalCurrency(service.price, context.salon, locale) : service.price}
              </Text>
            </View>
          ))}
          {!servicesQuery.data?.length ? <EmptyState title={t('noData')} /> : null}
          {canManageSalon ? <Button title={isRTL ? 'إضافة خدمة' : 'Add service'} onPress={() => setServiceEditorOpen(true)} /> : null}
        </Card>

        <Card style={{gap: spacing.sm}}>
          <Text style={[typography.h3, {color: colors.text}, textDir(isRTL)]}>{t('remindersSettings')}</Text>
          {!isActive ? <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>{t('remindersLocked')}</Text> : null}
          {(remindersQuery.data || []).map((reminder) => (
            <View key={reminder.id} style={{flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between'}}>
              <Text style={[typography.bodySm, {color: colors.text}, textDir(isRTL)]}>{reminder.channel.toUpperCase()} • {reminder.type}</Text>
              <Switch
                value={Boolean(reminder.enabled)}
                onValueChange={(value) => updateReminder.mutate({reminderId: reminder.id, enabled: value})}
                disabled={!isActive || updateReminder.isPending || !canManageSalon}
              />
            </View>
          ))}
        </Card>

        {!isActive ? (
        <Card style={{gap: spacing.sm}}>
          <Text style={[typography.h3, {color: colors.text}, textDir(isRTL)]}>{t('requestActivation')}</Text>
          <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>{t('activationHint')}</Text>

          <Controller
            control={activationForm.control}
            name="addressMode"
            render={({field: {value, onChange}}) => (
              <View style={{gap: spacing.xs}}>
                <Text style={[typography.bodySm, {color: colors.text}, textDir(isRTL)]}>{isRTL ? 'نمط العنوان' : 'Address mode'}</Text>
                <View style={{flexDirection: isRTL ? 'row-reverse' : 'row', gap: spacing.xs}}>
                  <Chip label={isRTL ? 'يدوي' : 'Manual'} active={value === 'MANUAL'} onPress={() => onChange('MANUAL')} />
                  <Chip label={isRTL ? 'موقع' : 'Location'} active={value === 'LOCATION'} onPress={() => onChange('LOCATION')} />
                </View>
              </View>
            )}
          />

          <View style={{flexDirection: isRTL ? 'row-reverse' : 'row', gap: spacing.sm}}>
            <View style={{flex: 1}}>
              <Controller control={activationForm.control} name="city" render={({field: {value, onChange}}) => <Input label={isRTL ? 'المدينة' : 'City'} value={value || ''} onChangeText={onChange} />} />
            </View>
            <View style={{flex: 1}}>
              <Controller control={activationForm.control} name="area" render={({field: {value, onChange}}) => <Input label={isRTL ? 'المنطقة' : 'Area'} value={value || ''} onChangeText={onChange} />} />
            </View>
          </View>

          <Controller
            control={activationForm.control}
            name="addressText"
            render={({field: {value, onChange}, fieldState: {error}}) => (
              <Input label={t('salonLocation')} value={value || ''} onChangeText={onChange} error={error ? t('requiredField') : undefined} />
            )}
          />

          <View style={{flexDirection: isRTL ? 'row-reverse' : 'row', gap: spacing.sm}}>
            <View style={{flex: 1}}>
              <Controller control={activationForm.control} name="locationLat" render={({field: {value, onChange}}) => <Input label={t('locationLat')} value={value || ''} onChangeText={onChange} />} />
            </View>
            <View style={{flex: 1}}>
              <Controller control={activationForm.control} name="locationLng" render={({field: {value, onChange}}) => <Input label={t('locationLng')} value={value || ''} onChangeText={onChange} />} />
            </View>
          </View>

          <View style={{flexDirection: isRTL ? 'row-reverse' : 'row', gap: spacing.sm}}>
            <View style={{flex: 1}}>
              <Controller control={activationForm.control} name="locationAccuracyM" render={({field: {value, onChange}}) => <Input label={isRTL ? 'دقة الموقع (م)' : 'Location accuracy (m)'} value={value || ''} onChangeText={onChange} />} />
            </View>
            <View style={{flex: 1}}>
              <Controller control={activationForm.control} name="locationLabel" render={({field: {value, onChange}}) => <Input label={isRTL ? 'وصف الموقع' : 'Location label'} value={value || ''} onChangeText={onChange} />} />
            </View>
          </View>

          <Controller control={activationForm.control} name="storefrontPhotoUrl" render={({field: {value, onChange}}) => <Input label={t('storefrontPhotoUrl')} value={value || ''} onChangeText={onChange} />} />

          <Button title={t('requestActivation')} onPress={activationForm.handleSubmit(onRequestActivation)} loading={requestActivation.isPending} />
        </Card>
        ) : null}

        <Card style={{gap: spacing.sm}}>
          <Text style={[typography.h3, {color: colors.text}, textDir(isRTL)]}>{t('teamRoles')}</Text>
          <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>
            {isRTL
              ? 'هيكل أولي للصلاحيات: مالك / مدير / موظفة. سيتم ربط صلاحيات تفصيلية لاحقاً.'
              : 'Role scaffold ready: Owner / Manager / Staff. Fine-grained permissions can be added next.'}
          </Text>
          {canCreateInvite ? (
            <View style={{gap: spacing.sm}}>
              <Text style={[typography.bodySm, {color: colors.text}, textDir(isRTL)]}>{t('teamInvites')}</Text>
              <View style={{flexDirection: isRTL ? 'row-reverse' : 'row', gap: spacing.xs}}>
                <Chip
                  label={t('inviteRoleStaff')}
                  active={inviteRole === 'STAFF'}
                  onPress={() => setInviteRole('STAFF')}
                />
                <Chip
                  label={t('inviteRoleManager')}
                  active={inviteRole === 'MANAGER'}
                  onPress={() => setInviteRole('MANAGER')}
                />
              </View>
              <Button
                title={t('generateInvite')}
                onPress={onCreateInvite}
                loading={inviteSaving}
                disabled={!context?.salon?.id || inviteSaving}
              />
              {inviteError ? <Text style={[typography.bodySm, {color: colors.danger}, textDir(isRTL)]}>{inviteError}</Text> : null}
              {inviteData ? (
                <Card style={{gap: spacing.xs, backgroundColor: colors.surfaceSoft}}>
                  <Text style={[typography.bodySm, {color: colors.text}, textDir(isRTL)]}>
                    {t('inviteCode')}: {inviteData.code}
                  </Text>
                  <Text style={[typography.bodySm, {color: colors.primary}, textDir(isRTL)]}>
                    {t('inviteLink')}: {inviteData.webLink || inviteData.inviteLink}
                  </Text>
                  {inviteCopied ? (
                    <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>
                      {isRTL ? 'تم نسخ رابط الدعوة.' : 'Invite link copied.'}
                    </Text>
                  ) : null}
                  <Button title={t('shareInvite')} variant="secondary" onPress={onShareInvite} />
                </Card>
              ) : null}
            </View>
          ) : null}
        </Card>

        <Card style={{gap: spacing.sm}}>
          <Text style={[typography.h3, {color: colors.text}, textDir(isRTL)]}>{t('settings')}</Text>
          <View style={{flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center'}}>
            <Text style={[typography.body, {color: colors.text}, textDir(isRTL)]}>{t('language')}</Text>
            <View style={{flexDirection: isRTL ? 'row-reverse' : 'row', gap: spacing.xs}}>
              <Chip label="AR" active={locale === 'ar'} onPress={() => setLocale('ar')} />
              <Chip label="EN" active={locale === 'en'} onPress={() => setLocale('en')} />
            </View>
          </View>
          <View style={{flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center'}}>
            <Text style={[typography.body, {color: colors.text}, textDir(isRTL)]}>{t('darkMode')}</Text>
            <Switch value={themeMode === 'dark'} onValueChange={() => toggleTheme()} />
          </View>
          {memberships.length > 1 ? (
            <Button title={isRTL ? 'تبديل الصالون' : 'Switch salon'} variant="secondary" onPress={() => navigation.navigate('SwitchSalon')} />
          ) : null}
        </Card>

        <Button title={t('support')} variant="secondary" onPress={() => undefined} />
        {__DEV__ ? <Button title="Diagnostics" variant="secondary" onPress={() => navigation.navigate('Diagnostics')} /> : null}
        <Button title={t('logout')} variant="ghost" onPress={() => signOut.mutate()} loading={signOut.isPending} />
      </ScrollView>

      <Sheet visible={serviceEditorOpen} onClose={() => setServiceEditorOpen(false)}>
        <Text style={[typography.h3, {color: colors.text}, textDir(isRTL)]}>{t('services')}</Text>
        <View style={{gap: spacing.sm}}>
          <Controller control={serviceForm.control} name="name" render={({field: {value, onChange}, fieldState: {error}}) => <Input label={t('name')} value={value} onChangeText={onChange} error={error ? t('requiredField') : undefined} />} />

          <View style={{flexDirection: isRTL ? 'row-reverse' : 'row', gap: spacing.sm}}>
            <View style={{flex: 1}}>
              <Controller control={serviceForm.control} name="durationMin" render={({field: {value, onChange}, fieldState: {error}}) => <Input label={t('duration')} value={value} onChangeText={onChange} error={error ? t('requiredField') : undefined} keyboardType="numeric" />} />
            </View>
            <View style={{flex: 1}}>
              <Controller control={serviceForm.control} name="price" render={({field: {value, onChange}, fieldState: {error}}) => <Input label={t('price')} value={value} onChangeText={onChange} error={error ? t('requiredField') : undefined} keyboardType="numeric" />} />
            </View>
          </View>

          <Controller control={serviceForm.control} name="category" render={({field: {value, onChange}}) => <Input label={isRTL ? 'التصنيف' : 'Category'} value={value || ''} onChangeText={onChange} />} />

          <Controller
            control={serviceForm.control}
            name="assignedStaffIds"
            render={({field: {value, onChange}}) => (
              <View style={{gap: spacing.xs}}>
                <Text style={[typography.caption, {color: colors.textMuted}, textDir(isRTL)]}>{t('staff')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: spacing.xs}}>
                  {(staffQuery.data || []).map((member) => {
                    const active = value.includes(member.id);
                    return (
                      <Chip
                        key={member.id}
                        label={member.name}
                        active={active}
                        onPress={() => {
                          if (active) onChange(value.filter((id) => id !== member.id));
                          else onChange([...value, member.id]);
                        }}
                      />
                    );
                  })}
                </ScrollView>
              </View>
            )}
          />

          <Button title={t('save')} onPress={serviceForm.handleSubmit(onSaveService)} loading={upsertService.isPending} />
        </View>
      </Sheet>
    </SafeAreaView>
  );
}
